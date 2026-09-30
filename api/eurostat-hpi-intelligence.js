import { europeLocalPrice } from "../lib/europe/localPrices.js";
import { cyprusRegionalTrend } from "../lib/europe/cyprus.js";
import { bulgariaRegionalTrend } from "../lib/europe/bulgaria.js";
/* PRADIXIUM™ — EUROSTAT HOUSE PRICE INDEX ADAPTER
 * One shared, keyless, official data source (prc_hpi_q — House Price
 * Index, quarterly) covering national-level trend data for every European
 * market that doesn't have its own dedicated adapter. Per Eurostat's own
 * documentation, prc_hpi_q covers all EU member states except Greece,
 * plus Iceland, Norway and Switzerland — Greece is deliberately not
 * listed here (it has its own adapter, api/greece-intelligence.js) rather
 * than silently pointing at a series that doesn't include it, and Belgium
 * moved to its own dedicated adapter (api/belgium-intelligence.js) once a
 * better regional/property-type source was found.
 *
 * This mirrors the same honesty as api/germany-intelligence.js,
 * api/italy-intelligence.js and api/portugal-intelligence.js: a national
 * trend percentage, not a per-city/property price benchmark.
 */

const GEO_CODES = {
  netherlands: { code: "NL", name: "Netherlands" },
  poland: { code: "PL", name: "Poland" },
  austria: { code: "AT", name: "Austria" },
  switzerland: { code: "CH", name: "Switzerland" },
  "czech republic": { code: "CZ", name: "Czech Republic" },
  czechia: { code: "CZ", name: "Czech Republic" },
  hungary: { code: "HU", name: "Hungary" },
  bulgaria: { code: "BG", name: "Bulgaria" },
  croatia: { code: "HR", name: "Croatia" },
  cyprus: { code: "CY", name: "Cyprus" },
  denmark: { code: "DK", name: "Denmark" },
  estonia: { code: "EE", name: "Estonia" },
  finland: { code: "FI", name: "Finland" },
  ireland: { code: "IE", name: "Ireland" },
  latvia: { code: "LV", name: "Latvia" },
  lithuania: { code: "LT", name: "Lithuania" },
  luxembourg: { code: "LU", name: "Luxembourg" },
  malta: { code: "MT", name: "Malta" },
  romania: { code: "RO", name: "Romania" },
  slovakia: { code: "SK", name: "Slovakia" },
  slovenia: { code: "SI", name: "Slovenia" },
  sweden: { code: "SE", name: "Sweden" },
  norway: { code: "NO", name: "Norway" },
  iceland: { code: "IS", name: "Iceland" }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// Generic JSON-stat 2.0 cube reader. Computes the flattened value index
// from the dataset's own "id"/"size" (dimension order and cardinality) —
// never assumes a fixed layout, and verifies the resolved category label
// actually matches what was requested before trusting the value, so a
// wrong dimension code produces "no match" rather than a silently wrong
// number from a neighboring cell.
function readJsonStatValue(dataset, coords) {
  if (!dataset?.id || !dataset?.size || !dataset?.dimension) return null;
  const { id: ids, size: sizes, dimension, value } = dataset;
  let index = 0;
  for (let i = 0; i < ids.length; i += 1) {
    const dim = ids[i];
    const wanted = coords[dim];
    if (wanted === undefined) continue; // dimension not constrained (e.g. only one category anyway)
    const catIndex = dimension[dim]?.category?.index;
    let dimIdx = null;
    if (Array.isArray(catIndex)) dimIdx = catIndex.indexOf(wanted);
    else if (catIndex && typeof catIndex === "object") dimIdx = catIndex[wanted];
    if (dimIdx === undefined || dimIdx === null || dimIdx < 0) return null;
    let stride = 1;
    for (let j = i + 1; j < ids.length; j += 1) stride *= sizes[j] || 1;
    index += dimIdx * stride;
  }
  const raw = value;
  const result = Array.isArray(raw) ? raw[index] : raw?.[index] ?? raw?.[String(index)];
  return Number.isFinite(result) ? result : null;
}

function latestTimeLabel(dataset) {
  const timeDim = dataset?.dimension?.time;
  const index = timeDim?.category?.index;
  if (!index) return null;
  const codes = Array.isArray(index) ? index : Object.keys(index).sort((a, b) => index[a] - index[b]);
  const lastCode = codes[codes.length - 1];
  return timeDim.category.label?.[lastCode] || lastCode || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const country = normalizeCountry(req.query?.country);
  const geo = GEO_CODES[country];
  const city = String(req.query?.city || "").trim() || null;

  if (!geo) {
    return res.status(404).json({ success: false, error: "Country not covered by the Eurostat adapter", supportedCountries: Object.values(GEO_CODES).map((g) => g.name) });
  }

  // the country's own local figure (lib/europe/localPrices.js), in
  // parallel with the Eurostat trend
  const localPromise = europeLocalPrice({ country: geo.name, city, address: String(req.query?.address || "").trim(), propertyType: String(req.query?.propertyType || ""), size: req.query?.size, bedrooms: req.query?.bedrooms }).catch(() => null);
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q?format=JSON&unit=RCH_A&purchase=TOTAL&geo=${geo.code}&lastTimePeriod=1`;

  try {
    const dataset = await fetchJson(url);
    const period = latestTimeLabel(dataset);
    const annualChangePercent = readJsonStatValue(dataset, { unit: "RCH_A", purchase: "TOTAL", geo: geo.code });
    // the national central bank's own newer index by district and type, where one is published
    let regional = null;
    try { regional = geo.code === "CY" ? cyprusRegionalTrend({ city, address: String(req.query?.address || "") }) : geo.code === "BG" ? bulgariaRegionalTrend({ city, address: String(req.query?.address || "") }) : null; } catch { regional = null; }

    return res.status(200).json({
      success: true,
      country: geo.name,
      city,
      data: {
        market: `${geo.name} Residential Property Market`,
        housingPriceIndex: {
          period,
          annualChangePercent,
          unit: "Annual rate of change, all dwellings",
          source: "Eurostat — House Price Index (prc_hpi_q)",
          regional
        },
        localPrice: await localPromise,
        cityLevelStatus: "REGIONAL_DATA_LAYER_PENDING",
        cityLevelNote: "Eurostat's House Price Index is national-level only. City/regional-level valuation should use the relevant national land registry or statistics office once that adapter exists.",
        sources: { eurostat: "Eurostat — House Price Index (prc_hpi_q)" },
        sourceUrls: { eurostat: "https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table" },
        coverage: "National index only — no per-city or per-property benchmark available from this source."
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      country: geo.name,
      city,
      data: {
        market: `${geo.name} Residential Property Market`,
        status: "SOURCE_TEMPORARILY_UNAVAILABLE",
        message: "Eurostat House Price Index could not be fetched at this moment.",
        localPrice: await localPromise,
        error: String(error?.message || error),
        sourceUrls: { eurostat: "https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table" }
      }
    });
  }
}
