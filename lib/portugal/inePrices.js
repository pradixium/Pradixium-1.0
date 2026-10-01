/* PRADIXIUM™ — Portugal: INE local housing prices (median €/m² of actual
 * sales, last 12 months), from lib/data/portugalPrices.json
 * (scripts/build-pt-prices.py, INE indicator 0012241, refreshed quarterly).
 * Parish → municipality → nothing. Parish detail and the bedroom split
 * (0012241) exist only for the Lisbon and Porto metro areas, the Algarve
 * and municipalities over 100,000 inhabitants; every other municipality
 * has the all-dwellings median from INE 0012236 (allTypesOnly, same figure
 * as 0012241's "Total" where both exist). The NUTS III region is never
 * applied as a property's benchmark.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function data() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "portugalPrices.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// resort/locality names customers use → the INE parish or municipality
const LOCALITIES = {
  "lisbon": "lisboa", "oporto": "porto", "vale do lobo": "almancil", "quinta do lago": "almancil", "vilamoura": "quarteira",
  "praia da luz": "luz", "estoril": "cascais e estoril", "monte estoril": "cascais e estoril", "sintra": "sintra",
  "comporta": "grandola", "algarve": "algarve", "madeira": "regiao autonoma da madeira", "azores": "regiao autonoma dos acores"
};
const words = (s) => norm(s).split(" ");

// exact parish → exact municipality → a union parish that contains the
// name ("União das freguesias de Cascais e Estoril"); never a partial hit on
// an ordinary name ("Porto" must not become "Porto Salvo")
function findArea(names) {
  const d = data();
  const wants = names.map((raw) => LOCALITIES[norm(raw)] || norm(raw)).filter(Boolean);
  for (const level of ["parish", "municipality"]) {
    for (const want of wants) {
      const exact = d.areas.filter((a) => a.level === level && norm(a.name) === want);
      if (exact.length === 1) return exact[0];
    }
  }
  for (const want of wants) {
    const part = [...new Set(d.areas.filter((a) => a.level === "parish" && /\be\b/.test(norm(a.name)) && (` ${norm(a.name)} `).includes(` ${want} `)))];
    if (part.length === 1) return part[0];
  }
  return null;
}

function typeKey(bedrooms) {
  const b = Number(bedrooms);
  if (!Number.isFinite(b) || b <= 0) return null;
  return b <= 1 ? "T0 ou T1" : b === 2 ? "T2" : b === 3 ? "T3" : "T4 ou mais";
}

// "1.º Trimestre de 2026" → "Q1 2026"
const quarter = (p) => { const m = /(\d)\.\S*\s+Trimestre de (\d{4})/i.exec(String(p || "")); return m ? `Q${m[1]} ${m[2]}` : p; };

export function portugalLocalPrice({ city, address, bedrooms }) {
  const d = data();
  if (!d) return { status: "no_data" };
  // every comma part of the address, then the city: "Rua X, Almancil" → Almancil
  const names = [...String(address || "").split(","), ...String(city || "").split(",")].map((s) => s.trim()).filter(Boolean);
  const area = findArea(names);
  if (!area) return { status: "not_covered", source: d.source, sourceUrl: d.sourceUrl, period: quarter(d.period) };
  const t = typeKey(bedrooms);
  const byType = t && area.byType[t] != null ? { key: t, value: area.byType[t] } : null;
  return {
    status: "ok", source: d.source, sourceUrl: d.sourceUrl, period: quarter(d.period), comparedWith: quarter(d.comparedWith),
    area: area.name, code: area.code, level: area.level, municipality: area.municipality || null, nuts3: area.nuts3 || null,
    medianEurPerM2: area.byType.Total ?? null, byType: area.byType, typeMatch: byType, yoyPercent: area.yoyPercent
  };
}

// INE median rent per m² of NEW lease contracts, 12 months to the quarter
// (lib/data/portugalRents.json ← scripts/build-pt-rents.py, INE 0014696):
// the matched parish, else its municipality (code[:7]); never a region or
// the country as a property's rent.
let rents;
export function portugalRent({ code, area, municipality }) {
  if (rents === undefined) { try { rents = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "portugalRents.json"), "utf8")); } catch { rents = null; } }
  if (!rents || !code) return null;
  const own = rents.areas[code];
  const mun = code.length > 7 ? rents.areas[code.slice(0, 7)] : null;
  const hit = own ? { ...own, where: own.name, level: code.length > 7 ? "parish" : "municipality" } : mun ? { ...mun, where: mun.name, level: "municipality", note: `INE publishes no rent for ${area} itself` } : null;
  return hit ? { ...hit, period: rents.period, comparedWith: rents.comparedWith, source: rents.source, sourceUrl: rents.sourceUrl } : null;
}
