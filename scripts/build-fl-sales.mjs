// Builds lib/data/flSales.js from the Florida Department of Revenue's
// Property Tax Oversight data portal — the Sale Data File (SDF) and the
// Name-Address-Legal file (NAL) that every county property appraiser
// submits. Run when FDOR publishes a new roll (preliminary ~July, final
// ~September):
//
//   node scripts/build-fl-sales.mjs            # default roll 2026P
//   node scripts/build-fl-sales.mjs 2027P
//
// Needs network access to floridarevenue.com and the `unzip` CLI.
// Rules (FDOR 2025 NAL/SDF/NAP User's Guide, sale qualification codes):
//  - only QUAL_CD 01 or 02: "transfers qualified as arm's length" and
//    included in the state's sales ratio analysis
//  - VI_CD "I" (improved) and not a multi-parcel sale
//  - DOR use code 001 (single family) or 004 (condominium)
//  - per-sq-ft uses NAL TOT_LVG_AREA, which FDOR defines as EFFECTIVE area
//    (base area plus weighted garages, porches, etc.) — not pure living
//    area, so the app shows these figures as context only
//  - grouped by county + physical ZIP code; 10+ sales per figure
import { execFileSync } from "node:child_process";
import { createReadStream, mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROLL = process.argv[2] || "2026P";
const PORTAL = "https://floridarevenue.com/property/dataportal";
const DOCS = "/property/dataportal/Documents/PTO Data Portal/Tax Roll Data Files";
const MIN_SALES = 10;
// county FIPS → FDOR county number and the name used in FDOR file names
const COUNTIES = {
  "12086": { co: 23, name: "Dade" }, "12011": { co: 16, name: "Broward" }, "12099": { co: 60, name: "Palm Beach" },
  "12057": { co: 39, name: "Hillsborough" }, "12103": { co: 62, name: "Pinellas" }, "12101": { co: 61, name: "Pasco" }, "12053": { co: 37, name: "Hernando" },
  "12095": { co: 58, name: "Orange" }, "12097": { co: 59, name: "Osceola" }, "12117": { co: 69, name: "Seminole" }, "12069": { co: 45, name: "Lake" }
};
const OUT = new URL("../lib/data/flSales.js", import.meta.url);
const dir = mkdtempSync(join(tmpdir(), "fl-pto-"));

async function listFiles(kind) {
  const folder = encodeURIComponent(`${DOCS}/${kind}/${ROLL}`).replace(/%2F/g, "/");
  const url = `${PORTAL}/_api/web/GetFolderByServerRelativeUrl('${folder}')/Files?$select=Name,ServerRelativeUrl&$top=500`;
  const res = await fetch(url, { headers: { accept: "application/json;odata=nometadata" } });
  if (!res.ok) throw new Error(`${kind} listing: HTTP ${res.status}`);
  return (await res.json()).value;
}
async function fetchCsv(file, tag) {
  const res = await fetch("https://floridarevenue.com" + encodeURI(file.ServerRelativeUrl));
  if (!res.ok) throw new Error(`${file.Name}: HTTP ${res.status}`);
  const zip = join(dir, tag + ".zip"), out = join(dir, tag);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", zip, "-d", out]);
  return join(out, readdirSync(out).find((n) => /\.csv$/i.test(n)));
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
  for await (const line of createInterface({ input: createReadStream(path, { encoding: "latin1" }), crlfDelay: Infinity })) {
    if (!line) continue;
    const cells = splitCsv(line);
    if (!head) { head = cells; continue; }
    yield Object.fromEntries(head.map((k, i) => [k.trim(), (cells[i] ?? "").trim()]));
  }
}
const median = (xs) => { const v = [...xs].sort((a, b) => a - b), m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const pick = (files, name) => files.find((f) => new RegExp(`^${name}\\b`, "i").test(f.Name));

const [sdfFiles, nalFiles] = await Promise.all([listFiles("SDF"), listFiles("NAL")]);
const out = {};
let minYm = "9999-99", maxYm = "0000-00", total = 0;
for (const [fips, c] of Object.entries(COUNTIES)) {
  const sdfFile = pick(sdfFiles, c.name), nalFile = pick(nalFiles, c.name);
  if (!sdfFile || !nalFile) throw new Error(`${c.name}: SDF/NAL file not found in ${ROLL}`);
  // 1. qualified sales
  const sales = new Map();
  for await (const r of rows(await fetchCsv(sdfFile, `sdf${fips}`))) {
    if (Number(r.CO_NO) !== c.co) throw new Error(`${c.name}: CO_NO ${r.CO_NO} in SDF, expected ${c.co}`);
    const type = r.DOR_UC === "001" ? "house" : r.DOR_UC === "004" ? "condo" : null;
    const price = Number(r.SALE_PRC);
    if (!type || !["01", "02"].includes(r.QUAL_CD) || r.VI_CD !== "I" || r.MULTI_PAR_SAL || !(price > 0)) continue;
    const ym = `${r.SALE_YR}-${String(r.SALE_MO).padStart(2, "0")}`;
    (sales.get(r.PARCEL_ID) || sales.set(r.PARCEL_ID, []).get(r.PARCEL_ID)).push({ type, price, ym });
  }
  // 2. join to NAL for ZIP and effective area
  const groups = {};
  for await (const r of rows(await fetchCsv(nalFile, `nal${fips}`))) {
    const s = sales.get(r.PARCEL_ID);
    if (!s) continue;
    const zip = String(r.PHY_ZIPCD || "").slice(0, 5), area = Number(r.TOT_LVG_AREA) || 0;
    if (!/^\d{5}$/.test(zip)) continue;
    for (const sale of s) {
      ((groups[zip] ||= {})[sale.type] ||= []).push({ price: sale.price, area });
      if (sale.ym < minYm) minYm = sale.ym;
      if (sale.ym > maxYm) maxYm = sale.ym;
      total++;
    }
  }
  for (const [zip, byType] of Object.entries(groups)) {
    const e = {};
    for (const [type, list] of Object.entries(byType)) {
      if (list.length < MIN_SALES) continue;
      const withArea = list.filter((x) => x.area > 0);
      e[type] = {
        sales: list.length,
        medianPrice: Math.round(median(list.map((x) => x.price))),
        medianPerEffSqFt: withArea.length >= MIN_SALES ? Math.round(median(withArea.map((x) => x.price / x.area))) : null
      };
    }
    if (Object.keys(e).length) out[`${fips}:${zip}`] = e;
  }
  console.log(`${c.name}: ${[...sales.values()].flat().length} qualified sales`);
  for (const t of [`sdf${fips}`, `nal${fips}`]) for (const x of [t, t + ".zip"]) rmSync(join(dir, x), { recursive: true, force: true });
}

writeFileSync(OUT, `/* PRADIXIUM™ — Florida qualified residential sales by county + ZIP (GENERATED)
 * Do not edit by hand — regenerate with: node scripts/build-fl-sales.mjs
 * Source: Florida Department of Revenue, Property Tax Oversight — ${ROLL}
 * Sale Data File (SDF) + Name-Address-Legal file (NAL) submitted by each
 * county property appraiser. https://floridarevenue.com/property/dataportal/
 * Qualified (arm's-length, codes 01/02), improved, single-parcel sales of
 * single-family homes (use 001) and condominiums (004), ${minYm} to ${maxYm}.
 * Per-sq-ft uses FDOR "effective" building area (includes weighted garages
 * and porches) — context only, never the verdict. 10+ sales per figure.
 * Keys: "<county FIPS>:<ZIP>".
 */
export const FL_SALES_META = ${JSON.stringify({ source: "Florida Department of Revenue — Property Tax Oversight (SDF + NAL, " + ROLL + ")", sourceUrl: "https://floridarevenue.com/property/dataportal/", roll: ROLL, periodFrom: minYm, periodTo: maxYm, builtOn: new Date().toISOString().slice(0, 10), minSales: MIN_SALES, counties: Object.keys(COUNTIES) }, null, 2)};

export const FL_SALES = ${JSON.stringify(out)};

export function getFlZipSales(countyFips, zip) {
  const e = FL_SALES[\`\${String(countyFips || "").trim()}:\${String(zip || "").trim().slice(0, 5)}\`];
  return e ? { ...e } : null;
}
`);
console.log(`FL ${ROLL}: ${total} qualified sales ${minYm}..${maxYm} → ${Object.keys(out).length} county-ZIPs`);
