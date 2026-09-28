/* PRADIXIUM™ — Denver-metro counties outside Denver (which has its own
 * module), each from its own assessor's open data:
 *  - Arapahoe (08005): Arapahoe County "OpenDataService" Parcels —
 *    appraised (actual) value, structured situs address. The layer's
 *    Sale_Date/Price carry no validity code → not shown.
 *  - Adams (08001): Adams County "Parcels" (situs address → parcel number)
 *    joined to its "Property Values" table — actual total value (land +
 *    improvements), account type.
 *  - Jefferson (08059): county GIS Parcel layer — sum of the parcel's
 *    tax-class actual values, year built, structure type
 *  - Douglas (08035): county open data Property Location → Property
 *    Values (sum of the account's valuation-class actual values)
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
  },
  "08059": {
    name: "Jefferson County Assessor", source: "Jefferson County, Colorado Assessor (county GIS parcels)",
    sourceUrl: "https://www.jeffco.us/assessor",
    valueLabel: "actual value (all tax classes on the parcel)", note: "",
    // one parcel carries up to six tax-class values (land, improvements …): the actual value is their sum
    find: ({ num, name, h }) => arcQuery(h, "https://gisportal.jeffco.us/server2/rest/services/Parcel/FeatureServer/20",
      `PRPSTRNUM IN ('${num}','${num.padStart(5, "0")}') AND PRPSTRNAM='${h.escapeSql(name)}'`, "PIN,PRPSTRDIR,PRPSTRTYP,PRPSTRSFX,PRPSTRUNT,PRPCTYNAM,PRPZIP5,VALACT,VALACT2,VALACT3,VALACT4,VALACT5,VALACT6,STTYRBLT,STTTYPUSE")
      .then((rs) => rs.map((r) => ({ id: r.PIN, zip: r.PRPZIP5, town: r.PRPCTYNAM, dir: r.PRPSTRDIR, type: r.PRPSTRTYP, post: r.PRPSTRSFX, unit: r.PRPSTRUNT, value: ["VALACT", "VALACT2", "VALACT3", "VALACT4", "VALACT5", "VALACT6"].reduce((t, k) => t + (Number(r[k]) || 0), 0), built: r.STTYRBLT, use: r.STTTYPUSE })))
  },
  "08035": {
    name: "Douglas County Assessor", source: "Douglas County, Colorado Assessor (county open data: locations + values)",
    sourceUrl: "https://www.douglas.co.us/assessor/",
    valueLabel: "actual value (all valuation classes on the account)", note: "", idLabel: "account",
    find: async ({ num, name, h }) => {
      const B = "https://services.arcgis.com/seTexOicoRXDvRsJ/arcgis/rest/services/OpenData/FeatureServer/";
      const ls = await arcQuery(h, B + "5", `ADDRESS_NUMBER='${num}' AND STREET_NAME='${h.escapeSql(name)}'`, "ACCOUNT_NO,ACCOUNT_TYPE_CODE,PRE_DIRECTION_CODE,STREET_TYPE_CODE,UNIT_NO,LOCATION_ZIP_CODE,CITY_NAME", 5000);
      if (!ls.length || ls.length > 50) return [];
      const vs = await arcQuery(h, B + "4", `ACCOUNT_NO IN (${ls.map((l) => `'${h.escapeSql(l.ACCOUNT_NO)}'`).join(",")})`, "ACCOUNT_NO,ACTUAL_VALUE", 5000);
      return ls.map((l) => ({ id: l.ACCOUNT_NO, zip: l.LOCATION_ZIP_CODE, town: l.CITY_NAME, dir: l.PRE_DIRECTION_CODE, type: l.STREET_TYPE_CODE, unit: l.UNIT_NO, value: vs.filter((v) => v.ACCOUNT_NO === l.ACCOUNT_NO).reduce((t, v) => t + (Number(v.ACTUAL_VALUE) || 0), 0), use: l.ACCOUNT_TYPE_CODE }));
    }
  }
};

export function matches(geo) {
  return Boolean(COUNTIES[String(geo?.countyFips || "")]);
}

export async function evidence(ctx) {
  return structuredEvidence(COUNTIES[String(ctx.geo.countyFips)], ctx);
}
