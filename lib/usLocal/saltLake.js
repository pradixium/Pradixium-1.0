/* PRADIXIUM™ — Salt Lake City core: Salt Lake County, UT (FIPS 49035) — Utah
 * Geospatial Resource Center (UGRC) "Parcels_SaltLake_LIR" (Land Information
 * Records, compiled from the Salt Lake County Assessor)
 * Shown: total market value with the record's as-of date (Government
 * Value, display only), building sq ft (text), year built. Utah does not
 * make sale prices public (non-disclosure state), so no sale exists.
 */
const URL = "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/Parcels_SaltLake_LIR/FeatureServer/0/query";
const SOURCE = "Salt Lake County Assessor via Utah UGRC Land Information Records";
const SOURCE_URL = "https://gis.utah.gov/products/sgid/cadastre/parcels/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "49035";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `PARCEL_ADD LIKE '${h.escapeSql(`${a.number} ${a.street}`)}%'`,
    outFields: "PARCEL_ID,PARCEL_ADD,PARCEL_CITY,TOTAL_MKT_VALUE,PROP_CLASS,BLDG_SQFT,BUILT_YR,CURRENT_ASOF",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  const line = `${a.number} ${a.street}`;
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const s = h.s(r.PARCEL_ADD).toUpperCase(); return s === line || s.startsWith(line + " "); });
  const unit = h.unitFromAddress(address);
  const rest = (r) => h.s(r.PARCEL_ADD).toUpperCase().slice(line.length).trim().replace(/^(UNIT|APT|#)\s*/i, "");
  if (unit) rows = rows.filter((r) => h.unitKey(rest(r)) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !rest(r));
  if (rows.length > 1) { const city = h.s(geo?.matchedAddress).split(",")[1]?.trim().toUpperCase(); if (city) rows = rows.filter((r) => h.s(r.PARCEL_CITY).toUpperCase() === city); }
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Salt Lake County Assessor: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.TOTAL_MKT_VALUE) > 0 ? Number(r.TOTAL_MKT_VALUE) : null;
  const asOf = Number.isFinite(r.CURRENT_ASOF) ? new Date(r.CURRENT_ASOF).toISOString().slice(0, 10) : null;
  const yb = Number(r.BUILT_YR) > 0 ? Number(r.BUILT_YR) : null;
  const facts = [h.s(r.PROP_CLASS).toLowerCase(), Number(r.BLDG_SQFT) > 0 && `${Number(r.BLDG_SQFT).toLocaleString("en-US")} building sq ft`, yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Salt Lake County Assessor parcel ${h.s(r.PARCEL_ID)}${facts ? ` (${facts})` : ""}${value ? `: market value ${usd(value)}${asOf ? ` (record as of ${asOf})` : ""}` : ""}. Utah does not make sale prices public (non-disclosure state).`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf, label: "Salt Lake County Assessor market value" } : null,
    location: null, property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
