/* PRADIXIUM™ — Texas: Harris County (Houston)
 * Texas does not put sale prices in public records (a "non-disclosure"
 * state), so no official sale-price benchmark exists — the report says so
 * instead of estimating one. What IS official is the appraisal district's
 * market value for every property, set as of 1 January each year:
 *  - Harris: HCAD parcels as published by Harris County GIS
 *    (www.gis.hctx.net, HCAD/Parcels) — total market value, tax year,
 *    state class, last ownership-change date
 * Not yet covered (no verified live source): Tarrant — TAD's open parcel
 * service has no values and Tarrant County's "TCProperty" layer holds only
 * ~110 county-owned parcels; Dallas — DCAD's ParcelQuery service returned
 * database errors on every request when checked (Sept 2026).
 * The appraisal value is shown as the Government Value, labelled as an
 * appraisal — it never feeds the verdict.
 */
const COUNTIES = {
  "48201": {
    name: "Harris County Appraisal District (HCAD)",
    url: "https://www.gis.hctx.net/arcgishcpid/rest/services/HCAD/Parcels/MapServer/0/query",
    sourceUrl: "https://hcad.org/",
    fields: "HCAD_NUM,tax_year,site_str_pfx,site_str_num,site_str_name,site_str_sfx,site_zip,state_class,total_market_val,new_owner_date,CONDO_FLAG"
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
  let rec = null, gov = null, lastChange = null, asOf = null, several = false;
  const property = null;

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

  const parts = ["Texas does not make sale prices public (non-disclosure state), so no official sale-price benchmark exists for this address."];
  if (rec) parts.push(`${c.name}${asOf ? ` ${asOf}` : ""} market value ${gov ? usd(gov) : "not published"} — the appraisal district's valuation, not a sale price; not used in the verdict.${lastChange ? ` Last ownership change on record: ${lastChange}.` : ""}`);
  else if (several) parts.push(`${c.name}: several accounts at this address — add the unit number for the unit's own record.`);

  const checks = [];

  return {
    source: c.name, sourceUrl: c.sourceUrl,
    summary: parts.join(" "),
    lastSale: null,
    benchmark: null,
    governmentValue: gov ? { value: gov, asOf, label: `${c.name} market value${asOf ? ` (${asOf})` : ""}` } : null,
    location: null,
    property,
    checks,
    hasRecord: Boolean(rec)
  };
}
