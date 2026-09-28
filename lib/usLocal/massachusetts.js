/* PRADIXIUM™ — Massachusetts, statewide fallback (every city and town) —
 * MassGIS "Massachusetts Property Tax Parcels" (Level 3 assessors' parcels,
 * each town's assessing data joined by MassGIS)
 * Shown: total assessed value with the town's fiscal year (Government
 * Value, display only), residential living area, year built, use.
 * Not shown: the last-sale price (LS_PRICE) — no arm's-length screening.
 * Boston (Suffolk County) has its own FY2026 city module, tried first.
 */
const URL = "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0/query";
const SOURCE = "MassGIS Property Tax Parcels (town assessors)";
const SOURCE_URL = "https://www.mass.gov/info-details/massgis-data-property-tax-parcels";

export function matches(geo) {
  return geo?.stateCode === "MA";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  const city = h.s(geo?.matchedAddress).split(",")[1]?.trim().toUpperCase();
  if (!a || !city) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `CITY='${h.escapeSql(city)}' AND ADDR_NUM='${h.escapeSql(a.number)}' AND FULL_STR='${h.escapeSql(a.street)}'`,
    outFields: "PROP_ID,LOCATION,TOTAL_VAL,FY,RES_AREA,YEAR_BUILT,USE_DESC",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  let rows = (j?.features || []).map((f) => f.attributes);
  rows = rows.filter((r, i) => rows.findIndex((x) => h.s(x.PROP_ID) === h.s(r.PROP_ID)) === i);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(h.s(r.LOCATION).replace(/^(UNIT|APT|#)\s*/i, "")) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.LOCATION));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "MassGIS: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.TOTAL_VAL) > 0 ? Number(r.TOTAL_VAL) : null, fy = r.FY ? String(r.FY) : null;
  const la = Number(r.RES_AREA) > 0 ? Number(r.RES_AREA) : null, yb = Number(r.YEAR_BUILT) > 1700 ? Number(r.YEAR_BUILT) : null;
  const town = city.charAt(0) + city.slice(1).toLowerCase();
  const facts = [h.s(r.USE_DESC).toLowerCase(), la && `${la.toLocaleString("en-US")} sq ft residential area`, yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `${town} assessor parcel ${h.s(r.PROP_ID)}${facts ? ` (${facts})` : ""}${value ? `: ${fy ? `FY${fy} ` : ""}assessed value ${usd(value)}` : ""} (MassGIS). Sales are not shown: the parcel's last-sale price is not screened for arm's-length sales.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: fy, label: `${town} ${fy ? `FY${fy} ` : ""}assessed value` } : null,
    location: null, property: { livingAreaSqFt: la, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
