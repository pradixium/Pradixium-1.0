// Builds lib/data/clarkSales.js — Las Vegas (Clark County, NV) median sale
// prices from the Clark County Assessor's own data on the county GIS
// (maps.clarkcountynv.gov, GISMO). Run monthly:
//
//   NODE_USE_ENV_PROXY=1 node scripts/build-clark-sales.mjs
//
// Rules (all from the Assessor's data, nothing estimated):
//  - Sales_view (the Assessor's sales of the last 18 months, each with its
//    sale code): only code "R" — "Recorded Value … normally an 'R' code
//    indicates the best type of arms-length transactions" (Assessor, Sales
//    Codes); dateGroup 6 and 12 = the last 12 months
//  - a parcel that also carries any OTHER code in the view is dropped (the
//    roll extract keeps only the latest sale, which might be that one)
//  - price, month and document number from the roll extract (AOEXT_V); a
//    document number on several parcels = a multi-parcel deed → dropped
//  - Nevada state land-use code (Department of Taxation, Land Use Code
//    Manual): 20 single-family residence, 21 condominium unit, 24 townhouse
//  - grouped by the Assessor's neighborhood + land-use code, else town +
//    land-use code; published only with 10+ sales
// Never requested: owner / owner2 (names).
import { writeFileSync } from "node:fs";

const B = "https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/";
const SALES = B + "Sales_view/MapServer/0/query";
const ROLL = B + "Address/MapServer/2/query";
const MIN = 10;
const TYPES = { "20": "single-family homes", "21": "condominium units", "24": "townhouses" };

async function q(url, params) {
  const body = new URLSearchParams({ returnGeometry: "false", f: "json", ...params });
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(90000) });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j;
    } catch (e) { if (i === 3) throw e; await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
  }
}
async function all(url, where, outFields) {
  const out = [];
  for (let off = 0; ; off += 2000) {
    const j = await q(url, { where, outFields, orderByFields: "OBJECTID", resultOffset: String(off), resultRecordCount: "2000" });
    out.push(...j.features.map((f) => f.attributes));
    if (j.features.length < 2000 && !j.exceededTransferLimit) break;
  }
  return out;
}

const view = await all(SALES, "1=1", "OBJECTID,PARCEL,saletype,dateGroup");
const codes = new Map();
for (const s of view) {
  const p = String(s.PARCEL).trim();
  if (!codes.has(p)) codes.set(p, []);
  codes.get(p).push({ code: String(s.saletype || "").trim(), group: Number(s.dateGroup) });
}
const parcels = [...codes].filter(([, cs]) => cs.every((c) => c.code === "R") && cs.some((c) => c.group <= 12)).map(([p]) => p);
console.log(view.length, "sales in the view;", parcels.length, "parcels with only R codes in the last 12 months");

const roll = [];
for (let i = 0; i < parcels.length; i += 200) {
  const ids = parcels.slice(i, i + 200).map((p) => `'${p}'`).join(",");
  const j = await q(ROLL, { where: `APN IN (${ids})`, outFields: "APN,STATELANDUSE,NBRHOOD,City,SALEPRICE,SALEDATE,DOCNO" });
  roll.push(...j.features.map((f) => f.attributes));
}
const months = roll.map((r) => String(r.SALEDATE || "")).filter((m) => /^\d{6}$/.test(m)).sort();
const to = months[months.length - 1];
const ty = Number(to.slice(0, 4)), tm = Number(to.slice(4, 6));
const from = `${tm === 12 ? ty : ty - 1}${String(tm === 12 ? 1 : tm + 1).padStart(2, "0")}`;
const docs = new Map();
for (const r of roll) { const d = String(r.DOCNO || "").trim(); if (d) docs.set(d, (docs.get(d) || 0) + 1); }
const sales = roll.filter((r) => {
  const m = String(r.SALEDATE || ""), d = String(r.DOCNO || "").trim(), luc = String(r.STATELANDUSE || "").slice(0, 2);
  return TYPES[luc] && m >= from && m <= to && Number(r.SALEPRICE) >= 10000 && d && docs.get(d) === 1;
});
const groups = new Map();
const add = (k, r) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); };
for (const r of sales) {
  const luc = String(r.STATELANDUSE).slice(0, 2);
  if (r.NBRHOOD != null) add(`N|${r.NBRHOOD}|${luc}`, r);
  if (r.City) add(`C|${String(r.City).trim().toUpperCase()}|${luc}`, r);
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const ym = (m) => `${m.slice(0, 4)}-${m.slice(4, 6)}`;
const out = {};
for (const [k, rs] of groups) {
  if (rs.length < MIN) continue;
  const ms = rs.map((r) => String(r.SALEDATE)).sort();
  out[k] = { n: rs.length, median: med(rs.map((r) => Number(r.SALEPRICE))), from: ym(ms[0]), to: ym(ms[ms.length - 1]) };
}
const meta = { built: new Date().toISOString().slice(0, 10), windowFrom: ym(from), windowTo: ym(to), sales: sales.length, groups: Object.keys(out).length, types: TYPES };
writeFileSync(new URL("../lib/data/clarkSales.js", import.meta.url),
  `// Generated by scripts/build-clark-sales.mjs — do not edit by hand.\n// Clark County Assessor: sale code "R" (arm's length) single-parcel sales, 12 months,\n// median price per Assessor neighborhood (N|…) or town (C|…) + Nevada land-use code, 10+ sales.\nexport const CLARK_SALES_META = ${JSON.stringify(meta)};\nexport const CLARK_SALES = ${JSON.stringify(out)};\n`);
console.log(meta);
