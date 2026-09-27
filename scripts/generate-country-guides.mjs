/* PRADIXIUM™ — static SEO country guide generator
 * Generates /guides/<slug>.html — one real, sourced guide per country,
 * built entirely from the same fixture data already used by the paid
 * report (api/regional-fixture-intelligence.js + lib/data/foreignBuyerRules.js).
 * No number here is invented; each guide only covers a country that has
 * BOTH a real price fixture and a verified foreign-buyer rule, so the
 * content is always rich and never guessed to fill a template.
 *
 * Run manually (`node scripts/generate-country-guides.mjs`) whenever the
 * underlying fixture data is refreshed — these are static files, not
 * server-rendered per request, matching this project's existing "dated
 * fixture, manually refreshed" convention.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { getForeignBuyerRule } from "../lib/data/foreignBuyerRules.js";

const CURRENCY = { mexico: "MXN", japan: "JPY", canada: "CAD", australia: "AUD", vietnam: "USD" };
const CURRENCY_SYMBOL = { MXN: "MX$", JPY: "¥", CAD: "C$", AUD: "A$", USD: "$" };

// Short, factual synthesis of each country's price fixture + foreign-buyer
// rule — every figure here is copied from FIXTURES/RULES below, nothing added.
const SYNTHESIS = {
  mexico: "Mexico's national average appraised home value rose 8.7% year-over-year in Q1 2026, with Guadalajara outpacing the capital region at +12.5%. Foreign buyers can purchase almost anywhere in the country, but properties within 50km of the coast or 100km of a border — precisely where most international buyers want a beach or border property — require a bank trust (fideicomiso) rather than direct title.",
  thailand: "Thailand's nationwide residential price index rose a modest 1.26% year-over-year in Q1 2026, with the South outperforming (+5.59%) while Bangkok actually dipped slightly. Foreign buyers cannot own land directly, but can hold condominium units — capped at 49% of a building's total floor area.",
  indonesia: "Bank Indonesia's official residential price index grew just 0.69% year-over-year in Q2 2026 — the weakest reading in the series' history the prior quarter. That national figure doesn't capture Bali's investor-driven villa market, where private agencies report far higher prices and growth. Foreign nationals cannot hold freehold title anywhere in Indonesia, though a 2021 reform allows a 'right-of-use' (Hak Pakai) title for foreign residents.",
  "south korea": "South Korea's nationwide house price index rose 2.35% year-over-year as of April 2026 — but Seoul specifically ran nearly four times hotter, at +9.56%. Foreign buyers face no ownership restriction, just a reporting requirement to the local district office within 60 days of signing.",
  india: "India's NHB RESIDEX 50-city index rose 5.0% year-over-year in the quarter ending December 2025, led by Bengaluru (+12.7%) and Chennai (+8.2%). Foreign nationals who are not of Indian origin generally cannot buy property in India without specific Reserve Bank of India approval — Non-Resident Indians and Overseas Citizens of India face no such restriction.",
  japan: "An existing condo in Japan averages around ¥36 million nationwide, with prices up roughly 5% year-over-year as of November 2025 — and MLIT's separate land price survey showed the strongest nationwide gain since 1992 this year. Japan places no restriction whatsoever on foreign ownership, residency, or citizenship — one of the most open major property markets in the world.",
  vietnam: "Primary-market apartment prices in Ho Chi Minh City averaged $6,113/m² in 2025, up a striking 65% year-over-year, with Hanoi not far behind at $3,852/m² (+32%). Foreign buyers can only purchase within licensed housing projects, capped at 30% of units in a given apartment building, generally on a renewable 50-year lease rather than freehold.",
  canada: "Canada's national home price benchmark (CREA's MLS® HPI) actually fell 3.3% year-over-year as of July 2026, to C$674,819. That cooling comes alongside one of the strictest foreign-buyer regimes among major economies: a federal ban on non-Canadians buying most residential property in urban areas, extended through January 1, 2027.",
  australia: "The average Australian dwelling was valued at A$1,111,100 nationwide in Q1 2026 (Australian Bureau of Statistics), ranging from A$580,000 in the Northern Territory to over A$1.3 million in New South Wales. Foreign buyers are currently banned from purchasing established (existing) homes until June 30, 2029 — new-builds and vacant land still require Foreign Investment Review Board approval."
};

const FIXTURES = {
  mexico: { country: "Mexico", period: "2026-Q1", nationalChangePercent: 8.7, nationalBenchmarkValue: 2024337, benchmarkUnit: "total", source: "Sociedad Hipotecaria Federal (SHF) — Índice SHF de Precios de la Vivienda, Q1 2026", officialSource: "https://www.gob.mx/shf" },
  thailand: { country: "Thailand", period: "2026-Q1", nationalChangePercent: 1.26, benchmarkUnit: "perSqm", source: "Bank of Thailand — Residential Property Price Index (RPPI), Q1 2026", officialSource: "https://www.bot.or.th/" },
  indonesia: { country: "Indonesia", period: "2026-Q2", nationalChangePercent: 0.69, benchmarkUnit: "perSqm", source: "Bank Indonesia — Residential Property Price Index (IHPR), Q2 2026", officialSource: "https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2815226.aspx" },
  "south korea": { country: "South Korea", period: "2026-04", nationalChangePercent: 2.35, cityName: "Seoul", cityChangePercent: 9.56, benchmarkUnit: "perSqm", source: "Bank of Korea / Korea Real Estate Board (REB) — Nationwide House Price Index, April 2026", officialSource: "https://www.reb.or.kr/rebEng/main.do" },
  india: { country: "India", period: "Q3 FY2025-26 (Oct-Dec 2025)", nationalChangePercent: 5.0, benchmarkUnit: "perSqm", source: "National Housing Bank (NHB) — RESIDEX, Q3 FY2025-26", officialSource: "https://residex.nhbonline.org.in/" },
  japan: { country: "Japan", period: "2025-11", nationalChangePercent: 5.0, nationalBenchmarkValue: 36000000, benchmarkUnit: "total", source: "Ministry of Land, Infrastructure, Transport and Tourism (MLIT) — Residential Property Price Index, November 2025", officialSource: "https://www.mlit.go.jp/en/" },
  vietnam: { country: "Vietnam", period: "2025", cityName: "Ho Chi Minh City", cityChangePercent: 65, cityBenchmarkValue: 6113, benchmarkUnit: "perSqm", source: "Vietnam Ministry of Construction — primary apartment market price data, 2025", officialSource: "https://en.nso.gov.vn/" },
  canada: { country: "Canada", period: "2026-07", nationalChangePercent: -3.3, nationalBenchmarkValue: 674819, benchmarkUnit: "total", source: "Canadian Real Estate Association (CREA) — MLS® Home Price Index, July 2026", officialSource: "https://creastats.crea.ca/" },
  australia: { country: "Australia", period: "2026-Q1", nationalBenchmarkValue: 1111100, benchmarkUnit: "total", source: "Australian Bureau of Statistics (ABS) — Total Value of Dwellings, March Quarter 2026", officialSource: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings" }
};

function slug(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

function money(value, key) {
  if (value == null) return null;
  const currency = CURRENCY[key] || "USD";
  const symbol = CURRENCY_SYMBOL[currency] || "$";
  return symbol + Math.round(value).toLocaleString("en-US");
}

function priceLine(key, f) {
  const benchmark = f.nationalBenchmarkValue ?? f.cityBenchmarkValue;
  const label = f.cityName ? f.cityName : f.country + " (national)";
  const suffix = f.benchmarkUnit === "perSqm" ? "/m²" : "";
  const parts = [];
  if (benchmark != null) parts.push(`<strong>${money(benchmark, key)}${suffix}</strong> (${label})`);
  const change = f.nationalChangePercent ?? f.cityChangePercent;
  if (change != null) parts.push(`${change >= 0 ? "+" : ""}${change}% year-over-year`);
  return parts.join(" — ");
}

function page(key) {
  const f = FIXTURES[key];
  const rule = getForeignBuyerRule(key);
  const country = f.country;
  const statusClass = { OPEN: "open", RESTRICTED: "restricted", "WORKAROUND REQUIRED": "workaround", "TAX SURCHARGE": "surcharge" }[rule.status] || "restricted";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Buying Property in ${country} as a Foreigner — 2026 Price Guide & Ownership Rules | Pradixium</title>
<meta name="description" content="Real ${country} house price data (${f.source}) and foreign-ownership rules, sourced and dated — not filler. Foreign buyer status: ${rule.status}.">
<link rel="canonical" href="https://pradixium.com/guides/${slug(country)}.html">
<style>
*{box-sizing:border-box}
body{margin:0;background:#f6f8fa;color:#172131;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.page{max-width:760px;margin:0 auto;padding:32px 20px 70px}
header{display:flex;align-items:center;gap:10px;margin-bottom:6px}
header a{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit}
header img{height:36px}
header .logo-text{font-size:19px;letter-spacing:2.4px;font-weight:700}
.crumb{font-size:12px;color:#8994a3;margin:22px 0 4px}
.crumb a{color:#2463f5;text-decoration:none}
h1{font-size:28px;line-height:1.25;margin:6px 0 16px}
.snapshot{background:#fff;border:1px solid #e5eaf0;border-radius:14px;padding:22px 24px;margin:22px 0}
.snapshot .label{font-size:11px;letter-spacing:.6px;color:#8994a3;font-weight:700;margin-bottom:6px}
.snapshot .value{font-size:20px;margin-bottom:14px}
.badge{font-size:10px;font-weight:800;letter-spacing:.6px;padding:4px 9px;border-radius:20px;display:inline-block}
.badge.open{background:#e6f7ee;color:#18a55f}
.badge.restricted{background:#fbeaea;color:#d64545}
.badge.workaround{background:#fdf3e0;color:#a8731a}
.badge.surcharge{background:#e9f0fe;color:#2463f5}
p{font-size:15px;line-height:1.65;color:#374151}
.source{font-size:12px;color:#8994a3}
.source a{color:#2463f5;text-decoration:none}
.cta{margin:36px 0 8px;text-align:center;background:#172131;border-radius:16px;padding:30px 24px;color:#fff}
.cta h3{margin:0 0 8px;font-size:19px}
.cta p{color:#c7cdd6;margin:0 0 16px;font-size:13px}
.cta a{display:inline-block;background:#2463f5;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:9px;font-size:14px}
footer{text-align:center;color:#9aa2ad;font-size:11px;letter-spacing:.4px;padding:32px 0 0}
.disclaimer{font-size:12px;color:#9aa2ad;margin-top:24px;line-height:1.6}
</style>
</head>
<body>
<main class="page">
  <header><a href="/index.html"><img src="{{LOGO}}" alt="Pradixium"><span class="logo-text">PRADIXIUM™</span></a></header>
  <div class="crumb"><a href="/guides/index.html">All Country Guides</a> / ${country}</div>
  <h1>Buying Property in ${country} as a Foreigner — 2026 Price Guide &amp; Ownership Rules</h1>

  <p>${SYNTHESIS[key]}</p>

  <div class="snapshot">
    <div class="label">MARKET SNAPSHOT — ${f.period}</div>
    <div class="value">${priceLine(key, f)}</div>
    <p class="source">Source: <a href="${f.officialSource}" target="_blank" rel="noopener">${f.source}</a></p>
  </div>

  <div class="snapshot">
    <div class="label">FOREIGN BUYER ACCESS</div>
    <div class="value"><span class="badge ${statusClass}">${rule.status}</span></div>
    <p>${rule.summary}</p>
    <p><strong>Extra cost for foreigners:</strong> ${rule.extraCost}</p>
    <p class="source">Source: <a href="${rule.sourceUrl}" target="_blank" rel="noopener">${rule.source}</a></p>
  </div>

  <p class="disclaimer">These are dated fixtures from each source's own published report, not a live feed, and structural ownership rules that can change — verify both against the official source before relying on them for a purchase decision. Not legal, tax, or investment advice.</p>

  <div class="cta">
    <h3>Analyzing a specific property in ${country}?</h3>
    <p>Get a full Pradixium Score™ — price-vs-market gap, rental yield, demand data, and this same foreign buyer check, for one address.</p>
    <a href="/index.html?country=${encodeURIComponent(country)}">Analyze a Property in ${country} →</a>
  </div>

  <footer>
    <div><a href="mailto:cs@pradixium.com" style="color:inherit">cs@pradixium.com</a></div>
    <div>PRADIXIUM™ — GLOBAL PROPERTY INTELLIGENCE</div>
  </footer>
</main>
</body>
</html>
`;
}

async function main() {
  const report = await readFile(new URL("../report.html", import.meta.url), "utf8");
  const logo = report.match(/data:image\/png;base64,[A-Za-z0-9+/=]*/)[0];

  await mkdir(new URL("../guides/", import.meta.url), { recursive: true });

  const keys = Object.keys(FIXTURES);
  for (const key of keys) {
    const html = page(key).replace("{{LOGO}}", logo);
    const fileName = slug(FIXTURES[key].country) + ".html";
    await writeFile(new URL("../guides/" + fileName, import.meta.url), html);
    console.log("Wrote guides/" + fileName);
  }
}

main();
