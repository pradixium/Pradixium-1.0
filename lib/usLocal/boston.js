/* PRADIXIUM™ — Boston (City of Boston Assessing, FY2026 Property
 * Assessment on data.boston.gov): living area, beds, baths, year built,
 * the FY2026 assessed value (Government Value, display only) and the
 * actual FY2026 tax.
 * No official open sale-price data is available for Boston: MassGIS's
 * statewide parcels still carry Boston's FY2023 roll (last sales up to
 * 2022), which is too old to use, and the city file has no sales.
 */
const API = "https://data.boston.gov/api/3/action/datastore_search_sql?sql=";
const RESOURCE = "ee73430d-96c0-423e-ad21-c4cfb54c8961"; // fy2026-property-assessment-data
const SOURCE = "City of Boston Assessing — FY2026 Property Assessment";
const SOURCE_URL = "https://data.boston.gov/dataset/property-assessment";
const num = (v) => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };

export function matches(geo) {
  return String(geo?.countyFips || "") === "25025";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const words = a.street.split(/\s+/);
  const name = words.length > 1 ? words.slice(0, -1).join(" ") : a.street; // drop the suffix (ST, AVE…) — spelled differently in the file
  const sql = `SELECT "PID","ST_NUM","ST_NAME","UNIT_NUM","ZIP_CODE","LU_DESC","LIVING_AREA","BED_RMS","FULL_BTH","YR_BUILT","TOTAL_VALUE","GROSS_TAX" FROM "${RESOURCE}" WHERE "ST_NUM"='${h.escapeSql(a.number)}' AND upper("ST_NAME") LIKE '${h.escapeSql(name)} %' AND "ZIP_CODE"='${z.zip}'`;
  const j = await h.json(API + encodeURIComponent(sql), 9000);
  let rows = j?.result?.records;
  if (!Array.isArray(rows)) return null;
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.UNIT_NUM) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.UNIT_NUM));
  const r = rows.length === 1 ? rows[0] : null;
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  if (!r) return { source: SOURCE, sourceUrl: SOURCE_URL, summary: (j.result.records.length > 1 ? "City of Boston Assessing: several units at this address — add the unit number for the unit's own record." : null), lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false };

  const value = num(r.TOTAL_VALUE), tax = num(r.GROSS_TAX);
  const property = { livingAreaSqFt: num(r.LIVING_AREA), bedrooms: num(r.BED_RMS), bathrooms: num(r.FULL_BTH), yearBuilt: num(r.YR_BUILT) };
  const checks = tax ? [{ id: "propertyTax", label: "Property tax (FY2026, actual bill)", value: `${usd(tax)} — City of Boston`, level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" }] : [];
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `City of Boston Assessing, parcel ${r.PID} (${h.s(r.LU_DESC).toLowerCase()}): ${[property.livingAreaSqFt && `${property.livingAreaSqFt.toLocaleString("en-US")} sq ft living`, property.bedrooms && `${property.bedrooms} bd`, property.bathrooms && `${property.bathrooms} ba`, property.yearBuilt && `built ${property.yearBuilt}`].filter(Boolean).join(", ")}${value ? `; FY2026 assessed value ${usd(value)}` : ""}. Boston publishes no open sale-price data, so no local sale benchmark exists.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: "FY2026", label: "City of Boston FY2026 assessed value" } : null,
    location: null, property, checks, hasRecord: true
  };
}
