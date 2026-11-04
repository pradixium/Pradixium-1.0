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
 * Countries with no verifiable figure at all (Belarus, Liechtenstein,
 * San Marino, Kyrgyzstan, Tajikistan, Turkmenistan, Maldives) are
 * deliberately left out rather than guessed — they stay "not available"
 * until a real number is found. (Armenia, Georgia, Moldova, Azerbaijan,
 * Uzbekistan, Cayman Islands and Kosovo were in that category too until
 * a real number was found for each — see their own entries below.)
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
    coverageNote: "Tbilisi new-build homes only, from web-scraped OFFER prices (Geostat RPPI, Q2 2026: flats +4.8%, detached houses +5.5% on a year earlier — the change in asking prices, not in sale prices; Geostat CPI “Apartment rent”: +10.9% on a year earlier in September 2026, national; National Bank of Georgia indices of OFFER prices and rents of typical 1- and 3-room flats in Tbilisi's Saburtalo and Varketili, in GEL, Financial Sector Review Sept 2026, Table 4.3: August 2026 price −0.5%, rent −2.1% on a year earlier); Batumi and other cities have no official price series.",
    source: "National Statistics Office of Georgia (Geostat) — Residential Property Price Index, Q2 2026",
    officialSource: "https://www.geostat.ge/en/modules/categories/698/residential-property-price-index"
  },
  "bosnia and herzegovina": {
    // BHAS "Prices of new dwellings sold" Q2 2026 (20.8.2026): total value
    // of all NEW dwellings sold in the quarter ÷ their useful floor area,
    // reported by the selling builders (form K KPS GRAĐ-41); existing
    // ("old") flats are not covered. National only (no city table).
    country: "Bosnia and Herzegovina",
    period: "2026-Q2",
    nationalChangePercent: 5.2,
    nationalBenchmarkValue: 3311,
    currencyLabel: "KM ",
    benchmarkUnit: "perSqm",
    flatsOnly: true,
    coverageNote: "Average price per m² of useful floor area of the 1,160 NEW dwellings sold in Q2 2026 (existing flats not covered); +5.2% on Q2 2025. Bosnia and Herzegovina as a whole — no city figures are published.",
    source: "Agency for Statistics of Bosnia and Herzegovina (BHAS) — Prices of new dwellings sold, Q2 2026",
    officialSource: "https://bhas.gov.ba/data/Publikacije/Saopstenja/2026/CON_05_2026_Q2_1_SR.pdf"
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
    period: "2026-H1",
    nationalChangePercent: 10,
    cityName: "Tirana",
    cityChangePercent: 9,
    benchmarkUnit: "perSqm",
    coverageNote: "Bank of Albania publishes two related series: a real estate agent/builder survey (Tirana only) and a nationwide Fisher house price index. H1 2026: nationwide Fisher index unchanged vs H2 2025 but +10% year-on-year; Tirana prices +10% vs H2 2025, +9% year-on-year (weaker than the six-month gain). Figures cross-confirmed across three independent outlets (Tirana Times, Albanian Daily News, Investropa) all citing the Bank of Albania; the Bank's own survey-archive page was confirmed (Oct 27 2026) to list nothing past 2021, so no direct primary-document link is available for this specific release — same honesty tier as Monaco/Georgia elsewhere in this file.",
    source: "Bank of Albania — Real Estate Market Survey & Fisher House Price Index, H1 2026 (reported by multiple independent outlets; primary PDF not located)",
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
    nationalChangePercent: -1.4,
    nationalBenchmarkValue: 57569,
    benchmarkUnit: "perSqm",
    // FIX (Oct 2026): the national average alone was never actually applied
    // as a benchmark (orchestrator.js's REGIONAL_FIXTURE_COUNTRIES branch
    // requires a cityName/district match to set benchmarkValue; Monaco had
    // neither, so every report fell through to "no official local price
    // figure" text, the district spread mentioned only as a coverage note
    // nobody could act on). IMSEE's 2025 edition (new linear-regression
    // methodology combining sales+resales+construction period) publishes
    // each quartier by name, so a property whose address/city names one is
    // now matched to it directly instead of the blended national figure.
    districts: [
      { name: "Larvotto", aliases: ["larvotto"], benchmarkValue: 71167, changePercent: 2.2 },
      { name: "Monte-Carlo", aliases: ["monte-carlo", "monte carlo", "montecarlo"], benchmarkValue: 54009, changePercent: 4.8 },
      { name: "Fontvieille", aliases: ["fontvieille"], benchmarkValue: 52518, changePercent: 4.5 },
      { name: "La Condamine", aliases: ["la condamine", "condamine"], benchmarkValue: 52104, changePercent: -0.7 },
      { name: "La Rousse", aliases: ["la rousse"], benchmarkValue: 51265, changePercent: 3.2 },
      { name: "Les Moneghetti", aliases: ["moneghetti", "les moneghetti"], benchmarkValue: 43797, changePercent: 3.3 }
    ],
    coverageNote: "Monaco's own IMSEE Real Estate Observatory 2025 breaks this down by district — Larvotto (€71,167/m²) is the highest, Les Moneghetti (€43,797/m²) the lowest. The figure above is the principality-wide average across all districts and building ages, down 1.4% from 2024's €58,402/m²; a property whose district is named is matched to that district's own figure instead.",
    source: "IMSEE (Monégasque Institute of Statistics and Economic Studies) — Observatoire de l'immobilier / Real Estate Observatory 2025 (published Feb 2026)",
    officialSource: "https://imsee.mc/en/content/download/293646/file/Real%20estate%20Observatory%202025.pdf?inLanguage=eng-GB&version=11"
  },
  // National Bank of Moldova (BNM) — Residential Property Price Index
  // (RPPI): a real, live-published quarterly index (chain-linked
  // Laspeyres-type, hedonic, 2019=100), confirmed via its own technical
  // note and metadata PDFs (bnm.md / statistica.gov.md) plus multiple
  // dated release pages on bnm.md. Covers Chișinău only, built from
  // online listing (offer) prices each quarter, not closed transactions.
  // Latest figure found (Q3 2025) came via Global Property Guide citing
  // BNM data — the BNM's own Q3 2025 release page wasn't reachable
  // directly to confirm the number, so this is the same honesty tier as
  // Albania elsewhere in this file: real official index, secondary-cited
  // current figure. Moves this out of pending-intelligence.js.
  moldova: {
    country: "Moldova",
    period: "2025-Q3",
    nationalChangePercent: 33.9,
    realChangePercent: 24.1,
    cityName: "Chișinău",
    benchmarkUnit: "perSqm",
    askingPrices: true,
    coverageNote: "National Bank of Moldova's Residential Property Price Index (RPPI) covers only the municipality of Chișinău — a chain-linked Laspeyres-type hedonic index, 2019=100, built from properties offered for sale on listing platforms each quarter, not closed transactions. Q3 2025: +33.9% year-on-year nominal (+24.1% inflation-adjusted). Reported via Global Property Guide citing BNM data; BNM's own release page for this specific quarter was not reachable directly to confirm, so verify against bnm.md before relying on it for a current quarter.",
    source: "National Bank of Moldova (BNM) — Residential Property Price Index (RPPI), Q3 2025 (reported by Global Property Guide citing BNM data; primary release page not confirmed directly)",
    officialSource: "https://www.bnm.md/en/print/content/residential-property-price-index-rppi-1st-quarter-2024"
  },
  // State Statistical Committee of the Republic of Azerbaijan (SSC) —
  // quarterly housing market price index (avg. price per m², primary +
  // secondary markets), methodology confirmed via the Committee's own
  // quality-report PDF (stat.gov.az). Latest figure (Q3 2026) came via
  // Trend.az citing the Committee and a Central Bank of Azerbaijan
  // (CBAR)-sourced release; the Committee's own release page for this
  // quarter wasn't reachable directly. Same honesty tier as Moldova/
  // Albania above. Moves this out of pending-intelligence.js.
  azerbaijan: {
    country: "Azerbaijan",
    period: "2026-Q3",
    nationalChangePercent: 8.4,
    nationalTypeTrends: { primary: 10.4, secondary: 8.4 },
    benchmarkUnit: "perSqm",
    coverageNote: "Azerbaijan's State Statistical Committee (SSC) publishes a quarterly housing market price index (average price per m² across primary and secondary markets). Q3 2026: +8.4% year-on-year nationally (primary market +10.4%, secondary +8.4%); quarter-on-quarter +1.4% (primary +1.3%, secondary +1.4%). Reported via Trend.az citing the Committee and a Central Bank of Azerbaijan (CBAR)-sourced release; the Committee's own stat.gov.az release page for this quarter was not reachable directly to confirm, so verify there before relying on it for a current quarter.",
    source: "State Statistical Committee of the Republic of Azerbaijan — Housing market price index, Q3 2026 (reported by Trend.az citing the Committee and CBAR; primary release page not confirmed directly)",
    officialSource: "https://www.stat.gov.az/menu/2/quality/en/lecture/price_01_en.pdf"
  },
  // National Statistics Committee of the Republic of Uzbekistan —
  // National Residential Property Price Index (2024=100), a real,
  // currently-published quarterly index with a direct official PDF
  // press release and a live data portal (siat.stat.uz). From Q2 2026
  // it switched to an IMF-backed hedonic-regression methodology and
  // added private houses; still built from advertised listing prices
  // (Tashkent entirely from OLX.uz), not closed transactions — no
  // average price per m² is published, nationally or by region, so this
  // is change-only, same as North Macedonia/Russia/Kazakhstan above.
  uzbekistan: {
    country: "Uzbekistan",
    period: "2026-Q2",
    nationalChangePercent: 4,
    nationalTypeTrends: { apartments: 5.5, primaryMarket: 7.1, secondaryMarket: 4.2 },
    cityName: "Tashkent",
    cityChangePercent: 3.9,
    benchmarkUnit: "perSqm",
    askingPrices: true,
    askingNote: "built from advertised listing prices, not closed transactions — Tashkent's figures come entirely from OLX.uz listings",
    coverageNote: "National Statistics Committee's National Residential Property Price Index (2024=100) stood at 106.8 in Q2 2026 (+4% year-on-year, +1.3% quarter-on-quarter nationally). Tashkent apartments +3.9% year-on-year vs +7% for the rest of the country; apartments overall +5.5%; primary market +7.1%, secondary market +4.2%. From Q2 2026 the Committee switched to an IMF-backed hedonic-regression methodology and added private houses for the first time. The Committee has said it has no current plans to publish an average price per m², nationally or by region.",
    source: "National Statistics Committee of the Republic of Uzbekistan — National Residential Property Price Index, Q2 2026 (official press release)",
    officialSource: "https://stat.uz/img/news/press-release_rppi_q2_2026_en_p78584.pdf"
  },
  // Cayman Islands Government, Lands and Survey Department — Residential
  // Property Price Index (RPPI), launched Sept 2025 with IMF technical
  // assistance, built from stamp-duty transaction data back to 1998
  // (starting with condominiums). A real government department index,
  // not an industry or academic one. District-level values exist in the
  // official release but weren't confirmed in this search, so only the
  // national figure is given here — check the official link for any
  // district breakdown before relying on this for one.
  "cayman islands": {
    country: "Cayman Islands",
    period: "2025",
    nationalChangePercent: -1.4,
    benchmarkUnit: "perSqm",
    coverageNote: "Cayman Islands Government Lands and Survey Department's Residential Property Price Index (RPPI) — launched September 2025 with IMF technical assistance, built from stamp-duty transaction data back to 1998, starting with condominiums. 2025: national index 282.8, down from 286.7 in 2024 (-1.4%). Covers George Town, West Bay, Seven Mile Beach, Bodden Town, East End, North Side, Cayman Brac and Little Cayman, but this search did not confirm each district's own index value — check caymanlandinfo.ky for any district breakdown before relying on one.",
    source: "Cayman Islands Government, Lands and Survey Department — Residential Property Price Index (RPPI), 2025 annual release",
    officialSource: "https://www.caymanlandinfo.ky/services/valuation/residential-property-price-index-(rppi)"
  },
  // Kosovo Agency of Statistics (KAS) — its first official Residential
  // Property Price Index, built with IMF technical assistance (missions
  // through 2023 and October 2025). Weaker confirmation than Uzbekistan/
  // Cayman above: only a secondary citation (RTV21) for the current
  // figure, KAS's own release page not reached directly — same honesty
  // tier as Albania/Moldova/Azerbaijan elsewhere in this file.
  kosovo: {
    country: "Kosovo",
    period: "2026-Q2",
    nationalChangePercent: 7.3,
    benchmarkUnit: "perSqm",
    coverageNote: "Kosovo Agency of Statistics (KAS) built its first official Residential Property Price Index (RPPI) with IMF technical assistance (missions through 2023 and October 2025). Q2 2026: +7.3% year-on-year nationally, with regions outside Pristina rising more sharply than the capital. Reported via RTV21 citing KAS data; KAS's own release page for this index was not reachable directly to confirm, so verify there before relying on it for a current quarter.",
    source: "Kosovo Agency of Statistics (KAS) — Residential Property Price Index (RPPI), Q2 2026 (reported by RTV21 citing KAS; primary release page not confirmed directly)",
    officialSource: "https://askapi.rks-gov.net/"
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
    period: "2026-Q2",
    nationalChangePercent: 7.3,
    nationalBenchmarkValue: 1960032,
    benchmarkUnit: "total",
    coverageNote: "National average appraised value for mortgaged homes, January–June 2026 (H1 accumulated, as SHF itself presents it alongside the Q2 figure) — median appraised value is 1,299,580 pesos. Q2 2026 alone: national +7.3% YoY (H1 accumulated +7.9%); new housing +8.3%, used +7.5%; single houses +8.4%, condos/apartments +7.4%. By metro area (H1 2026): Guadalajara +11.1%, Tijuana +9.7%, Puebla-Tlaxcala +8.5%, Monterrey +8.3%, León +7.9%, Querétaro +5.6%, Toluca +5.1%, Valle de México +4.6%. Confirmed directly from SHF's own press release (pasted in full by the user, Oct 27 2026) — primary-sourced, not a secondary citation.",
    source: "Sociedad Hipotecaria Federal (SHF) — Índice SHF de Precios de la Vivienda, Q2 2026 (press release 05/2026, 10 Aug 2026)",
    officialSource: "https://www.gob.mx/shf",
    // Table 3 of the same press release: SHF's own H1-2026 year-on-year
    // change by municipality (74 of them, every one it published) —
    // percent only, no €/m²-equivalent peso level, so these use `change`
    // with no `value` (see the handler's noteAddition branch above,
    // added specifically to render this cleanly rather than leaving a
    // dangling "Name: ."). `requires` guards every municipality name
    // that collides with a common word or a same-named municipality
    // elsewhere in Mexico (Juárez, Benito Juárez, García, Centro, Carmen,
    // Guadalupe, La Paz, El Marqués) so a bare address string can't
    // false-match the wrong one.
    regions: [
      { name: "Reynosa (Tamps.)", towns: ["reynosa"], change: 12.8 },
      { name: "León (Gto.)", towns: ["leon"], requires: ["guanajuato"], change: 7.9 },
      { name: "Matamoros (Tamps.)", towns: ["matamoros"], requires: ["tamaulipas"], change: 12.2 },
      { name: "Tapachula (Chis.)", towns: ["tapachula"], change: 7.8 },
      { name: "Solidaridad (Q.Roo) — Playa del Carmen", towns: ["solidaridad", "playa del carmen"], requires: ["playa del carmen", "quintana roo", "q roo", "q.roo"], change: 11.7 },
      { name: "Temixco (Mor.)", towns: ["temixco"], change: 7.5 },
      { name: "Tlajomulco de Zúñiga (Jal.)", towns: ["tlajomulco"], change: 11.6 },
      { name: "Saltillo (Coah.)", towns: ["saltillo"], change: 7.4 },
      { name: "Kanasín (Yuc.)", towns: ["kanasin"], change: 11.4 },
      { name: "Manzanillo (Col.)", towns: ["manzanillo"], change: 7.4 },
      { name: "Benito Juárez (Q.Roo) — Cancún", towns: ["cancun", "benito juarez"], requires: ["cancun", "quintana roo", "q roo", "q.roo"], change: 11.4 },
      { name: "Emiliano Zapata (Mor.)", towns: ["emiliano zapata"], requires: ["morelos"], change: 7.4 },
      { name: "Huejotzingo (Pue.)", towns: ["huejotzingo"], change: 11.0 },
      { name: "Nacajuca (Tab.)", towns: ["nacajuca"], change: 7.2 },
      { name: "San Pedro Tlaquepaque (Jal.)", towns: ["tlaquepaque"], change: 11.0 },
      { name: "Zumpango (Méx.)", towns: ["zumpango"], change: 7.1 },
      { name: "Aguascalientes (Ags.)", towns: ["aguascalientes"], change: 10.7 },
      { name: "Campeche (Camp.)", towns: ["campeche"], change: 7.1 },
      { name: "Bahía de Banderas (Nay.) — Nuevo Vallarta / Punta Mita", towns: ["bahia de banderas", "nuevo vallarta", "punta mita", "punta de mita"], change: 10.7 },
      { name: "Zihuatanejo de Azueta (Gro.)", towns: ["zihuatanejo"], change: 7.0 },
      { name: "Guadalajara (Jal.)", towns: ["guadalajara"], change: 10.7 },
      { name: "Tlacolula de Matamoros (Oax.)", towns: ["tlacolula"], change: 7.0 },
      { name: "Tepic (Nay.)", towns: ["tepic"], change: 10.4 },
      { name: "Tuxtla Gutiérrez (Chis.)", towns: ["tuxtla gutierrez"], change: 6.9 },
      { name: "Mexicali (B.C.)", towns: ["mexicali"], change: 10.4 },
      { name: "Carmen (Camp.) — Ciudad del Carmen", towns: ["ciudad del carmen"], requires: ["ciudad del carmen", "campeche"], change: 6.9 },
      { name: "Zapopan (Jal.)", towns: ["zapopan"], change: 10.2 },
      { name: "Monterrey (N.L.)", towns: ["monterrey"], change: 6.9 },
      { name: "Juárez (N.L.)", towns: ["juarez"], requires: ["nuevo leon"], change: 10.0 },
      { name: "San Luis Potosí (S.L.P.)", towns: ["san luis potosi"], change: 6.7 },
      { name: "Mineral de la Reforma (Hgo.)", towns: ["mineral de la reforma"], change: 9.9 },
      { name: "Acapulco de Juárez (Gro.)", towns: ["acapulco"], change: 6.7 },
      { name: "La Paz (B.C.S.)", towns: ["la paz"], requires: ["baja california sur", "b.c.s", "bcs"], change: 9.8 },
      { name: "Veracruz (Ver.)", towns: ["veracruz"], change: 6.6 },
      { name: "Cajeme (Son.) — Ciudad Obregón", towns: ["cajeme", "ciudad obregon"], change: 9.8 },
      { name: "El Marqués (Qro.)", towns: ["el marques"], requires: ["queretaro"], change: 6.4 },
      { name: "Jesús María (Ags.)", towns: ["jesus maria"], requires: ["aguascalientes"], change: 9.7 },
      { name: "Guadalupe (Zac.)", towns: ["guadalupe"], requires: ["zacatecas"], change: 6.3 },
      { name: "Tijuana (B.C.)", towns: ["tijuana"], change: 9.7 },
      { name: "Gómez Palacio (Dgo.)", towns: ["gomez palacio"], change: 6.2 },
      { name: "Los Cabos (B.C.S.) — Cabo San Lucas / San José del Cabo", towns: ["los cabos", "cabo san lucas", "san jose del cabo"], change: 9.6 },
      { name: "Centro (Tab.) — Villahermosa", towns: ["villahermosa"], requires: ["villahermosa", "tabasco"], change: 6.1 },
      { name: "Mazatlán (Sin.)", towns: ["mazatlan"], change: 9.6 },
      { name: "Coatzacoalcos (Ver.)", towns: ["coatzacoalcos"], change: 6.0 },
      { name: "Mérida (Yuc.)", towns: ["merida"], change: 9.3 },
      { name: "Tecámac (Méx.)", towns: ["tecamac"], change: 5.6 },
      { name: "García (N.L.)", towns: ["garcia"], requires: ["nuevo leon"], change: 9.1 },
      { name: "San Juan Bautista Tuxtepec (Oax.)", towns: ["tuxtepec"], change: 5.4 },
      { name: "Hermosillo (Son.)", towns: ["hermosillo"], change: 9.1 },
      { name: "Querétaro (Qro.)", towns: ["queretaro"], change: 5.4 },
      { name: "Culiacán (Sin.)", towns: ["culiacan"], change: 9.0 },
      { name: "Corregidora (Qro.)", towns: ["corregidora"], change: 5.4 },
      { name: "Juárez (Chih.) — Ciudad Juárez", towns: ["ciudad juarez"], change: 8.8 },
      { name: "Zacatecas (Zac.)", towns: ["zacatecas"], requires: ["zacatecas"], change: 4.8 },
      { name: "Uruapan (Mich.)", towns: ["uruapan"], change: 8.7 },
      { name: "Metepec (Méx.)", towns: ["metepec"], change: 4.8 },
      { name: "Morelia (Mich.)", towns: ["morelia"], change: 8.5 },
      { name: "Toluca (Méx.)", towns: ["toluca"], change: 4.7 },
      { name: "Puebla (Pue.)", towns: ["puebla"], change: 8.5 },
      { name: "Durango (Dgo.)", towns: ["durango"], change: 4.7 },
      { name: "Villa de Álvarez (Col.)", towns: ["villa de alvarez"], change: 8.4 },
      { name: "Iztapalapa (CDMX)", towns: ["iztapalapa"], change: 4.2 },
      { name: "Chihuahua (Chih.)", towns: ["chihuahua"], requires: ["chihuahua"], change: 8.3 },
      { name: "Apizaco (Tlax.)", towns: ["apizaco"], change: 4.2 },
      { name: "Tizayuca (Hgo.)", towns: ["tizayuca"], change: 8.3 },
      { name: "Cuauhtémoc (CDMX)", towns: ["cuauhtemoc"], requires: ["cdmx", "ciudad de mexico", "mexico city", "distrito federal"], change: 4.2 },
      { name: "Apodaca (N.L.)", towns: ["apodaca"], change: 8.2 },
      { name: "Tlaxcala (Tlax.)", towns: ["tlaxcala"], change: 4.1 },
      { name: "Torreón (Coah.)", towns: ["torreon"], change: 7.9 },
      { name: "Benito Juárez (CDMX)", towns: ["benito juarez"], requires: ["cdmx", "ciudad de mexico", "mexico city", "distrito federal"], change: 4.1 },
      { name: "Celaya (Gto.)", towns: ["celaya"], change: 7.9 },
      { name: "Miguel Hidalgo (CDMX)", towns: ["miguel hidalgo"], requires: ["cdmx", "ciudad de mexico", "mexico city", "distrito federal"], change: 4.1 },
      { name: "Soledad de Graciano Sánchez (S.L.P.)", towns: ["soledad de graciano sanchez"], change: 7.9 },
      { name: "Gustavo A. Madero (CDMX)", towns: ["gustavo a madero", "gustavo madero"], requires: ["cdmx", "ciudad de mexico", "mexico city", "distrito federal"], change: 4.1 }
    ]
  },
  brazil: {
    country: "Brazil",
    period: "2026-09",
    nationalChangePercent: 5.51,
    benchmarkUnit: "perSqm",
    coverageNote: "FipeZap (FIPE + the ZAP real estate listings site) is Brazil's most widely cited house-price benchmark, not a government statistic — no official government equivalent could be confirmed. FipeZap is monthly, not quarterly; September 2026's release put the trailing-12-month change at 5.51% (month itself +0.58%, the strongest since August's 0.53%). Reported via secondary coverage (FIPE's own release page wasn't directly opened), so treat the exact decimal as indicative rather than final.",
    source: "FipeZap Index (Fundação Instituto de Pesquisas Econômicas) — September 2026 release (trailing 12 months)",
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
    period: "2026-Q1",
    nationalChangePercent: null,
    cityName: "Buenos Aires (CABA)",
    cityChangePercent: 4.6,
    benchmarkUnit: "perSqm",
    coverageNote: "Figure covers the City of Buenos Aires only (CABA); no verified nationwide government figure. Q1 2026 reported via a single secondary outlet (Nueva Ciudad) citing IDECBA's own report directly — not independently cross-confirmed by a second outlet the way Albania's update was, so treat this one figure with a little more caution than most entries here.",
    source: "Instituto de Estadística y Censos de la Ciudad de Buenos Aires (IDECBA) — apartment price survey, Q1 2026",
    officialSource: "https://www.estadisticaciudad.gob.ar/"
  },
  chile: {
    country: "Chile",
    period: "2026-Q1",
    nationalChangePercent: 2.4,
    benchmarkUnit: "perSqm",
    coverageNote: "Houses +4.3% YoY, apartments +0.8% YoY this quarter (index base 2008=100: houses 226.6, apartments 218.9, general 222.5). By zone: Macrozona Sur +7.0%, Macrozona Centro +2.6%, Región Metropolitana +2.1%, Macrozona Norte -6.1%. Confirmed directly from the Banco Central's own IPV page (screenshotted by the user, Oct 27 2026) — this one is primary-sourced, not a secondary citation.",
    source: "Banco Central de Chile — Índice de Precios de Vivienda (IPV), Q1 2026",
    officialSource: "https://www.bcentral.cl/en/areas/estadisticas/estadisticas-experimentales/ipv"
  },
  colombia: {
    country: "Colombia",
    period: "2026-Q2",
    nationalChangePercent: 8.8,
    benchmarkUnit: "perSqm",
    coverageNote: "New-housing index only. National year-on-year figure (8.80%, down from 10.02% in Q2 2025) reported by El Nuevo Siglo citing DANE's IPVN bulletin directly. DANE's own quarter-on-quarter breakdown by type (houses +3.68%, apartments +2.37% vs Q1 2026) is official but is NOT the same metric as the year-on-year figure stored here, so it's deliberately left out rather than mixed in.",
    source: "DANE — Índice de Precios de Vivienda Nueva (IPVN), Q2 2026",
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
  "puerto rico": {
    country: "Puerto Rico",
    period: "2026-Q2",
    nationalChangePercent: 0.94,
    benchmarkUnit: "total",
    coverageNote: "FHFA's All-Transactions House Price Index (repeat-sales of financed single-family home purchases) — an index/trend only, no absolute price level published for Puerto Rico. Index value 258.95, up from 256.53 a year earlier; down from 287.93 the prior quarter (methodology volatility at this sample size, not a literal one-quarter price drop).",
    source: "Federal Housing Finance Agency (FHFA) — House Price Index, Puerto Rico, Q2 2026",
    officialSource: "https://www.fhfa.gov/data/hpi"
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
    period: "2025-12",
    // MLIT 不動産価格指数（住宅）, original series, all residential, Japan:
    // 145.05 vs 137.81 a year earlier (lib/data/japanPrices.json). MLIT
    // publishes no price level → none here (the old "¥36 million average
    // home" had no source and was removed).
    nationalChangePercent: 5.3,
    benchmarkUnit: "total",
    coverageNote: "Change of MLIT's residential price index (all residential property, from registered transactions); condominiums +8.4%, detached houses +3.0%.",
    source: "Ministry of Land, Infrastructure, Transport and Tourism (MLIT) — Real Estate Price Index (residential), December 2025",
    officialSource: "https://www.mlit.go.jp/totikensangyo/totikensangyo_tk5_000085.html"
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
      // Most regions here carry a €/m² price level (val); a few (e.g.
      // Mexico's municipal breakdown) only have a year-on-year change,
      // with no price level at all — val stays null/undefined there, so
      // this branches to a plain percent sentence instead of the
      // level-shaped one, rather than leaving a dangling "Name: ." when
      // val is missing.
      const noteAddition = val != null
        ? ` ${r.name}${typeWord}: ${cur}${val.toLocaleString("en-US")}/m²${r.note ? ` (${r.note})` : ""}${r.prev != null ? ` (a year earlier: ${cur}${r.prev.toLocaleString("en-US")}/m²)` : ""}${chg == null && !fixture.typeChanges ? " — the change is not shown: too few sales for a stable comparison" : ""}.`
        : chg != null
          ? ` ${r.name}: ${chg > 0 ? "+" : ""}${chg}% year-on-year${r.note ? ` (${r.note})` : ""}.`
          : "";
      Object.assign(fixture, { cityName: r.name, cityBenchmarkValue: val, cityChangePercent: chg, regionMatch: true,
        coverageNote: `${fixture.coverageNote}${noteAddition}` });
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
      districts: fixture.districts ?? null,
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
