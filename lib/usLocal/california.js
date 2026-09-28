/* PRADIXIUM™ — California counties' own Assessor parcel records (outside LA,
 * which has its own code in api/us-intelligence.js)
 * California publishes no sale prices, and under Proposition 13 the
 * assessed value is the value set at the last change of ownership (or new
 * construction) plus at most 2% a year — NOT current market value. So the
 * assessed value is shown in the text only, labelled as such, never as a
 * Government Value and never in the verdict. Property facts (living area,
 * bedrooms, year built) are shown when the county publishes them.
 *  - San Diego (06073): SanGIS/SANDAG "Parcels" (Assessor roll attributes)
 *  - Riverside (06065): County of Riverside GIS OpenData/Assessor layer 50
 *    (assessed land + structures, use class)
 *  - Contra Costa (06013): CCMAP "Assessment Parcels" (Assessor land +
 *    improvement values, TLA = total living area)
 *  - San Joaquin (06077): San Joaquin County "Parcels" (Assessor values with
 *    their roll year, beds/baths, living area, year built)
 *  - Orange (06059): County Treasurer-Tax Collector "Secured Property Tax
 *    Information" (OC GIS) — assessed land + improvements (= total), the
 *    secured tax bill; matched within 250 m of the geocoded point
 *  - San Francisco (06075): Office of the Assessor-Recorder "Secured
 *    Property Tax Roll" on DataSF (wv5m-vpq2), latest closed roll
 */
const DIRS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
const TYPES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "TER", "HWY", "SQ", "PT", "ROW", "CV", "PLZ", "RDG", "XING", "LOOP", "WALK", "GLN", "CYN", "HTS", "MNR", "PATH", "RUN", "VW", "VIS", "TRCE", "BND"]);
const WORD = { N: "NORTH", S: "SOUTH", E: "EAST", W: "WEST" };
const PROP13 = "under Proposition 13 this is the value set at the last change of ownership plus at most 2% a year, not current market value";
const n = (x) => (Number(x) > 0 ? Number(x) : null);
const arc = (h, url, where, outFields) => h.json(url + "/query?" + new URLSearchParams({ where, outFields, returnGeometry: "false", f: "json" }), 6000)
  .then((j) => (j?.features || []).map((f) => f.attributes)).catch(() => []);

// each county: query(number, name-without-type, h, parts) → rows mapped to
// { id, zips[], town, dir, type, unit, value, area, beds, baths, built, roll, use }
const COUNTIES = {
  "06073": {
    name: "San Diego County Assessor", source: "San Diego County Assessor (SanGIS / SANDAG parcels)",
    sourceUrl: "https://www.sandiegocounty.gov/content/sdc/arcc.html",
    query: (no, name, h) => arc(h, "https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0",
      `situs_address=${no} AND situs_street='${h.escapeSql(name)}'`, "apn,situs_zip,situs_community,situs_pre_dir,situs_suffix,situs_suite,asr_total,total_lvg_area,bedrooms")
      .then((rs) => rs.map((r) => ({ id: h.s(r.apn), zips: [h.s(r.situs_zip).slice(0, 5)], town: h.s(r.situs_community), dir: h.s(r.situs_pre_dir), type: h.s(r.situs_suffix), unit: r.situs_suite, value: n(r.asr_total), area: n(r.total_lvg_area), beds: n(r.bedrooms) })))
  },
  "06065": {
    name: "Riverside County Assessor", source: "Riverside County Assessor (County of Riverside GIS open data)",
    sourceUrl: "https://www.rivcoacr.org/",
    query: (no, name, h) => arc(h, "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50",
      `STREET_NUMBER=${no} AND STREET_NAME='${h.escapeSql(name)}'`, "APN,ZIP_CODE,CITY,STREET_PREDIRECTION,STREET_TYPE,UNIT_NUMBER,CLASS_CODE,LAND,STRUCTURES")
      .then((rs) => rs.map((r) => ({ id: h.s(r.APN), zips: [h.s(r.ZIP_CODE).slice(0, 5)], town: h.s(r.CITY), dir: h.s(r.STREET_PREDIRECTION), type: h.s(r.STREET_TYPE), unit: r.UNIT_NUMBER, value: n(Number(r.LAND || 0) + Number(r.STRUCTURES || 0)), use: h.s(r.CLASS_CODE).toLowerCase() })))
  },
  "06013": {
    name: "Contra Costa County Assessor", source: "Contra Costa County Assessor (CCMAP assessment parcels)",
    sourceUrl: "https://www.contracosta.ca.gov/191/Assessor",
    // the street name carries its direction here ("W HOLLY")
    query: (no, name, h, dir) => arc(h, "https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0",
      `S_STR_NBR='${no}' AND S_STR_NM='${h.escapeSql([dir, name].filter(Boolean).join(" "))}'`, "APN,S_ZIP,s_city,S_STR_SUF,S_APT_NBR,Description,LAND_VALUE,IMP_VAL,TLA")
      .then((rs) => rs.map((r) => ({ id: h.s(r.APN), zips: [String(r.S_ZIP || "")], town: h.s(r.s_city), type: h.s(r.S_STR_SUF), unit: r.S_APT_NBR, value: n(Number(r.LAND_VALUE || 0) + Number(r.IMP_VAL || 0)), area: n(r.TLA), use: h.s(r.Description).split(",")[0].toLowerCase() })))
  },
  "06077": {
    name: "San Joaquin County Assessor", source: "San Joaquin County Assessor (San Joaquin County GIS parcels)",
    sourceUrl: "https://www.sjgov.org/department/assessor",
    query: (no, name, h) => arc(h, "https://services2.arcgis.com/GQhSReJEO6f7tsvy/arcgis/rest/services/Parcels/FeatureServer/0",
      `SITUSNUMBER='${no}' AND SITUSTREET='${h.escapeSql(name)}'`, "APN,SITUSZIP,FULL_ADDRESS,SITUSDIRECTION,SITUSTYPE,SITUSUNIT,DESCRIPTION,VALUE_ROLL_YEAR,LAND_VALUE,IMPROVEMENT_VALUE,TOTALLIV_AREA,BEDROOMS,BATHROOM_WHOLE,BATHROOM_HALF,YEAR_BUILT")
      .then((rs) => rs.map((r) => {
        const full = h.s(r.FULL_ADDRESS).match(/^(.*)\s+CA\s+(\d{5})/);
        return { id: h.s(r.APN), zips: [h.s(r.SITUSZIP).slice(0, 5), full?.[2]].filter(Boolean), town: full ? full[1].split(/\s+/).pop() : "", dir: h.s(r.SITUSDIRECTION), type: h.s(r.SITUSTYPE), unit: r.SITUSUNIT, value: n(Number(r.LAND_VALUE || 0) + Number(r.IMPROVEMENT_VALUE || 0)), roll: h.s(r.VALUE_ROLL_YEAR), area: n(r.TOTALLIV_AREA), beds: n(r.BEDROOMS), baths: n(r.BATHROOM_WHOLE) ? Number(r.BATHROOM_WHOLE) + 0.5 * Number(r.BATHROOM_HALF || 0) : null, built: n(r.YEAR_BUILT), use: h.s(r.DESCRIPTION).replace(/\s*\(.*\)$/, "").toLowerCase() };
      }))
  },
  "06059": {
    name: "Orange County Treasurer-Tax Collector", source: "County of Orange Treasurer-Tax Collector (Secured Property Tax Information, OC GIS)",
    sourceUrl: "https://www.octreasurer.gov/",
    // SiteAddress has no city/ZIP ("317 IRVINE", sometimes no street type):
    // the parcel must lie within 250 m of the geocoded point instead
    spatial: true,
    query: (no, name, h, dir, geo) => h.json("https://www.ocgis.com/arcpub/rest/services/Treasurer_Tax_Collector/Secured_Property_Tax_Information/FeatureServer/0/query?" + new URLSearchParams({
      where: `SiteAddress LIKE '${no} %'`, geometry: `${geo.longitude},${geo.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326",
      spatialRel: "esriSpatialRelIntersects", distance: "250", units: "esriSRUnit_Meter", outFields: "AssessmentNo,SiteAddress,alv,aiv,tav,ta", returnGeometry: "false", f: "json"
    }), 6000).then((j) => (j?.features || []).map((f) => f.attributes).map((r) => {
      const w = h.s(r.SiteAddress).toUpperCase().split(/\s+/);
      if (w.shift() !== no) return null;
      const d = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
      const t = w.length > 1 && TYPES.has(w[w.length - 1]) ? w.pop() : "";
      if (w.join(" ") !== name) return null;
      return { id: h.s(r.AssessmentNo), zips: [], town: "", dir: d, type: t, unit: "", value: n(r.tav), use: Number(r.ta) > 0 ? `secured tax bill $${Math.round(Number(r.ta)).toLocaleString("en-US")}` : null };
    }).filter(Boolean)).catch(() => [])
  },
  "06075": {
    name: "San Francisco Assessor-Recorder", source: "San Francisco Office of the Assessor-Recorder (secured property tax roll, DataSF)",
    sourceUrl: "https://sfassessor.org/",
    // property_location is "<from no> <to no> <street> <type><unit>", numbers zero-padded to 4
    query: async (no, name, h) => {
      const base = "https://data.sf.gov/resource/wv5m-vpq2.json";
      const latest = await h.json(base + "?$select=max(closed_roll_year) AS y", 5000).catch(() => null);
      const y = latest?.[0]?.y;
      if (!y) return [];
      const rs = await h.json(base + "?" + new URLSearchParams({ closed_roll_year: y, $where: `property_location like '% ${no.padStart(4, "0")} ${h.escapeSql(name)} %'`, $limit: "50" }), 6000).catch(() => null);
      return (rs || []).map((r) => {
        const m = h.s(r.property_location).match(/\s(\S*?)(\d{4})?$/);
        return { id: h.s(r.parcel_number), zips: [], town: "SAN FRANCISCO", unit: m?.[2] && Number(m[2]) ? String(Number(m[2])) : "", value: n(["assessed_land_value", "assessed_improvement_value", "assessed_fixtures_value"].reduce((t, k) => t + Number(r[k] || 0), 0)), roll: h.s(r.closed_roll_year), area: n(r.property_area), beds: n(r.number_of_bedrooms), baths: n(r.number_of_bathrooms), built: n(r.year_property_built), use: h.s(r.property_class_code_definition || r.use_definition).toLowerCase() };
      });
    }
  }
};

export function matches(geo) {
  return Boolean(COUNTIES[String(geo?.countyFips || "")]);
}

export async function evidence({ geo, address, zip, h }) {
  const c = COUNTIES[String(geo?.countyFips || "")];
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!c || !a || !z) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const type = w.length > 1 && TYPES.has(w[w.length - 1]) ? w.pop() : "";
  if (c.spatial && !(Number.isFinite(Number(geo?.latitude)) && Number.isFinite(Number(geo?.longitude)))) return null;
  let rows = (await c.query(String(Number(a.number)), w.join(" "), h, dir, geo))
    .filter((r) => (!dir || !r.dir || r.dir === dir) && (!type || !r.type || r.type === type));
  // the geocoder abbreviates a leading direction word that is part of the
  // street's name ("NORTH POINT ST" → "N POINT ST"): retry with it spelled out
  if (!rows.length && WORD[dir]) rows = (await c.query(String(Number(a.number)), `${WORD[dir]} ${w.join(" ")}`, h, ""))
    .filter((r) => !r.dir && (!type || !r.type || r.type === type));
  // the Census geocoder's ZIP can differ from the Assessor's situs ZIP, so a
  // parcel counts when its ZIP OR its town matches; the ZIP then separates
  // same-named streets in different towns
  const town = h.s(geo?.city).toUpperCase().replace(/\s+(CITY|CDP|TOWN)$/, "");
  if (!c.spatial) rows = rows.filter((r) => r.zips.includes(z.zip) || (town && h.s(r.town).toUpperCase() === town));
  if (rows.length > 1 && rows.some((r) => r.zips.includes(z.zip))) rows = rows.filter((r) => r.zips.includes(z.zip));
  const unit = h.unitFromAddress(address), found = rows.length;
  if (unit) rows = rows.filter((r) => h.unitKey(r.unit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.unit));
  if (rows.length !== 1) return rows.length > 1 || (!unit && found > 1) ? { source: c.source, sourceUrl: c.sourceUrl, summary: `${c.name}: several parcels at this address — add the unit number.`, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const facts = [r.use, r.area && `${r.area.toLocaleString("en-US")} sq ft living`, r.beds && `${r.beds} bd`, r.baths && `${r.baths} ba`, r.built && `built ${r.built}`].filter(Boolean).join(", ");
  return {
    source: c.source, sourceUrl: c.sourceUrl,
    summary: `${c.name} parcel ${r.id}${facts ? ` (${facts})` : ""}${r.value ? `: ${r.roll ? r.roll + " " : ""}assessed value ${usd(r.value)} — ${PROP13}` : ""}. California publishes no sale prices, so no sale is shown.`,
    lastSale: null, benchmark: null, governmentValue: null, location: null,
    property: { livingAreaSqFt: r.area || null, yearBuilt: r.built || null, bedrooms: r.beds || null, bathrooms: r.baths || null },
    checks: [], hasRecord: true
  };
}
