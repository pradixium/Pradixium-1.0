/* PRADIXIUM™ — Indianapolis core: Marion County, IN (FIPS 18097) — City of
 * Indianapolis / Marion County GIS, "Parcels w/ Owner Information & Assessed
 * Values" (MapIndy/MapIndyProperty layer 10)
 * Shown: the Assessor's total assessed value (land + improvements) as
 * Government Value, display only, and the property class. No sales: sale
 * prices are on Indiana's sales disclosure forms, which the state offers
 * only through an interactive search, not as open data.
 */
const URL = "https://gis.indy.gov/server/rest/services/MapIndy/MapIndyProperty/MapServer/10/query";
const SOURCE = "Marion County Assessor (City of Indianapolis GIS)";
const SOURCE_URL = "https://www.indy.gov/agency/marion-county-assessor";
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "18097";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `STNUMBER='${h.escapeSql(a.number)}' AND FULL_STNAME='${h.escapeSql(w.join(" "))}' AND ZIPCODE='${z.zip}'`,
    outFields: "STATEPARCELNUMBER,PRE_DIR,PROPERTY_SUB_CLASS_DESCRIPTION,ASSESSORYEAR_TOTALAV",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  const rows = (j?.features || []).map((f) => f.attributes).filter((r) => !dir || !h.s(r.PRE_DIR) || h.s(r.PRE_DIR) === dir);
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Marion County Assessor: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.ASSESSORYEAR_TOTALAV) > 0 ? Number(r.ASSESSORYEAR_TOTALAV) : null;
  const cls = h.s(r.PROPERTY_SUB_CLASS_DESCRIPTION).replace(/-\d+$/, "").toLowerCase();
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Marion County Assessor parcel ${h.s(r.STATEPARCELNUMBER)}${cls ? ` (${cls})` : ""}${value ? `: total assessed value ${usd(value)}` : ""}. Sales are not shown: Indiana publishes sale prices only through the state's sales-disclosure search tool.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: "Marion County Assessor total assessed value" } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
