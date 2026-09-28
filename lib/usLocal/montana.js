/* PRADIXIUM™ — Montana statewide: "Montana Cadastral Framework" (Montana
 * State Library; parcel values from the Montana Department of Revenue's
 * property records, all 56 counties). Shown: the DOR total appraised value
 * (land + buildings) for the layer's tax year, as Government Value,
 * display only. Montana appraises residential and commercial property at
 * market value; agricultural and forest land are valued on productivity,
 * so a farm parcel's figure is not a market value (said in the text). Not
 * shown: sales (Montana is a non-disclosure state), owner names (never
 * requested). Matching: the shared structured matcher (number + street,
 * ZIP or town).
 */
import { arcQuery, splitStreet, structuredEvidence } from "./_structured.js";

const URL = "https://services.arcgis.com/qnjIrwR8z5Izc0ij/arcgis/rest/services/Montana_Cadastral_Framework/FeatureServer/1";

const CONFIG = {
  name: "Montana Department of Revenue", source: "Montana Cadastral Framework (Montana State Library, Department of Revenue property records)",
  sourceUrl: "https://msl.mt.gov/geoinfo/msdi/cadastral/",
  valueLabel: "total appraised value (land + buildings)",
  note: "Montana appraises homes at market value; agricultural and forest land are valued on productivity, not market. Sales are not public in Montana.",
  find: ({ num, name, h }) => arcQuery(h, URL,
    `AddressLine1 LIKE '${num} %${h.escapeSql(name)}%'`, "PARCELID,TaxYear,AddressLine1,AddressLine2,CityStateZip,PropType,TotalValue")
    .then((rs) => rs.map((r) => {
      const m = h.s(r.AddressLine1).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
      const st = m ? splitStreet(m[2]) : null;
      const csz = h.s(r.CityStateZip).toUpperCase().match(/^(.*?),\s*MT\s*(\d{5})?/) || [];
      return st && m[1] === num && st.name === name ? { id: r.PARCELID, zip: csz[2] || "", town: h.s(csz[1]), dir: st.dir, type: st.type, post: st.post, unit: m[3] || h.s(r.AddressLine2).replace(/^(UNIT|APT|STE|#)\s*/i, ""), value: r.TotalValue, year: r.TaxYear, use: h.s(r.PropType) } : null;
    }).filter(Boolean))
};

export function matches(geo) {
  return geo?.stateCode === "MT";
}

export function evidence(ctx) {
  return structuredEvidence(CONFIG, ctx);
}
