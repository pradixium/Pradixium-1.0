// Builds lib/data/stlSales.js from the City of St. Louis Assessor's open data
// (https://www.stlouis-mo.gov/data/): "Property Sales" (prclsale.mdb) and
// "Parcel Data" (prcl.mdb). Run when the city republishes them:
//
//   node scripts/build-stl-sales.mjs
//
// Needs network access to stlouis-mo.gov, the `unzip` CLI and mdbtools
// (`mdb-export`, e.g. `apt-get install mdbtools`).
// Rules (the Assessor's own CdSaleType table, shipped inside prclsale.mdb):
//  - only SaleType 10 "Valid — Improved, open market, arms length"
//  - single-parcel sales (NbrOfParcels = 1), price > 0
//  - property type from the Assessor land use (city vocabulary "Assessor
//    Land Use"): 1110 single family + 1111 townhouse = "house";
//    1114 / 1115 condominium = "condo"
//  - per sq ft only for houses with exactly one residential building whose
//    LivingAreaTotal (BldgRes) is recorded — living area, not lot area
//  - grouped by the parcel's ZIP; 10+ sales per figure
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = "https://www.stlouis-mo.gov/data/upload/data-files/";
const MIN_SALES = 10;
const OUT = new URL("../lib/data/stlSales.js", import.meta.url);
const dir = mkdtempSync(join(tmpdir(), "stl-"));

async function download(name) {
  const res = await fetch(BASE + name, { headers: { "user-agent": "Mozilla/5.0 (Pradixium data build)" } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const zip = join(dir, name);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
  rmSync(zip);
}
function exportTable(mdb, table) {
  const path = join(dir, table + ".csv");
  execFileSync("sh", ["-c", `mdb-export "${join(dir, mdb)}" ${table} > "${path}"`], { maxBuffer: 1 << 30 });
  return path;
}
function splitCsv(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
async function* rows(path) {
  let head = null;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity })) {
    if (!line) continue;
    const cells = splitCsv(line);
    if (!head) { head = cells; continue; }
    yield Object.fromEntries(head.map((k, i) => [k, (cells[i] ?? "").trim()]));
  }
}
// mdb-export dates look like "03/01/24 00:00:00"
const isoDate = (s) => { const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{2})/); if (!m) return null; const y = Number(m[3]); return `${y < 50 ? 2000 + y : 1900 + y}-${m[1]}-${m[2]}`; };
const median = (xs) => { const v = [...xs].sort((a, b) => a - b), m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const key = (r) => `${Number(r.CityBlock)}:${Number(r.Parcel)}:${Number(r.OwnerCode)}`;

await download("prclsale.zip");
await download("prcl.zip");

// 1. the Assessor's own sale-type definitions — stop if code 10 ever changes meaning
let valid = null;
for await (const r of rows(exportTable("prclsale.mdb", "CdSaleType"))) if (r.SaleType === "10") valid = r;
if (!valid || valid.Descr !== "Valid" || !/arms length/i.test(valid.Explanation)) throw new Error(`SaleType 10 is no longer "Valid / arms length": ${JSON.stringify(valid)}`);

// 2. valid single-parcel sales
const sales = [];
for await (const r of rows(exportTable("prclsale.mdb", "PrclSale"))) {
  const price = Number(r.SalePrice), date = isoDate(r.SaleDate);
  if (r.SaleType !== "10" || r.NbrOfParcels !== "1" || !(price > 0) || !date) continue;
  sales.push({ id: r.AsrParcelId, key: key(r), price, date });
}
const today = new Date().toISOString().slice(0, 10);
const dated = sales.filter((s) => s.date <= today);
const latest = dated.reduce((m, s) => (s.date > m ? s.date : m), "0000-00-00");
// the two most recent calendar years present in the file
const fromYear = String(Number(latest.slice(0, 4)) - 1);
const recent = dated.filter((s) => s.date >= `${fromYear}-01-01`);

// 3. parcel type + ZIP, and living area of single-building houses
const parcel = new Map();
for await (const r of rows(exportTable("prcl.mdb", "Prcl"))) {
  const lu = r.AsrLandUse1;
  const type = lu === "1110" || lu === "1111" ? "house" : lu === "1114" || lu === "1115" ? "condo" : null;
  const zip = String(r.ZIP || "").slice(0, 5);
  if (type && /^\d{5}$/.test(zip)) parcel.set(r.AsrParcelId, { type, zip });
}
const bldgs = new Map();
for await (const r of rows(exportTable("prcl.mdb", "BldgRes"))) (bldgs.get(r.AsrParcelId) || bldgs.set(r.AsrParcelId, []).get(r.AsrParcelId)).push(Number(r.LivingAreaTotal) || 0);

const groups = {};
let used = 0;
for (const s of recent) {
  const p = parcel.get(s.id);
  if (!p) continue;
  const b = bldgs.get(s.id) || [];
  const area = p.type === "house" && b.length === 1 && b[0] > 0 ? b[0] : null;
  ((groups[p.zip] ||= {})[p.type] ||= []).push({ price: s.price, area });
  used++;
}
const zips = {};
for (const [zip, byType] of Object.entries(groups)) {
  const e = {};
  for (const [type, list] of Object.entries(byType)) {
    if (list.length < MIN_SALES) continue;
    const withArea = list.filter((x) => x.area);
    e[type] = {
      sales: list.length,
      medianPrice: Math.round(median(list.map((x) => x.price))),
      medianPerSqFt: withArea.length >= MIN_SALES ? Math.round(median(withArea.map((x) => x.price / x.area))) : null,
      salesWithArea: withArea.length
    };
  }
  if (Object.keys(e).length) zips[zip] = e;
}

// 4. each parcel's most recent valid sale since 2010 (block:parcel:owner code)
const last = {};
for (const s of dated) if (s.date >= "2010-01-01" && (!last[s.key] || s.date > last[s.key][1])) last[s.key] = [s.price, s.date];

writeFileSync(OUT, `/* PRADIXIUM™ — City of St. Louis valid residential sales (GENERATED)
 * Do not edit by hand — regenerate with: node scripts/build-stl-sales.mjs
 * Source: City of St. Louis Assessor's Office open data — Property Sales
 * (prclsale.mdb) + Parcel Data (prcl.mdb), https://www.stlouis-mo.gov/data/
 * Only SaleType 10 "Valid — improved, open market, arms length",
 * single-parcel sales. ZIP figures: ${fromYear}-01 to ${latest.slice(0, 7)} (the latest
 * the city publishes), 10+ sales each; per sq ft = living area
 * (BldgRes.LivingAreaTotal) of single-building houses only.
 * LAST (valid sales since 2010) keys: "<city block>:<parcel>:<owner code>" → [price, date].
 */
export const STL_SALES_META = ${JSON.stringify({ source: "City of St. Louis Assessor — Property Sales + Parcel Data (open data)", sourceUrl: "https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=31", periodFrom: `${fromYear}-01`, periodTo: latest.slice(0, 7), latestSale: latest, builtOn: today, minSales: MIN_SALES, validCode: "10 — Valid: improved, open market, arms length" }, null, 2)};

export const STL_ZIP_SALES = ${JSON.stringify(zips)};

export const STL_LAST_VALID_SALE = ${JSON.stringify(last)};

export function getStlZipSales(zip) {
  const e = STL_ZIP_SALES[String(zip || "").trim().slice(0, 5)];
  return e ? { ...e } : null;
}
export function getStlLastValidSale(cityBlock, parcel, ownerCode) {
  const e = STL_LAST_VALID_SALE[\`\${Number(cityBlock)}:\${Number(parcel)}:\${Number(ownerCode)}\`];
  return e ? { price: e[0], date: e[1] } : null;
}
`);
rmSync(dir, { recursive: true, force: true });
console.log(`St. Louis: ${sales.length} valid single-parcel sales (latest ${latest}); ${used} residential in ${fromYear}-01..${latest.slice(0, 7)} → ${Object.keys(zips).length} ZIPs; ${Object.keys(last).length} parcels with a last valid sale`);
