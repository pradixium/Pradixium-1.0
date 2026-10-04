/* PRADIXIUM™ — Spain: official rents from MIVAU's SERPAVI database (tax
 * returns of habitual-residence lets, Modelo 100; rentals to relatives
 * excluded): median and middle-half € per m² a month of the let homes in
 * the municipality, flats (vivienda colectiva) and houses (unifamiliar)
 * separately, latest year. lib/data/spainRents.json ←
 * scripts/build-es-rents.py. Census sections are in the file too (used once
 * an address can be placed in its section).
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "spainRents.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}

const HOUSE = /house|villa|detached|chalet|townhouse|terrace|bungalow/i;
// the address's census section (INE 2021 perimeters, lib/data/spainSections
// ← scripts/build-es-sections.py) when the address itself was located
const secCache = new Map();
function sectionsOf(muniCode) {
  if (!secCache.has(muniCode)) {
    let doc = null;
    try { doc = JSON.parse(gunzipSync(readFileSync(path.join(process.cwd(), "lib", "data", "spainSections", `${muniCode}.json.gz`))).toString("utf8")); } catch { doc = null; }
    secCache.set(muniCode, doc);
  }
  return secCache.get(muniCode);
}
function inRing(x, y, ring) {
  let ins = false;
  for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
    const [xi, yi] = ring[i], [xk, yk] = ring[k];
    if ((yi > y) !== (yk > y) && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) ins = !ins;
  }
  return ins;
}
function sectionAt(muniCode, lat, lon) {
  const d = sectionsOf(muniCode);
  if (!d || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const hit = d.sections.filter((s) => s.p.some((poly) => inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h))));
  return hit.length === 1 ? hit[0].s : null;
}

export function spainRent(muniCode, propertyType, point = null) {
  const d = load();
  const code = muniCode ? String(muniCode).padStart(5, "0") : null;
  const m = d && code ? d.municipalities[code] : null;
  if (!m) return null;
  const kind = HOUSE.test(String(propertyType || "")) ? "house" : "flat";
  const base = { kind, year: d.year, source: d.source, sourceUrl: d.sourceUrl, lastUpdate: d.lastUpdate };
  // the census section first (10+ let homes of the type), else the municipality
  const sec = point ? sectionAt(code, point.lat, point.lon) : null;
  const sr = sec ? d.sections[sec]?.[kind] : null;
  const muni = m[kind] && m[kind][3] >= 10 ? { median: m[kind][0], p25: m[kind][1], p75: m[kind][2], homes: m[kind][3] } : null;
  if (sr && sr[3] >= 10) return { ...base, level: "section", section: sec, median: sr[0], p25: sr[1], p75: sr[2], homes: sr[3], municipality: muni };
  if (!muni) return null;
  return { ...base, level: "municipality", ...muni };
}
