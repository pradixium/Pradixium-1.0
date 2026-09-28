/* PRADIXIUM™ — Washington State (outside King County, which has its own
 * module): WA Geoservices "Current Parcels" — the Washington State Parcels
 * Project, which compiles every county assessor's tax parcels into one
 * normalized layer (Parcels_2026), with each county's land and improvement
 * (building) values.
 * Shown: the county assessor's land + building value as Government Value,
 * display only, and the county's own parcel page link. Not shown: sales
 * (the layer has none).
 * Matching: several counties publish the situs address without city/ZIP
 * (Pierce) or without its trailing direction, so a parcel counts only when
 * its house number and street name match AND it lies within 250 m of the
 * geocoded point.
 */
const URL = "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0/query";
const SOURCE = "Washington State Parcels Project (WA Geoservices), county assessor values";
const SOURCE_URL = "https://geo.wa.gov/";
const DIRS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "KP"]);
const TYPES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "TER", "HWY", "SQ", "PT", "ROW", "CV", "PLZ", "RDG", "XING", "LOOP", "WALK", "GLN", "CYN", "HTS", "MNR", "PATH", "RUN", "VW", "VIS", "TRCE", "BND", "LOOP"]);
// street core = the words that are neither a direction nor a street type
const core = (street) => String(street || "").toUpperCase().replace(/[.,]/g, " ").trim().split(/\s+/).filter((w) => !DIRS.has(w) && !TYPES.has(w)).join(" ");

// directions (N/S/E/W…) of the address — both sides must agree when both have one
const dirs = (street) => String(street || "").toUpperCase().split(/\s+/).filter((w) => DIRS.has(w) && w !== "KP").join(" ");

export function matches(geo) {
  return geo?.stateCode === "WA";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  const lat = Number(geo?.latitude), lon = Number(geo?.longitude);
  if (!a || !Number.isFinite(lat) || !Number.isFinite(lon) || !geo?.countyFips) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `FIPS_NR='${String(geo.countyFips).slice(2)}' AND SITUS_ADDRESS LIKE '${h.escapeSql(a.number)} %'`,
    geometry: `${lon},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    distance: "250", units: "esriSRUnit_Meter",
    outFields: "PARCEL_ID_NR,ORIG_PARCEL_ID,SITUS_ADDRESS,SUB_ADDRESS,COUNTY_NM,VALUE_LAND,VALUE_BLDG,DATA_LINK",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  const want = core(a.street), wantDir = dirs(a.street);
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => {
    const m = h.s(r.SITUS_ADDRESS).toUpperCase().match(/^(\d+)\s+(.+)$/);
    const d = dirs(m?.[2]);
    return m && m[1] === a.number && core(m[2]) === want && (!d || !wantDir || d === wantDir);
  });
  const unit = h.unitFromAddress(address), found = rows.length;
  if (unit) rows = rows.filter((r) => h.unitKey(r.SUB_ADDRESS) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.SUB_ADDRESS));
  if (rows.length !== 1) return rows.length > 1 || (!unit && found > 1) ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Washington State Parcels: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const land = Number(r.VALUE_LAND) || 0, bldg = Number(r.VALUE_BLDG) || 0, value = land + bldg > 0 ? land + bldg : null;
  const county = h.s(geo?.county) || "county";
  const link = /^https:\/\//.test(h.s(r.DATA_LINK)) ? h.s(r.DATA_LINK) : null;
  return {
    source: SOURCE, sourceUrl: link || SOURCE_URL,
    summary: `${county} Assessor parcel ${h.s(r.ORIG_PARCEL_ID) || h.s(r.PARCEL_ID_NR)}${value ? `: assessed value ${usd(value)} (land ${usd(land)} + building ${usd(bldg)})` : ""}, from the Washington State Parcels 2026 compilation.${link ? " The county's own parcel page is linked as the source." : ""} Sales are not in this layer.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: `${county} Assessor value (land + building, WA State Parcels 2026)` } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
