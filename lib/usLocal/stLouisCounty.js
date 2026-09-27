/* PRADIXIUM™ — St. Louis metro: St. Louis County, MO (FIPS 29189) — St. Louis
 * County Assessor's parcel data (county GIS, iasWorld extract)
 * Property facts (land use, year built, residential sq ft) and the current
 * tax-year appraised value (Government Value, display only). No sales:
 * the county collects sale prices on Certificates of Value but publishes
 * none in its open data, so no sale is shown rather than a guessed one.
 * RESQFT ("residential sq ft") has no published definition, so it stays
 * in the text only — never used as living area.
 */
const URL = "https://maps.stlouisco.com/hosting/rest/services/Maps/iasworld1/MapServer/7/query";
const SOURCE = "St. Louis County Assessor — parcel data (St. Louis County GIS)";
const SOURCE_URL = "https://stlouiscountymo.gov/st-louis-county-government/county-assessor/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "29189";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `PROP_ADRNUM='${h.escapeSql(a.number)}' AND PROP_ADD LIKE '${h.escapeSql(`${a.number} ${a.street}`)}%' AND PROP_ZIP='${z.zip}'`,
    outFields: "LOCATOR,TAXYR,PROP_ADD,TOTAPVAL,LUCODE,LIVUNIT,YEARBLT,RESQFT",
    returnGeometry: "false", f: "json"
  }), 7000).catch(() => null);
  let rows = (j?.features || []).map((f) => f.attributes);
  const unit = h.unitFromAddress(address);
  const rest = (r) => h.s(r.PROP_ADD).toUpperCase().slice(`${a.number} ${a.street}`.length).trim();
  if (unit) rows = rows.filter((r) => h.unitKey(rest(r).replace(/^(UNIT|APT|#)\s*/i, "")) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !rest(r));
  if (rows.length !== 1) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "St. Louis County Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;

  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.TOTAPVAL) > 0 ? Number(r.TOTAPVAL) : null, year = r.TAXYR ? String(r.TAXYR) : null;
  const yb = Number(r.YEARBLT) > 0 ? Number(r.YEARBLT) : null;
  const facts = [h.s(r.LUCODE).toLowerCase(), Number(r.RESQFT) > 0 && `${Number(r.RESQFT).toLocaleString("en-US")} residential sq ft (Assessor)`, yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `St. Louis County Assessor parcel ${h.s(r.LOCATOR)}${facts ? ` (${facts})` : ""}${value ? `: ${year ? year + " " : ""}appraised value ${usd(value)}` : ""}. Sale prices are not shown: St. Louis County does not publish them in its open data.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `St. Louis County Assessor ${year ? year + " " : ""}appraised value` } : null,
    location: null,
    property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
