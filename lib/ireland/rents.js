/* PRADIXIUM™ — Ireland: RTB average monthly rent of NEW tenancies (CSO
 * RIQ02) by location, bedrooms and property type, latest quarter —
 * lib/data/irelandRents.json ← scripts/build-ie-rents.py. Narrowest place
 * the customer typed first: a locality ("Ballsbridge, Dublin 4"), a Dublin
 * postal district, then the county. Within a place: same type + bedrooms,
 * else same type, else all types with the bedrooms, else all homes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "irelandRents.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const has = (text, w) => ` ${text} `.includes(` ${w} `);

function places(text) {
  const d = load(), t = norm(text), out = [];
  const names = Object.keys(d.locations);
  // localities "X, County / Dublin N"
  const locs = names.filter((n) => n.includes(",")).map((n) => ({ n, a: norm(n.split(",")[0]), b: norm(n.split(",").slice(1).join(",")) })).filter((x) => x.a.length > 2 && has(t, x.a));
  const byName = {};
  for (const x of locs) (byName[x.a] = byName[x.a] || []).push(x);
  for (const xs of Object.values(byName)) {
    const pick = xs.length === 1 ? xs[0] : xs.find((x) => has(t, x.b));
    if (pick) out.push(pick.n);
  }
  const dm = /\bdublin\s*(\d{1,2})(\s*w)?\b|\bd\s?(\d{1,2})(w)?\b/.exec(t);
  if (dm) { const n = `Dublin ${dm[1] || dm[3]}${dm[2] || dm[4] ? "W" : ""}`; if (d.locations[n]) out.push(n); }
  for (const n of names) if (!n.includes(",") && !/^Dublin \d/.test(n) && has(t, norm(n))) out.push(n);
  return [...new Set(out)];
}

export function irelandRent(text, propertyType, bedrooms) {
  const d = load();
  if (!d) return null;
  const pt = String(propertyType || "");
  const type = /semi/i.test(pt) ? "Semi detached house" : /terrace|town ?house/i.test(pt) ? "Terrace house" : /detached|villa/i.test(pt) ? "Detached house" : /house|bungalow/i.test(pt) ? null : "Apartment";
  const b = Number(bedrooms);
  const beds = Number.isFinite(b) && b >= 1 ? (b >= 4 ? "Four plus bed" : ["One bed", "Two bed", "Three bed"][b - 1]) : null;
  const tries = [[type, beds], [type, "All bedrooms"], ["All property types", beds], ["All property types", "All bedrooms"]].filter(([t, x]) => t && x);
  for (const place of places(text)) {
    const rec = d.locations[place];
    for (const [t, x] of tries) {
      const v = rec?.[t]?.[x];
      if (v) return { place, type: t, beds: x, monthly: v, quarter: d.quarter, source: d.source, url: d.url };
    }
  }
  return null;
}
