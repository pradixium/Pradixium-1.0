/* PRADIXIUM™ — AI Chat Assistant
 * A conversational front door onto data Pradixium already has — never a
 * general-knowledge chatbot bolted onto the site. Same discipline as
 * every other feature here: the model is only ever handed real, sourced
 * Pradixium data (the Global Index snapshot, and — when the user's
 * message names a country — that country's foreign-buyer rules,
 * currency controls, closing costs, property tax and recent transaction
 * price) and is explicitly instructed to say "Pradixium doesn't have
 * that data yet" rather than fall back on its own general knowledge for
 * anything specific (a number, a rate, a rule).
 *
 * POST body: { messages: [{ role: "user"|"assistant", content: string }] }
 * (the client keeps and resends the running conversation — this endpoint
 * is stateless, same pattern as api/orchestrator.js)
 */
import { getForeignBuyerRule } from "../lib/data/foreignBuyerRules.js";
import { getCurrencyControls } from "../lib/data/currencyControls.js";
import { getClosingCosts } from "../lib/data/closingCosts.js";
import { getPropertyTax } from "../lib/data/propertyTax.js";
import { getRecentTransactionPrice } from "../lib/data/recentTransactionPrices.js";
import { getRegionalFixture } from "./regional-fixture-intelligence.js";
import { getGlobalIndexTrend } from "../lib/data/globalIndexTrends.js";
import { computeGlobalIndexEntry } from "../lib/scoring/globalIndex.js";

// Same country list api/global-index.js uses, so a mention of any of
// these names in a chat message can be matched to real Pradixium data.
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
  uruguay: "Uruguay", uzbekistan: "Uzbekistan", vietnam: "Vietnam"
};

function detectCountries(text) {
  const lower = String(text || "").toLowerCase();
  const found = [];
  for (const [key, name] of Object.entries(COUNTRIES)) {
    if (lower.includes(key)) found.push({ key, name });
  }
  // Common aliases that don't match the display name directly.
  if (/\bus\b|usa|u\.s\./i.test(text) && !found.some((c) => c.key === "united states")) found.push({ key: "united states", name: "United States" });
  if (/\buk\b|u\.k\./i.test(text) && !found.some((c) => c.key === "united kingdom")) found.push({ key: "united kingdom", name: "United Kingdom" });
  if (/\budae\b|dubai/i.test(text) && !found.some((c) => c.key === "united arab emirates")) found.push({ key: "united arab emirates", name: "United Arab Emirates" });
  return found.slice(0, 5); // cap to keep the context bounded
}

function resolveTrend(key) {
  const fixture = getRegionalFixture(key);
  if (fixture) {
    const percent = fixture.cityChangePercent ?? fixture.nationalChangePercent ?? null;
    if (percent != null) return { percent, meta: { period: fixture.period, source: fixture.source, sourceUrl: fixture.officialSource } };
  }
  const curated = getGlobalIndexTrend(key);
  if (curated) return { percent: curated.trendPercent, meta: { period: curated.trendPeriod, source: curated.trendSource, sourceUrl: curated.trendSourceUrl, momentumNote: curated.momentumNote } };
  return { percent: null, meta: null };
}

function countryDataContext(key, name) {
  const { percent, meta } = resolveTrend(key);
  return {
    country: name,
    priceTrend: percent != null ? { percent, ...meta } : null,
    foreignBuyerAccess: getForeignBuyerRule(key),
    currencyControls: getCurrencyControls(key),
    closingCosts: getClosingCosts(key),
    propertyTax: getPropertyTax(key),
    recentTransactionPrice: getRecentTransactionPrice(key)
  };
}

function globalIndexSnapshot() {
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
  const topMarkets = entries.filter((e) => e.confidence !== "Low").slice(0, 15);
  return topMarkets.map((e) => ({ country: e.country, score: e.score, confidence: e.confidence, trendPercent: e.trendPercent }));
}

const SYSTEM_PROMPT = `You are the Pradixium Assistant — a chat assistant on the Pradixium global property intelligence platform (pradixium.com).

STRICT RULES (never break these):
1. You may ONLY state a specific number, rate, rule, or country ranking if it appears in the "DATA CONTEXT" JSON provided in this system prompt or in the conversation. Never invent, estimate from general/training knowledge, or guess a real-estate tax rate, price, foreign-ownership rule, or currency-control detail.
2. If the user asks about a country or a specific figure that is NOT present in DATA CONTEXT, say plainly that Pradixium doesn't have verified data on that yet — do not fill the gap with general knowledge, even if you believe you know the answer. This is Pradixium's core product promise: real, sourced data or an honest "we don't have that yet," never a plausible-sounding guess.
3. You may explain general concepts (what a cap rate is, what NOI means, how Pradixium's scoring works) using general knowledge, since that's not a claim about a specific country or number.
4. Encourage the user to run a full property analysis (at pradixium.com) for anything requiring per-property numbers (fair value, yield, Pradixium Score) — you don't have access to run that analysis yourself from this chat.
5. Keep answers concise and conversational — a few sentences, not an essay, unless the user asks for detail.
6. Never claim a market is "about to surge" or give investment advice/predictions — Pradixium's data is descriptive (current, real, sourced conditions), never predictive.
7. If asked who built you or what model powers you, say you're the Pradixium Assistant built on Pradixium's own data — do not discuss unrelated internal implementation details.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ success: false, error: "The chat assistant isn't configured on the server yet." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ success: false, error: "Invalid JSON body" });
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (!messages.length) {
    return res.status(400).json({ success: false, error: "No messages provided" });
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const mentionedCountries = detectCountries(lastUserMessage);

  const dataContext = {
    globalIndexTopMarkets: globalIndexSnapshot(),
    countriesInThisMessage: mentionedCountries.map((c) => countryDataContext(c.key, c.name))
  };

  const systemPrompt = SYSTEM_PROMPT + "\n\nDATA CONTEXT (real, sourced Pradixium data — the only source of truth for specific numbers/rules in this conversation):\n" + JSON.stringify(dataContext, null, 2);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 512,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 2000) }))
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error("Claude API error: " + errText.slice(0, 300));
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const reply = textBlock?.text || "Sorry, I couldn't generate a response just now.";

    return res.status(200).json({ success: true, reply });
  } catch (err) {
    return res.status(200).json({ success: false, error: "The chat assistant is temporarily unavailable — please try again shortly." });
  }
}
