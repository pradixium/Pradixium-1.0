/* PRADIXIUM™ — Denver (City and County of Denver open data — Assessor)
 *  - Parcels (ODC_PROP_PARCELS_A): appraised total value (Government
 *    Value, display only), above-grade residential area, year built
 *  - Real Property Sales and Transfers (ODC_real_property_sales_and_
 *    transfers): every recorded transfer with its deed instrument. Only
 *    warranty (WD) and special warranty (SW) deeds with a price count —
 *    quit-claims, personal-representative, trustee and other deeds are
 *    left out; any date after today is a data-entry error and ignored.
 *  - Same assessor neighborhood + same class, last 12 months: median
 *    price of those sales — context only (whole-property price).
 */
const B = "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/";
const PARCELS = B + "ODC_PROP_PARCELS_A/FeatureServer/245/query";
const SALES = B + "ODC_real_property_sales_and_transfers/FeatureServer/60/query";
const SOURCE = "City and County of Denver — Assessor (open data)";
const SOURCE_URL = "https://opendata-geospatialdenver.hub.arcgis.com/";
const MARKET_DEEDS = "INSTRUMENT IN ('WD','SW') AND SALE_PRICE>0";
const MIN_SALES = 10;
const DIRS = new Set(["N", "S", "E", "W"]);
const ymd = (n) => { const m = String(n ?? "").match(/^(\d{4})(\d{2})(\d{2})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

export function matches(geo) {
  return String(geo?.countyFips || "") === "08031";
}

export async function evidence({ geo, address, zip, h }) {
  const z = h.uspsZip(zip, geo);
  const w = h.s(geo?.matchedAddress).split(",")[0].toUpperCase().split(/\s+/);
  const number = /^\d+$/.test(w[0] || "") ? w.shift() : null;
  if (DIRS.has(w[0]) && w.length > 1) w.shift();
  if (!number || !w.length || !z) return null;
  const name = w.length > 1 ? w.slice(0, -1).join(" ") : w[0];
  const q = (url, params, ms = 7000) => h.json(url + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const today = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));

  const j = await q(PARCELS, { where: `SITUS_ADDR_NBR=${Number(number)} AND SITUS_STR_NAME='${h.escapeSql(name)}' AND SITUS_ZIP LIKE '${z.zip}%'`, outFields: "SCHEDNUM,SITUS_ADDRESS_LINE1,SITUS_UNIT_IDENT,D_CLASS,D_CLASS_CN,APPRAISED_TOTAL_VALUE,RES_ABOVE_GRADE_AREA,RES_ORIG_YEAR_BUILT" });
  let rows = (j?.features || []).map((f) => f.attributes);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.SITUS_UNIT_IDENT) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.SITUS_UNIT_IDENT));
  const r = rows.length === 1 ? rows[0] : null;
  if (!r) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Denver Assessor: several units at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;

  const sales = (await q(SALES, { where: `PARID=${Number(r.SCHEDNUM)} AND RECEPTION_DATE<=${today}`, outFields: "INSTRUMENT,SALE_PRICE,RECEPTION_DATE,NBHD_1,NBHD_1_CN,D_CLASS", orderByFields: "RECEPTION_DATE DESC", resultRecordCount: "50" }))?.features?.map((f) => f.attributes) || [];
  const m0 = sales.find((x) => ["WD", "SW"].includes(h.s(x.INSTRUMENT)) && Number(x.SALE_PRICE) > 0);
  const lastSale = m0 ? { price: Number(m0.SALE_PRICE), date: ymd(m0.RECEPTION_DATE), source: `${SOURCE} — ${h.s(m0.INSTRUMENT) === "WD" ? "warranty" : "special warranty"} deed (reception date)` } : null;
  const value = Number(r.APPRAISED_TOTAL_VALUE) > 0 ? Number(r.APPRAISED_TOTAL_VALUE) : null;
  const parts = [`Denver Assessor schedule ${h.s(r.SCHEDNUM)}${h.s(r.D_CLASS_CN) ? ` (${h.s(r.D_CLASS_CN).toLowerCase()})` : ""}: ${lastSale ? `last warranty-deed sale ${usd(lastSale.price)} on ${lastSale.date}` : "no warranty-deed sale on record"}${value ? `; appraised value ${usd(value)}` : ""}.`];

  const nb = sales.find((x) => x.NBHD_1 != null);
  if (nb && h.s(r.D_CLASS)) {
    const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
    const ns = await q(SALES, { where: `NBHD_1=${Number(nb.NBHD_1)} AND D_CLASS='${h.escapeSql(r.D_CLASS)}' AND RECEPTION_DATE>=${from} AND RECEPTION_DATE<=${today} AND ${MARKET_DEEDS}`, outFields: "SALE_PRICE,RECEPTION_DATE", resultRecordCount: "2000" }, 4000);
    if (Array.isArray(ns?.features) && !ns.exceededTransferLimit) {
      const p = ns.features.map((f) => Number(f.attributes.SALE_PRICE)).sort((x, y) => x - y);
      const d = ns.features.map((f) => ymd(f.attributes.RECEPTION_DATE)).filter(Boolean).sort();
      const m = Math.floor(p.length / 2);
      if (p.length >= MIN_SALES) parts.push(`Neighborhood ${h.s(nb.NBHD_1_CN)}: ${p.length} warranty-deed sales of the same class (${d[0]} to ${d[d.length - 1]}), median price ${usd(p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2)} — whole-property price, context only; not used in the verdict.`);
      else parts.push(`Neighborhood ${h.s(nb.NBHD_1_CN)}: only ${p.length} warranty-deed sales of this class in the last 12 months — not enough for a local figure.`);
    }
  }
  return {
    source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "), lastSale, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: "Denver Assessor appraised value" } : null,
    location: null,
    property: { livingAreaSqFt: Number(r.RES_ABOVE_GRADE_AREA) > 0 ? Number(r.RES_ABOVE_GRADE_AREA) : null, yearBuilt: Number(r.RES_ORIG_YEAR_BUILT) > 0 ? Number(r.RES_ORIG_YEAR_BUILT) : null, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
