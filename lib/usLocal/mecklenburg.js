/* PRADIXIUM™ — Charlotte core: Mecklenburg County, NC (Mecklenburg County
 * GIS — TaxParcel_camadata, the Assessor's CAMA extract)
 * Property facts only: heated area, bedrooms, full baths, year built,
 * neighborhood, and the current tax-year total value (Government Value,
 * display only). Not used:
 *  - sales: the sale-validity codes (A, C, X, TEMP …) have no published
 *    definition we could verify, and sale prices read 0 even on warranty
 *    deeds in this extract — so no sale is shown rather than a wrong one;
 *  - the "city"/"zipcode" fields: they are the owner's MAILING address —
 *    matching uses street number + street name + situs city (loccity).
 */
const URL = "https://meckgis.mecklenburgcountync.gov/server/rest/services/TaxParcel_camadata/FeatureServer/0/query";
const SOURCE = "Mecklenburg County Assessor — CAMA data (Mecklenburg County GIS)";
const SOURCE_URL = "https://cao.mecknc.gov/";
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "37119";
}

export async function evidence({ geo, h }) {
  const parts0 = h.s(geo?.matchedAddress).split(",");
  const w = parts0[0].toUpperCase().split(/\s+/), city = h.s(parts0[1]).toUpperCase();
  const number = /^\d+$/.test(w[0] || "") ? w.shift() : null;
  if (DIRS.has(w[0]) && w.length > 1) w.shift();
  if (!number || !w.length || !city) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `streetnumber='${h.escapeSql(number)}' AND streetname LIKE '${h.escapeSql(w[0])}%' AND loccity='${h.escapeSql(city)}'`,
    outFields: "pid,address,streetname,yearid,totalvalue,heatedarea,bedrooms,fullbath,yearbuilt,neighbordesc,condo_town_flag",
    returnGeometry: "false", f: "json"
  }), 7000).catch(() => null);
  const want = w.length > 1 ? w.slice(0, -1).join(" ") : w[0];
  const rows = (j?.features || []).map((f) => f.attributes).filter((r) => h.s(r.streetname).toUpperCase().startsWith(want + " ") || h.s(r.streetname).toUpperCase() === want);
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Mecklenburg County Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.totalvalue) > 0 ? Number(r.totalvalue) : null, year = r.yearid ? String(r.yearid) : null;
  const property = { livingAreaSqFt: Number(r.heatedarea) > 0 ? Number(r.heatedarea) : null, bedrooms: Number(r.bedrooms) > 0 ? Number(r.bedrooms) : null, bathrooms: Number(r.fullbath) > 0 ? Number(r.fullbath) : null, yearBuilt: Number(r.yearbuilt) > 0 ? Number(r.yearbuilt) : null };
  const facts = [property.livingAreaSqFt && `${property.livingAreaSqFt.toLocaleString("en-US")} sq ft heated`, property.bedrooms && `${property.bedrooms} bd`, property.bathrooms && `${property.bathrooms} ba`, property.yearBuilt && `built ${property.yearBuilt}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Mecklenburg County Assessor parcel ${h.s(r.pid)}${h.s(r.neighbordesc) ? ` (${h.s(r.neighbordesc).toLowerCase()})` : ""}${facts ? `: ${facts}` : ""}${value ? `; tax-year ${year} total value ${usd(value)}` : ""}. Sales are not shown: the county's sale-validity codes are not published with definitions we could verify.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `Mecklenburg County tax-year ${year} value` } : null,
    location: null, property, checks: [], hasRecord: true
  };
}
