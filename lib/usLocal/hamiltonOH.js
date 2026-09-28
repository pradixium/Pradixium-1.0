/* PRADIXIUM™ — Cincinnati core: Hamilton County, OH (FIPS 39061) — Hamilton
 * County Auditor data published on CAGIS (cagisonline.hamilton-co.org,
 * COUNTYWIDE/AuditorParcelInformation)
 *  - Auditor Parcel Attributes: total market value (Government Value,
 *    display only) and the parcel's annual taxes (actual bill)
 *  - Auditor Building Info: year built; finished sq ft (field LIVE_FSQFT —
 *    no published definition, so text only)
 * Not shown: sales. The layer carries the last sale amount and date, but
 * its "Valid Sale" flag is empty on recent sales, so they are unscreened.
 */
const B = "https://cagisonline.hamilton-co.org/arcgis/rest/services/COUNTYWIDE/AuditorParcelInformation/MapServer/";
const PARCELS = B + "15/query", BLDG = B + "17/query";
const SOURCE = "Hamilton County Auditor (CAGIS)";
const SOURCE_URL = "https://www.hamiltoncountyauditor.org/";
const DIRS = new Set(["N", "S", "E", "W"]);
const TYPES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "TER", "HWY", "SQ", "PT", "RUN", "PIKE", "ROW", "CV", "PLZ", "RDG", "XING", "PASS", "ALY"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "39061";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const type = w.length > 1 && TYPES.has(w[w.length - 1]) ? w.pop() : "";
  const name = w.join(" ");
  const q = (url, params) => h.json(url + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), 6000).catch(() => null);
  const j = await q(PARCELS, { where: `ADDRNO='${h.escapeSql(a.number)}' AND ADDRST='${h.escapeSql(name)}'`, outFields: "PARCELID,ADDRSF,LOC_ST_DIR,UNIT,MKT_TOTAL_VAL,ANNUAL_TAXES,LUCLASS" });
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => (!dir || !h.s(r.LOC_ST_DIR) || h.s(r.LOC_ST_DIR) === dir) && (!type || !h.s(r.ADDRSF) || h.s(r.ADDRSF) === type));
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.UNIT) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.UNIT));
  // the same number + street can exist in several municipalities: keep the parcel at the geocoded point
  if (rows.length > 1 && Number.isFinite(geo?.latitude) && Number.isFinite(geo?.longitude)) {
    const near = await q(PARCELS, { where: `ADDRNO='${h.escapeSql(a.number)}' AND ADDRST='${h.escapeSql(name)}'`, outFields: "PARCELID", geometry: `${geo.longitude},${geo.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: "60", units: "esriSRUnit_Meter" });
    const ids = new Set((near?.features || []).map((f) => h.s(f.attributes.PARCELID)));
    if (ids.size) rows = rows.filter((r) => ids.has(h.s(r.PARCELID)));
  }
  if (rows.length !== 1) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Hamilton County Auditor: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;

  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const b = await q(BLDG, { where: `PARCELID='${h.escapeSql(r.PARCELID)}'`, outFields: "YEARBUILT,LIVE_FSQFT" });
  const bl = (b?.features || []).map((f) => f.attributes);
  const b0 = bl.length === 1 ? bl[0] : null;
  const yb = Number(b0?.YEARBUILT) > 0 ? Number(b0.YEARBUILT) : null;
  const value = Number(r.MKT_TOTAL_VAL) > 0 ? Number(r.MKT_TOTAL_VAL) : null;
  const tax = Number(r.ANNUAL_TAXES) > 0 ? Number(r.ANNUAL_TAXES) : null;
  const facts = [Number(b0?.LIVE_FSQFT) > 0 && `${Number(b0.LIVE_FSQFT).toLocaleString("en-US")} finished sq ft (Auditor)`, yb && `built ${yb}`].filter(Boolean).join(", ");
  const checks = tax ? [{ id: "propertyTax", label: "Property tax (annual, Auditor)", value: usd(tax), level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" }] : [];
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Hamilton County Auditor parcel ${h.s(r.PARCELID)}${facts ? ` (${facts})` : ""}${value ? `: market value ${usd(value)}` : ""}${tax ? `; annual taxes ${usd(tax)}` : ""}. Sales are not shown: the Auditor's "valid sale" flag is not filled in on recent sales.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: "Hamilton County Auditor market value" } : null,
    location: null,
    property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks, hasRecord: true
  };
}
