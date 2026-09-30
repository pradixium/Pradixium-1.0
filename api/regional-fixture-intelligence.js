import { readFileSync } from "node:fs";
import path from "node:path";
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
  // Geostat's RPPI covers NEW homes in Tbilisi only (flats + detached
  // houses). Its district medians per m² (release chart, p. 3) are built
  // from web-scraped OFFER prices (Myhome, said in the release) →
  // `askingPrices`: context only, never the benchmark. Values in GEL, read
  // from the rendered chart and checked against the bar lengths.
  georgia: {
    country: "Georgia",
    period: "2026-Q2",
    currencyLabel: "GEL ",
    askingPrices: true,
    askingNote: "Geostat's median of web-scraped OFFER (asking) prices of new-build homes",
    typeChanges: { flats: 4.8, houses: 5.5 },
    regions: [
      { name: "Mtatsminda, Tbilisi", towns: ["mtatsminda"], value: 6730, houseValue: 4409 },
      { name: "Vake, Tbilisi", towns: ["vake"], value: 5914, houseValue: 4656 },
      { name: "Krtsanisi, Tbilisi", towns: ["krtsanisi"], value: 4630, houseValue: 2926 },
      { name: "Saburtalo, Tbilisi", towns: ["saburtalo"], value: 4307, houseValue: 3510 },
      { name: "Didube, Tbilisi", towns: ["didube"], value: 4184, houseValue: 3477 },
      { name: "Isani, Tbilisi", towns: ["isani"], value: 4088, houseValue: 3268 },
      { name: "Chughureti, Tbilisi", towns: ["chughureti"], value: 4064, houseValue: 3524 },
      { name: "Nadzaladevi, Tbilisi", towns: ["nadzaladevi"], value: 4038, houseValue: 2778 },
      { name: "Gldani, Tbilisi", towns: ["gldani"], value: 3867, houseValue: 2811 },
      { name: "Samgori, Tbilisi", towns: ["samgori"], value: 3680, houseValue: 2992 },
      { name: "Tbilisi", towns: ["tbilisi", "tiflis"], value: null,
        note: "district medians run from GEL 3,680/m² (Samgori) to GEL 6,730/m² (Mtatsminda) for flats and GEL 2,778–4,656/m² for houses — enter the district for its own figure" }
    ],
    coverageNote: "Tbilisi new-build homes only (Geostat RPPI, Q2 2026: flats +4.8%, detached houses +5.5% on a year earlier); Batumi and other cities have no official price series.",
    source: "National Statistics Office of Georgia (Geostat) — Residential Property Price Index, Q2 2026",
    officialSource: "https://www.geostat.ge/media/81560/Residential-Property-Price-Index---II-quarter-of-2026.pdf"
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
  // MONSTAT "Cijene stanova u novogradnji" (quarterly, from signed purchase
  // contracts of NEW flats sold for the first time — resale flats and houses
  // are not covered). Regions as MONSTAT defines them (release footnote 1).
  // Q2 2026 release 20.08.2026 vs the Q2 2025 release. The central region
  // doubled (1,068 → 2,131: a composition swing) → no trend shown for it.
  // Cadastre Committee of Armenia — quarterly market analysis (Q2 2026,
  // table 3.6-2): market-averaged price per m² of flats in multi-apartment
  // buildings per Yerevan district, "formed from the analysis of contract
  // prices of sold flats AND offer prices of flats for sale" → context only.
  // District averages ("միջին" rows); change = Q2 2026 vs Q2 2025.
  armenia: {
    country: "Armenia",
    period: "2026-Q2",
    nationalChangePercent: null,
    benchmarkUnit: "perSqm",
    flatsOnly: true,
    askingPrices: true,
    askingNote: "built by the Cadastre Committee from contract prices of sold flats together with offer (asking) prices",
    askingPartly: true,
    regions: [
      { name: "Kentron, Yerevan", towns: ["kentron", "center yerevan", "centre yerevan"], value: 946000, prev: 882700, change: 7.2 },
      { name: "Arabkir, Yerevan", towns: ["arabkir"], value: 684900, prev: 620000, change: 10.5 },
      { name: "Nork-Marash, Yerevan", towns: ["nork marash"], value: 554500, prev: 445800, change: 24.4 },
      { name: "Davtashen, Yerevan", towns: ["davtashen"], value: 547000, prev: 474700, change: 15.2 },
      { name: "Kanaker-Zeytun, Yerevan", towns: ["kanaker zeytun", "qanaqer zeytun", "kanaker", "zeytun"], value: 517100, prev: 443500, change: 16.6 },
      { name: "Ajapnyak, Yerevan", towns: ["ajapnyak"], value: 482600, prev: 414200, change: 16.5 },
      { name: "Nor Nork, Yerevan", towns: ["nor nork"], value: 474000, prev: 410200, change: 15.6 },
      { name: "Shengavit, Yerevan", towns: ["shengavit"], value: 473000, prev: 392800, change: 20.4 },
      { name: "Erebuni, Yerevan", towns: ["erebuni"], value: 472700, prev: 405400, change: 16.6 },
      { name: "Malatia-Sebastia, Yerevan", towns: ["malatia sebastia", "malatia"], value: 472600, prev: 388800, change: 21.6 },
      { name: "Avan, Yerevan", towns: ["avan"], value: 463900, prev: 397400, change: 16.7 },
      { name: "Nubarashen, Yerevan", towns: ["nubarashen"], value: 266000, prev: 236700, change: 12.4 },
      { name: "Yerevan", towns: ["yerevan", "erevan"], value: null, prev: null, change: null,
        note: "district averages range from AMD 266,000/m² (Nubarashen) to AMD 946,000/m² (Kentron) — enter the district for its own figure" }
    ],
    coverageNote: "Flats in multi-apartment buildings, Yerevan districts only.",
    source: "Cadastre Committee of the Republic of Armenia — Real estate market analysis, Q2 2026 (table 3.6-2)",
    officialSource: "https://cadastre.am/storage/files/1-ii2026.pdf"
  },
  montenegro: {
    country: "Montenegro",
    period: "2026-Q2",
    nationalChangePercent: 16.2,
    nationalBenchmarkValue: 2557,
    benchmarkUnit: "perSqm",
    flatsOnly: true,
    regions: [
      { name: "Podgorica (capital)", towns: ["podgorica"], value: 2510, prev: 2108, change: 19.1 },
      { name: "Coastal region (Bar, Budva, Herceg Novi, Kotor, Tivat, Ulcinj)", towns: ["bar", "budva", "herceg novi", "kotor", "tivat", "ulcinj", "petrovac", "sveti stefan", "becici", "rafailovici", "przno", "igalo", "risan", "perast", "dobrota", "prcanj", "lustica", "sutomore", "susanj"], value: 2838, prev: 2333, change: 21.6 },
      { name: "Central region (Cetinje, Danilovgrad, Nikšić, Tuzi, Zeta)", towns: ["cetinje", "danilovgrad", "niksic", "tuzi", "zeta", "golubovci"], value: 2131, prev: 1068, change: null },
      { name: "Northern region", towns: ["andrijevica", "berane", "bijelo polje", "gusinje", "kolasin", "mojkovac", "petnjica", "plav", "pljevlja", "pluzine", "rozaje", "savnik", "zabljak"], value: 2145, prev: 1547, change: null }
    ],
    coverageNote: "New-build flats sold for the first time (developers' signed purchase contracts) — resale flats are not in MONSTAT's series; houses not covered.",
    source: "Statistical Office of Montenegro (MONSTAT) — Cijene stanova u novogradnji (prices of new flats), Q2 2026",
    officialSource: "https://monstat.org/uploads/files/gradjevinarstvo/Cijene%20stanova%20u%20novogradnji/2026/2/Cijene%20stanova%20u%20novogradnji_II_kvartal_2026.pdf"
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
    flatsOnly: true,
    coverageNote: "Covers middle/upper-income Lima districts only, in USD. Prime districts run well above this: Barranco $2,463/m², Miraflores $2,400/m², San Isidro $2,273/m² this quarter — no verified nationwide Peru figure.",
    source: "Banco Central de Reserva del Perú (BCRP) — apartment sale price indicator, Q4 2025",
    officialSource: "https://www.bcrp.gob.pe/estadisticas/indicador-de-precios-de-venta-de-departamentos.html"
  },
  // INE's own release page (21 Sept 2026): median USD price of all property
  // sales, June 2026, 12-month change −5.56%. The Montevideo level could not
  // be re-read (INE's report host answered 503) → the Feb 2025 figure that
  // was here (19 months old) is dropped; national trend only.
  uruguay: {
    country: "Uruguay",
    period: "2026-06",
    nationalChangePercent: -5.56,
    benchmarkUnit: "total",
    coverageNote: "12-month change of INE's median USD price of all registered property sales (June 2026); no current local price level is on file",
    source: "Instituto Nacional de Estadística (INE) — Indicadores de Actividad Inmobiliaria (IAI), Mercado de Compraventa, July 2026 release (June 2026 data)",
    officialSource: "https://www.gub.uy/instituto-nacional-estadistica/comunicacion/publicaciones/indicadores-actividad-inmobiliaria-iai-mercado-compraventa-julio-2026"
  },
  "dominican republic": {
    country: "Dominican Republic",
    period: "2026-H1",
    nationalChangePercent: null,
    cityName: "Metropolitan Region (Gran Santo Domingo)",
    cityChangePercent: 12.2,
    cityBenchmarkValue: 122699,
    benchmarkUnit: "perSqm",
    flatsOnly: true,
    askingPrices: true,
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
// Serbia: RGZ quarterly report (Register of Real Estate Prices) — median
// €/m² of flats sold per city and per Belgrade inner municipality
// (lib/data/serbiaPrices.json ← scripts/build-rs-prices.py). Built into a
// regions fixture: a Belgrade municipality first (Palilula / Stari grad only
// together with "Beograd" — Niš has a Palilula too), then the city.
let rsDoc;
function serbiaFixture() {
  if (rsDoc === undefined) { try { rsDoc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "serbiaPrices.json"), "utf8")); } catch { rsDoc = null; } }
  if (!rsDoc) return null;
  const key = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "dj").replace(/[^a-z0-9]+/g, " ").trim();
  const q = rsDoc.quarter.replace(/^([IV]+) (\d{4})$/, (m, r, y) => `${y}-Q${{ I: 1, II: 2, III: 3, IV: 4 }[r]}`);
  const row = (name, e, extra = {}) => ({ name, value: e.all.median, change: e.all.yoy, prev: null, sales: e.all.sales,
    note: `median of ${e.all.sales} flat sales; existing flats €${e.existing.median?.toLocaleString("en-US") ?? "—"}/m², new flats €${e.new.median?.toLocaleString("en-US") ?? "—"}/m²`, ...extra });
  const regions = [];
  for (const [n, e] of Object.entries(rsDoc.belgrade)) {
    const k = key(n), needCity = k === "palilula" || k === "stari grad";
    regions.push(row(`${n} (Belgrade)`, e, { towns: [k, ...(k === "stara rakovica" ? ["rakovica"] : [])], requires: needCity ? ["beograd", "belgrade"] : null }));
  }
  for (const [n, e] of Object.entries(rsDoc.cities)) {
    const k = key(n);
    regions.push(row(n === "Beograd" ? "Belgrade (inner urban area)" : n, e, { towns: n === "Beograd" ? ["beograd", "belgrade"] : [k] }));
  }
  const bg = rsDoc.cities.Beograd;
  return {
    country: "Serbia", period: q, nationalChangePercent: null, benchmarkUnit: "perSqm", flatsOnly: true, regions,
    coverageNote: `Median price per m² of flats sold (RGZ Register of Real Estate Prices), change on the same quarter a year earlier. ${rsDoc.belgradeNote}. Houses are not in these city tables.`,
    source: rsDoc.source, officialSource: rsDoc.sourceUrl, _belgrade: bg
  };
}

export function getRegionalFixture(country) {
  const c = normalizeCountry(country);
  const fixture = c === "serbia" ? serbiaFixture() : FIXTURES[c];
  if (fixture && c === "serbia" && fixture._belgrade) return { ...fixture, cityName: "Belgrade", cityChangePercent: fixture._belgrade.all.yoy };
  return fixture ? { ...fixture } : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const country = normalizeCountry(req.query?.country);
  const fixture = country === "serbia" ? serbiaFixture() : FIXTURES[country] ? { ...FIXTURES[country] } : null;
  const city = String(req.query?.city || "").trim() || null;

  // a fixture with official regions (Montenegro): the town's own region
  if (fixture?.regions) {
    const w = ` ${[city, req.query?.address].filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ")} `;
    const r = fixture.regions.find((x) => x.towns.some((t) => w.includes(` ${t} `)) && (!x.requires || x.requires.some((t) => w.includes(` ${t} `))));
    // a figure per home type (Georgia: flats / detached houses)
    const houseQ = /house|villa|town|home/i.test(String(req.query?.propertyType || "")) && !/apart|flat|studio|penthouse|condo/i.test(String(req.query?.propertyType || ""));
    const cur = fixture.currencyLabel || (fixture.country === "Armenia" ? "AMD " : "€");
    if (r) {
      const val = houseQ && r.houseValue != null ? r.houseValue : r.value;
      const typeWord = r.houseValue != null ? (houseQ ? " (detached houses)" : " (flats)") : "";
      const chg = fixture.typeChanges ? (houseQ ? fixture.typeChanges.houses : fixture.typeChanges.flats) : r.change;
      Object.assign(fixture, { cityName: r.name, cityBenchmarkValue: val, cityChangePercent: chg, regionMatch: true,
        coverageNote: `${fixture.coverageNote} ${r.name}${typeWord}: ${val != null ? `${cur}${val.toLocaleString("en-US")}/m²` : ""}${r.note ? ` (${r.note})` : ""}${r.prev != null ? ` (a year earlier: ${cur}${r.prev.toLocaleString("en-US")}/m²)` : ""}${r.change == null && r.value != null && !fixture.typeChanges ? " — the change is not shown: too few sales for a stable comparison" : ""}.` });
    }
  }

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
      flatsOnly: fixture.flatsOnly ?? false,
      askingPrices: fixture.askingPrices ?? false,
      askingNote: fixture.askingNote ?? null,
      askingPartly: fixture.askingPartly ?? false,
      currencyLabel: fixture.currencyLabel ?? null,
      changeIsMonthly: fixture.changeIsMonthly ?? false,
      regionMatch: fixture.regionMatch ?? false,
      cityLevelStatus: "REGIONAL_DATA_LAYER_PENDING",
      sources: { official: fixture.source },
      sourceUrls: { official: fixture.officialSource },
      coverage: "A dated fixture from the source's own published report, not a live feed — verify against the official source before relying on it for a current quarter."
    }
  });
}
