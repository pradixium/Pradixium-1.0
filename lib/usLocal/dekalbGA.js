/* PRADIXIUM™ — DeKalb County, GA (FIPS 13089): DeKalb County GIS open data
 *  - "Parcels": situs address (number, spelled-out street, city, ZIP) →
 *    ParcelID
 *  - "Tax Parcels 2025": the Tax Assessors' appraised value (land +
 *    building) with its tax year — a new "Tax_Parcels_<year>" layer is
 *    published each year; point TAX_LAYER at it when it appears
 * Shown: appraised value (Government Value, display only); the assessed
 * value is Georgia's 40% of it (checked on sample parcels) and not shown.
 * Not shown: sales (no prices in these layers).
 */
import { arcQuery, arcQueryHedged, canon, splitStreet, structuredEvidence } from "./_structured.js";

const B = "https://services2.arcgis.com/IxVN2oUE9EYLSnPE/arcgis/rest/services/";
const TAX_LAYER = B + "Tax_Parcels_2025/FeatureServer/0";

const C = {
  name: "DeKalb County Tax Assessors",
  source: "DeKalb County Tax Assessors (DeKalb County GIS: Parcels + Tax Parcels 2025)",
  sourceUrl: "https://www.dekalbcountyga.gov/property-appraisal/welcome-property-appraisal-department",
  valueLabel: "appraised value (land + building)",
  note: "Georgia taxes 40% of this value; sales are not in these layers.",
  find: async ({ num, name, h }) => {
    const ps = await arcQuery(h, B + "Parcels/FeatureServer/0", `ADDRESS_NU=${num} AND UPPER(FULL_STREE) LIKE '%${h.escapeSql(name)}%'`, "PARCELID,FULL_STREE,UNIT_NO,CITY,ZIP,CLASSDSCRP", 5000);
    const rows = ps.map((p) => ({ p, st: splitStreet(h.s(p.FULL_STREE).toUpperCase().split(/\s+/).map(canon).join(" ")) })).filter((x) => x.st.name === name);
    if (!rows.length || rows.length > 30) return [];
    const vs = await arcQueryHedged(h, TAX_LAYER, `ParcelID IN (${rows.map((x) => `'${h.escapeSql(h.s(x.p.PARCELID))}'`).join(",")})`, "ParcelID,TAXYR,APPRAISED_VALUE", 5000);
    return rows.map(({ p, st }) => { const v = vs.filter((x) => h.s(x.ParcelID) === h.s(p.PARCELID)); return { id: p.PARCELID, zip: p.ZIP, town: p.CITY, dir: st.dir, type: st.type, post: st.post, unit: p.UNIT_NO, value: v.length === 1 ? v[0].APPRAISED_VALUE : null, year: v.length === 1 ? v[0].TAXYR : null }; });
  }
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "13089";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
