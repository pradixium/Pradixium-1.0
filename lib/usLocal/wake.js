/* PRADIXIUM™ — Raleigh core: Wake County, NC (FIPS 37183) — Wake County
 * Revenue Department parcels (maps.wakegov.com, Property/Parcels)
 * Shown: total assessed value (Government Value, display only), heated
 * area (living area), year built, use. Not shown: sales — the parcel's
 * total sale price carries no arm's-length/validity code.
 */
const URL = "https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0/query";
const SOURCE = "Wake County Department of Tax Administration (Wake County GIS)";
const SOURCE_URL = "https://www.wake.gov/departments-government/tax-administration";
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "37183";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const type = w.length > 1 ? w[w.length - 1] : "";
  const name = w.length > 1 ? w.slice(0, -1).join(" ") : w[0];
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `STNUM=${Number(a.number)} AND STNAME='${h.escapeSql(name)}'`,
    outFields: "REID,PIN_NUM,STPRE,STYPE,STMISC,SITE_ADDRESS,TOTAL_VALUE_ASSD,HEATEDAREA,YEAR_BUILT,TYPE_USE_DECODE,CITY_DECODE",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => (!dir || !h.s(r.STPRE) || h.s(r.STPRE) === dir) && (!type || !h.s(r.STYPE) || h.s(r.STYPE) === type || h.s(r.STYPE).startsWith(type.slice(0, 2))));
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(h.s(r.STMISC).replace(/^(UNIT|APT|#)\s*/i, "")) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.STMISC));
  if (rows.length > 1) { const city = h.s(geo?.matchedAddress).split(",")[1]?.trim().toUpperCase(); if (city) rows = rows.filter((r) => h.s(r.CITY_DECODE).toUpperCase() === city); }
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Wake County: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.TOTAL_VALUE_ASSD) > 0 ? Number(r.TOTAL_VALUE_ASSD) : null;
  const la = Number(r.HEATEDAREA) > 0 ? Number(r.HEATEDAREA) : null, yb = Number(r.YEAR_BUILT) > 0 ? Number(r.YEAR_BUILT) : null;
  const facts = [h.s(r.TYPE_USE_DECODE).toLowerCase().replace(/^singlfam$/, "single-family"), la && `${la.toLocaleString("en-US")} sq ft heated`, yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Wake County parcel ${h.s(r.REID)}${facts ? ` (${facts})` : ""}${value ? `: assessed value ${usd(value)}` : ""}. Sales are not shown: the parcel's sale price carries no arm's-length code.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: "Wake County assessed value" } : null,
    location: null, property: { livingAreaSqFt: la, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
