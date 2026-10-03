/* PRADIXIUM™ — TURKEY NATIONAL INTELLIGENCE ENGINE
 * Türkiye İstatistik Kurumu (TÜİK/TurkStat) does NOT publish a house
 * price index — only residential SALES VOLUME statistics (how many homes
 * sold, by province), a different metric entirely. The real official
 * price benchmark is the Central Bank of the Republic of Turkey (TCMB) —
 * "Konut Fiyat Endeksi" (KFE), the Housing Price Index, hedonic-regression
 * based, monthly, base 2023=100 — published via TCMB's EVDS (Elektronik
 * Veri Dağıtım Sistemi / Electronic Data Delivery System) API.
 *
 * Series code TP.KFE.TR confirmed directly (not guessed) from a live
 * EVDS export the user pulled themselves (Sept 2026): real monthly values
 * from 2014-02 (6.73) to 2026-08 (236.76) — the huge nominal rise reflects
 * Turkish Lira depreciation/inflation over that period, not a data error.
 * EVDS metadata for this series: "Veri Kaynağı: TCMB", methodology link
 * https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Reel+Sektor+Istatistikleri/Konut+Fiyat+Endeksi/Metaveri
 *
 * EVDS requires a free registered API key (TCMB_EVDS_API_KEY env var) —
 * same pattern as ANTHROPIC_API_KEY: read from env, degrade honestly to
 * "unavailable" if unset, never block the rest of the report on it.
 *
 * Regions (Oct 3 2026): EVDS carries KFE and YKKE for 19 İBBS region
 * groups (TP.KFE.TR10 İstanbul … TP.KFE.TRC), codes read from TCMB's public
 * EVDS tables by scripts/build-tr-kfe.py. Everything shown comes from EVDS:
 * its terms allow use with the source named; TCMB's website content (the
 * KFE.pdf release) needs written permission for commercial use → not used.
 */
import { turkeyRegion, kfePeriodLabel, turkeyUnitCodes } from "../lib/turkey/kfe.js";

const EVDS_SERIES = "TP.KFE.TR";
// EVDS moved (checked Oct 2 2026): evds2.tcmb.gov.tr/service/evds/ now
// 302-redirects to the evds3 home page (HTML → every Turkish report showed
// "source unavailable"); the API lives at evds3 …/igmevdsms-dis/ and
// answers {"message":"Required request header 'key' is not present"}
// without a key, "Invalid API Key" with a wrong one.
const EVDS_BASE_URL = "https://evds3.tcmb.gov.tr/igmevdsms-dis/";

function formatEvdsDate(date) {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function fetchJson(url, apiKey, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // EVDS has moved the API key from a query parameter to an HTTP header
    // in recent security updates (per TCMB's own EVDS3 rollout notes) —
    // sent as a header here; if this adapter reports auth failures once
    // live, retrying with `key=<APIKEY>` appended to the query string
    // instead is the documented legacy fallback.
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", key: apiKey }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseEvdsNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}


// EVDS rows → { period "YYYY-MM", value } sorted by date ("2026-8" and
// "2026-08" both handled), latest value + change on the same month a year
// earlier
function yoy(items, code) {
  const key = code.replace(/\./g, "_");
  const rows = items.map((r) => {
    const [y, m] = String(r?.Tarih || "").split("-").map(Number);
    return { y, m, value: parseEvdsNumber(r?.[key]) };
  }).filter((r) => r.y && r.m && r.value != null).sort((a, b) => a.y - b.y || a.m - b.m);
  const last = rows[rows.length - 1];
  if (!last) return null;
  const ago = rows.find((r) => r.y === last.y - 1 && r.m === last.m);
  return { period: `${last.y}-${String(last.m).padStart(2, "0")}`, value: last.value,
    yoyPercent: ago?.value > 0 ? Math.round((last.value / ago.value - 1) * 1000) / 10 : null };
}

// the property's region group (or the national figure) + new-tenant rents,
// as the orchestrator's generic regional hook — all from EVDS
function kfeRegional(m, s) {
  if (!s.kfe || s.kfe.yoyPercent == null) return null;
  const r = m?.region && s.rKfe?.yoyPercent != null ? m.region : null;
  const price = r ? s.rKfe : s.kfe;
  const rent = r && s.rYkke?.yoyPercent != null ? s.rYkke : s.ykke;
  const [y, mo] = price.period.split("-").map(Number);
  const area = r ? (r.provinces.length > 1 ? `${m.province} (TCMB region ${r.code}: ${r.label})` : r.label) : "Türkiye (national)";
  const sign = (v) => `${v >= 0 ? "+" : ""}${v}%`;
  return {
    area, period: kfePeriodLabel(price.period), comparedWith: kfePeriodLabel(`${y - 1}-${String(mo).padStart(2, "0")}`),
    allTypes: true, sourceName: "TCMB",
    flatsAnnualChangePercent: price.yoyPercent, housesAnnualChangePercent: price.yoyPercent,
    national: !r, nationalAll: s.kfe.yoyPercent,
    note: `${rent?.yoyPercent != null ? `New-tenant rents (TCMB YKKE) ${sign(rent.yoyPercent)} on a year earlier${r && rent !== s.ykke && s.ykke?.yoyPercent != null ? ` (Türkiye ${sign(s.ykke.yoyPercent)})` : ""}. ` : ""}Nominal Turkish lira, not inflation-adjusted`,
    source: "TCMB — Konut Fiyat Endeksi (KFE) and Yeni Kiracı Kira Endeksi (YKKE), EVDS",
    sourceUrl: "https://evds3.tcmb.gov.tr/"
  };
}

// TCMB's quarterly median unit price and unit rent (TL per m² of GROSS
// area) from the valuation reports made for mortgage applications —
// appraisals, not sale prices → context only, said so
async function unitValues(city, apiKey) {
  const m = turkeyRegion(city);
  const codes = turkeyUnitCodes(m?.province);
  if (!codes || !apiKey) return null;
  const list = [codes.price, codes.rent, codes.priceTR, codes.rentTR].filter(Boolean);
  const end = new Date(); const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 30);
  const url = `${EVDS_BASE_URL}series=${list.join("-")}&startDate=${formatEvdsDate(start)}&endDate=${formatEvdsDate(end)}&type=json`;
  const json = await fetchJson(url, apiKey, 6000);
  const items = Array.isArray(json?.items) ? json.items : [];
  const series = (code) => items.map((r) => ({ period: r?.Tarih, value: parseEvdsNumber(r?.[code.replace(/\./g, "_")]) })).filter((r) => r.period && r.value != null);
  const pick = (code) => {
    if (!code) return null;
    const rows = series(code);
    const last = rows[rows.length - 1];
    if (!last) return null;
    const prev = rows.length >= 5 ? rows[rows.length - 5] : null;   // the same quarter a year earlier
    return { period: last.period, value: last.value, yearAgo: prev?.value ?? null, yearAgoPeriod: prev?.period ?? null };
  };
  const out = { province: codes.province, price: pick(codes.price), rent: pick(codes.rent), priceTR: pick(codes.priceTR), rentTR: pick(codes.rentTR) };
  return out.price || out.rent ? out : null;
}
function unitText(u) {
  if (!u) return "";
  const tl = (v) => `TL ${Math.round(v).toLocaleString("en-US")}`;
  const parts = [];
  if (u.price) parts.push(`median value ${tl(u.price.value)}/m² of gross area (${u.price.period}${u.priceTR ? `; Türkiye ${tl(u.priceTR.value)}` : ""})`);
  if (u.rent) parts.push(`median rent ${tl(u.rent.value)}/m² a month (${u.rent.period}${u.rentTR ? `; Türkiye ${tl(u.rentTR.value)}` : ""})`);
  return parts.length ? `. TCMB, ${u.province}: ${parts.join(", ")} — from the valuation reports for mortgage applications (appraisals, not sale prices), so context only` : "";
}

// No figures without EVDS: TCMB's website release (KFE.pdf) may not be
// used commercially without TCMB's written permission
function unavailable(message, error) {
  return {
    market: "Turkey Residential Property Market",
    status: "SOURCE_TEMPORARILY_UNAVAILABLE",
    message, ...(error ? { error } : {}),
    sourceUrls: { tcmb: "https://www.tcmb.gov.tr/wps/wcm/connect/en/tcmb+en/main+menu/statistics/real+sector+statistics/residential+property+price+index" }
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const city = String(req.query?.city || "").trim() || null;
  const apiKey = process.env.TCMB_EVDS_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      success: true,
      country: "Turkey",
      city,
      data: unavailable("TCMB EVDS API key is not configured on the server.")
    });
  }

  try {
    const m = turkeyRegion(city);
    const d = m?.doc;
    const codes = [d?.national?.kfe || EVDS_SERIES, d?.national?.ykke, m?.region?.kfe, m?.region?.ykke].filter(Boolean);
    const end = new Date();
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - 15); // a year-earlier month with a margin for the release lag

    const url = `${EVDS_BASE_URL}series=${codes.join("-")}&startDate=${formatEvdsDate(start)}&endDate=${formatEvdsDate(end)}&type=json`;
    const [json, units] = await Promise.all([fetchJson(url, apiKey), unitValues(city, apiKey).catch(() => null)]);
    const items = Array.isArray(json?.items) ? json.items : [];
    const s = {
      kfe: yoy(items, codes[0]), ykke: d?.national?.ykke ? yoy(items, d.national.ykke) : null,
      rKfe: m?.region ? yoy(items, m.region.kfe) : null, rYkke: m?.region ? yoy(items, m.region.ykke) : null
    };
    if (!s.kfe) {
      return res.status(200).json({
        success: true, country: "Turkey", city,
        data: unavailable("TCMB EVDS responded, but no usable Housing Price Index rows were found.")
      });
    }
    const regional = kfeRegional(m, s);
    if (regional && units) regional.note += unitText(units);
    return res.status(200).json({
      success: true,
      country: "Turkey",
      city,
      data: {
        market: "Turkey Residential Property Market",
        housingPriceIndex: {
          period: s.kfe.period,
          indexValue: s.kfe.value,
          annualChangePercent: s.kfe.yoyPercent,
          unit: "Housing Price Index (hedonic regression), base 2023=100 — nominal Turkish Lira terms, not inflation-adjusted",
          regional,
          source: "TCMB (Central Bank of the Republic of Turkey) — Konut Fiyat Endeksi (KFE), via EVDS"
        },
        unitValues: units,
        cityLevelStatus: "REGIONAL",
        cityLevelNote: "Region figures: TCMB's KFE / YKKE series per İBBS region group (provinces as TCMB lists them), EVDS.",
        sources: { tcmb: "TCMB — Konut Fiyat Endeksi (KFE), via EVDS" },
        sourceUrls: {
          tcmb: "https://www.tcmb.gov.tr/wps/wcm/connect/en/tcmb+en/main+menu/statistics/real+sector+statistics/residential+property+price+index",
          methodology: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Reel+Sektor+Istatistikleri/Konut+Fiyat+Endeksi/Metaveri"
        },
        coverage: "Official price and rent trends by region; TCMB publishes no price level per m²."
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      country: "Turkey",
      city,
      data: unavailable("TCMB EVDS could not be fetched at this moment.", String(error?.message || error))
    });
  }
}
