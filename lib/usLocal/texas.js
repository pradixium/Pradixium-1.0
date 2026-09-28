/* PRADIXIUM™ — Texas: Harris (Houston), Dallas, Bexar (San Antonio), Travis (Austin)
 * Texas does not put sale prices in public records (a "non-disclosure"
 * state), so no official sale-price benchmark exists — the report says so
 * instead of estimating one. What IS official is the appraisal district's
 * market value for every property, set as of 1 January each year:
 *  - Harris: HCAD parcels as published by Harris County GIS
 *    (www.gis.hctx.net, HCAD/Parcels) — total market value, tax year,
 *    state class, last ownership-change date
 *  - Bexar (San Antonio): Bexar County GIS "Parcels", which the county
 *    reloads each September/October with BCAD's final (post-protest)
 *    values — total value, year built; gross building area (not defined
 *    as living area, so text only). The layer names no tax year.
 *  - Travis (Austin): TCAD parcels as published by Travis County TNR
 *    ("TCAD Parcels Dec 2025", assembled from TCAD) — market value. The
 *    City of Austin's own TCAD layer carries land value only.
 *  - Dallas: DCAD's own ParcelQuery service (maps.dcad.org) — "Current
 *    Market Value" (field alias), revaluation year, residential floor
 *    area, year built, school district. The service is intermittently
 *    down (database errors), so it gets a short timeout and simply drops.
 * Not yet covered: Tarrant — TAD's open parcel service has no values and
 * Tarrant County's "TCProperty" layer holds only ~110 county-owned parcels.
 * The appraisal value is shown as the Government Value, labelled as an
 * appraisal — it never feeds the verdict.
 */
const COUNTIES = {
  "48201": {
    name: "Harris County Appraisal District (HCAD)",
    url: "https://www.gis.hctx.net/arcgishcpid/rest/services/HCAD/Parcels/MapServer/0/query",
    sourceUrl: "https://hcad.org/",
    fields: "HCAD_NUM,tax_year,site_str_pfx,site_str_num,site_str_name,site_str_sfx,site_zip,state_class,total_market_val,new_owner_date,CONDO_FLAG"
  },
  "48113": {
    name: "Dallas Central Appraisal District (DCAD)",
    url: "https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query",
    sourceUrl: "https://www.dallascad.org/",
    fields: "PARCELID,SITEADDRESS,UNIT,CLASSDSCRP,RESFLRAREA,RESYRBLT,CNTASSDVAL,REVALYR,SCHLDSCRP"
  },
  "48029": {
    name: "Bexar Appraisal District (BCAD)",
    url: "https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0/query",
    sourceUrl: "https://www.bcad.org/",
    fields: "PropID,Situs,Zip,TotVal,GBA,YrBlt,State_cd",
    valueLabel: "final (post-protest) appraised value"
  },
  "48453": {
    name: "Travis Central Appraisal District (TCAD)",
    // Travis County TNR's published copy of the TCAD roll (dated Dec 2025 —
    // a newer copy gets a new service name; update this when one appears)
    url: "https://services1.arcgis.com/HGcSYZ5bvjRswoCb/arcgis/rest/services/TCAD_Parcels_Dec_2025/FeatureServer/0/query",
    sourceUrl: "https://traviscad.org/",
    fields: "PROP_ID,situs_num,situs_street,situs_street_prefx,situs_street_suffix,situs_zip,market_value",
    valueLabel: "market value (2025 roll, Travis County copy of Dec 2025)",
    asOf: "2025"
  }
};
const SUFFIXES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "LOOP", "HWY", "FWY", "TER", "PASS", "XING", "SQ", "PT", "RUN", "PATH", "ROW", "VW", "WALK", "BND", "CV", "GRN", "HOLW", "KNL", "PLZ", "RDG", "SPUR"]);
const DIRS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

export function matches(geo) {
  return Boolean(COUNTIES[String(geo?.countyFips || "")]);
}

function parse(line) {
  const w = String(line || "").toUpperCase().replace(/[.,]/g, " ").trim().split(/\s+/);
  const num = /^\d+$/.test(w[0] || "") ? Number(w.shift()) : null;
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : null;
  const sfx = w.length > 1 && SUFFIXES.has(w[w.length - 1]) ? w.pop() : null;
  return { num, dir, name: w.join(" "), sfx };
}

export async function evidence({ geo, address, zip, h }) {
  const fips = String(geo.countyFips), c = COUNTIES[fips];
  const a = parse(h.s(geo?.matchedAddress).split(",")[0]);
  if (!a.num || !a.name) return null;
  const query = (where) => h.json(c.url + "?" + new URLSearchParams({ where, outFields: c.fields, returnGeometry: "false", f: "json" }), 9000);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  let rec = null, gov = null, lastChange = null, asOf = null, several = false, property = null;

  if (fips === "48201") {
    const z = h.uspsZip(zip, geo);
    const j = await query(`site_str_num=${a.num} AND site_str_name='${h.escapeSql(a.name)}'${z ? ` AND site_zip LIKE '${z.zip}%'` : ""}`);
    let rows = (j?.features || []).map((f) => f.attributes).filter((r) => (!a.dir || !r.site_str_pfx || h.s(r.site_str_pfx).toUpperCase() === a.dir) && (!a.sfx || !r.site_str_sfx || h.s(r.site_str_sfx).toUpperCase() === a.sfx));
    several = rows.length > 1;
    if (rows.length === 1) {
      rec = rows[0];
      gov = Number(rec.total_market_val) > 0 ? Number(rec.total_market_val) : null;
      asOf = h.s(rec.tax_year) || null;
      lastChange = Number.isFinite(rec.new_owner_date) ? new Date(rec.new_owner_date).toISOString().slice(0, 10) : null;
    }
  }

  if (fips === "48113") {
    const line = [a.num, a.dir, a.name, a.sfx].filter(Boolean).join(" ");
    const j = await h.json(c.url + "?" + new URLSearchParams({ where: `SITEADDRESS='${h.escapeSql(line)}'`, outFields: c.fields, returnGeometry: "false", f: "json" }), 6000).catch(() => null);
    let rows = (j?.features || []).map((f) => f.attributes);
    const unit = h.unitFromAddress(address);
    if (unit) rows = rows.filter((r) => h.unitKey(r.UNIT) === unit);
    else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.UNIT));
    several = rows.length > 1;
    if (rows.length === 1) {
      rec = rows[0];
      gov = Number(rec.CNTASSDVAL) > 0 ? Number(rec.CNTASSDVAL) : null;
      asOf = gov && rec.REVALYR ? String(rec.REVALYR) : null;
      property = { livingAreaSqFt: Number(rec.RESFLRAREA) > 0 ? Number(rec.RESFLRAREA) : null, yearBuilt: Number(rec.RESYRBLT) > 0 ? Number(rec.RESYRBLT) : null, bedrooms: null, bathrooms: null };
    }
  }

  if (fips === "48029") {
    const z = h.uspsZip(zip, geo);
    const j = await h.json(c.url + "?" + new URLSearchParams({ where: `Situs LIKE '${a.num} %${h.escapeSql(a.name)}%'${z ? ` AND Zip='${z.zip}'` : ""}`, outFields: c.fields, returnGeometry: "false", f: "json" }), 7000).catch(() => null);
    const rows = (j?.features || []).map((f) => f.attributes).filter((r) => {
      const p = parse(r.Situs);
      return p.num === a.num && p.name === a.name && (!a.dir || !p.dir || p.dir === a.dir) && (!a.sfx || !p.sfx || p.sfx === a.sfx);
    });
    several = rows.length > 1;
    if (rows.length === 1) {
      rec = rows[0];
      gov = Number(rec.TotVal) > 0 ? Number(rec.TotVal) : null;
      property = { livingAreaSqFt: null, yearBuilt: Number(rec.YrBlt) > 0 ? Number(rec.YrBlt) : null, bedrooms: null, bathrooms: null };
    }
  }

  if (fips === "48453") {
    const z = h.uspsZip(zip, geo);
    const j = await h.json(c.url + "?" + new URLSearchParams({ where: `situs_num='${a.num}' AND situs_street LIKE '${h.escapeSql(a.name)}%'${z ? ` AND situs_zip='${z.zip}'` : ""}`, outFields: c.fields, returnGeometry: "false", f: "json" }), 7000).catch(() => null);
    // TCAD sometimes keeps the street type inside the name ("SUNSET VIEW" where the geocoder says "SUNSET VW")
    let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const st = h.s(r.situs_street).toUpperCase(); return (st === a.name || st.startsWith(a.name + " ")) && (!a.dir || !r.situs_street_prefx || h.s(r.situs_street_prefx).toUpperCase() === a.dir) && (!a.sfx || !r.situs_street_suffix || h.s(r.situs_street_suffix).toUpperCase() === a.sfx); });
    if (rows.length > 1) rows = rows.filter((r) => h.s(r.situs_street).toUpperCase() === a.name);
    several = rows.length > 1;
    if (rows.length === 1) {
      rec = rows[0];
      gov = Number(rec.market_value) > 0 ? Number(rec.market_value) : null;
    }
  }

  const parts = ["Texas does not make sale prices public (non-disclosure state), so no official sale-price benchmark exists for this address."];
  if (rec) parts.push(`${c.name}${asOf && !c.asOf ? ` ${asOf}` : ""} ${c.valueLabel || "market value"} ${gov ? usd(gov) : "not published"} — the appraisal district's valuation, not a sale price; not used in the verdict.${fips === "48029" && Number(rec.GBA) > 0 ? ` Gross building area ${Number(rec.GBA).toLocaleString("en-US")} sq ft${property?.yearBuilt ? `, built ${property.yearBuilt}` : ""} (BCAD).` : ""}${lastChange ? ` Last ownership change on record: ${lastChange}.` : ""}`);
  else if (several) parts.push(`${c.name}: several accounts at this address — add the unit number for the unit's own record.`);

  const checks = [];
  if (fips === "48113" && h.s(rec?.SCHLDSCRP)) checks.push({ id: "schoolDistrict", label: "School district", value: h.s(rec.SCHLDSCRP), level: "info", source: c.name, sourceUrl: c.sourceUrl, basis: "parcel" });

  return {
    source: c.name, sourceUrl: c.sourceUrl,
    summary: parts.join(" "),
    lastSale: null,
    benchmark: null,
    governmentValue: gov ? { value: gov, asOf: asOf || c.asOf || null, label: `${c.name} ${c.valueLabel || "market value"}${asOf && !c.asOf ? ` (${asOf})` : ""}` } : null,
    location: null,
    property,
    checks,
    hasRecord: Boolean(rec)
  };
}
