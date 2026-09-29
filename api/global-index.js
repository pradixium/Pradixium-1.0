/* PRADIXIUM™ — Global Index endpoint
 * Ranks every market Pradixium has real, sourced data for by current
 * investment conditions (see lib/scoring/globalIndex.js for the full
 * "what this is and isn't" disclaimer — this is not a price forecast).
 *
 * Every input here is a static, already-vetted Pradixium data module — no
 * live government API calls — so this responds instantly, which is the
 * point: an investor should see the full cross-country ranking the
 * moment they ask, not wait on a chain of per-country fetches.
 */
import { getForeignBuyerRule } from "../lib/data/foreignBuyerRules.js";
import { getCurrencyControls } from "../lib/data/currencyControls.js";
import { getClosingCosts } from "../lib/data/closingCosts.js";
import { getPropertyTax } from "../lib/data/propertyTax.js";
import { getRegionalFixture } from "./regional-fixture-intelligence.js";
import { getGlobalIndexTrend } from "../lib/data/globalIndexTrends.js";
import { computeGlobalIndexEntry } from "../lib/scoring/globalIndex.js";

// The full set of markets in the country dropdown (index.html). Kept as
// its own list (rather than parsed from index.html at request time)
// because a serverless function shouldn't depend on reading an unrelated
// static asset off disk — this is the same country set, just declared
// here directly.
const COUNTRIES = {
  albania: "Albania", andorra: "Andorra", argentina: "Argentina", armenia: "Armenia", australia: "Australia",
  austria: "Austria", azerbaijan: "Azerbaijan", bahamas: "Bahamas", barbados: "Barbados", belarus: "Belarus",
  belgium: "Belgium", bolivia: "Bolivia", "bosnia and herzegovina": "Bosnia and Herzegovina", brazil: "Brazil",
  bulgaria: "Bulgaria", cambodia: "Cambodia", canada: "Canada", "cayman islands": "Cayman Islands", chile: "Chile",
  colombia: "Colombia", croatia: "Croatia", cyprus: "Cyprus", "czech republic": "Czech Republic", denmark: "Denmark",
  "dominican republic": "Dominican Republic", ecuador: "Ecuador", estonia: "Estonia", finland: "Finland",
  france: "France", georgia: "Georgia", germany: "Germany", greece: "Greece", hungary: "Hungary", iceland: "Iceland",
  india: "India", indonesia: "Indonesia", ireland: "Ireland", israel: "Israel", italy: "Italy", jamaica: "Jamaica",
  japan: "Japan", kazakhstan: "Kazakhstan", kosovo: "Kosovo", kyrgyzstan: "Kyrgyzstan", latvia: "Latvia",
  liechtenstein: "Liechtenstein", lithuania: "Lithuania", luxembourg: "Luxembourg", maldives: "Maldives",
  malta: "Malta", mexico: "Mexico", moldova: "Moldova", monaco: "Monaco", montenegro: "Montenegro",
  netherlands: "Netherlands", "new zealand": "New Zealand", "north macedonia": "North Macedonia", norway: "Norway",
  paraguay: "Paraguay", peru: "Peru", poland: "Poland", portugal: "Portugal", "puerto rico": "Puerto Rico",
  romania: "Romania", russia: "Russia", "san marino": "San Marino", serbia: "Serbia", slovakia: "Slovakia",
  slovenia: "Slovenia", "south korea": "South Korea", spain: "Spain", "sri lanka": "Sri Lanka", sweden: "Sweden",
  switzerland: "Switzerland", tajikistan: "Tajikistan", thailand: "Thailand",
  "trinidad and tobago": "Trinidad and Tobago", turkmenistan: "Turkmenistan", ukraine: "Ukraine",
  "united arab emirates": "United Arab Emirates", "united kingdom": "United Kingdom", "united states": "United States",
  uruguay: "Uruguay", "south africa": "South Africa", morocco: "Morocco", kenya: "Kenya", nigeria: "Nigeria", egypt: "Egypt", uzbekistan: "Uzbekistan", vietnam: "Vietnam"
};

function resolveTrend(key) {
  const fixture = getRegionalFixture(key);
  if (fixture) {
    const percent = fixture.cityChangePercent ?? fixture.nationalChangePercent ?? null;
    if (percent != null) {
      return { percent, meta: { period: fixture.period, source: fixture.source, sourceUrl: fixture.officialSource } };
    }
  }
  const curated = getGlobalIndexTrend(key);
  if (curated) {
    return {
      percent: curated.trendPercent,
      meta: { period: curated.trendPeriod, source: curated.trendSource, sourceUrl: curated.trendSourceUrl, momentumNote: curated.momentumNote }
    };
  }
  return { percent: null, meta: null };
}

function buildIndex() {
  const entries = [];
  for (const [key, name] of Object.entries(COUNTRIES)) {
    const { percent, meta } = resolveTrend(key);
    const entry = computeGlobalIndexEntry({
      country: name,
      trendPercent: percent,
      trendMeta: meta,
      foreignBuyerRule: getForeignBuyerRule(key),
      currencyControls: getCurrencyControls(key),
      closingCosts: getClosingCosts(key),
      propertyTax: getPropertyTax(key)
    });
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const ranked = buildIndex();

  const byComponent = (name) => [...ranked]
    .filter((e) => e.components.some((c) => c.name === name))
    .sort((a, b) => {
      const av = a.components.find((c) => c.name === name).score;
      const bv = b.components.find((c) => c.name === name).score;
      return bv - av;
    });

  // FIX: a country scored from a single thin component (e.g. only real
  // data was closing costs, which happened to be low) could out-rank a
  // country genuinely strong across trend + flexibility + cost — the
  // composite average doesn't know it's comparing a 1-component score to
  // a 4-component one. "topMarkets" is the honest headline ranking:
  // Medium/High confidence only (at least ~45% of the weighted model has
  // real data behind it). "overall" keeps the full list, thin data and
  // all, for a complete table where confidence is shown per row rather
  // than implied by rank position.
  const topMarkets = ranked.filter((e) => e.confidence !== "Low").slice(0, 20);

  return res.status(200).json({
    success: true,
    generatedNote: "Ranks current, real, sourced conditions only — not a price forecast. See each country's cited sources before relying on this for an investment decision.",
    countriesCovered: ranked.length,
    countriesTotal: Object.keys(COUNTRIES).length,
    topMarkets,
    overall: ranked,
    mostFlexible: byComponent("foreignBuyer").slice(0, 10),
    lowestCostOfEntry: byComponent("closingCost").slice(0, 10),
    strongestMomentum: byComponent("trend").slice(0, 10)
  });
}
