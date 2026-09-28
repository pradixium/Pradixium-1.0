/* PRADIXIUM™ — Washoe County, NV (FIPS 32031; Reno) — Washoe County
 * Assessor "Parcel Pts" (Assessor_ParcelCentroid): tax-year taxable value,
 * beds, baths, year built, building sq ft, structured situs address.
 * Nevada's taxable value is statutory, not market value (NRS 361.227: land
 * at full cash value + improvements at replacement cost less depreciation);
 * the assessed value is 35% of it (checked on sample parcels). So the value
 * is shown in the TEXT only, labelled as such — never as Government Value.
 * The layer's sale price has no validity code → not shown.
 */
import { arcQuery, structuredEvidence } from "./_structured.js";

const C = {
  name: "Washoe County Assessor",
  source: "Washoe County Assessor (Washoe County GIS parcel points)",
  sourceUrl: "https://www.washoecounty.gov/assessor/",
  valueLabel: "taxable value",
  note: "Nevada's taxable value is statutory (land plus improvements at replacement cost less depreciation), not market value. Sales are not shown: the parcel record's sale price carries no validity code.",
  textOnly: true,
  find: ({ num, name, h }) => arcQuery(h, "https://wcgisweb.washoecounty.us/arcgis/rest/services/Assessor/Assessor_ParcelCentroid/MapServer/0",
    `STREETNUM='${num}' AND STREET LIKE '${h.escapeSql(name)}%'`, "APN,STREETDIR,STREET,CITY,SITUSZIP,BEDROOMS,BATHS,YEARBLT,SQFEET,TOTALAPR,TAXYEAR")
    .then((rs) => rs.map((r) => {
      // STREET carries the name and its type ("KINGS ROW ", "MAIN ST")
      const w = h.s(r.STREET).toUpperCase().split(/\s+/);
      return { id: String(r.APN), zip: h.s(r.SITUSZIP), town: h.s(r.CITY), dir: h.s(r.STREETDIR), w, value: r.TOTALAPR, year: r.TAXYEAR, beds: r.BEDROOMS, baths: r.BATHS, built: r.YEARBLT, areaText: Number(r.SQFEET) > 0 ? `building ${Number(r.SQFEET).toLocaleString("en-US")} sq ft` : null };
    }).filter((r) => r.w.join(" ") === name || r.w.slice(0, -1).join(" ") === name).map((r) => ({ ...r, type: r.w.join(" ") === name ? "" : r.w[r.w.length - 1] })))
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "32031";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
