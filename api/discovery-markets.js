/* PRADIXIUM™ — Pradixium Discovery™, market list
 * Country/market-level explorer: merges the same two verified data sources
 * already used elsewhere on the site (lib/data/foreignBuyerRules.js's 191
 * countries, lib/data/globalIndexTrends.js's price-trend coverage) into one
 * list. Deliberately NOT a computed/ranked "best markets" score — Pradixium's
 * whole premise is that a buyer should see the real, sourced facts (can a
 * foreigner even buy here, and what's the market actually doing) and decide
 * for themselves, not trust a black-box number. Every field here traces back
 * to the same source files the paid report and the free Foreign Buyer
 * Checker already use, so this view can never drift out of sync with them.
 */
import { listForeignBuyerRules } from "../lib/data/foreignBuyerRules.js";
import { listGlobalIndexTrends } from "../lib/data/globalIndexTrends.js";

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const rules = listForeignBuyerRules();
  const trends = listGlobalIndexTrends();
  const trendsByKey = new Map(trends.map((t) => [normalizeCountry(t.country), t]));
  const seenKeys = new Set();

  const markets = rules.map((rule) => {
    const key = normalizeCountry(rule.country);
    seenKeys.add(key);
    const trend = trendsByKey.get(key);
    return {
      country: rule.country,
      foreignBuyerStatus: rule.status,
      foreignBuyerSummary: rule.summary,
      foreignBuyerExtraCost: rule.extraCost,
      foreignBuyerSource: rule.source,
      foreignBuyerSourceUrl: rule.sourceUrl,
      trendPercent: trend ? trend.trendPercent : null,
      trendPeriod: trend ? trend.trendPeriod : null,
      trendSource: trend ? trend.trendSource : null,
      trendSourceUrl: trend ? trend.trendSourceUrl : null,
      momentumNote: trend ? trend.momentumNote || null : null
    };
  });

  // Trend-only countries (a real, sourced price trend exists even though
  // this site hasn't yet researched that country's foreign-buyer rule) --
  // still real data, so still shown, just honestly marked as such rather
  // than silently dropped or guessed.
  for (const trend of trends) {
    const key = normalizeCountry(trend.country);
    if (seenKeys.has(key)) continue;
    markets.push({
      country: trend.country,
      foreignBuyerStatus: null,
      foreignBuyerSummary: null,
      foreignBuyerExtraCost: null,
      foreignBuyerSource: null,
      foreignBuyerSourceUrl: null,
      trendPercent: trend.trendPercent,
      trendPeriod: trend.trendPeriod,
      trendSource: trend.trendSource,
      trendSourceUrl: trend.trendSourceUrl,
      momentumNote: trend.momentumNote || null
    });
  }

  markets.sort((a, b) => a.country.localeCompare(b.country));

  return res.status(200).json({ success: true, markets });
}
