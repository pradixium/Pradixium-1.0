/* PRADIXIUM™ — City of Zurich condominium sale prices (Statistik Stadt
 * Zürich open data BAU515OD5157, via scripts/build-zh-condo.py): median
 * price per m² of living area of flats in Stockwerkeigentum sold in free
 * sale, latest year, by Stadtquartier / Stadtkreis. A quarter is used with
 * 10+ counted sales, else its Kreis, else the whole city. Flats only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function data() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "zurichCondoPrices.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const MIN = 10;

// "Seefeld, Zürich" / "Kreis 8, Zürich" / "Zürich" → a figure; null when the place is not the City of Zurich
export function zurichCondo(text) {
  const d = data();
  const parts = String(text || "").split(",").map(norm).filter(Boolean);
  if (!d || !parts.some((p) => /^(zurich|zuerich|zurich city|stadt zurich|8\d{3} zurich)$/.test(p) || /\bzurich\b/.test(p))) return null;
  const byCode = Object.fromEntries(d.areas.map((a) => [a.code, a]));
  const ok = (a) => a && a.perM2 && a.sales != null && a.sales >= MIN;
  let area = null;
  for (const p of parts) {
    const k = /^kreis (\d{1,2})$/.exec(p);
    const hit = k ? byCode[k[1]] : d.areas.find((a) => a.level === "quartier" && norm(a.name) === p);
    if (hit) { area = hit; break; }
  }
  let used = area;
  if (used && !ok(used) && used.kreis) used = byCode[used.kreis];
  if (!ok(used)) used = byCode["0"];
  if (!ok(used)) return null;
  const label = used.level === "city" ? "City of Zurich" : used.level === "kreis" ? `Kreis ${used.code}, City of Zurich` : `${used.name} (Kreis ${used.kreis}), City of Zurich`;
  const note = area && used !== area ? ` (${area.name} has ${area.salesText || "too few"} sales — its ${used.level === "kreis" ? "Kreis" : "city"} figure is used)` : "";
  return {
    value: used.perM2, currency: "CHF", unit: "perSqm", area: label, placeMatched: true, period: d.year, appliesTo: "flats",
    basis: `actual registered sales (free-sale Handänderungen), median price per m² of living area of condominium flats (Stockwerkeigentum), ${used.sales} sales in ${d.year}; median per flat CHF ${used.perFlat?.toLocaleString("en-US")}${note}`,
    source: d.source, sourceUrl: d.sourceUrl
  };
}
