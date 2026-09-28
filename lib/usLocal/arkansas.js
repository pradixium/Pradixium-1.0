/* PRADIXIUM™ — Arkansas statewide: Arkansas GIS Office "Parcel Polygon —
 * County Assessor Mapping Program" (Planning_Cadastre layer 6), each
 * county's CAMA (assessor) record integrated by AGISO; CAMADate = when the
 * county's data was received.
 * Shown: the assessor's total appraised value (land + improvements) as
 * Government Value, display only. Arkansas assesses at 20% of that value —
 * the layer's AssessValue is exactly 20% of TotalValue (checked on sample
 * parcels, Sept 2026) — so the total, not the 20% figure, is shown.
 * Not shown: sales (none in the layer).
 */
import { arcQuery, structuredEvidence } from "./_structured.js";

const C = {
  name: "Arkansas county assessor",
  source: "Arkansas GIS Office — County Assessor Mapping Program (CAMA parcels)",
  sourceUrl: "https://gis.arkansas.gov/",
  valueLabel: "appraised value (land + improvements)",
  note: "Arkansas assesses property at 20% of this value; sales are not in this layer.",
  find: ({ num, name, h, geo }) => arcQuery(h, "https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6",
    `countyfips='${h.escapeSql(String(geo.countyFips))}' AND adrnum=${num} AND pstrnam='${h.escapeSql(name)}'`,
    "parcelid,predir,pstrtype,adrcity,adrzip5,totalvalue")
    .then((rs) => rs.map((r) => ({ id: r.parcelid, zip: String(r.adrzip5 || ""), town: r.adrcity, dir: r.predir, type: r.pstrtype, unit: null, value: r.totalvalue })))
};

export function matches(geo) {
  return geo?.stateCode === "AR";
}

export async function evidence(ctx) {
  return structuredEvidence(C, ctx);
}
