/* PRADIXIUM™ — Dubai: registered sale prices from the Dubai Land
 * Department's own transaction records (dubailand.gov.ae → Open Data →
 * Real Estate Data → Transactions), built by scripts/build-dubai-sales.py
 * into lib/data/dubaiSales.json (6 months up to the latest sale).
 * The DLD portal does not answer servers → the export is downloaded in a
 * normal browser and rebuilt; nothing is fetched at report time.
 *
 * Matching (all on what the customer typed, never guessed):
 *  - a DLD project / building name in the text (10+ sales) → that project
 *  - else a DLD area name (or a common abbreviation of it: JVC, JLT …) →
 *    flats: the area's median for the same number of bedrooms when 10+
 *    sales, else the area's median; villas: the area's median whole price
 *  - ready and off-plan are separate; a ready property is compared with
 *    ready sales only (the off-plan median is context), and vice versa
 *  - nothing matched → no figure (the text says to enter the DLD area)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function data() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "dubaiSales.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
export const DLD_SOURCE = "Dubai Land Department — registered transactions (Open Data, Real Estate Data)";
export const DLD_URL = "https://dubailand.gov.ae/en/open-data/real-estate-data/";
// abbreviations of the DLD area names themselves
const ALIASES = { JVC: "JUMEIRAH VILLAGE CIRCLE", JVT: "JUMEIRAH VILLAGE TRIANGLE", JLT: "JUMEIRAH LAKES TOWERS", JBR: "JUMEIRAH BEACH RESIDENCE", DSO: "SILICON OASIS", "DUBAI SILICON OASIS": "SILICON OASIS", "INTERNATIONAL CITY": "INTERNATIONAL CITY PH 1", "DUBAI CREEK": "DUBAI CREEK HARBOUR",
  // DLD registers Downtown Dubai under the area "Burj Khalifa": the export's
  // own projects there are Downtown's (St. Regis / Vida "Downtown Dubai",
  // The Address Dubai Opera, Boulevard Point, Act One | Act Two) and DLD's
  // nearest-landmark field reads "Downtown Dubai" for most of its sales
  "DOWNTOWN DUBAI": "BURJ KHALIFA", DOWNTOWN: "BURJ KHALIFA" };
const ALIAS_NOTE = { "BURJ KHALIFA": " Downtown Dubai is registered by the Dubai Land Department as the area \"Burj Khalifa\" (its projects there include The Address Dubai Opera, Boulevard Point and Act One | Act Two); some towers marketed as \"Downtown\" are registered in Business Bay — enter the project name for those." };
const up = (s) => ` ${String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9&()]+/g, " ").replace(/\s+/g, " ").trim()} `;
const roomsLabel = (b) => (b === 0 ? "Studio" : b > 0 && b <= 7 ? `${b} B/R` : null);
const fmt = (n) => Math.round(n).toLocaleString("en-US");

export function dubaiBenchmark({ text, propertyType, bedrooms }) {
  const d = data();
  if (!d) return null;
  const t = up(text);
  if (!/ DUBAI | UAE | EMIRATES /.test(t) && !Object.keys(ALIASES).some((a) => t.includes(` ${a} `)) && !d.meta.areas.some((a) => t.includes(` ${a} `))) return null;
  const isVilla = /house|villa|town/i.test(String(propertyType || "")) && !/apart|flat|studio|penthouse/i.test(String(propertyType || ""));
  const kind = isVilla ? "villa" : "flat";
  const stage = /off[\s-]?plan/i.test(String(text || "")) ? "offplan" : "ready";
  const other = stage === "ready" ? "offplan" : "ready";
  const g = d.groups;
  const meta = d.meta;

  // longest DLD project name in the text (a building name is the narrowest match)
  const projects = [...new Set(Object.keys(g).filter((k) => k.startsWith("P|")).map((k) => k.split("|")[1]))].filter((p) => p.length >= 6).sort((a, b) => b.length - a.length);
  const project = projects.find((p) => t.includes(` ${p} `));
  let area = null;
  let aliasUsed = false;
  for (const [abbr, full] of Object.entries(ALIASES)) if (full && t.includes(` ${abbr} `)) { area = full; aliasUsed = true; break; }
  if (!area) area = [...meta.areas].sort((a, b) => b.length - a.length).find((a) => t.includes(` ${a} `)) || null;

  const pick = (key) => (g[key] && g[key].n >= 10 ? { key, ...g[key] } : null);
  const rooms = kind === "flat" && bedrooms != null && bedrooms !== "" ? roomsLabel(Number(bedrooms)) : null;
  const areaLabel = area === "BURJ KHALIFA" && aliasUsed ? "Downtown Dubai (DLD area Burj Khalifa)" : area ? `${titleCase(area)} (DLD area)` : null;
  const tries = [];
  if (project) tries.push([`P|${project}|${kind}|${stage}`, `${titleCase(project)} (DLD project)`, null]);
  if (area && rooms) tries.push([`R|${area}|${rooms}|${stage}`, areaLabel, rooms === "Studio" ? "studios" : `${rooms.replace(" B/R", "-bedroom")} flats`]);
  if (area) tries.push([`A|${area}|${kind}|${stage}`, areaLabel, null]);
  let hit = null, label = null, roomWord = null;
  for (const [key, l, r] of tries) { hit = pick(key); if (hit) { label = l; roomWord = r; break; } }
  const otherHit = area ? pick(`A|${area}|${kind}|${other}`) : null;
  const typeWord = kind === "villa" ? "villas" : roomWord || "flats";
  const stageWord = (s) => (s === "ready" ? "ready" : "off-plan");
  const otherText = otherHit ? ` For comparison, ${stageWord(other)} ${kind === "villa" ? "villas" : "flats"} in ${titleCase(area)}: ${kind === "villa" ? `median AED ${fmt(otherHit.median)}` : `median AED ${fmt(otherHit.median)}/m²`} (${otherHit.n} sales) — ${other === "offplan" ? "off-plan prices are for a future delivery, not comparable" : "not comparable with an off-plan purchase"}.` : "";
  const period = `${meta.from} to ${meta.to}`;

  if (!hit) {
    return {
      found: false, area: area ? titleCase(area) : null,
      text: area
        ? `Dubai Land Department records hold fewer than 10 ${stageWord(stage)} ${kind === "villa" ? "villa" : "flat"} sales in ${titleCase(area)} between ${period} — no area figure.${otherText}`
        : `No Dubai Land Department area was recognised in "${String(text || "").trim()}". Enter the DLD area (for example Business Bay, Dubai Marina, Jumeirah Village Circle, Palm Jumeirah) or the project name to get the registered sale prices.`
    };
  }
  const isTotal = kind === "villa";
  return {
    found: true,
    value: hit.median, unit: isTotal ? "total" : "perSqm", currency: "AED", area: label, period, sales: hit.n,
    label: `DLD registered sales — ${label}`,
    text: `Dubai Land Department registered sales, ${period}: ${hit.n} ${stageWord(stage)} ${typeWord} in ${label}, median ${isTotal ? `AED ${fmt(hit.median)} per villa (whole price; DLD's recorded area for a villa may be the plot, so no per-m² figure)` : `AED ${fmt(hit.median)} per m² of the unit's registered area`} (middle half AED ${fmt(hit.p25)}–${fmt(hit.p75)}${isTotal ? "" : "/m²"}). Only "Sale" and off-plan "Sell - Pre registration" deeds of a single property; gifts, mortgages, developer registrations and multi-property deeds excluded.${aliasUsed && !hit.key.startsWith("P|") ? ALIAS_NOTE[area] || "" : ""}${otherText}`,
    source: DLD_SOURCE, sourceUrl: DLD_URL
  };
}
function titleCase(s) { return String(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bDmcc\b/, "DMCC").replace(/\bMbr\b/, "MBR").replace(/\b(I{1,3}|Iv)\b/gi, (m) => m.toUpperCase()); }
