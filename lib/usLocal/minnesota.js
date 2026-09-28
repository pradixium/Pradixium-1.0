/* PRADIXIUM™ — Minnesota statewide (outside Hennepin, which has its own
 * module): MnGeo "Parcels, Compiled from Opt-In Open Data Counties" — all
 * 87 counties opted in (checked Sept 2026), in the state's standard parcel
 * schema from each county assessor.
 * Shown: the assessor's estimated market value (EMV) with its assessment
 * year (mkt_year) as Government Value, display only; finished sq ft, year
 * built, use class. Not shown: sale_value — the schema carries no
 * arm's-length/validity code.
 */
import { arcQuery, structuredEvidence } from "./_structured.js";

const C = {
  name: "Minnesota county assessor",
  source: "MnGeo — Minnesota parcels compiled from the counties' open data (county assessor values)",
  sourceUrl: "https://gisdata.mn.gov/dataset/plan-parcels-open",
  valueLabel: "estimated market value",
  note: "Sales are not shown: the statewide parcel schema carries no arm's-length code.",
  find: ({ num, name, h, geo }) => arcQuery(h, "https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_mngeo/plan_parcels_open/FeatureServer/1",
    `co_code='${h.escapeSql(String(geo.countyFips))}' AND anumber=${num} AND UPPER(st_name)='${h.escapeSql(name)}'`,
    "county_pin,co_code,st_pre_dir,st_pos_typ,st_pos_dir,sub_id1,zip,ctu_name,postcomm,emv_total,mkt_year,fin_sq_ft,year_built,dwell_type", 7000)
    .then((rs) => rs.map((r) => ({ id: r.county_pin, zip: r.zip, town: [r.ctu_name, r.postcomm], dir: r.st_pre_dir, type: r.st_pos_typ, post: r.st_pos_dir, unit: r.sub_id1, value: r.emv_total, year: r.mkt_year, area: r.fin_sq_ft, built: r.year_built, use: String(r.dwell_type || "").split(",")[0] })))
};

export function matches(geo) {
  return geo?.stateCode === "MN";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
