/* PRADIXIUM™ — Gwinnett County, GA (FIPS 13135): Gwinnett County GIS
 * "Property and Tax" — Tax Master Table (layer 3), the Tax Assessors'
 * values per parcel.
 * Shown: TOTVAL1 (land + dwelling/improvement value) as Government Value,
 * display only. TAXTOT1 is exactly 40% of it on sampled parcels (Georgia
 * assesses at 40% of fair market value), so it is the assessed figure and
 * is not shown. The layer names no tax year. Not shown: sales (the table
 * has deed references only, no prices).
 */
import { arcQuery, splitStreet, structuredEvidence } from "./_structured.js";

const C = {
  name: "Gwinnett County Tax Assessors",
  source: "Gwinnett County Tax Assessors (Gwinnett County GIS, Property and Tax)",
  sourceUrl: "https://www.gwinnettcounty.com/departments/financialservices/taxassessorsoffice",
  valueLabel: "appraised value (land + improvements; the layer names no tax year)",
  note: "Georgia taxes 40% of this value; sales are not in this layer.",
  find: ({ num, name, h }) => arcQuery(h, "https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer/3",
    `STRNUM=${num} AND STRNAME LIKE '${h.escapeSql(name)}%'`, "PIN,LOCADDR,LOCCITY,LOCZIP,STRNAME,TOTVAL1,PCDESC")
    .then((rs) => rs.map((r) => {
      // STRNAME carries the full street ("SWEETWATER RD", "… Bldg C100", "… Unit 5")
      const m = h.s(r.STRNAME).toUpperCase().match(/^(.*?)(?:\s+(?:UNIT|UN|APT|STE|BLDG|#)\s*(.+))?$/);
      const st = splitStreet(m[1]);
      return st.name === name ? { id: r.PIN, zip: r.LOCZIP, town: r.LOCCITY, dir: st.dir, type: st.type, post: st.post, unit: m[2] || null, value: r.TOTVAL1, use: r.PCDESC } : null;
    }).filter(Boolean))
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "13135";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
