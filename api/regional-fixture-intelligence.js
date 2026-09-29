/* PRADIXIUM™ — REGIONAL FIXTURE INTELLIGENCE ENGINE
 * Shared adapter for markets worldwide whose official (or, where noted,
 * most authoritative industry) statistics body publishes real figures,
 * but only as press releases or PDF reports — no CSV/JSON feed this
 * project could verify and wire in live (same limitation already
 * documented in api/greece-intelligence.js). Each entry below is a dated
 * fixture from that market's own central bank, statistics office, or (for
 * a handful of countries with no government house-price index at all —
 * clearly labeled) its most widely-cited industry index, not a live feed
 * — it needs manual refreshing and should be verified against the
 * officialSource before relying on it for a current quarter.
 *
 * Countries with no verifiable figure at all (Moldova, Belarus, Kosovo,
 * Liechtenstein, San Marino, Armenia, Georgia, Azerbaijan, Uzbekistan,
 * Kyrgyzstan, Tajikistan, Turkmenistan, Maldives) are deliberately left
 * out rather than guessed — they stay "not available" until a real
 * number is found.
 */
const FIXTURES = {
  // ── Africa (Sept 2026, Claude B) — official price TRENDS by metro/city:
  // these sources publish indices, not price levels → trend + context only,
  // never a price benchmark.
  "south africa": {
    country: "South Africa",
    period: "April 2026",
    nationalChangePercent: 7.9,
    typeNote: "flats = sectional title, houses = freehold",
    cityTrends: [
      { name: "City of Cape Town", aliases: ["cape town", "city of cape town", "kaapstad", "sea point", "camps bay", "clifton", "bantry bay", "green point", "constantia", "claremont", "rondebosch", "bloubergstrand", "durbanville", "hout bay", "llandudno", "fresnaye", "tamboerskloof", "muizenberg", "kalk bay", "somerset west"], total: 11.0, flats: 10.3, houses: 10.2 },
      { name: "City of Johannesburg", aliases: ["johannesburg", "joburg", "jozi", "sandton", "rosebank", "randburg", "roodepoort", "soweto", "midrand", "fourways", "bryanston", "parktown", "melville", "houghton", "morningside"], total: 5.4, flats: 0.5, houses: 10.8 },
      { name: "City of Tshwane", aliases: ["pretoria", "tshwane", "centurion", "hatfield", "menlyn", "waterkloof", "irene", "soshanguve", "mamelodi"], total: 3.8, flats: 1.8, houses: 8.3 },
      { name: "Ekurhuleni", aliases: ["ekurhuleni", "germiston", "boksburg", "benoni", "kempton park", "edenvale", "alberton", "brakpan", "bedfordview"], total: 4.9, flats: 1.5, houses: 6.3 },
      { name: "eThekwini (Durban)", aliases: ["durban", "ethekwini", "umhlanga", "umhlanga rocks", "westville", "pinetown", "amanzimtoti", "la lucia", "umdloti"], total: 3.7, flats: 5.3, houses: 3.5 },
      { name: "Nelson Mandela Bay", aliases: ["gqeberha", "port elizabeth", "nelson mandela bay", "uitenhage", "kariega", "summerstrand"], total: 6.4, flats: 5.4, houses: 6.2 },
      { name: "Buffalo City", aliases: ["east london", "buffalo city", "qonce", "king william's town"], total: 5.0, flats: 0.5, houses: 8.0 },
      { name: "Mangaung", aliases: ["bloemfontein", "mangaung", "mangaung metro"], total: 2.8, flats: 8.2, houses: 1.6 }
    ],
    source: "Statistics South Africa (Stats SA) — Residential Property Price Index P0160, April 2026 (Deeds Office transactions)",
    officialSource: "https://www.statssa.gov.za/publications/P0160/P0160April2026.pdf"
  },
  morocco: {
    country: "Morocco",
    period: "Q2 2026",
    nationalChangePercent: 1.0,
    nationalTypeTrends: { flats: 1.1, houses: -0.7, villas: -0.3 },
    cityQuarterly: { Casablanca: 0.5, Rabat: 1.9, Marrakech: 0.5, Tanger: 2.3, Agadir: -0.1, Fès: 1.7, Kénitra: 0.7, "El Jadida": 0.0, Meknès: -0.9, Oujda: -0.9 },
    coverageNote: "Year-on-year change is published nationally; by city only the quarter-on-quarter change",
    source: "Bank Al-Maghrib & ANCFCC — Indice des prix des actifs immobiliers (IPAI) n° 67, Q2 2026 (repeat sales of registered transactions)",
    officialSource: "https://www.ancfcc.gov.ma/media/ipai/ipai-t2-2026-fr.pdf"
  },
  kenya: {
    country: "Kenya",
    period: "Q1 2026",
    nationalChangePercent: 4.8,
    nationalTypeTrends: { flats: -3.0, houses: 8.5 },
    coverageNote: "National index (index 118.4 vs 113.0 a year earlier); no city breakdown published",
    source: "Kenya National Bureau of Statistics (KNBS) — Kenya Residential Property Price Index, First Quarter 2026",
    officialSource: "https://www.knbs.or.ke/reports/kenya-residential-property-price-index-first-quarter-2026/"
  },
  // Geostat's RPPI covers NEW homes in Tbilisi only. Its district €/m²
  // chart is built from web-scraped ASKING prices (Myhome, ss.ge — said in
  // the release) → not used as a price; the index change is.
  georgia: {
    country: "Georgia",
    period: "2026-Q2",
    cityName: "Tbilisi",
    cityChangePercent: 4.9,
    coverageNote: "Tbilisi new-build homes only (Geostat RPPI); Batumi and other cities have no official price series",
    source: "National Statistics Office of Georgia (Geostat) — Residential Property Price Index, Q2 2026",
    officialSource: "https://www.geostat.ge/media/81560/Residential-Property-Price-Index---II-quarter-of-2026.pdf"
  },
  serbia: {
    country: "Serbia",
    period: "2025-Q3",
    nationalChangePercent: 6.0,
    cityName: "Belgrade",
    cityChangePercent: 6.55,
    cityBenchmarkValue: 2517,
    benchmarkUnit: "perSqm",
    source: "Republic Geodetic Authority (RGZ) — Apartment Price Index, Q3 2025",
    officialSource: "https://www.rgz.gov.rs/rga-apartment-price-index"
  },
  "bosnia and herzegovina": {
    country: "Bosnia and Herzegovina",
    period: "2024",
    nationalChangePercent: 16.6,
    nationalBenchmarkValue: 1643,
    benchmarkUnit: "perSqm",
    source: "Agency for Statistics of Bosnia and Herzegovina — average price of new-build dwellings, 2024",
    officialSource: "https://bhas.gov.ba/"
  },
  montenegro: {
    country: "Montenegro",
    period: "2025-Q3",
    nationalChangePercent: 23.2,
    cityName: "Coastal municipalities",
    cityChangePercent: 23.2,
    cityBenchmarkValue: 2458,
    benchmarkUnit: "perSqm",
    coverageNote: "Figure covers Montenegro's coastal municipalities (the primary foreign-buyer market), not the national average.",
    source: "Statistical Office of Montenegro (MONSTAT) — residential property prices, Q3 2025",
    officialSource: "https://www.monstat.org/eng/"
  },
  "north macedonia": {
    country: "North Macedonia",
    period: "2025-Q4",
    nationalChangePercent: 24.98,
    benchmarkUnit: "perSqm",
    source: "State Statistical Office of North Macedonia — House Price Index, Q4 2025",
    officialSource: "https://www.stat.gov.mk/"
  },
  ukraine: {
    country: "Ukraine",
    period: "2025-Q4",
    nationalChangePercent: 13.2,
    benchmarkUnit: "perSqm",
    coverageNote: "National figure masks large regional variation from the war — cities under regular shelling see sales well below pre-war benchmarks, while Kyiv and safer western cities (Lviv, Uzhhorod, Ivano-Frankivsk) see the highest prices. Verify against a specific city before relying on this for any individual property.",
    source: "State Statistics Service of Ukraine (Derzhstat) — Housing market price changes, Q4 2025",
    officialSource: "https://stat.gov.ua/en/datasets/housing-market-price-changes"
  },
  albania: {
    country: "Albania",
    period: "2025-H2",
    nationalChangePercent: null,
    cityName: "Tirana",
    cityChangePercent: 4.4,
    benchmarkUnit: "perSqm",
    coverageNote: "Bank of Albania's real estate survey covers Tirana only; no verified nationwide figure.",
    source: "Bank of Albania — Real Estate Market Survey, H2 2025",
    officialSource: "https://www.bankofalbania.org/Financial_Stability/Analysis_and_studies/Surveys/Survey_on_the_developments_in_the_real_estate_market_in_Albania.html"
  },
  andorra: {
    country: "Andorra",
    period: "2025-Q1",
    nationalChangePercent: null,
    nationalBenchmarkValue: 4300,
    benchmarkUnit: "perSqm",
    source: "Government of Andorra, Statistics Department — quarterly property price report, Q1 2025",
    officialSource: "https://www.estadistica.ad/"
  },
  monaco: {
    country: "Monaco",
    period: "2025",
    nationalChangePercent: null,
    nationalBenchmarkValue: 57569,
    benchmarkUnit: "perSqm",
    coverageNote: "Monaco's own IMSEE Real Estate Observatory breaks this down by district — Larvotto (€71,167/m²) is the highest, Jardin Exotique/Moneghetti (€43,000-45,000/m²) the lowest. This is the principality-wide average across all districts and building ages.",
    source: "IMSEE (Monégasque Institute of Statistics and Economic Studies) — Real Estate Observatory, 2025",
    officialSource: "https://imsee.mc/"
  },
  russia: {
    country: "Russia",
    period: "2025-Q4",
    nationalChangePercent: 4.48,
    benchmarkUnit: "perSqm",
    source: "Rosstat (Federal State Statistics Service) — Housing market price indices, Q4 2025",
    officialSource: "https://eng.rosstat.gov.ru/"
  },
  kazakhstan: {
    country: "Kazakhstan",
    period: "2025-12",
    nationalChangePercent: 15.74,
    benchmarkUnit: "perSqm",
    coverageNote: "Nationwide primary (new-build) house price index — Bureau of National Statistics' inflation-adjusted figure is +3.06%.",
    source: "Bureau of National Statistics, Agency for Strategic Planning and Reforms of Kazakhstan — Primary House Price Index, December 2025",
    officialSource: "https://stat.gov.kz/"
  },
  canada: {
    country: "Canada",
    period: "2026-07",
    nationalChangePercent: -3.3,
    nationalBenchmarkValue: 674819,
    benchmarkUnit: "total",
    coverageNote: "CREA is Canada's national real estate association, not a government body, but its MLS® Home Price Index is the country's standard housing benchmark, compiled from actual MLS transaction data.",
    source: "Canadian Real Estate Association (CREA) — MLS® Home Price Index, July 2026",
    officialSource: "https://creastats.crea.ca/"
  },
  mexico: {
    country: "Mexico",
    period: "2026-Q1",
    nationalChangePercent: 8.7,
    nationalBenchmarkValue: 2024337,
    benchmarkUnit: "total",
    coverageNote: "National average appraised value; median appraised value is 1,331,000 pesos. Valley of Mexico +5.1% YoY, Guadalajara +12.5% YoY this quarter.",
    source: "Sociedad Hipotecaria Federal (SHF) — Índice SHF de Precios de la Vivienda, Q1 2026",
    officialSource: "https://www.gob.mx/shf"
  },
  brazil: {
    country: "Brazil",
    period: "2026-Q1",
    nationalChangePercent: 5.62,
    benchmarkUnit: "perSqm",
    coverageNote: "FipeZap (FIPE + the ZAP real estate listings site) is Brazil's most widely cited house-price benchmark, not a government statistic — no official government equivalent could be confirmed.",
    source: "FipeZap Index (Fundação Instituto de Pesquisas Econômicas) — Q1 2026",
    officialSource: "https://www.fipe.org.br/en-us/indexes-and-indicators/fipezap/"
  },
  australia: {
    country: "Australia",
    period: "2026-Q1",
    nationalChangePercent: null,
    nationalBenchmarkValue: 1111100,
    benchmarkUnit: "total",
    coverageNote: "ABS discontinued its per-city price index in 2021; this is its replacement Total Value of Dwellings release's national mean price. By state (Dec 2025): NSW A$1,301,100, QLD A$1,066,000, WA A$1,014,200, NT A$580,000.",
    source: "Australian Bureau of Statistics (ABS) — Total Value of Dwellings, March Quarter 2026",
    officialSource: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings"
  },
  "new zealand": {
    country: "New Zealand",
    period: "2026-08",
    nationalChangePercent: -0.9,
    benchmarkUnit: "perSqm",
    coverageNote: "REINZ (the industry real estate institute) developed this index in partnership with the Reserve Bank of New Zealand; referenced by NZ's Ministry of Housing and Urban Development.",
    source: "REINZ House Price Index, August 2026",
    officialSource: "https://www.reinz.co.nz/Web/Web/Data-and-Products/REINZ-HPI-Report.aspx"
  },
  argentina: {
    country: "Argentina",
    period: "2025-Q2",
    nationalChangePercent: null,
    cityName: "Buenos Aires (CABA)",
    cityChangePercent: 8.4,
    benchmarkUnit: "perSqm",
    coverageNote: "Figure covers the City of Buenos Aires only (CABA); no verified nationwide government figure.",
    source: "Instituto de Estadística y Censos de la Ciudad de Buenos Aires (IDECBA) — apartment price survey, Q2 2025",
    officialSource: "https://www.estadisticaciudad.gob.ar/"
  },
  chile: {
    country: "Chile",
    period: "2025-Q2",
    nationalChangePercent: 2.7,
    benchmarkUnit: "perSqm",
    coverageNote: "Houses +1.3% YoY, apartments +3.9% YoY this quarter.",
    source: "Banco Central de Chile — Índice de Precios de Vivienda (IPV), Q2 2025",
    officialSource: "https://www.bcentral.cl/en/areas/estadisticas/estadisticas-experimentales/ipv"
  },
  colombia: {
    country: "Colombia",
    period: "2026-Q1",
    nationalChangePercent: 8.47,
    benchmarkUnit: "perSqm",
    coverageNote: "New-housing index only. Apartments +8.50% YoY, houses +7.15% YoY this quarter.",
    source: "DANE — Índice de Precios de Vivienda Nueva (IPVN), Q1 2026",
    officialSource: "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-de-la-vivienda-nueva-ipvn"
  },
  peru: {
    country: "Peru",
    period: "2025-Q4",
    nationalChangePercent: null,
    cityName: "Lima Metropolitana",
    cityChangePercent: 12.1,
    cityBenchmarkValue: 1868,
    benchmarkUnit: "perSqm",
    coverageNote: "Covers middle/upper-income Lima districts only, in USD. Prime districts run well above this: Barranco $2,463/m², Miraflores $2,400/m², San Isidro $2,273/m² this quarter — no verified nationwide Peru figure.",
    source: "Banco Central de Reserva del Perú (BCRP) — apartment sale price indicator, Q4 2025",
    officialSource: "https://www.bcrp.gob.pe/estadisticas/indicador-de-precios-de-venta-de-departamentos.html"
  },
  uruguay: {
    country: "Uruguay",
    period: "2025-02",
    nationalChangePercent: 8.65,
    nationalBenchmarkValue: 85000,
    cityName: "Montevideo",
    cityChangePercent: 5.5,
    cityBenchmarkValue: 115000,
    benchmarkUnit: "total",
    coverageNote: "Median real estate transaction price in USD (converted at Banco República's daily selling rate), not price per m² — INE's compraventa (purchase-sale) indicator for horizontal property. Change percent is month-over-month, not year-over-year. The interior of the country (outside Montevideo) recorded USD 68,000, +13.33% MoM this period.",
    source: "Instituto Nacional de Estadística (INE) — Indicadores de Actividad Inmobiliaria (IAI), Mercado de Compraventa, February 2025",
    officialSource: "https://www.gub.uy/instituto-nacional-estadistica/tematica/iai-compraventa"
  },
  "dominican republic": {
    country: "Dominican Republic",
    period: "2026-H1",
    nationalChangePercent: null,
    cityName: "Metropolitan Region (Gran Santo Domingo)",
    cityChangePercent: 12.2,
    cityBenchmarkValue: 122699,
    benchmarkUnit: "perSqm",
    coverageNote: "Covers apartments in the Metropolitan Region (Gran Santo Domingo) only, in Dominican pesos (RD$) — no verified nationwide figure. Sourced from ONE's Registro de Oferta de Edificaciones (registered building supply), not confirmed closed-sale transactions. Prices vary sharply by municipality: Santo Domingo (Distrito Nacional) RD$132,730/m² down to Los Alcarrizos RD$31,738/m²; within Santo Domingo, Piantini tops out around RD$172,377/m².",
    source: "Oficina Nacional de Estadística (ONE) — Registro de Oferta de Edificaciones (ROE), H1 2026",
    officialSource: "https://www.one.gob.do/"
  },
  thailand: {
    country: "Thailand",
    period: "2026-Q1",
    nationalChangePercent: 1.26,
    benchmarkUnit: "perSqm",
    coverageNote: "Nationwide Residential Property Price Index (single detached houses, townhouses, condominiums and land). Regional divergence is sharp: the South rose 5.59% YoY this quarter, while Bangkok and its surrounding provinces actually fell 0.18% YoY.",
    source: "Bank of Thailand — Residential Property Price Index (RPPI), Q1 2026",
    officialSource: "https://www.bot.or.th/"
  },
  indonesia: {
    country: "Indonesia",
    period: "2026-Q2",
    nationalChangePercent: 0.69,
    benchmarkUnit: "perSqm",
    coverageNote: "Nationwide primary-market Residential Property Price Index (IHPR) — growth has been minimal, the weakest in the series' history in Q1 2026 before a slight pickup this quarter. This is a national average and does not reflect the foreign-investor-heavy Bali market (Canggu/Seminyak), where private industry sources report villa prices in the roughly $1,200-2,500/m² range with double-digit appreciation over the past two years — those figures come from real estate agencies, not Bank Indonesia, and are not included in this official statistic.",
    source: "Bank Indonesia — Survei Harga Properti Residensial (SHPR) / Residential Property Price Index (IHPR), Q2 2026",
    officialSource: "https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2815226.aspx"
  },
  "south korea": {
    country: "South Korea",
    period: "2026-04",
    nationalChangePercent: 2.35,
    cityName: "Seoul",
    cityChangePercent: 9.56,
    benchmarkUnit: "perSqm",
    coverageNote: "Seoul is running far hotter than the rest of the country this year — nearly 4x the nationwide rate.",
    source: "Bank of Korea / Korea Real Estate Board (REB) — Nationwide House Price Index, April 2026",
    officialSource: "https://www.reb.or.kr/rebEng/main.do"
  },
  india: {
    country: "India",
    period: "2025-Q4 (FY2025-26 Q3)",
    nationalChangePercent: 5.0,
    benchmarkUnit: "perSqm",
    coverageNote: "NHB RESIDEX 50-city Housing Price Index, valuation-based, October-December 2025 (growth has slowed from 7.2% the prior year). Key cities this period: Bengaluru +12.7%, Chennai +8.2%, Ahmedabad +6.8%, Kolkata +6.7%, Mumbai +3.7%, Pune +3.5%, Hyderabad +3.2%.",
    source: "National Housing Bank (NHB) — RESIDEX, Q3 FY2025-26 (Oct-Dec 2025)",
    officialSource: "https://residex.nhbonline.org.in/"
  },
  japan: {
    country: "Japan",
    period: "2025-11",
    nationalChangePercent: 5.0,
    nationalBenchmarkValue: 36000000,
    benchmarkUnit: "total",
    coverageNote: "Benchmark value is the average price of an existing condo/apartment nationwide; an average existing detached house runs closer to ¥30 million. Separately, MLIT's annual land price survey (koji chika) showed nationwide land prices up 2.8% in 2026 — the strongest rise since 1992, residential land specifically +2.1%.",
    source: "Ministry of Land, Infrastructure, Transport and Tourism (MLIT) — Residential Property Price Index, November 2025",
    officialSource: "https://www.mlit.go.jp/en/"
  },
  vietnam: {
    country: "Vietnam",
    period: "2025",
    nationalChangePercent: null,
    cityName: "Ho Chi Minh City",
    cityChangePercent: 65,
    cityBenchmarkValue: 6113,
    benchmarkUnit: "perSqm",
    coverageNote: "Primary (new-build) apartment market only, in USD. Hanoi ran hot too this period at $3,852/m² (+32% YoY). The Ministry of Construction reports apartment prices nationwide rose 20-30% in 2025, with some areas exceeding 40% — 2026 growth is forecast to moderate to roughly 10-15%.",
    source: "Vietnam Ministry of Construction — primary apartment market price data, 2025",
    officialSource: "https://en.nso.gov.vn/"
  },
  "sri lanka": {
    country: "Sri Lanka",
    period: "2025",
    nationalChangePercent: 9.4,
    cityName: "Colombo",
    cityChangePercent: 13.3,
    benchmarkUnit: "perSqm",
    coverageNote: "Colombo condominium prices specifically rose 13.3% YoY this period; Colombo land prices rose even faster, around 28.6% YoY.",
    source: "Central Bank of Sri Lanka — Condominium Market Survey / Real Estate Property Price Indices, 2025",
    officialSource: "https://www.cbsl.gov.lk/en/statistics/business-surveys/condominium-market-survey"
  },
  cambodia: {
    country: "Cambodia",
    period: "2026-01",
    nationalChangePercent: -3.67,
    cityName: "Phnom Penh",
    cityChangePercent: -4.52,
    benchmarkUnit: "perSqm",
    coverageNote: "Nationwide Residential Property Price Index has now declined for 29 consecutive months.",
    source: "National Bank of Cambodia — Residential Property Price Index (RPPI), January 2026",
    officialSource: "https://www.nbc.gov.kh/"
  }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

// Reused by api/global-index.js to build the Pradixium Global Index from
// this same dated-fixture data, without duplicating it or triggering an
// HTTP round-trip to this endpoint's own handler.
export function getRegionalFixture(country) {
  const fixture = FIXTURES[normalizeCountry(country)];
  return fixture ? { ...fixture } : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const country = normalizeCountry(req.query?.country);
  const fixture = FIXTURES[country];
  const city = String(req.query?.city || "").trim() || null;

  if (!fixture) {
    return res.status(404).json({ success: false, error: "Country not covered by the regional fixture adapter" });
  }

  return res.status(200).json({
    success: true,
    country: fixture.country,
    city,
    data: {
      market: `${fixture.country} Residential Property Market`,
      period: fixture.period,
      nationalChangePercent: fixture.nationalChangePercent,
      nationalBenchmarkValue: fixture.nationalBenchmarkValue ?? null,
      cityName: fixture.cityName ?? null,
      cityChangePercent: fixture.cityChangePercent ?? null,
      cityBenchmarkValue: fixture.cityBenchmarkValue ?? null,
      benchmarkUnit: fixture.benchmarkUnit,
      coverageNote: fixture.coverageNote ?? null,
      cityTrends: fixture.cityTrends ?? null,
      nationalTypeTrends: fixture.nationalTypeTrends ?? null,
      cityQuarterly: fixture.cityQuarterly ?? null,
      typeNote: fixture.typeNote ?? null,
      cityLevelStatus: "REGIONAL_DATA_LAYER_PENDING",
      sources: { official: fixture.source },
      sourceUrls: { official: fixture.officialSource },
      coverage: "A dated fixture from the source's own published report, not a live feed — verify against the official source before relying on it for a current quarter."
    }
  });
}
