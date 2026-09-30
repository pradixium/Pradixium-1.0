/* PRADIXIUM™ — Property & Investment Analyst Agent (shared logic)
 * Called by the Orchestrator (see /api/orchestrator.js). Never invents
 * numbers — only reasons over the marketData it is given, which must
 * already come from a verified government source (MIVAU, DVF, etc.).
 *
 * The Pradixium Score itself is NOT decided by this model. It's computed
 * deterministically beforehand by lib/scoring/pradixiumScore.js — a
 * weighted formula over rental yield, asking-price-vs-government-benchmark
 * gap, demand strength, and government price-trend momentum — and handed
 * in as "pradixiumScore". This
 * agent's job is to explain that number in plain language (dealRating,
 * highlights, risks, reasoning), not to compute its own competing one.
 */

const SYSTEM_PROMPT = `You are the Pradixium Property & Investment Analyst — one of several specialized agents inside the Pradixium real estate intelligence platform.

STRICT RULES (never break these):
1. You may ONLY use numbers that appear in the "property", "marketData" or "pradixiumScore" JSON given to you in the user message. Never invent, estimate from general world knowledge, or hallucinate a price, transaction value, or statistic that is not explicitly present in the provided data.
2. The Pradixium Score and its confidence level are ALREADY COMPUTED for you in "pradixiumScore.score" and "pradixiumScore.confidence" — a deterministic weighted formula, not your judgment call. Copy them into your output's "score" and "confidence" fields verbatim. Your job is to turn "pradixiumScore.breakdown" (gross yield = rent ÷ price — never state or estimate a net yield: running costs are unknown; value-vs-market gap, demand, government price-trend momentum) into the dealRating, highlights, risks and reasoning that explain WHY it landed where it did.
3. Never invent government agencies, data sources, or "typical" market figures. Only cite sources that appear in the provided marketData; when there are none, say the assessment is based on property economics alone.
4. Your job is ANALYSIS and REASONING over verified data, not data generation.
5. Respond with ONLY a single valid JSON object, no markdown fences, no preamble, no explanation outside the JSON.

Output this exact JSON shape:
{
  "score": <integer 0-100 — copy pradixiumScore.score exactly>,
  "fairValue": <copy pradixiumScore.fairValue exactly — it is already computed for you by a deterministic waterfall (government value, then benchmark-derived, then rent-implied, then a labeled asking-price estimate as a last resort), never your own calculation>,
  "fairValueBasis": "<copy pradixiumScore.fairValueBasis exactly, verbatim — it already states plainly which tier this came from, including when it's Pradixium's own estimate rather than a verified figure>",
  "dealRating": "<one of: Excellent | Good | Fair | Weak | Avoid — chosen to match the score: 80+ Excellent, 65-79 Good, 50-64 Fair, 35-49 Weak, below 35 Avoid>",
  "confidence": "<copy pradixiumScore.confidence exactly: Low | Medium | High>",
  "investmentHighlights": ["<short factual bullet>", ...up to 4],
  "keyRisks": ["<short factual bullet>", ...up to 4],
  "investorAction": "<1-2 sentence plain-language recommendation, hedged appropriately given confidence>",
  "reasoning": "<2-3 sentences explaining the score using pradixiumScore.breakdown, referencing only the data provided>"
}`;

// FIX (speed, without cutting content): a localized report used to ask for
// the full English analysis AND a translated copy of it in ONE combined
// call (max_tokens 1792) — the model has to finish writing the entire
// English half before it can even start the second, so every non-English
// market (most of Europe) waited roughly 1.75x as long as an English-only
// report for the exact same amount of content. Below, this becomes a
// SEPARATE, smaller, independent request — asking the same question
// answered natively in the target language, not a translation of the
// English text — run in parallel with the English call (see
// runPropertyInvestmentAgent). Wall-clock time becomes ~max(English,
// localized) instead of English+localized, and the localized call needs
// far fewer output tokens (three short fields, not the whole schema), so
// in practice it finishes before the English call does and costs nothing
// extra in wall-clock time — same total richness, roughly English-only
// latency even for localized markets.
function localizedSystemPrompt(reportLanguage) {
  return `You are the Pradixium Property & Investment Analyst — one of several specialized agents inside the Pradixium real estate intelligence platform.

STRICT RULES (never break these):
1. You may ONLY use numbers that appear in the "property", "marketData" or "pradixiumScore" JSON given to you in the user message. Never invent, estimate from general world knowledge, or hallucinate a price, transaction value, or statistic that is not explicitly present in the provided data.
2. Never invent government agencies, data sources, or "typical" market figures. Only cite sources that appear in the provided marketData; when there are none, say the assessment is based on property economics alone.
3. Your job is ANALYSIS and REASONING over verified data, not data generation.
4. Write directly in ${reportLanguage.label} — a native analysis in that language, not a translation exercise.
5. Respond with ONLY a single valid JSON object, no markdown fences, no preamble, no explanation outside the JSON.

The property is in a market where local clients read ${reportLanguage.label}, not English. Analyze it the same way the English report would (using pradixiumScore.breakdown — gross yield, value-vs-market gap, demand, government price-trend momentum — to explain why the score landed where it did), and respond with ONLY this JSON shape, every string written directly in ${reportLanguage.label}:
{
  "localizedContent": {
    "language": "${reportLanguage.label}",
    "investmentHighlights": ["<short factual bullet, in ${reportLanguage.label}>", ...up to 4],
    "keyRisks": ["<short factual bullet, in ${reportLanguage.label}>", ...up to 4],
    "investorAction": "<1-2 sentence plain-language recommendation, hedged appropriately given pradixiumScore.confidence, in ${reportLanguage.label}>"
  }
}
This must reflect the SAME facts and figures as the English analysis would (same STRICT RULES above) — never a different conclusion, just reasoned and written natively in ${reportLanguage.label} instead of English.`;
}

// Haiku 4.5 (owner's choice, Sept 30 2026): the report's AI step took ~18 s
// on Sonnet 4.6; same prompts and rules, figures come from code, not the model
const DEFAULT_MODEL = "claude-haiku-4-5";
// per-model request options: Sonnet 5.5 thinks by default — for this short,
// data-bound JSON the thinking step is turned off ("between_tools")
function modelOptions(model) {
  if (model === "claude-sonnet-5-5") return { thinking: { type: "between_tools" } };
  return {};
}

async function callClaude(apiKey, systemPrompt, userContent, maxTokens, model = DEFAULT_MODEL) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      ...modelOptions(model),
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }]
    })
  });
}

function extractJson(data) {
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text response from model");
  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function runPropertyInvestmentAgent({ property, marketData, marketEvidence, pradixiumScore, reportLanguage }, apiKey, { model = DEFAULT_MODEL } = {}) {
  const userMessage = JSON.stringify(
    { property, marketData: marketData || null, marketEvidence: marketEvidence || null, pradixiumScore },
    null,
    2
  );
  const userContent = "Analyze this property using only the data below:\n\n" + userMessage;

  const needsLocalization = reportLanguage && reportLanguage.code && reportLanguage.code !== "en";

  // FIX (real live bug, Sept 2026): this was 640 — LESS than the ~768
  // tokens the localized content reliably got in the old combined-call
  // design (1792 total - the English portion's 1024 ≈ 768 remaining).
  // A response that needs more than 640 tokens (routine for 4 highlights +
  // 4 risks + an action sentence, especially in a more verbose language
  // like German or French) got silently truncated mid-JSON, failed to
  // parse, and fell back to English-only — with zero visible error
  // anywhere, since a failed localization is deliberately non-fatal (see
  // below). This is a hard cap, not a speed knob: raising it costs
  // nothing in the common case, since actual wall-clock time is governed
  // by how many tokens the model actually generates (routinely well under
  // 1024 for this much shorter schema), not by the cap itself — it only
  // matters for the worst case, which is exactly what was breaking.
  const [englishResponse, localizedResponse] = await Promise.all([
    callClaude(apiKey, SYSTEM_PROMPT, userContent, 1024, model),
    needsLocalization ? callClaude(apiKey, localizedSystemPrompt(reportLanguage), userContent, 1024, model) : Promise.resolve(null)
  ]);

  if (!englishResponse.ok) {
    const errText = await englishResponse.text();
    throw new Error("Claude API error: " + errText.slice(0, 500));
  }
  const result = extractJson(await englishResponse.json());

  // Localization is enrichment on top of a successful English analysis —
  // never let a failure or a slow/malformed response here take down the
  // whole (already-successful) core deliverable.
  if (localizedResponse) {
    try {
      if (!localizedResponse.ok) {
        const errText = await localizedResponse.text();
        console.warn("Localized analysis failed:", errText.slice(0, 300));
      } else {
        const localizedParsed = extractJson(await localizedResponse.json());
        if (localizedParsed?.localizedContent) {
          result.localizedContent = localizedParsed.localizedContent;
        }
      }
    } catch (err) {
      console.warn("Localized analysis parsing failed:", err?.message || err);
    }
  }

  // Defense in depth: score, confidence and fairValue/fairValueBasis are
  // all deterministic calculations (lib/scoring/pradixiumScore.js), not a
  // model opinion — force them to the computed values even if the model
  // didn't follow instructions exactly. fairValue in particular must never
  // silently come back null just because the model didn't compute the
  // last-resort tier correctly; the deterministic waterfall guarantees a
  // labeled number always exists.
  if (pradixiumScore) {
    result.score = pradixiumScore.score;
    result.confidence = pradixiumScore.confidence;
    result.fairValue = pradixiumScore.fairValue;
    result.fairValueBasis = pradixiumScore.fairValueBasis;
  }
  return result;
}
