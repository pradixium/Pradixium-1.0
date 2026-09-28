/* PRADIXIUM™ — Milwaukee core: City of Milwaukee, WI (in Milwaukee County,
 * FIPS 55079) — City Assessor's Master Property File (MPROP, City of
 * Milwaukee open data, updated daily)
 * Shown: current-year assessed total (Government Value, display only),
 * building area (equals "FinishedSqft" in the Assessor's sales file —
 * checked on a sample parcel, Sept 2026), beds, baths, year built.
 * Not shown: sales — the Assessor's sales dataset does not state how its
 * sales are screened (and the Assessor's site cannot be reached to check).
 * Suburbs outside the City of Milwaukee are not in MPROP → no record.
 */
const API = "https://data.milwaukee.gov/api/3/action/datastore_search";
const MPROP = "0a2c7f31-cd15-4151-8222-09dd57d5f16d";
const SOURCE = "City of Milwaukee Assessor — Master Property File (MPROP)";
const SOURCE_URL = "https://data.milwaukee.gov/dataset/mprop";
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "55079";
}

export async function evidence({ geo, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  if (w.length > 1) w.pop();
  const j = await h.json(API + "?" + new URLSearchParams({
    resource_id: MPROP,
    filters: JSON.stringify({ HOUSE_NR_LO: a.number, STREET: w.join(" "), ...(dir ? { SDIR: dir } : {}) }),
    fields: "TAXKEY,GEO_ZIP_CODE,C_A_TOTAL,YR_ASSMT,BLDG_AREA,YR_BUILT,BEDROOMS,BATHS,POWDER_ROOMS,NR_UNITS",
    limit: "20"
  }), 6000).catch(() => null);
  let rows = j?.result?.records || [];
  if (z) rows = rows.filter((r) => !h.s(r.GEO_ZIP_CODE) || h.s(r.GEO_ZIP_CODE).startsWith(z.zip));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "City of Milwaukee Assessor: more than one tax key matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.C_A_TOTAL) > 0 ? Number(r.C_A_TOTAL) : null, year = h.s(r.YR_ASSMT) || null;
  const property = {
    livingAreaSqFt: Number(r.BLDG_AREA) > 0 ? Math.round(Number(r.BLDG_AREA)) : null,
    yearBuilt: Number(r.YR_BUILT) > 0 ? Number(r.YR_BUILT) : null,
    bedrooms: Number(r.BEDROOMS) > 0 ? Number(r.BEDROOMS) : null,
    bathrooms: Number(r.BATHS) > 0 ? Number(r.BATHS) + (Number(r.POWDER_ROOMS) > 0 ? 0.5 * Number(r.POWDER_ROOMS) : 0) : null
  };
  const facts = [property.livingAreaSqFt && `${property.livingAreaSqFt.toLocaleString("en-US")} sq ft finished`, property.bedrooms && `${property.bedrooms} bd`, property.bathrooms && `${property.bathrooms} ba`, property.yearBuilt && `built ${property.yearBuilt}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `City of Milwaukee Assessor tax key ${h.s(r.TAXKEY)}${facts ? ` (${facts})` : ""}${value ? `: ${year ? year + " " : ""}assessed value ${usd(value)}` : ""}. Sales are not shown: the Assessor's sales file does not state how its sales are screened.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `City of Milwaukee ${year ? year + " " : ""}assessed value` } : null,
    location: null, property, checks: [], hasRecord: true
  };
}
