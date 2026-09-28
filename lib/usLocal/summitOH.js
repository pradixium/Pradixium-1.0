/* PRADIXIUM™ — Summit County, OH (FIPS 39153; Akron) — Summit County
 * Fiscal Office GIS, "Tax Parcel Sales" (parcels_cama): the Fiscal
 * Office's current market value per parcel, residential floor area, year
 * built, taxing jurisdiction.
 * Shown: current market value as Government Value (display only; the
 * layer names no tax year), living area, year built. Not shown: sales —
 * the layer's sale type codes are not documented and the separate
 * "Parcel Sales" table stops in 2020.
 */
import { arcQuery, splitStreet, structuredEvidence } from "./_structured.js";

const C = {
  name: "Summit County Fiscal Office",
  source: "Summit County Fiscal Office (Summit County GIS, parcels CAMA)",
  sourceUrl: "https://fiscaloffice.summitoh.net/",
  valueLabel: "current market value (the layer names no tax year)",
  note: "Sales are not shown: the layer's sale codes are not documented.",
  find: ({ num, name, h }) => arcQuery(h, "https://scgis.summitoh.net/hosted/rest/services/parcels_cama/Tax_Parcel_Sales/FeatureServer/0",
    `fulladdr LIKE '${num} %${h.escapeSql(name)}%'`, "parcelid,fulladdr,cvttxdscrp,cntmktvalue,resflrarea,resyrblt")
    .then((rs) => rs.map((r) => {
      const m = h.s(r.fulladdr).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:#|UNIT|APT|STE)\s*(\S+))?$/);
      if (!m || m[1] !== num) return null;
      const st = splitStreet(m[2]);
      // cvttxdscrp is the taxing jurisdiction (city/village/township) — used as the town
      return st.name === name ? { id: r.parcelid, zip: "", town: h.s(r.cvttxdscrp).replace(/\s+(CITY|TWP|TOWNSHIP|VILLAGE|VLG)$/i, ""), dir: st.dir, type: st.type, post: st.post, unit: m[3] || null, value: r.cntmktvalue, area: r.resflrarea, built: r.resyrblt } : null;
    }).filter(Boolean))
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "39153";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
