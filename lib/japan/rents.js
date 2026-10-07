/* PRADIXIUM™ — Japan: average monthly rent per m² of floor area of private
 * rented homes (民営借家, rent-free excluded), 2023 Housing and Land Survey
 * table 122-4 (Statistics Bureau) ← scripts/build-jp-rents.py.
 * Place: a 7-digit postcode, else the municipality / ward typed (a ward of
 * a designated city only with its city; a prefecture typed narrows), else a
 * Japan Post town name that points to one municipality, else the prefecture
 * when only that is typed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "japanRents.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const cap = (s) => String(s || "").replace(/(^|[ -])([a-z])/g, (m, a, b) => a + b.toUpperCase());

export function japanRent(text) {
  const d = load();
  if (!d) return null;
  const raw = String(text || "");
  const a = d.areas;
  const label = (code) => {
    const x = a[code];
    const pref = a[x.p + "000"]?.n;
    return x.k === "pref" ? `${cap(x.n)} prefecture (whole prefecture)` : x.k === "ward" ? `${cap(x.n)} ward, ${cap(x.city)}` : `${cap(x.n)}${pref && pref !== x.n ? `, ${cap(pref)}` : ""}`;
  };
  const res = (code, by) => ({ code, by, area: label(code), level: a[code].k, perM2: a[code].perM2, homes: a[code].homes, year: d.year, source: d.source, url: d.url });
  const zm = raw.match(/\b(\d{3})-?(\d{4})\b/);
  if (zm && d.zip[zm[1] + zm[2]]) return res(d.zip[zm[1] + zm[2]], "postcode");
  const t = " " + raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ō|ô/g, "o").replace(/ū/g, "u")
    .replace(/[-\s](ku|shi|city|ward|cho|machi|mura|town|village|ken|prefecture|fu|to)\b/g, " ").replace(/[^a-z]+/g, " ") + " ";
  const has = (n) => t.includes(" " + n + " ") || t.includes(" " + n.replace(/ /g, "") + " ");
  const prefs = Object.entries(a).filter(([, x]) => x.k === "pref" && has(x.n)).map(([c]) => c.slice(0, 2));
  const cities = Object.values(a).filter((x) => x.k === "city" && has(x.n)).map((x) => x.n);
  const inPref = (c) => !prefs.length || prefs.includes(a[c].p);
  const cand = Object.entries(a).filter(([c, x]) => x.k !== "pref" && has(x.n) && inPref(c) && (x.k !== "ward" || cities.includes(x.city)));
  for (const lvl of ["ward", "muni", "city"]) {
    let at = cand.filter(([, x]) => x.k === lvl && !(lvl === "muni" && cities.includes(x.n) && cand.some(([, y]) => y.k === "city" && y.n === x.n)));
    if (lvl === "muni") at = at.filter(([, x]) => !prefs.some((p) => a[p + "000"].n === x.n));   // "Naha, Okinawa" / "Okinawa": the prefecture, not Okinawa city
    // "Kita" alone: Tokyo's Kita ward-city, or Kita ward of Osaka / Nagoya …
    if (lvl === "muni" && at.length === 1 && !prefs.length && Object.values(a).some((y) => y.k === "ward" && y.n === at[0][1].n)) return { ambiguous: [label(at[0][0]), "a ward of that name in another city"] };
    if (at.length === 1) return res(at[0][0], "name");
    if (at.length > 1) return { ambiguous: at.map(([c]) => label(c)) };
  }
  const tw = [...new Set(t.trim().split(" ").filter((w) => w.length >= 4).flatMap((w) => (d.towns[w] || []).filter(inPref)))];
  if (tw.length === 1) return res(tw[0], "town");
  if (prefs.length === 1) return res(prefs[0] + "000", "prefecture");
  return null;
}
