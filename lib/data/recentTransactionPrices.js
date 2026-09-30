/* PRADIXIUM™ — Recent Transaction Price benchmark
 * Answers a very concrete investor question the site couldn't answer for
 * most countries until now: "what did a property actually, recently sell
 * for around here?" — an absolute price in the local currency, not just
 * the % year-over-year trend already shown elsewhere.
 *
 * Most of the site's country coverage (see api/orchestrator.js's
 * EUROSTAT_ONLY_COUNTRIES / REGIONAL_FIXTURE_COUNTRIES branches) only had
 * a relative index — a real, sourced % change, but no absolute figure to
 * anchor it to. This module is a supplementary, national or (where found)
 * city-level benchmark built from official statistics offices, land
 * registries, and central-bank-recognized market observatories — NOT a
 * replacement for France/Spain/UK's live, city/street-level transaction
 * data, which stays authoritative where it exists.
 *
 * Same honesty discipline as every other data source in this project:
 * only countries with a verifiable, citable, CURRENT figure are listed
 * here, and each entry states whether it's built from actual registered
 * transactions (the strong case) or, failing that, an asking-price/listing
 * index (clearly flagged as weaker evidence in `basis`). No country here
 * was guessed — anything not listed simply hasn't been researched yet.
 * Prices move; every entry should be revisited periodically rather than
 * treated as permanently current.
 */
const PRICES = {
  netherlands: {
    value: 500988,
    currency: "EUR",
    unit: "total",
    area: "National",
    period: "July 2026",
    basis: "actual registered transactions (CBS purchase-price statistics, based on land registry/Kadaster deed data)",
    source: "Statistics Netherlands (CBS) — Existing own homes; average purchase prices",
    sourceUrl: "https://www.cbs.nl/en-gb/news/2026/34/house-prices-up-by-nearly-4-percent-in-july-year-on-year"
  },
  austria: {
    value: 4162,
    currency: "EUR",
    unit: "perSqm",
    area: "National",
    period: "2025 average",
    basis: "actual registered transactions (Kaufpreissammlung / land-registry purchase-deed data), owner-occupied apartments",
    source: "Statistik Austria — Immobiliendurchschnittspreise 2025",
    sourceUrl: "https://www.statistik.at/fileadmin/announcement/2026/05/20260528Immobiliendurchschnittspreise2025.pdf"
  },
  switzerland: {
    value: 1200000,
    currency: "CHF",
    unit: "total",
    area: "Canton of Zurich",
    period: "2025",
    basis: "actual registered transactions (cantonal property-transfer/Grundbuch data), condominiums (Stockwerkeigentum) — regional rather than national; no single clean official national figure was found",
    source: "Kanton Zürich (Statistisches Amt) — Immobilienpreise",
    sourceUrl: "https://www.zh.ch/de/planen-bauen/raumplanung/immobilienmarkt/immobilienpreise.html",
    // other cantons' own official figures — picked by the property's place and type
    alternatives: [
      {
        value: 10853, currency: "CHF", unit: "perSqm", area: "Canton of Geneva", period: "2024", appliesTo: "flats",
        basis: "actual registered transactions (OCSTAT annual statistics of property transactions), median price per m² of NON-NEW condominium flats (PPE) sold on the free market — price-controlled development-zone flats (median CHF 7,041) and new free-market flats (CHF 10,284) are separate",
        source: "OCSTAT (Office cantonal de la statistique, Genève) — Informations statistiques n° 11, Nov 2025",
        sourceUrl: "https://statistique.ge.ch/tel/publications/2025/informations_statistiques/services_immo/is_ti_11_2025.pdf"
      },
      {
        value: 2190000, currency: "CHF", unit: "total", area: "Canton of Geneva", period: "2024", appliesTo: "houses",
        basis: "actual registered transactions (OCSTAT annual statistics of property transactions), median price of individual houses sold (non-new villas CHF 2.197 million)",
        source: "OCSTAT (Office cantonal de la statistique, Genève) — Informations statistiques n° 11, Nov 2025",
        sourceUrl: "https://statistique.ge.ch/tel/publications/2025/informations_statistiques/services_immo/is_ti_11_2025.pdf"
      }
    ]
  },
  denmark: {
    value: 17645,
    currency: "DKK",
    unit: "perSqm",
    area: "National",
    period: "Q4 2025",
    basis: "actual registered transactions (realized trading prices / realiseret handelspris from land-registry data), detached houses (parcelhus)",
    source: "Finans Danmark — Boligmarkedsstatistikken (Real Estate Market Statistics, table BM011)",
    sourceUrl: "https://rkr.statistikbank.dk/statbank5a/SelectVarVal/Define.asp?MainTable=BM011"
  },
  sweden: {
    value: 3800000,
    currency: "SEK",
    unit: "total",
    area: "National",
    period: "Q4 2025",
    basis: "actual registered transactions (title registrations / lagfarter), one- or two-dwelling buildings (houses)",
    source: "Statistics Sweden (SCB) — Real estate prices and registrations of title",
    sourceUrl: "https://www.scb.se/en/finding-statistics/statistics-by-subject-area/housing-construction-and-building/real-estate/real-estate-prices-and-registrations-of-title/pong/statistical-news/real-estate-prices-and-registrations-of-title-fourth-quarter-2025/"
  },
  norway: {
    value: 5039618,
    currency: "NOK",
    unit: "total",
    area: "National",
    period: "August 2026",
    basis: "actual completed transactions via registered real-estate agents (Boligprisstatistikken, compiled with FINN.no and Eiendomsverdi AS — the de facto standard housing-price reference cited by Norges Bank and SSB alike; SSB itself only publishes an index, no absolute headline figure)",
    source: "Real Estate Norway (Eiendom Norge) — Boligprisstatistikk",
    sourceUrl: "https://eiendomnorge.no/boligprisstatistikk/"
  },
  iceland: {
    value: 63000000,
    currency: "ISK",
    unit: "total",
    area: "Capital region (höfuðborgarsvæðið)",
    period: "July 2025",
    basis: "actual registered purchase agreements (kaupsamningar), 60-90 sqm apartments in multi-dwelling buildings",
    source: "Housing and Construction Authority (HMS) — Mánaðarskýrsla (monthly market report)",
    sourceUrl: "https://hms.is/skyrslur/manadarskyrsla-september-2025"
  },
  slovakia: {
    value: 3549,
    currency: "EUR",
    unit: "perSqm",
    area: "Bratislava",
    appliesTo: "unstated",   // NBS's regional table (JS-rendered) could not be re-checked for flats vs all homes
    period: "Q2 2025",
    basis: "actual registered transactions (purchase prices recorded in the Real Estate Cadastre since Oct 2018)",
    source: "National Bank of Slovakia (NBS) — Residential property prices by regions",
    sourceUrl: "https://nbs.sk/en/statistics/selected-macroeconomics-indicators/residential-property-prices/residential-property-prices-by-regions/"
  },
  croatia: {
    value: 3436,
    currency: "EUR",
    unit: "perSqm",
    area: "Zagreb",
    appliesTo: "flats",
    period: "H2 2025",
    basis: "actual registered transactions, but limited to new dwellings sold by legal entities/developers (excludes resales) — Croatian Bureau of Statistics' regular release, not a general resale-market average",
    source: "Croatian Bureau of Statistics (DZS) — Cijene prodanih novih stanova",
    sourceUrl: "https://podaci.dzs.hr/2025/hr/97571"
  },
  finland: {
    value: 4983,
    currency: "EUR",
    unit: "perSqm",
    area: "Helsinki",
    period: "2025 (full-year average, old dwellings in blocks of flats and terraced houses)",
    basis: "actual registered transactions (Tilastokeskus dwelling price statistics, ASHI)",
    source: "Statistics Finland (Tilastokeskus) — Prices of dwellings in housing companies",
    sourceUrl: "https://stat.fi/fi/julkaisu/cmetmz1vcl38307w3ds5qp7a2"
  },
  ireland: {
    value: 500000,
    currency: "EUR",
    unit: "total",
    area: "Dublin",
    period: "12 months to December 2025",
    basis: "actual registered transactions (Revenue stamp-duty filings underlying the CSO index)",
    source: "Central Statistics Office (CSO) Ireland — Residential Property Price Index",
    sourceUrl: "https://www.cso.ie/en/releasesandpublications/ep/p-rppi/residentialpropertypriceindexdecember2025/keyfindings"
  },
  israel: {
    value: 4553500,
    currency: "ILS",
    unit: "total",
    area: "Tel Aviv-Yafo",
    period: "Q2 2026 (provisional — late-reported deals still to come)",
    basis: "average price of dwellings sold on the free market (government-subsidised deals excluded), CBS quarterly average prices by city; +8.4% on Q2 2025",
    source: "Israel Central Bureau of Statistics (CBS) — Price Changes in the Dwellings Market, release 256/2026 (14 Aug 2026)",
    sourceUrl: "https://www.cbs.gov.il/he/mediarelease/Madad/DocLib/2026/256/10_26_256b.pdf"
,
    // the other large cities the same release prints exactly (p. 5); the rest
    // appear only as unlabelled chart bars → not used until CBS's table is read
    alternatives: [
      { value: 3578100, currency: "ILS", unit: "total", area: "Herzliya", period: "Q2 2026 (provisional — late-reported deals still to come)", basis: "average price of dwellings (1–6 rooms) sold on the free market (government-subsidised deals excluded), not quality-adjusted — CBS quarterly average prices for the 18 largest cities (figure printed in the release text)", source: "Israel Central Bureau of Statistics (CBS) — Price Changes in the Dwellings Market, release 256/2026 (14 Aug 2026)", sourceUrl: "https://www.cbs.gov.il/he/mediarelease/Madad/DocLib/2026/256/10_26_256b.pdf" },
      { value: 3070000, currency: "ILS", unit: "total", area: "Ramat Gan", period: "Q2 2026 (provisional — late-reported deals still to come)", basis: "average price of dwellings (1–6 rooms) sold on the free market (government-subsidised deals excluded), not quality-adjusted — CBS quarterly average prices for the 18 largest cities (figure printed in the release text)", source: "Israel Central Bureau of Statistics (CBS) — Price Changes in the Dwellings Market, release 256/2026 (14 Aug 2026)", sourceUrl: "https://www.cbs.gov.il/he/mediarelease/Madad/DocLib/2026/256/10_26_256b.pdf" },
      { value: 3058500, currency: "ILS", unit: "total", area: "Jerusalem", period: "Q2 2026 (provisional — late-reported deals still to come)", basis: "average price of dwellings (1–6 rooms) sold on the free market (government-subsidised deals excluded), not quality-adjusted — CBS quarterly average prices for the 18 largest cities (figure printed in the release text)", source: "Israel Central Bureau of Statistics (CBS) — Price Changes in the Dwellings Market, release 256/2026 (14 Aug 2026)", sourceUrl: "https://www.cbs.gov.il/he/mediarelease/Madad/DocLib/2026/256/10_26_256b.pdf" },
      { value: 1816400, currency: "ILS", unit: "total", area: "Haifa", period: "Q2 2026 (provisional — late-reported deals still to come)", basis: "average price of dwellings (1–6 rooms) sold on the free market (government-subsidised deals excluded), not quality-adjusted — CBS quarterly average prices for the 18 largest cities (figure printed in the release text)", source: "Israel Central Bureau of Statistics (CBS) — Price Changes in the Dwellings Market, release 256/2026 (14 Aug 2026)", sourceUrl: "https://www.cbs.gov.il/he/mediarelease/Madad/DocLib/2026/256/10_26_256b.pdf" },
      { value: 1729100, currency: "ILS", unit: "total", area: "Ashkelon", period: "Q2 2026 (provisional — late-reported deals still to come)", basis: "average price of dwellings (1–6 rooms) sold on the free market (government-subsidised deals excluded), not quality-adjusted — CBS quarterly average prices for the 18 largest cities (figure printed in the release text)", source: "Israel Central Bureau of Statistics (CBS) — Price Changes in the Dwellings Market, release 256/2026 (14 Aug 2026)", sourceUrl: "https://www.cbs.gov.il/he/mediarelease/Madad/DocLib/2026/256/10_26_256b.pdf" },
      { value: 1236200, currency: "ILS", unit: "total", area: "Be'er Sheva", period: "Q2 2026 (provisional — late-reported deals still to come)", basis: "average price of dwellings (1–6 rooms) sold on the free market (government-subsidised deals excluded), not quality-adjusted — CBS quarterly average prices for the 18 largest cities (figure printed in the release text)", source: "Israel Central Bureau of Statistics (CBS) — Price Changes in the Dwellings Market, release 256/2026 (14 Aug 2026)", sourceUrl: "https://www.cbs.gov.il/he/mediarelease/Madad/DocLib/2026/256/10_26_256b.pdf" }
    ]
  },
  australia: {
    value: 1100400,
    currency: "AUD",
    unit: "total",
    area: "National",
    period: "June quarter 2026",
    basis: "ABS's Total Value of Dwellings series — a mean price across the existing dwelling stock, estimated using the CoreLogic Hedonic Home Value Index applied at state/territory level as a proxy for price movement, not a raw average of individual sale prices",
    source: "Australian Bureau of Statistics (ABS) — Total Value of Dwellings",
    sourceUrl: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/jun-quarter-2026"
  },
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

export function getRecentTransactionPrice(country) {
  const entry = PRICES[normalizeCountry(country)];
  return entry ? { ...entry } : null;
}
