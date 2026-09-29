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
const places = (text) => String(text || "").split(",").map((p) => p.replace(/\b\d{4}\s?[A-Z]{2}\b/g, "").replace(/\b\d{3,5}\b/g, "").trim()).filter((p) => p && !/^(netherlands|nederland|norway|norge|sweden|sverige|ireland|eire|the netherlands|holland)$/i.test(p));
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

const RESOLVERS = { netherlands, "the netherlands": netherlands, norway, sweden, ireland };

export async function europeLocalPrice({ country, city, address, propertyType }) {
  const f = RESOLVERS[norm(country)];
  if (!f) return null;
  const text = [...new Set([address, city].filter(Boolean))].join(", ");
  if (!text) return { status: "no_place" };
  try { return await f(text, propertyType); } catch (e) { return { status: "error", error: String(e?.message || e) }; }
}
