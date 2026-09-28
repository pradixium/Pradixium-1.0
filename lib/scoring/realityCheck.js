/* PRADIXIUM™ — Reality Check™
 * "The real estate market doesn't need more dreams. It needs a reality
 * check." Don't buy the dream — check the reality.
 *
 * This is not a new data source and not an LLM opinion. It re-reads the
 * same evidence Pradixium already gathered for this report — the
 * deterministic Pradixium Score components (lib/scoring/pradixiumScore.js),
 * Foreign Buyer Access, and Estimated Closing Costs — and asks a narrower
 * question than the Score does: not "how good is this deal on a 0-100
 * scale," but "does the evidence actually support the story, or does
 * something here not add up?"
 *
 * Same honesty discipline as every other scoring module in this project:
 * a check only runs when real data backs it, and with too few checks
 * available the honest verdict is "not enough verified evidence yet" —
 * never a forced PASS just because nothing came back FAIL.
 */

// Same parsing convention as lib/scoring/globalIndex.js's parsePercent() —
// duplicated locally rather than shared, so this module (like that one)
// stays self-contained and doesn't create a cross-scoring-module coupling
// for a five-line helper.
function parsePercent(text) {
  if (!text) return null;
  if (/^none\b/i.test(String(text).trim())) return 0;
  const nums = [...String(text).matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => parseFloat(m[1]));
  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}

// Positive valueGapPercent = asking price is BELOW the government/market
// benchmark (good). A large negative gap means the evidence Pradixium
// actually gathered doesn't support the asking price — the core of what
// "Reality Check" means.
function valuationCheck(valueGapPercent) {
  if (valueGapPercent == null || !Number.isFinite(valueGapPercent)) return null;
  if (valueGapPercent >= -10) {
    return { id: "valuation", result: "PASS", valueGapPercent };
  }
  if (valueGapPercent >= -20) {
    return { id: "valuation", result: "WARN", valueGapPercent };
  }
  return { id: "valuation", result: "FAIL", valueGapPercent };
}

// Net yield uses the same figure already shown as "Net Yield" everywhere
// else in the report (lib/scoring/pradixiumScore.js) — a negative or
// negligible net yield means the rental-income story doesn't stand up.
function yieldCheck(netYieldPercent) {
  if (netYieldPercent == null || !Number.isFinite(netYieldPercent)) return null;
  if (netYieldPercent >= 3) return { id: "yield", result: "PASS", netYieldPercent };
  if (netYieldPercent >= 0) return { id: "yield", result: "WARN", netYieldPercent };
  return { id: "yield", result: "FAIL", netYieldPercent };
}

// Real government/market YoY price momentum — a sharply declining market
// is real risk to any appreciation assumption baked into the pitch, even
// when today's price and yield both look fine.
function momentumCheck(priceTrendPercent) {
  if (priceTrendPercent == null || !Number.isFinite(priceTrendPercent)) return null;
  if (priceTrendPercent >= 0) return { id: "momentum", result: "PASS", priceTrendPercent };
  if (priceTrendPercent >= -5) return { id: "momentum", result: "WARN", priceTrendPercent };
  return { id: "momentum", result: "FAIL", priceTrendPercent };
}

// A dealbreaker check, not a valuation one: if the country restricts
// foreign buyers outright, the numbers above may be irrelevant — the
// purchase itself may not be legally possible as planned. See
// lib/data/foreignBuyerRules.js for the status vocabulary.
function foreignAccessCheck(status) {
  if (!status) return null;
  const s = String(status).toUpperCase();
  if (s === "OPEN") return { id: "foreignAccess", result: "PASS", status: s };
  if (s === "RESTRICTED") return { id: "foreignAccess", result: "FAIL", status: s };
  // WORKAROUND REQUIRED, TAX SURCHARGE — buyable, but with real extra cost
  // or complexity a naive pitch may not have mentioned.
  return { id: "foreignAccess", result: "WARN", status: s };
}

// Friction check: very high entry costs paired with a thin yield mean it
// takes years of rent just to earn back what you paid to get in — a real
// cost the headline yield figure alone doesn't show.
function costOfEntryCheck(closingCosts, netYieldPercent) {
  const closingCostPercent = parsePercent(closingCosts?.totalEstimatedRange);
  if (closingCostPercent == null) return null;
  if (closingCostPercent > 12 && (netYieldPercent == null || netYieldPercent < 4)) {
    return { id: "costOfEntry", result: "FAIL", closingCostPercent, netYieldPercent };
  }
  if (closingCostPercent > 8) {
    return { id: "costOfEntry", result: "WARN", closingCostPercent, netYieldPercent };
  }
  return { id: "costOfEntry", result: "PASS", closingCostPercent, netYieldPercent };
}

// Separate from the PASS/FAIL verdict above, not a replacement for it. A
// gap this large (asking price far below the government/market benchmark —
// well beyond ordinary "good deal" territory) is unusual enough to call out
// on its own: it could be a genuine distressed sale (foreclosure,
// receivership, a motivated seller) or a sign something about the property
// doesn't match its listing. Either reading means "verify why," never
// "great, buy it" — in keeping with Reality Check's own philosophy, a
// suspiciously good number gets the same scrutiny as a suspiciously bad
// one. Uses only the same government-benchmark comparison Reality Check
// already computes — no external listings, no live auction feeds, nothing
// this project doesn't already source and cite.
const EXCEPTIONAL_VALUE_GAP_THRESHOLD = 35;
function exceptionalValueFlag(valueGapPercent) {
  if (valueGapPercent == null || !Number.isFinite(valueGapPercent)) return null;
  if (valueGapPercent < EXCEPTIONAL_VALUE_GAP_THRESHOLD) return null;
  return { valueGapPercent };
}

/**
 * @param {object} args
 * @param {object|null} args.pradixiumScore - from computePradixiumScore()
 * @param {object|null} args.foreignBuyerAccess - from getForeignBuyerRule()
 * @param {object|null} args.closingCosts - from getClosingCosts()
 * @returns {{ verdict: 'PASS'|'FAIL'|'INSUFFICIENT_DATA', checks: object[], checksConsidered: number, exceptionalValue: object|null }}
 */
export function computeRealityCheck({ pradixiumScore, foreignBuyerAccess, closingCosts }) {
  const b = pradixiumScore?.breakdown || {};
  const exceptionalValue = exceptionalValueFlag(b.valueGapPercent);

  const checks = [
    valuationCheck(b.valueGapPercent),
    yieldCheck(b.rentIsEstimated ? null : b.netYieldPercent), // a user-confirmed rent only — an estimated one is too thin a basis for a pass/fail verdict, same reasoning pradixiumScore.js applies by halving its weight.
    momentumCheck(b.priceTrendPercent),
    foreignAccessCheck(foreignBuyerAccess?.status),
    costOfEntryCheck(closingCosts, b.rentIsEstimated ? null : b.netYieldPercent) // same reasoning as yieldCheck() above — an estimated net yield can still silently flip this check's own PASS/FAIL, and through it the overall verdict, on a number the module elsewhere refuses to grade alone.
  ].filter(Boolean);

  // Same threshold logic as elsewhere in this project: too little real
  // evidence means the honest answer is "we don't know yet," not a
  // default verdict in either direction.
  if (checks.length < 2) {
    return { verdict: "INSUFFICIENT_DATA", checks, checksConsidered: checks.length, exceptionalValue };
  }

  const failCount = checks.filter((c) => c.result === "FAIL").length;
  const warnCount = checks.filter((c) => c.result === "WARN").length;

  let verdict;
  if (failCount >= 1) verdict = "FAIL";
  // The brand promise is a binary PASS/FAIL, not a three-way score — two or
  // more soft spots (WARN) without an outright FAIL still means the story
  // doesn't hold up cleanly enough to call it a clean PASS.
  else if (warnCount >= 2) verdict = "FAIL";
  else verdict = "PASS";

  return { verdict, checks, checksConsidered: checks.length, exceptionalValue };
}
