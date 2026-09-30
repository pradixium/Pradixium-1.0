/* PRADIXIUM™ — Greece: official zone prices (τιμές ζώνης) of the Objective
 * Value System (Σύστημα Αντικειμενικού Προσδιορισμού Αξίας, ΣΑΠΑ),
 * Ministry of Finance / ΑΑΔΕ, as published on the state's own map
 * "Ζώνες τιμών αντικειμενικών αξιών ακινήτων" (maps.gsis.gr/valuemaps).
 *  - ZONES_LATEST layer 1 (ΚΥΚΛΙΚΕΣ ΖΩΝΕΣ): area zones — the base €/m²
 *    for buildings in that block area
 *  - ZONES_LATEST layer 0 (ΓΡΑΜΜΙΚΕΣ ΖΩΝΕΣ): street-frontage zones — a
 *    separate (usually higher) €/m² for buildings facing that street
 * In force since 1 Jan 2022 (last revision 2021, no end date as of
 * Sept 30 2026). A zone price is the TAX BASE the objective value of a
 * building is computed from (× floor, age, frontage coefficients) — not a
 * market price. It is therefore shown as the official record, never as
 * the market benchmark and never multiplied by the size.
 * The ArcGIS server answers only through the map app's own public proxy
 * (valuemaps2/PHP/proxy.php) — the same request the public map makes.
 * Address → point: the Esri World geocoder, the one the ministry's map
 * itself uses (no key, results not stored).
 * Rules: an exact address (point/street address) → the frontage zone of
 * ITS OWN street when one lies within 30 m, else the single area zone
 * within 30 m; two different area prices there (a street dividing two
 * zones) → both listed, none chosen. A town / neighbourhood → the range
 * (and median) of the area-zone prices in its municipal unit — context.
 */
const PROXY = "https://maps.gsis.gr/valuemaps2/PHP/proxy.php?";
const ZONES = "https://maps.gsis.gr/arcgis/rest/services/APAA_PUBLIC/ZONES_LATEST/MapServer";
const GEOCODER = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
export const GR_ZONE_SOURCE = "Ministry of Finance / ΑΑΔΕ — objective value zone prices (τιμές ζώνης), official map maps.gsis.gr/valuemaps";
export const GR_ZONE_URL = "https://maps.gsis.gr/valuemaps/";
const HEADERS = { "User-Agent": "Pradixium/1.0 (+https://pradixium.com)", Referer: "https://maps.gsis.gr/valuemaps/" };
const FIELDS = "ZONEREGISTRYID,ZONENAME,CURRENTZONEVALUE,ZONEDESCRIPTION,DIMOS,DIMOTIKI_ENOTITA,VALID_FROM,LAST_FEK_YEAR,URL_PINAKES";
const PRECISE = new Set(["PointAddress", "StreetAddress", "StreetInt", "Subaddress", "StreetAddressExt"]);

async function getJson(url, ms, headers = HEADERS) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
const norm = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-ZΑ-Ω0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Greek → Latin (the geocoder may answer in either script)
const GR = { Α: "A", Β: "V", Γ: "G", Δ: "D", Ε: "E", Ζ: "Z", Η: "I", Θ: "TH", Ι: "I", Κ: "K", Λ: "L", Μ: "M", Ν: "N", Ξ: "X", Ο: "O", Π: "P", Ρ: "R", Σ: "S", Τ: "T", Υ: "Y", Φ: "F", Χ: "CH", Ψ: "PS", Ω: "O" };
const latin = (s) => norm(s).replace(/ΟΥ/g, "OU").replace(/[Α-Ω]/g, (ch) => GR[ch] || ch);

async function zonesNear(layer, x, y, meters, where = "1=1") {
  const q = new URLSearchParams({ where, geometry: `${x},${y}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: String(meters), units: "esriSRUnit_Meter", outFields: FIELDS, returnGeometry: "false", f: "json" });
  const j = await getJson(`${PROXY}${ZONES}/${layer}/query?${q}`, 7000);
  return Array.isArray(j?.features) ? j.features.map((f) => f.attributes) : null;
}
const uniq = (rows) => [...new Map(rows.filter((r) => Number(r.CURRENTZONEVALUE) > 0).map((r) => [r.ZONEREGISTRYID, r])).values()];
const zoneOf = (r) => ({ id: r.ZONEREGISTRYID, name: r.ZONENAME, value: Number(r.CURRENTZONEVALUE), description: r.ZONEDESCRIPTION, dimos: r.DIMOS, unit: r.DIMOTIKI_ENOTITA, validFrom: Number(r.VALID_FROM) ? new Date(Number(r.VALID_FROM)).toISOString().slice(0, 10) : null, revision: r.LAST_FEK_YEAR || null, tablesUrl: r.URL_PINAKES || null });

export async function greekZone(input) {
  const text = String(input || "").trim();
  if (!text) return null;
  const g = await getJson(`${GEOCODER}?${new URLSearchParams({ SingleLine: text, countryCode: "GRC", maxLocations: "1", outFields: "Addr_type,StAddr,Match_addr", f: "json" })}`, 6000, { "User-Agent": HEADERS["User-Agent"] });
  const c = g?.candidates?.[0];
  if (!c || c.score < 90) return { status: "not_found" };
  const { x, y } = c.location;
  const type = c.attributes?.Addr_type;

  if (PRECISE.has(type)) {
    const [areas, fronts] = await Promise.all([zonesNear(1, x, y, 30), zonesNear(0, x, y, 30)]);
    if (!areas && !fronts) return { status: "unavailable" };
    // the address's own street: its first word must appear in the frontage description
    const street = latin(c.attributes?.StAddr || c.address).replace(/\b\d+\w*\b/g, "").trim().split(" ")[0] || "";
    const own = uniq(fronts || []).filter((r) => street.length >= 4 && latin(r.ZONEDESCRIPTION).split(" ").some((w) => w.slice(0, 5) === street.slice(0, 5)));
    const area = uniq(areas || []);
    const values = [...new Set(area.map((r) => Number(r.CURRENTZONEVALUE)))];
    if (own.length === 1) return { status: "frontage", matched: c.address, zone: zoneOf(own[0]), areaZones: area.map(zoneOf) };
    if (values.length === 1) return { status: "area", matched: c.address, zone: zoneOf(area[0]), frontage: uniq(fronts || []).map(zoneOf) };
    if (values.length > 1) return { status: "several", matched: c.address, zones: area.map(zoneOf) };
    return { status: "outside_zones", matched: c.address };
  }

  // a town / neighbourhood: the municipal unit's area-zone prices
  const near = uniq((await zonesNear(1, x, y, 400)) || []);
  if (!near.length) return { status: "outside_zones", matched: c.address };
  const ref = near[0];
  const esc = (s) => String(s).replace(/'/g, "''");
  const q = new URLSearchParams({ where: `DIMOS='${esc(ref.DIMOS)}' AND DIMOTIKI_ENOTITA='${esc(ref.DIMOTIKI_ENOTITA)}'`, outFields: "ZONEREGISTRYID,CURRENTZONEVALUE", returnGeometry: "false", f: "json" });
  const j = await getJson(`${PROXY}${ZONES}/1/query?${q}`, 8000);
  const all = uniq(Array.isArray(j?.features) ? j.features.map((f) => f.attributes) : []);
  if (!all.length) return { status: "unavailable" };
  const v = all.map((r) => Number(r.CURRENTZONEVALUE)).sort((a, b) => a - b), m = Math.floor(v.length / 2);
  // "Kolonaki, Athens": also the zones around the neighbourhood's centre point
  const nv = near.map((r) => Number(r.CURRENTZONEVALUE)).sort((a, b) => a - b);
  const around = text.includes(",") ? { zones: nv.length, min: nv[0], max: nv[nv.length - 1] } : null;
  return { status: "range", matched: c.address, around, area: { dimos: ref.DIMOS, unit: ref.DIMOTIKI_ENOTITA, zones: v.length, min: v[0], max: v[v.length - 1], median: v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2), validFrom: zoneOf(ref).validFrom, revision: ref.LAST_FEK_YEAR || null, tablesUrl: ref.URL_PINAKES || null } };
}
