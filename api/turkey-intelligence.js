/* PRADIXIUM™ — TURKEY NATIONAL INTELLIGENCE ENGINE
 * Türkiye İstatistik Kurumu (TÜİK/TurkStat) does NOT publish a house
 * price index — only residential SALES VOLUME statistics (how many homes
 * sold, by province), a different metric entirely. The real official
 * price benchmark is the Central Bank of the Republic of Turkey (TCMB) —
 * "Konut Fiyat Endeksi" (KFE), the Housing Price Index, hedonic-regression
 * based, monthly, base 2010=100 — published via TCMB's EVDS (Elektronik
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
 * NOT YET CONFIRMED (national-only for now, deliberately, rather than
 * guessing): whether EVDS also carries a province/city-level breakdown
 * of this same series (Istanbul specifically, the highest-volume market)
 * — the EVDS UI showed region-group checkboxes (e.g. "TRC" — Turkey's
 * official NUTS-style statistical regions) alongside this series, which
 * suggests one may exist, but the exact series-code pattern for it was
 * not verified. A future pass can add it once confirmed the same way
 * this national series was: from a live EVDS export, not a guess.
 */
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
      data: {
        market: "Turkey Residential Property Market",
        status: "SOURCE_TEMPORARILY_UNAVAILABLE",
        message: "TCMB EVDS API key is not configured on the server.",
        sourceUrls: { tcmb: "https://www.tcmb.gov.tr/wps/wcm/connect/en/tcmb+en/main+menu/statistics/real+sector+statistics/residential+property+price+index" }
      }
    });
  }

  try {
    const end = new Date();
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - 14); // 14 months back covers a real YoY comparison with a margin for reporting lag

    const url = `${EVDS_BASE_URL}series=${EVDS_SERIES}&startDate=${formatEvdsDate(start)}&endDate=${formatEvdsDate(end)}&type=json`;
    const json = await fetchJson(url, apiKey);
    const items = Array.isArray(json?.items) ? json.items : [];

    const rows = items
      .map((row) => ({ period: row?.Tarih ?? null, value: parseEvdsNumber(row?.[EVDS_SERIES.replace(/\./g, "_")]) }))
      .filter((row) => row.period && row.value !== null)
      .sort((a, b) => String(a.period).localeCompare(String(b.period)));

    const latest = rows[rows.length - 1] || null;

    if (!latest) {
      return res.status(200).json({
        success: true,
        country: "Turkey",
        city,
        data: {
          market: "Turkey Residential Property Market",
          status: "SOURCE_TEMPORARILY_UNAVAILABLE",
          message: "TCMB EVDS responded, but no usable Housing Price Index rows were found.",
          sourceUrls: { tcmb: "https://www.tcmb.gov.tr/wps/wcm/connect/en/tcmb+en/main+menu/statistics/real+sector+statistics/residential+property+price+index" }
        }
      });
    }

    const yearAgo = rows.find((row) => {
      const [y, m] = String(row.period).split("-").map(Number);
      const [ly, lm] = String(latest.period).split("-").map(Number);
      return y === ly - 1 && m === lm;
    });
    const annualChangePercent = yearAgo && yearAgo.value > 0
      ? Math.round(((latest.value - yearAgo.value) / yearAgo.value) * 1000) / 10
      : null;

    return res.status(200).json({
      success: true,
      country: "Turkey",
      city,
      data: {
        market: "Turkey Residential Property Market",
        housingPriceIndex: {
          period: latest.period,
          indexValue: latest.value,
          annualChangePercent,
          unit: "Housing Price Index (hedonic regression), base 2010=100 — nominal Turkish Lira terms, not inflation-adjusted",
          source: "TCMB (Central Bank of the Republic of Turkey) — Konut Fiyat Endeksi (KFE), via EVDS"
        },
        cityLevelStatus: "REGIONAL_DATA_LAYER_PENDING",
        cityLevelNote: "TCMB's EVDS may carry a province/city-level breakdown of this index (Istanbul in particular) — not yet confirmed and not used here; this is the national figure only.",
        sources: { tcmb: "TCMB — Konut Fiyat Endeksi (KFE), via EVDS" },
        sourceUrls: {
          tcmb: "https://www.tcmb.gov.tr/wps/wcm/connect/en/tcmb+en/main+menu/statistics/real+sector+statistics/residential+property+price+index",
          methodology: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Reel+Sektor+Istatistikleri/Konut+Fiyat+Endeksi/Metaveri"
        },
        coverage: "National index only — no per-city or per-property benchmark available from this source."
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      country: "Turkey",
      city,
      data: {
        market: "Turkey Residential Property Market",
        status: "SOURCE_TEMPORARILY_UNAVAILABLE",
        message: "TCMB EVDS could not be fetched at this moment.",
        error: String(error?.message || error),
        sourceUrls: { tcmb: "https://www.tcmb.gov.tr/wps/wcm/connect/en/tcmb+en/main+menu/statistics/real+sector+statistics/residential+property+price+index" }
      }
    });
  }
}
