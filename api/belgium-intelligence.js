/* PRADIXIUM™ — BELGIUM NATIONAL INTELLIGENCE ENGINE
 * Belgium is one of the 9 markets that used to share the generic Eurostat
 * national-trend-only adapter. Its own statistics office (Statbel) publishes
 * far more — median sale prices broken down by the three of Belgium's
 * regions (Brussels-Capital, Flanders, Wallonia) AND by property type
 * (apartment, attached/semi-detached house, detached house/villa) every
 * quarter. Statbel's raw open-data files are Excel workbooks (same
 * limitation already documented in api/greece-intelligence.js — this
 * project has no spreadsheet-parsing dependency), so this is a dated
 * fixture from Statbel's own published Q1 2026 release rather than a live
 * feed. Update BELGIUM_HPI by hand each quarter from
 * https://statbel.fgov.be/en/themes/housing/house-price-index
 * until a stable machine-readable feed (Statbel's "bestat" API does exist,
 * but its dataset/view IDs could not be confirmed from this environment)
 * can be wired in instead.
 */
const BELGIUM_HPI = {
  period: "2026-Q1",
  source: "Statbel — House prices, Q1 2026",
  officialSource: "https://statbel.fgov.be/en/themes/housing/house-price-index",
  national: { apartment: 257000, apartmentChangePercent: 3.2, attached: 285000, attachedChangePercent: -1.7, detached: 405000, detachedChangePercent: 2.5 },
  regions: {
    "Brussels-Capital Region": { apartment: 275000, apartmentChangePercent: 5.4, attached: 543500, attachedChangePercent: 3.5, detached: 1487500, detachedChangePercent: 50.6, detachedNote: "Very few detached-house sales in Brussels — this figure is volatile and not a reliable benchmark." },
    "Flanders": { apartment: 265000, apartmentChangePercent: 3.4, attached: 321318, attachedChangePercent: 0.4, detached: 450000, detachedChangePercent: 4.7 },
    "Wallonia": { apartment: 195000, apartmentChangePercent: 2.6, attached: 200000, attachedChangePercent: 0.0, detached: 335000, detachedChangePercent: 0.6 }
  }
};

const BRUSSELS_MUNICIPALITIES = [
  "brussels", "bruxelles", "brussel", "anderlecht", "auderghem", "oudergem",
  "berchem-sainte-agathe", "sint-agatha-berchem", "etterbeek", "evere",
  "forest", "vorst", "ganshoren", "ixelles", "elsene", "jette", "koekelberg",
  "molenbeek", "saint-gilles", "sint-gillis", "saint-josse", "sint-joost",
  "schaerbeek", "schaarbeek", "uccle", "ukkel", "watermael-boitsfort",
  "watermaal-bosvoorde", "woluwe"
];

const FLANDERS_CITIES = [
  "antwerp", "antwerpen", "ghent", "gent", "bruges", "brugge", "leuven",
  "mechelen", "hasselt", "kortrijk", "aalst", "ostend", "oostende",
  "sint-niklaas", "genk", "roeselare", "turnhout"
];

const WALLONIA_CITIES = [
  "liege", "liège", "luik", "charleroi", "namur", "namen", "mons", "bergen",
  "tournai", "doornik", "verviers", "la louviere", "la louvière", "mouscron",
  "seraing", "wavre"
];

// Statbel's regional median is a citywide/regional average — it has no
// street-level breakdown for Belgium (unlike France's DVF, which has real
// nearby-transaction data down to street level). Comparing a handful of
// well-known prime/diplomatic Brussels streets against that flat regional
// number produces a nonsensical "massively overpriced" read for a
// legitimately expensive address (e.g. an Avenue Louise apartment against
// a €275,000 Brussels-Capital-wide median). Same honesty problem already
// solved for Paris (Triangle d'Or) and the U.S. (Bal Harbour, Beverly
// Hills, etc.) — flag the zone so the orchestrator can suppress the
// misleading numeric comparison instead of asserting one.
const BRUSSELS_PRIME_ZONES = [
  { test: /avenue louise|louizalaan/i, zone: "Avenue Louise", note: "Prime shopping and diplomatic district — comparable to Knightsbridge (London) or the Champs-Élysées (Paris)." },
  { test: /sablon|zavel/i, zone: "Sablon / Grand Sablon", note: "Antiques and luxury district in central Brussels." },
  { test: /square.*ambiorix|avenue.*palmerston|rue.*archim[eè]de|quartier.*europ[eé]en|rond[- ]?point schuman|rue.*froissart/i, zone: "European Quarter (Schuman)", note: "EU institutions and diplomatic corps district." },
  { test: /avenue franklin roosevelt|avenue foch/i, zone: "Avenue Franklin Roosevelt (Uccle)", note: "Prestige residential avenue bordering the Bois de la Cambre." }
];

function brusselsPrimeSignal(address) {
  const s = String(address || "");
  for (const z of BRUSSELS_PRIME_ZONES) {
    if (z.test.test(s)) return { isPrime: true, zone: z.zone, note: z.note };
  }
  return { isPrime: false, zone: null, note: null };
}

function regionFor(city) {
  const c = String(city || "").trim().toLowerCase();
  if (!c) return null;
  if (BRUSSELS_MUNICIPALITIES.some((name) => c.includes(name))) return "Brussels-Capital Region";
  if (FLANDERS_CITIES.some((name) => c.includes(name))) return "Flanders";
  if (WALLONIA_CITIES.some((name) => c.includes(name))) return "Wallonia";
  return null;
}

// Maps this project's Property Type field onto Statbel's own three
// categories. Land has no equivalent in a residential-sale HPI, so it
// deliberately resolves to no benchmark rather than a wrong one.
function bucketFor(propertyType) {
  const t = String(propertyType || "").trim().toLowerCase();
  if (t.includes("apartment")) return "apartment";
  if (t.includes("townhouse")) return "attached";
  if (t.includes("house") || t.includes("villa")) return "detached";
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const city = String(req.query?.city || "").trim() || null;
  const propertyType = String(req.query?.propertyType || "").trim() || null;
  const region = regionFor(city);
  const bucket = bucketFor(propertyType);
  const regionData = region ? BELGIUM_HPI.regions[region] : null;
  const prestige = brusselsPrimeSignal(city);

  const medianPrice = bucket ? (regionData ? regionData[bucket] : BELGIUM_HPI.national[bucket]) ?? null : null;
  const changePercent = bucket
    ? (regionData ? regionData[`${bucket}ChangePercent`] : BELGIUM_HPI.national[`${bucket}ChangePercent`]) ?? null
    : null;
  const volatilityNote = region && bucket === "detached" ? regionData?.detachedNote || null : null;

  return res.status(200).json({
    success: true,
    country: "Belgium",
    city,
    data: {
      market: "Belgium Residential Property Market",
      period: BELGIUM_HPI.period,
      region,
      prestige,
      propertyTypeBucket: bucket,
      medianPrice,
      annualChangePercent: changePercent,
      nationalMedianPrice: bucket ? BELGIUM_HPI.national[bucket] ?? null : null,
      nationalAnnualChangePercent: bucket ? BELGIUM_HPI.national[`${bucket}ChangePercent`] ?? null : null,
      volatilityNote,
      unit: "Median sale price (deed of sale), whole property",
      cityLevelStatus: region ? "REGION_LEVEL_AVAILABLE" : "REGIONAL_DATA_LAYER_PENDING",
      cityLevelNote: region
        ? "Statbel publishes this breakdown at the regional level (Brussels-Capital / Flanders / Wallonia), not per-municipality — a municipality-level government feed is not yet connected."
        : "City could not be matched to a Belgian region — showing the national median instead.",
      sources: { statbel: BELGIUM_HPI.source },
      sourceUrls: { statbel: BELGIUM_HPI.officialSource },
      coverage: "Regional/national median sale price by property type — a dated static release, not a live feed. Verify against the official source before relying on it for a current quarter."
    }
  });
}
