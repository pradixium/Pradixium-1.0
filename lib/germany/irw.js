/* PRADIXIUM™ — Germany / North Rhine-Westphalia: Immobilienrichtwerte.
 *
 * The Gutachterausschüsse für Grundstückswerte (statutory valuation boards,
 * § 192 BauGB) derive each 1 January, from their register of ALL purchase
 * contracts, a zonal reference value in € per m² of living area for a
 * defined reference home (year built, living area, standard, plot…), per
 * submarket. BORIS-NRW publishes them statewide as open data
 * (dl-de/zero-2-0). Every NRW address (Geobasis NRW Gebäudereferenzen) was
 * assigned its zones by scripts/build-de-nrw-irw.py →
 * lib/data/germany/nrw/<AGS>.json.gz.
 *
 * The value belongs to the REFERENCE home: the board's conversion factors
 * (the linked PDF) adjust it for another size, age or standard; they are
 * not applied here, and the reference home is always stated.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const DIR = path.join(process.cwd(), "lib", "data", "germany", "nrw");
export const IRW_SOURCE = "BORIS-NRW — Immobilienrichtwerte of the Gutachterausschüsse für Grundstückswerte (Obere Gutachterausschuss NRW open data, dl-de/zero-2-0)";
export const IRW_URL = "https://www.boris.nrw.de/";

let index = null;
function loadIndex() {
  if (index) return index;
  try { index = JSON.parse(readFileSync(path.join(DIR, "index.json"), "utf8")); } catch { index = { municipalities: {} }; }
  index.byKey = new Map();
  for (const [name, ags] of Object.entries(index.municipalities)) for (const k of nameKeys(name)) if (!index.byKey.has(k)) index.byKey.set(k, { name, ags });
  for (const [alias, name] of Object.entries(ALIASES)) if (index.municipalities[name]) index.byKey.set(alias, { name, ags: index.municipalities[name] });
  return index;
}
const cache = new Map();
function loadMunicipality(ags) {
  if (!cache.has(ags)) {
    let d = null;
    try { d = JSON.parse(gunzipSync(readFileSync(path.join(DIR, `${ags}.json.gz`))).toString("utf8")); } catch { d = null; }
    cache.set(ags, d);
  }
  return cache.get(ags);
}

const umlaut = (s) => String(s || "").toLowerCase().replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
const bare = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
function nameKeys(name) {
  const a = umlaut(name).replace(/[^a-z0-9]/g, ""), b = bare(name).replace(/[^a-z0-9]/g, "");
  return a === b ? [a] : [a, b];
}
const ALIASES = { cologne: "Köln", colonia: "Köln", aixlachapelle: "Aachen", mulheim: "Mülheim an der Ruhr", muelheim: "Mülheim an der Ruhr", muelheimanderruhr: "Mülheim an der Ruhr" };

// same key as the build script: "Ückendorfer Str." = "Ueckendorfer Straße"
export const streetKey = (s) => umlaut(s).replace(/stra?sse\b|str\b\.?/g, "str").replace(/[^a-z0-9]/g, "");

// "Hohe Str. 12a, 50667 Köln" → { street, number, suffix, municipality }
export function parseGermanAddress(address, city) {
  const idx = loadIndex();
  const parts = [address, city].filter(Boolean).join(",").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  let muni = null, street = null;
  for (const p of parts) {
    const noPc = p.replace(/\b\d{5}\b/g, "").replace(/\b(deutschland|germany|nrw|nordrhein-westfalen)\b/gi, "").trim();
    if (!muni) for (const k of nameKeys(noPc)) { const m = idx.byKey.get(k); if (m) { muni = m; break; } }
    const m = !street && p.match(/^(.*?[a-zäöüß.])\s*(\d+)\s*([a-z])?\s*(?:[-–\/]\s*\d+\s*[a-z]?)?$/i);
    if (m && !/^\d{5}$/.test(m[2])) street = { street: m[1].trim(), number: m[2], suffix: (m[3] || "").toLowerCase() };
  }
  // "Hohe Straße 12 Köln" (no comma): the town is the last word(s)
  if (!muni && parts.length === 1) {
    const w = parts[0].replace(/\b\d{5}\b/g, " ").trim().split(/\s+/);
    for (let n = Math.min(4, w.length - 1); n >= 1 && !muni; n--) for (const k of nameKeys(w.slice(-n).join(" "))) { const m = idx.byKey.get(k); if (m) { muni = m; const rest = w.slice(0, -n).join(" ").match(/^(.*?[a-zäöüß.])\s*(\d+)\s*([a-z])?$/i); if (rest) street = { street: rest[1].trim(), number: rest[2], suffix: (rest[3] || "").toLowerCase() }; break; } }
  }
  return { municipality: muni, ...(street || {}) };
}

const GSTAND = { 1: "very simple", 2: "very simple–simple", 3: "simple", 4: "simple–medium", 5: "medium", 6: "medium–upscale", 7: "upscale", 8: "upscale–high", 9: "high", 10: "luxury" };
const AKL = { 1: "luxury", 2: "high", 3: "upscale–high", 4: "upscale", 5: "medium–upscale", 6: "medium", 7: "simple–medium", 8: "simple", 9: "very simple–simple", 10: "very simple" };
const MTYP = { 1: "not modernised (as built)", 2: "partly modernised", 3: "fully modernised" };
const MGRAD = { 1: "not modernised", 2: "minor modernisation", 3: "medium modernisation", 4: "mostly modernised", 5: "comprehensively modernised" };
const WHNLA = { 1: "very good", 2: "good–very good", 3: "good", 4: "medium–good", 5: "medium", 6: "simple–medium", 7: "simple", 8: "very simple" };
const EGART = { 1: "detached", 2: "semi-detached", 4: "mid-terrace", 5: "end-terrace" };
const OBJGR = { 1: "first sale of a new build", 2: "first sale after conversion", 3: "resale", 4: "resale after conversion" };
const MIETS = { 1: "vacant", 2: "let", 3: "vacant", 4: "vacant", 5: "let", 6: "let", 7: "partly let" };
const SLOT_LABEL = ["flats (resale)", "detached houses", "semi-detached / terraced houses", "multi-family houses", "flats (first sale, new build)"];

// the reference home in words: "built 1955, 60 m², medium standard, partly modernised, resale, vacant"
export function describeReference(z) {
  const bits = [];
  if (z.EGART && EGART[z.EGART]) bits.push(EGART[z.EGART]);
  if (z.BJ) bits.push(`built ${z.BJ}`);
  if (z.WHNFL) bits.push(`${z.WHNFL} m² living area`);
  if (z.FLAE) bits.push(`plot ${z.FLAE} m²`);
  if (z.GSTAND && GSTAND[z.GSTAND]) bits.push(`${GSTAND[z.GSTAND]} standard`);
  else if (z.AKL && AKL[z.AKL]) bits.push(`${AKL[z.AKL]} fittings`);
  if (z.MTYP && MTYP[z.MTYP]) bits.push(MTYP[z.MTYP]);
  else if (z.MGRAD && MGRAD[z.MGRAD]) bits.push(MGRAD[z.MGRAD]);
  if (z.WHNLA && WHNLA[z.WHNLA]) bits.push(`${WHNLA[z.WHNLA]} location`);
  if (z.OBJGR && OBJGR[z.OBJGR] && z.TEILMA === "1") bits.push(OBJGR[z.OBJGR]);
  if (z.MIETS && MIETS[z.MIETS]) bits.push(MIETS[z.MIETS]);
  return bits.join(", ");
}
const range = (s) => { const m = String(s || "").match(/^(\d+)(?:-(\d+))?$/); return m ? [Number(m[1]), Number(m[2] || m[1])] : null; };
const zoneOut = (z, slot) => ({
  value: Number(z.IMRW), submarket: SLOT_LABEL[slot], reference: describeReference(z), area: [z.ORTST, z.NAME_IRW, z.GEBIET].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" — ") || null,
  number: z.WNUM || null, board: z.GABE || null, factorsUrl: z.UDOK_URL || null, livingArea: z.WHNFL || null, yearBuilt: z.BJ || null, houseForm: EGART[z.EGART] || null
});

function slotFor(type) {
  const t = String(type || "").toLowerCase();
  if (/apart|flat|condo|studio|penthouse|wohnung/.test(t)) return 0;
  if (/town|terrace|semi|row|reihen|doppel/.test(t)) return 2;
  if (/house|villa|detached|haus/.test(t)) return 1;
  return null;
}

// → { status, municipality, street, ..., main (benchmark zone) | candidates, others }
export function nrwReferenceValue({ address, city, propertyType, size } = {}) {
  const p = parseGermanAddress(address, city);
  if (!p.municipality) return { status: "not_nrw" };
  const d = loadMunicipality(p.municipality.ags);
  const base = { municipality: p.municipality.name, ags: p.municipality.ags, stag: d?.stag || loadIndex().stag || null, source: IRW_SOURCE, sourceUrl: IRW_URL };
  if (!d) return { ...base, status: "no_values" };
  if (!p.street || !p.number) return { ...base, status: "needs_address" };
  const st = d.streets[streetKey(p.street)];
  if (!st) return { ...base, status: "street_not_found", street: p.street };
  let ci = st.n[p.number + p.suffix];
  if (ci == null && !p.suffix) {
    // "12" typed, the register only has 12a / 12b: usable when they share the zones
    const v = [...new Set(Object.entries(st.n).filter(([k]) => k.replace(/[a-z]+$/, "") === p.number).map(([, c]) => c))];
    if (v.length === 1) ci = v[0];
  }
  if (ci == null) return { ...base, status: "number_not_found", street: st.name, number: p.number + p.suffix };
  const addr = { ...base, street: st.name, number: p.number + p.suffix };
  if (ci === -1) return { ...addr, status: "no_zone" };
  const combo = d.combos[ci];
  const slot = slotFor(propertyType);
  const others = combo.flatMap((ids, s) => s === slot ? [] : ids.map((i) => zoneOut(d.zones[i], s)));
  if (slot == null) return { ...addr, status: "type_not_covered", others };
  let cand = combo[slot].map((i) => d.zones[i]);
  if (!cand.length) return { ...addr, status: "no_zone_for_type", submarket: SLOT_LABEL[slot], others };
  // several reference values here (per house form / building age): the
  // living area narrows them only where the board gives a size range
  const sz = Number(size);
  if (cand.length > 1 && sz > 0) {
    const fit = cand.filter((z) => { const r = range(z.WHNFL); return r && r[0] !== r[1] && sz >= r[0] && sz <= r[1]; });
    if (fit.length === 1) cand = fit;
  }
  if (cand.length === 1 || new Set(cand.map((z) => z.IMRW)).size === 1) return { ...addr, status: "ok", main: zoneOut(cand[0], slot), others };
  return { ...addr, status: "several", submarket: SLOT_LABEL[slot], candidates: cand.map((z) => zoneOut(z, slot)).sort((a, b) => a.value - b.value), others };
}
