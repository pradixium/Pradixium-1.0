/* PRADIXIUM™ — Spain: the Catastro "mapa de valores" zone of an address.
 *
 * Every year the Dirección General del Catastro publishes, openly and free,
 * a values map for every municipality under its jurisdiction (all of Spain
 * except the Basque Country and Navarre, which keep their own cadastres):
 * each "ámbito territorial homogéneo" (zone) carries the REPRESENTATIVE home
 * of that zone (type, category, age, built area, plot) and its "módulo de
 * valor medio" — an average value derived from every sale formalised before
 * a notary or registered in the Property Registry (Informe Anual del Mercado
 * Inmobiliario). It is the basis of each property's official valor de
 * referencia. Source used here: the same GeoJSON service the Sede's own map
 * viewer loads (Cartografia/SECDameGeoJSON.aspx), no login.
 *
 * Address → coordinates: CartoCiudad (IGN / CNIG, Spain's official address
 * geocoder). The candidate must be in the municipality the user named;
 * a city-only query gets no zone (a city has dozens of zones).
 *
 * Reading the value (Catastro legend): flats and terraced/semi-detached
 * houses → € per m² built; detached single-family houses → a total € for the
 * representative home (land included), which is NOT a per-m² price.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const GEO = "https://www.cartociudad.es/geocoder/api/geocoder/candidatesJsonp";
const ZONES = "https://www1.sedecatastro.gob.es/Cartografia/SECDameGeoJSON.aspx";
export const CATASTRO_SOURCE = "Dirección General del Catastro — mapa de valores (Informe Anual del Mercado Inmobiliario)";
export const CATASTRO_URL = "https://www1.sedecatastro.gob.es/Accesos/SECAccvr.aspx";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function getText(url, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (Pradixium)", Accept: "application/json,*/*" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

// Spanish names customers type → the official (often Catalan/Galician/
// Valencian) municipality name CartoCiudad uses
const TOWN_ALIASES = {
  "ibiza": "Eivissa", "santa eulalia del rio": "Santa Eulària des Riu", "santa eulalia": "Santa Eulària des Riu",
  "san antonio abad": "Sant Antoni de Portmany", "san antonio": "Sant Antoni de Portmany", "san jose": "Sant Josep de sa Talaia",
  "san juan bautista": "Sant Joan de Labritja", "palma de mallorca": "Palma", "mahon": "Maó", "ciudadela": "Ciutadella de Menorca",
  "javea": "Xàbia", "alicante": "Alacant", "elche": "Elx", "villajoyosa": "la Vila Joiosa", "denia": "Dénia", "calpe": "Calp",
  "alfaz del pi": "l'Alfàs del Pi", "benisa": "Benissa", "castellon": "Castelló de la Plana", "castellon de la plana": "Castelló de la Plana",
  "valencia": "València", "gerona": "Girona", "lerida": "Lleida", "la coruna": "A Coruña", "coruna": "A Coruña", "orense": "Ourense",
  "sangenjo": "Sanxenxo", "puerto de la cruz": "Puerto de la Cruz", "andratx": "Andratx", "pollensa": "Pollença", "soller": "Sóller",
  "santanyi": "Santanyí", "felanitx": "Felanitx", "llucmajor": "Llucmajor", "calvia": "Calvià", "lloret de mar": "Lloret de Mar",
  "sitges": "Sitges", "torrevieja": "Torrevieja", "villarreal": "Vila-real", "deya": "Deià", "benitachell": "el Poble Nou de Benitatxell",
  "san antonio de portmany": "Sant Antoni de Portmany",
  "las palmas": "Las Palmas de Gran Canaria",
  // an island / coast / region is not a town
  "tenerife": null, "lanzarote": null, "fuerteventura": null, "gran canaria": null,
  "mallorca": null, "majorca": null, "menorca": null, "minorca": null, "costa del sol": null, "costa blanca": null, "costa brava": null
};
// resorts / localities customers type → their municipality (checked on
// CartoCiudad; a locality name alone can exist in several provinces —
// "Corralejo" is also a village in Segovia)
const LOCALITY_ALIASES = {
  "orihuela costa": "Orihuela", "moraira": "Teulada", "altea hills": "Altea", "puerto banus": "Marbella", "nueva andalucia": "Marbella", "san pedro de alcantara": "Marbella",
  "guadalmina": "Marbella", "elviria": "Marbella", "los monteros": "Marbella", "cabopino": "Marbella", "sierra blanca": "Marbella",
  "el paraiso": "Estepona", "la cala de mijas": "Mijas", "calahonda": "Mijas", "sotogrande": "San Roque", "valderrama": "San Roque",
  "la zagaleta": "Benahavís", "la manga": ["Cartagena", "San Javier"], "la manga del mar menor": ["Cartagena", "San Javier"],
  "la zenia": "Orihuela", "cabo roig": "Orihuela", "playa flamenca": "Orihuela", "campoamor": "Orihuela",
  "cumbre del sol": "el Poble Nou de Benitatxell", 
  "puerto de pollensa": "Pollença", "port de pollenca": "Pollença", "puerto pollensa": "Pollença", "cala d or": "Santanyí",
  "santa ponsa": "Calvià", "santa ponca": "Calvià", "port adriano": "Calvià", "puerto portals": "Calvià", "portals nous": "Calvià",
  "bendinat": "Calvià", "costa d en blanes": "Calvià", "port d andratx": "Andratx", "puerto de andratx": "Andratx",
  "port de soller": "Sóller", "puerto de soller": "Sóller", "son vida": "Palma", 
  "cala vadella": "Sant Josep de sa Talaia", "es cubells": "Sant Josep de sa Talaia",
  "roca llisa": "Santa Eulària des Riu", "es canar": "Santa Eulària des Riu", "san carlos": "Santa Eulària des Riu",
  "corralejo": "La Oliva", "caleta de fuste": "Antigua", "morro jable": "Pájara", "costa calma": "Pájara",
  "playa blanca": "Yaiza", "puerto del carmen": "Tías", "costa teguise": "Teguise",
  "los cristianos": "Arona", "playa de las americas": "Arona", "costa adeje": "Adeje", "el medano": "Granadilla de Abona",
  "golf del sur": "San Miguel de Abona", "puerto de mogan": "Mogán", "maspalomas": "San Bartolomé de Tirajana",
  "playa del ingles": "San Bartolomé de Tirajana", "meloneras": "San Bartolomé de Tirajana"
};
Object.assign(TOWN_ALIASES, LOCALITY_ALIASES);
const LOCAL_LANG_PROVINCES = new Set(["07", "08", "17", "25", "43", "03", "12", "46"]);
const toCatalan = (a) => String(a).replace(/^\s*calle\b/i, "Carrer").replace(/^\s*avenida\b/i, "Avinguda").replace(/^\s*paseo\b/i, "Passeig").replace(/^\s*plaza\b/i, "Plaça").replace(/^\s*camino\b/i, "Camí");
const toGalician = (a) => String(a).replace(/^\s*calle\b/i, "Rúa");

async function candidates(q, limit = 50) {
  const txt = await getText(`${GEO}?q=${encodeURIComponent(q)}&limit=${limit}`, 6000);
  const list = JSON.parse(txt.replace(/^[^(]*\(/, "").replace(/\)\s*;?\s*$/, ""));
  return Array.isArray(list) ? list.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)) : [];
}
const bare = (s) => norm(s).replace(/\b(de|del|la|el|les|los|las|d|l|sa|es|ses)\b/g, " ").replace(/\s+/g, " ").trim();

// the municipality the user named: exact name match only ("Palma" must not
// become Las Palmas de Gran Canaria)
export async function resolveTown(city) {
  const typed = String(city || "").split(",")[0].trim();
  if (!typed) return null;
  const alias = TOWN_ALIASES[norm(typed)];
  // an island / coast name is not a town: ask for the town
  if (alias === null) return null;
  // a locality split between municipalities (La Manga): any of them
  if (Array.isArray(alias)) {
    const towns = (await Promise.all(alias.map((a) => resolveTown(a)))).filter(Boolean);
    return towns.length ? { ...towns[0], muniCodes: towns.map((t) => t.muniCode), isLocality: true } : null;
  }
  const official = alias || typed;
  const want = bare(official);
  const list = await candidates(official, 30);
  const named = (c, k) => bare(c[k]) === want || String(c[k]).split("/").map(bare).includes(want);
  const muniHit = list.find((c) => c.type === "Municipio" && named(c, "muni"));
  // a locality (poblacion) name only when ONE municipality has it
  const locs = list.filter((c) => c.type === "poblacion" && named(c, "poblacion"));
  const hit = muniHit || (new Set(locs.map((c) => c.muniCode)).size === 1 ? locs[0] : null);
  return hit ? { muni: hit.muni, muniCode: hit.muniCode, muniCodes: [hit.muniCode], province: hit.province, provinceCode: hit.provinceCode, lat: hit.lat, lon: hit.lng, isLocality: hit.type === "poblacion" && bare(hit.muni) !== want } : null;
}

export async function geocodeSpain(address, city) {
  const typed = String(city || "").split(",")[0].trim();
  const alias = TOWN_ALIASES[norm(typed)];
  const official = typeof alias === "string" ? alias : typed;
  const variants = [...new Set([address, toCatalan(address), toGalician(address)])];
  // the municipality and the address candidates are looked up together
  const [town, ...lists] = await Promise.all([resolveTown(city), ...variants.map((v) => candidates(`${v}, ${official}`).catch(() => null))]);
  // the register did not answer: say so, never "address not found"
  if (lists.every((l) => l === null)) throw new Error("CartoCiudad did not answer");
  if (!town) return null;
  if (!address) return { lat: null, lon: null, type: "Municipio", label: town.muni, muni: town.muni, muniCode: town.muniCode, province: town.province };
  const num = (String(address).match(/\b(\d{1,4})\b/) || [])[1];
  const rank = { portal: 0, toponimo: 1, ngbe: 1, callejero: 2, poblacion: 3, Municipio: 4 };
  let all = lists.filter(Boolean).flat().filter((c) => town.muniCodes.includes(c.muniCode));
  if (!all.length) {
    // urbanisations often have streets without numbered portals in the
    // register ("Calle Petunia 5, Altea" → only the street): look the
    // street up by its name alone — a street is an area, not an address
    const core = String(address).replace(/\b\d{1,4}\s*[a-z]?\b/gi, " ").replace(/^\s*(c\/|c\.|calle|carrer|avenida|avda\.?|avinguda|av\.?|paseo|passeig|plaza|placa|plaça|camino|cami|camí|urbanizacion|urbanización|urb\.?|partida)\s+(de\s+la\s+|de\s+los\s+|de\s+las\s+|del\s+|de\s+|d')?/i, "").replace(/\s+/g, " ").trim();
    if (core && core.length >= 3) {
      const byName = await candidates(`${core} ${official}`, 30).catch(() => []);
      const want = bare(core);
      all = byName.filter((c) => c.type === "callejero" && town.muniCodes.includes(c.muniCode) && (` ${bare(c.address)} `).includes(` ${want} `));
    }
  }
  all.sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9) || (num && String(b.portalNumber) === num) - (num && String(a.portalNumber) === num));
  // a street number was typed: only that exact number is an exact match
  const c = all.find((x) => x.type !== "portal" || !num || String(x.portalNumber) === num) || null;
  if (!c) return null;
  // a street candidate carries no point: take the middle of its official
  // geometry (CartoCiudad "find" by id)
  if (!(Math.abs(c.lat) > 1) && c.type === "callejero" && c.id) {
    const f = JSON.parse(await getText(`${GEO.replace("candidatesJsonp", "find")}?q=${encodeURIComponent(c.address)}&type=callejero&id=${encodeURIComponent(c.id)}`, 6000));
    const pts = [...String(f?.geom || "").matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    if (!pts.length) return null;
    const [lng, lat] = pts[Math.floor(pts.length / 2)];
    c.lat = lat; c.lng = lng;
  }
  if (!(Math.abs(c.lat) > 1)) return null;
  return { lat: c.lat, lon: c.lng, type: c.type, label: c.address, muni: c.muni, muniCode: c.muniCode, province: c.province, postalCode: c.postalCode, refCatastral: c.refCatastral || null };
}

function inRing(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[j];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

// big municipalities are pre-built (scripts/build-es-zones.py): the live
// service returns a whole municipality per request (Madrid 8 MB / ~10 s)
const cache = new Map();
function prebuilt(muniCode) {
  if (!muniCode) return null;
  if (cache.has(muniCode)) return cache.get(muniCode);
  let doc = null;
  try { doc = JSON.parse(gunzipSync(readFileSync(path.join(process.cwd(), "lib", "data", "spainZones", `${muniCode}.json.gz`))).toString("utf8")); } catch { doc = null; }
  cache.set(muniCode, doc);
  return doc;
}
// same shape for both paths: { zona_valor, cod_zona, ejercicio, num_inmuebles_uso_v, polys, products }
function fromLive(f) {
  const p = f.properties, g = f.geometry;
  return { zona_valor: p.zona_valor, cod_zona: p.cod_zona, ejercicio: p.ejercicio, num_inmuebles_uso_v: p.num_inmuebles_uso_v,
    polys: g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [],
    products: Object.keys(p).filter((k) => /^Ptipo\d+$/.test(k)).sort().map((k) => p[k]).filter((t) => t && Number(t.val_tipo) > 0) };
}
const inZone = (lon, lat, z) => z.polys.some((poly) => inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h)));
function distM(lat1, lon1, lat2, lon2) { const k = Math.PI / 180, x = (lon2 - lon1) * k * Math.cos(((lat1 + lat2) / 2) * k), y = (lat2 - lat1) * k; return Math.sqrt(x * x + y * y) * 6371000; }
const nearZone = (lon, lat, z, m) => z.polys.some((poly) => poly[0].some(([x, y]) => distM(lat, lon, y, x) <= m));

export async function zonesFor(lat, lon, muniCode) {
  const pb = prebuilt(muniCode);
  // a stored file is used only when the address really lies in its map
  if (pb && pb.zones.some((z) => inZone(lon, lat, z) || nearZone(lon, lat, z, 500))) return { mapYear: pb.mapYear, zones: pb.zones, prebuilt: true, accessed: pb.built || null };
  const x = (lon * 20037508.34) / 180, y = ((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * 20037508.34) / 180;
  const y0 = new Date().getFullYear();
  // the map for year N is published in the autumn of N-1: ask for N+1 and N
  // together, keep the newest one that has this place
  const years = [y0 + 1, y0];
  const maps = await Promise.all(years.map((year) => getText(`${ZONES}?del=0&mun=0&huso=3857&x=${x.toFixed(1)}&y=${y.toFixed(1)}&suelo=N&tipo_mapa=vivienda&anyoZV=${year}`, 7500)
    .then((t) => JSON.parse(t).features).catch(() => null)));
  for (const [i, fs] of maps.entries()) if (Array.isArray(fs) && fs.length) return { mapYear: years[i], zones: fs.map(fromLive), prebuilt: false, accessed: new Date().toISOString().slice(0, 10) };
  return null;
}

const isHouse = (t) => /house|villa|chalet|townhouse|detached|bungalow/i.test(String(t || ""));
// villa/detached → "aislada/pareada"; townhouse/terraced → "en hilera";
// plain "house" → detached first, then terraced; anything else → flats
function pickProduct(products, propertyType) {
  const t = String(propertyType || "");
  const order = /villa|chalet|detached|bungalow/i.test(t) ? [/aislada|pareada/i]
    : /town ?house|terraced|row ?house|adosad/i.test(t) ? [/hilera|manzana/i]
    : isHouse(t) ? [/aislada|pareada/i, /hilera|manzana/i] : [/colectiva/i];
  for (const re of order) { const hit = products.find((p) => re.test(p.tipologia)); if (hit) return hit; }
  return null;
}
const productOut = (t) => t ? {
  type: t.tipologia, category: t.categoria, ageYears: t.antiguedad, condition: t.conservacion,
  builtM2: t.superficie, plotM2: t.superficie_suelo || null, value: t.val_tipo, valuePerM2: t.val_tipo_m2,
  shownAs: t.val_tipo_mostrar || null,
  // the Catastro itself shows the module as "1.710 €/m²" (flats, terraced)
  // or as "607.300 €" (detached house, land included — not a per-m² price)
  perM2Comparable: /€\s*\/\s*m/.test(String(t.val_tipo_mostrar || ""))
} : null;

/** Official zone evidence for a Spanish address, or a reason why there is none. */
// the point of a LOCALITY the customer named ("Corralejo", "Puerto Banús",
// "Altea Hills") inside its municipality — never a whole municipality's
// centre (the zones around Marbella's town hall say nothing about a villa
// in Nueva Andalucía)
async function localityPoint(city, parentTown) {
  const typed = String(city || "").split(",")[0].trim();
  // a locality typed beside its town: search it inside that town
  if (parentTown && !TOWN_ALIASES[norm(typed)]) {
    const town = await resolveTown(parentTown).catch(() => null);
    if (!town) return null;
    const want = bare(typed);
    const list = await candidates(`${typed}, ${TOWN_ALIASES[norm(parentTown)] || parentTown}`, 30).catch(() => []);
    const pref = { poblacion: 0, ngbe: 1, toponimo: 2 };
    const c = list.filter((x) => x.type in pref && town.muniCodes.includes(x.muniCode) && Math.abs(x.lat) > 1
      && [x.poblacion, x.address].some((n) => (` ${bare(n)} `).includes(` ${want} `))).sort((a, b) => pref[a.type] - pref[b.type])[0];
    return c ? { lat: c.lat, lon: c.lng, type: c.type, label: `${typed} (${town.muni})`, muni: c.muni, muniCode: c.muniCode, province: c.province } : null;
  }
  const town = await resolveTown(city).catch(() => null);
  if (!town) return null;
  if (town.isLocality && Number.isFinite(town.lat) && Math.abs(town.lat) > 1) {
    return { lat: town.lat, lon: town.lon, type: "poblacion", label: `${typed} (${town.muni})`, muni: town.muni, muniCode: town.muniCode, province: town.province };
  }
  if (typeof TOWN_ALIASES[norm(typed)] !== "string" || bare(typed) === bare(town.muni)) return null;
  // "Mahón" → Maó is just another spelling of the municipality, not a place in it
  if (!(norm(typed) in LOCALITY_ALIASES)) return null;
  const want = bare(typed);
  const list = await candidates(`${typed}, ${TOWN_ALIASES[norm(typed)]}`, 30).catch(() => []);
  const pref = { poblacion: 0, ngbe: 1, toponimo: 2 };
  const c = list.filter((x) => x.type in pref && town.muniCodes.includes(x.muniCode) && Math.abs(x.lat) > 1
    && [x.poblacion, x.address].some((n) => (` ${bare(n)} `).includes(` ${want} `)))
    .sort((a, b) => pref[a.type] - pref[b.type])[0];
  return c ? { lat: c.lat, lon: c.lng, type: c.type, label: `${typed} (${town.muni})`, muni: c.muni, muniCode: c.muniCode, province: c.province } : null;
}

// The site has ONE field ("Property Address / City") and sends it as both
// address and city: "Calle de Serrano 50, 28001 Madrid, Spain" → street
// "Calle de Serrano 50", town "Madrid", localities in between
// ("Calle X 5, Nueva Andalucía, Marbella").
export function splitSpanishInput(address, city) {
  const clean = (x) => String(x || "").split(",").map((p) => p.replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p && !/^(spain|espana|españa|es)$/i.test(p));
  const a = clean(address), c = clean(city);
  const all = a.length >= c.length ? a : c;
  if (a.join() !== c.join() && a.length && c.length) {
    // separate fields: address may still carry the town
    const town = c[c.length - 1];
    const street = a.filter((p) => norm(p) !== norm(town));
    return { street: street[0] || "", localities: [...street.slice(1), ...c.slice(0, -1)], town };
  }
  if (all.length === 1) return /\d/.test(all[0]) ? { street: all[0], localities: [], town: "" } : { street: "", localities: [], town: all[0] };
  return { street: all[0], localities: all.slice(1, -1), town: all[all.length - 1] };
}

export async function spainCatastroZone({ address, city, propertyType }) {
  const inp = splitSpanishInput(address, city);
  if (!inp.town) return { status: inp.street ? "no_town" : "no_address" };
  // "Calle X 5, Altea, Alicante": the town is the FIRST part after the
  // street that is a town — Alicante here is the province, and "Menorca",
  // "Spain" or a region are not towns
  const parts = [...inp.localities, inp.town];
  for (let i = 0; i < parts.length - 1; i++) {
    if (TOWN_ALIASES[norm(parts[i])] === null) continue;
    if (await resolveTown(parts[i]).catch(() => null)) { inp.localities = parts.slice(0, i); inp.town = parts[i]; break; }
  }
  if (TOWN_ALIASES[norm(inp.town)] === null && parts.length > 1) {
    const prev = parts.filter((x) => TOWN_ALIASES[norm(x)] !== null);
    if (prev.length) { inp.town = prev[prev.length - 1]; inp.localities = prev.slice(0, -1); }
  }
  // the street may itself be a named place ("Altea Hills, Altea")
  let geoError = false;
  let geo = inp.street ? await geocodeSpain(inp.street, inp.town).catch(() => { geoError = true; return null; }) : null;
  let addressNotFound = false;
  // a named place, not a street address: say what it was located as
  if (geo && !["portal", "Municipio"].includes(geo.type) && bare(geo.label) !== bare(inp.street)) geo.label = `${inp.street}, ${geo.muni} — located at ${geo.label}`;
  if (!geo || geo.type === "Municipio") {
    // no (findable) street address: the zones around the named locality,
    // as a range, when the customer named one ("Altea Hills",
    // "Calle X, Nueva Andalucía, Marbella" → Nueva Andalucía)
    let lp = null;
    for (const loc of [...inp.localities].reverse()) if (!lp) lp = await localityPoint(`${loc}`, inp.town);
    if (!lp) lp = await localityPoint(inp.town);
    address = inp.street;
    // the municipality itself is still known (its rent, statistics)
    if (!lp) return { status: !address ? "no_address" : geo ? "town_only" : geoError ? "geocoder_error" : "not_geocoded", geo: geo || undefined, town: await resolveTown(inp.town).catch(() => null) };
    addressNotFound = !!address;
    geo = lp;
  }
  const zs = await zonesFor(geo.lat, geo.lon, geo.muniCode).catch(() => null);
  if (!zs) return { status: "no_map", geo }; // Basque Country / Navarre, or the service did not answer
  // the Catastro's licence: cite the Dirección General del Catastro and the date
  // the information was accessed
  const base = { source: CATASTRO_SOURCE, sourceUrl: CATASTRO_URL, geo, mapYear: zs.mapYear, accessed: zs.accessed, addressNotFound };
  // a named area ("Altea Hills"), not an exact address: the zones around it,
  // as a range — never one zone's value as if it were this property's
  if (geo.type !== "portal") {
    const dist = (z) => inZone(geo.lon, geo.lat, z) ? 0 : Math.min(...z.polys.flatMap((poly) => poly[0].map(([x, y]) => distM(geo.lat, geo.lon, y, x))));
    const near = zs.zones.map((z) => ({ z, d: dist(z) })).filter((x) => x.d <= 700);
    const prods = near.map(({ z, d }) => ({ z, d, t: pickProduct(z.products, propertyType) })).filter((x) => x.t);
    if (!prods.length) return { ...base, status: "area_no_product" };
    // one basis per range: €/m² (flats, terraced) and whole-home totals
    // (detached, land included) are never mixed — keep the larger group
    const perM2 = (x) => /€\s*\/\s*m/.test(String(x.t.val_tipo_mostrar || ""));
    const a = prods.filter(perM2), b = prods.filter((x) => !perM2(x));
    prods.splice(0, prods.length, ...(a.length >= b.length ? a : b));
    // the whole range, and the (at most 6) zones closest to the place
    const key = (x) => (/€\s*\/\s*m/.test(String(x.t.val_tipo_mostrar || "")) ? Number(x.t.val_tipo_m2) : Number(x.t.val_tipo));
    const byValue = [...prods].sort((a, b) => key(a) - key(b));
    const closest = [...prods].sort((a, b) => a.d - b.d).slice(0, 6).sort((a, b) => key(a) - key(b));
    const out = ({ z, t }) => ({ zone: z.zona_valor, homesInZone: z.num_inmuebles_uso_v, dataYear: z.ejercicio, product: productOut(t) });
    return { ...base, status: "area", zonesAround: prods.length, rangeLow: out(byValue[0]), rangeHigh: out(byValue[byValue.length - 1]), areaZones: closest.map(out) };
  }
  const hit = zs.zones.filter((z) => inZone(geo.lon, geo.lat, z));
  if (hit.length !== 1) return { ...base, status: hit.length > 1 ? "several_zones" : "outside_zones" };
  const z = hit[0], t = pickProduct(z.products, propertyType);
  return { ...base, status: t ? "ok" : "other_type_only",
    zone: z.zona_valor, zoneCode: z.cod_zona, homesInZone: z.num_inmuebles_uso_v ?? null, dataYear: z.ejercicio ?? null,
    product: productOut(t),
    // the zone has no representative home of the requested type: say what it has
    otherProducts: t ? [] : z.products.map(productOut) };
}
