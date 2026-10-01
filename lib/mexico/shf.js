/* PRADIXIUM™ — Mexico: Sociedad Hipotecaria Federal (SHF) housing price
 * statistics, latest quarter (lib/data/mexicoShf.json ←
 * scripts/build-mx-shf.py): the state's MEDIAN price of homes bought with a
 * mortgage credit (SHF builds it from the appraisals of mortgaged homes —
 * new and used, houses and condominiums together) = the benchmark (whole
 * home); the municipality's own annual index change when SHF publishes one,
 * else the state's. Place → state / municipality from INEGI's catalogue.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function data() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "mexicoShf.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const fmt = (n) => Math.round(n).toLocaleString("en-US");

export function mexicoBenchmark({ text }) {
  const d = data();
  if (!d) return null;
  const parts = String(text || "").split(",").map(norm).filter((p) => p && p !== "mexico" && p !== "mx");
  // the most specific match wins: a town / municipality before a state
  let hit = null;
  for (const p of parts) { const h = d.places[p]; if (h && h[1]) { hit = h; break; } }
  if (!hit) for (const p of [...parts].reverse()) { const h = d.places[p]; if (h) { hit = h; break; } }
  if (!hit) return { found: false, text: "No Mexican town or state was recognised — enter the city or municipality (for example \"Playa del Carmen, Quintana Roo\") to get SHF's official home prices for its state." };
  const [state, muni] = hit;
  const s = d.states[state];
  if (!s) return { found: false, text: `SHF publishes no price figures for ${state}.` };
  const [avg, q1, med, q3, yoyState] = s;
  const muniChange = muni != null ? d.municipalities[`${state}|${muni}`] : undefined;
  const trend = muniChange ?? yoyState;
  const trendWhere = muniChange != null ? `${muni} municipality` : state;
  const where = muni ? `${muni}, ${state}` : state;
  return {
    found: true, value: med, unit: "total", currency: "MXN", area: `${state} (state)`, period: d.period, trend, trendWhere,
    label: `SHF median home price — ${state}`,
    text: `Sociedad Hipotecaria Federal (SHF), ${d.period}: median price of homes bought with a mortgage credit in ${state} MXN ${fmt(med)} (average ${fmt(avg)}; a quarter of homes below ${fmt(q1)}, a quarter above ${fmt(q3)}) — built from the appraisals of mortgaged homes, new and used, houses and condominiums together; whole home, not per m². SHF publishes prices per state only (${where} lies in ${state}). Price index ${trendWhere}: ${trend >= 0 ? "+" : ""}${trend}% on a year earlier.`,
    source: d.source, sourceUrl: d.sourceUrl
  };
}
