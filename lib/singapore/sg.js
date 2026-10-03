/* PRADIXIUM™ — Singapore: URA official figures (lib/data/singapore.json ←
 * scripts/build-sg.py, quarterly): private residential price index by type
 * (landed / non-landed) and non-landed by region (CCR / RCR / OCR), and
 * the median rent per sq ft per month of major condo projects (10+ rental
 * contracts in the quarter). A project counts only when the customer typed
 * its exact URA name (one part of the address, or a long name inside it).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "singapore.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const norm = (s) => String(s || "").toUpperCase().replace(/[@&]/g, " ").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const SQFT_PER_M2 = 10.7639;

export function singaporeData({ text, propertyType, size } = {}) {
  const d = load();
  if (!d) return null;
  const landed = /house|villa|detached|terrace|bungalow|landed|semi/i.test(String(propertyType || "")) && !/apart|flat|condo/i.test(String(propertyType || ""));
  const ppi = landed ? d.ppi.landed : d.ppi.nonLanded;
  const t = norm(text);
  const parts = String(text || "").split(",").map(norm).filter(Boolean);
  // CCR / RCR / OCR only when the customer names the region
  const region = /\bCCR\b|CORE CENTRAL/.test(t) ? "Core Central Region" : /\bRCR\b|REST OF CENTRAL/.test(t) ? "Rest Of Central Region" : /\bOCR\b|OUTSIDE CENTRAL/.test(t) ? "Outside Central Region" : null;
  let project = null;
  if (!landed) {
    const names = Object.keys(d.rents.projects);
    project = names.find((n) => parts.includes(n)) ||
      names.filter((n) => (n.length >= 8 || n.includes(" ")) && new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(t)).sort((a, b) => b.length - a.length)[0] || null;
  }
  const r = project ? d.rents.projects[project] : null;
  const rent = r ? {
    project, district: r.district, period: d.rents.period, psfMonth: r.median, p25: r.p25, p75: r.p75, contracts: r.contracts,
    monthly: size > 0 ? Math.round(r.median * size * SQFT_PER_M2) : null, source: d.rents.source, sourceUrl: d.rents.sourceUrl
  } : null;
  return { landed, ppi, ppiAll: d.ppi.all, region: region ? { name: region, ...d.locality[region] } : null, ppiSource: d.ppi.source, ppiUrl: d.ppi.sourceUrl, rent };
}
