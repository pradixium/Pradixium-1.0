/* PRADIXIUM™ — ISRAEL NATIONAL INTELLIGENCE ENGINE
 * Israel's Central Bureau of Statistics (הלמ״ס) runs a real, public,
 * keyless REST API at api.cbs.gov.il — confirmed via its own catalog
 * (api.cbs.gov.il/Index/Catalog/Catalog) that index ID 40010 is
 * "מדד מחירי דירות" (the Dwelling/Housing Price Index), a bimonthly
 * series with a district-level breakdown (Jerusalem, North, Haifa,
 * Center, Tel Aviv, South).
 *
 * IMPORTANT — unlike Eurostat's JSON-stat (a documented open standard
 * this project already parses reliably), the exact JSON field names CBS's
 * API returns could not be confirmed from this environment (no direct
 * internet access to inspect a live response — only its documented URL
 * parameters and index catalog). The parser below tries several
 * plausible shapes based on common government-statistics API conventions
 * and CBS's own documented parameter set; if none match, it degrades to
 * "unavailable" rather than ever risking a wrong number. If this comes
 * back empty in production, the fix is almost certainly just correcting
 * the field names below to match CBS's real response — the URL and index
 * ID are confirmed correct.
 *
 * CBS's own API documentation states the User-Agent header is mandatory.
 */
const CBS_HOUSING_INDEX_ID = "40010";
const CBS_BASE = "https://api.cbs.gov.il/index/data/price";

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "User-Agent": "Pradixium/1.0 (+https://pradixium.com)"
      }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// Tries several plausible shapes for CBS's response rather than assuming
// one — see the file header on why the exact schema isn't verified.
function extractLatest(json) {
  const candidates = [
    json?.DataSet?.Data,
    json?.Data,
    json?.months,
    json?.Values,
    Array.isArray(json) ? json : null
  ].filter(Array.isArray);

  for (const rows of candidates) {
    if (!rows.length) continue;
    const sorted = [...rows].filter((r) => r && typeof r === "object");
    const last = sorted[sorted.length - 1];
    if (!last) continue;
    const percent = last.Percent ?? last.percent ?? last.YoY ?? last.change ?? null;
    const value = last.Value ?? last.value ?? last.Currentprice ?? last.index ?? null;
    const date = last.Date ?? last.date ?? last.Period ?? last.period ?? null;
    if (percent != null || value != null) {
      return {
        period: date != null ? String(date) : null,
        annualChangePercent: percent != null ? Number(percent) : null,
        indexValue: value != null ? Number(value) : null
      };
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const city = String(req.query?.city || "").trim() || null;

  try {
    const url = `${CBS_BASE}?id=${CBS_HOUSING_INDEX_ID}&format=json&lang=en&last=6&download=false`;
    const json = await fetchJson(url);
    const latest = extractLatest(json);

    if (!latest) {
      return res.status(200).json({
        success: true,
        country: "Israel",
        city,
        data: {
          market: "Israel Residential Property Market",
          status: "SOURCE_TEMPORARILY_UNAVAILABLE",
          message: "CBS housing price index responded, but its data shape didn't match what this adapter expects — needs a field-name fix, not a data problem.",
          sourceUrls: { cbs: "https://www.cbs.gov.il/en/Pages/Main%20Price%20Indices.aspx" }
        }
      });
    }

    return res.status(200).json({
      success: true,
      country: "Israel",
      city,
      data: {
        market: "Israel Residential Property Market",
        housingPriceIndex: {
          period: latest.period,
          annualChangePercent: latest.annualChangePercent,
          indexValue: latest.indexValue,
          unit: "Dwelling Price Index (bimonthly), national",
          source: "Israel Central Bureau of Statistics (הלמ״ס) — Dwelling Price Index"
        },
        cityLevelStatus: "REGIONAL_DATA_LAYER_PENDING",
        cityLevelNote: "CBS publishes this index with a district breakdown (Jerusalem, North, Haifa, Center, Tel Aviv, South) — not yet wired in here, this is the national figure only.",
        sources: { cbs: "Israel Central Bureau of Statistics — Dwelling Price Index" },
        sourceUrls: { cbs: "https://www.cbs.gov.il/en/Pages/Main%20Price%20Indices.aspx", api: "https://api.cbs.gov.il/Index/Catalog/Catalog?lang=en" },
        coverage: "National index only — a national trend, not a per-city or per-property benchmark."
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      country: "Israel",
      city,
      data: {
        market: "Israel Residential Property Market",
        status: "SOURCE_TEMPORARILY_UNAVAILABLE",
        message: "CBS Dwelling Price Index could not be fetched at this moment.",
        error: String(error?.message || error),
        sourceUrls: { cbs: "https://www.cbs.gov.il/en/Pages/Main%20Price%20Indices.aspx" }
      }
    });
  }
}
