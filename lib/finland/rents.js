/* PRADIXIUM™ — Finland: average rent per m² a month of non-subsidised
 * rental dwellings, NEW contracts (else all contracts), by number of rooms,
 * per city (Statistics Finland asvu 15fa) — lib/data/finlandRents.json ←
 * scripts/build-fi-rents.py. Bedrooms 0 / 1 / 2+ → 1 / 2 / 3+ rooms (the
 * same mapping as the price figures).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "finlandRents.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const SV = { helsingfors: "Helsinki", esbo: "Espoo-Kauniainen", grankulla: "Espoo-Kauniainen", espoo: "Espoo-Kauniainen", kauniainen: "Espoo-Kauniainen", vanda: "Vantaa", abo: "Turku", tammerfors: "Tampere", uleaborg: "Oulu", vasa: "Vaasa", borga: "Porvoo", tavastehus: "Hämeenlinna", lahtis: "Lahti", villmanstrand: "Lappeenranta", jyvaskyla: "Jyväskylä", karleby: "Kokkola", kuopio: "Kuopio", bjorneborg: "Pori", raumo: "Rauma", kervo: "Kerava", trasked: "Järvenpää", hyvinge: "Hyvinkää", rovaniemi: "Rovaniemi" };
export function finlandRent(text, bedrooms) {
  const d = load();
  if (!d) return null;
  const words = new Set(norm(text).split(" "));
  const cities = Object.keys(d.areas).filter((a) => !/\d|^MK|Whole|Greater|Satellite/.test(a));
  let city = null;
  for (const w of words) { if (SV[w]) { city = SV[w]; break; } }
  if (!city) city = cities.find((c) => words.has(norm(c))) || null;
  if (!city || !d.areas[city]) return null;
  const b = Number(bedrooms);
  const room = Number.isFinite(b) && bedrooms !== null && bedrooms !== "" ? ["One-room flat", "Two-room flat", "Three-room flat+"][Math.min(2, Math.max(0, Math.round(b)))] : "Total";
  const rec = d.areas[city][room] || d.areas[city].Total;
  const usedRoom = d.areas[city][room] ? room : "Total";
  const newOk = rec.new != null && rec.newN >= 10;
  const v = newOk ? rec.new : rec.all;
  if (v == null) return null;
  return { city, room: usedRoom, perSqm: v, basis: newOk ? "new" : "all", n: newOk ? rec.newN : rec.allN, quarter: d.quarter, source: d.source, url: d.url };
}
