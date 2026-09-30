// Builds lib/data/fairfaxSales.js — Fairfax County, VA: median price of
// the Department of Tax Administration's "Valid and verified sale" sales,
// 12 months up to the latest sale in the file, per ZIP + land-use code
// (LUC_DESC: single-family detached, townhouse, garden condo, high-rise
// condo …). The sales table carries only PARID, so each sale is joined to
// the Real Estate Parcels Data (LUC_DESC) and the county Address Points
// (ZIP). Run monthly:
//
//   NODE_USE_ENV_PROXY=1 node scripts/build-fairfax-sales.mjs
//
// The sales table repeats each sale under every tax year → de-duplicated.
//
// Rules: SALEVAL_DESC exactly "Valid and verified sale" (every other label —
// no consideration, related parties, foreclosure, handyman special,
// multi-parcel, non-representative … — is left out), price > $1,000, a
// date after the build date is dropped, a parcel with addresses in two ZIPs
// is dropped, 10+ sales per group. Owner fields are never requested.
import { writeFileSync } from "node:fs";

const B = "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/";
const SALES = B + "OpenData_A5/FeatureServer/1/query";
const PARCELS = B + "Tax_Administration_Real_Estate_Parcels_Data/FeatureServer/0/query";
const ADDR = B + "Address_Points/FeatureServer/0/query";
const MIN_SALES = 10;
const now = Date.now();

async function get(url, params) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: "POST", body: new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), signal: AbortSignal.timeout(90000) });
      const j = await r.json();
      if (Array.isArray(j.features)) return j;
    } catch {}
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  throw new Error("query failed " + url);
}
async function all(url, where, outFields) {
  const rows = [];
  // the server caps a page (1,000 here) → step by what actually came back
  for (let off = 0; ; ) {
    const j = await get(url, { where, outFields, orderByFields: "OBJECTID", resultOffset: String(off), resultRecordCount: "1000" });
    rows.push(...j.features.map((f) => f.attributes));
    off += j.features.length;
    if (!j.features.length || (!j.exceededTransferLimit && j.features.length < 1000)) break;
  }
  return rows;
}

const VALID = "SALEVAL_DESC='Valid and verified sale'";
const mx = (await get(SALES, { where: VALID, outStatistics: JSON.stringify([{ statisticType: "max", onStatisticField: "SALEDT", outStatisticFieldName: "mx" }]) })).features[0].attributes.mx;
const latest = Math.min(Number(mx), now);
const fromMs = latest - 365 * 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const sales = (await all(SALES, `${VALID} AND PRICE>1000 AND SALEDT > DATE '${iso(fromMs)}' AND SALEDT <= DATE '${iso(latest)}'`, "OBJECTID,PARID,SALEDT,PRICE"))
  .filter((s) => Number(s.SALEDT) <= now)
  // the table repeats a sale under each tax year (2026, 2027 …) → one row per parcel + date + price
  .filter((s, i, a) => a.findIndex((t) => t.PARID === s.PARID && t.SALEDT === s.SALEDT && t.PRICE === s.PRICE) === i);
console.error("sales", sales.length);

const ids = [...new Set(sales.map((s) => String(s.PARID).trim()))];
const luc = {}, zips = {};
for (let i = 0; i < ids.length; i += 200) {
  const inList = ids.slice(i, i + 200).map((x) => `'${x.replace(/'/g, "''")}'`).join(",");
  const [p, a] = await Promise.all([
    get(PARCELS, { where: `PARID IN (${inList})`, outFields: "PARID,TAXYR,LUC_DESC", resultRecordCount: "2000" }),
    get(ADDR, { where: `PARCEL_PIN IN (${inList}) AND ADDRESS_STATUS='Current'`, outFields: "PARCEL_PIN,ZIP", resultRecordCount: "2000" })
  ]);
  for (const f of p.features) { const r = f.attributes, k = String(r.PARID).trim(); if (!luc[k] || Number(r.TAXYR) > luc[k].y) luc[k] = { y: Number(r.TAXYR), d: String(r.LUC_DESC || "").trim() }; }
  for (const f of a.features) { const r = f.attributes, k = String(r.PARCEL_PIN).trim(); (zips[k] ||= new Set()).add(String(r.ZIP || "").slice(0, 5)); }
  process.stderr.write(`\rjoined ${Math.min(i + 200, ids.length)}/${ids.length}`);
}
process.stderr.write("\n");

const groups = {};
for (const s of sales) {
  const k = String(s.PARID).trim(), z = zips[k];
  if (!luc[k]?.d || !z || z.size !== 1) continue;
  const zip = [...z][0];
  if (!/^\d{5}$/.test(zip)) continue;
  const g = (groups[`${zip}|${luc[k].d}`] ||= { p: [], d: [] });
  g.p.push(Number(s.PRICE)); g.d.push(iso(Number(s.SALEDT)));
}
const out = {};
for (const [k, g] of Object.entries(groups)) {
  if (g.p.length < MIN_SALES) continue;
  const p = g.p.sort((a, b) => a - b), m = Math.floor(p.length / 2), d = g.d.sort();
  out[k] = { n: p.length, median: Math.round(p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2), from: d[0], to: d[d.length - 1] };
}
const meta = { built: iso(now), windowFrom: iso(fromMs), windowTo: iso(latest), sales: sales.length, groups: Object.keys(out).length };
writeFileSync(new globalThis.URL("../lib/data/fairfaxSales.js", import.meta.url),
  `// Generated by scripts/build-fairfax-sales.mjs — do not edit by hand.\n// Fairfax County DTA "Valid and verified sale" sales: median price per "ZIP|LUC_DESC", 12 months, 10+ sales.\nexport const FAIRFAX_SALES_META = ${JSON.stringify(meta)};\nexport const FAIRFAX_SALES = ${JSON.stringify(out)};\n`);
console.log(meta);
