/* PRADIXIUM™ — AI Orchestrator
 * See PRADIXIUM MASTER BLUEPRINT §15: "The user does not need to know
 * there are 10 Agents... The Orchestrator decides which Agents need to
 * work on each property."
 *
 * Today this routes to a single agent (Property + Investment Analyst).
 * As more agents are added (Risk, Deal Discovery, Report...), they get
 * registered in AGENT_REGISTRY below and the orchestrator fans out to
 * them — the client and the rest of this function never need to change.
 *
 * POST body:
 * {
 *   property: { address, city, country, price, size, bedrooms, bathrooms, rent, propertyType },
 *   marketData: { ...government data already fetched by the existing
 *                  /api/*-intelligence endpoints... },   // optional
 *   agents: ["property-investment"]   // optional, defaults to all registered agents
 * }
 *
 * Response:
 * {
 *   success: true,
 *   results: { "property-investment": { ...agent output... } },
 *   marketData,      // raw, country-shaped government data (whatever that country's adapter returns)
 *   marketEvidence,  // normalized { benchmarkValue, benchmarkUnit, benchmarkLabel, governmentValue,
 *                    //   transactionValue, transactionPeriod, marketArea, source, coverage } — same
 *                    //   shape for every country, see normalizeMarketEvidence() below
 *   paid             // true if the caller (via the Authorization bearer token) has an active
 *                    //   subscription or already bought this exact property's report — see
 *                    //   checkEntitlement() below. When false, results[*] has fairValue,
 *                    //   investmentHighlights, keyRisks and investorAction redacted: the score,
 *                    //   deal rating and confidence are a free signal, the reasoning is the
 *                    //   paid product.
 * }
 */

import { runPropertyInvestmentAgent } from "../lib/agents/propertyInvestmentAgent.js";
import { computePradixiumScore } from "../lib/scoring/pradixiumScore.js";
import { computeRealityCheck } from "../lib/scoring/realityCheck.js";
import { resolveReportLanguage } from "../lib/i18n/reportLanguage.js";
import { getForeignBuyerRule } from "../lib/data/foreignBuyerRules.js";
import { getClosingCosts } from "../lib/data/closingCosts.js";
import { getPropertyTax } from "../lib/data/propertyTax.js";
import { getCurrencyControls } from "../lib/data/currencyControls.js";
import { getRecentTransactionPrice } from "../lib/data/recentTransactionPrices.js";

const AGENT_REGISTRY = {
  "property-investment": runPropertyInvestmentAgent
  // Future agents register here, e.g.:
  // "risk": runRiskAgent,
  // "report": runReportAgent,
};

// Country → government intelligence endpoint. The orchestrator calls this
// itself, server-side, so the client never has to run its own country
// detection / fan-out logic. One request in, one result out.
//
// This map IS the adapter registry: adding a new country means adding one
// api/<name>-intelligence.js file (handler(req,res) that resolves city/
// address query params to real official data and returns
// { success: true, data: {...} }) and one line here — nothing else in the
// orchestrator, client, or agent needs to change. Some countries' official
// sources require a registered API key (e.g. Japan's MLIT Reinfolib, UAE's
// Dubai Pulse) rather than being open/keyless like MIVAU, DVF or FHFA —
// those adapters read their key from an env var, same pattern as
// ANTHROPIC_API_KEY below, and degrade to "unavailable" if it's unset.
const COUNTRY_ENDPOINTS = {
  "france": "france-intelligence",
  "spain": "market-data",
  "germany": "germany-intelligence",
  "italy": "italy-intelligence",
  "portugal": "portugal-intelligence",
  "united kingdom": "uk-intelligence",
  "uk": "uk-intelligence",
  "united states": "us-intelligence",
  "usa": "us-intelligence",
  "us": "us-intelligence",
  // Belgium's own statistics office (Statbel) publishes real regional
  // (Brussels-Capital/Flanders/Wallonia) median prices by property type,
  // so it gets its own adapter instead of the generic Eurostat trend.
  "belgium": "belgium-intelligence",
  // One shared adapter (Eurostat's prc_hpi_q) covers all of these —
  // national HPI trend only, same honesty as Germany/Italy/Portugal.
  // Per Eurostat's own documentation this dataset covers every EU member
  // state (except Greece) plus Iceland, Norway and Switzerland — this is
  // that full remaining set.
  "netherlands": "eurostat-hpi-intelligence",
  "poland": "eurostat-hpi-intelligence",
  "austria": "eurostat-hpi-intelligence",
  "switzerland": "eurostat-hpi-intelligence",
  "czech republic": "eurostat-hpi-intelligence",
  "czechia": "eurostat-hpi-intelligence",
  "hungary": "eurostat-hpi-intelligence",
  "bulgaria": "eurostat-hpi-intelligence",
  "croatia": "eurostat-hpi-intelligence",
  "cyprus": "eurostat-hpi-intelligence",
  "denmark": "eurostat-hpi-intelligence",
  "estonia": "eurostat-hpi-intelligence",
  "finland": "eurostat-hpi-intelligence",
  "ireland": "eurostat-hpi-intelligence",
  "latvia": "eurostat-hpi-intelligence",
  "lithuania": "eurostat-hpi-intelligence",
  "luxembourg": "eurostat-hpi-intelligence",
  "malta": "eurostat-hpi-intelligence",
  "romania": "eurostat-hpi-intelligence",
  "slovakia": "eurostat-hpi-intelligence",
  "slovenia": "eurostat-hpi-intelligence",
  "sweden": "eurostat-hpi-intelligence",
  "norway": "eurostat-hpi-intelligence",
  "iceland": "eurostat-hpi-intelligence",
  // Eurostat's own coverage note excludes Greece from prc_hpi_q, so it
  // gets its own adapter sourced from the Bank of Greece directly.
  "greece": "greece-intelligence",
  // Not covered by Eurostat's prc_hpi_q (non-EU/EFTA) — each of these has
  // a real official figure, but only as a press release or PDF report, so
  // they share a dated-fixture adapter instead of a live feed. Same
  // honesty tier as Greece.
  "serbia": "regional-fixture-intelligence",
  "bosnia and herzegovina": "regional-fixture-intelligence",
  "montenegro": "regional-fixture-intelligence",
  "north macedonia": "regional-fixture-intelligence",
  "ukraine": "regional-fixture-intelligence",
  "albania": "regional-fixture-intelligence",
  "andorra": "regional-fixture-intelligence",
  "monaco": "regional-fixture-intelligence",
  // Eurasia + the Americas + Oceania markets added on the same dated-
  // fixture basis — each has a real official (or, where noted in the
  // fixture itself, most-authoritative industry) figure, but no verified
  // live feed.
  "russia": "regional-fixture-intelligence",
  "kazakhstan": "regional-fixture-intelligence",
  "canada": "regional-fixture-intelligence",
  "mexico": "regional-fixture-intelligence",
  "brazil": "regional-fixture-intelligence",
  "australia": "regional-fixture-intelligence",
  "new zealand": "regional-fixture-intelligence",
  "argentina": "regional-fixture-intelligence",
  "chile": "regional-fixture-intelligence",
  "colombia": "regional-fixture-intelligence",
  "peru": "regional-fixture-intelligence",
  "uruguay": "regional-fixture-intelligence",
  "dominican republic": "regional-fixture-intelligence",
  // South/Southeast/East Asia markets, same dated-fixture basis.
  "thailand": "regional-fixture-intelligence",
  "indonesia": "regional-fixture-intelligence",
  "south korea": "regional-fixture-intelligence",
  "india": "regional-fixture-intelligence",
  "japan": "regional-fixture-intelligence",
  "vietnam": "regional-fixture-intelligence",
  "sri lanka": "regional-fixture-intelligence",
  "cambodia": "regional-fixture-intelligence",
  // Listed in the dropdown for global coverage, but no verified official
  // source has been found yet — see api/pending-intelligence.js for what
  // was checked. Returns an honest "not yet connected" status rather
  // than a fabricated number.
  "armenia": "pending-intelligence",
  "georgia": "pending-intelligence",
  "azerbaijan": "pending-intelligence",
  "uzbekistan": "pending-intelligence",
  "kyrgyzstan": "pending-intelligence",
  "tajikistan": "pending-intelligence",
  "turkmenistan": "pending-intelligence",
  "moldova": "pending-intelligence",
  "belarus": "pending-intelligence",
  "kosovo": "pending-intelligence",
  "liechtenstein": "pending-intelligence",
  "san marino": "pending-intelligence",
  "ecuador": "pending-intelligence",
  "bolivia": "pending-intelligence",
  "paraguay": "pending-intelligence",
  "bahamas": "pending-intelligence",
  "puerto rico": "pending-intelligence",
  "cayman islands": "pending-intelligence",
  "trinidad and tobago": "pending-intelligence",
  "barbados": "pending-intelligence",
  "jamaica": "pending-intelligence",
  "maldives": "pending-intelligence",
  // Israel's Central Bureau of Statistics (הלמ״ס) runs a real, public,
  // keyless API — its own dedicated adapter, not a fixture.
  "israel": "israel-intelligence",
  // Dubai Land Department publishes a real, keyless, direct-download CSV
  // of its official Residential Sales Price Index — no API key needed
  // for this specific file (unlike DLD's transaction-level API).
  "united arab emirates": "uae-intelligence"
};

// Every country adapter returns data shaped around whatever its own
// government source publishes (Spain: benchmarkEurPerM2, France: a dvf{}
// block, UK: transactionEvidence{}, US: valuationEvidence{}/
// transactionEvidence{}, Germany/Italy/Portugal: housingPriceIndex{} only).
// That's correct — each source really is different — but it means the
// client would otherwise need one rendering branch per country forever.
// This normalizer is the single place that maps each raw shape into one
// canonical "marketEvidence" contract so the client has exactly one
// rendering path. Adding a country here is the second half of the adapter
// contract (see COUNTRY_ENDPOINTS above): the raw adapter can return
// whatever its source naturally gives back; this function is what teaches
// the orchestrator to read it.
// NYC Department of Finance sales context (api/us-intelligence.js
// nycDofSales). Shown as text only — DOF's area is gross building area,
// not living area, so it never becomes benchmarkValue / the verdict.
function nycSalesContext(n) {
  if (!n) return null;
  const zip = n.zip ? `ZIP ${n.zip}` : "this ZIP";
  const src = `${n.source}.`;
  if (n.status === "ok") {
    return `NYC Dept. of Finance: ${n.salesCount} recorded sales of ${n.category} in ${zip} (${n.periodFrom} to ${n.periodTo}), median $${n.medianPerGrossSqFt.toLocaleString("en-US")} per gross sq ft of building area — gross area, not living area, so context only; not used in the verdict. ${src}`;
  }
  if (n.status === "insufficient_sales") {
    return `NYC Dept. of Finance: only ${n.salesCount} usable sales of ${n.category} in ${zip} in the last 12 months — not enough for a reliable local figure. ${src}`;
  }
  if (n.status === "no_unit_area") {
    return `NYC Dept. of Finance: ${n.salesCount} recorded condo/co-op sales in ${zip} in the last 12 months, but DOF does not publish unit floor area — no per-sq-ft comparison exists for apartments. ${src}`;
  }
  return null;
}

function normalizeMarketEvidence(country, raw, propertyType) {
  if (!raw) return null;
  const c = String(country || "").trim().toLowerCase();

  if (c === "france") {
    const dvf = raw.dvf || {};
    const rental = raw.rental || {};
    // FIX: DVF already splits transactions into apartment/house buckets
    // (api/france-intelligence.js's fetchDvf), but this always used the
    // blended medianEurPerM2 regardless of what was actually being
    // analyzed — comparing a house-with-land against an apartment-only
    // price/m² (or vice versa) systematically misjudges the price. Now
    // picks the bucket matching the property's actual type when it has
    // enough samples, falling back to the blended figure otherwise.
    const wantsHouse = /house|villa|detached|chalet|maison/i.test(String(propertyType || ""));
    const typeBucket = wantsHouse ? dvf.house : /apartment|flat|condo|appartement/i.test(String(propertyType || "")) ? dvf.apartment : null;
    const benchmarkSource = typeBucket?.sampleSize > 0 ? typeBucket : dvf;
    // FIX: the commune-wide rental average is meaningless for a street like
    // Rue Cambon (Place Vendôme) — applying it there produced a confidently
    // wrong "estimated rent" that dragged the score down to "Avoid" for a
    // genuinely prime address. When the micro-location detector (see
    // parisSignals in api/france-intelligence.js) flags the property as
    // prime/ultra-prime, skip the estimate entirely: no rent shown is more
    // honest than a wrong one driving the score.
    const isPrimeOutlier = Boolean(raw.microLocation?.prestige?.isPrime);
    return {
      benchmarkValue: benchmarkSource?.medianEurPerM2 ?? null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: wantsHouse ? "DVF Benchmark (houses)" : "DVF Benchmark",
      governmentValue: null,
      transactionValue: benchmarkSource?.medianTransactionEur ?? null,
      transactionPeriod: dvf.transactionWindow ?? null,
      marketArea: raw.commune?.name ?? null,
      source: "INSEE + DVF (DGFiP) + geo.api.gouv.fr",
      coverage: benchmarkSource?.medianEurPerM2 != null ? "city" : "none",
      // Real government/open-data rental benchmark (data.gouv.fr commune
      // rental dataset) that was already being fetched but never used —
      // lets us estimate rent/yield even when the user doesn't type one in.
      rentalBenchmark: rental.available && !isPrimeOutlier
        ? { monthlyRentPerSqm: rental.rentEurPerM2 ?? null, grossYieldPercent: rental.grossYieldPct ?? null, source: rental.source }
        : null,
      priceTrendPercent: raw.housingPriceIndex?.annualVariation ?? null,
      // DVF is transaction-level open data — api/france-intelligence.js's
      // fetchDvf() already geocodes the property and finds up to 15 real
      // nearby sales of the same property type within 2km, sorted nearest
      // first (raw.dvf.micro.nearest). That was already being fetched to
      // compute the micro-location benchmark above but the individual
      // transactions themselves were discarded — real, dated, sourced
      // comps a buyer can actually go verify, not a modeled estimate.
      comparableSales: Array.isArray(dvf.micro?.nearest) && dvf.micro.nearest.length
        ? dvf.micro.nearest.slice(0, 5)
        : null
    };
  }

  if (c === "spain") {
    const benchmark = raw.benchmarkEurPerM2 ?? raw.pricePerM2 ?? null;
    // FIX: api/market-data.js already fetches, parses and returns real
    // MIVAU transaction-count/value data (raw.transactionMarket) and a
    // finer-grained INE municipality-level benchmark (raw.municipalBenchmark)
    // — this branch used to hardcode transactionValue/transactionPeriod to
    // null and never look at either, despite the data sitting right there.
    // It also never set priceTrendPercent, so Spain properties always
    // scored neutral on the Pradixium Score's price-trend factor while
    // every other country's branch fed it real data.
    const tx = raw.transactionMarket || {};
    const transactionPeriod = tx.latestYear != null && tx.latestQuarter != null
      ? `Q${tx.latestQuarter} ${tx.latestYear}`
      : null;
    return {
      benchmarkValue: benchmark,
      benchmarkUnit: "perSqm",
      benchmarkLabel: "MIVAU Benchmark",
      governmentValue: raw.governmentValue ?? null,
      transactionValue: tx.transactionValue ?? null,
      transactionPeriod,
      marketArea: raw.city || raw.province || null,
      source: "MIVAU / INE / Catastro",
      coverage: benchmark != null ? "city" : "none",
      priceTrendPercent: raw.annualChangePercent ?? null,
      // A finer-grained, independently-sourced municipality-level
      // benchmark (INE Table 69337) than the province-level MIVAU figure
      // above — surfaced as a secondary reference, not a replacement,
      // since it comes from a different dataset with its own vintage.
      municipalBenchmark: raw.municipalBenchmark ?? null
    };
  }

  if (c === "united kingdom" || c === "uk") {
    const tx = raw.transactionEvidence || {};
    const rental = raw.rental || {};
    return {
      benchmarkValue: raw.averagePrice ?? null,
      benchmarkUnit: "total",
      benchmarkLabel: "UK HPI Average Price",
      governmentValue: null,
      transactionValue: tx.medianTransactionPrice ?? null,
      transactionPeriod: tx.transactionWindow ?? null,
      marketArea: raw.city || "United Kingdom",
      source: "HM Land Registry — House Price Index + Price Paid Data",
      coverage: raw.averagePrice != null ? "city" : "none",
      priceTrendPercent: raw.annualChangePercent ?? null,
      // ONS's average rent by region is a flat total for the area, not a
      // per-m² rate — same convention as the price benchmark above.
      rentalBenchmark: rental.available
        ? { monthlyRentFlat: rental.monthlyRentGbp ?? null, grossYieldPercent: null, source: rental.source }
        : null,
      // FIX: api/uk-intelligence.js's fetchTransactionEvidence() already
      // fetches up to 15 real, dated HM Land Registry Price Paid sales
      // (tx.latestTransactions) to compute the median/mean above — the
      // individual sales themselves were discarded, same bug already
      // fixed for France's DVF data. Unlike France's geocoded radius
      // search, this adapter has no distance/per-m² figures (only a
      // total price and the matched address), so entries carry `address`
      // and `price` instead of `distanceKm`/`eurPerM2` — renderComparableSales()
      // in engine.js and report.html handle both shapes.
      comparableSales: Array.isArray(tx.latestTransactions) && tx.latestTransactions.length
        ? tx.latestTransactions.slice(0, 5).map((t) => ({
            address: t.address,
            // HM Land Registry's raw PPD code (D/S/T/F/O) — decode to a
            // readable word, same convention as France's full-word type.
            type: { D: "Detached", S: "Semi-detached", T: "Terraced", F: "Flat/Maisonette", O: "Other" }[t.propertyType] || null,
            price: t.price,
            date: t.date
          }))
        : null
    };
  }

  if (c === "belgium") {
    const region = raw.region || null;
    const bucket = raw.propertyTypeBucket || null;
    const prestige = raw.prestige || null;
    // FIX: Statbel has no street-level data for Belgium (unlike France's
    // DVF, which has real nearby-transaction evidence down to street
    // level) — its regional median is a citywide average. Comparing a
    // known prime/diplomatic street (Avenue Louise, Sablon, the European
    // Quarter...) against that flat number produced a nonsensical
    // "massively overpriced" read for a legitimately expensive address.
    // Suppress the numeric comparison for these zones instead of asserting
    // a benchmark we know doesn't apply — same treatment as Paris's
    // Triangle d'Or and the U.S. prime-zone detector.
    if (prestige?.isPrime) {
      return {
        benchmarkValue: null,
        benchmarkUnit: "total",
        benchmarkLabel: `Statbel Median Price (${region || "National"}) — not representative of ${prestige.zone}`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: raw.period ?? null,
        marketArea: `${prestige.zone} (prime/diplomatic district) — street-level benchmark not available`,
        source: `${prestige.note} Statbel's regional median (${raw.medianPrice != null ? "€" + raw.medianPrice.toLocaleString("en-US") : "n/a"}) is a citywide average and not a valid comparison for this micro-market; no street-level Belgian government benchmark is available.`,
        coverage: "none",
        // The regional YoY trend is a legitimate signal even here — it's
        // not a street-level price comparison (the thing being suppressed
        // above), just a market-momentum figure for the region.
        priceTrendPercent: raw.annualChangePercent ?? null
      };
    }
    return {
      benchmarkValue: raw.medianPrice ?? null,
      benchmarkUnit: "total",
      benchmarkLabel: region ? `Statbel Median Price (${region})` : "Statbel Median Price (National)",
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: raw.period ?? null,
      marketArea: region || `${countryLabel(country)} — region not matched`,
      source: bucket
        ? `Statbel — ${raw.annualChangePercent != null ? (raw.annualChangePercent >= 0 ? "+" : "") + raw.annualChangePercent + "% YoY" : "unavailable"}${raw.volatilityNote ? ` (${raw.volatilityNote})` : ""}`
        : "Statbel — no benchmark for this property type",
      coverage: raw.medianPrice != null ? (region ? "regional" : "national") : "none",
      priceTrendPercent: raw.annualChangePercent ?? null
    };
  }

  if (c === "united states" || c === "usa" || c === "us") {
    const val = raw.valuationEvidence || {};
    const tx = raw.transactionEvidence || {};
    // FIX: when the county parcel/appraiser record can't be found (ArcGIS
    // discovery is a keyword search over public services — it doesn't
    // cover every county, and can also simply time out), FHFA's state/metro
    // HPI trend was still being fetched successfully and used by the agent
    // in its highlights, but never surfaced here — the Market Evidence
    // section showed blank "Not available" even though a real number
    // existed one level up. Now surfaced as national/state context, same
    // pattern as Germany/Italy/Portugal's national-index-only fallback.
    const macro = raw.macroEvidence || {};
    // Metro HPI (exact FHFA series for the property's county in the top
    // 20 metros — lib/data/usMetros.js) is the closer benchmark; the
    // state-wide index is only the fallback when no metro series matched.
    const metroHpi = macro.fhfaMetro?.oneYear != null ? macro.fhfaMetro : null;
    const stateHpi = metroHpi || macro.fhfaState || {};
    return {
      benchmarkValue: val.valuePerSqFt ?? null,
      benchmarkUnit: "perSqft",
      benchmarkLabel: "US Fair Value / Sq Ft",
      governmentValue: val.fairValue ?? null,
      transactionValue: tx.salePrice ?? null,
      transactionPeriod: tx.saleDate ?? null,
      marketArea: raw.property?.county || raw.area || raw.city || null,
      // FIX: when NEITHER the county parcel lookup NOR the FHFA state HPI
      // came back, this fell all the way through to the generic "U.S.
      // Census Bureau + FHFA..." citation string — which reads like a
      // source backing real numbers, when every benchmark/transaction
      // field above it is actually null. Now says plainly that no match
      // was found, instead of implying data that isn't there.
      source: [val.fairValue != null
        ? (val.source || "U.S. Census Bureau + FHFA + public property records")
        : stateHpi.oneYear != null
          ? `No county property record found — FHFA ${stateHpi.name || "state"} ${metroHpi ? "metro " : ""}HPI: ${stateHpi.oneYear >= 0 ? "+" : ""}${stateHpi.oneYear}% YoY${stateHpi.period ? ` (${stateHpi.period})` : ""}.`
          : "No official price benchmark found for this address — county property record and state price index both unavailable.",
        nycSalesContext(macro.nycSales)].filter(Boolean).join(" "),
      coverage: val.fairValue != null ? "property" : (raw.macroEvidence ? "national" : "none"),
      priceTrendPercent: stateHpi.oneYear ?? null
    };
  }

  if (c === "portugal") {
    const hpi = raw.housingPriceIndex || {};
    const change = hpi.annualChangePercent ?? hpi.annualVariation ?? null;
    const rental = raw.rental || {};
    return {
      benchmarkValue: null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: "INE Portugal HPI (National)",
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: hpi.period ?? hpi.quarter ?? null,
      marketArea: `${countryLabel(country)} — city-level price data not yet connected`,
      source: `INE Portugal — national index ${change != null ? (change >= 0 ? "+" : "") + change + "% YoY" : "unavailable"}`,
      coverage: "national",
      priceTrendPercent: change ?? null,
      // INE's median-rent-per-m² for new rental contracts is a real,
      // named government figure (not an estimate) — lets the score
      // estimate yield even when the user hasn't typed a rent in,
      // same pattern as France's data.gouv.fr rental dataset.
      rentalBenchmark: rental.available
        ? { monthlyRentPerSqm: rental.rentEurPerM2 ?? null, grossYieldPercent: null, source: rental.source }
        : null
    };
  }

  if (c === "greece") {
    const hpi = raw.housingPriceIndex || {};
    const change = hpi.annualChangePercent ?? null;
    const rentTrend = raw.rentTrend || null;
    return {
      benchmarkValue: null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: "Bank of Greece HPI (National)",
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: hpi.period ?? null,
      marketArea: `${countryLabel(country)} — city-level price data not yet connected`,
      // Bank of Greece also publishes a residential rent price index
      // (an index, not an absolute €/m² — can't feed a yield estimate the
      // way France's/Portugal's per-m² rent data can, but the YoY trend
      // is real and worth showing rather than omitting).
      source: `Bank of Greece — national index ${change != null ? (change >= 0 ? "+" : "") + change + "% YoY" : "unavailable"}${rentTrend?.available ? `. Rents (national): ${rentTrend.annualChangePercent >= 0 ? "+" : ""}${rentTrend.annualChangePercent}% YoY (${rentTrend.period})` : ""}`,
      coverage: "national",
      priceTrendPercent: change ?? null
    };
  }

  const EUROSTAT_ONLY_COUNTRIES = [
    "netherlands", "poland", "austria", "switzerland", "czech republic", "czechia", "hungary", "bulgaria",
    "croatia", "cyprus", "denmark", "estonia", "finland", "ireland", "latvia", "lithuania",
    "luxembourg", "malta", "romania", "slovakia", "slovenia", "sweden", "norway", "iceland"
  ];
  if (c === "germany" || c === "italy" || c === "israel" || c === "united arab emirates" || EUROSTAT_ONLY_COUNTRIES.includes(c)) {
    const hpi = raw.housingPriceIndex || {};
    const change = hpi.annualChangePercent ?? hpi.annualVariation ?? null;
    const sourceName = c === "germany" ? "Destatis" : c === "italy" ? "Istat" : c === "israel" ? "CBS Israel" : c === "united arab emirates" ? "Dubai Land Department" : "Eurostat";
    const trendSource = `${sourceName} — national index ${change != null ? (change >= 0 ? "+" : "") + change + "% YoY" : "unavailable"}`;
    // FIX: this branch only ever had a % trend (no absolute price), leaving
    // "Market Benchmark" blank for every one of these countries — the exact
    // gap a user flagged ("find the average price of a property recently
    // purchased in the area"). lib/data/recentTransactionPrices.js supplies
    // a real, sourced absolute figure (national stats office, land
    // registry, or recognized market observatory — actual registered
    // transactions preferred over asking-price indices) where research
    // found one; countries without a credible source stay blank rather
    // than guess, same discipline as every other data module here.
    const recent = getRecentTransactionPrice(country);
    if (recent) {
      return {
        benchmarkValue: recent.value,
        benchmarkUnit: recent.unit,
        benchmarkLabel: `${recent.source} (${recent.area})`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: recent.period,
        marketArea: recent.area,
        source: `${recent.source} — ${recent.basis}. ${trendSource}.`,
        coverage: /national/i.test(recent.area) ? "national" : "city",
        priceTrendPercent: change ?? null
      };
    }
    return {
      benchmarkValue: null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: `${sourceName} HPI (National)`,
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: hpi.period ?? hpi.quarter ?? null,
      // Dubai's index isn't a UAE-wide figure — say so rather than implying
      // national coverage the source doesn't have.
      marketArea: c === "united arab emirates" ? "Dubai only — other emirates not covered" : `${countryLabel(country)} — city-level data not yet connected`,
      source: trendSource,
      coverage: "national",
      priceTrendPercent: change ?? null
    };
  }

  const REGIONAL_FIXTURE_COUNTRIES = [
    "serbia", "bosnia and herzegovina", "montenegro", "north macedonia", "ukraine", "albania", "andorra", "monaco",
    "russia", "kazakhstan", "canada", "mexico", "brazil", "australia", "new zealand", "argentina",
    "chile", "colombia", "peru", "uruguay", "dominican republic",
    "thailand", "indonesia", "south korea", "india", "japan", "vietnam", "sri lanka", "cambodia"
  ];
  if (REGIONAL_FIXTURE_COUNTRIES.includes(c)) {
    const benchmarkValue = raw.cityBenchmarkValue ?? raw.nationalBenchmarkValue ?? null;
    const changePercent = raw.cityBenchmarkValue != null ? raw.cityChangePercent : (raw.nationalChangePercent ?? raw.cityChangePercent);
    const area = raw.cityName || countryLabel(country);
    return {
      benchmarkValue,
      benchmarkUnit: raw.benchmarkUnit || "perSqm",
      benchmarkLabel: `${countryLabel(country)} Official Estimate${raw.cityName ? ` (${raw.cityName})` : ""}`,
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: raw.period ?? null,
      marketArea: area,
      source: `${raw.sources?.official || countryLabel(country)}${changePercent != null ? ` — ${changePercent >= 0 ? "+" : ""}${changePercent}% YoY` : ""}${raw.coverageNote ? ` (${raw.coverageNote})` : ""}`,
      coverage: benchmarkValue != null ? (raw.cityBenchmarkValue != null ? "city" : "national") : "national",
      priceTrendPercent: changePercent ?? null
    };
  }

  return null;
}

function countryLabel(country) {
  return String(country || "").trim() || "This market";
}

async function fetchGovernmentData(property, origin) {
  const country = String(property?.country || "").trim().toLowerCase();
  const endpoint = COUNTRY_ENDPOINTS[country];
  if (!endpoint) return null;

  const params = new URLSearchParams();
  if (property.city) params.set("city", property.city);
  if (property.address) params.set("address", property.address);
  if (property.country) params.set("country", property.country);
  if (property.propertyType) params.set("propertyType", property.propertyType);
  if (property.state) params.set("state", property.state);
  if (property.zip) params.set("zip", property.zip);
  if (property.postalCode) params.set("postalCode", property.postalCode);
  if (property.price) params.set("askingPrice", property.price);
  // FIX: never forwarded before — Spain's /api/market-data needs size to
  // compute governmentValue (benchmark × size), so that field and the
  // "Asking vs Market" gap silently stayed empty even when everything
  // needed for them was right there in the property the user submitted.
  if (property.size) params.set("size", property.size);

  const controller = new AbortController();
  // market-data.js runs its 3 sources in parallel with 8s timeouts each,
  // so it always resolves well under 10s. 15s here is a safe margin.
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(`${origin}/api/${endpoint}?${params.toString()}`, { signal: controller.signal });
    if (!r.ok) return null;
    const json = await r.json();
    return json?.success ? json.data || json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Same public project URL/anon key already committed in
// api/create-checkout-session.js and supabase-config.js for the client —
// meant to be public (RLS is what actually protects the data).
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";

// The free preview and the paid $29 report were rendering the exact same
// analysis — paying unlocked nothing except a nicer printable layout of
// content already fully visible for free. The real gate has to be here,
// server-side: redacting fields client-side only hides them visually while
// the full JSON still sits in the network response for anyone to read.
//
// Mirrors engine.js's isReportPaid() exactly (same signature format, same
// purchases-table logic), but reads Supabase directly with the caller's
// own bearer token so Postgres RLS scopes the query to their own rows —
// this endpoint never sees or needs the service-role key.
async function checkEntitlement(authHeader, signature) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/purchases?select=kind,report_signature,expires_at`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!r.ok) return false;
    const rows = await r.json();
    if (!Array.isArray(rows)) return false;
    const now = Date.now();
    return rows.some((row) => {
      if (row.kind === "subscription" || row.kind === "business") return row.expires_at && new Date(row.expires_at).getTime() > now;
      return row.kind === "report" && row.report_signature === signature;
    });
  } catch {
    return false;
  }
}

// Strips the fields that are only worth paying for, leaving the score,
// deal rating and confidence visible for free — a real signal, not just a
// teaser, but not the reasoning behind it either.
function redactForPreview(agentResult) {
  if (!agentResult || typeof agentResult !== "object") return agentResult;
  const LOCKED_ACTION = "Unlock the full report to see the investor action recommendation.";
  const redacted = {
    ...agentResult,
    fairValue: null,
    fairValueBasis: "Unlock the full report to see the Fair Value estimate and how it was derived.",
    investmentHighlights: [],
    keyRisks: [],
    investorAction: LOCKED_ACTION,
    reasoning: "Unlock the full report to see the reasoning behind this score."
  };
  if (agentResult.localizedContent) {
    redacted.localizedContent = {
      ...agentResult.localizedContent,
      investmentHighlights: [],
      keyRisks: [],
      investorAction: LOCKED_ACTION
    };
  }
  return redacted;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST required" });
  }

  // FIX: this used to bail out of the entire request — including fetching
  // government data — the instant ANTHROPIC_API_KEY was missing. On any
  // environment where that key isn't configured (e.g. a Vercel preview
  // deployment that only has it set for Production), the client got
  // nothing at all: no Market Evidence, no Demand Intelligence, no
  // Pradixium Score — even though every one of those comes from
  // MIVAU/DVF/FHFA/etc. and has nothing to do with the AI agent. The key
  // is only needed for the AI agent step below; government data and the
  // deterministic score must never depend on it.
  const apiKey = process.env.ANTHROPIC_API_KEY;

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ success: false, error: "Invalid JSON body" });
  }

  const { property, agents } = body || {};
  if (!property || typeof property !== "object") {
    return res.status(400).json({ success: false, error: "property object is required" });
  }

  // The client can still pass pre-fetched marketData for backward
  // compatibility, but the orchestrator is now the source of truth: it
  // fetches fresh government data itself whenever it's missing.
  //
  // FIX: the previous version only ever read body.marketData, but the
  // client (engine.js) never sends one — so marketData was always
  // undefined and never made it into the response. Market Evidence and
  // Demand Intelligence on the property page rendered "Not available"
  // even though real MIVAU/INE/Registradores data existed and was being
  // computed correctly by /api/market-data.

  // Same signature format as engine.js's reportSignature() and the
  // report_signature column written by verify-checkout-session.js when a
  // one-time report purchase completes.
  const signature = [property.country, property.city, property.price, property.size].join("|");
  const entitlementPromise = checkEntitlement(req.headers.authorization, signature);

  let marketData = body?.marketData || null;
  if (!marketData) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = `${proto}://${req.headers.host}`;
    marketData = await fetchGovernmentData(property, origin);
  }

  const marketEvidence = normalizeMarketEvidence(property.country, marketData, property.propertyType);

  // The Pradixium Score is a deterministic, weighted calculation over
  // whatever real data is available (rental yield, the asking price vs
  // the government benchmark, foreign-buyer demand) — never an LLM guess.
  // It's computed once here, server-side, and handed to every agent that
  // needs it so they all reason from the same number instead of each
  // inventing their own.
  const pradixiumScore = computePradixiumScore({ property, marketEvidence, demand: marketData?.demand || null });

  // A distinguishing feature for a platform built around the foreign-
  // buyer market: does this country actually let a non-resident foreign
  // national buy this kind of property, and is there a cost/approval
  // step that applies only to foreign buyers? Only covers countries with
  // a verified, citable rule (see lib/data/foreignBuyerRules.js) — silent
  // (null) everywhere else rather than assuming "no restriction".
  const foreignBuyerAccess = getForeignBuyerRule(property.country);

  // Estimated taxes/closing costs a buyer pays on top of the asking price
  // (transfer tax, notary/legal fees, agency commission convention) — only
  // covers countries with a verified, citable rate (see
  // lib/data/closingCosts.js), silent everywhere else rather than
  // guessing a number.
  const closingCosts = getClosingCosts(property.country);

  // Recurring annual ownership tax (property tax / taxe foncière / IBI /
  // Council Tax / Arnona, etc.) — a separate, ongoing cost from the
  // one-time closing costs above. Same rule: only covers countries with a
  // verified, citable rate (see lib/data/propertyTax.js), silent
  // everywhere else.
  const propertyTax = getPropertyTax(property.country);

  // Real, legally-binding currency/capital-transfer controls on moving
  // money into the country to fund the purchase, or repatriating proceeds
  // later — distinct from ordinary exchange-rate risk. Same rule: only
  // covers countries with a verified, citable rule (see
  // lib/data/currencyControls.js), silent everywhere else.
  const currencyControls = getCurrencyControls(property.country);

  // Reality Check™ — "does the evidence actually support the asking price
  // and the story being told about it?" Deterministic, layered on top of
  // the same evidence above rather than a new data source or an LLM
  // opinion. See lib/scoring/realityCheck.js for the check-by-check logic.
  const realityCheck = computeRealityCheck({ pradixiumScore, foreignBuyerAccess, closingCosts });

  // So local clients (a seller, their agent, a notary) in the property's
  // own market can read the report too — the AI agent below is asked to
  // also translate its analysis into this language, in the same call.
  const reportLanguage = resolveReportLanguage(property.country, property.city);

  const requestedAgents = Array.isArray(agents) && agents.length ? agents : Object.keys(AGENT_REGISTRY);
  const results = {};
  const errors = {};

  if (!apiKey) {
    requestedAgents.forEach((name) => {
      errors[name] = "ANTHROPIC_API_KEY is not configured on the server.";
    });
  } else {
    await Promise.all(
      requestedAgents.map(async (name) => {
        const run = AGENT_REGISTRY[name];
        if (!run) {
          errors[name] = "Unknown agent";
          return;
        }
        try {
          results[name] = await run({ property, marketData, marketEvidence, pradixiumScore, reportLanguage }, apiKey);
        } catch (err) {
          errors[name] = String(err?.message || err);
        }
      })
    );
  }

  const paid = await entitlementPromise;
  if (!paid) {
    Object.keys(results).forEach((name) => {
      results[name] = redactForPreview(results[name]);
    });
  }

  return res.status(200).json({
    success: true,
    results,
    marketData,
    marketEvidence,
    pradixiumScore,
    realityCheck,
    foreignBuyerAccess,
    closingCosts,
    propertyTax,
    currencyControls,
    reportLanguage,
    paid,
    errors: Object.keys(errors).length ? errors : undefined
  });
}
