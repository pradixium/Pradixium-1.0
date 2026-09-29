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
const places = (text) => String(text || "").split(",").map((p) => p.replace(/\b\d{4}\s?[A-Z]{2}\b/g, "").replace(/\b\d{3,5}\b/g, "").trim()).filter((p) => p && !/^(netherlands|nederland|norway|norge|sweden|sverige|ireland|eire|the netherlands|holland|denmark|danmark|austria|osterreich|österreich|croatia|hrvatska)$/i.test(p));
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
  let pt = null;
  if (/\d/.test(ps[0] || "")) {
    const a = await getJson(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(ps.join(" "))}&per_side=1&struktur=mini`, 6000).catch(() => []);
    if (a[0]) pt = [a[0].x, a[0].y];
  }
  if (!pt) {
    const EN = { copenhagen: "København", aarhus: "Aarhus", arhus: "Aarhus", elsinore: "Helsingør" };
    for (const raw of [...ps].reverse()) {
      const p = EN[norm(raw)] || raw;
      const list = await getJson(`https://api.dataforsyningen.dk/postnumre?q=${encodeURIComponent(p)}`, 6000).catch(() => []);
      // "København K", "København Ø" … are postal districts of one town
      const m = list.filter((x) => norm(x.navn) === norm(p) || norm(x.navn).startsWith(`${norm(p)} `));
      if (m.length) {
        // a real address inside the postal area (a postal-area centre can lie at sea)
        const a = await getJson(`https://api.dataforsyningen.dk/adresser?postnr=${m[0].nr}&per_side=1&struktur=mini`, 6000).catch(() => []);
        pt = a[0] ? [a[0].x, a[0].y] : m[0].visueltcenter;
        break;
      }
    }
  }
  if (!pt) return { status: "not_matched" };
  const ld = await getJson(`https://api.dataforsyningen.dk/landsdele/reverse?x=${pt[0]}&y=${pt[1]}`, 6000);
  const meta = await cached("dk:meta", 24 * 3600e3, () => getJson("https://api.statbank.dk/v1/tableinfo/EJEN77?format=JSON", 8000));
  const omr = meta.variables.find((v) => v.id === "OMRÅDE").values.find((v) => norm(v.text) === norm(`Landsdel ${ld.navn}`));
  if (!omr) return { status: "not_matched" };
  const kate = isApartment(propertyType) ? ["2103", "owner-occupied flats (ejerlejligheder)"] : /summer|holiday/i.test(propertyType || "") ? ["0801", "summer houses"] : ["0111", "one-family houses (enfamiliehuse)"];
  const tids = meta.variables.find((v) => v.id === "Tid").values.slice(-5).map((v) => v.id);
  const d = await getJson(`https://api.statbank.dk/v1/data/EJEN77/JSONSTAT?OMR%C3%85DE=${omr.id}&EJENDOMSKATE=${kate[0]}&BN%C3%98GLE=2,3&OVERDRAG=1&Tid=${tids.join(",")}`, 8000);
  const ds = d.dataset || d;
  const dims = ds.dimension.id, size = ds.dimension.size;
  const pos = (dim, code) => ds.dimension[dim].category.index[code];
  const val = (bn, t) => { let i = 0; dims.forEach((dim, k) => { const c = dim === "BNØGLE" ? bn : dim === "Tid" ? t : Object.keys(ds.dimension[dim].category.index)[0]; i = i * size[k] + pos(dim, c); }); return ds.value[i]; };
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

const RESOLVERS = { netherlands, "the netherlands": netherlands, norway, sweden, ireland, denmark, austria, croatia, luxembourg, finland, iceland };

export async function europeLocalPrice({ country, city, address, propertyType, size, bedrooms }) {
  const f = RESOLVERS[norm(country)];
  if (!f) return null;
  const text = [...new Set([address, city].filter(Boolean))].join(", ");
  if (!text) return { status: "no_place" };
  try { return await f(text, propertyType, size, bedrooms); } catch (e) { return { status: "error", error: String(e?.message || e) }; }
}
