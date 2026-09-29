/* PRADIXIUM™ — France: official energy performance certificates (DPE),
 * ADEME "DPE Logements existants (depuis juillet 2021)" (data.ademe.fr,
 * Licence Ouverte 2.0). A DPE has been compulsory for every sale since
 * July 2021, so a DVF sale can be matched to the DPE registered at the
 * same address before the sale date. That gives, from two official files,
 * what homes of each energy class actually sold for in this town — the
 * measurable part of a renovation (insulation, windows, heating).
 *
 * Houses only: several flats share one street address, so a sale cannot be
 * tied to one flat's DPE.
 */
const API = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines";
export const DPE_SOURCE = "ADEME — DPE Logements existants (energy performance certificates, since July 2021)";
export const DPE_URL = "https://data.ademe.fr/datasets/dpe03existant";
const FIELDS = "numero_voie_ban,nom_rue_ban,etiquette_dpe,date_etablissement_dpe,surface_habitable_logement,annee_construction";

// "RUE DE LA MÉSANGE-BLEUE" / "Rue de la Mésange Bleue" → "RUE DE LA MESANGE BLEUE"
export const streetKey = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const q = (s) => `"${String(s).replace(/["\\]/g, " ")}"`;

async function page(url, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// every house DPE of the commune (latest first); gives up past `maxRows`
// (a large town's matching would not fit the request's time budget)
export async function communeHouseDpe(insee, { maxRows = 6000, ms = 6000 } = {}) {
  const started = Date.now();
  const params = new URLSearchParams({ qs: `code_insee_ban:${q(insee)} AND type_batiment:maison`, select: FIELDS, size: "1000", sort: "-date_etablissement_dpe" });
  let url = `${API}?${params}`, rows = [], total = null;
  while (url) {
    const left = ms - (Date.now() - started);
    if (left < 500) return { available: false, reason: "timeout", total };
    const d = await page(url, left);
    total = d.total ?? total;
    if (total > maxRows) return { available: false, reason: "too_many", total };
    rows = rows.concat(d.results || []);
    url = d.next || null;
  }
  return { available: true, rows, total };
}

// the property's own DPE: same commune, number and street, latest first
export async function ownDpe(insee, housenumber, street, ms = 5000) {
  if (!insee || !housenumber || !street) return null;
  const params = new URLSearchParams({ qs: `code_insee_ban:${q(insee)} AND numero_voie_ban:${q(housenumber)} AND type_batiment:maison`, select: FIELDS, size: "50", sort: "-date_etablissement_dpe" });
  const d = await page(`${API}?${params}`, ms);
  const want = streetKey(street);
  const hits = (d.results || []).filter((r) => streetKey(r.nom_rue_ban) === want);
  if (!hits.length) return { found: false };
  const r = hits[0];
  return { found: true, label: r.etiquette_dpe, date: String(r.date_etablissement_dpe || "").slice(0, 10), surface: r.surface_habitable_logement ?? null, yearBuilt: r.annee_construction ?? null, certificates: hits.length };
}

// DVF house sales × the DPE at the same address dated on or before the sale
// (valid 10 years) → median €/m² per energy class; a class counts only with
// 10+ matched sales
export function pricesByClass(sales, dpeRows, median) {
  const byAddr = new Map();
  for (const r of dpeRows) {
    const k = `${String(r.numero_voie_ban || "").trim()}|${streetKey(r.nom_rue_ban)}`;
    (byAddr.get(k) || byAddr.set(k, []).get(k)).push(r);
  }
  const groups = {};
  let matched = 0;
  for (const s of sales) {
    const list = byAddr.get(`${s.num}|${streetKey(s.street)}`);
    if (!list) continue;
    const before = list.filter((r) => String(r.date_etablissement_dpe) <= s.date && String(r.date_etablissement_dpe) >= `${Number(s.date.slice(0, 4)) - 10}${s.date.slice(4)}`);
    if (!before.length) continue;
    const label = before.sort((a, b) => String(b.date_etablissement_dpe).localeCompare(String(a.date_etablissement_dpe)))[0].etiquette_dpe;
    if (!/^[A-G]$/.test(label || "")) continue;
    matched++;
    (groups[label] ||= []).push(s.ppm2);
  }
  const classes = Object.keys(groups).sort().map((label) => ({ label, sampleSize: groups[label].length, medianEurPerM2: median(groups[label]) }));
  return { salesTotal: sales.length, matched, classes, usable: classes.filter((c) => c.sampleSize >= 10) };
}
