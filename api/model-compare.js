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
  const data = { property, benchmark: base?.marketEvidence?.benchmarkValue ?? null, marketArea: base?.marketEvidence?.marketArea ?? null, score: base?.pradixiumScore?.score ?? null, results: out };
  if (q.format === "json") return res.status(200).json(data);
  const e = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const list = (a) => Array.isArray(a) && a.length ? "<ul>" + a.map((x) => `<li>${e(x)}</li>`).join("") + "</ul>" : "<p>—</p>";
  const NAMES = { "claude-sonnet-4-6": "Sonnet 4.6 (today)", "claude-sonnet-5-5": "Sonnet 5.5", "claude-haiku-4-5": "Haiku 4.5" };
  const col = (r) => `<section><h2>${e(NAMES[r.model] || r.model)} <span>${r.seconds.toFixed(1)} s</span></h2>` + (r.error ? `<p class="err">${e(r.error)}</p>` :
    `<h3>Highlights</h3>${list(r.investmentHighlights)}<h3>Risks</h3>${list(r.keyRisks)}<h3>Investor action</h3><p>${e(r.investorAction)}</p>` +
    (r.localizedContent ? `<h3>${e(r.localizedContent.language)}</h3><h4>Highlights</h4>${list(r.localizedContent.investmentHighlights)}<h4>Risks</h4>${list(r.localizedContent.keyRisks)}<h4>Action</h4><p>${e(r.localizedContent.investorAction)}</p>` : "")) + "</section>";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send ? res.status(200).send(page()) : res.end(page());
  function page() {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Model comparison</title><style>body{font:15px/1.55 system-ui,sans-serif;margin:0;padding:16px;background:#f6f7f9;color:#1d2530}header{margin-bottom:12px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}section{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px #0001}h2{font-size:17px;margin:0 0 6px;display:flex;justify-content:space-between}h2 span{color:#1f7a4d}h3{font-size:13px;letter-spacing:.5px;text-transform:uppercase;color:#6b7684;margin:14px 0 4px}h4{font-size:13px;margin:10px 0 2px}ul{padding-left:18px;margin:0}.err{color:#b3261e}</style></head><body><header><b>${e(property.city)}</b> — ${e(property.propertyType)}, ${e(property.size)} m², asking ${e(property.price)} · benchmark ${e(Math.round(data.benchmark || 0))}/m² (${e(data.marketArea)}) · score ${e(data.score)} — same data for every model</header><main>${out.map(col).join("")}</main></body></html>`;
  }
}
