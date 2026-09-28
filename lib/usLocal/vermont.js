/* PRADIXIUM™ — Vermont, statewide — VCGI "Statewide Standardized Parcel
 * Data" (parcel polygons joined to each town's Grand List)
 * Shown: the Grand List real-estate listed value with its year (Government
 * Value, display only — towns are reappraised on different cycles, so a
 * listed value can trail the market). No sales in this dataset. Owner
 * names are never requested.
 */
const URL = "https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0/query";
const SOURCE = "Vermont Grand List via VCGI statewide standardized parcels";
const SOURCE_URL = "https://vcgi.vermont.gov/";

export function matches(geo) {
  return geo?.stateCode === "VT";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `UPPER(E911ADDR) LIKE '${h.escapeSql(`${a.number} ${a.street}`)}%'`,
    outFields: "SPAN,TNAME,E911ADDR,DESCPROP,CAT,REAL_FLV,GLYEAR",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  const line = `${a.number} ${a.street}`;
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const s = h.s(r.E911ADDR).toUpperCase(); return s === line || s.startsWith(line + ","); });
  rows = rows.filter((r, i) => rows.findIndex((x) => h.s(x.SPAN) === h.s(r.SPAN)) === i);
  const city = h.s(geo?.matchedAddress).split(",")[1]?.trim().toUpperCase();
  if (rows.length > 1 && city) rows = rows.filter((r) => h.s(r.TNAME).toUpperCase() === city);
  if (rows.length !== 1 || h.unitFromAddress(address)) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Vermont Grand List: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.REAL_FLV) > 0 ? Number(r.REAL_FLV) : null, year = r.GLYEAR ? String(r.GLYEAR) : null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `${h.s(r.TNAME)} Grand List parcel ${h.s(r.SPAN)}${value ? `: ${year ? year + " " : ""}listed value ${usd(value)}` : ""} (towns are reappraised on different cycles).`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `${h.s(r.TNAME)} ${year ? year + " " : ""}Grand List value` } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
