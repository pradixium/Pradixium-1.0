/* PRADIXIUM™ — Australia: ABS median price of residential property
 * transfers by dwelling type, per Greater Capital City (GCCSA) and rest of
 * each state, latest quarter (lib/data/australiaPrices.json ←
 * scripts/build-au-prices.py; ABS data API dataflow RES_DWELL).
 * Place → GCCSA from ABS's own ASGS allocation files (suburbs, SA4/SA3
 * regions, capital names). A name found in several states needs the state
 * ("Richmond, VIC"); a capital name alone means the capital ("Perth").
 * Houses → established-house median; flats / units / townhouses → attached-
 * dwelling median. ABS medians are unstratified (not mix-adjusted) and the
 * latest quarter is preliminary — said in the text.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let sub;
function suburbs() {
  if (sub === undefined) { try { sub = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "australiaSuburbs.json"), "utf8")); } catch { sub = null; } }
  return sub;
}
let doc;
function data() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "australiaPrices.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
const CAPITALS = new Set(["sydney", "melbourne", "brisbane", "adelaide", "perth", "hobart", "darwin", "canberra"]);
const STATES = [
  [/\b(nsw|new south wales)\b/i, "New South Wales"], [/\b(vic|victoria)\b/i, "Victoria"], [/\b(qld|queensland)\b/i, "Queensland"],
  [/\b(south australia)\b/i, "South Australia"], [/\b(western australia)\b/i, "Western Australia"], [/\b(tas|tasmania)\b/i, "Tasmania"],
  [/\b(nt|northern territory)\b/i, "Northern Territory"], [/\b(act|australian capital territory)\b/i, "Australian Capital Territory"],
  [/(^|[\s,])SA(\s|,|$|\s+\d{4})/, "South Australia"], [/(^|[\s,])WA(\s|,|$|\s+\d{4})/, "Western Australia"]
];
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
let index;
const fmt = (n) => Math.round(n).toLocaleString("en-US");

export function australiaBenchmark({ text, propertyType }) {
  const d = data();
  if (!d) return null;
  if (!index) index = Object.fromEntries(Object.entries(d.places).map(([k, v]) => [norm(k), v]));
  const CAP_STATE = { sydney: "New South Wales", melbourne: "Victoria", brisbane: "Queensland", adelaide: "South Australia", perth: "Western Australia", hobart: "Tasmania", darwin: "Northern Territory", canberra: "Australian Capital Territory" };
  // a state typed, else the state of a capital typed alongside ("Richmond, Melbourne")
  const capTyped = String(text || "").split(",").map(norm).find((x) => CAP_STATE[x]);
  const state = STATES.find(([re]) => re.test(String(text || "")))?.[1] || (capTyped ? CAP_STATE[capTyped] : null);
  // comma parts and the part without a trailing state / postcode ("Bondi NSW 2026")
  const parts = String(text || "").split(",").map((p) => norm(p.replace(/\b\d{4}\b/g, "").replace(/\b(nsw|vic|qld|tas|act|nt|sa|wa|australia|new south wales|victoria|queensland|tasmania|south australia|western australia|northern territory|australian capital territory)\b/gi, ""))).filter(Boolean);
  let hit = null, place = null, ambiguous = null, hitState = null;
  // the most specific place first: a suburb before the capital city typed after it
  for (const p of [...parts.filter((x) => !CAPITALS.has(x)), ...parts.filter((x) => CAPITALS.has(x))]) {
    const list = index[p];
    if (!list) continue;
    const inState = state ? list.filter((x) => x.state === state) : list;
    const gs = [...new Set(inState.map((x) => x.g))];
    if (gs.length === 1) { hit = gs[0]; place = p; hitState = inState[0].state; break; }
    if (!state && CAPITALS.has(p)) { hit = list[0].g; place = p; hitState = list[0].state; break; }
    if (gs.length > 1) ambiguous = p;
  }
  if (!hit) {
    return { found: false, text: ambiguous ? `"${ambiguous}" is a place name in more than one Australian state — add the state (for example "${ambiguous}, NSW") to get the ABS sale prices for its area.` : `No Australian suburb or town was recognised — enter the suburb and state (for example "Bondi, NSW") to get the ABS sale prices for its area.` };
  }
  // the state valuer-general's own SUBURB median (10+ sales) → the benchmark:
  // SA houses; Victoria houses (+ units when the unit file is loaded)
  const isHouseS = /house|villa|detached/i.test(String(propertyType || "")) && !/town|apart|flat|unit|studio/i.test(String(propertyType || ""));
  const S = suburbs();
  const st = hitState === "South Australia" ? S?.sa : hitState === "Victoria" ? S?.vic : null;
  const rec = st ? st[isHouseS ? "houses" : "units"]?.[String(place).toUpperCase()] : null;
  if (rec) {
    const who = hitState === "South Australia" ? "Valuer-General of South Australia" : "Valuer-General Victoria";
    const ab = hitState === "South Australia" ? "SA" : "VIC";
    const kindW = isHouseS ? "house" : "unit / apartment";
    return {
      found: true, suburb: true, state: hitState, value: rec.median, unit: "total", currency: "AUD", area: `${titleCase(place)}, ${ab} (suburb)`, period: st.period, sales: rec.n,
      label: `${who} median ${kindW} price — ${titleCase(place)}`, who,
      text: `${who}, ${st.period}: median price of ${rec.n} ${kindW} sales in ${titleCase(place)}${rec.council ? ` (${rec.council})` : ""}, AUD ${fmt(rec.median)} (whole property).${rec.prev ? ` Same quarter a year earlier: AUD ${fmt(rec.prev)} (a median of different homes, not a price index).` : ""}`,
      source: st.source, sourceUrl: st.sourceUrl
    };
  }
  const a = d.areas[hit];
  const isHouse = /house|villa|detached/i.test(String(propertyType || "")) && !/town|apart|flat|unit|studio/i.test(String(propertyType || ""));
  const k = isHouse ? "house" : "attached";
  const med = a?.now?.[`${k}Median`], n = a?.now?.[`${k}N`], prev = a?.prev?.[`${k}Median`];
  if (!med || !n || n < 10) return { found: false, state: hitState, area: a?.name, text: `ABS publishes too few ${isHouse ? "house" : "unit / attached-dwelling"} transfers for ${a?.name || "this area"} in ${d.period} — no area figure.` };
  const typeWord = isHouse ? "established houses" : "attached dwellings (flats, units, townhouses)";
  const q = d.period.replace("-", " ");
  const chg = prev ? ` A year earlier (${d.yearAgo.replace("-", " ")}) the median was AUD ${fmt(prev)} — the medians are not adjusted for the mix of homes sold, so this is context, not a price index.` : "";
  return {
    found: true, state: hitState, value: med, unit: "total", currency: "AUD", area: a.name, period: q, sales: n,
    label: `ABS median transfer price — ${a.name}`,
    text: `Australian Bureau of Statistics, ${q}${a.status === "p" ? " (preliminary)" : ""}: median price of ${fmt(n)} ${typeWord} transferred in ${a.name}, AUD ${fmt(med)} (whole property, not per m²; ${titleCase(place)} lies in ${a.name}). ABS publishes these medians for each capital-city area and the rest of each state only — not per suburb.${chg}`,
    source: d.source, sourceUrl: d.sourceUrl
  };
}
function titleCase(s) { return String(s).replace(/\b([a-z])/g, (m) => m.toUpperCase()); }
