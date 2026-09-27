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
2. The Pradixium Score and its confidence level are ALREADY COMPUTED for you in "pradixiumScore.score" and "pradixiumScore.confidence" — a deterministic weighted formula, not your judgment call. Copy them into your output's "score" and "confidence" fields verbatim. Your job is to turn "pradixiumScore.breakdown" (net yield, value-vs-market gap, demand, government price-trend momentum) into the dealRating, highlights, risks and reasoning that explain WHY it landed where it did.
3. Never invent government agencies, data sources, or "typical" market figures. Only cite sources that appear in the provided marketData; when there are none, say the assessment is based on property economics alone.
4. Your job is ANALYSIS and REASONING over verified data, not data generation.
5. Respond with ONLY a single valid JSON object, no markdown fences, no preamble, no explanation outside the JSON.

Output this exact JSON shape:
{
  "score": <integer 0-100 — copy pradixiumScore.score exactly>,
  "fairValue": <number in the local currency. Prefer giving your best defensible estimate over null: if marketEvidence.benchmarkValue is unavailable (e.g. suppressed for a known prime/diplomatic street) but a regional or national government reference price still appears anywhere in marketData or marketEvidence.source, anchor your estimate to that number and say so plainly in fairValueBasis (e.g. "regional median, not a street-level valuation"). Only use null when literally no numeric government reference and no rent figure exist anywhere in the provided data — never invent a number or a percentage adjustment (e.g. a "prestige premium") that isn't itself present in the data>,
  "fairValueBasis": "<one sentence: which figures this was derived from — government data if available (say explicitly if it's only a regional/national reference rather than street-level), otherwise the property economics used>",
  "dealRating": "<one of: Excellent | Good | Fair | Weak | Avoid — chosen to match the score: 80+ Excellent, 65-79 Good, 50-64 Fair, 35-49 Weak, below 35 Avoid>",
  "confidence": "<copy pradixiumScore.confidence exactly: Low | Medium | High>",
  "investmentHighlights": ["<short factual bullet>", ...up to 4],
  "keyRisks": ["<short factual bullet>", ...up to 4],
  "investorAction": "<1-2 sentence plain-language recommendation, hedged appropriately given confidence>",
  "reasoning": "<2-3 sentences explaining the score using pradixiumScore.breakdown, referencing only the data provided>"
}`;

// The report is written in English by default. When the property sits in
// a market where a local client (a seller, their agent, a notary) would
// not read English, the orchestrator asks for this same analysis a
// second time, in their language, in the SAME call — one extra field,
// not a second API round-trip. It must be a faithful translation of the
// English analysis (same facts, same numbers), never a re-reasoned or
// re-invented version.
function localizedInstruction(reportLanguage) {
  return `\n\nThe property is in a market where local clients read ${reportLanguage.label}, not English. In addition to the fields above, also include:
{
  ...,
  "localizedContent": {
    "language": "${reportLanguage.label}",
    "investmentHighlights": ["<investmentHighlights translated into ${reportLanguage.label}>", ...],
    "keyRisks": ["<keyRisks translated into ${reportLanguage.label}>", ...],
    "investorAction": "<investorAction translated into ${reportLanguage.label}>"
  }
}
This must be a faithful translation of the same English content — the same facts and figures, never new analysis or different numbers.`;
}

export async function runPropertyInvestmentAgent({ property, marketData, marketEvidence, pradixiumScore, reportLanguage }, apiKey) {
  const userMessage = JSON.stringify(
    { property, marketData: marketData || null, marketEvidence: marketEvidence || null, pradixiumScore },
    null,
    2
  );

  const needsLocalization = reportLanguage && reportLanguage.code && reportLanguage.code !== "en";
  const systemPrompt = needsLocalization ? SYSTEM_PROMPT + localizedInstruction(reportLanguage) : SYSTEM_PROMPT;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: needsLocalization ? 1792 : 1024,
      system: systemPrompt,
      messages: [
        { role: "user", content: "Analyze this property using only the data below:\n\n" + userMessage }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Claude API error: " + errText.slice(0, 500));
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text response from model");

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  const result = JSON.parse(cleaned);

  // Defense in depth: the score and confidence are a deterministic
  // calculation, not a model opinion. Force them to the computed values
  // even if the model didn't follow instructions exactly.
  if (pradixiumScore) {
    result.score = pradixiumScore.score;
    result.confidence = pradixiumScore.confidence;
  }
  return result;
}
