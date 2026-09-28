/* PRADIXIUM™ — Wisconsin, statewide (all 72 counties) — Wisconsin Statewide
 * Parcel Map, Version 12 (Wisconsin DOA / State Cartographer's Office,
 * "V1200_WisconsinParcels_2026", aggregated from county/municipal rolls)
 * Shown: estimated fair market value for the tax-roll year (Government
 * Value, display only), assessed value, and net property tax (official
 * check). No sales in this dataset. Owner names are never requested.
 * The City of Milwaukee has its own daily MPROP module, tried first.
 */
const URL = "https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels_DB/FeatureServer/0/query";
const SOURCE = "Wisconsin Statewide Parcel Map V12 (local assessment rolls)";
const SOURCE_URL = "https://www.sco.wisc.edu/parcels/";
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return geo?.stateCode === "WI";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  const county = h.s(geo?.county).replace(/ County$/i, "").toUpperCase();
  if (!a || !county) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const type = w.length > 1 ? w.pop() : "";
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `CONAME='${h.escapeSql(county)}' AND ADDNUM='${h.escapeSql(a.number)}' AND STREETNAME='${h.escapeSql(w.join(" "))}'`,
    outFields: "STATEID,TAXROLLYEAR,PREFIX,STREETTYPE,UNITID,PLACENAME,ZIPCODE,CNTASSDVALUE,ESTFMKVALUE,NETPRPTA,PROPCLASS",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  // the roll writes street types in full ("LANE"), the geocoder abbreviates ("LN"): used only to break ties
  const ABBR = { AVENUE: "AVE", STREET: "ST", ROAD: "RD", DRIVE: "DR", LANE: "LN", COURT: "CT", PLACE: "PL", BOULEVARD: "BLVD", CIRCLE: "CIR", TERRACE: "TER", PARKWAY: "PKWY", TRAIL: "TRL", HIGHWAY: "HWY", WAY: "WAY" };
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => !dir || !h.s(r.PREFIX) || h.s(r.PREFIX).toUpperCase() === dir);
  if (rows.length > 1 && type) rows = rows.filter((r) => { const t = h.s(r.STREETTYPE).toUpperCase(); return !t || t === type || ABBR[t] === type; });
  const z = h.s(geo?.matchedAddress).match(/(\d{5})\s*$/)?.[1];
  if (rows.length > 1 && z) rows = rows.filter((r) => !h.s(r.ZIPCODE) || h.s(r.ZIPCODE).startsWith(z));
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.UNITID) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.UNITID));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Wisconsin statewide parcel map: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const fmv = Number(r.ESTFMKVALUE) > 0 ? Number(r.ESTFMKVALUE) : null, av = Number(r.CNTASSDVALUE) > 0 ? Number(r.CNTASSDVALUE) : null, tax = Number(r.NETPRPTA) > 0 ? Number(r.NETPRPTA) : null;
  const year = h.s(r.TAXROLLYEAR) || null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Wisconsin parcel ${h.s(r.STATEID)}${h.s(r.PLACENAME) ? ` (${h.s(r.PLACENAME).toLowerCase()})` : ""}${fmv ? `: ${year ? year + " " : ""}estimated fair market value ${usd(fmv)}` : ""}${av ? `; assessed value ${usd(av)}` : ""}${tax ? `; net property tax ${usd(tax)}` : ""} (Wisconsin statewide parcel map, local assessment roll).`,
    lastSale: null, benchmark: null,
    governmentValue: fmv ? { value: fmv, asOf: year, label: `Wisconsin ${year ? year + " " : ""}estimated fair market value` } : null,
    location: null, property: null,
    checks: tax ? [{ id: "propertyTax", label: `Property tax (${year || "latest"} roll, net)`, value: usd(tax), level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" }] : [],
    hasRecord: true
  };
}
