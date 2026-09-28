/* PRADIXIUM™ — Nashville core: Davidson County, TN (FIPS 47037) — Metro
 * Nashville "Parcels" (Metro Nashville ArcGIS, Assessor of Property data)
 * Shown: the Assessor's total appraisal (Government Value, display only)
 * and land use. Not shown: sales — the layer's sale price has no
 * arm's-length/validity code, so it is not presented as a market sale.
 */
const URL = "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Parcels_view/FeatureServer/0/query";
const SOURCE = "Metro Nashville – Davidson County Assessor of Property (Metro Nashville GIS)";
const SOURCE_URL = "https://www.padctn.org/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "47037";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `PropHouse='${h.escapeSql(a.number)}' AND PropAddr LIKE '${h.escapeSql(`${a.number} ${a.street}`)}%' AND PropZip LIKE '${z.zip}%'`,
    outFields: "ParID,PropAddr,PropSuite,LUDesc,TotlAppr", returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  let rows = (j?.features || []).map((f) => f.attributes);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.PropSuite) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.PropSuite));
  if (rows.length !== 1) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Davidson County Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.TotlAppr) > 0 ? Number(r.TotlAppr) : null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Davidson County Assessor parcel ${h.s(r.ParID)}${h.s(r.LUDesc) ? ` (${h.s(r.LUDesc).toLowerCase()})` : ""}${value ? `: total appraisal ${usd(value)}` : ""}. Sales are not shown: the parcel record's sale price carries no arm's-length code.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: "Davidson County Assessor total appraisal" } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
