// Builds lib/data/shelbySales.js — Shelby County, TN (Memphis): median
// price of the Assessor of Property's QUALIFIED sales, last 12 months, per
// Assessor neighborhood (NBHD) + land-use code (LUC) of the parcel, with a
// ZIP + LUC fallback. Run monthly (the sales layer is updated weekly):
//
//   node scripts/build-shelby-sales.mjs
//
// Sources (county GIS scgis.shelbycountytn.gov, as used by the Register
// of Deeds' own map):
//  - Assessor/QualifiedSales: PARID, SALEDT, PRICE, INSTRTYP
//  - Parcel/CERTParcel: NBHD, LUC, PAR_ZIP, MUNI for each PARID
// Rules (nothing estimated):
//  - only sales in the Assessor's qualified-sales layer, price > $1,000
//  - a price + date shared by several parcels = one multi-parcel deed →
//    dropped
//  - dates in the 12 months up to the latest sale in the layer; a date
//    after the build date is dropped as a data-entry error
//  - residential class (CLASS R) parcels, not vacant land (LUC 000)
//  - a group is published only with 10+ sales
// Owner fields (OWNER, OWN_*) are never requested.
// The server needs legacy TLS renegotiation → own agent (same as the module).
import https from "node:https";
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";

const HOST = "https://scgis.shelbycountytn.gov";
const SALES = `${HOST}/serverlow/rest/services/Assessor/QualifiedSales/MapServer/0/query`;
const PARCELS = `${HOST}/serverhigh/rest/services/Parcel/CERTParcel/MapServer/0/query`;
const MIN_SALES = 10;
const agent = new https.Agent({ keepAlive: true, secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT });
const today = new Date().toISOString().slice(0, 10);

function get(url, params) {
  const body = new URLSearchParams({ returnGeometry: "false", f: "json", ...params }).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "POST", agent, headers: { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(body), "User-Agent": "Pradixium/1.0 (+https://pradixium.com)" } }, (res) => {
      let t = ""; res.setEncoding("utf8"); res.on("data", (c) => { t += c; });
      res.on("end", () => { try { const j = JSON.parse(t); j.error ? reject(new Error(JSON.stringify(j.error))) : resolve(j); } catch (e) { reject(e); } });
    });
    req.setTimeout(90000, () => req.destroy(new Error("timeout")));
    req.on("error", reject); req.end(body);
  });
}
async function retry(fn) {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= 3) throw e; await new Promise((r) => setTimeout(r, 3000 * (i + 1))); } }
}

const since = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
const sales = [];
for (let offset = 0; ; offset += 1000) {
  const j = await retry(() => get(SALES, { where: `SALEDT >= DATE '${since}'`, outFields: "ESRI_OID,PARID,SALEDT,PRICE,INSTRTYP", orderByFields: "ESRI_OID", resultOffset: String(offset), resultRecordCount: "1000" }));
  sales.push(...j.features.map((f) => f.attributes));
  process.stderr.write(`\rsales ${sales.length}`);
  if (j.features.length < 1000 && !j.exceededTransferLimit) break;
}
process.stderr.write("\n");

const day = (ms) => new Date(Number(ms)).toISOString().slice(0, 10);
let rows = sales.filter((s) => Number(s.PRICE) > 1000 && s.SALEDT && day(s.SALEDT) <= today && s.PARID);
const latest = rows.map((s) => day(s.SALEDT)).sort().pop();
const from = new Date(Date.parse(latest) - 365 * 86400000).toISOString().slice(0, 10);
rows = rows.filter((s) => day(s.SALEDT) > from);
const deedKey = (s) => `${s.PRICE}|${day(s.SALEDT)}`;
const deedCount = {};
for (const s of rows) deedCount[deedKey(s)] = (deedCount[deedKey(s)] || 0) + 1;
const multi = rows.filter((s) => deedCount[deedKey(s)] > 1).length;
rows = rows.filter((s) => deedCount[deedKey(s)] === 1);

const ids = [...new Set(rows.map((s) => s.PARID))];
const parcel = {};
for (let i = 0; i < ids.length; i += 150) {
  const chunk = ids.slice(i, i + 150);
  const j = await retry(() => get(PARCELS, { where: `PARID IN (${chunk.map((x) => `'${x.replace(/'/g, "''")}'`).join(",")})`, outFields: "PARID,NBHD,LUC,LANDUSE,CLASS,PAR_ZIP,MUNI" }));
  for (const f of j.features) parcel[f.attributes.PARID] = f.attributes;
  process.stderr.write(`\rparcels ${Object.keys(parcel).length}/${ids.length}`);
}
process.stderr.write("\n");

const groups = {};
const add = (k, s, use) => { (groups[k] ||= { p: [], d: [], use }); groups[k].p.push(Number(s.PRICE)); groups[k].d.push(day(s.SALEDT)); };
for (const s of rows) {
  const p = parcel[s.PARID];
  // residential class, not vacant (LUC 000); the parcel's own county land-use label is kept
  if (!p || !p.LUC || p.CLASS !== "R" || p.LUC === "000") continue;
  if (p.NBHD) add(`N|${String(p.NBHD).trim()}|${p.LUC}`, s, p.LANDUSE);
  if (p.PAR_ZIP) add(`Z|${String(p.PAR_ZIP).slice(0, 5)}|${p.LUC}`, s, p.LANDUSE);
}
const out = {};
for (const [k, g] of Object.entries(groups)) {
  if (g.p.length < MIN_SALES) continue;
  const p = g.p.sort((a, b) => a - b), m = Math.floor(p.length / 2), d = g.d.sort();
  out[k] = { use: g.use, n: p.length, median: Math.round(p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2), from: d[0], to: d[d.length - 1] };
}
const meta = { built: today, windowFrom: from, windowTo: latest, sales: rows.length, multiParcelDropped: multi, groups: Object.keys(out).length };
writeFileSync(new globalThis.URL("../lib/data/shelbySales.js", import.meta.url),
  `// Generated by scripts/build-shelby-sales.mjs — do not edit by hand.\n// Shelby County Assessor of Property qualified sales: median price per\n// "N|<NBHD>|<LUC>" (Assessor neighborhood) and "Z|<ZIP>|<LUC>", 12 months, 10+ sales.\nexport const SHELBY_SALES_META = ${JSON.stringify(meta)};\nexport const SHELBY_SALES = ${JSON.stringify(out)};\n`);
console.log(meta);
