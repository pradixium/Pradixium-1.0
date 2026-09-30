/* PRADIXIUM™ — UNITED ARAB EMIRATES NATIONAL INTELLIGENCE ENGINE
 * Dubai Land Department (DLD) — the UAE's dominant real estate market and
 * its actual land registry authority — publishes an official Residential
 * Sales Price Index (RPPI, built with Property Finder using a hedonic
 * price methodology) as an open CSV file on Dubai Pulse, the Dubai
 * government's open-data portal. Unlike DLD's transaction-level API
 * (which needs a registered API key/secret), this specific index file is
 * published as a direct, keyless CSV download.
 *
 * IMPORTANT — this covers Dubai specifically, not the other six emirates
 * (Abu Dhabi, Sharjah, etc. run their own separate land departments with
 * no equivalent open feed found). Dubai is overwhelmingly the emirate
 * foreign/investor property activity concentrates in, but this is a
 * Dubai figure, not a national UAE one — labeled as such below.
 *
 * The exact column names in DLD's CSV could not be confirmed from this
 * sandboxed environment (no direct internet access to inspect the real
 * file — only its documented existence and a confirmed direct download
 * URL). The parser below tries several plausible header names; if none
 * match, it degrades to "unavailable" rather than risking a wrong number.
 */
const DLD_INDEX_CSV_URL = "https://www.dubaipulse.gov.ae/dataset/342a48fc-6499-40b4-9323-b9c0a536f57f/resource/ec4bef3f-d995-4487-9ec3-f7bd2d3788eb/download/residential_sale_index.csv";

async function fetchText(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { accept: "text/csv,text/plain,*/*" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

function csvLine(line) {
  const out = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(value);
      value = "";
    } else {
      value += ch;
    }
  }
  out.push(value);
  return out;
}

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = csvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = csvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

const DATE_KEYS = ["date", "period", "instance_date", "transaction_date", "month", "year"];
const VALUE_KEYS = ["index_value", "index", "value", "sale_index"];
const CHANGE_KEYS = ["change", "yoy", "annual_change", "growth", "pct_change", "percent_change"];

function pick(row, keys) {
  for (const key of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.trim().toLowerCase() === key) return row[rowKey];
    }
  }
  return null;
}

function extractLatest(rows) {
  if (!rows.length) return null;
  const dateKeyName = Object.keys(rows[0]).find((k) => DATE_KEYS.includes(k.trim().toLowerCase()));
  const sorted = dateKeyName ? [...rows].sort((a, b) => String(a[dateKeyName]).localeCompare(String(b[dateKeyName]))) : rows;
  const last = sorted[sorted.length - 1];
  if (!last) return null;

  const period = pick(last, DATE_KEYS);
  const indexValue = pick(last, VALUE_KEYS);
  let changePercent = pick(last, CHANGE_KEYS);

  if (changePercent == null && indexValue != null && dateKeyName) {
    // No direct % column — try computing YoY from the index itself if a
    // year-ago row can be found (rough heuristic, only used as a fallback).
    const currentVal = Number(indexValue);
    if (Number.isFinite(currentVal) && sorted.length > 12) {
      const yearAgo = sorted[sorted.length - 13];
      const yearAgoVal = Number(pick(yearAgo, VALUE_KEYS));
      if (Number.isFinite(yearAgoVal) && yearAgoVal > 0) {
        changePercent = ((currentVal - yearAgoVal) / yearAgoVal) * 100;
      }
    }
  }

  if (period == null && indexValue == null && changePercent == null) return null;

  return {
    period: period != null ? String(period) : null,
    indexValue: indexValue != null && Number.isFinite(Number(indexValue)) ? Number(indexValue) : null,
    annualChangePercent: changePercent != null && Number.isFinite(Number(changePercent)) ? Math.round(Number(changePercent) * 100) / 100 : null
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const city = String(req.query?.city || "").trim() || null;

  // Checked Sept 30 2026: Dubai Pulse resets every connection (from Vercel
  // too — each report waited ~11 s for nothing) and the index dataset was
  // last updated in April 2024; DLD's transaction search is behind a
  // reCAPTCHA and its indexes API is publicly writable (test rows) — no
  // current, verifiable Dubai price source → answer at once, no fetch.
  if (process.env.UAE_TRY_DUBAI_PULSE !== "1") {
    return res.status(200).json({
      success: true,
      country: "United Arab Emirates",
      city,
      data: {
        market: "Dubai Residential Property Market",
        status: "NO_CURRENT_OFFICIAL_SOURCE",
        message: "No current, verifiable official Dubai price figure is reachable: the Dubai Land Department's open index file was last updated in April 2024 and its portal no longer answers; the live transaction search requires a CAPTCHA.",
        sourceUrls: { dld: "https://dubailand.gov.ae/en/open-data/real-estate-data/" }
      }
    });
  }

  try {
    const csvText = await fetchText(DLD_INDEX_CSV_URL);
    const rows = parseCsv(csvText);
    const latest = extractLatest(rows);

    if (!latest) {
      return res.status(200).json({
        success: true,
        country: "United Arab Emirates",
        city,
        data: {
          market: "Dubai Residential Property Market",
          status: "SOURCE_TEMPORARILY_UNAVAILABLE",
          message: "Dubai Land Department's index file responded, but its column layout didn't match what this adapter expects — needs a column-name fix, not a data problem.",
          sourceUrls: { dld: "https://dubailand.gov.ae/en/open-data/residential-properties-price-index-rppi/" }
        }
      });
    }

    return res.status(200).json({
      success: true,
      country: "United Arab Emirates",
      city,
      data: {
        market: "Dubai Residential Property Market",
        housingPriceIndex: {
          period: latest.period,
          annualChangePercent: latest.annualChangePercent,
          indexValue: latest.indexValue,
          unit: "Residential Sales Price Index (hedonic, base year 2012) — Dubai only",
          source: "Dubai Land Department (DLD) — Residential Properties Price Index, built with Property Finder"
        },
        cityLevelStatus: "REGIONAL_DATA_LAYER_PENDING",
        cityLevelNote: "This is Dubai's own index — the other six emirates (Abu Dhabi, Sharjah, etc.) each run separate land departments with no equivalent open feed found. Not a UAE-wide figure.",
        sources: { dld: "Dubai Land Department — Residential Properties Price Index" },
        sourceUrls: { dld: "https://dubailand.gov.ae/en/open-data/residential-properties-price-index-rppi/", data: DLD_INDEX_CSV_URL },
        coverage: "Dubai national index only — not a per-community or per-property benchmark."
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      country: "United Arab Emirates",
      city,
      data: {
        market: "Dubai Residential Property Market",
        status: "SOURCE_TEMPORARILY_UNAVAILABLE",
        message: "Dubai Land Department's price index CSV could not be fetched at this moment.",
        error: String(error?.message || error),
        sourceUrls: { dld: "https://dubailand.gov.ae/en/open-data/residential-properties-price-index-rppi/" }
      }
    });
  }
}
