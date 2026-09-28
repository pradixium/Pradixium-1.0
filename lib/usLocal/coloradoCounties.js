/* PRADIXIUM™ — Denver-metro counties outside Denver (which has its own
 * module), each from its own assessor's open data:
 *  - Arapahoe (08005): Arapahoe County "OpenDataService" Parcels —
 *    appraised (actual) value, structured situs address. The layer's
 *    Sale_Date/Price carry no validity code → not shown.
 *  - Adams (08001): Adams County "Parcels" (situs address → parcel number)
 *    joined to its "Property Values" table — actual total value (land +
 *    improvements), account type.
 * Colorado assessors' "actual value" is the market-based value the
 * assessed value is computed from; shown as Government Value, display only.
 */
import { arcQuery, splitStreet, structuredEvidence } from "./_structured.js";

const COUNTIES = {
  "08005": {
    name: "Arapahoe County Assessor", source: "Arapahoe County Assessor (county open data parcels)",
    sourceUrl: "https://www.arapahoeco.gov/your_county/county_departments/assessor/",
    valueLabel: "actual (appraised) value", note: "Sales are not shown: the parcel layer's sale price carries no validity code.",
    find: ({ num, name, h }) => arcQuery(h, "https://gis.arapahoegov.com/arcgis/rest/services/OpenDataService/FeatureServer/0",
      `Addr_NUM='${num}' AND Street='${h.escapeSql(name)}'`, "PIN,Pre_Dir,St_Type,Post_Dir,Unit,City,Zip,Appr_Value")
      .then((rs) => rs.map((r) => ({ id: r.PIN, zip: r.Zip, town: r.City, dir: r.Pre_Dir, type: r.St_Type, post: r.Post_Dir, unit: r.Unit, value: r.Appr_Value })))
  },
  "08001": {
    name: "Adams County Assessor", source: "Adams County Assessor (county open data: Parcels + Property Values)",
    sourceUrl: "https://adcogov.org/assessor",
    valueLabel: "actual value (land + improvements)", note: "",
    find: async ({ num, name, h }) => {
      const B = "https://services3.arcgis.com/4PNQOtAivErR7nbT/arcgis/rest/services/";
      const ps = await arcQuery(h, B + "Parcels/FeatureServer/0", `STREETNO='${num}' AND STREETNAME='${h.escapeSql(name)}'`, "PARCELNB,STREETDIR,STREETSUF,STREETPOSTDIR,STREETALP,LOCCITY,LOCZIP", 5000);
      if (!ps.length || ps.length > 50) return [];
      const vs = await arcQuery(h, B + "Property_Values/FeatureServer/0", `parcelnb IN (${ps.map((p) => `'${h.escapeSql(p.PARCELNB)}'`).join(",")})`, "parcelnb,acttotalval,accttype", 5000);
      return ps.map((p) => { const v = vs.filter((x) => x.parcelnb === p.PARCELNB); return { id: p.PARCELNB, zip: p.LOCZIP, town: p.LOCCITY, dir: p.STREETDIR, type: p.STREETSUF, post: p.STREETPOSTDIR, unit: p.STREETALP, value: v.length === 1 ? v[0].acttotalval : null, use: v.length === 1 ? v[0].accttype : v.length > 1 ? `${v.length} assessor accounts on this parcel, so no single value is shown` : null }; });
    }
  }
};

export function matches(geo) {
  return Boolean(COUNTIES[String(geo?.countyFips || "")]);
}

export async function evidence(ctx) {
  return structuredEvidence(COUNTIES[String(ctx.geo.countyFips)], ctx);
}
