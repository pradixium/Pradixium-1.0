/* PRADIXIUM™ — Shelby County, TN (FIPS 47157; Memphis) — county GIS
 * (scgis.shelbycountytn.gov), as used by the Register of Deeds' own map:
 *  - Parcel/CERTParcel: certified parcels with a structured situs address
 *    (number / direction / street / suffix / unit / ZIP / municipality)
 *  - Assessor/QualifiedSales: the Assessor of Property's QUALIFIED sales
 *    (2022 onward as of Sept 2026, updated weekly)
 * Shown: the parcel, and its most recent sale that the Assessor
 * qualified (a later unqualified transfer would not appear in that layer,
 * which the text says). No value is shown: the certified parcel layer
 * carries none. Owner names are never requested.
 * The server only speaks legacy TLS renegotiation, which Node rejects by
 * default, so this module uses its own HTTPS agent with
 * SSL_OP_LEGACY_SERVER_CONNECT for this one host (read-only public data).
 */
import https from "node:https";
import crypto from "node:crypto";
import { structuredEvidence } from "./_structured.js";
import { SHELBY_SALES } from "../data/shelbySales.js";

const HOST = "https://scgis.shelbycountytn.gov";
const PARCELS = `${HOST}/serverhigh/rest/services/Parcel/CERTParcel/MapServer/0`;
const SALES = `${HOST}/serverlow/rest/services/Assessor/QualifiedSales/MapServer/0`;
const agent = new https.Agent({ keepAlive: true, secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT });

export function legacyJson(url, ms = 6000) {
  return new Promise((resolve) => {
    const req = https.get(url, { agent, headers: { "User-Agent": "Pradixium/1.0 (+https://pradixium.com)" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { body += c; });
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.setTimeout(ms, () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}

const query = (get, url, where, outFields) => get(url + "/query?" + new URLSearchParams({ where, outFields, returnGeometry: "false", f: "json" }), 6000)
  .then((j) => (j?.features || []).map((f) => f.attributes)).catch(() => []);
const ymd = (ms) => (Number(ms) ? new Date(Number(ms)).toISOString().slice(0, 10) : null);

const CONFIG = {
  name: "Shelby County Assessor of Property", source: "Shelby County, Tennessee — county GIS (certified parcels + Assessor of Property qualified sales)",
  sourceUrl: "https://www.assessor.shelbycountytn.gov/",
  valueLabel: "value", idLabel: "parcel",
  note: "The sale shown is the most recent one the Assessor classified as qualified (arm's-length) since January 2022; the county's parcel layer publishes no appraised value.",
  find: async ({ num, name, h }) => {
    const get = h.legacyJson || legacyJson;
    const ps = await query(get, PARCELS, `PAR_ADRNO = ${Number(num)} AND PAR_ADRSTR = '${h.escapeSql(name)}'`,
      "PARID,PAR_ADRNO,PAR_ADRPREDIR,PAR_ADRSTR,PAR_ADRSUF,PAR_ADRPOSTDIR,PAR_UNITNO,PAR_ZIP,MUNI,TAXYR,NBHD,LUC,LANDUSE,CLASS");
    const ids = [...new Set(ps.map((p) => h.s(p.PARID)).filter(Boolean))].slice(0, 10);
    const sales = ids.length ? await query(get, SALES, `PARID IN (${ids.map((i) => `'${h.escapeSql(i)}'`).join(",")})`, "PARID,SALEDT,PRICE,INSTRTYP") : [];
    return ps.map((p) => {
      const last = sales.filter((s) => h.s(s.PARID) === h.s(p.PARID) && Number(s.PRICE) > 1000).sort((a, b) => Number(b.SALEDT) - Number(a.SALEDT))[0];
      return { id: h.s(p.PARID), zip: h.s(p.PAR_ZIP), town: h.s(p.MUNI), dir: h.s(p.PAR_ADRPREDIR), type: h.s(p.PAR_ADRSUF), post: h.s(p.PAR_ADRPOSTDIR), unit: h.s(p.PAR_UNITNO),
        nbhd: h.s(p.NBHD), luc: h.s(p.LUC), landuse: h.s(p.LANDUSE), cls: h.s(p.CLASS), use: h.s(p.LANDUSE),
        sale: last && ymd(last.SALEDT) ? { price: Number(last.PRICE), date: ymd(last.SALEDT), label: "Assessor of Property qualified sale" } : null };
    });
  },
  // median of the Assessor's qualified sales, same county land-use code,
  // 12 months: Assessor neighborhood, else ZIP (prebuilt monthly —
  // scripts/build-shelby-sales.mjs). Single-family codes → the benchmark;
  // multi-family → context only.
  areaMedian: async ({ row }) => {
    if (row.cls !== "R" || !row.luc || row.luc === "000") return null;
    const nk = row.nbhd ? SHELBY_SALES[`N|${row.nbhd}|${row.luc}`] : null;
    const zk = row.zip ? SHELBY_SALES[`Z|${row.zip.slice(0, 5)}|${row.luc}`] : null;
    const g = nk || zk;
    if (!g) return null;
    const area = nk ? `Assessor neighborhood ${row.nbhd}` : `ZIP ${row.zip.slice(0, 5)}`;
    const single = /^SINGLE-FAMILY$/i.test(g.use || "");
    const kind = `${String(g.use || "").toLowerCase()} (land-use code ${row.luc})`;
    const usd = "$" + g.median.toLocaleString("en-US");
    return {
      areaMedianPrice: single ? { value: g.median, sales: g.n, area, typeLabel: `${kind} properties`, periodFrom: g.from, periodTo: g.to, source: "Shelby County Assessor of Property — qualified sales", sourceUrl: "https://www.assessor.shelbycountytn.gov/" } : null,
      text: `${area}: ${g.n} Assessor-qualified sales of ${kind} properties (${g.from} to ${g.to}; multi-parcel deeds excluded), median price ${usd} — ${single ? "the benchmark: a whole-home median, not adjusted for size" : "whole-property price, context only; not used in the verdict"}.`
    };
  }
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "47157";
}

export function evidence(ctx) {
  return structuredEvidence(CONFIG, ctx);
}
