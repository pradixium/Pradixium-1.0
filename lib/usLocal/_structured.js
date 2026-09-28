/* PRADIXIUM™ — shared matcher for official parcel layers that carry a
 * structured situs address (number / street name / type / direction / unit /
 * ZIP / town). Each source module supplies its query + a row mapper; this
 * file applies the same matching rules everywhere:
 *  - house number + street name must match; direction and street type must
 *    agree whenever both sides carry one
 *  - the parcel's ZIP OR town must match the geocoded address (the Census
 *    geocoder's ZIP can differ from the assessor's situs ZIP); the ZIP then
 *    separates same-named streets in different towns
 *  - a unit in the address must match the parcel's unit; without one, only
 *    a single un-united parcel counts, else "add the unit number"
 * Mapped row: { id, zip, town (string or list), dir, type, post, unit, value, year, area, areaText,
 *   beds, baths, built, use }
 */
export const DIRS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
export const TYPES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "TER", "HWY", "SQ", "PT", "ROW", "CV", "PLZ", "RDG", "XING", "LOOP", "WALK", "GLN", "CYN", "HTS", "MNR", "PATH", "RUN", "VW", "VIS", "TRCE", "BND", "HOLW", "KNL", "SPUR", "PASS", "GRN", "CRES", "EXT", "FWY", "PIKE", "TPKE", "ALY", "STA"]);

// spelled-out street types / directions some layers use → USPS abbreviations
const ABBR = { AVENUE: "AVE", STREET: "ST", ROAD: "RD", DRIVE: "DR", LANE: "LN", BOULEVARD: "BLVD", COURT: "CT", PLACE: "PL", PARKWAY: "PKWY", CIRCLE: "CIR", TRAIL: "TRL", TERRACE: "TER", HIGHWAY: "HWY", SQUARE: "SQ", POINT: "PT", COVE: "CV", PLAZA: "PLZ", RIDGE: "RDG", CROSSING: "XING", GLEN: "GLN", CANYON: "CYN", HEIGHTS: "HTS", MANOR: "MNR", VIEW: "VW", VISTA: "VIS", TRACE: "TRCE", BEND: "BND", HOLLOW: "HOLW", KNOLL: "KNL", GREEN: "GRN", CRESCENT: "CRES", EXTENSION: "EXT", FREEWAY: "FWY", TURNPIKE: "TPKE", ALLEY: "ALY", STATION: "STA", AV: "AVE", NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W", NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW" };
export const canon = (x) => { const u = String(x ?? "").trim().toUpperCase().replace(/\.$/, ""); return ABBR[u] || u; };

export function splitStreet(street) {
  const w = String(street || "").toUpperCase().replace(/[.,]/g, " ").trim().split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const post = w.length > 2 && DIRS.has(w[w.length - 1]) ? w.pop() : "";
  // a spelled-out type ("STATION") counts as its USPS abbreviation
  const last = ABBR[w[w.length - 1]] || w[w.length - 1];
  const type = w.length > 1 && TYPES.has(last) ? (w.pop(), last) : "";
  return { dir, type, post, name: w.join(" ") };
}

export const arcQuery = (h, url, where, outFields, ms = 6000) => h.json(url + "/query?" + new URLSearchParams({ where, outFields, returnGeometry: "false", f: "json" }), ms)
  .then((j) => (j?.features || []).map((f) => f.attributes)).catch(() => []);

// some hosted layers stall on a cold start: if the first request has not
// answered after `hedgeMs`, send a second one and take whichever returns first
export function arcQueryHedged(h, url, where, outFields, ms = 6000, hedgeMs = 2000) {
  const once = () => h.json(url + "/query?" + new URLSearchParams({ where, outFields, returnGeometry: "false", f: "json" }), ms)
    .then((j) => { if (!j || j.error) throw new Error("bad"); return (j.features || []).map((f) => f.attributes); });
  const second = new Promise((r) => setTimeout(r, hedgeMs)).then(once);
  return Promise.any([once(), second]).catch(() => []);
}

// same, limited to features within `meters` of the geocoded point (for
// layers whose situs address has no city/ZIP)
export const arcQueryNear = (h, url, where, outFields, geo, meters = 250, ms = 6000) => Number.isFinite(Number(geo?.latitude)) && Number.isFinite(Number(geo?.longitude))
  ? h.json(url + "/query?" + new URLSearchParams({ where, outFields, geometry: `${geo.longitude},${geo.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: String(meters), units: "esriSRUnit_Meter", returnGeometry: "false", f: "json" }), ms)
    .then((j) => (j?.features || []).map((f) => f.attributes)).catch(() => [])
  : Promise.resolve([]);

const up = (x) => String(x ?? "").trim().toUpperCase();

export async function structuredEvidence(c, { geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a) return null;
  const st = splitStreet(a.street);
  if (!st.name) return null;
  let rows = (await c.find({ num: String(Number(a.number)), ...st, h, geo })) || [];
  rows = rows.filter((r) => (!st.dir || !up(r.dir) || canon(r.dir) === st.dir) && (!st.type || !up(r.type) || canon(r.type) === canon(st.type)) && (!st.post || !up(r.post) || canon(r.post) === st.post));
  const town = up(geo?.city).replace(/\s+(CITY|CDP|TOWN|VILLAGE|BOROUGH)$/, "");
  const zipOk = (r) => z && up(r.zip).slice(0, 5) === z.zip;
  if (!c.spatial) rows = rows.filter((r) => zipOk(r) || (town && [].concat(r.town).some((t) => up(t).replace(/^SAINT /, "ST. ").replace(/^ST /, "ST. ") === town.replace(/^SAINT /, "ST. ").replace(/^ST /, "ST. "))));
  if (rows.length > 1 && rows.some(zipOk)) rows = rows.filter(zipOk);
  const unit = h.unitFromAddress(address), found = rows.length;
  if (unit) rows = rows.filter((r) => h.unitKey(r.unit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.unit));
  if (rows.length !== 1) return rows.length > 1 || (!unit && found > 1) ? { source: c.source, sourceUrl: c.sourceUrl, summary: `${c.name}: several parcels at this address — add the unit number.`, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US"), pos = (x) => (Number(x) > 0 ? Number(x) : null);
  const value = pos(r.value), area = pos(r.area), beds = pos(r.beds), baths = pos(r.baths), built = pos(r.built);
  const year = value && r.year ? String(r.year) : null;
  const facts = [r.use && String(r.use).toLowerCase(), area && `${area.toLocaleString("en-US")} sq ft living`, r.areaText, beds && `${beds} bd`, baths && `${baths} ba`, built && `built ${built}`].filter(Boolean).join(", ");
  const label = `${c.name} ${year ? year + " " : ""}${c.valueLabel}`;
  return {
    source: c.source, sourceUrl: c.sourceUrl,
    summary: `${c.name} ${c.idLabel || "parcel"} ${h.s(r.id)}${facts ? ` (${facts})` : ""}${value ? `: ${year ? year + " " : ""}${c.valueLabel} ${usd(value)}` : ""}.${r.sale ? ` Last sale ${usd(r.sale.price)} on ${r.sale.date} (${r.sale.label}).` : ""}${c.note ? " " + c.note : ""}`,
    lastSale: r.sale ? { price: r.sale.price, date: r.sale.date, source: `${c.source} — ${r.sale.label}` } : null, benchmark: null,
    governmentValue: value && !c.textOnly ? { value, asOf: year, label } : null,
    location: null,
    property: { livingAreaSqFt: area, yearBuilt: built, bedrooms: beds, bathrooms: baths },
    checks: [], hasRecord: true
  };
}
