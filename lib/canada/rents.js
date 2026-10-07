/* PRADIXIUM™ — Canada: CMHC Rental Market Survey average rent by bedrooms
 * (purpose-built rental of 3+ units, October survey) per centre — Statistics
 * Canada table 34-10-0133, lib/data/canadaRents.json ← scripts/build-ca-
 * rents.py. Rented condominiums and houses are NOT in it — said so.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc, names;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "canadaRents.json"), "utf8")); } catch { doc = null; }
    names = {};
    const STOP = new Set(["saint", "sainte", "sur", "de", "la", "les", "du", "des", "st"]);
    for (const g of Object.keys(doc?.geo || {})) {
      if (/Ontario\/Quebec$/.test(g) && !/ part,/.test(g)) continue;   // the whole two-province CMA: use its parts
      const head = g.split(",")[0];
      const prov = g.split(",").slice(1).join(",");
      const add = (n) => { n = norm(n); if (n.length > 2 && !STOP.has(n)) (names[n] = names[n] || []).push(g); };
      add(head);
      if (/^(Ottawa-Gatineau|Kitchener-Cambridge-Waterloo|Abbotsford-Mission|St\. Catharines-Niagara)/.test(head)) {
        const ps = head.split("-");
        if (/Ottawa-Gatineau/.test(head)) add(/Ontario part/.test(prov) ? "Ottawa" : "Gatineau");
        else ps.forEach(add);
      }
    }
  }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const PROV = /\b(on|ontario|bc|british columbia|qc|quebec|ab|alberta|mb|manitoba|sk|saskatchewan|ns|nova scotia|nb|new brunswick|nl|newfoundland|pe|pei|prince edward island)\b/;
const PROV_NAME = { on: "Ontario", ontario: "Ontario", bc: "British Columbia", "british columbia": "British Columbia", qc: "Quebec", quebec: "Quebec", ab: "Alberta", alberta: "Alberta", mb: "Manitoba", manitoba: "Manitoba", sk: "Saskatchewan", saskatchewan: "Saskatchewan", ns: "Nova Scotia", "nova scotia": "Nova Scotia", nb: "New Brunswick", "new brunswick": "New Brunswick", nl: "Newfoundland and Labrador", newfoundland: "Newfoundland and Labrador", pe: "Prince Edward Island", pei: "Prince Edward Island", "prince edward island": "Prince Edward Island" };

export function canadaRent(text, bedrooms) {
  const d = load();
  if (!d) return null;
  const parts = String(text || "").split(",").map(norm).filter(Boolean);
  const pm = parts.map((p) => PROV.exec(p)).find(Boolean);
  const prov = pm ? PROV_NAME[pm[1]] : null;
  let geo = null;
  for (const p of parts) {
    const c = names[p] || names[p.replace(/^(city of|ville de) /, "")];
    if (!c) continue;
    const pick = c.length === 1 ? c[0] : prov ? c.find((g) => g.includes(prov)) : null;
    if (pick) { geo = pick; break; }
  }
  if (!geo) return null;
  const b = Number(bedrooms);
  const i = Number.isFinite(b) && bedrooms !== null && bedrooms !== "" ? Math.min(3, Math.max(0, Math.round(b))) : null;
  const row = d.geo[geo];
  if (i == null || row[i] == null) return { geo, row, year: d.year, source: d.source, url: d.url, monthly: null };
  return { geo, row, year: d.year, source: d.source, url: d.url, beds: i, monthly: row[i] };
}
