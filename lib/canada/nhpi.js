/* PRADIXIUM™ — Canada: Statistics Canada New Housing Price Index (table
 * 18-10-0205, monthly; lib/data/canadaPrices.json ← scripts/build-ca-
 * prices.py): change of the "house and land" index on a year earlier per
 * metro area (CMA), else province. NEW homes only (builders' selling prices
 * of the same model homes) → the trend of a house; for a flat it is context
 * (the index has no condominium apartments). No official price LEVEL exists
 * per city (CHSP's market-sale medians are empty in table 46-10-0030).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function data() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "canadaPrices.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const PROV = { on: "Ontario", ontario: "Ontario", bc: "British Columbia", "british columbia": "British Columbia", qc: "Quebec", quebec: "Quebec",
  ab: "Alberta", alberta: "Alberta", mb: "Manitoba", manitoba: "Manitoba", sk: "Saskatchewan", saskatchewan: "Saskatchewan",
  ns: "Nova Scotia", "nova scotia": "Nova Scotia", nb: "New Brunswick", "new brunswick": "New Brunswick", nl: "Newfoundland and Labrador",
  newfoundland: "Newfoundland and Labrador", pe: "Prince Edward Island", pei: "Prince Edward Island", "prince edward island": "Prince Edward Island" };

export function canadaTrend({ text, propertyType }) {
  const d = data();
  if (!d) return null;
  // CMA names: "Ottawa-Gatineau, Ontario part" → ottawa, gatineau; "Saint John, Fredericton, and Moncton" → each
  const cma = {};
  for (const k of Object.keys(d.nhpi)) {
    if (!k.includes(",") && !/^(Ottawa|Kitchener)/.test(k)) continue;
    const head = k.replace(/, (Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland and Labrador|Prince Edward Island)( part)?.*$/, "").replace(/,? Quebec part| Ontario part/, "");
    for (const n of head.split(/,\s*(?:and\s+)?|-|\s+and\s+/)) if (n.trim() && !cma[norm(n)]) cma[norm(n)] = k;
  }
  cma.montreal = cma.montreal || Object.keys(d.nhpi).find((k) => k.startsWith("Montréal"));
  const parts = String(text || "").split(",").map(norm).filter(Boolean);
  let key = null;
  for (const p of parts) if (cma[p]) { key = cma[p]; break; }
  if (!key) for (const p of parts) { const w = p.split(" ").pop(); if (PROV[p] || PROV[w]) { key = PROV[p] || PROV[w]; break; } }
  if (!key || !d.nhpi[key]) return { found: false, text: "No Canadian metro area or province was recognised — enter the city and province (for example \"Toronto, ON\") to get Statistics Canada's new-home price trend." };
  const v = d.nhpi[key];
  const isHouse = !/apart|flat|condo|studio|penthouse/i.test(String(propertyType || ""));
  const area = key.replace(/, (Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland and Labrador|Prince Edward Island)$/, "");
  return {
    found: true, area, period: v.period, trend: isHouse ? v.yoy : null,
    text: `Statistics Canada New Housing Price Index, ${v.period}: ${area} ${v.yoy >= 0 ? "+" : ""}${v.yoy}% on a year earlier (house and land; builders' selling prices of the same new model homes).${isHouse ? "" : " The index covers new houses only, not condominium apartments — shown as context, not as this flat's trend."} Statistics Canada publishes no official sale-price level per city.`,
    source: d.nhpiSource, sourceUrl: d.nhpiUrl
  };
}
