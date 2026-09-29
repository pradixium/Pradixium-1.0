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
    sourceUrl: "https://www.zh.ch/de/planen-bauen/raumplanung/immobilienmarkt/immobilienpreise.html"
  },
  germany: {
    value: 5511,
    currency: "EUR",
    unit: "perSqm",
    area: "Berlin",
    period: "2025 average",
    basis: "actual registered transactions (all notarized property sales, compiled by the city's Gutachterausschuss) — Germany has no single nationwide open transaction database, so this is Berlin-level rather than national",
    source: "Gutachterausschuss für Grundstückswerte in Berlin",
    sourceUrl: "https://www.berlin.de/sen/stadt/presse/pressemeldungen/pressemitteilung.1699073.php"
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
  poland: {
    value: 16393,
    currency: "PLN",
    unit: "perSqm",
    area: "Warsaw",
    period: "Q1 2026",
    basis: "actual registered transactions (notarial deeds, via NBP's BaRN database)",
    source: "Narodowy Bank Polski (NBP) — Baza Rynku Nieruchomości (BaRN), quarterly report",
    sourceUrl: "https://nbp.pl/publikacje/cykliczne-materialy-analityczne-nbp/rynek-nieruchomosci/informacja-kwartalna/"
  },
  "czech republic": {
    value: 131520,
    currency: "CZK",
    unit: "perSqm",
    area: "Prague",
    period: "2025 average",
    basis: "actual registered transactions (national price register compiled from deed/tax data)",
    source: "Czech Statistical Office (ČSÚ) — Ceny nemovitostí (Real Estate Prices) 2023-2025",
    sourceUrl: "https://csu.gov.cz/produkty/ceny-nemovitosti"
  },
  hungary: {
    value: 1200000,
    currency: "HUF",
    unit: "perSqm",
    area: "Budapest",
    period: "Q2 2025",
    basis: "actual registered transactions (NAV duty-paid deed data compiled by KSH)",
    source: "Hungarian Central Statistical Office (KSH) — Lakáspiaci árak, lakásárindex",
    sourceUrl: "https://www.ksh.hu/s/kiadvanyok/lakaspiaci-arak-lakasarindex-2025-ii-negyedev/index.html"
  },
  slovakia: {
    value: 3549,
    currency: "EUR",
    unit: "perSqm",
    area: "Bratislava",
    period: "Q2 2025",
    basis: "actual registered transactions (purchase prices recorded in the Real Estate Cadastre since Oct 2018)",
    source: "National Bank of Slovakia (NBS) — Residential property prices by regions",
    sourceUrl: "https://nbs.sk/en/statistics/selected-macroeconomics-indicators/residential-property-prices/residential-property-prices-by-regions/"
  },
  slovenia: {
    value: 4900,
    currency: "EUR",
    unit: "perSqm",
    area: "Ljubljana",
    period: "H1 2025",
    basis: "actual registered transactions (Real Estate Market Registry — ETN)",
    source: "Statistical Office of the Republic of Slovenia (SURS) — Indeksi cen stanovanjskih nepremičnin",
    sourceUrl: "https://www.stat.si/StatWeb/News/Index/13870"
  },
  croatia: {
    value: 3436,
    currency: "EUR",
    unit: "perSqm",
    area: "Zagreb",
    period: "H2 2025",
    basis: "actual registered transactions, but limited to new dwellings sold by legal entities/developers (excludes resales) — Croatian Bureau of Statistics' regular release, not a general resale-market average",
    source: "Croatian Bureau of Statistics (DZS) — Cijene prodanih novih stanova",
    sourceUrl: "https://podaci.dzs.hr/2025/hr/97571"
  },
  italy: {
    value: 5580,
    currency: "EUR",
    unit: "perSqm",
    area: "Milan",
    period: "2025 (current OMI quotations)",
    basis: "actual registered transactions — OMI values are calibrated from real deed prices recorded by the Agenzia delle Entrate",
    source: "Osservatorio del Mercato Immobiliare (OMI), Agenzia delle Entrate",
    sourceUrl: "https://www.gruppocasa.it/blog/mercato-immobiliare-milano-iv-trimestre-2025-dati-omi/"
  },
  cyprus: {
    value: 191000,
    currency: "EUR",
    unit: "total",
    area: "Nicosia (new-build apartments)",
    period: "2025 average",
    basis: "official land registry survey of new-build apartment sale values — covers new-build stock only, not all resales",
    source: "Department of Lands and Surveys (Cyprus), Ministry of Interior",
    sourceUrl: "https://landbankproperties.com.cy/market_news/articles/%CE%BF%CE%B9-%CE%BC%CE%AD%CF%83%CE%B5%CF%82-%CF%84%CE%B9%CE%BC%CE%AD%CF%82-%CE%BA%CE%B1%CE%B9%CE%BD%CE%BF%CF%8D%CF%81%CE%B3%CE%B9%CF%89%CE%BD-%CE%B4%CE%B9%CE%B1%CE%BC%CE%B5%CF%81%CE%B9%CF%83%CE%BC/"
  },
  malta: {
    value: 307940,
    currency: "EUR",
    unit: "total",
    area: "National (Malta & Gozo) — no official per-locality figure exists",
    period: "2025 (latest available 12-month rolling period)",
    basis: "actual registered transactions — declared value on the final deed of sale, from Inland Revenue/notarial deed data",
    source: "National Statistics Office (NSO) Malta — Residential Property Price Index",
    sourceUrl: "https://pedament.com/guides/malta-property-in-numbers"
  },
  estonia: {
    value: 3051,
    currency: "EUR",
    unit: "perSqm",
    area: "Tallinn",
    period: "Q2 2025",
    basis: "actual registered transactions (Land Board/Statistics Estonia transaction register)",
    source: "Statistics Estonia (Statistikaamet) / Estonian Land Board (Maa-amet)",
    sourceUrl: "https://hrel.ee/en/2025/08/14/apartment-prices-in-estonia-2025-tallinn-tartu-parnu-market-overview/"
  },
  latvia: {
    value: 1416,
    currency: "EUR",
    unit: "perSqm",
    area: "Riga",
    period: "Q1 2026",
    basis: "actual completed and registered apartment transactions",
    source: "Central Statistical Bureau of Latvia (CSP)",
    sourceUrl: "https://www.viszinis.lv/dzivoklu-cenas-riga"
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
  luxembourg: {
    value: 12106,
    currency: "EUR",
    unit: "perSqm",
    area: "Luxembourg City",
    period: "Q1 2025",
    basis: "actual notarial deed transactions",
    source: "STATEC / Observatoire de l'Habitat (LISER)",
    sourceUrl: "https://www.globalpropertyguide.com/europe/luxembourg/price-history"
  },
  israel: {
    value: 3025000,
    currency: "ILS",
    unit: "total",
    area: "Tel Aviv",
    period: "Q3 2025",
    basis: "actual registered transactions (CBS home-sales survey, corroborated by Tax Authority-based district figures)",
    source: "Israel Central Bureau of Statistics (CBS), as reported by The Times of Israel housing snapshot",
    sourceUrl: "https://www.timesofisrael.com/housing-snapshot-home-sales-and-rentals-across-israel-in-november-2025/"
  },
  georgia: {
    value: 4333,
    currency: "GEL",
    unit: "perSqm",
    area: "Saburtalo, Tbilisi",
    period: "Q1 2026",
    basis: "Geostat's Residential Property Price Index district breakdown — per Geostat's own release these district figures are median ASKING (offer) prices web-scraped from listing sites (Myhome, ss.ge), new-build apartments in Tbilisi only; not sale prices",
    source: "National Statistics Office of Georgia (Geostat) — Residential Property Price Index, Q1 2026 district breakdown",
    sourceUrl: "https://1tv.ge/lang/en/news/geostat-residential-real-estate-prices-rise-in-tbilisi-in-q1-2026/"
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
  "united arab emirates": {
    value: 1866,
    currency: "AED",
    // Dubai's native reporting unit is per sq ft, not per m² — the site
    // already handles perSqft (see US) via SQFT_PER_SQM conversion in
    // lib/scoring/pradixiumScore.js, so no special-casing is needed here.
    unit: "perSqft",
    area: "Dubai (citywide, all residential property types)",
    period: "2025 (full-year average)",
    basis: "actual registered transactions (Dubai Land Department transaction register, aggregated via DXB Interact)",
    source: "Dubai Land Department (DLD) transaction data, as reported by fäm Properties",
    sourceUrl: "https://famproperties.com/blog/dubai-property-market-2025-record-sales"
  }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

export function getRecentTransactionPrice(country) {
  const entry = PRICES[normalizeCountry(country)];
  return entry ? { ...entry } : null;
}
