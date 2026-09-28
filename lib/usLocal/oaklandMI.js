/* PRADIXIUM™ — Oakland County, MI (FIPS 26125): Oakland County
 * "Tax Parcel Plus" (Enterprise Open Parcel Data map service, layer 1).
 * Shown: the assessed value and the true cash value it implies — Michigan
 * law assesses property at 50% of true cash value (MCL 211.27a), so the
 * true cash value is exactly twice the assessed value; that is the
 * Government Value, display only, labelled as derived. Taxable value
 * (capped) is not a market figure and is not shown. Beds, baths, living
 * area from the same record. Not shown: sales (none in this layer).
 */
import { arcQuery, splitStreet, structuredEvidence } from "./_structured.js";

const C = {
  name: "Oakland County Equalization",
  source: "Oakland County, Michigan — Tax Parcel Plus (county open parcel data)",
  sourceUrl: "https://www.oakgov.com/government/equalization",
  valueLabel: "true cash value (2 × the assessed value; Michigan assesses at 50% of true cash value)",
  note: "Sales are not in this layer.",
  find: ({ num, name, h }) => arcQuery(h, "https://gisservices.oakgov.com/arcgis/rest/services/Enterprise/EnterpriseOpenParcelDataMapService/MapServer/1",
    `SITEADDRESS LIKE '${num} %${h.escapeSql(name)}%'`, "PIN,SITEADDRESS,SITECITY,SITEZIP5,ASSESSEDVALUE,NUM_BEDS,NUM_BATHS,STRUCTURE_DESC,LIVING_AREA_SQFT")
    .then((rs) => rs.map((r) => {
      const m = h.s(r.SITEADDRESS).toUpperCase().match(/^(\d+)\s+(.*?)(?:\s+(?:UNIT|APT|STE|BLDG|#)\s*(.+))?$/);
      if (!m || m[1] !== num) return null;
      const st = splitStreet(m[2]);
      return st.name === name ? { id: r.PIN, zip: r.SITEZIP5, town: r.SITECITY, dir: st.dir, type: st.type, post: st.post, unit: m[3] || null, value: Number(r.ASSESSEDVALUE) > 0 ? 2 * Number(r.ASSESSEDVALUE) : null, beds: r.NUM_BEDS, baths: r.NUM_BATHS, area: r.LIVING_AREA_SQFT, use: r.STRUCTURE_DESC, areaText: Number(r.ASSESSEDVALUE) > 0 ? `assessed value $${Number(r.ASSESSEDVALUE).toLocaleString("en-US")}` : null } : null;
    }).filter(Boolean))
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "26125";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
