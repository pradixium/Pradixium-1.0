/* PRADIXIUM™ — Spain: official rents from MIVAU's SERPAVI database (tax
 * returns of habitual-residence lets, Modelo 100; rentals to relatives
 * excluded): median and middle-half € per m² a month of the let homes in
 * the municipality, flats (vivienda colectiva) and houses (unifamiliar)
 * separately, latest year. lib/data/spainRents.json ←
 * scripts/build-es-rents.py. Census sections are in the file too (used once
 * an address can be placed in its section).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "spainRents.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}

const HOUSE = /house|villa|detached|chalet|townhouse|terrace|bungalow/i;
export function spainRent(muniCode, propertyType) {
  const d = load();
  const m = d && muniCode ? d.municipalities[String(muniCode).padStart(5, "0")] : null;
  if (!m) return null;
  const kind = HOUSE.test(String(propertyType || "")) ? "house" : "flat";
  const r = m[kind];
  // 10+ let homes for a median
  if (!r || r[3] < 10) return null;
  return { kind, median: r[0], p25: r[1], p75: r[2], homes: r[3], year: d.year, source: d.source, sourceUrl: d.sourceUrl, lastUpdate: d.lastUpdate };
}
