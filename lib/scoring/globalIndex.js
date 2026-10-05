/* PRADIXIUM™ — Global Index
 * A cross-country ranking of current investment conditions, built the
 * same way as every other Pradixium data feature: real, sourced figures
 * only, degrading gracefully (excluding a country from a component,
 * never guessing) when a figure isn't available.
 *
 * IMPORTANT — what this is and isn't: this ranks CURRENT, REAL conditions
 * (recent price trend, foreign-buyer access, capital-transfer flexibility,
 * one-time cost of entry, annual holding cost). It is NOT a forecast. It
 * never predicts future prices, and "undervalued" claims are only ever
 * shown when a named, credible third-party source (a central bank or a
 * major real-estate advisory firm) explicitly said so — never Pradixium's
 * own inference. Same discipline as lib/scoring/pradixiumScore.js: a
 * component only counts when real data backs it, and the remaining
 * weights are rebalanced around what's missing rather than padding a
 * thin dataset into a fake full score.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Same mapping as pradixiumScore.js's trendScore() for consistency: 0% →
// neutral 50, each point of YoY growth worth 3 points, capped 0-100.
// A positive trend scores higher — this is a "healthy, growing market"
// signal, not a claim that growth will continue.
function trendScore(trendPercent) {
  if (trendPercent == null || !Number.isFinite(trendPercent)) return null;
  return clamp(50 + trendPercent * 3, 0, 100);
}

// Extracts the first percentage figure from a free-text rate string (e.g.
// "~7%-10% of price..." -> 8.5, the midpoint of the first range found).
// Handles the real "None" / zero-tax entries (Malta, Cyprus, Cayman
// Islands, Monaco) as a genuine 0, not a parse failure. Returns null
// (component excluded, not guessed) when the text has no extractable
// number — e.g. New Zealand's and the UK's closing-cost text, which are
// flat-fee/banded descriptions rather than a percentage of price.
function parsePercent(text) {
  if (!text) return null;
  if (/^none\b/i.test(text.trim())) return 0;
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => parseFloat(m[1]));
  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];
  // A range like "7%-10%" or "1.5%-3%" — use the midpoint of the first
  // two numbers found.
  if (nums.length === 2) return (nums[0] + nums[1]) / 2;
  // 3+ percentages: many totalEstimatedRange strings add a necessary cost
  // component on top of the headline range ("2%-8% transfer tax + ~1%-3%
  // notary"), where the first two alone silently drop that component and
  // understate the real cost. There's no reliable way to tell that case
  // apart from a genuine "range + unrelated surcharge" from the text
  // alone, so this is "not enough verified evidence," not a guess.
  return null;
}

// Lower cost/tax is more attractive — inverted and scaled so a very low
// figure (near 0%) scores near 100 and a high one (10%+) scores low.
// capAt is the percentage treated as the "0-score" floor for that
// component (closing costs and annual property tax operate on very
// different natural scales, so each gets its own cap).
function inverseCostScore(percent, capAt) {
  if (percent == null) return null;
  return clamp(100 - (percent / capAt) * 100, 0, 100);
}

// Foreign Buyer Access status -> a flexibility score. A country with no
// entry in foreignBuyerRules.js hasn't been confirmed either way — FIX:
// this used to default that case to a neutral-positive 70, which meant an
// unresearched country scored BETTER on this component than a genuinely
// open market we'd actually verified (which could score in the same
// range for real reasons). That rewards not having researched a country
// yet — the opposite of this project's whole discipline. Excluded (null)
// instead, same "drop rather than guess" rule as every other data module
// here; the composite score rebalances its weights around what's
// actually known for that country (see confidence/dataCoverage below).
function foreignBuyerFlexibilityScore(rule) {
  if (!rule) return null;
  if (rule.status === "RESTRICTED") return 15;
  if (rule.status === "WORKAROUND REQUIRED") return 50;
  return 85;
}

// Currency/capital-transfer controls -> a flexibility score. Same fix as
// foreignBuyerFlexibilityScore() above — unresearched is excluded, not
// guessed as neutral.
function currencyFlexibilityScore(controls) {
  if (!controls) return null;
  if (!controls.requiresApproval) return 85;
  // Requires approval, but research found it liberalized/largely free in
  // practice (e.g. Argentina, South Africa) — a lighter penalty than an
  // outright block or hard quota.
  if (/liberali[sz]ed|largely free|free capital account/i.test(controls.status || "")) return 65;
  return 35;
}

const WEIGHTS = { trend: 0.25, foreignBuyer: 0.2, currency: 0.2, closingCost: 0.2, propertyTax: 0.15 };

/**
 * Computes one country's Global Index entry from already-fetched Pradixium
 * data modules — no live government API calls, so this can render a full
 * cross-country ranking instantly (the whole point of the feature).
 *
 * @param {object} args
 * @param {string} args.country - display name
 * @param {number|null} args.trendPercent - current YoY price trend, if known
 * @param {object|null} args.trendMeta - { period, source, sourceUrl, momentumNote }
 * @param {object|null} args.foreignBuyerRule - from getForeignBuyerRule()
 * @param {object|null} args.currencyControls - from getCurrencyControls()
 * @param {object|null} args.closingCosts - from getClosingCosts()
 * @param {object|null} args.propertyTax - from getPropertyTax()
 */
export function computeGlobalIndexEntry({ country, trendPercent, trendMeta, foreignBuyerRule, currencyControls, closingCosts, propertyTax }) {
  const closingCostPercent = parsePercent(closingCosts?.totalEstimatedRange);
  const propertyTaxPercent = parsePercent(propertyTax?.rate || propertyTax?.rateRange);

  const components = [
    { name: "trend", weight: WEIGHTS.trend, score: trendScore(trendPercent) },
    { name: "foreignBuyer", weight: WEIGHTS.foreignBuyer, score: foreignBuyerFlexibilityScore(foreignBuyerRule) },
    { name: "currency", weight: WEIGHTS.currency, score: currencyFlexibilityScore(currencyControls) },
    // Closing costs run from ~0% to ~12%+ worldwide — 12% treated as the
    // floor. Annual property tax runs on a much smaller natural scale
    // (mostly 0-3%) — 3% treated as its floor.
    { name: "closingCost", weight: WEIGHTS.closingCost, score: inverseCostScore(closingCostPercent, 12) },
    { name: "propertyTax", weight: WEIGHTS.propertyTax, score: inverseCostScore(propertyTaxPercent, 3) }
  ];

  const available = components.filter((c) => c.score != null);
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null; // no usable data at all for this country — excluded, not scored at 50

  const score = Math.round(available.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight);

  let confidence = "Low";
  if (totalWeight >= 0.8) confidence = "High";
  else if (totalWeight >= 0.45) confidence = "Medium";

  return {
    country,
    score: clamp(score, 0, 100),
    confidence,
    dataCoverage: Math.round(totalWeight * 100) / 100,
    components: available.map((c) => ({ name: c.name, score: Math.round(c.score), weight: c.weight })),
    trendPercent: trendPercent ?? null,
    trendPeriod: trendMeta?.period ?? null,
    trendSource: trendMeta?.source ?? null,
    trendSourceUrl: trendMeta?.sourceUrl ?? null,
    // Only ever populated when a named, credible third party explicitly
    // characterized the market this way — see the FIX note in
    // buildGlobalIndex()'s caller. Never Pradixium's own inference.
    momentumNote: trendMeta?.momentumNote ?? null,
    foreignBuyerStatus: foreignBuyerRule?.status ?? null,
    currencyControlStatus: currencyControls?.status ?? null,
    closingCostRange: closingCosts?.totalEstimatedRange ?? null,
    propertyTaxLabel: propertyTax?.shortLabel ?? null
  };
}
