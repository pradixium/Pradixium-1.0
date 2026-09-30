/* PRADIXIUM™ — Cyprus: the Central Bank of Cyprus RPPI change on a year
 * earlier for the property's own district and type (flats / houses) —
 * lib/data/cyprusIndexPrices.json ← scripts/build-cy-rppi.py. A town not in the
 * list → the national change, named as national.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

// towns and resort areas → administrative district (free area)
const DISTRICT_TOWNS = {
  Nicosia: ["nicosia", "lefkosia", "strovolos", "lakatamia", "latsia", "aglantzia", "engomi", "egkomi", "agios dometios", "geri", "tseri", "dali", "kokkinotrimithia", "pallouriotissa", "akropolis"],
  Limassol: ["limassol", "lemesos", "germasogeia", "germasogia", "agios athanasios", "mesa geitonia", "kato polemidia", "polemidia", "ypsonas", "agios tychonas", "agios tychon", "mouttagiaka", "pissouri", "parekklisia", "pyrgos", "episkopi", "erimi", "kolossi", "platres", "amathus", "amathounta", "potamos germasogeias", "palodia", "trachoni"],
  Larnaca: ["larnaca", "larnaka", "aradippou", "livadia", "dromolaxia", "oroklini", "voroklini", "pervolia", "mazotos", "kiti", "zygi", "athienou", "lefkara", "xylofagou", "pyla", "mackenzie", "meneou", "tersefanou", "kalo chorio"],
  Paphos: ["paphos", "pafos", "geroskipou", "yeroskipou", "peyia", "pegeia", "coral bay", "chloraka", "emba", "empa", "kissonerga", "tala", "tsada", "polis", "polis chrysochous", "latchi", "latsi", "kouklia", "aphrodite hills", "konia", "mesogi", "argaka", "neo chorio", "sea caves"],
  Famagusta: ["famagusta", "ammochostos", "ayia napa", "agia napa", "paralimni", "protaras", "kapparis", "deryneia", "dherynia", "sotira", "frenaros", "liopetri", "avgorou", "achna", "pernera"]
};
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

let data = null;
function load() {
  if (!data) {
    try { data = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "cyprusIndexPrices.json"), "utf8")); } catch { data = null; }
  }
  return data;
}

export function cyprusDistrict(text) {
  const t = ` ${norm(text)} `;
  let best = null;
  for (const [d, towns] of Object.entries(DISTRICT_TOWNS)) for (const town of towns) if (t.includes(` ${town} `) && (!best || town.length > best.len)) best = { d, len: town.length };
  return best?.d || null;
}

// → { period, area, flatsAnnualChangePercent, housesAnnualChangePercent, allAnnualChangePercent, source, sourceUrl }
export function cyprusRegionalTrend({ city, address } = {}) {
  const d = load();
  if (!d) return null;
  const district = cyprusDistrict(`${address || ""} ${city || ""}`);
  const v = district ? d.districts[district] : d.national;
  return { period: d.period, comparedWith: d.comparedWith, area: district ? `${district} district` : "Cyprus (national)", national: !district, flatsAnnualChangePercent: v.flats, housesAnnualChangePercent: v.houses, allAnnualChangePercent: v.all, nationalAll: d.national.all, sourceName: "Central Bank of Cyprus", source: d.source, sourceUrl: d.sourceUrl };
}
