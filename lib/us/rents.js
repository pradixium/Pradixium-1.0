/* PRADIXIUM™ — US: median GROSS rent by bedrooms per ZIP (ZCTA), ACS
 * 5-year table B25031 (U.S. Census Bureau) ← scripts/build-us-rents.py.
 * Gross rent includes tenant-paid utilities and covers existing tenancies
 * over the 5-year period. A top-coded median ("$3,500 or more", stored
 * negative) is shown as such and never used as a number.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "usRents.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const LABEL = ["all rented homes", "studios", "1-bedroom homes", "2-bedroom homes", "3-bedroom homes", "4-bedroom homes", "homes with 5+ bedrooms"];
const ST = { alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "puerto rico": "PR" };
// "Miami", "Florida" → "miami|FL" when that Census place exists
export function usPlaceKey(city, state) {
  const d = load();
  if (!d?.places || !city || !state) return null;
  const st = String(state).trim().length === 2 ? String(state).trim().toUpperCase() : ST[String(state).trim().toLowerCase()];
  if (!st) return null;
  const n = String(city).trim().toLowerCase().replace(/^(city of|town of)\s+/, "").replace(/^st\.?\s/, "saint ").replace(/\s+/g, " ");
  // the full name first ("Kansas City", "Salt Lake City"); then without a
  // Census type word ("Pittsburgh city" from the geocoder → "pittsburgh")
  const names = [n, n.replace(/\s+(city|town|village|borough|cdp)$/, "")];
  for (const x of names) for (const k of [`${x}|${st}`, `${x.replace(/^saint /, "st. ")}|${st}`]) if (d.places[k]) return k;
  return null;
}
// the county that holds 80%+ of that place's homes (Census summary level 155)
export function usPlaceCounty(city, state) {
  const k = usPlaceKey(city, state);
  return k ? load()?.placeCounty?.[k] || null : null;
}
// ZIP first; a city typed without a ZIP → the Census place of that name in that state
export function usRent(zip, bedrooms, city, state) {
  const d = load();
  if (!d) return null;
  const z = (String(zip || "").match(/\b(\d{5})\b/) || [])[1];   // "ZCTA5 60610" / "60610-1234"
  let row = z ? d.zcta[z] : null, place = null;
  if (!row && city && state && d.places) {
    const k = usPlaceKey(city, state);
    if (k) { place = d.places[k][0]; row = d.places[k].slice(1); }
  }
  if (!row) return null;
  const b = Number(bedrooms);
  const i = Number.isFinite(b) && bedrooms !== null && bedrooms !== "" ? Math.min(6, Math.max(1, Math.round(b) + 1)) : 0;
  let v = row[i], missing = null;
  // no median for that bedroom count (too few sampled homes) → the
  // all-homes median, as context only (never the yield basis)
  if (v == null && i > 0 && row[0] != null) { missing = LABEL[i]; v = row[0]; }
  if (v == null) return null;
  return { zip: place ? null : z, place, label: missing ? LABEL[0] : LABEL[i], missingLabel: missing, value: Math.abs(v), topCoded: v < 0, source: d.source, period: d.period };
}
