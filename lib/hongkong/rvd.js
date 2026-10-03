/* PRADIXIUM™ — Hong Kong: Rating and Valuation Department figures
 * (lib/data/hongKong.json ← scripts/build-hk.py, monthly): average price
 * and rent per m² of SALEABLE area of second-hand private flats, by region
 * (Hong Kong Island / Kowloon / New Territories) × class (A < 40 m² …
 * E ≥ 160 m²); price index change by class; market yields by class.
 * Place → region from the 18 districts (RVD's regions: Kowloon includes
 * New Kowloon) and well-known areas inside them.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "hongKong.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const AREAS = {
  "Hong Kong Island": ["hong kong island", "central and western", "central", "sheung wan", "sai ying pun", "kennedy town", "mid levels", "mid-levels", "the peak", "pok fu lam", "pokfulam", "wan chai", "causeway bay", "happy valley", "tai hang", "jardine's lookout", "eastern", "north point", "quarry bay", "tai koo", "taikoo", "sai wan ho", "shau kei wan", "chai wan", "southern", "aberdeen", "ap lei chau", "repulse bay", "stanley", "deep water bay", "wong chuk hang", "admiralty"],
  "Kowloon": ["kowloon", "yau tsim mong", "tsim sha tsui", "jordan", "yau ma tei", "mong kok", "mongkok", "tai kok tsui", "west kowloon", "sham shui po", "cheung sha wan", "lai chi kok", "mei foo", "kowloon city", "ho man tin", "kowloon tong", "to kwa wan", "hung hom", "kai tak", "wong tai sin", "diamond hill", "kwun tong", "kowloon bay", "ngau tau kok", "lam tin", "yau tong"],
  "New Territories": ["new territories", "kwai tsing", "kwai chung", "tsing yi", "tsuen wan", "tuen mun", "yuen long", "tin shui wai", "north district", "sheung shui", "fanling", "tai po", "sha tin", "shatin", "ma on shan", "sai kung", "tseung kwan o", "clear water bay", "islands district", "lantau", "tung chung", "discovery bay", "ma wan", "cheung chau", "lamma"]
};
const CLASS_RANGES = { A: [0, 40], B: [40, 70], C: [70, 100], D: [100, 160], E: [160, Infinity] };

export function hongKongData({ text, size } = {}) {
  const d = load();
  if (!d) return null;
  const t = ` ${String(text || "").toLowerCase().replace(/[^a-z' -]+/g, " ").replace(/\s+/g, " ")} `;
  // the most specific (longest) area name wins: "kowloon city" before "kowloon"
  let region = null, area = null;
  for (const [rg, list] of Object.entries(AREAS)) for (const a of list) if (t.includes(` ${a} `) && (!area || a.length > area.length)) { region = rg; area = a; }
  const cls = size > 0 ? Object.keys(CLASS_RANGES).find((k) => size >= CLASS_RANGES[k][0] && size < CLASS_RANGES[k][1]) : null;
  const pick = (block, k) => (k && block?.v?.[k]) ? { ...block.v[k], period: block.period, provisional: block.provisional } : null;
  const key = region && cls ? `${cls}|${region}` : null;
  return {
    region, area, cls, classRange: cls ? CLASS_RANGES[cls] : null,
    price: pick(d.prices, key), rent: pick(d.rents, key),
    trend: cls ? { period: d.index.period, provisional: d.index.provisional, change: d.index.byClass[cls], all: d.index.byClass.All } : { period: d.index.period, provisional: d.index.provisional, change: d.index.byClass.All, all: d.index.byClass.All },
    yieldPct: cls ? d.yields.v[cls]?.value ?? null : null, yieldPeriod: d.yields.period,
    source: d.source, sourceUrl: d.sourceUrl
  };
}
