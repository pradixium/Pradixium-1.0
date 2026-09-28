/* PRADIXIUM™ — Ada County, ID (FIPS 16001; Boise) — Ada County Assessor
 * "Parcels" (AdaCountyGIS): total value for the property year (Idaho
 * assesses at market value), structured situs address.
 * Shown: total value with its year as Government Value, display only; the
 * homeowner exemption is not subtracted. Not shown: sales (Idaho is a
 * non-disclosure state — no public sale prices).
 */
import { arcQuery, structuredEvidence } from "./_structured.js";

const C = {
  name: "Ada County Assessor",
  source: "Ada County Assessor (Ada County GIS parcels)",
  sourceUrl: "https://adacounty.id.gov/assessor/",
  valueLabel: "total assessed value (market value basis)",
  note: "Idaho does not make sale prices public, so no sale is shown.",
  find: ({ num, name, h }) => arcQuery(h, "https://services2.arcgis.com/dgGjZc6xAH5m5JyP/arcgis/rest/services/Parcels/FeatureServer/5",
    `PROPADDNUM LIKE '${num} %' AND PROPSTNM LIKE '${h.escapeSql(name)} %'`, "PARCEL,PROPYEAR,PROPADDNUM,PROPPREDIR,PROPSTNM,PROPSTTYPE,PROPPOST,PROPUNUM,CITY_STATE,TOTALVALUE")
    .then((rs) => rs.filter((r) => h.s(r.PROPADDNUM) === num && h.s(r.PROPSTNM).toUpperCase() === name).map((r) => {
      const cz = h.s(r.CITY_STATE).match(/^(.*?),\s*ID\s+(\d{5})/);
      return { id: r.PARCEL, zip: cz?.[2] || "", town: cz?.[1] || "", dir: h.s(r.PROPPREDIR), type: h.s(r.PROPSTTYPE), post: h.s(r.PROPPOST), unit: h.s(r.PROPUNUM), value: r.TOTALVALUE, year: r.PROPYEAR };
    }))
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "16001";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
