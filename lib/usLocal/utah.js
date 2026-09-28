/* PRADIXIUM™ — Utah, statewide (Salt Lake City, Provo, Ogden …) — Utah
 * Geospatial Resource Center (UGRC) "Parcels_<County>_LIR" (Land Information
 * Records, one standardized layer per county, compiled from each county
 * assessor — all 29 counties)
 * Shown: total market value with the record's as-of date (Government
 * Value, display only), building sq ft (text), year built. Utah does not
 * make sale prices public (non-disclosure state), so no sale exists.
 */
const BASE = "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/";
const SOURCE = "Utah county assessor via Utah UGRC Land Information Records";
const SOURCE_URL = "https://gis.utah.gov/products/sgid/cadastre/parcels/";

export function matches(geo) {
  return geo?.stateCode === "UT";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  const county = h.s(geo?.county).replace(/ County$/i, "");
  if (!a || !county) return null;
  const countyName = `${county} County`;
  const URL = `${BASE}Parcels_${county.replace(/[^A-Za-z]/g, "")}_LIR/FeatureServer/0/query`;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `PARCEL_ADD LIKE '${h.escapeSql(`${a.number} ${a.street}`)}%'`,
    outFields: "PARCEL_ID,PARCEL_ADD,PARCEL_CITY,TOTAL_MKT_VALUE,PROP_CLASS,BLDG_SQFT,BUILT_YR,CURRENT_ASOF",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  const line = `${a.number} ${a.street}`;
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const s = h.s(r.PARCEL_ADD).toUpperCase(); return s === line || s.startsWith(line + " "); });
  rows = rows.filter((r, i) => rows.findIndex((x) => h.s(x.PARCEL_ID) === h.s(r.PARCEL_ID)) === i); // one parcel can have several polygons
  const unit = h.unitFromAddress(address);
  const rest = (r) => h.s(r.PARCEL_ADD).toUpperCase().slice(line.length).trim().replace(/^(UNIT|APT|#)\s*/i, "");
  if (unit) rows = rows.filter((r) => h.unitKey(rest(r)) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !rest(r));
  if (rows.length > 1) { const city = h.s(geo?.matchedAddress).split(",")[1]?.trim().toUpperCase(); if (city) rows = rows.filter((r) => h.s(r.PARCEL_CITY).toUpperCase() === city); }
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: `${countyName} Assessor: more than one parcel matches this address, so none is shown.`, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.TOTAL_MKT_VALUE) > 0 ? Number(r.TOTAL_MKT_VALUE) : null;
  const asOf = Number.isFinite(r.CURRENT_ASOF) ? new Date(r.CURRENT_ASOF).toISOString().slice(0, 10) : null;
  const yb = Number(r.BUILT_YR) > 0 ? Number(r.BUILT_YR) : null;
  const facts = [h.s(r.PROP_CLASS).toLowerCase(), Number(r.BLDG_SQFT) > 0 && `${Number(r.BLDG_SQFT).toLocaleString("en-US")} building sq ft`, yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `${countyName} Assessor parcel ${h.s(r.PARCEL_ID)}${facts ? ` (${facts})` : ""}${value ? `: market value ${usd(value)}${asOf ? ` (record as of ${asOf})` : ""}` : ""}. Utah does not make sale prices public (non-disclosure state).`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf, label: `${countyName} Assessor market value` } : null,
    location: null, property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
