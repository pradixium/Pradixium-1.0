/* PRADIXIUM™ — Germany outside NRW: the big cities' own valuation boards
 * (Gutachterausschüsse) publish price levels per m² of living area from
 * their register of all sales — copied by hand, with the board's own
 * definition, into lib/data/germany/cityReports.json. Only a figure marked
 * "benchmark" for the property's type is ever applied; with several such
 * figures (mid-terrace vs end-terrace…) none is.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let data = null;
function load() {
  if (!data) {
    try { data = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "germany", "cityReports.json"), "utf8")); } catch { data = { cities: {} }; }
  }
  return data;
}

const TYPES = { Apartment: ["flats"], House: ["detached"], Townhouse: ["semi", "terraced"] };
function typesFor(propertyType) {
  const t = String(propertyType || "");
  if (/apart|flat|studio|penthouse/i.test(t)) return TYPES.Apartment;
  if (/town|terrace|semi|row/i.test(t)) return TYPES.Townhouse;
  if (/house|villa|detached/i.test(t)) return TYPES.House;
  return [];
}

// → { status: "ok" | "several" | "context", city, …, main?, candidates?, others, notes }
export function germanCityReport({ ags, propertyType } = {}) {
  const c = ags ? load().cities[ags] : null;
  if (!c) return null;
  const want = typesFor(propertyType);
  const mine = c.values.filter((v) => want.includes(v.type) && v.use === "benchmark");
  const others = c.values.filter((v) => !mine.includes(v));
  const base = { city: c.city, board: c.board, period: c.period, source: c.source, sourceUrl: c.sourceUrl, notes: c.notes || [], others };
  if (mine.length === 1 || (mine.length > 1 && new Set(mine.map((v) => v.value)).size === 1)) return { ...base, status: "ok", main: mine[0] };
  if (mine.length > 1) return { ...base, status: "several", candidates: mine };
  return { ...base, status: "context" };
}
