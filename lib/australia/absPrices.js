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
let rentsDoc;
function rents() {
  if (rentsDoc === undefined) { try { rentsDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "australiaRents.json"), "utf8")); } catch { rentsDoc = null; } }
  return rentsDoc;
}
// official weekly rent of new bonds: NSW per postcode, SA per suburb — same
// home type, the bedroom count when 10+ bonds, else the type's total
function localRent(state, place, pc, propertyType, bedrooms) {
  const R = rents();
  const t = String(propertyType || "");
  const house = /house|villa|detached/i.test(t) && !/town|apart|flat|unit|studio/i.test(t);
  const town = /town|terrace/i.test(t);
  const b = Number(bedrooms);
  if (state === "New South Wales" && pc && R?.nsw?.rent?.pc?.[pc]) {
    const T = house ? "House" : town ? "Townhouse" : "Flat/Unit";
    const B = b === 0 ? "Bedsitter" : b === 1 ? "1 Bedroom" : b >= 4 ? "4 or more Bedrooms" : b > 0 ? `${b} Bedrooms` : null;
    const row = R.nsw.rent.pc[pc];
    const hit = (B && row[`${T}|${B}`]) ? [`${T}|${B}`, row[`${T}|${B}`]] : row[`${T}|Total`] ? [`${T}|Total`, row[`${T}|Total`]] : null;
    if (!hit) return null;
    const r = R.nsw.rent;
    return { weekly: hit[1][0], n: hit[1][1], area: `postcode ${pc}`, kind: hit[0].replace("|Total", ", all bedroom counts").replace("|", ", ").replace("Flat/Unit", "flats / units").replace("House", "houses").replace("Townhouse", "townhouses").replace(/Bedroom/g, "bedroom"), period: r.period, who: "NSW Department of Communities and Justice (Rent and Sales Report)", source: r.source, sourceUrl: r.sourceUrl };
  }
  if (state === "South Australia" && R?.sa?.rent?.sub?.[String(place).toUpperCase()] && !town) {
    const T = house ? "House" : "Flat";
    const B = b >= 4 ? "4+" : b > 0 ? String(b) : null;
    const row = R.sa.rent.sub[String(place).toUpperCase()];
    const hit = (B && row[`${T}|${B}`]) ? [`${T}|${B}`, row[`${T}|${B}`]] : row[`${T}|Total`] ? [`${T}|Total`, row[`${T}|Total`]] : null;
    if (!hit) return null;
    const r = R.sa.rent;
    return { weekly: hit[1][0], n: hit[1][1], area: titleCase(place), kind: `${T === "House" ? "houses" : "flats / units"}, ${hit[0].endsWith("Total") ? "all bedroom counts" : `${hit[0].split("|")[1]} bedroom${hit[0].endsWith("|1") ? "" : "s"}`}`, period: r.period, who: "Government of South Australia (Private Rental Report)", source: r.source, sourceUrl: r.sourceUrl };
  }
  return null;
}
function withRent(res, rent) {
  if (!res || !rent) return res;
  const monthly = Math.round(rent.weekly * 52 / 12);
  return { ...res, rent: { ...rent, monthly, text: `${rent.who}, ${rent.period}: median weekly rent of ${rent.n} new bonds lodged for ${rent.kind} in ${rent.area}, AUD ${fmt(rent.weekly)} a week (≈ AUD ${fmt(monthly)} a month = weekly × 52 ÷ 12) — new lettings, private market.` } };
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

export function australiaBenchmark(args) {
  const r = australiaCore(args);
  return r;
}
function australiaCore({ text, propertyType, bedrooms }) {
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
  const R = rents();
  const typedPc = (String(text || "").match(/\b(\d{4})\b/) || [])[1];
  const pc = hitState === "New South Wales" ? (typedPc && R?.nsw?.sales?.pc?.[typedPc] || typedPc && R?.nsw?.rent?.pc?.[typedPc] ? typedPc : R?.nsw?.suburbPostcode?.[String(place).toUpperCase()]) : null;
  const rent = localRent(hitState, place, pc, propertyType, bedrooms);
  // NSW: the postcode's median sale price (DCJ Rent and Sales Report, from
  // NSW Land Registry notices of sale) — strata (units, townhouses) vs
  // non-strata (houses)
  const isHouseN = /house|villa|detached/i.test(String(propertyType || "")) && !/town|apart|flat|unit|studio/i.test(String(propertyType || ""));
  const ns = pc ? R?.nsw?.sales?.pc?.[pc]?.[isHouseN ? "Non Strata" : "Strata"] : null;
  if (ns) {
    const S = R.nsw.sales;
    const [med, q1, q3, n] = ns;
    const kindW = isHouseN ? "non-strata (house)" : "strata (unit / townhouse)";
    return withRent({
      found: true, suburb: true, state: hitState, value: med, unit: "total", currency: "AUD", area: `postcode ${pc}, NSW (${titleCase(place)})`, period: S.period, sales: n,
      label: `NSW median ${isHouseN ? "house" : "strata"} sale price — postcode ${pc}`, who: "NSW Department of Communities and Justice (Rent and Sales Report)",
      text: `NSW Department of Communities and Justice, Rent and Sales Report, ${S.period}: median price of ${n} ${kindW} sales in postcode ${pc}${typedPc === pc ? "" : ` (the postcode of ${titleCase(place)})`}, AUD ${fmt(med)}${q1 && q3 ? ` (middle half AUD ${fmt(q1)}–${fmt(q3)})` : ""}, whole property, from the Notices of Sale lodged with NSW Land Registry (by contract date; the department trims the lowest and highest 5% of sales per council area; published to the nearest $1,000).`,
      source: S.source, sourceUrl: S.sourceUrl
    }, rent);
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
    return withRent({
      found: true, suburb: true, state: hitState, value: rec.median, unit: "total", currency: "AUD", area: `${titleCase(place)}, ${ab} (suburb)`, period: st.period, sales: rec.n,
      label: `${who} median ${kindW} price — ${titleCase(place)}`, who,
      text: `${who}, ${st.period}: median price of ${rec.n} ${kindW} sales in ${titleCase(place)}${rec.council ? ` (${rec.council})` : ""}, AUD ${fmt(rec.median)} (whole property).${rec.prev ? ` Same quarter a year earlier: AUD ${fmt(rec.prev)} (a median of different homes, not a price index).` : ""}`,
      source: st.source, sourceUrl: st.sourceUrl
    }, rent);
  }
  const a = d.areas[hit];
  const isHouse = /house|villa|detached/i.test(String(propertyType || "")) && !/town|apart|flat|unit|studio/i.test(String(propertyType || ""));
  const k = isHouse ? "house" : "attached";
  const med = a?.now?.[`${k}Median`], n = a?.now?.[`${k}N`], prev = a?.prev?.[`${k}Median`];
  if (!med || !n || n < 10) return withRent({ found: false, state: hitState, area: a?.name, text: `ABS publishes too few ${isHouse ? "house" : "unit / attached-dwelling"} transfers for ${a?.name || "this area"} in ${d.period} — no area figure.` }, rent);
  const typeWord = isHouse ? "established houses" : "attached dwellings (flats, units, townhouses)";
  const q = d.period.replace("-", " ");
  const chg = prev ? ` A year earlier (${d.yearAgo.replace("-", " ")}) the median was AUD ${fmt(prev)} — the medians are not adjusted for the mix of homes sold, so this is context, not a price index.` : "";
  return withRent({
    found: true, state: hitState, value: med, unit: "total", currency: "AUD", area: a.name, period: q, sales: n,
    label: `ABS median transfer price — ${a.name}`,
    text: `Australian Bureau of Statistics, ${q}${a.status === "p" ? " (preliminary)" : ""}: median price of ${fmt(n)} ${typeWord} transferred in ${a.name}, AUD ${fmt(med)} (whole property, not per m²; ${titleCase(place)} lies in ${a.name}). ABS publishes these medians for each capital-city area and the rest of each state only — not per suburb.${chg}`,
    source: d.source, sourceUrl: d.sourceUrl
  }, rent);
}
function titleCase(s) { return String(s).replace(/\b([a-z])/g, (m) => m.toUpperCase()); }
