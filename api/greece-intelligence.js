/* PRADIXIUM™ — GREECE NATIONAL INTELLIGENCE ENGINE
 * Eurostat's prc_hpi_q dataset explicitly excludes Greece (its own
 * coverage note says so), so api/eurostat-hpi-intelligence.js can't cover
 * it. Greece's real source is the Bank of Greece itself — but its actual
 * data files (via data.gov.gr) are published as Excel workbooks, and this
 * project has no spreadsheet-parsing dependency (it has none at all;
 * every other adapter hand-parses CSV/JSON). Rather than add an unverified
 * first dependency or a scraper for a press-release page with no stable
 * structure, this is a dated static fixture from the Bank of Greece's own
 * published Q1 2026 release — same approach already used for Spain's
 * Alicante foreign-buyer figures. Update GREECE_HPI by hand each quarter
 * from https://www.bankofgreece.gr/en/statistics/real-estate-market
 * until a stable machine-readable feed can be wired in instead.
 */
const GREECE_HPI = {
  period: "2026-Q1",
  nationalAnnualChangePercent: 5.7,
  athensAnnualChangePercent: 5.2,
  thessalonikiAnnualChangePercent: 6.4,
  otherCitiesAnnualChangePercent: 5.4,
  otherAreasAnnualChangePercent: 6.9,
  publicationDate: "2026",
  source: "Bank of Greece — Indices of residential property prices, Q1 2026",
  officialSource: "https://www.bankofgreece.gr/en/statistics/real-estate-market/residential-and-commercial-property-price-indices-and-other-short-term-indices"
};

// FIX: this project previously claimed Greece had no official rent data —
// wrong. Bank of Greece does publish a residential rent price index
// (Δείκτης Ενοικίων Κατοικιών) alongside the sale-price index above. It's
// still an index (base-year=100), not an absolute €/m² figure, so it
// can't feed a yield estimate the way France's or Portugal's per-m² rent
// datasets can — but the YoY change itself is real, sourced, and worth
// showing rather than omitting. Only a national figure is published at
// this granularity (no Athens/Thessaloniki rent-index breakdown found,
// unlike the sale-price index above); update by hand each quarter from
// the same Bank of Greece real-estate-market statistics page.
const GREECE_RENT_INDEX = {
  period: "2025-Q4",
  indexValue: 116.1,
  indexValueYearAgo: 106.8,
  annualChangePercent: 8.7,
  source: "Bank of Greece — Residential rent price index, Q4 2025",
  officialSource: "https://www.bankofgreece.gr/en/statistics/real-estate-market"
};

// Bank of Greece's press release splits the country into four buckets:
// Athens, Thessaloniki, "other cities" and "other areas" — the last one is
// where its own methodology note places island and resort municipalities
// (Mykonos, Santorini, Crete, Corfu, Rhodes, Halkidiki, Zakynthos, Paros...),
// which is exactly where most foreign/tourism-driven buyers are actually
// looking. Naming them explicitly here means a Mykonos or Santorini search
// gets labelled as what it is instead of silently falling into a generic
// "other cities" bucket meant for small inland towns.
const GREEK_ISLANDS_AND_RESORT_AREAS = [
  "mykonos", "santorini", "thira", "crete", "chania", "heraklion", "rethymno",
  "corfu", "kerkyra", "rhodes", "rodos", "kos", "paros", "naxos", "zakynthos",
  "zante", "kefalonia", "cephalonia", "halkidiki", "chalkidiki", "skiathos",
  "spetses", "hydra", "milos", "syros", "ios"
];

function regionalChangeFor(city) {
  const c = String(city || "").trim().toLowerCase();
  if (!c) return null;
  if (c.includes("athens") || c.includes("athina")) return { area: "Athens", annualChangePercent: GREECE_HPI.athensAnnualChangePercent };
  if (c.includes("thessaloniki") || c.includes("salonica")) return { area: "Thessaloniki", annualChangePercent: GREECE_HPI.thessalonikiAnnualChangePercent };
  if (GREEK_ISLANDS_AND_RESORT_AREAS.some((name) => c.includes(name))) {
    return { area: "Other areas (incl. islands & resort regions)", annualChangePercent: GREECE_HPI.otherAreasAnnualChangePercent };
  }
  return { area: "Other Greek cities", annualChangePercent: GREECE_HPI.otherCitiesAnnualChangePercent };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const city = String(req.query?.city || "").trim() || null;
  const regional = regionalChangeFor(city);

  return res.status(200).json({
    success: true,
    country: "Greece",
    city,
    data: {
      market: "Greece Residential Property Market",
      housingPriceIndex: {
        period: GREECE_HPI.period,
        annualChangePercent: regional?.annualChangePercent ?? GREECE_HPI.nationalAnnualChangePercent,
        nationalAnnualChangePercent: GREECE_HPI.nationalAnnualChangePercent,
        regionalArea: regional?.area || null,
        unit: "Annual rate of change, apartment prices",
        source: GREECE_HPI.source
      },
      cityLevelStatus: "REGIONAL_DATA_LAYER_PENDING",
      cityLevelNote: "Bank of Greece publishes Athens/Thessaloniki/other-city breakdowns as press-release figures, not a per-property or per-m² benchmark. This is a national/regional trend, not a valuation.",
      rentTrend: {
        available: true,
        annualChangePercent: GREECE_RENT_INDEX.annualChangePercent,
        period: GREECE_RENT_INDEX.period,
        unit: "Annual rate of change, residential rent index (national — no regional breakdown published at this granularity)",
        source: GREECE_RENT_INDEX.source,
        note: "An index trend, not an absolute €/m² figure — cannot be used to estimate an actual monthly rent, only to show the direction and pace of rent growth."
      },
      sources: { bankOfGreece: GREECE_HPI.source },
      sourceUrls: { bankOfGreece: GREECE_HPI.officialSource },
      coverage: "National/regional trend only — static figures from a dated Bank of Greece release, not a live feed. Verify against the official source before relying on it for a current quarter."
    }
  });
}
