/* PRADIXIUM™ — Norway: SSB Rental market survey (table 09895) average
 * monthly rent by price zone and number of rooms (Norwegian "rom" = living
 * rooms + bedrooms, kitchen excluded → bedrooms + 1), latest year —
 * lib/data/norwayRents.json ← scripts/build-no-rents.py. Only the named
 * city zones are matched (the size-class zones need a settlement's
 * population, not used).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "norwayRents.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ZONES = [
  [/\b(oslo|baerum|bærum|sandvika)\b/, "Oslo and Bærum municipality"],
  [/\bbergen\b/, "Bergen municipality"],
  [/\btrondheim\b/, "Trondheim municipality"],
  [/\bstavanger\b/, "Stavanger municipality"],
  [/\b(akershus|asker|lillestrom|lorenskog|nordre follo|ullensaker|eidsvoll|nittedal|raelingen|nesodden|frogn|vestby|aurskog holand|nes|gjerdrum|enebakk)\b/, "Akershus except Bærum municipality"]
];
export function norwayRent(text, bedrooms) {
  const d = load();
  if (!d) return null;
  const t = norm(text);
  const hit = ZONES.find(([re]) => re.test(t));
  if (!hit || !d.zones[hit[1]]) return null;
  const b = Number(bedrooms);
  if (!Number.isFinite(b) || bedrooms === null || bedrooms === "") return null;   // rent differs too much by size to use an all-sizes figure
  const rooms = Math.round(b) + 1;
  const key = rooms >= 5 ? "5 rooms or more" : `${rooms} room${rooms > 1 ? "s" : ""}`;
  const r = d.zones[hit[1]][key];
  if (!r?.monthly) return null;
  return { zone: hit[1], rooms: key, monthly: r.monthly, perSqmYear: r.perSqmYear, year: d.year, source: d.source, url: d.url };
}
