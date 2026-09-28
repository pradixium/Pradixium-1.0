/* PRADIXIUM™ — Virginia Beach metro: City of Norfolk, VA (FIPS 51710) —
 * Office of the Real Estate Assessor "Property Assessment and Sales"
 * (data.norfolk.gov, Socrata g7sg-tivf, updated daily from ProVal)
 * Shown: current total assessed value with its assessment year
 * (Government Value, display only), finished living area, year built.
 * Not shown: the "consideration" of the latest transfer — no arm's-length
 * code — and grantor/grantee names (never requested).
 */
const API = "https://data.norfolk.gov/resource/g7sg-tivf.json";
const SOURCE = "City of Norfolk Office of the Real Estate Assessor (open data)";
const SOURCE_URL = "https://data.norfolk.gov/";
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "51710";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  if (w.length > 1) w.pop();
  const j = await h.json(API + "?" + new URLSearchParams({
    $select: "parcel_id,extension,property_street_direction,unit_number,property_use,residential_finished_living,improvement_year_built,current_total_value,effective_year",
    $where: `property_street_number='${h.escapeSql(a.number)}' AND upper(property_street_name)='${h.escapeSql(w.join(" "))}'`,
    $limit: "20"
  }), 6000).catch(() => null);
  let rows = (Array.isArray(j) ? j : []).filter((r) => (!dir || !h.s(r.property_street_direction) || h.s(r.property_street_direction).toUpperCase() === dir) && /^R01$/i.test(h.s(r.extension) || "R01"));
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.unit_number) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.unit_number));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "City of Norfolk Assessor: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.current_total_value) > 0 ? Number(r.current_total_value) : null;
  const year = h.s(r.effective_year).slice(0, 4) || null;
  const la = Number(r.residential_finished_living) > 0 ? Number(r.residential_finished_living) : null, yb = Number(r.improvement_year_built) > 0 ? Number(r.improvement_year_built) : null;
  const facts = [h.s(r.property_use).toLowerCase(), la && `${la.toLocaleString("en-US")} sq ft finished living`, yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `City of Norfolk Assessor parcel ${h.s(r.parcel_id)}${facts ? ` (${facts})` : ""}${value ? `: assessed value ${usd(value)}${year ? ` (assessment effective ${year})` : ""}` : ""}. Sales are not shown: the latest transfer carries no arm's-length code.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: "City of Norfolk assessed value" } : null,
    location: null, property: { livingAreaSqFt: la, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
