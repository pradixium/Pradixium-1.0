import { canon } from "./_structured.js";
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
 *  - San Bernardino (06071): the county's Site Address points (official
 *    address → PRCLNUM or the containing parcel) + "Parcels with Redacted
 *    Owner Name" (Assessor land + improvement value, Prop 13 base year)
 *  - Sonoma (06097): County of Sonoma "Parcels Public" — roll year, land +
 *    improvements (TotalLI), beds/baths, year built, primary building size
 *  - Alameda (06001): County of Alameda open data "Parcels" — assessed
 *    land + improvements
 *  - Placer (06061): Placer County Parcels public view — land + structure
 *  - Solano (06095): Solano County GIS "Parcels Public Aumentum" — land +
 *    improvements, roll year, living area, beds/baths, year built
 *  - Tulare (06107): Tulare County public tax parcels — land + improvements
 *    (no situs city/ZIP → within 250 m of the geocoded point)
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
  "06071": {
    name: "San Bernardino County Assessor", source: "San Bernardino County (Site Address points + Assessor parcels with values)",
    sourceUrl: "https://arc.sbcounty.gov/",
    // the valued parcel layer has no situs address: the county's official
    // site-address point gives the parcel (its PRCLNUM, else the parcel
    // polygon that contains the point)
    query: async (no, name, h) => {
      const pts = await h.json("https://maps.sbcounty.gov/gis/rest/services/AddressDataManagement/SBC_Site_Addresses/FeatureServer/0/query?" + new URLSearchParams({
        where: `ADDRNUM='${no}' AND STATUS='Current' AND (CONFIRESTNAME='${h.escapeSql(name)}' OR UPPER(FULLNAME) LIKE '%${h.escapeSql(name)}%')`,
        outFields: "UNITID,MUNICIPALITY,ROV_ZIPC,PRCLNUM,CONFIRESTPREDIR,CONFIRESTNAME,CONFIRESTTYPE,FULLNAME", returnGeometry: "true", outSR: "4326", f: "json"
      }), 5000).then((j) => j?.features || []).catch(() => []);
      if (!pts.length || pts.length > 20) return [];
      const P = "https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0/query?";
      const money = (x) => Number(String(x ?? "").replace(/,/g, "")) || 0;
      const out = await Promise.all(pts.map(async (p) => {
        const a = p.attributes, g = p.geometry;
        const full = h.s(a.FULLNAME).toUpperCase().split(/\s+/);
        if (DIRS.has(full[0])) full.shift();
        if (full.length > 1 && TYPES.has(full[full.length - 1])) full.pop();
        if (h.s(a.CONFIRESTNAME).toUpperCase() !== name && full.join(" ") !== name) return null;
        const params = h.s(a.PRCLNUM) ? { where: `ParcelNumber='${h.escapeSql(h.s(a.PRCLNUM))}'` }
          : g ? { where: "1=1", geometry: `${g.x},${g.y}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : null;
        if (!params) return null;
        const ps = await h.json(P + new URLSearchParams({ ...params, outFields: "ParcelNumber,LandValue,ImprovementValue,BaseYear,AssessClass", returnGeometry: "false", f: "json" }), 5000).then((j) => (j?.features || []).map((f) => f.attributes)).catch(() => []);
        if (ps.length !== 1) return null;
        const r = ps[0];
        return { id: h.s(r.ParcelNumber), zips: [h.s(a.ROV_ZIPC)], town: h.s(a.MUNICIPALITY), dir: h.s(a.CONFIRESTPREDIR), type: h.s(a.CONFIRESTTYPE), unit: a.UNITID, value: n(money(r.LandValue) + money(r.ImprovementValue)), use: [h.s(r.AssessClass).toLowerCase(), Number(r.BaseYear) > 1900 && `Prop 13 base year ${h.s(r.BaseYear)}`].filter(Boolean).join(", ") };
      }));
      // several address points (units) can sit on one parcel: keep one row per parcel + unit
      const seen = new Set();
      return out.filter(Boolean).filter((r) => { const k = r.id + "|" + h.s(r.unit); if (seen.has(k)) return false; seen.add(k); return true; });
    }
  },
  "06097": {
    name: "Sonoma County Assessor", source: "Sonoma County Assessor (County of Sonoma GIS, Parcels Public)",
    sourceUrl: "https://sonomacounty.ca.gov/administrative-support-and-fiscal-services/clerk-recorder-assessor-registrar-of-voters/assessor",
    query: (no, name, h) => arc(h, "https://socogis.sonomacounty.ca.gov/map/rest/services/CRAPublic/ParcelsPublic/FeatureServer/0",
      `SitusStreetNo='${no}' AND SitusStreetName='${h.escapeSql(name)}'`, "APN,SitusFormatted2,SitusDirection,SitusStreetType,SitusUnitNumber,Value601RollYear,Value601TotalLI,UseCodeDescription,BuildingPrimarySize,BuildingPrimaryYearBuilt,BuildingPrimaryBedRooms,BuildingPrimaryBaths")
      .then((rs) => rs.map((r) => ({ id: h.s(r.APN), zips: [], town: h.s(r.SitusFormatted2).replace(/\s+CA$/i, ""), dir: h.s(r.SitusDirection), type: h.s(r.SitusStreetType), unit: r.SitusUnitNumber, value: n(r.Value601TotalLI), roll: h.s(r.Value601RollYear), beds: n(r.BuildingPrimaryBedRooms), baths: n(r.BuildingPrimaryBaths), built: n(r.BuildingPrimaryYearBuilt), use: [h.s(r.UseCodeDescription).toLowerCase(), n(r.BuildingPrimarySize) && `primary building ${n(r.BuildingPrimarySize).toLocaleString("en-US")} sq ft`].filter(Boolean).join(", ") })))
  },
  "06001": {
    name: "Alameda County Assessor", source: "Alameda County Assessor (County of Alameda open data parcels)",
    sourceUrl: "https://www.acassessor.org/",
    // SitusStreetName carries the street type ("BENVENUE AVE")
    query: (no, name, h) => arc(h, "https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0",
      `SitusStreetNumber='${no}' AND SitusStreetName LIKE '${h.escapeSql(name)}%'`, "APN,SitusStreetName,SitusUnit,SitusCity,SitusZip,Land,Imps")
      .then((rs) => rs.map((r) => {
        const w = h.s(r.SitusStreetName).toUpperCase().split(/\s+/);
        const d = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
        const t = w.length > 1 && TYPES.has(w[w.length - 1]) ? w.pop() : "";
        return w.join(" ") === name ? { id: h.s(r.APN), zips: [h.s(r.SitusZip).slice(0, 5)], town: h.s(r.SitusCity), dir: d, type: t, unit: r.SitusUnit, value: n(Number(r.Land || 0) + Number(r.Imps || 0)) } : null;
      }).filter(Boolean))
  },
  "06061": {
    name: "Placer County Assessor", source: "Placer County Assessor (Placer County GIS, County Parcels public view)",
    sourceUrl: "https://www.placer.ca.gov/2145/Assessor",
    query: (no, name, h) => arc(h, "https://services9.arcgis.com/NENkjkswKTzMfG3A/arcgis/rest/services/County_Parcels_-_Public_View/FeatureServer/0",
      `StreetNum LIKE '${no} %' AND StreetName LIKE '${h.escapeSql(name)}%'`, "Apn,StreetNum,StreetName,StreetType,StreetDir,SitusZip,FormattedSitus2,LandValue,Structure")
      .then((rs) => rs.filter((r) => h.s(r.StreetNum) === no && h.s(r.StreetName).toUpperCase() === name).map((r) => ({ id: h.s(r.Apn), zips: [h.s(r.SitusZip).slice(0, 5)], town: h.s(r.FormattedSitus2).replace(/\s+CA\s+\d{5}.*$/, ""), dir: h.s(r.StreetDir), type: h.s(r.StreetType).replace(/^AV$/, "AVE"), unit: "", value: n(Number(r.LandValue || 0) + Number(r.Structure || 0)) })))
  },
  "06095": {
    name: "Solano County Assessor", source: "Solano County Assessor (Solano County GIS, Parcels Public Aumentum)",
    sourceUrl: "https://www.solanocounty.gov/depts/ar/",
    // siteroad holds the street name without its type ("WEST C" for 130 WEST C STREET)
    query: (no, name, h) => arc(h, "https://services2.arcgis.com/SCn6czzcqKAFwdGU/arcgis/rest/services/Parcels_Public_Aumentum/FeatureServer/0",
      `sitenum = ${Number(no)} AND siteroad = '${h.escapeSql(name)}'`, "asmtnum,sitenum,siteroad,p_address,sitecity,unitbldg,rollyear,valland,valimp,total_area,bedroom,bathroom,yrbuilt,use_desc,status")
      .then((rs) => rs.filter((r) => h.s(r.status) !== "IN").map((r) => ({ id: h.s(r.asmtnum), zips: [], town: h.s(r.sitecity), dir: "",
        type: canon(h.s(r.p_address).toUpperCase().trim().split(/\s+/).pop()), unit: h.s(r.unitbldg),
        value: n(Number(r.valland || 0) + Number(r.valimp || 0)), roll: h.s(r.rollyear), area: n(r.total_area), beds: n(r.bedroom), baths: n(r.bathroom), built: n(r.yrbuilt), use: h.s(r.use_desc).toLowerCase() })))
  },
  "06107": {
    name: "Tulare County Assessor", source: "Tulare County Assessor (Tulare County public tax parcels)",
    sourceUrl: "https://tularecounty.ca.gov/assessor/",
    // no situs city/ZIP in the layer: the parcel must lie within 250 m of the geocoded point
    spatial: true,
    query: (no, name, h, dir, geo) => h.json("https://services3.arcgis.com/HLLHUzx8yBgga6a7/arcgis/rest/services/Public_Parcels__Tulare_County/FeatureServer/0/query?" + new URLSearchParams({
      where: `S_NUMB LIKE '${no}%' AND S_STREET='${h.escapeSql(name)}'`, geometry: `${geo.longitude},${geo.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326",
      spatialRel: "esriSpatialRelIntersects", distance: "250", units: "esriSRUnit_Meter", outFields: "PARCELID,S_NUMB,S_TYPE,S_DIR,S_APT,LAND_VAL,IMP_VAL,USEDSCRP", returnGeometry: "false", f: "json"
    }), 6000).then((j) => (j?.features || []).map((f) => f.attributes).filter((r) => h.s(r.S_NUMB) === no).map((r) => ({ id: h.s(r.PARCELID), zips: [], town: "", dir: h.s(r.S_DIR), type: h.s(r.S_TYPE), unit: r.S_APT, value: n(Number(r.LAND_VAL || 0) + Number(r.IMP_VAL || 0)), use: h.s(r.USEDSCRP).replace(/\s*\(.*\)$/, "").toLowerCase() }))).catch(() => [])
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
