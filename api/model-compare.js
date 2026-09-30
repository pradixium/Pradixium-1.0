// TEMPORARY internal test (preview deployments only — 404 in production):
// runs the same property through the report's AI step with several Claude
// models and returns each model's text + time, so the owner can compare
// wording and speed before choosing. The official data comes from the
// public production endpoints (read-only); only the AI step runs here.
import orchestrator from "./orchestrator.js";
import { runPropertyInvestmentAgent } from "../lib/agents/propertyInvestmentAgent.js";
import { resolveReportLanguage } from "../lib/i18n/reportLanguage.js";

const MODELS = ["claude-sonnet-4-6", "claude-sonnet-5-5", "claude-haiku-4-5"];

function runOrchestrator(property) {
  return new Promise((resolve, reject) => {
    const req = { method: "POST", headers: { host: "www.pradixium.com", "x-forwarded-proto": "https" }, body: { property }, query: {} };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(c) { this.statusCode = c; return this; },
      json(v) { resolve(v); return this; },
      end() { resolve(null); }
    };
    Promise.resolve(orchestrator(req, res)).catch(reject);
  });
}

export default async function handler(req, res) {
  if (process.env.VERCEL_ENV !== "preview") return res.status(404).json({ error: "not found" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const q = req.query || {};
  const property = {
    country: q.country || "France",
    city: q.city || "10 rue de passy 75016",
    address: q.city || "10 rue de passy 75016",
    price: Number(q.price || 1760000), askingPrice: Number(q.price || 1760000),
    size: Number(q.size || 85), propertyType: q.type || "Apartment",
    bedrooms: Number(q.beds || 2), bathrooms: 2, monthlyRent: Number(q.rent || 5400)
  };
  // official data only: the orchestrator's own AI call is skipped here
  delete process.env.ANTHROPIC_API_KEY;
  let base;
  try { base = await runOrchestrator(property); } finally { process.env.ANTHROPIC_API_KEY = apiKey; }
  const input = { property, marketData: base?.marketData || null, marketEvidence: base?.marketEvidence || null, pradixiumScore: base?.pradixiumScore || null, reportLanguage: resolveReportLanguage(property.country, property.city) };
  const out = await Promise.all(MODELS.map(async (model) => {
    const t = Date.now();
    try {
      const r = await runPropertyInvestmentAgent(input, apiKey, { model });
      return { model, seconds: (Date.now() - t) / 1000, investmentHighlights: r.investmentHighlights, keyRisks: r.keyRisks, investorAction: r.investorAction, reasoning: r.reasoning, localizedContent: r.localizedContent || null };
    } catch (e) {
      return { model, seconds: (Date.now() - t) / 1000, error: String(e?.message || e).slice(0, 400) };
    }
  }));
  return res.status(200).json({ property, benchmark: base?.marketEvidence?.benchmarkValue ?? null, marketArea: base?.marketEvidence?.marketArea ?? null, score: base?.pradixiumScore?.score ?? null, results: out });
}
