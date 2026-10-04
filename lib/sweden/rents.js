/* PRADIXIUM™ — Sweden: SCB median annual rent per m² of rented dwellings
 * (hyresrätter: the rent-regulated first-hand rental stock) per
 * municipality, latest year — lib/data/swedenRents.json ←
 * scripts/build-se-rents.py.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "swedenRents.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ALIAS = { gothenburg: "Göteborg", goteborg: "Göteborg", "malmo": "Malmö" };
export function swedenRent(text) {
  const d = load();
  if (!d) return null;
  const t = ` ${norm(text)} `;
  let name = null;
  for (const [a, n] of Object.entries(ALIAS)) if (t.includes(` ${a} `)) { name = n; break; }
  if (!name) {
    const munis = Object.keys(d.regions).filter((r) => r !== "Sweden" && !/county$/i.test(r)).sort((a, b) => b.length - a.length);
    name = munis.find((m) => t.includes(` ${norm(m)} `)) || null;
  }
  const r = name && d.regions[name];
  if (!r) return null;
  return { municipality: name, perSqmYear: r[0], moe: r[1], year: d.year, source: d.source, url: d.url };
}

// SCB median price of sold tenant-owned flats (bostadsrätter) per metro
// area / county — a whole-flat price over a wide area → context only
let condo;
export function swedenCondo(text) {
  if (condo === undefined) { try { condo = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "swedenCondo.json"), "utf8")); } catch { condo = null; } }
  if (!condo) return null;
  const t = ` ${norm(text)} `;
  const METRO = [[/ (stockholm|solna|sundbyberg|nacka|lidingo|danderyd|taby|sollentuna|huddinge|jarfalla|botkyrka|haninge|tyreso|varmdo) /, "Greater Stockholm"], [/ (goteborg|gothenburg|molndal|partille|kungsbacka) /, "Greater Gothenburg"], [/ (malmo|lund|burlov|lomma|vellinge) /, "Greater Malmö"]];
  let region = (METRO.find(([re]) => re.test(t)) || [])[1] || null;
  if (!region) region = Object.keys(condo.regions).find((r) => /county$/.test(r) && t.includes(` ${norm(r.replace(/ county$/, ""))} `)) || null;
  const r = region && condo.regions[region];
  const [y0, y1] = condo.years;
  if (!r?.[y1]?.median) return null;
  return { region, year: y1, n: r[y1].n, median: r[y1].median * 1000, prevMedian: r[y0]?.median ? r[y0].median * 1000 : null, prevYear: y0, source: condo.source, url: condo.url };
}
