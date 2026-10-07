/* PRADIXIUM™ — Turkey: EVDS series codes of TCMB's house price index
 * (KFE, hedonic, all dwellings, 2023=100) and new-tenant rent index (YKKE)
 * for Türkiye and every İBBS region group (TCMB's own list of provinces),
 * lib/data/turkeyKfe.json ← scripts/build-tr-kfe.py. Values are fetched
 * live from EVDS (its terms allow use with the source named). Place →
 * province by name, or by a district of a few provinces international
 * buyers name instead of the province.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "turkeyKfe.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}

const fold = (s) => String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
  .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u");

// districts → their province (official administrative districts)
const DISTRICTS = {
  antalya: ["alanya", "kemer", "kas", "kalkan", "manavgat", "side", "serik", "belek", "konyaalti", "muratpasa", "lara", "kepez", "aksu", "dosemealti", "gazipasa", "finike", "kumluca", "demre"],
  mugla: ["bodrum", "fethiye", "marmaris", "dalaman", "datca", "oludeniz", "gocek", "yalikavak", "turgutreis", "gumusluk", "milas", "ortaca", "koycegiz", "ula", "mentese"],
  aydin: ["kusadasi", "didim", "soke", "efeler", "nazilli"],
  izmir: ["cesme", "alacati", "urla", "seferihisar", "karsiyaka", "bornova", "konak", "buca", "bayrakli", "gaziemir", "menemen", "dikili", "foca", "torbali"],
  istanbul: ["besiktas", "kadikoy", "sisli", "beyoglu", "uskudar", "sariyer", "esenyurt", "beylikduzu", "basaksehir", "atasehir", "bakirkoy", "kucukcekmece", "avcilar", "buyukcekmece", "pendik", "kartal", "maltepe", "zeytinburnu", "fatih", "eyupsultan", "kagithane", "umraniye", "cekmekoy", "sile", "silivri", "catalca", "arnavutkoy", "beykoz", "sancaktepe", "sultanbeyli", "tuzla", "bagcilar", "bahcelievler", "gaziosmanpasa", "esenler", "gungoren", "bayrampasa", "sultangazi", "adalar", "nisantasi", "levent", "etiler", "bebek", "cihangir", "taksim", "moda", "bagdat"],
  ankara: ["cankaya", "yenimahalle", "kecioren", "etimesgut", "mamak", "sincan", "golbasi", "pursaklar", "altindag"],
  bursa: ["mudanya", "nilufer", "osmangazi", "yildirim", "gemlik", "inegol"],
  mersin: ["erdemli", "mezitli", "silifke", "yenisehir", "toroslar", "akdeniz", "tarsus"],
  yalova: ["cinarcik", "termal"],
  trabzon: ["ortahisar", "akcaabat", "uzungol"],
  kocaeli: ["izmit", "gebze", "kartepe"],
  sakarya: ["sapanca", "adapazari"]
};

function words(s) { return fold(s).split(/[^a-z0-9]+/).filter(Boolean); }

export function turkeyRegion(place) {
  const d = load();
  if (!d) return null;
  const w = new Set(words(place));
  if (!w.size) return { doc: d, region: null };
  // Northern Cyprus places are not Turkey's statistics (Girne/Kyrenia, Lefkoşa…)
  const hit = (prov) => w.has(fold(prov).replace(/[^a-z0-9]/g, "")) || (DISTRICTS[fold(prov)] || []).some((x) => w.has(x));
  for (const r of d.regions) {
    const prov = r.provinces.find((p) => hit(p));
    if (prov) return { doc: d, region: r, province: prov };
  }
  return { doc: d, region: null };
}

export const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function kfePeriodLabel(p) {
  const [y, m] = String(p || "").split("-").map(Number);
  return y && m ? `${MON[m - 1]} ${y}` : String(p || "");
}

// TCMB's province series codes (unit price / unit rent tables) for a place
export function turkeyUnitCodes(province) {
  const d = load();
  if (!d?.unitPriceCodes || !province) return null;
  const key = Object.keys(d.unitPriceCodes).find((k) => fold(k) === fold(province));
  if (!key) return null;
  return { province: key, price: d.unitPriceCodes[key], rent: d.unitRentCodes?.[key] || null,
    priceTR: d.unitPriceCodes["Türkiye"], rentTR: d.unitRentCodes?.["Türkiye"] || null };
}
