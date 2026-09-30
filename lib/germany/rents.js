/* PRADIXIUM™ — Germany: Zensus 2022 average net cold rent per m² of let
 * dwellings, per municipality (lib/data/germany/rents.json ←
 * scripts/build-de-rents.py). Census reference date 15 May 2022; covers all
 * existing tenancies, not new-letting rents — said wherever it is shown.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let data = null, byName = null;
function load() {
  if (data) return data;
  try { data = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "germany", "rents.json"), "utf8")); } catch { data = { municipalities: {} }; }
  byName = new Map();
  for (const [ags, m] of Object.entries(data.municipalities)) {
    const k = key(m.name.split(",")[0]);
    byName.set(k, byName.has(k) ? null : ags);   // a name used by several municipalities → ambiguous
  }
  for (const [alias, ags] of Object.entries(ALIASES)) if (data.municipalities[ags]) byName.set(alias, ags);
  return data;
}
const key = (s) => String(s || "").toLowerCase().replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-z0-9]/g, "");
const ALIASES = { munich: "09162000", muenchen: "09162000", cologne: "05315000", nuremberg: "09564000", frankfurt: "06412000", frankfurtammain: "06412000", hanover: "03241001", hannover: "03241001", berlin: "11000000", hamburg: "02000000", bremen: "04011000", dusseldorf: "05111000", stuttgart: "08111000", leipzig: "14713000", dresden: "14612000" };

// { ags } (known, e.g. from NRW's address register) or the typed place
export function germanRent({ ags, address, city } = {}) {
  const d = load();
  let code = ags && d.municipalities[ags] ? ags : null;
  if (!code) {
    for (const p of [address, city].filter(Boolean).join(",").split(/[,;\n]/)) {
      const k = key(p.replace(/\b\d{5}\b/g, "").replace(/\b(deutschland|germany)\b/gi, ""));
      if (k && byName.get(k)) { code = byName.get(k); break; }
    }
  }
  if (!code) return null;
  const m = d.municipalities[code];
  return { ags: code, municipality: m.name.split(",")[0], land: m.land, rentPerSqm: m.rent, letDwellings: m.letDwellings, date: d.date, source: d.source, sourceUrl: d.sourceUrl };
}
