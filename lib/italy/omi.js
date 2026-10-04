/* PRADIXIUM™ — Italy: Agenzia delle Entrate OMI quotations (Osservatorio
 * del Mercato Immobiliare), the tax agency's official half-yearly €/m²
 * ranges per OMI zone and home type (min–max, gross area, by condition),
 * read from the agency's own public consultation service (GEOPOI OMI).
 *
 * Municipality: lib/data/italyComuni.json (scripts/build-it-comuni.py, the
 * OMI service's own list with cadastral codes). Zone: the OMI zones are
 * NAMED after their localities / streets ("…-PORTO CERVO-PEVERO-…"), so a
 * locality the customer typed is matched against the zone names of that
 * municipality. One matching zone → its range is the benchmark; otherwise
 * the range across the municipality's zones is context, never applied as
 * the property's own value.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const OMI = "https://www1.agenziaentrate.gov.it/servizi/geopoi_omi";
export const OMI_SOURCE = "Agenzia delle Entrate — OMI quotations (Osservatorio del Mercato Immobiliare)";
export const OMI_URL = "https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/index.htm";

let comuni;
function comuneList() {
  if (comuni === undefined) {
    try { comuni = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "italyComuni.json"), "utf8")).comuni; } catch { comuni = null; }
  }
  return comuni;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[`']/g, " ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// English / resort names → the municipality (and the locality inside it)
const ALIASES = {
  rome: "Roma", milan: "Milano", florence: "Firenze", venice: "Venezia", naples: "Napoli", turin: "Torino", genoa: "Genova",
  "porto cervo": ["Arzachena", "Porto Cervo"], "costa smeralda": ["Arzachena", null], "baja sardinia": ["Arzachena", "Baja Sardinia"],
  "cortina": "Cortina d'Ampezzo", "lake como": null, "sardinia": null, "sicily": null, "tuscany": null, "amalfi coast": null, "puglia": null
};
const cache = new Map();
async function j(url, ms = 7000) {
  if (cache.has(url)) return cache.get(url);
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": "Mozilla/5.0 (Pradixium)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = r.headers.get("content-type")?.includes("json") || url.includes("zoneomi") ? await r.json() : await r.text();
    cache.set(url, v);
    return v;
  } finally { clearTimeout(t); }
}

// Address → its OMI zone: Esri World geocoder (anonymous, results not
// stored), a house-number match in the same municipality only, then the
// zone perimeter that contains the point (the agency's own map perimeters:
// lib/data/italyOmiZones/<codcom>.json.gz for the big cities, else read
// live, richiesta=6). Near a zone boundary (< 25 m) → no single zone.
const GEOCODER = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
async function geocode(street, comune) {
  const q = new URLSearchParams({ SingleLine: `${street}, ${comune}`, countryCode: "ITA", maxLocations: "1", outFields: "Addr_type,City,Match_addr", f: "json" });
  const g = await j(`${GEOCODER}?${q}`, 6000).catch(() => null);
  const c = g?.candidates?.[0];
  if (!c || c.score < 90 || !/^(PointAddress|StreetAddress|StreetAddressExt)$/.test(c.attributes?.Addr_type || "")) return null;
  if (norm(c.attributes.City) !== norm(comune)) return null;
  return { lon: c.location.x, lat: c.location.y, matched: c.attributes.Match_addr };
}
const zoneFiles = new Map();
async function perimeters(codcom, sem) {
  if (!zoneFiles.has(codcom)) {
    let doc = null;
    try { doc = JSON.parse(gunzipSync(readFileSync(path.join(process.cwd(), "lib", "data", "italyOmiZones", `${codcom}.json.gz`))).toString("utf8")); } catch { doc = null; }
    if (!doc) {
      const d = await j(`${OMI}/zoneomi.php?richiesta=6&codcom=${codcom}&semestre=${sem}`, 8000).catch(() => null);
      const feats = d?.dat?.features || [];
      doc = feats.length ? { semestre: sem, zones: feats.map((f) => ({ zona: f.properties?.zona, polys: f.geometry?.type === "Polygon" ? [f.geometry.coordinates] : f.geometry?.type === "MultiPolygon" ? f.geometry.coordinates : [] })) } : null;
    }
    zoneFiles.set(codcom, doc);
  }
  return zoneFiles.get(codcom);
}
function inRing(x, y, ring) {
  let ins = false;
  for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
    const [xi, yi] = ring[i], [xk, yk] = ring[k];
    if ((yi > y) !== (yk > y) && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) ins = !ins;
  }
  return ins;
}
const inZonePoly = (x, y, z) => z.polys.some((poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h)));
function edgeDistM(x, y, z) {
  const kx = 111320 * Math.cos((y * Math.PI) / 180), ky = 110540;
  let best = Infinity;
  for (const poly of z.polys) for (const ring of poly) for (let i = 1; i < ring.length; i++) {
    const ax = (ring[i - 1][0] - x) * kx, ay = (ring[i - 1][1] - y) * ky, bx = (ring[i][0] - x) * kx, by = (ring[i][1] - y) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
async function zoneOfAddress(street, com, sem) {
  const [pt, per] = await Promise.all([geocode(street, com.name), perimeters(com.codcom, sem)]);
  if (!pt || !per?.zones?.length) return null;
  const inside = per.zones.filter((z) => inZonePoly(pt.lon, pt.lat, z));
  if (inside.length !== 1) return { point: pt, zones: [] };
  const near = per.zones.filter((z) => z !== inside[0] && z.zona !== inside[0].zona && edgeDistM(pt.lon, pt.lat, z) < 25);
  return { point: pt, zones: [inside[0].zona, ...near.map((z) => z.zona)] };
}

function findComune(parts) {
  const list = comuneList() || [];
  for (const raw of [...parts].reverse()) {
    const a = ALIASES[norm(raw)];
    if (a === null) continue;
    const [name, locality] = Array.isArray(a) ? a : [a || raw, null];
    const m = list.filter((c) => norm(c[0]) === norm(name));
    if (m.length === 1) return { name: m[0][0], codcom: m[0][1], prov: m[0][2], locality, typed: raw };
  }
  return null;
}

// "Abitazioni civili |NORMALE |4000 |5800 |L |…" → rows
function parseSheet(html) {
  const t = String(html).replace(/<[^>]+>/g, "|").replace(/&nbsp;/g, " ").replace(/&euro;/g, "€").replace(/\s+/g, " ").replace(/(\|\s*)+/g, "|");
  const sem = /Anno (\d{4}) - Semestre (\d)/.exec(t);
  const rows = [];
  const re = /\|([A-Za-zÀ-ÿ' ]+?) ?\|((?:[Nn][Oo][Rr][Mm][Aa][Ll][Ee])|(?:[Oo][Tt][Tt][Ii][Mm][Oo])|(?:[Ss][Cc][Aa][Dd][Ee][Nn][Tt][Ee])) ?\|([\d.]+)\*? ?\|([\d.]+)\*? ?\|([LN]) ?(?=\|)/g;
  let m;
  while ((m = re.exec(t))) rows.push({ type: m[1].trim(), state: m[2], prevailing: m[2] === m[2].toUpperCase(), min: Number(m[3].replace(/\./g, "")), max: Number(m[4].replace(/\./g, "")), surface: m[5] === "L" ? "gross" : "net" });
  return { period: sem ? `H${sem[2]} ${sem[1]}` : null, rows };
}

function typeRows(rows, propertyType) {
  const t = String(propertyType || "");
  const want = /villa|house|detached/i.test(t) && !/town/i.test(t) ? [/ville e villini/i] : /town|terrace/i.test(t) ? [/abitazioni civili/i, /ville e villini/i] : [/abitazioni signorili/i, /abitazioni civili/i, /abitazioni di tipo economico/i];
  for (const w of want) { const r = rows.filter((x) => w.test(x.type)); if (r.length) return r; }
  return [];
}

async function zoneValues(codcom, sem, zone, propertyType) {
  const links = await j(`${OMI}/zoneomi.php?richiesta=8&codcom=${codcom}&semestre=${sem}&zo=${encodeURIComponent(zone.ZONA)}`);
  const link = (links || []).find((l) => /residenziale/i.test(l.DESCR_TIPOLOGIA))?.LINK_ZONA;
  if (!link) return null;
  const sheet = parseSheet(await j(`${OMI}/stampaomi.php?${codcom}/${link}/${sem}/R/${zone.ZONA}/0/0`));
  const rows = typeRows(sheet.rows, propertyType);
  if (!rows.length) return null;
  const main = rows.find((r) => r.prevailing) || rows[0];
  return { zone: zone.ZONA, zoneName: zone.DIZIONE, band: zone.FASCIA, period: sheet.period, rows, main };
}

export async function italyOmi({ city, address, propertyType }) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const parts = [...new Set([address, city].filter(Boolean).join(",").split(",").map((p) => p.replace(/\b\d{5}\b/g, "").trim()).filter((p) => p && !/^(italy|italia)$/i.test(p)))];
  const com = findComune(parts);
  if (!com) return { status: "not_matched" };
  const sems = await j(`${OMI}/zoneomi.php?richiesta=5`);
  const sem = sems?.[0]?.SEMESTRE;
  const zones = (await j(`${OMI}/zoneomi.php?richiesta=3&codcom=${com.codcom}`)) || [];
  if (!zones.length) return { status: "no_zones", comune: com.name };
  // localities the customer typed (other than the municipality) vs the
  // zone names ("C.VOLPE-ROMAZZINO-LA CELVIA-PORTO CERVO-…")
  const locs = [com.locality, ...parts.filter((p) => p !== com.typed && !/\d/.test(p))].filter(Boolean).map(norm);
  const tokens = (z) => String(z.DIZIONE).split(/[-,;/()]+/).map(norm).filter(Boolean);
  const hit = zones.filter((z) => locs.some((l) => tokens(z).includes(l)));
  const base = { source: OMI_SOURCE, sourceUrl: OMI_URL, comune: com.name, province: com.prov };
  // a street and house number typed → the address's own zone on the map
  const street = parts.find((p) => p !== com.typed && /\d/.test(p) && /[a-z]{3}/i.test(p));
  if (street && zones.length > 1) {
    const at = await zoneOfAddress(street, com, sem).catch(() => null);
    if (at?.zones.length === 1) {
      const zone = zones.find((z) => z.ZONA === at.zones[0]);
      const z = zone && await zoneValues(com.codcom, sem, zone, propertyType);
      if (z) return { ...base, status: "ok", ...z, matchedBy: "address", matchedAddress: at.point.matched };
    } else if (at?.zones.length > 1) {
      const all = (await Promise.all(at.zones.map((code) => zones.find((z) => z.ZONA === code)).filter(Boolean).map((z) => zoneValues(com.codcom, sem, z, propertyType).catch(() => null)))).filter(Boolean);
      if (all.length > 1) {
        const lo = all.reduce((a, b) => (b.main.min < a.main.min ? b : a)), hi = all.reduce((a, b) => (b.main.max > a.main.max ? b : a));
        return { ...base, status: "comune_range", boundary: true, matchedAddress: at.point.matched, period: all[0].period, zonesRead: all.length, zonesTotal: zones.length, low: lo, high: hi, zones: all.sort((a, b) => a.main.min - b.main.min) };
      }
      if (all.length === 1) return { ...base, status: "ok", ...all[0], matchedBy: "address", matchedAddress: at.point.matched };
    }
  }
  if (hit.length === 1 || zones.length === 1) {
    const z = await zoneValues(com.codcom, sem, hit[0] || zones[0], propertyType);
    if (!z) return { ...base, status: "no_type_values", zone: (hit[0] || zones[0]).ZONA };
    return { ...base, status: "ok", ...z, matchedBy: hit.length === 1 ? "locality" : "only zone" };
  }
  // a big city (Rome: 233 zones) — a city-wide range says nothing; the
  // neighbourhood name is needed
  if (zones.length > 20) return { ...base, status: "needs_locality", zonesTotal: zones.length, period: sem ? `H${String(sem).slice(4)} ${String(sem).slice(0, 4)}` : null };
  // several zones: the range across the municipality's residential zones
  // (context)
  const all = (await Promise.all(zones.filter((z) => z.FASCIA !== "R").slice(0, 80).map((z) => zoneValues(com.codcom, sem, z, propertyType).catch(() => null)))).filter(Boolean);
  if (!all.length) return { ...base, status: "no_type_values" };
  const lo = all.reduce((a, b) => (b.main.min < a.main.min ? b : a)), hi = all.reduce((a, b) => (b.main.max > a.main.max ? b : a));
  return { ...base, status: "comune_range", period: all[0].period, zonesRead: all.length, zonesTotal: zones.length, low: lo, high: hi, zones: all.sort((a, b) => a.main.min - b.main.min) };
}
