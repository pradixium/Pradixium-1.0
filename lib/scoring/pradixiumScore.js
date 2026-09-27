/* PRADIXIUM™ — Pradixium Score engine
 * A deterministic, weighted, reproducible score — not an LLM guess. The
 * agent (see lib/agents/propertyInvestmentAgent.js) is handed this
 * number and explains it in plain language; it never invents its own.
 *
 * Every component below is optional and only enters the weighted average
 * when its underlying data is actually present, re-normalizing the
 * remaining weights so a thin dataset never gets silently padded to a
 * fake full score.
 */

const SQFT_PER_SQM = 10.7639;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Net yield uses the same flat 22% operating-expense assumption already
// shown to the user as "Net Yield" in the rule-based figures (engine.js),
// so the score always agrees with what's on screen.
//
// When the user hasn't typed in a rent, but the country adapter has a real
// government/open-data rental benchmark (e.g. France's data.gouv.fr commune
// rental dataset), estimate one instead of leaving yield blank — clearly
// flagged as estimated so the UI can label it, never silently blended in
// with a real user-provided figure.
function yieldMetrics(property, marketEvidence) {
  const { price, size } = property || {};
  let monthlyRent = property?.monthlyRent || null;
  let estimated = false;

  if (!monthlyRent && size && marketEvidence?.rentalBenchmark?.monthlyRentPerSqm) {
    monthlyRent = marketEvidence.rentalBenchmark.monthlyRentPerSqm * size;
    estimated = true;
  } else if (!monthlyRent && marketEvidence?.rentalBenchmark?.monthlyRentFlat) {
    // Some sources (e.g. the UK's ONS average rent by region) publish a
    // flat average rent for the whole area rather than a per-m² rate —
    // same as how the UK's own price benchmark is a "total" average
    // price, not perSqm. Used directly, not multiplied by size.
    monthlyRent = marketEvidence.rentalBenchmark.monthlyRentFlat;
    estimated = true;
  }

  if (!price || !monthlyRent) return null;
  const annualRent = monthlyRent * 12;
  const gross = (annualRent / price) * 100;
  const net = ((annualRent - annualRent * 0.22) / price) * 100;
  return { grossYieldPercent: gross, netYieldPercent: net, monthlyRent, estimated };
}

function yieldScore(net) {
  if (net == null || !Number.isFinite(net)) return null;
  // 6% net yield → 100, 0% or below → 0, linear between.
  return clamp((net / 6) * 100, 0, 100);
}

// Compares the asking price against the government benchmark in
// comparable units. benchmarkUnit is whatever normalizeMarketEvidence()
// (api/orchestrator.js) assigned: perSqm, perSqft, or total (a whole-
// property average, e.g. UK's HPI average price — not a rate, so it's
// compared directly to the asking price rather than to a price/area).
function valueGapPercent(property, marketEvidence) {
  if (!marketEvidence || marketEvidence.benchmarkValue == null) return null;
  const { price, size } = property || {};
  if (!price) return null;

  const { benchmarkValue, benchmarkUnit } = marketEvidence;
  let comparableAskingValue;
  let comparableBenchmarkValue = benchmarkValue;

  if (benchmarkUnit === "total") {
    comparableAskingValue = price;
  } else {
    if (!size) return null;
    comparableAskingValue = price / size;
    if (benchmarkUnit === "perSqft") {
      comparableAskingValue = comparableAskingValue / SQFT_PER_SQM;
    }
  }

  if (!comparableBenchmarkValue) return null;
  // Positive = asking price is below the government benchmark (a good sign).
  return ((comparableBenchmarkValue - comparableAskingValue) / comparableBenchmarkValue) * 100;
}

function valueGapScore(gapPercent) {
  if (gapPercent == null || !Number.isFinite(gapPercent)) return null;
  // At market (0% gap) → 50 (neutral). Each point below/above market
  // moves the score 2 points, capped at the 0–100 range.
  return clamp(50 + gapPercent * 2, 0, 100);
}

// Government YoY price-change data (Statbel, Destatis, Istat, INE Portugal,
// Bank of Greece, CBS Israel, Dubai Land Department, Eurostat, FHFA state
// HPI, and the regional fixtures) is already fetched and shown as text in
// Market Evidence for most countries, but was never used in the score —
// it's real, sourced momentum data, valid even when a street-level price
// benchmark can't be trusted (e.g. a prime Brussels address vs. a citywide
// median). 0% change → 50 (neutral); each point of YoY change moves the
// score 3 points, capped at the 0-100 range.
function trendScore(trendPercent) {
  if (trendPercent == null || !Number.isFinite(trendPercent)) return null;
  return clamp(50 + trendPercent * 3, 0, 100);
}

const DEMAND_STRENGTH_SCORES = {
  "VERY STRONG": 90,
  STRONG: 75,
  MODERATE: 55,
  LIMITED: 35
};

function demandScore(demand) {
  if (!demand || !demand.strength) return null;
  return DEMAND_STRENGTH_SCORES[String(demand.strength).toUpperCase()] ?? null;
}

/**
 * @param {object} args
 * @param {object} args.property - { price, size, monthlyRent }
 * @param {object|null} args.marketEvidence - normalized shape from api/orchestrator.js
 * @param {object|null} args.demand - marketData.demand, when the country adapter has it
 * @returns {{ score: number, confidence: 'Low'|'Medium'|'High', breakdown: object }}
 */
export function computePradixiumScore({ property, marketEvidence, demand }) {
  const yields = yieldMetrics(property, marketEvidence);
  const gapPercent = valueGapPercent(property, marketEvidence);

  const components = [
    // An estimated rent (no figure entered, filled from a government
    // rental benchmark instead) counts for less than one the user
    // actually confirmed — half weight, reflected in confidence below.
    { name: "yield", weight: yields?.estimated ? 0.15 : 0.3, score: yieldScore(yields?.netYieldPercent) },
    { name: "valueVsMarket", weight: 0.35, score: valueGapScore(gapPercent) },
    { name: "demand", weight: 0.15, score: demandScore(demand) },
    // Available for far more countries than the two above — most of the
    // site's coverage only has a national/regional government price-trend
    // figure, not a street-level benchmark or a rental dataset. Without
    // this, those reports had zero usable components and always landed on
    // a flat, uninformative 50.
    { name: "priceTrend", weight: 0.2, score: trendScore(marketEvidence?.priceTrendPercent) }
  ];

  const available = components.filter((c) => c.score != null);
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const componentAverage = totalWeight > 0
    ? available.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
    : 50; // No comparable data at all — neutral, not a guess in either direction.

  // FIX: with only one thin component available (e.g. just yield, no price
  // benchmark and no demand data), the score used to equal that single
  // component outright — a 5.9% net yield alone produced a 99/100
  // "Excellent" for a property nothing else had been checked on. Blending
  // toward neutral (50) by how much of the model is actually unassessed
  // means thin data pulls the score toward "unsure", not toward an extreme.
  const score = Math.round(componentAverage * totalWeight + 50 * (1 - totalWeight));

  // Confidence reflects how much of the weighted model actually had real
  // data behind it, not just whether the LLM "felt" confident.
  let confidence = "Low";
  if (totalWeight >= 0.7) confidence = "High";
  else if (totalWeight >= 0.35) confidence = "Medium";

  return {
    score: clamp(score, 0, 100),
    confidence,
    breakdown: {
      netYieldPercent: yields?.netYieldPercent ?? null,
      grossYieldPercent: yields?.grossYieldPercent ?? null,
      estimatedMonthlyRent: yields?.estimated ? yields.monthlyRent : null,
      rentIsEstimated: Boolean(yields?.estimated),
      valueGapPercent: gapPercent,
      priceTrendPercent: marketEvidence?.priceTrendPercent ?? null,
      components: available.map((c) => ({ name: c.name, score: Math.round(c.score), weight: c.weight })),
      dataCoverage: Math.round(totalWeight * 100) / 100
    }
  };
}
