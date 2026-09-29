/* PRADIXIUM™ — Global Index: current price trends for markets not covered
 * by api/regional-fixture-intelligence.js's FIXTURES (which already has
 * real trend data for 29 markets). Same honesty discipline as every data
 * module here: only a country with a verifiable, current, official or
 * major-advisory-firm source is listed — everything else stays excluded
 * from the Global Index's trend component rather than guessed.
 *
 * `momentumNote` is populated ONLY when a named, credible third party
 * (a central bank, national statistics office, or a major real-estate
 * advisory firm — JLL/CBRE/Knight Frank/Savills) explicitly characterized
 * the market that way (e.g. "cooling," "recovering," "at a cyclical low")
 * — never Pradixium's own inference about future prices. Omitted entirely
 * when no such source exists, rather than invented.
 */
const TRENDS = {
  "united states": {
    trendPercent: 2.1,
    trendPeriod: "Q2 2026",
    trendSource: "FHFA House Price Index",
    trendSourceUrl: "https://www.fhfa.gov/document/d/hpi/fhfa-house-price-index-report-2026q2"
  },
  "united kingdom": {
    trendPercent: 1.4,
    trendPeriod: "July 2026",
    trendSource: "ONS / HM Land Registry UK House Price Index",
    trendSourceUrl: "https://www.gov.uk/government/statistics/uk-house-price-index-for-july-2026/uk-house-price-index-summary-july-2026",
    momentumNote: "ONS/Land Registry data show UK annual house price growth slowing through mid-2026 after peaking at 3.8% in April, with the deceleration driven mainly by weaker growth in the South West, London and West Midlands."
  },
  france: {
    trendPercent: -0.8,
    trendPeriod: "Q2 2026",
    trendSource: "INSEE Indice des prix des logements (with Notaires de France)",
    trendSourceUrl: "https://www.insee.fr/fr/statistiques/9050027"
  },
  spain: {
    trendPercent: 12.2,
    trendPeriod: "Q2 2026",
    trendSource: "INE Índice de Precios de Vivienda (IPV)",
    trendSourceUrl: "https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736152838&menu=ultiDatos&idp=1254735976607"
  },
  germany: {
    trendPercent: 0.6,
    trendPeriod: "Q2 2026",
    trendSource: "Destatis (Federal Statistical Office of Germany) House Price Index",
    trendSourceUrl: "https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/09/PD26_336_61262.html"
  },
  portugal: {
    trendPercent: 16.5,
    trendPeriod: "Q2 2026",
    trendSource: "INE Portugal Índice de Preços da Habitação",
    // FIX: was a secondary news write-up (eco.sapo.pt); now INE's own
    // Construção e Habitação section, which publishes this index directly.
    trendSourceUrl: "https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_tema&tema_cod=1610&xlang=pt"
  },
  italy: {
    trendPercent: 4.0,
    trendPeriod: "Q2 2026 (provisional)",
    trendSource: "ISTAT House Price Index (IPAB)",
    trendSourceUrl: "https://www.istat.it/en/press-release/house-prices-provisional-q1-2026/"
  },
  greece: {
    trendPercent: 5.6,
    trendPeriod: "Q1 2026",
    trendSource: "Bank of Greece Residential Property Price Index",
    trendSourceUrl: "https://www.bankofgreece.gr/en/news-and-media/press-office/news-list/news?announcement=a096eb19-23d0-44e4-9445-10ef088053fb"
  },
  belgium: {
    trendPercent: 2.0,
    trendPeriod: "Q1 2026",
    trendSource: "Statbel House Price Index (Eurostat-harmonized)",
    trendSourceUrl: "https://statbel.fgov.be/en/themes/housing/house-price-index"
  },
  israel: {
    trendPercent: -1.5,
    trendPeriod: "May-June 2026",
    trendSource: "Israel Central Bureau of Statistics home price index",
    // FIX: was a news write-up (timesofisrael.com); now CBS's own English
    // price-indices landing page, which publishes this index directly.
    trendSourceUrl: "https://www.cbs.gov.il/en/Pages/Main%20Price%20Indices.aspx"
  },
  "united arab emirates": {
    trendPercent: 1.9,
    trendPeriod: "Q2 2026",
    trendSource: "CBRE UAE Real Estate Market Review (Dubai residential sale prices)",
    trendSourceUrl: "https://www.cbre.ae/insights/figures/uae-real-estate-market-review-q2-2026",
    momentumNote: "CBRE described Dubai's residential market as moderating in Q2 2026, with softening demand, a 29% year-on-year drop in transaction volume, and new supply easing price pressure."
  },
  netherlands: {
    trendPercent: 4.1,
    trendPeriod: "June 2026",
    trendSource: "CBS (Statistics Netherlands) House Price Index",
    trendSourceUrl: "https://www.cbs.nl/nl-nl/nieuws/2026/26/koopwoningen-in-juni-ruim-4-procent-duurder-dan-jaar-eerder"
  },
  poland: {
    trendPercent: 6.0,
    trendPeriod: "Q1 2026",
    trendSource: "Statistics Poland (GUS) dwelling price indices",
    trendSourceUrl: "https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/wskazniki-cen-lokali-mieszkalnych-w-1-kwartale-2026-r-,12,31.html"
  },
  austria: {
    trendPercent: 3.9,
    trendPeriod: "H1 2026",
    trendSource: "Statistics Austria House Price Index",
    // FIX: was regional news (vol.at); now Statistics Austria's own page.
    trendSourceUrl: "https://www.statistik.at/statistiken/volkswirtschaft-und-oeffentliche-finanzen/preise-und-preisindizes/haeuserpreisindex-und-ooh-pi"
  },
  switzerland: {
    trendPercent: 4.5,
    trendPeriod: "Q1 2026",
    trendSource: "Swiss National Bank / Wüest Partner Transaction Price Index (owner-occupied apartments)",
    // FIX: was a third-party paid data reseller (globalpropertyguide.com);
    // now the SNB's own data portal, which publishes this index directly.
    trendSourceUrl: "https://data.snb.ch/en/topics/uvo/cube/plimoinregq"
  },
  "czech republic": {
    trendPercent: 14.5,
    trendPeriod: "Q1 2026",
    trendSource: "Czech Statistical Office (ČSÚ), index of realized older-apartment prices",
    trendSourceUrl: "https://csu.gov.cz/produkty/ceny_bytu"
  },
  hungary: {
    trendPercent: 9.2,
    trendPeriod: "Q1 2026",
    trendSource: "Hungarian Central Statistical Office (KSH) housing price index",
    trendSourceUrl: "https://www.ksh.hu/s/kiadvanyok/lakaspiaci-arak-lakasarindex-2026-i-negyedev/index.html",
    momentumNote: "Hungary's central bank (MNB) assessed nationwide house prices as exceeding the level justified by fundamentals by 22.5% in Q4 2025, per its house price misalignment analysis."
  },
  denmark: {
    trendPercent: 6.8,
    trendPeriod: "Q1 2026",
    trendSource: "Danmarks Statistik (Statistics Denmark) house price statistics, single-family houses",
    trendSourceUrl: "https://www.dst.dk/da/Statistik/udgivelser/NytHtml?cid=51601"
  },
  sweden: {
    trendPercent: 2.0,
    trendPeriod: "Q2 2026",
    trendSource: "SCB (Statistics Sweden) Property Price Index, permanent single-family homes",
    trendSourceUrl: "https://www.scb.se/hitta-statistik/statistik-efter-amne/boende-bebyggelse-och-mark/fastigheter/fastighetspriser-och-lagfarter/pong/statistiknyhet/fastighetspriser-och-lagfarter-2a-kvartalet-2026/"
  },
  norway: {
    trendPercent: 4.9,
    trendPeriod: "Jan-Aug 2026 vs Jan-Aug 2025",
    trendSource: "Eiendom Norge (Real Estate Norway) housing price statistics",
    trendSourceUrl: "https://eiendomnorge.no/boligprisstatistikk/"
  },
  iceland: {
    trendPercent: 2.3,
    trendPeriod: "August 2026",
    trendSource: "HMS (Housing and Construction Authority) / Statistics Iceland house price index",
    trendSourceUrl: "https://hms.is/frettir/visitala-ibu%C3%B0aver%C3%B0s-fyrir-agust-2026"
  },
  ireland: {
    trendPercent: 5.5,
    trendPeriod: "July 2026",
    trendSource: "CSO Ireland Residential Property Price Index",
    trendSourceUrl: "https://www.cso.ie/en/releasesandpublications/ep/p-rppi/residentialpropertypriceindexjuly2026/"
  },
  finland: {
    trendPercent: -3.9,
    trendPeriod: "June 2026",
    trendSource: "Statistics Finland (Tilastokeskus), old dwellings price index",
    trendSourceUrl: "https://stat.fi/fi/julkaisu/cmetllsj4kmoy07uepaikld2w"
  },
  luxembourg: {
    trendPercent: 1.7,
    trendPeriod: "Q1 2026",
    trendSource: "STATEC (Luxembourg National Statistics Institute) housing price index",
    trendSourceUrl: "https://gouvernement.lu/fr/actualites/toutes_actualites/communiques/2026/06-juin/25-rapport-analye-25.html"
  },
  croatia: {
    trendPercent: 14.3,
    trendPeriod: "Q1 2026",
    trendSource: "Croatian Bureau of Statistics (DZS) House Price Indices",
    trendSourceUrl: "https://podaci.dzs.hr/2026/en/121606"
  },
  cyprus: {
    trendPercent: 8.5,
    trendPeriod: "Q2 2026",
    trendSource: "Central Bank of Cyprus Residential Property Price Index",
    // FIX: was a news write-up (cyprus-mail.com); now the Central Bank of
    // Cyprus's own publications page, which publishes this index directly.
    trendSourceUrl: "https://www.centralbank.cy/en/publications/residential-property-price-indices"
  },
  malta: {
    trendPercent: 6.7,
    trendPeriod: "Q1 2026",
    trendSource: "National Statistics Office (NSO) Malta Residential Property Price Index",
    // FIX: was a news write-up (lovinmalta.com); now NSO Malta's own Q1
    // 2026 release page (confirms the same +6.7% YoY figure directly).
    trendSourceUrl: "https://nso.gov.mt/residential-property-price-index-rppi-q1-2026/",
    momentumNote: "Central Bank of Malta Deputy Governor Alexander Demarco said the Bank's house price misalignment index shows the market has been undervalued by around 5% for the past three and a half years."
  },
  estonia: {
    trendPercent: 5.8,
    trendPeriod: "Q2 2026",
    trendSource: "Statistics Estonia housing price index",
    trendSourceUrl: "https://www.adaur.ee/statistikaamet-eluaseme-hinnaindeks-tousis-aastaga-58/"
  },
  latvia: {
    trendPercent: 10.9,
    trendPeriod: "Q1 2026",
    trendSource: "Central Statistical Bureau of Latvia (CSB) House Price Index",
    trendSourceUrl: "https://stat.gov.lv/en/statistics-themes/economy/consumer-prices/tables/pci050c-house-price-index-and-changes"
  },
  georgia: {
    trendPercent: 4.9,
    trendPeriod: "Q2 2026",
    trendSource: "National Statistics Office of Georgia (Geostat) — Residential Property Price Index",
    trendSourceUrl: "https://geostat.ge/media/81560/Residential-Property-Price-Index---II-quarter-of-2026.pdf"
  },
  canada: {
    trendPercent: -2.3,
    trendPeriod: "June 2026",
    trendSource: "Statistics Canada — New Housing Price Index",
    trendSourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/260724/dq260724c-eng.htm"
  }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

export function getGlobalIndexTrend(country) {
  const entry = TRENDS[normalizeCountry(country)];
  return entry ? { ...entry } : null;
}
