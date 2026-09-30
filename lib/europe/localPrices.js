/* PRADIXIUM™ — official LOCAL price figures for European countries that
 * otherwise only had a national index (api/eurostat-hpi-intelligence.js).
 *
 * One resolver per country, each reading its national statistics office's
 * own open API, live (cached in memory):
 *   Netherlands — CBS 83625NED: average sale price of existing homes bought
 *                 by private buyers, per municipality, per year. Address →
 *                 municipality with PDOK Locatieserver (Dutch government).
 *   Norway      — SSB 06035: average price per m² of owner-occupied homes
 *                 sold, per municipality and home type, per year.
 *   Sweden      — SCB BO0501: average purchase price of permanent houses
 *                 (småhus), per municipality, per year. Apartments in Sweden
 *                 are tenant-owner shares, not real property → not covered.
 *   Ireland     — CSO HPM08 / HPM07: moving 12-month median price of market
 *                 household purchases (stamp-duty executions), per Eircode
 *                 routing key, else per county / Dublin local authority.
 * A place that does not match exactly one official area gets NO figure —
 * never a neighbour's, never the country's.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const cache = new Map();
async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ms) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}
async function getJson(url, ms = 8000, init = {}) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: c.signal, headers: { accept: "application/json", "content-type": "application/json", ...(init.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// "Keizersgracht 100, 1015 CV Amsterdam, Netherlands" → ["Keizersgracht 100", "Amsterdam"]
const places = (text) => String(text || "").split(",").map((p) => p.replace(/\b\d{4}\s?[A-Z]{2}\b/g, "").replace(/\b\d{3,5}\b/g, "").trim()).filter((p) => p && !/^(netherlands|nederland|norway|norge|sweden|sverige|ireland|eire|the netherlands|holland|denmark|danmark|austria|osterreich|österreich|croatia|hrvatska|slovenia|slovenija|latvia|latvija)$/i.test(p));
const isApartment = (t) => /apart|flat|studio|penthouse|condo/i.test(String(t || ""));
const isHouse = (t) => /house|villa|town|home|cottage/i.test(String(t || ""));

// ── Netherlands ──────────────────────────────────────────────────────────
async function netherlands(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const loc = await getJson(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(text)}&rows=1&fl=gemeentecode,gemeentenaam,type,weergavenaam&fq=type:(adres OR woonplaats OR gemeente OR postcode OR weg)`, 6000);
  const d = loc?.response?.docs?.[0];
  if (!d?.gemeentecode) return { status: "not_matched" };
  const code = `GM${d.gemeentecode}`;
  const rows = await cached(`nl:${code}`, 12 * 3600e3, () => getJson(`https://opendata.cbs.nl/ODataApi/odata/83625NED/TypedDataSet?$filter=RegioS eq '${code}'`, 8000).then((j) => j.value || []));
  const withValue = rows.filter((r) => Number.isFinite(r.GemiddeldeVerkoopprijs_1)).sort((a, b) => a.Perioden.localeCompare(b.Perioden));
  const last = withValue[withValue.length - 1];
  if (!last) return { status: "no_data", area: d.gemeentenaam };
  const prev = withValue.find((r) => r.Perioden === `${Number(last.Perioden.slice(0, 4)) - 1}JJ00`);
  return {
    status: "ok", country: "Netherlands", value: last.GemiddeldeVerkoopprijs_1, unit: "total", currency: "EUR",
    area: `${d.gemeentenaam} (municipality)`, matched: d.weergavenaam, period: last.Perioden.slice(0, 4), typeLabel: "all existing homes",
    yoyPercent: prev ? Math.round((last.GemiddeldeVerkoopprijs_1 / prev.GemiddeldeVerkoopprijs_1 - 1) * 1000) / 10 : null,
    source: "CBS (Statistics Netherlands) — Bestaande koopwoningen; gemiddelde verkoopprijzen, regio (83625NED)",
    sourceUrl: "https://opendata.cbs.nl/statline/#/CBS/nl/dataset/83625NED/table",
    basis: "average price of existing homes bought by private buyers, registered by the Kadaster (all home types, not per m²)"
  };
}

// ── Norway ───────────────────────────────────────────────────────────────
async function norwayMeta() {
  return cached("no:meta", 24 * 3600e3, () => getJson("https://data.ssb.no/api/v0/no/table/06035", 8000));
}
async function norway(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const meta = await norwayMeta();
  const reg = meta.variables.find((v) => v.code === "Region");
  const clean = (s) => norm(String(s).replace(/\s+-\s+.*$/, "").replace(/\(.*?\)/g, ""));
  let hits = [];
  for (const p of [...places(text)].reverse()) {
    const k = norm(p);
    hits = reg.values.map((code, i) => ({ code, name: reg.valueTexts[i] })).filter((r) => r.code.length === 4 && (clean(r.name) === k || norm(r.name) === k));
    if (hits.length) break;
  }
  if (!hits.length) return { status: "not_matched" };
  const q = { query: [{ code: "Region", selection: { filter: "item", values: hits.map((h) => h.code) } }, { code: "Tid", selection: { filter: "top", values: ["1"] } }], response: { format: "json-stat2" } };
  const d = await getJson("https://data.ssb.no/api/v0/no/table/06035", 8000, { method: "POST", body: JSON.stringify(q) });
  const [nR, nT, nC] = d.size;
  const regions = catsOf(d, "Region"), types = catsOf(d, "Boligtype");
  const year = catsOf(d, "Tid")[0];
  const at = (r, t, c) => d.value[(r * nT + t) * nC + c];
  // municipalities merged/split in 2020/2024 keep old codes: use the code
  // that has sales in the latest year; two live codes → ambiguous
  const live = regions.map((code, r) => ({ code, r, n: types.reduce((s, _, t) => s + (at(r, t, 1) || 0), 0) })).filter((x) => x.n > 0);
  if (live.length !== 1) return { status: live.length ? "ambiguous" : "no_data" };
  const { r, code } = live[0];
  const want = isApartment(propertyType) ? ["03"] : /town|terrace/i.test(propertyType || "") ? ["02"] : isHouse(propertyType) ? ["01"] : null;
  const typeName = { "01": "detached houses (eneboliger)", "02": "small houses — semi-detached/terraced (småhus)", "03": "apartments in blocks (blokkleiligheter)" };
  const opts = types.map((t, i) => ({ t, v: at(r, i, 0), n: at(r, i, 1) })).filter((x) => Number.isFinite(x.v) && x.v > 0);
  const pick = want ? opts.find((x) => want.includes(x.t)) : null;
  if (!pick) return { status: "no_type_data", area: hits.find((h) => h.code === code)?.name };
  return {
    status: "ok", country: "Norway", value: pick.v, unit: "perSqm", currency: "NOK", salesCount: pick.n,
    area: `${String(hits.find((h) => h.code === code).name).replace(/\s+-\s+.*$/, "").replace(/\s*\(.*?\)/g, "")} (municipality)`, period: year, typeLabel: typeName[pick.t] || pick.t,
    others: opts.filter((x) => x !== pick).map((x) => ({ type: typeName[x.t] || x.t, value: x.v, sales: x.n })),
    source: "Statistics Norway (SSB) — Selveierboliger, etter region og boligtype (table 06035)",
    sourceUrl: "https://www.ssb.no/en/statbank/table/06035",
    basis: "average price per m² of owner-occupied homes sold in the year (registered sales)"
  };
}

// ── Sweden ───────────────────────────────────────────────────────────────
const SE_URL = "https://api.scb.se/OV0104/v1/doris/sv/ssd/BO/BO0501/BO0501B/FastprisSHRegionAr";
async function sweden(text, propertyType) {
  if (isApartment(propertyType)) return { status: "apartments_not_covered" };
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const meta = await cached("se:meta", 24 * 3600e3, () => getJson(SE_URL, 8000));
  const reg = meta.variables.find((v) => v.code === "Region");
  let hit = null;
  for (const p of [...places(text)].reverse()) {
    const k = norm(p);
    const m = reg.values.map((code, i) => ({ code, name: reg.valueTexts[i] })).filter((r) => r.code.length === 4 && norm(r.name) === k);
    if (m.length === 1) { hit = m[0]; break; }
  }
  if (!hit) return { status: "not_matched" };
  const q = { query: [{ code: "Region", selection: { filter: "item", values: [hit.code] } }, { code: "Fastighetstyp", selection: { filter: "item", values: ["220"] } }, { code: "Tid", selection: { filter: "top", values: ["2"] } }], response: { format: "json" } };
  const d = await getJson(SE_URL, 8000, { method: "POST", body: JSON.stringify(q) });
  const rows = (d.data || []).map((x) => ({ year: x.key[2], n: Number(x.values[0]), tkr: Number(x.values[1]) })).filter((x) => Number.isFinite(x.tkr) && x.tkr > 0).sort((a, b) => a.year.localeCompare(b.year));
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  if (!last) return { status: "no_data", area: hit.name };
  return {
    status: "ok", country: "Sweden", value: last.tkr * 1000, unit: "total", currency: "SEK", salesCount: last.n,
    area: `${hit.name} (municipality)`, period: last.year, typeLabel: "permanent houses (småhus)",
    yoyPercent: prev ? Math.round((last.tkr / prev.tkr - 1) * 1000) / 10 : null,
    source: "Statistics Sweden (SCB) — Fastighetspriser och lagfarter, småhus (BO0501)",
    sourceUrl: "https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BO__BO0501__BO0501B/FastprisSHRegionAr/",
    basis: "average purchase price of permanent houses with registered title (not per m²)"
  };
}

// ── Ireland ──────────────────────────────────────────────────────────────
async function csoCube(id) {
  return cached(`ie:${id}`, 12 * 3600e3, () => getJson(`https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${id}/JSON-stat/2.0/en`, 12000));
}
// JSON-stat 2.0 "index" is either an array of codes or {code: position}
const catsOf = (d, dim) => { const ix = d.dimension[dim].category.index; return Array.isArray(ix) ? ix : Object.keys(ix).sort((a, b) => ix[a] - ix[b]); };
const posOf = (d, dim, code) => { const ix = d.dimension[dim].category.index; return Array.isArray(ix) ? (ix.indexOf(code) >= 0 ? ix.indexOf(code) : undefined) : ix[code]; };
// value of a JSON-stat cube at {dimId: categoryCode}
function cell(d, sel) {
  let idx = 0;
  for (let i = 0; i < d.id.length; i++) {
    const pos = posOf(d, d.id[i], sel[d.id[i]]);
    if (typeof pos !== "number") return null;
    idx = idx * d.size[i] + pos;
  }
  return Array.isArray(d.value) ? d.value[idx] : d.value?.[idx];
}
async function ireland(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const eir = (String(text).toUpperCase().match(/\b([AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/) || String(text).toUpperCase().match(/\b(D0[1-9]|D1\d|D2[0-4]|D6W)\b/) || [])[1] || null;
  // latest month with a value: median statistic, all dwelling statuses,
  // stamp-duty EXECUTIONS (completed purchases), all buyer types
  const common = (d, areaDim, code) => {
    const sel = {};
    for (const dim of d.id) {
      const cats = catsOf(d, dim), lbl = d.dimension[dim].label;
      if (dim === "STATISTIC") sel[dim] = cats.find((c) => /median/i.test(d.dimension[dim].category.label[c]));
      else if (dim === areaDim) sel[dim] = code;
      else if (/Stamp Duty/i.test(lbl)) sel[dim] = cats.find((c) => /execution/i.test(d.dimension[dim].category.label[c]));
      else if (/^TLIST/.test(dim)) sel[dim] = null;
      else sel[dim] = cats.includes("-") ? "-" : cats[0];
    }
    const tdim = d.id.find((x) => /^TLIST/.test(x));
    const months = catsOf(d, tdim);
    for (let m = months.length - 1; m >= 0; m--) {
      const v = cell(d, { ...sel, [tdim]: months[m] });
      if (Number.isFinite(v) && v > 0) return { v, month: d.dimension[tdim].category.label[months[m]] };
    }
    return null;
  };
  if (eir) {
    const d = await csoCube("HPM08");
    const areaDim = d.id.find((x) => d.dimension[x].label === "Eircode Output");
    const label = d.dimension[areaDim].category.label[eir];
    if (label) {
      const r = common(d, areaDim, eir);
      if (r) return {
        status: "ok", country: "Ireland", value: r.v, unit: "total", currency: "EUR", area: `${label} (Eircode routing area)`, period: `12 months to ${r.month}`,
        typeLabel: "all homes (market household purchases)",
        source: "CSO Ireland — Market-based Household Purchases of Residential Dwellings, moving 12-month median (HPM08)",
        sourceUrl: "https://data.cso.ie/table/HPM08", basis: "median price of market purchases by households, from Revenue stamp-duty returns (not per m²)"
      };
    }
  }
  const d = await csoCube("HPM07");
  const areaDim = d.id.find((x) => d.dimension[x].label === "RPPI Region");
  const lab = d.dimension[areaDim].category.label;
  // "Cork" is the city; "Co Cork" / "County Cork" the county around it
  const ALIAS = { "dublin": "Dublin City", "dun laoghaire": "Dún Laoghaire-Rathdown", "cork": "Cork City", "galway": "Galway City", "limerick": "Limerick City", "waterford": "Waterford City" };
  let code = null, name = null;
  for (const p of [...places(text)].reverse()) {
    const raw = norm(p), county = /^(co|county) /.test(raw) || / county$/.test(raw);
    const k = raw.replace(/^(co|county) /, "").replace(/ county$/, "");
    const want = norm(county ? (Object.values(lab).some((v) => norm(v) === `${k} county`) ? `${k} county` : k) : (ALIAS[k] || k));
    const m = Object.entries(lab).filter(([, v]) => norm(v) === want);
    if (m.length === 1) { [code, name] = m[0]; break; }
  }
  if (!code) return { status: "not_matched" };
  const r = common(d, areaDim, code);
  if (!r) return { status: "no_data", area: name };
  return {
    status: "ok", country: "Ireland", value: r.v, unit: "total", currency: "EUR", area: name, period: `12 months to ${r.month}`,
    typeLabel: "all homes (market household purchases)",
    source: "CSO Ireland — Market-based Household Purchases of Residential Dwellings, moving 12-month median (HPM07)",
    sourceUrl: "https://data.cso.ie/table/HPM07", basis: "median price of market purchases by households, from Revenue stamp-duty returns (not per m²)"
  };
}

// ── Denmark ──────────────────────────────────────────────────────────────
// Statistics Denmark EJEN77: average price per property in free-trade sales,
// quarterly, per "landsdel" (11 areas: Copenhagen city, Copenhagen
// suburbs, North Zealand …) — the finest level Statistics Denmark
// publishes prices at. Address → landsdel with the Danish government's
// address service (Dataforsyningen / DAWA).
async function denmark(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const ps = places(text);
  // one fixed query (all 11 landsdele, flats / houses / summer houses, the
  // latest 5 quarters) — it does not depend on the address, so it runs while
  // the address is looked up, and StatBank answers a query it has already
  // computed in ~1 s (a new one takes ~6 s)
  const dataP = cached("dk:ejen77", 12 * 3600e3, () => getJson("https://api.statbank.dk/v1/data/EJEN77/JSONSTAT?OMR%C3%85DE=01,02,03,04,05,06,07,08,09,10,11&EJENDOMSKATE=0111,2103,0801&BN%C3%98GLE=2,3&OVERDRAG=1&Tid=(-n%2B5)", 9000));
  dataP.catch(() => {});
  let pt = null, postnr = null;
  if (/\d/.test(ps[0] || "")) {
    const a = await getJson(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(ps.join(" "))}&per_side=1&struktur=mini`, 6000).catch(() => []);
    if (a[0]) pt = [a[0].x, a[0].y];
  }
  if (!pt) {
    const EN = { copenhagen: "København", aarhus: "Aarhus", arhus: "Aarhus", elsinore: "Helsingør" };
    const cands = [...ps].reverse().map((raw) => EN[norm(raw)] || raw);
    // every place name looked up at once; the last one that is a postal town wins
    const lists = await Promise.all(cands.map((p) => getJson(`https://api.dataforsyningen.dk/postnumre?q=${encodeURIComponent(p)}&struktur=mini`, 6000).catch(() => [])));
    for (let i = 0; i < cands.length; i++) {
      const p = cands[i];
      // "København K", "København Ø" … are postal districts of one town
      const m = (lists[i] || []).filter((x) => norm(x.navn) === norm(p) || norm(x.navn).startsWith(`${norm(p)} `));
      if (m.length) { postnr = m[0]; break; }
    }
  }
  if (!pt && !postnr) return { status: "not_matched" };
  const reverse = (x, y) => getJson(`https://api.dataforsyningen.dk/landsdele/reverse?x=${x}&y=${y}`, 6000);
  const ldP = postnr
    // the postal area's visual centre first; a centre can lie at sea → then a
    // real address inside the postal area (both asked at once)
    ? cached(`dk:ld:${postnr.nr}`, 24 * 3600e3, async () => {
        const addrP = getJson(`https://api.dataforsyningen.dk/adresser?postnr=${postnr.nr}&per_side=1&struktur=mini`, 6000).catch(() => []);
        const c = await reverse(postnr.visueltcenter_x, postnr.visueltcenter_y).catch(() => null);
        if (c?.navn) return c;
        const a = await addrP;
        if (!a[0]) throw new Error("no address in postal area");
        return reverse(a[0].x, a[0].y);
      })
    : cached(`dk:ld:${pt[0].toFixed(4)},${pt[1].toFixed(4)}`, 24 * 3600e3, () => reverse(pt[0], pt[1]));
  const [ld, d] = await Promise.all([ldP.catch(() => null), dataP]);
  if (!ld?.navn) return { status: "not_matched" };
  const ds = d.dataset || d;
  const omr = Object.entries(ds.dimension["OMRÅDE"].category.label).find(([, v]) => norm(v) === norm(`Landsdel ${ld.navn}`))?.[0];
  if (!omr) return { status: "not_matched" };
  const kate = isApartment(propertyType) ? ["2103", "owner-occupied flats (ejerlejligheder)"] : /summer|holiday/i.test(propertyType || "") ? ["0801", "summer houses"] : ["0111", "one-family houses (enfamiliehuse)"];
  const tids = Object.keys(ds.dimension.Tid.category.index).sort();
  const dims = ds.dimension.id, size = ds.dimension.size;
  const pos = (dim, code) => ds.dimension[dim].category.index[code];
  const val = (bn, t) => { let i = 0; dims.forEach((dim, k) => { const c = dim === "BNØGLE" ? bn : dim === "Tid" ? t : dim === "OMRÅDE" ? omr : dim === "EJENDOMSKATE" ? kate[0] : Object.keys(ds.dimension[dim].category.index)[0]; i = i * size[k] + pos(dim, c); }); return ds.value[i]; };
  for (const t of [...tids].reverse()) {
    const price = val("3", t), n = val("2", t);
    if (Number.isFinite(price) && price > 0) {
      const yearAgo = `${Number(t.slice(0, 4)) - 1}${t.slice(4)}`;
      const prevP = tids.includes(yearAgo) ? val("3", yearAgo) : null;
      return {
        status: "ok", country: "Denmark", value: price * 1000, unit: "total", currency: "DKK", salesCount: n,
        area: `${ld.navn} (landsdel)`, period: t.replace("K", " Q"), typeLabel: kate[1],
        yoyPercent: prevP ? Math.round((price / prevP - 1) * 1000) / 10 : null,
        source: "Statistics Denmark — Ejendomssalg (EJEN77)",
        sourceUrl: "https://www.statbank.dk/EJEN77",
        basis: "average price per property in ordinary free-trade sales in the quarter (not per m²; landsdel is the finest area Statistics Denmark publishes)"
      };
    }
  }
  return { status: "no_data", area: ld.navn };
}

// ── Austria ──────────────────────────────────────────────────────────────
// lib/data/austriaPrices.json ← scripts/build-at-prices.py: Statistik
// Austria median €/m² of living area, houses and flats, per political
// district (Vienna: per Bezirk), from the Grundbuch deeds.
let atDoc;
function atData() {
  if (atDoc === undefined) { try { atDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "austriaPrices.json"), "utf8")); } catch { atDoc = null; } }
  return atDoc;
}
const VIENNA_DISTRICTS = ["innere stadt", "leopoldstadt", "landstrasse", "wieden", "margareten", "mariahilf", "neubau", "josefstadt", "alsergrund", "favoriten", "simmering", "meidling", "hietzing", "penzing", "rudolfsheim funfhaus", "ottakring", "hernals", "wahring", "dobling", "brigittenau", "floridsdorf", "donaustadt", "liesing"];
async function austria(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = atData();
  if (!d) return { status: "no_data" };
  const raw = String(text);
  let id = null, how = null;
  // Vienna: postcode 1XX0 = Bezirk XX, or the Bezirk's name / number
  const vpc = raw.match(/\b1(0[1-9]|1\d|2[0-3])0\b/);
  const vnum = raw.match(/\b(?:wien|vienna)\s*(\d{1,2})\b|\b(\d{1,2})\.\s*bezirk\b/i);
  const vname = VIENNA_DISTRICTS.findIndex((n) => norm(raw).includes(n));
  if (vpc) { id = `9${vpc[1]}`; how = "postcode"; }
  else if (vnum) { id = `9${String(vnum[1] || vnum[2]).padStart(2, "0")}`; how = "Bezirk number"; }
  else if (vname >= 0) { id = `9${String(vname + 1).padStart(2, "0")}`; how = "Bezirk name"; }
  if (!id) {
    const pc = (raw.match(/\b([2-9]\d{3})\b/) || [])[1];
    const byPc = pc ? d.gemeinden.filter((g) => g[2].includes(pc)) : [];
    const dis = [...new Set(byPc.map((g) => g[1].slice(0, 3)))];
    if (dis.length === 1) { id = dis[0]; how = "postcode"; }
  }
  if (!id) {
    const EN = { vienna: "wien", salzburg: "salzburg", innsbruck: "innsbruck", kitzbuehel: "kitzbuhel", kitzbuhel: "kitzbuhel" };
    for (const p of [...places(raw)].reverse()) {
      const k = EN[norm(p)] || norm(p);
      if (k === "wien") return { status: "needs_district", area: "Wien", note: "Vienna is 23 districts with very different prices — enter the district (e.g. \"Wien 19\" / Döbling) or the postcode." };
      const m = d.gemeinden.filter((g) => norm(g[0]) === k);
      const dis = [...new Set(m.map((g) => g[1].slice(0, 3)))];
      if (dis.length === 1) { id = dis[0]; how = `municipality ${m[0][0]}`; break; }
    }
  }
  const dist = id ? d.districts[id] : null;
  if (!dist) return { status: "not_matched" };
  const flat = isApartment(propertyType) || !isHouse(propertyType);
  const v = flat ? dist.flats : dist.houses;
  if (!Number.isFinite(v)) return { status: "no_type_data", area: dist.name };
  return {
    status: "ok", country: "Austria", value: v, unit: "perSqm", currency: "EUR",
    area: `${dist.name.replace(/\s+/g, " ")} (political district)`, period: d.year, typeLabel: flat ? "flats" : "houses",
    others: [{ type: flat ? "houses" : "flats", value: flat ? dist.houses : dist.flats, sales: null }].filter((x) => Number.isFinite(x.value)),
    source: "Statistik Austria — Immobilien-Durchschnittspreise",
    sourceUrl: d.sourceUrl,
    basis: "median price per m² of living area, purchases by private households recorded in the land register (Grundbuch)"
  };
}

// ── Croatia ──────────────────────────────────────────────────────────────
// The Ministry of Physical Planning's official "Plan približnih
// vrijednosti" (PPV, Approximate Values Plan — the statutory mass valuation
// under the Real Estate Valuation Act, built from the sale contracts in
// eNekretnine), read through the ministry's own geoportal ISPU: address →
// house number point (gis/search-text + search-geom, HTRS96/TM) → the
// price block's €/m² for flats by size band (gis/identify, layer "PPV
// 1.1.2026 – stanovi/apartmani"). The PPV has no house values → houses get
// none. When the ministry publishes the next plan, update PPV_FLATS.
const ISPU = "https://ispu.mgipu.hr/api/v1/gis";
const PPV_FLATS = { id: "383", hashIdentify: "MD5R4JU0Ew", serviceId: "9", layers: "405", hash: "2WjyykEE2c", label: { hr: "PPV 1.1.2026. – stanovi/apartmani", en: "AVM 1/1/2026 – flats/apartments" }, asOf: "1 January 2026" };
async function croatia(text, propertyType, size) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  if (isHouse(propertyType) && !isApartment(propertyType)) return { status: "no_house_values" };
  const ps = places(text).filter((p) => !/^(croatia|hrvatska)$/i.test(p));
  if (!ps.length || !/\d/.test(ps[0])) return { status: "needs_address" };
  // the register writes "DR. ANTE STARČEVIĆA", "ULICA …" is often not part
  // of the name: try the street as typed, then without "Ulica"/first word;
  // keep only the exact house number in the typed town
  const street = ps[0].toUpperCase(), town = (ps[1] || "").toUpperCase();
  const num = (street.match(/\b(\d+[A-Z]?)\s*$/) || street.match(/\b(\d+[A-Z]?)\b/) || [])[1];
  const name = street.replace(/\b\d+[A-Z]?\b/, "").trim();
  const variants = [...new Set([name, name.replace(/^(ULICA|UL\.|ULICE)\s+/, ""), name.split(/\s+/).slice(1).join(" ")].filter((v) => v && v.length >= 4))];
  let addr = [];
  for (const v of variants) {
    const sr = await getJson(`${ISPU}/search-text?input=${encodeURIComponent(`${v} ${num}${town ? `, ${town}` : ""}`)}`, 7000);
    const items = (sr || []).find((g) => g.label?.en === "Addresses")?.items || [];
    addr = items.filter((i) => { const [t, rest] = String(i.label).split(/,\s*/); return (!town || norm(t) === norm(town) || norm(t).startsWith(norm(town) + " ")) && new RegExp(`\\s${num}$`).test(rest || ""); });
    if (addr.length) break;
  }
  if (addr.length !== 1) return { status: addr.length ? "ambiguous_address" : "address_not_found" };
  const geomText = await (async () => { const c = new AbortController(), t = setTimeout(() => c.abort(), 6000); try { const r = await fetch(`${ISPU}/search-geom?id=${addr[0].id}&source=${addr[0].source}&hash=${addr[0].hash}`, { signal: c.signal }); return r.ok ? await r.text() : ""; } finally { clearTimeout(t); } })();
  const m = /POINT \(([\d.]+) ([\d.]+)\)/.exec(geomText);
  if (!m) return { status: "address_not_found" };
  const idf = await getJson(`${ISPU}/identify`, 7000, { method: "POST", body: JSON.stringify({ x: Number(m[1]), y: Number(m[2]), scale: 2000, layers: [PPV_FLATS] }) });
  const items = idf?.[0]?.items?.[0]?.items || [];
  if (!items.length) return { status: "outside_ppv", matched: addr[0].label };
  const get = (re) => items.find((i) => re.test(i.label?.en || ""))?.value;
  const bands = items.filter((i) => /EUR\/m2/.test(i.label?.en || "")).map((i) => {
    const nums = [...String(i.label.en).matchAll(/(\d+),(\d+)/g)].map((x) => Number(`${x[1]}.${x[2]}`));
    return { label: i.label.en.replace(/^Flat\/apartment category /, "").replace(/ \(EUR\/m2\)$/, ""), from: /from/.test(i.label.en) ? nums[0] : /up to/.test(i.label.en) ? 0 : nums[0], to: /from/.test(i.label.en) ? Infinity : nums[nums.length - 1], value: Number(String(i.value).replace(/[^\d.]/g, "")) || null };
  }).filter((b) => b.value);
  if (!bands.length) return { status: "no_values", matched: addr[0].label };
  const sz = Number(size);
  const band = Number.isFinite(sz) && sz > 0 ? bands.find((b) => sz > b.from && sz <= b.to) || null : null;
  return {
    status: "ok", country: "Croatia", value: band ? band.value : null, unit: "perSqm", currency: "EUR",
    area: `${get(/Price block/) || "price block"}, ${get(/Administrative area/) || ""}`.replace(/, $/, ""), matched: addr[0].label,
    period: PPV_FLATS.asOf, typeLabel: band ? `flats of ${band.label}` : "flats (enter the size for its band)",
    others: bands.filter((b) => b !== band).map((b) => ({ type: `flats ${b.label}`, value: b.value, sales: null })),
    source: "Ministry of Physical Planning, Construction and State Assets (Croatia) — Plan približnih vrijednosti (PPV), via the ISPU geoportal",
    sourceUrl: "https://ispu.mgipu.hr/",
    basis: "the statutory approximate value per m² for flats in this price block, derived from registered sale contracts (eNekretnine)"
  };
}

// ── Luxembourg ───────────────────────────────────────────────────────────
// lib/data/luxembourgPrices.json ← scripts/build-lu-prices.py: Ministère du
// Logement — Observatoire de l'Habitat, registered average price per m² of
// existing apartments per commune over the last 12 months, from the deeds
// (grouped sales excluded; no price below 10 sales). Apartments only —
// houses are not published per commune.
let luDoc;
function luData() {
  if (luDoc === undefined) { try { luDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "luxembourgPrices.json"), "utf8")); } catch { luDoc = null; } }
  return luDoc;
}
// the capital's quarters → the commune Luxembourg-Ville
const LU_CITY = ["luxembourg", "luxembourg city", "luxembourg ville", "ville de luxembourg", "luxemburg", "luxemburg stadt", "stad letzebuerg", "letzebuerg", "kirchberg", "limpertsberg", "belair", "bonnevoie", "gare", "cessange", "merl", "hollerich", "clausen", "grund", "pfaffenthal", "weimerskirch", "eich", "dommeldange", "beggen", "cents", "hamm", "pulvermuhl", "neudorf", "gasperich", "muhlenbach", "rollingergrund", "ville haute", "centre ville"];
async function luxembourg(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = luData();
  if (!d) return { status: "no_data" };
  const names = Object.keys(d.communes);
  const parts = String(text).split(",").map((p) => norm(p.replace(/\bL-?\d{4}\b/gi, "").replace(/\b\d+[a-z]?\b/gi, ""))).filter(Boolean);
  let name = null;
  for (const p of [...parts].reverse()) {
    if (/^(luxembourg|luxemburg)$/.test(p) && parts.length > 1 && parts.some((q) => q !== p && names.some((n) => norm(n) === q))) continue; // "Strassen, Luxembourg" = the country
    name = names.find((n) => norm(n) === p) || (LU_CITY.includes(p) ? "Luxembourg-Ville" : null);
    if (name) break;
  }
  if (!name) return { status: "not_matched" };
  if (isHouse(propertyType) && !isApartment(propertyType)) return { status: "lu_no_houses", area: name };
  const c = d.communes[name];
  if (!Number.isFinite(c.avg)) return { status: "lu_few_sales", area: name, sales: c.sales };
  return {
    status: "ok", country: "Luxembourg", value: c.avg, unit: "perSqm", currency: "EUR",
    area: `${name} (commune)`, period: d.period, typeLabel: "existing apartments", salesCount: c.sales,
    others: c.vefaAvg ? [{ type: "off-plan (VEFA) apartments", value: c.vefaAvg, sales: c.vefaSales }] : [],
    source: d.source, sourceUrl: d.sourceUrl,
    basis: `registered average price per m², sales of a single apartment in full ownership recorded in the deeds (grouped sales excluded)${c.range ? `; 90% of prices between ${c.range.replace(" - ", " and ")}` : ""}`
  };
}

// ── Finland ──────────────────────────────────────────────────────────────
// lib/data/finlandPrices.json ← scripts/build-fi-prices.py: Statistics
// Finland, €/m² of old dwellings in housing companies from the asset
// transfer tax data — per postal code (flats by room count, terraced
// houses) and per municipality (flats, terraced). Detached houses are not
// in these statistics.
let fiDoc;
function fiData() {
  if (fiDoc === undefined) { try { fiDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "finlandPrices.json"), "utf8")); } catch { fiDoc = null; } }
  return fiDoc;
}
const FI_SV = { helsingfors: "helsinki", esbo: "espoo", vanda: "vantaa", abo: "turku", tammerfors: "tampere", uleaborg: "oulu", vasa: "vaasa", borga: "porvoo", grankulla: "kauniainen", karleby: "kokkola", jakobstad: "pietarsaari", lovisa: "loviisa", kyrkslatt: "kirkkonummi", sibbo: "sipoo" };
async function finland(text, propertyType, size, bedrooms) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = fiData();
  if (!d) return { status: "no_data" };
  const terraced = /town|terrace|row|rivi/i.test(propertyType || "");
  if (isHouse(propertyType) && !terraced && !isApartment(propertyType)) return { status: "fi_no_detached" };
  const base = { country: "Finland", unit: "perSqm", currency: "EUR", source: d.source, sourceUrl: d.sourceUrl,
    basis: "average price per m² of old dwellings in housing companies sold, from the asset transfer tax data" };
  // postcode first (Helsinki 00100 …)
  const pc = (String(text).match(/\b(\d{5})\b/) || [])[1];
  const p = pc ? d.postcodes[pc] : null;
  if (p) {
    let v = null, label = null;
    if (terraced) { v = p.terraced; label = "terraced houses"; }
    else {
      const b = Number(bedrooms);
      const key = Number.isFinite(b) && bedrooms !== "" && bedrooms != null ? (b <= 0 ? "flats1" : b === 1 ? "flats2" : "flats3") : null;
      if (key && p[key]) { v = p[key]; label = { flats1: "one-room flats", flats2: "two-room flats", flats3: "flats with three rooms or more" }[key]; }
      else {
        // all flat sizes together: the sales-weighted mean of the three
        const parts = ["flats1", "flats2", "flats3"].map((k) => p[k]).filter((x) => x?.eur && x.sales);
        const n = parts.reduce((a, x) => a + x.sales, 0);
        if (n) { v = { eur: Math.round(parts.reduce((a, x) => a + x.eur * x.sales, 0) / n), sales: n }; label = "flats (all sizes, weighted by sales)"; }
      }
    }
    if (v?.eur) {
      const others = [["flats1", "one-room flats"], ["flats2", "two-room flats"], ["flats3", "flats, 3+ rooms"], ["terraced", "terraced houses"]].filter(([k]) => p[k] && p[k] !== v).map(([k, t]) => ({ type: t, value: p[k].eur, sales: p[k].sales }));
      return { ...base, status: "ok", value: v.eur, salesCount: v.sales, area: `postal code ${pc} ${p.area} (${p.municipality})`, period: d.postcodeYear, typeLabel: label, others };
    }
  }
  // municipality
  const names = Object.values(d.municipalities);
  for (const part of [...places(text)].reverse()) {
    const k = norm(part), want = FI_SV[k] || k;
    const m = names.find((x) => norm(x.name) === want);
    if (!m) continue;
    const v = terraced ? m.terraced : m.flats;
    if (!v?.eur) return { status: "fi_few_sales", area: m.name };
    const other = terraced ? m.flats : m.terraced;
    return { ...base, status: "ok", value: v.eur, salesCount: v.sales, area: `${m.name} (municipality)`, period: d.year, typeLabel: terraced ? "terraced houses" : "blocks of flats",
      others: other?.eur ? [{ type: terraced ? "blocks of flats" : "terraced houses", value: other.eur, sales: other.sales }] : [] };
  }
  return { status: pc ? "fi_few_sales" : "not_matched" };
}

// ── Iceland ──────────────────────────────────────────────────────────────
// lib/data/icelandPrices.json ← scripts/build-is-prices.py: HMS purchase
// agreement register (Kaupskrá fasteigna), agreements HMS marks usable,
// finished homes, 12 months — median ISK/m² per postcode and municipality
// for flats, detached and semi-detached/terraced houses (10+ sales).
let isDoc;
function isData() {
  if (isDoc === undefined) { try { isDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "icelandPrices.json"), "utf8")); } catch { isDoc = null; } }
  return isDoc;
}
const IS_TOWNS = { reykjavik: "Reykjavíkurborg", kopavogur: "Kópavogsbær", hafnarfjordur: "Hafnarfjarðarkaupstaður", akureyri: "Akureyrarbær", gardabaer: "Garðabær", mosfellsbaer: "Mosfellsbær", reykjanesbaer: "Reykjanesbær", keflavik: "Reykjanesbær", njardvik: "Reykjanesbær", selfoss: "Sveitarfélagið Árborg", arborg: "Sveitarfélagið Árborg", seltjarnarnes: "Seltjarnarnesbær", akranes: "Akraneskaupstaður", isafjordur: "Ísafjarðarbær", egilsstadir: "Múlaþing", vestmannaeyjar: "Vestmannaeyjabær", hveragerdi: "Hveragerðisbær", husavik: "Norðurþing", borgarnes: "Borgarbyggð", grindavik: "Grindavíkurbær" };
async function iceland(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = isData();
  if (!d) return { status: "no_data" };
  const t = isApartment(propertyType) || !isHouse(propertyType) ? "flats" : /town|terrace|semi/i.test(propertyType || "") ? "semi" : "detached";
  const LABEL = { flats: "flats (fjölbýli)", detached: "detached houses (einbýli)", semi: "semi-detached / terraced houses (sérbýli)" };
  const base = { country: "Iceland", unit: "perSqm", currency: "ISK", source: d.source, sourceUrl: d.sourceUrl, period: `${d.from} – ${d.to}`,
    basis: "median price per m² of recorded purchase agreements that HMS marks usable (no sales between relatives, several properties, financial institutions, payment in kind or partial sales), finished homes" };
  const pick = (e, area) => {
    const v = e?.[t];
    if (!v?.median) return null;
    const others = Object.entries(e).filter(([k, x]) => k !== t && x?.median).map(([k, x]) => ({ type: LABEL[k], value: x.median, sales: x.sales }));
    return { ...base, status: "ok", value: v.median, salesCount: v.sales, area, typeLabel: LABEL[t], others,
      basis: `${base.basis}; middle half ${v.p25.toLocaleString("en-US")}–${v.p75.toLocaleString("en-US")} ISK/m²` };
  };
  const pc = (String(text).match(/(?:^|[\s,])(\d{3})(?=\s|,|$)/) || [])[1];
  if (pc && d.postcodes[pc]) {
    const r = pick(d.postcodes[pc], `postcode ${pc} (${d.postcodes[pc].municipalities.join(", ")})`);
    if (r) return r;
  }
  const names = Object.keys(d.municipalities);
  for (const part of [...places(text)].reverse()) {
    const k = norm(part).replace(/ /g, "");
    const name = IS_TOWNS[k] || names.find((n) => norm(n).replace(/ /g, "") === k);
    if (!name) continue;
    return pick(d.municipalities[name], `${name} (municipality)`) || { status: "is_few_sales", area: name };
  }
  return { status: "not_matched" };
}

// ── Poland ───────────────────────────────────────────────────────────────
// Flats only (both sources cover lokale mieszkalne):
//  - lib/data/polandNbpPrices.json ← scripts/build-pl-nbp.py: NBP BaRN
//    TRANSACTION prices (average, reported by agents and developers), the 16
//    voivodeship capitals + Gdynia, latest quarter, resale and new-build;
//  - lib/data/polandPrices.json ← scripts/build-pl-prices.py: GUS median
//    price per m² of ALL flats sold in market transactions per powiat, by
//    market and flat size, latest year GUS publishes per powiat (20+ sales).
let plGus, plNbp;
function plData() {
  if (plGus === undefined) {
    try { plGus = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "polandPrices.json"), "utf8")); } catch { plGus = null; }
    try { plNbp = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "polandNbpPrices.json"), "utf8")); } catch { plNbp = null; }
  }
  return { gus: plGus, nbp: plNbp };
}
const PL_ALIAS = { warsaw: "warszawa", cracow: "krakow", krakau: "krakow", breslau: "wroclaw", danzig: "gdansk", posen: "poznan", stettin: "szczecin", kattowitz: "katowice", lodz: "lodz" };
const PL_BAND = [["le40", 0, 40, "up to 40 m²"], ["40to60", 40.01, 60, "40–60 m²"], ["60to80", 60.01, 80, "60–80 m²"], ["gt80", 80.01, 1e9, "over 80 m²"]];
async function poland(text, propertyType, size) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const { gus, nbp } = plData();
  if (!gus && !nbp) return { status: "no_data" };
  const plKey = (x) => { const k = norm(String(x).replace(/ł/g, "l").replace(/Ł/g, "L")); return PL_ALIAS[k] || k; };
  const parts = [...places(text)].map((x) => x.replace(/\b\d{2}-\d{3}\b/g, "").trim()).filter(Boolean).reverse();
  // the place: an NBP city, else a GUS gmina / city powiat
  let nbpCity = null, powiatId = null, placeName = null;
  for (const part of parts) {
    const k = plKey(part);
    if (!nbpCity && nbp) nbpCity = Object.keys(nbp.resale).find((c) => plKey(c) === k) || null;
    if (!powiatId && gus) {
      const city = Object.entries(gus.powiats).find(([, v]) => plKey(v.name.replace(/^Powiat m\. (st\. )?/, "")) === k);
      if (city) powiatId = city[0];
      else {
        const g = Object.entries(gus.gminas).find(([n]) => plKey(n) === k);
        if (g && g[1].length === 1) powiatId = g[1][0];
      }
    }
    if (nbpCity || powiatId) { placeName = part; break; }
  }
  if (!nbpCity && !powiatId) return { status: "not_matched" };
  const pw = powiatId && gus ? gus.powiats[powiatId] : null;
  if (isHouse(propertyType) && !isApartment(propertyType)) return { status: "pl_flats_only", area: nbpCity || pw?.name || placeName };
  const sz = Number(size);
  const band = sz > 0 ? PL_BAND.find(([, lo, hi]) => sz >= lo && sz <= hi) : null;
  const gusOthers = pw ? [["resale_all", "resale flats, all sizes"], ...PL_BAND.map(([k, , , l]) => [`resale_${k}`, `resale flats ${l}`]), ["new_all", "new-build flats"]]
    .filter(([k]) => pw[k]).map(([k, l]) => ({ type: `${l} (GUS ${gus.year} median)`, value: pw[k].median, sales: pw[k].sales })) : [];
  const base = { country: "Poland", unit: "perSqm", currency: "PLN" };
  if (nbpCity) {
    const others = [{ type: `new-build flats (NBP ${nbp.quarter} transaction average)`, value: nbp.new[nbpCity] }, ...gusOthers].filter((o) => o.value);
    const yoy = nbp.hedonicYoY?.[nbpCity] ?? null;
    return { ...base, status: "ok", value: nbp.resale[nbpCity], area: `${nbpCity} (city)`, period: nbp.quarter, typeLabel: "resale flats", yoyPercent: yoy,
      source: nbp.source, sourceUrl: nbp.sourceUrl,
      basis: `average TRANSACTION price per m² of resale flats (VAT included), from data estate agents and developers report to the NBP under the official statistics programme — not asking prices${yoy != null ? `; the change shown is NBP's quality-adjusted (hedonic) index for ${nbpCity}` : ""}`, others };
  }
  const pick = band && pw[`resale_${band[0]}`] ? [`resale_${band[0]}`, `resale flats ${band[3]}`] : pw.resale_all ? ["resale_all", "resale flats, all sizes"] : null;
  if (!pick) return { status: "pl_few_sales", area: pw.name };
  return { ...base, status: "ok", value: pw[pick[0]].median, salesCount: pw[pick[0]].sales, area: `${pw.name}${placeName && !pw.name.includes(placeName) ? ` (${placeName})` : ""}`, period: gus.year, typeLabel: pick[1],
    source: gus.source, sourceUrl: gus.sourceUrl,
    basis: `median price per m² of all flats sold in market transactions in the powiat in ${gus.year} (GUS publishes powiat figures about a year and a half later; prices have moved since — see the trend)`,
    others: gusOthers.filter((o) => !o.type.startsWith(pick[1] + " (")) };
}

// ── Czech Republic ───────────────────────────────────────────────────────
// lib/data/czechPrices.json ← scripts/build-cz-prices.py: ČSÚ average
// purchase prices per district (okres) from the ČÚZK cadastre's registered
// sale prices. Flats: price ÷ total floor area → benchmark. Houses: the
// house's share of the sale ÷ HABITABLE area → a different basis, context.
let czDoc;
function czData() {
  if (czDoc === undefined) { try { czDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "czechPrices.json"), "utf8")); } catch { czDoc = null; } }
  return czDoc;
}
const CZ_ALIAS = { prague: "praha", prag: "praha", praga: "praha", brno: "brno mesto", ostrava: "ostrava mesto", plzen: "plzen mesto", pilsen: "plzen mesto", karlsbad: "karlovy vary", budweis: "ceske budejovice" };
async function czech(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = czData();
  if (!d) return { status: "no_data" };
  const key = (x) => { const k = norm(x).replace(/^praha \d+$/, "praha"); return CZ_ALIAS[k] || k; };
  const names = Object.keys(d.districts);
  let name = null;
  for (const part of [...places(text)].reverse()) { const k = key(part); name = names.find((n) => key(n) === k) || null; if (name) break; }
  if (!name) return { status: "not_matched" };
  const e = d.districts[name], y = d.year, py = d.previous;
  const fmt = (v) => `CZK ${v.toLocaleString("en-US")}/m²`;
  const area = name === "Praha" ? "Praha (Prague)" : `${name} district (okres)`;
  if (isHouse(propertyType) && !isApartment(propertyType)) {
    return { status: "context", area, label: `ČSÚ — ${name}, family houses (another basis, see source)`, period: y, note: `ČSÚ (from cadastre sale prices), ${area}, ${y}: family houses ${e.houses[y] ? fmt(e.houses[y]) : "not published"} — per m² of HABITABLE area for the house's share of the sale, a different basis from a total price over floor area, so it is not applied; flats there ${e.flats[y] ? fmt(e.flats[y]) : "not published"}.` };
  }
  const v = e.flats[y];
  if (!v) return { status: "not_matched" };
  const prev = e.flats[py];
  return { country: "Czech Republic", unit: "perSqm", currency: "CZK", status: "ok", value: v, area, period: y, typeLabel: "flats",
    yoyPercent: prev ? Math.round((v / prev - 1) * 1000) / 10 : null,
    source: d.source, sourceUrl: d.sourceUrl,
    basis: `average purchase price per m² of floor area of flats sold, from the prices registered in the cadastre (ČÚZK); the change shown is the average price ${py} → ${y}, not quality-adjusted`,
    others: [e.houses[y] ? { type: "family houses (per m² of habitable area, house share only — not comparable)", value: e.houses[y] } : null].filter(Boolean) };
}

// ── Hungary ──────────────────────────────────────────────────────────────
// lib/data/hungaryPrices.json ← scripts/build-hu-prices.py: KSH used-home
// prices (NAV duty data on registered sales). Budapest by building type
// (STADAT lak0028, latest year); county seats: houses and flats TOGETHER
// (quarterly release) → context + the town's own change on a year earlier.
let huDoc;
function huData() {
  if (huDoc === undefined) { try { huDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "hungaryPrices.json"), "utf8")); } catch { huDoc = null; } }
  return huDoc;
}
async function hungary(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = huData();
  if (!d) return { status: "no_data" };
  const huf = (v) => `HUF ${Math.round(v).toLocaleString("en-US")}/m²`;
  const t = norm(text);
  const base = { country: "Hungary", unit: "perSqm", currency: "HUF", source: d.source, sourceUrl: d.stadatUrl };
  if (/\bbudapest\b/.test(t)) {
    const b = d.budapest;
    const trend = b.yoy != null ? `; Budapest used homes ${b.yoy >= 0 ? "+" : ""}${b.yoy}% on a year earlier (${d.quarter})` : "";
    if (isHouse(propertyType) && !isApartment(propertyType)) {
      return { ...base, status: "ok", value: b.houses, area: "Budapest", period: d.year, typeLabel: "houses and terraced houses (used)", yoyPercent: b.yoy,
        basis: `average price per m² of used family and terraced houses sold in Budapest in ${d.year} (KSH, from NAV duty data)`,
        others: [{ type: "flats in non-panel multi-unit buildings", value: b.flats }, ...(b.panel ? [{ type: "flats on panel estates", value: b.panel }] : [])] };
    }
    return { status: "context", area: "Budapest", yoyPercent: b.yoy, label: "KSH — Budapest used flats (two official figures, see source)", marketArea: "Budapest — two official flat figures (panel / non-panel), none applied", period: d.year, trendText: `KSH (${d.quarter}): Budapest used homes ${b.yoy >= 0 ? "+" : ""}${b.yoy}% on a year earlier`,
      note: `KSH (from NAV duty data), Budapest ${d.year}, used flats: ${huf(b.flats)} in non-panel multi-unit buildings${b.panel ? `, ${huf(b.panel)} on panel estates` : ""} — two official figures for a flat, so neither is applied (compare the flat with the matching one); houses ${huf(b.houses)}${trend}.` };
  }
  const seat = Object.keys(d.countySeats).find((n) => new RegExp(`\\b${norm(n)}\\b`).test(t));
  if (seat) {
    const v = d.countySeats[seat];
    return { status: "context", area: seat, yoyPercent: v.yoy, label: `KSH — ${seat}, used homes (all types, see source)`, marketArea: `${seat} — official figure for all home types together, not applied`, period: d.quarter, trendText: `KSH (${d.quarter}): ${seat} used homes ${v.yoy >= 0 ? "+" : ""}${v.yoy}% on a year earlier`,
      note: `KSH (from NAV duty data), ${d.quarter}: used homes in ${seat} sold for ${huf(v.value)} on average — houses and flats together, so it is not applied to one home type; ${v.yoy >= 0 ? "+" : ""}${v.yoy}% on a year earlier.` };
  }
  return { status: "not_matched" };
}

// ── Slovenia ─────────────────────────────────────────────────────────────
// lib/data/sloveniaPrices.json ← scripts/build-si-prices.py: GURS annual
// real-estate market report (from the Real Estate Market Register, every
// recorded sale). Existing flats: median € per m² of USEFUL floor area per
// market analysis area (MAA) and its local areas (LAAs) → benchmark. Houses
// with their land: median WHOLE price → context. A place counts only when
// GURS itself names it (an LAA's name, or a town the report lists in an MAA);
// Ljubljana / Maribor neighbourhoods only together with the city's name.
let siDoc;
function siData() {
  if (siDoc === undefined) { try { siDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "sloveniaPrices.json"), "utf8")); } catch { siDoc = null; } }
  return siDoc;
}
const SI_ALIAS = { "ljubljana center": "ljubljana", "ljubljana centre": "ljubljana", "ravne na koroskem": "ravne", "portoroz portorose": "portoroz", "piran pirano": "piran", "koper capodistria": "koper", "izola isola": "izola", "ankaran ancarano": "ankaran", "zagorje ob savi": "zagorje" };
const siTitle = (s) => String(s).toLowerCase().replace(/(^|[\s,(–-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(And|Of|The|Excluding)\b/g, (w) => w.toLowerCase());
async function slovenia(text, propertyType) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = siData();
  if (!d) return { status: "no_data" };
  const k = (x) => { const v = norm(x); return SI_ALIAS[v] || v; };
  const parts = places(text).map((p) => k(p.replace(/\b\d{4}\b/g, "")));
  const towns = {};
  // two spellings of one town (Zagorje / Zagorje ob Savi): its local area wins
  for (const [t, v] of Object.entries(d.towns)) { const key = k(t); if (!towns[key] || (!towns[key].laa && v.laa)) towns[key] = { ...v, name: t }; }
  const hasCity = (c) => parts.some((p) => p === c || p.startsWith(`${c} `));
  const hits = [];
  for (const p of parts) {
    const t = towns[p] || (p.startsWith("ljubljana ") ? towns[p.slice(10)] : p.startsWith("maribor ") ? towns[p.slice(8)] : null);
    if (!t) continue;
    // a Ljubljana / Maribor neighbourhood (Šiška, Tabor …) only with the city named
    if (t.laa && (t.maa === "LJUBLJANA" || t.maa === "MARIBOR") && !hasCity(t.maa.toLowerCase())) continue;
    hits.push(t);
  }
  const nat = d.national;
  if (!hits.length) {
    return { status: "needs_district", note: `GURS (Slovenia's surveying and mapping authority) publishes ${d.year} median prices for its market analysis areas and the towns in them — this place is not one GURS names, so no local figure is applied; enter the town (e.g. Ljubljana, Maribor, Koper, Kranj, Bled). Slovenia overall, ${d.year}: existing flats €${nat.flats.median.toLocaleString("en-US")}/m² of useful floor area (${nat.flats.sales.toLocaleString("en-US")} sales), houses €${nat.houses.median.toLocaleString("en-US")} each (context only).` };
  }
  const maas = [...new Set(hits.map((h) => h.maa))];
  if (maas.length > 1) return { status: "needs_district", note: `The place matches more than one of GURS's market areas (${maas.map(siTitle).join(", ")}) — no local figure is applied; enter just the town.` };
  const maaName = maas[0], maa = d.maas[maaName];
  const laas = [...new Set(hits.map((h) => h.laa).filter(Boolean))];
  const laaName = laas.length === 1 ? laas[0] : null;
  const laa = laaName ? maa.laas[laaName] : null;
  const where = (lvl) => lvl === "laa" ? `${siTitle(laaName)} (${siTitle(maaName)} market area)` : `${siTitle(maaName)} market area`;
  const eur = (v) => `€${Math.round(v).toLocaleString("en-US")}`;
  const house = (isHouse(propertyType) && !isApartment(propertyType));
  const kind = house ? "houses" : "flats";
  const level = laa?.[kind] ? "laa" : maa[kind] ? "maa" : null;
  const fig = level === "laa" ? laa[kind] : level === "maa" ? maa[kind] : null;
  const gap = laaName && level === "maa" ? ` GURS publishes no separate ${kind === "flats" ? "flat" : "house"} figure for ${siTitle(laaName)} (too few sales), so the market area's is used.` : "";
  const tr = maa.trend?.[kind];
  const trendText = tr != null ? `GURS: ${kind} in the ${siTitle(maaName)} market area ${tr >= 0 ? "+" : ""}${tr}% ${Number(d.year) - 1} → ${d.year}` : null;
  if (!fig) return { status: "needs_district", area: siTitle(maaName), note: `GURS publishes no ${d.year} median for ${kind} in ${siTitle(laaName || maaName)} (too few sales).` };
  if (house) {
    const flats = (level === "laa" ? laa.flats : null) || maa.flats;
    return { status: "context", area: where(level), yoyPercent: tr ?? null, trendText, period: d.year,
      label: `GURS — ${where(level)}, houses (whole price, see source)`, marketArea: `${where(level)} — official median house price (whole house with land), not applied`,
      note: `GURS (Real Estate Market Register), ${d.year}, existing houses with their land sold in ${where(level)}: median ${eur(fig.median)} (middle half ${eur(fig.p25)}–${eur(fig.p75)}; ${fig.sales} sales; median house ${fig.houseArea} m², land ${fig.landArea} m², built ${fig.yearBuilt}) — a whole-house price, not per m², so it is not applied to this house.${gap}${flats ? ` Existing flats there: ${eur(flats.median)}/m² of useful floor area.` : ""}` };
  }
  const others = [];
  if (level === "maa") {
    const sub = Object.entries(maa.laas).filter(([, v]) => v.flats).sort((a, b) => a[1].flats.median - b[1].flats.median);
    if (sub.length > 1) { const lo = sub[0], hi = sub[sub.length - 1]; others.push({ type: `flats, lowest local area (${siTitle(lo[0])})`, value: lo[1].flats.median, sales: lo[1].flats.sales }, { type: `flats, highest local area (${siTitle(hi[0])})`, value: hi[1].flats.median, sales: hi[1].flats.sales }); }
  } else others.push({ type: `flats, whole ${siTitle(maaName)} market area`, value: maa.flats.median, sales: maa.flats.sales });
  return { country: "Slovenia", unit: "perSqm", currency: "EUR", status: "ok", value: fig.median, salesCount: fig.sales, area: where(level), period: d.year, typeLabel: "existing flats",
    yoyPercent: tr ?? null, source: d.source, sourceUrl: d.sourceUrl,
    basis: `median price per m² of USEFUL floor area (living rooms — balconies, terraces and basements not counted) of existing flats sold in ${d.year}, middle half ${eur(fig.p25)}–${eur(fig.p75)}/m², median flat ${fig.usefulArea} m² built ${fig.yearBuilt}${tr != null ? `; the change shown is GURS's flat price change for the whole ${siTitle(maaName)} market area, ${Number(d.year) - 1} → ${d.year}` : ""}.${gap}${maa.houses ? ` Houses with their land in the market area: median ${eur(maa.houses.median)} each (whole price, ${maa.houses.sales} sales)` : ""}`,
    others };
}

// ── Latvia ───────────────────────────────────────────────────────────────
// lib/data/latviaPrices.json ← scripts/build-lv-prices.py: VZD (State Land
// Service) market statistics per city / town / parish — MEDIAN WHOLE PRICE
// of apartments by number of rooms and of houses by floor-area band, last
// full year. VZD prepares them automatically without reviewing each sale →
// context only (never the benchmark); a figure needs 10+ sales here.
let lvDoc;
function lvData() {
  if (lvDoc === undefined) { try { lvDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "latviaPrices.json"), "utf8")); } catch { lvDoc = null; } }
  return lvDoc;
}
const LV_BANDS = [["houses_0_40", 0, 40, "up to 40 m²"], ["houses_40_60", 40, 60, "40–60 m²"], ["houses_60_110", 60, 110, "60–110 m²"], ["houses_110_180", 110, 180, "110–180 m²"], ["houses_180_250", 180, 250, "180–250 m²"], ["houses_250_", 250, Infinity, "over 250 m²"]];
async function latvia(text, propertyType, size) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = lvData();
  if (!d) return { status: "no_data" };
  const k = (x) => { const v = norm(String(x).replace(/\bLV-?\d{4}\b/gi, "")); return v === "riga" || v === "riga city" ? "riga" : v; };
  let place = null;
  for (const p of [...places(text)].reverse()) {
    const hits = d.places.filter((e) => k(e.name) === k(p));
    if (hits.length === 1) { place = hits[0]; break; }
  }
  if (!place) return { status: "not_matched" };
  const y = d.year, eur = (v) => `€${Math.round(v).toLocaleString("en-US")}`;
  const fig = (key) => { const f = place[key]?.[y]; return f && f.sales >= 10 ? f : null; };
  const house = isHouse(propertyType) && !isApartment(propertyType);
  const flats = [1, 2, 3, 4].map((r) => [r, fig(`flats_${r}`)]).filter(([, f]) => f);
  const bands = LV_BANDS.map(([key, lo, hi, label]) => [label, fig(key), lo, hi]).filter(([, f]) => f);
  const sz = Number(size);
  const mine = house && sz > 0 ? bands.find(([, , lo, hi]) => sz > lo && sz <= hi) : null;
  const flatTxt = flats.length ? `apartments — ${flats.map(([r, f]) => `${r} room${r > 1 ? "s" : ""} ${eur(f.median)} (${f.sales} sales)`).join(", ")}` : "";
  const houseTxt = bands.length ? `houses — ${bands.map(([l, f]) => `${l} ${eur(f.median)} (${f.sales})`).join(", ")}` : "";
  const parts = house ? [houseTxt, flatTxt] : [flatTxt, houseTxt];
  if (!parts.some(Boolean)) return { status: "needs_district", area: place.name, note: `VZD publishes no ${y} median for ${place.name} with 10+ sales.` };
  const area = place.name === place.novads || place.name === "Rīga" ? place.name : `${place.name} (${place.novads})`;
  return { status: "context", area, period: y,
    label: `VZD — ${place.name}, ${house ? "houses" : "apartments"} (whole prices, see source)`,
    marketArea: `${area} — official median prices per home, not applied`,
    note: `VZD (State Land Service), sales registered in ${y}, ${area}: median price per home — ${parts.filter(Boolean).join("; ")}.${mine ? ` A house of ${sz} m² is in the ${mine[0]} band: ${eur(mine[1].median)}.` : ""} Whole prices (not per m²; a Latvian room count includes the living room), prepared automatically by VZD without reviewing each sale — so none is applied as the benchmark.` };
}

// ── Estonia ──────────────────────────────────────────────────────────────
// lib/data/estoniaPrices.json — copied by hand from the Land and Spatial
// Board's quarterly review (its own transaction database): Tallinn average
// €/m² of resale flats (all sizes) → benchmark for a Tallinn flat; the
// review's 2-room flat figures (40–55 m²) for Tartu, Pärnu and some Tallinn
// districts → benchmark only for a flat of 40–55 m², otherwise context.
// No house prices are published there. Update each quarter.
let eeDoc;
function eeData() {
  if (eeDoc === undefined) { try { eeDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "estoniaPrices.json"), "utf8")); } catch { eeDoc = null; } }
  return eeDoc;
}
async function estonia(text, propertyType, size) {
  if (/commercial|land/i.test(propertyType || "")) return { status: "not_residential" };
  const d = eeData();
  if (!d) return { status: "no_data" };
  const t = ` ${norm(text)} `;
  const has = (n) => t.includes(` ${norm(n)} `);
  const eur = (v) => `€${v.toLocaleString("en-US")}/m²`;
  const inTallinn = has("Tallinn") || ["Kesklinn", "Lasnamäe", "Mustamäe", "Pirita", "Haabersti", "Kristiine", "Nõmme", "Põhja-Tallinn"].some((x) => has(x) && has("Tallinn"));
  const district = inTallinn ? Object.keys(d.twoRoomResale).find((k) => k !== "Tallinn" && has(k)) || null : null;
  const town = inTallinn ? "Tallinn" : has("Tartu") ? "Tartu" : has("Pärnu") ? "Pärnu" : null;
  const house = isHouse(propertyType) && !isApartment(propertyType);
  const sz = Number(size);
  const twoRoomSize = sz >= 40 && sz <= 55;
  const ctx = (area, note) => ({ status: "context", area, period: d.period, label: `Maa- ja Ruumiamet — ${area} (see source)`, marketArea: `${area} — official flat figures, not applied`, note });
  if (!town) return ctx("Estonia outside Tallinn", `Maa- ja Ruumiamet, ${d.period}: resale flats in Estonia outside Tallinn averaged ${eur(d.restResale)}, new flats ${eur(d.restNew)} — a figure for the whole country outside Tallinn, not applied to one town. No official house price is published.`);
  if (house) return ctx(town, `Maa- ja Ruumiamet, ${d.period}: the review publishes flat prices only (${town} resale ${town === "Tallinn" ? `${eur(d.tallinnResale.value)} all sizes` : `2-room ${eur(d.twoRoomResale[town])}`}) — no official price for houses, so none is applied.`);
  const base = { country: "Estonia", unit: "perSqm", currency: "EUR", status: "ok", period: d.period, source: d.source, sourceUrl: d.sourceUrl };
  const dist2 = district ? d.twoRoomResale[district] : null;
  if (district && dist2 && twoRoomSize) {
    return { ...base, value: dist2, area: `${district}, Tallinn`, typeLabel: "resale 2-room flats (40–55 m²)", yoyPercent: d.tallinnResale.yoy,
      basis: `average price per m² of resale 2-room flats (40–55 m²) sold in ${district} in ${d.period}; the change shown is Tallinn's resale flats on a year earlier`,
      others: [{ type: "resale flats, all of Tallinn (all sizes)", value: d.tallinnResale.value }, ...(d.twoRoomNew[district] ? [{ type: `new 2-room flats in ${district}`, value: d.twoRoomNew[district] }] : [])] };
  }
  if (town === "Tallinn") {
    return { ...base, value: d.tallinnResale.value, area: "Tallinn", typeLabel: "resale flats (all sizes)", yoyPercent: d.tallinnResale.yoy,
      basis: `average price per m² of resale flats sold in Tallinn in ${d.period}${district && dist2 ? `; ${district} resale 2-room flats ${eur(dist2)} (applied only to a 40–55 m² flat)` : ""}`,
      others: [{ type: "new flats, Tallinn", value: d.tallinnNew.value }, { type: "resale 2-room flats (40–55 m²), Tallinn", value: d.twoRoomResale.Tallinn }] };
  }
  if (!twoRoomSize) return ctx(town, `Maa- ja Ruumiamet, ${d.period}: ${town} resale 2-room flats (40–55 m²) ${eur(d.twoRoomResale[town])}, new 2-room flats ${eur(d.twoRoomNew[town])} — published for 40–55 m² flats only, so not applied to a ${sz ? `${sz} m²` : "flat of unknown size"}.`);
  return { ...base, value: d.twoRoomResale[town], area: `${town} (city)`, typeLabel: "resale 2-room flats (40–55 m²)", yoyPercent: null,
    basis: `average price per m² of resale 2-room flats (40–55 m²) sold in ${town} in ${d.period}`, others: [{ type: `new 2-room flats, ${town}`, value: d.twoRoomNew[town] }] };
}

const RESOLVERS = { netherlands, "the netherlands": netherlands, norway, sweden, ireland, denmark, austria, croatia, luxembourg, finland, iceland, poland, czech, "czech republic": czech, czechia: czech, hungary, slovenia, latvia, estonia };

export async function europeLocalPrice({ country, city, address, propertyType, size, bedrooms }) {
  const f = RESOLVERS[norm(country)];
  if (!f) return null;
  const text = [...new Set([address, city].filter(Boolean))].join(", ");
  if (!text) return { status: "no_place" };
  try { return await f(text, propertyType, size, bedrooms); } catch (e) { return { status: "error", error: String(e?.message || e) }; }
}
