/* PRADIXIUM™ — Seattle core: King County, WA (King County GIS,
 * Property/KingCo_PropertyInfo — Parcels + "Property sales in the last
 * 3 years")
 * Appraised land + improvement value (Government Value, display only),
 * present use, and the property's last recorded transfer. This layer
 * carries no sale instrument or sale-reason codes, so the transfer is
 * shown only when $10,000+ (family / $0 transfers drop out) and labelled
 * as not screened for arm's length; no ZIP median is built from it.
 */
const BASE = "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/";
const SOURCE = "King County Department of Assessments — parcels & recorded sales (King County GIS)";
const SOURCE_URL = "https://kingcounty.gov/en/dept/assessor";

export function matches(geo) {
  return String(geo?.countyFips || "") === "53033";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const q = (layer, params, ms = 7000) => h.json(BASE + layer + "/query?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const j = await q(2, { where: `ADDR_FULL='${h.escapeSql(`${a.number} ${a.street}`)}' AND ZIP5='${z.zip}'`, outFields: "PIN,ADDR_FULL,CTYNAME,APPRLNDVAL,APPR_IMPR,PREUSE_DESC" });
  const rows = (j?.features || []).map((f) => f.attributes);
  const unit = h.unitFromAddress(address);
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: `King County Assessor: several parcels at this address${unit ? "" : " — add the unit number"}; no single record matched.`, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0];
  const value = (Number(r.APPRLNDVAL) || 0) + (Number(r.APPR_IMPR) || 0);
  const s = (await q(3, { where: `PIN='${h.escapeSql(r.PIN)}'`, outFields: "SaleDate,SalePrice", orderByFields: "SaleDate DESC", resultRecordCount: "5" }))?.features?.map((f) => f.attributes) || [];
  const t = s.find((x) => Number(x.SalePrice) >= 10000 && Number.isFinite(x.SaleDate));
  const lastSale = t ? { price: Number(t.SalePrice), date: new Date(t.SaleDate).toISOString().slice(0, 10), source: `${SOURCE} — recorded transfer (not screened for arm's length)` } : null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `King County Assessor parcel ${h.s(r.PIN)}${h.s(r.CTYNAME) ? ` (${h.s(r.CTYNAME)}` + (h.s(r.PREUSE_DESC) ? `, ${h.s(r.PREUSE_DESC).toLowerCase()})` : ")") : ""}: ${value > 0 ? `appraised value ${usd(value)} (land + improvements)` : "record found"}${lastSale ? `; last recorded transfer ${usd(lastSale.price)} on ${lastSale.date} (not screened for arm's length)` : "; no recorded transfer of $10,000+ in the last 3 years"}.`,
    lastSale, benchmark: null,
    governmentValue: value > 0 ? { value, asOf: null, label: "King County Assessor appraised value" } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
