/* PRADIXIUM™ — Phoenix metro core: Maricopa County Assessor (official GIS,
 * gis.mcassessor.maricopa.gov, Parcels layer)
 * Property facts (living space, year built), Full Cash Value — Arizona's
 * statutory market-value estimate — for the current tax year (Government
 * Value, display only), and the last sale the Assessor recorded. That
 * sale carries no arm's-length screening in this data, so it is shown in
 * the Transaction rows labelled as such, only when it is $10,000+ (below
 * that it is a nominal transfer, not a price), and never feeds the verdict.
 * No ZIP-level figure: sale dates are stored as text, so a reliable
 * 12-month filter is not possible from this service.
 */
const URL = "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query";
const SOURCE = "Maricopa County Assessor";
const SOURCE_URL = "https://mcassessor.maricopa.gov/";
const num = (v) => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "04013";
}

export async function evidence({ geo, address, zip, h }) {
  const z = h.uspsZip(zip, geo);
  const w = h.s(geo?.matchedAddress).split(",")[0].toUpperCase().split(/\s+/);
  const number = /^\d+$/.test(w[0] || "") ? w.shift() : null;
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : null;
  if (!number || !w.length || !z) return null;
  const name = w.length > 1 ? w.slice(0, -1).join(" ") : w[0];
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `PHYSICAL_STREET_NUM='${h.escapeSql(number)}' AND PHYSICAL_STREET_NAME='${h.escapeSql(name)}' AND PHYSICAL_ZIP='${z.zip}'`,
    outFields: "APN,PHYSICAL_ADDRESS,PHYSICAL_STREET_DIR,PHYSICAL_SUITE,SALE_DATE,SALE_PRICE,LIVING_SPACE,CONST_YEAR,FCV_CUR,TAX_YR_CUR,PUC,LATITUDE,LONGITUDE",
    returnGeometry: "false", f: "json"
  }), 9000);
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => !dir || !h.s(r.PHYSICAL_STREET_DIR) || h.s(r.PHYSICAL_STREET_DIR).toUpperCase() === dir);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.PHYSICAL_SUITE) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.PHYSICAL_SUITE));
  const r = rows.length === 1 ? rows[0] : null;
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  if (!r) return { source: SOURCE, sourceUrl: SOURCE_URL, summary: (j?.features || []).length > 1 ? "Maricopa County Assessor: several units at this address — add the unit number for the unit's own record." : null, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false };

  const fcv = num(r.FCV_CUR), taxYear = h.s(r.TAX_YR_CUR) || null;
  const m = h.s(r.SALE_DATE).match(/^(\d{2})\/(\d{2})\/(\d{4})$/), price = num(r.SALE_PRICE);
  const lastSale = m && price && price >= 10000 ? { price, date: `${m[3]}-${m[1]}-${m[2]}`, source: `${SOURCE} — recorded sale (not screened for arm's length in this data)` } : null;
  const property = { livingAreaSqFt: num(r.LIVING_SPACE), yearBuilt: num(r.CONST_YEAR), bedrooms: null, bathrooms: null };
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Maricopa County Assessor APN ${h.s(r.APN)}: ${[property.livingAreaSqFt && `${property.livingAreaSqFt.toLocaleString("en-US")} sq ft living`, property.yearBuilt && `built ${property.yearBuilt}`].filter(Boolean).join(", ") || "record found"}${fcv ? `; Full Cash Value ${usd(fcv)}${taxYear ? ` (tax year ${taxYear})` : ""} — the Assessor's statutory valuation, not a sale price` : ""}${lastSale ? `; last recorded sale ${usd(lastSale.price)} on ${lastSale.date} (not screened for arm's length)` : ""}.`,
    lastSale, benchmark: null,
    governmentValue: fcv ? { value: fcv, asOf: taxYear, label: `Maricopa County Assessor Full Cash Value${taxYear ? ` (tax year ${taxYear})` : ""}` } : null,
    location: num(r.LATITUDE) && r.LONGITUDE ? { latitude: Number(r.LATITUDE), longitude: Number(r.LONGITUDE) } : null,
    property, checks: [], hasRecord: true
  };
}
