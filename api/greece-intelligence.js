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
  period: "2026-Q2",
  nationalAnnualChangePercent: 5.5,
  athensAnnualChangePercent: 5.0,
  thessalonikiAnnualChangePercent: 4.7,
  otherCitiesAnnualChangePercent: 5.4,
  otherAreasAnnualChangePercent: 7.1,
  newAnnualChangePercent: 6.2,
  oldAnnualChangePercent: 5.0,
  publicationDate: "2026",
  // national figure cross-checked with the BIS residential property price
  // series for Greece (supplied by the Bank of Greece): 122.3916 / 116.0215
  source: "Bank of Greece — Indices of residential property prices, Q2 2026",
  officialSource: "https://www.bankofgreece.gr/en/news-and-media/press-office/news-list/news?announcement=ac5ae869-3e94-4550-b486-ef00c4292e07"
};

// The Bank of Greece publishes NO residential rent index (its open data
// has office and retail rent indices only — data.gov.gr, Oct 2026); the
// earlier "BoG residential rent index 116.1 / +8.7%" had no source and was
// removed. The official rent figure is ELSTAT's CPI item "Rentals for
// dwellings" (Table 5 of the monthly CPI release: change on the same
// month a year earlier). National only; a change, not a rent level →
// never used for the yield. Update each month from
// https://www.statistics.gr/en/statistics/-/publication/DKT87/-
const GREECE_RENT_INDEX = {
  period: "August 2026",
  annualChangePercent: 6.2,
  source: "ELSTAT — Consumer Price Index, August 2026 (Table 5, “Rentals for dwellings”)",
  officialSource: "https://www.statistics.gr/en/statistics/-/publication/DKT87/2026-M08"
};

// Bank of Greece's press release splits the country into four buckets:
// Athens, Thessaloniki, "other cities" and "other areas" — the last one is
// where its own methodology note places island and resort municipalities
// (Mykonos, Santorini, Crete, Corfu, Rhodes, Halkidiki, Zakynthos, Paros...),
// which is exactly where most foreign/tourism-driven buyers are actually
// looking. Naming them explicitly here means a Mykonos or Santorini search
// gets labelled as what it is instead of silently falling into a generic
// "other cities" bucket meant for small inland towns.
// Only small islands / resorts that are clearly not "cities": Crete's and
// the big islands' towns (Heraklion, Chania, Rhodes, Corfu…) may count as
// "other cities" — the Bank of Greece publishes no town list → national.
const GREEK_ISLANDS_AND_RESORT_AREAS = [
  "mykonos", "santorini", "thira", "paros", "naxos", "skiathos", "spetses",
  "hydra", "milos", "ios", "halkidiki", "chalkidiki"
];

function regionalChangeFor(city) {
  const c = String(city || "").trim().toLowerCase();
  if (!c) return null;
  if (c.includes("athens") || c.includes("athina")) return { area: "Athens", annualChangePercent: GREECE_HPI.athensAnnualChangePercent };
  if (c.includes("thessaloniki") || c.includes("salonica")) return { area: "Thessaloniki", annualChangePercent: GREECE_HPI.thessalonikiAnnualChangePercent };
  if (GREEK_ISLANDS_AND_RESORT_AREAS.some((name) => c.includes(name))) {
    return { area: "Other areas (incl. islands & resort regions)", annualChangePercent: GREECE_HPI.otherAreasAnnualChangePercent };
  }
  // any other place: the Bank of Greece splits the rest into "other
  // (large) cities" and "other areas" without a published list of which
  // town falls where → the national figure, named as national
  return null;
}

import { greekZone } from "../lib/greece/zones.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const city = String(req.query?.city || "").trim() || null;
  const address = String(req.query?.address || "").trim() || null;
  const regional = regionalChangeFor(city);
  // official zone price (τιμή ζώνης) for the address / area — the site
  // sends an address typed in the city field as both address and city
  const place = address && city && address !== city && !address.toLowerCase().includes(city.toLowerCase()) ? `${address}, ${city}` : (address || city);
  const zone = place ? await Promise.race([greekZone(place).catch(() => null), new Promise((r) => setTimeout(() => r({ status: "timeout" }), 9000))]) : null;

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
        newAnnualChangePercent: GREECE_HPI.newAnnualChangePercent,
        oldAnnualChangePercent: GREECE_HPI.oldAnnualChangePercent,
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
        unit: "Annual rate of change, CPI rentals for dwellings (national)",
        source: GREECE_RENT_INDEX.source,
        note: "A price change, not a rent level — it cannot estimate this property's rent."
      },
      zonePrice: zone,
      sources: { bankOfGreece: GREECE_HPI.source, elstat: GREECE_RENT_INDEX.source },
      sourceUrls: { bankOfGreece: GREECE_HPI.officialSource, elstat: GREECE_RENT_INDEX.officialSource },
      coverage: "National/regional trend only — static figures from a dated Bank of Greece release, not a live feed. Verify against the official source before relying on it for a current quarter."
    }
  });
}
