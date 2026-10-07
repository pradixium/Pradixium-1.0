/* PRADIXIUM™ — New Zealand: median WEEKLY rent of new private tenancies
 * (bonds lodged with MBIE Tenancy Services) ← scripts/build-nz-rents.py.
 * A suburb typed that is exactly one Stats NZ SA2 area → that area's latest
 * quarter by dwelling type × bedrooms (10+ bonds); several SA2s of that name
 * (Ponsonby East / West) → listed, not picked; else the territorial
 * authority's latest month, all dwellings.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "newZealandRents.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim();
const taCore = (n) => norm(n).replace(/ (city|district)$/, "");

function cell(v, propertyType, bedrooms) {
  const t = /apart|studio|penthouse|condo/i.test(String(propertyType || "")) ? "Apartment" : /house|villa|town|cottage|bungalow/i.test(String(propertyType || "")) ? "House" : "ALL";
  const b = Number(bedrooms);
  const bk = Number.isFinite(b) && bedrooms !== null && bedrooms !== "" && b >= 1 ? (b >= 5 ? "5+" : String(Math.round(b))) : "ALL";
  for (const k of [`${t}|${bk}`, `ALL|${bk}`, `${t}|ALL`, "ALL|ALL"]) if (v[k]) return { key: k, values: v[k] };
  return null;
}

export function newZealandRent(text, propertyType, bedrooms) {
  const d = load();
  if (!d) return null;
  const parts = String(text || "").split(",").filter((p) => !/\d/.test(p)).map(norm).filter((p) => p.length >= 3);   // never a street line
  const tas = Object.keys(d.ta).concat([...new Set(Object.values(d.sa2).map((s) => s.ta))]);
  const t = norm(text);
  const typedTa = [...new Set(tas)].sort((a, b) => taCore(b).length - taCore(a).length)
    .find((n) => { const c = taCore(n); return new RegExp(`(^|[ ,])${c.replace(/[-']/g, "[-' ]?")}($|[ ,])`).test(t) || (c.includes("-") && new RegExp(`(^|[ ,])${c.split("-")[0]}($|[ ,])`).test(t)); });
  const sas = Object.entries(d.sa2).filter(([, s]) => !typedTa || s.ta === typedTa);
  let several = null;
  for (const p of parts) {
    if (typedTa && taCore(typedTa) === p) continue;
    const exact = sas.filter(([, s]) => norm(s.n) === p);
    const pref = exact.length ? exact : sas.filter(([, s]) => norm(s.n).startsWith(p + " "));
    if (pref.length === 1) {
      const [code, s] = pref[0];
      const c = cell(s.v, propertyType, bedrooms);
      if (c) return { level: "sa2", area: s.n, sa2: code, ta: s.ta, ...c, period: d.quarter, source: d.source, url: d.url };
    } else if (pref.length > 1) several = pref.map(([, s]) => ({ area: s.n, ...(cell(s.v, propertyType, bedrooms) || {}) })).filter((x) => x.values);
  }
  const taName = typedTa || (several?.length ? Object.values(d.sa2).find((s) => s.n === several[0].area)?.ta : null);
  if (taName && d.ta[taName]) return { level: "ta", area: taName, key: "ALL|ALL", values: d.ta[taName], several, quarter: d.quarter, period: d.month, source: d.source, url: d.url };
  return several?.length ? { level: "none", several, period: d.quarter, source: d.source, url: d.url } : null;
}
