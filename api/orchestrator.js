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
 *
 * This is also the Business plan's API — the same Authorization header
 * accepts a "px_live_..." key (see api/business-api-key.js) in place of a
 * signed-in user's Supabase JWT, always resolving to paid:true while the
 * key's owner has an active Business plan (checkApiKeyEntitlement()).
 */

import { licenceNotices } from "../lib/data/licences.js";
import { spainRent } from "../lib/spain/rents.js";
import { usRent, usPlaceKey } from "../lib/us/rents.js";
import { usPropertyTax } from "../lib/us/tax.js";
import { newZealandRent } from "../lib/newzealand/rents.js";
import { japanRent } from "../lib/japan/rents.js";
import { irelandRent } from "../lib/ireland/rents.js";
import { canadaRent } from "../lib/canada/rents.js";
import { finlandRent } from "../lib/finland/rents.js";
import { norwayRent } from "../lib/norway/rents.js";
import { swedenRent, swedenCondo } from "../lib/sweden/rents.js";
import { createHash } from "node:crypto";
import { runPropertyInvestmentAgent } from "../lib/agents/propertyInvestmentAgent.js";
import { computePradixiumScore } from "../lib/scoring/pradixiumScore.js";
import { computeRealityCheck } from "../lib/scoring/realityCheck.js";
import { resolveReportLanguage } from "../lib/i18n/reportLanguage.js";
import { getForeignBuyerRule } from "../lib/data/foreignBuyerRules.js";
import { getClosingCosts } from "../lib/data/closingCosts.js";
import { getPropertyTax } from "../lib/data/propertyTax.js";
import { getCurrencyControls } from "../lib/data/currencyControls.js";
import { zurichCondo } from "../lib/europe/zurichCity.js";
import { dubaiBenchmark } from "../lib/uae/dubaiSales.js";
import { australiaBenchmark } from "../lib/australia/absPrices.js";
import { saoPauloBenchmark } from "../lib/brazil/saoPaulo.js";
import { mexicoBenchmark } from "../lib/mexico/shf.js";
import { canadaTrend } from "../lib/canada/nhpi.js";
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
  "japan": "japan-intelligence",
  "vietnam": "pending-intelligence",
  "sri lanka": "regional-fixture-intelligence",
  "cambodia": "regional-fixture-intelligence",
  // Listed in the dropdown for global coverage, but no verified official
  // source has been found yet — see api/pending-intelligence.js for what
  // was checked. Returns an honest "not yet connected" status rather
  // than a fabricated number.
  "armenia": "regional-fixture-intelligence",
  "georgia": "regional-fixture-intelligence",
  "south africa": "regional-fixture-intelligence",
  "morocco": "regional-fixture-intelligence",
  "kenya": "regional-fixture-intelligence",
  "nigeria": "pending-intelligence",
  "egypt": "pending-intelligence",
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
  "united arab emirates": "uae-intelligence",
  // TÜİK (Turkey's statistics institute) only publishes sales VOLUME
  // stats, not prices — the real official price benchmark is TCMB's
  // (the central bank's) Konut Fiyat Endeksi (Housing Price Index),
  // series TP.KFE.TR, via its EVDS API. Needs a free registered API key
  // (TCMB_EVDS_API_KEY env var) — degrades honestly if unset, same
  // pattern as ANTHROPIC_API_KEY.
  "turkey": "turkey-intelligence",
  "singapore": "singapore-intelligence",
  "hong kong": "hong-kong-intelligence"
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
// LA County Assessor context (api/us-intelligence.js laAssessor). The
// property's own last recorded sale is shown in the Transaction rows; this
// adds the Prop 13 roll value and the same-ZIP change-of-ownership
// values as labelled text only — never benchmarkValue / the verdict.
// New Jersey (api/us-intelligence.js njEvidence) — the municipal median
// is the benchmark above; this line says exactly what it is.
function njSalesContext(n, benchmark) {
  if (!n || n.status !== "ok") return null;
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const muni = n.municipality?.name || "this municipality";
  const parts = [];
  if (benchmark) {
    parts.push(`Benchmark: NJ Treasury — ${benchmark.sales} usable (arm's-length) sales of ${benchmark.typeLabel} in ${muni} (${benchmark.periodFrom} to ${benchmark.periodTo}), median ${usd(benchmark.valuePerSqFt)} per sq ft of living area${n.stats?.medianPrice ? `, median price ${usd(n.stats.medianPrice)}` : ""}.`);
  } else if (n.stats) {
    parts.push(`NJ Treasury: ${n.stats.sales} usable sales of ${n.typeLabel} in ${muni}, median price ${usd(n.stats.medianPrice)} (too few with living area for a per-sq-ft figure).`);
  } else {
    parts.push(`NJ Treasury: fewer than 10 usable sales of ${n.typeLabel} in ${muni} in the last 12 months — no local benchmark.`);
  }
  if (n.parcel?.lastSale) parts.push(`Property's last sale on the state tax list: ${usd(n.parcel.lastSale.price)} on ${n.parcel.lastSale.date}.`);
  return parts.join(" ");
}

// New York State outside NYC (api/us-intelligence.js nysParcel).
function nysParcelContext(n) {
  if (!n) return null;
  if (n.status === "multiple_units") return "NYS tax roll: several units at this address — add the unit number for the unit's own record.";
  if (n.status !== "ok") return null;
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const facts = [n.livingAreaSqFt && `${n.livingAreaSqFt.toLocaleString("en-US")} sq ft living`, n.bedrooms && `${n.bedrooms} bd`, n.bathrooms && `${n.bathrooms} ba`, n.yearBuilt && `built ${n.yearBuilt}`].filter(Boolean).join(", ");
  return `NYS tax roll (${n.municipality || n.county}${n.rollYear ? `, roll ${n.rollYear}` : ""}): ${facts || "property record found"}.${n.fullMarketValue ? ` Full market value ${usd(n.fullMarketValue)} — assessed value ÷ state equalization rate, not an appraisal; context only.` : ""}`;
}

function laAssessorContext(a) {
  if (!a) return null;
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const parts = [];
  if (a.parcel) {
    parts.push(`LA County Assessor parcel ${a.parcel.ain}${a.lastSale ? `: last recorded sale ${usd(a.lastSale.price)} on ${a.lastSale.date} (documentary transfer tax)` : ": no recorded sale for consideration on file"}.`);
    if (a.assessedValue) parts.push(`${a.assessedValue.rollYear} assessed value ${usd(a.assessedValue.value)} — Prop 13 (purchase price + max 2%/yr), not current market value.`);
  } else if (a.parcelStatus === "multiple_units") {
    parts.push(`LA County Assessor: this address has several units — add the unit number (e.g. "#2A") to get the unit's own sale record.`);
  }
  const z = a.zipContext;
  if (z?.status === "ok") {
    parts.push(`ZIP ${z.zip} context: ${z.parcels} ${z.category} re-valued by the Assessor on a change of ownership (${z.periodFrom} to ${z.periodTo}), median ${usd(z.medianPerSqFt)} per sq ft — for regular sales this equals the recorded price; context only, not used in the verdict.`);
  } else if (z?.status === "insufficient") {
    parts.push(`ZIP ${z.zip}: only ${z.parcels} ${z.category} re-valued on a change of ownership in the latest open roll — not enough for a local figure.`);
  }
  return parts.length ? parts.join(" ") + " Source: Los Angeles County Assessor." : null;
}

// One-line area figure for the uniform record table (same numbers as the
// text below it, never a separate estimate).
function usAreaMedian(n) {
  if (!n) return null;
  const f = (x) => "$" + Math.round(x).toLocaleString("en-US");
  if (n.status === "ok" && n.medianPerGrossSqFt) return `${f(n.medianPerGrossSqFt)} per gross sq ft · ${n.salesCount} sales of ${n.category}, ZIP ${n.zip}, 12 months (context only)`;
  if (n.status === "ok_condo" && n.medianPerUnitGrossSqFt) return `${f(n.medianPerUnitGrossSqFt)} per sq ft of unit share · ${n.condoSalesCount} condo sales, ZIP ${n.zip}, 12 months (context only)`;
  if (n.coopMedianPrice) return `${f(n.coopMedianPrice)} median co-op price · ${n.coopSalesCount} sales, ZIP ${n.zip}, 12 months (context only)`;
  return null;
}

// Greece: the Ministry of Finance zone price (τιμή ζώνης) as record rows.
// A tax base, not a market price → never the benchmark (lib/greece/zones.js)
function greeceRecord(z, property) {
  if (!z || !z.status) return { record: null, parts: [] };
  const eur = (x) => "€" + Math.round(x).toLocaleString("en-US");
  const official = "Ministry of Finance / ΑΑΔΕ — objective value zone prices (τιμές ζώνης)";
  const why = {
    not_found: "The address was not found — enter the street and number with the town (Greek or Latin letters) for the property's official zone price.",
    outside_zones: "This location is outside the zone-price system (areas outside a town plan are valued by a different method) — no zone price.",
    unavailable: "The Ministry of Finance zone map did not answer this time — run the analysis again for the zone price.",
    timeout: "The Ministry of Finance zone map did not answer in time — run the analysis again for the zone price."
  }[z.status];
  const first = z.zone || z.zones?.[0] || z.area || {};
  const since = first.validFrom ? `, in force since ${first.validFrom}${first.revision ? ` (${first.revision} revision)` : ""}` : "";
  const rows = [{ label: "Official record", value: why || `${official}${since}`, url: why ? null : (first.tablesUrl || "https://maps.gsis.gr/valuemaps/") }];
  if (z.matched) rows.push({ label: "Address matched", value: z.matched });
  const parts = [];
  const nature = "A zone price is the tax base the Ministry of Finance multiplies (by floor, age and frontage coefficients) to get a property's objective value for transfer tax and ENFIA — an official figure, but not a market price.";
  const price = Number(property?.price), size = Number(property?.size);
  const askRow = (v) => { if (price > 0 && size > 0 && v > 0) rows.push({ label: "Asking price per m²", value: `${eur(price / size)}/m² — ${(price / size / v).toFixed(2)}× the zone price (different bases: the zone price is a tax base)` }); };
  const zoneLabel = (x) => `zone ${x.name}, code ${x.id}`;
  if (z.status === "frontage") {
    rows.push({ label: "Zone price (street frontage)", value: `${eur(z.zone.value)}/m² — ${zoneLabel(z.zone)}: buildings facing ${z.zone.description}` });
    (z.areaZones || []).forEach((a) => rows.push({ label: "Area zone behind the street", value: `${eur(a.value)}/m² — ${zoneLabel(a)}` }));
    askRow(z.zone.value);
    parts.push({ title: "Official zone price (τιμή ζώνης)", text: `This address faces ${z.zone.description}, a street-frontage zone priced at ${eur(z.zone.value)}/m² (${zoneLabel(z.zone)}${since}). ${nature}` });
  } else if (z.status === "area") {
    rows.push({ label: "Zone price (area zone)", value: `${eur(z.zone.value)}/m² — ${zoneLabel(z.zone)}` });
    (z.frontage || []).forEach((f) => rows.push({ label: "Street-frontage zone nearby", value: `${eur(f.value)}/m² — only if the building faces ${f.description}` }));
    askRow(z.zone.value);
    parts.push({ title: "Official zone price (τιμή ζώνης)", text: `This address is in area zone ${z.zone.name} (code ${z.zone.id}), zone price ${eur(z.zone.value)}/m²${since}. ${nature}` });
  } else if (z.status === "several") {
    z.zones.forEach((a) => rows.push({ label: `Zone ${a.name} (code ${a.id})`, value: `${eur(a.value)}/m²` }));
    rows.push({ label: "For this property's own zone", value: "the address lies on a boundary between zones — the zone depends on which side the building stands; none is chosen" });
    parts.push({ title: "Official zone prices (τιμές ζώνης)", text: `The address lies between ${z.zones.length} zones (${z.zones.map((a) => eur(a.value) + "/m²").join(", ")})${since}. ${nature}` });
  } else if (z.status === "range") {
    const a = z.area;
    rows.push({ label: "Zone prices in the area", value: `${eur(a.min)}–${eur(a.max)}/m², median ${eur(a.median)} — ${a.zones} area zones of the municipal unit ${a.unit} (municipality ${a.dimos})` });
    if (z.around) rows.push({ label: "Zones around this neighbourhood", value: `${z.around.zones} zone${z.around.zones > 1 ? "s" : ""} within 400 m of its centre: ${z.around.min === z.around.max ? eur(z.around.min) : `${eur(z.around.min)}–${eur(z.around.max)}`}/m²` });
    rows.push({ label: "For this property's own zone", value: "enter the street and number" });
    parts.push({ title: "Official zone prices (τιμές ζώνης)", text: `${a.zones} area zones in the municipal unit ${a.unit}: ${eur(a.min)}–${eur(a.max)}/m², median ${eur(a.median)}${since}. ${nature} Enter the street and number for the property's own zone.` });
  } else if (why) {
    parts.push({ title: "Official zone price (τιμή ζώνης)", text: why });
  }
  return { record: { found: ["frontage", "area", "several", "range"].includes(z.status), rows }, parts };
}

// Spain: the Catastro zone as uniform record rows (rendered by the same
// "Official property record" table as the US)
function spainRecord(cz, property) {
  const eur = (x) => "€" + Math.round(x).toLocaleString("en-US");
  const prod = (t) => `${t.type}, ${String(t.category || "").toLowerCase()} category, ${t.builtM2} m² built${t.plotM2 ? `, plot ${t.plotM2.toLocaleString("en-US")} m²` : ""}, ${t.ageYears} years old`;
  const val = (t) => t.perM2Comparable ? `${eur(t.valuePerM2)}/m² (${eur(t.value)} for the ${t.builtM2} m² representative home)` : `${eur(t.value)} for the representative home (land included — not a per-m² price)`;
  const src = (y) => `Catastro — official values map ${y || ""}, built from every sale signed before a notary or registered`;
  if (!cz) return { record: null, parts: [] };
  const why = {
    no_address: "Enter the street and number (or the resort / development's name as the town) for this property's official Catastro value zone.",
    not_geocoded: "The address was not found in Spain's official address register (CartoCiudad) — check the street name and number, and enter the town (not the island or coast).",
    no_town: "Add the town after the street (e.g. \"Calle Mayor 5, Altea\") for this property's official Catastro value zone.",
    town_only: "Only the town was recognised — enter the street and number for the property's own zone.",
    no_map: "No Catastro values map for this place: the Basque Country and Navarre keep their own cadastres (not covered yet), or the Catastro service did not answer.",
    several_zones: "The address sits on a boundary between Catastro zones — no single zone value is shown.",
    outside_zones: "The address is outside the Catastro's urban residential value zones.",
    area_no_product: "No representative home of this type in the Catastro zones around this place.",
    geocoder_error: "Spain's official address register (CartoCiudad) did not answer this time — run the analysis again for the property's Catastro zone.",
    error: "The Catastro service could not be read this time."
  }[cz.status];
  const price = Number(property?.price), size = Number(property?.size);
  const rows = [{ label: "Official record", value: why ? why : `${src(cz.mapYear)}${cz.zone ? ` — zone ${cz.zone}` : ""}`, url: why ? null : cz.sourceUrl }];
  if (cz.geo?.label) rows.push({ label: "Address matched", value: `${cz.geo.label}${cz.geo.refCatastral ? ` (cadastral ref. ${cz.geo.refCatastral})` : ""}` });
  const parts = [];
  if (cz.status === "ok") {
    const t = cz.product;
    rows.push({ label: "Zone's representative home", value: prod(t) });
    rows.push({ label: "Official average value (zone)", value: val(t) });
    if (t.perM2Comparable && price > 0 && size > 0) {
      const ask = price / size, gap = (ask / t.valuePerM2 - 1) * 100;
      rows.push({ label: "Asking price, same basis", value: `${eur(ask)}/m² — ${Math.abs(gap).toFixed(1)}% ${gap >= 0 ? "above" : "below"} the zone's value` });
    } else if (!t.perM2Comparable && price > 0) {
      rows.push({ label: "Asking price vs zone", value: `${eur(price)} vs ${eur(t.value)} for the zone's representative home (${t.builtM2} m², plot ${t.plotM2 || "—"} m²) — compare size and plot before concluding` });
    }
    rows.push({ label: "Homes in this zone", value: `${Number(cz.homesInZone || 0).toLocaleString("en-US")} (values map ${cz.mapYear}, sales data ${cz.dataYear || "—"})` });
    parts.push({ title: "Catastro value zone", text: `Official Catastro values map ${cz.mapYear}: this address is in zone ${cz.zone} (${cz.homesInZone} homes). The zone's representative home — ${prod(t)} — has an average value of ${val(t)}. The Catastro derives these modules from every sale formalised before a notary or registered; they are the basis of each property's official valor de referencia.` });
  } else if (cz.status === "other_type_only") {
    cz.otherProducts.forEach((t) => rows.push({ label: "Zone's representative home (other type)", value: `${prod(t)} → ${val(t)}` }));
    parts.push({ title: "Catastro value zone", text: `Official Catastro values map ${cz.mapYear}, zone ${cz.zone}: its representative home is a different type from this property (${cz.otherProducts.map(prod).join("; ")}), so no like-for-like value is given — context only.` });
  } else if (cz.status === "area") {
    const short = (t) => t.perM2Comparable ? `${eur(t.valuePerM2)}/m²` : `${eur(t.value)} whole home incl. plot`;
    const lo = (cz.rangeLow || cz.areaZones[0]).product, hi = (cz.rangeHigh || cz.areaZones[cz.areaZones.length - 1]).product;
    rows.push({ label: "Official zones around this place", value: `${cz.zonesAround || cz.areaZones.length} zones within 700 m — representative home from ${short(lo)} to ${short(hi)}${lo.perM2Comparable ? "" : " (a total for the zone's typical home, land included — not a per-m² price)"}; the ${cz.areaZones.length} closest:` });
    cz.areaZones.forEach((a) => rows.push({ label: `Zone ${a.zone}`, value: `${prod(a.product)} → ${short(a.product)} (${a.homesInZone} homes)` }));
    rows.push({ label: "For this property's own zone", value: cz.geo?.type === "callejero" ? "Spain's official address register has this street but not its house numbers — the zones around the street are shown; the property's own zone needs its cadastral reference" : cz.addressNotFound ? `the street address was not found in the official register (CartoCiudad) — showing the zones around ${cz.geo?.label}; check the street and number` : "enter its street and number" });
    parts.push({ title: "Catastro value zones around this place", text: `Official Catastro values map ${cz.mapYear}: ${cz.zonesAround || cz.areaZones.length} value zones within 700 m of ${cz.geo?.label}. Representative homes range from ${short(lo)} to ${short(hi)}${lo.perM2Comparable ? "" : " (totals for each zone's typical home, land included)"}. A named area is not an address, so no single zone value is applied to this property.` });
  } else if (why) {
    parts.push({ title: "Catastro value zone", text: why });
  }
  return { record: { found: cz.status === "ok" || cz.status === "area" || cz.status === "other_type_only", rows }, parts };
}

// Does a property in `city` belong to the area an official figure covers?
const RECENT_AREA_ALIASES = {
  "canton of zurich": ["zurich", "zuerich", "zürich", "winterthur"],
  "herzliya": ["herzliya", "herzeliya", "herzlia", "הרצליה"], "ramat gan": ["ramat gan", "ramat-gan", "רמת גן"], "jerusalem": ["jerusalem", "yerushalayim", "ירושלים"],
  "haifa": ["haifa", "חיפה"], "ashkelon": ["ashkelon", "אשקלון"], "be'er sheva": ["beer sheva", "be'er sheva", "beersheba", "beer-sheva", "באר שבע"],
  "canton of geneva": ["geneva", "geneve", "genève", "genf", "carouge", "cologny", "vernier", "lancy", "meyrin", "onex", "thonex", "thônex", "chene-bougeries", "chêne-bougeries", "plan-les-ouates", "veyrier", "collonge-bellerive", "vandoeuvres", "vandœuvres", "anieres", "anières", "hermance", "bernex", "versoix", "grand-saconnex", "le grand-saconnex", "pregny-chambesy", "pregny-chambésy", "bellevue", "genthod", "chene-bourg", "chêne-bourg", "confignon", "satigny", "troinex"],
  "capital region (höfuðborgarsvæðið)": ["reykjavik", "reykjavík", "kopavogur", "kópavogur", "hafnarfjordur", "hafnarfjörður", "gardabaer", "garðabær", "mosfellsbaer", "mosfellsbær", "seltjarnarnes"],
  "prague": ["prague", "praha"], "warsaw": ["warsaw", "warszawa"], "tel aviv": ["tel aviv", "tel aviv-yafo", "tel aviv yafo", "jaffa", "yafo"], "tel aviv-yafo": ["tel aviv", "tel aviv-yafo", "tel aviv yafo", "tel-aviv", "jaffa", "yafo", "תל אביב", "תל אביב-יפו", "תל-אביב"],
  "luxembourg city": ["luxembourg", "luxembourg city", "luxemburg"], "nicosia (new-build apartments)": ["nicosia", "lefkosia", "lefkoşa"],
  "dublin": ["dublin", "baile atha cliath"], "saburtalo, tbilisi": ["saburtalo"], "milan": ["milan", "milano"], "helsinki": ["helsinki", "helsingfors"],
  "riga": ["riga"], "berlin": ["berlin"], "zagreb": ["zagreb"], "budapest": ["budapest"], "bratislava": ["bratislava", "pressburg"],
  "ljubljana": ["ljubljana"], "tallinn": ["tallinn"], "dubai (citywide, all residential property types)": ["dubai"],
  // regional fixtures (api/regional-fixture-intelligence.js)
  "belgrade": ["belgrade", "beograd"], "coastal municipalities": ["budva", "kotor", "tivat", "herceg novi", "bar", "ulcinj", "petrovac", "becici", "sveti stefan"],
  "tirana": ["tirana", "tirane", "tiranë"], "buenos aires (caba)": ["buenos aires", "caba", "palermo", "recoleta"], "lima metropolitana": ["lima", "miraflores", "san isidro", "barranco"],
  "montevideo": ["montevideo"], "metropolitan region (gran santo domingo)": ["santo domingo"], "seoul": ["seoul"], "ho chi minh city": ["ho chi minh city", "ho chi minh", "saigon"],
  "colombo": ["colombo"], "phnom penh": ["phnom penh"], "tbilisi": ["tbilisi", "saburtalo", "vake", "mtatsminda"]
};
function recentAreaFits(area, city) {
  const a = String(area || "").toLowerCase();
  if (/^national/.test(a)) return true; // labelled national by the caller
  // every part of what was typed ("Kastanienallee 12, 10435 Berlin"), with
  // postcodes / house numbers removed — the town is rarely the first part
  const parts = String(city || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(",")
    .map((p) => p.replace(/\b[a-z]{0,2}-?\d[\d\s-]*\b/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!parts.length) return false;
  const names = (RECENT_AREA_ALIASES[a] || [a.split(/[,(]/)[0].trim()]).map((n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  return parts.some((c) => names.some((n) => c === n || c.startsWith(n + " ") || c.endsWith(" " + n)));
}

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
  if (n.status === "ok_condo" || n.status === "insufficient_condo") {
    const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
    const parts = [];
    if (n.status === "ok_condo") {
      parts.push(`NYC Dept. of Finance: ${n.condoSalesCount} recorded condo unit sales in ${zip} (${n.periodFrom} to ${n.periodTo}), median ${usd(n.medianPerUnitGrossSqFt)} per sq ft (middle half ${usd(n.p25PerUnitGrossSqFt)}–${usd(n.p75PerUnitGrossSqFt)}), measured on each unit's share of the building's gross floor area from the DOF assessment roll — this includes a share of common areas, so it is lower than a price per interior sq ft; sales are not screened for arm's length. Context only, not used in the verdict.`);
      if (n.askingPerUnitGrossSqFt) parts.push(`On the same basis this unit's asking price is ${usd(n.askingPerUnitGrossSqFt)} per sq ft (${usd(n.askingPrice)} ÷ ${n.unitGrossSqFt.toLocaleString("en-US")} sq ft, the unit's DOF share).`);
    } else {
      parts.push(n.condoSalesCount ? `NYC Dept. of Finance: only ${n.condoSalesCount} condo unit sales with a DOF unit area in ${zip} in the last 12 months — not enough for a local per-sq-ft figure.` : `NYC Dept. of Finance: no recorded condo unit sales in ${zip} in the last 12 months.`);
    if (n.coopSalesCount && !n.coopMedianPrice) parts.push(`${n.coopSalesCount} co-op sales — too few for a median.`);
    }
    if (n.coopMedianPrice) parts.push(`Co-op apartments in ${zip}: ${n.coopSalesCount} recorded sales, median price ${usd(n.coopMedianPrice)} (co-op sales carry no unit area in any official dataset).`);
    if (n.excludedMultiPropertyDeeds) parts.push(`${n.excludedMultiPropertyDeeds} records sharing one deed price were left out.`);
    return parts.join(" ") + ` ${src}`;
  }
  if (n.status === "unit_area_timeout") {
    return `NYC Dept. of Finance: ${n.salesCount} recorded condo/co-op sales in ${zip} in the last 12 months. The city's assessment-roll server did not answer in time for the unit areas, so no per-sq-ft figure is shown this time — run the analysis again for it. ${src}`;
  }
  if (n.status === "no_unit_area") {
    return `NYC Dept. of Finance: ${n.salesCount} recorded condo/co-op sales in ${zip} in the last 12 months, but DOF does not publish unit floor area — no per-sq-ft comparison exists for apartments. ${src}`;
  }
  return null;
}

// Every area benchmark, price index, rent figure and comparable sale above
// is about HOMES (HPI, DVF flats/houses, INE, Catastro zones, …). None of
// them says anything about a commercial building or a development site, so
// for those types they are shown as context only — never the benchmark, the
// price trend, the yield basis or the comparables. The property's OWN
// official record (a US parcel's assessed value / last sale) still applies.
function nonResidentialEvidence(ev, propertyType) {
  const t = String(propertyType || "");
  if (!ev || !/commercial|land/i.test(t)) return ev;
  const kind = /land/i.test(t) ? "land / development site" : "commercial property";
  const ownRecord = ev.coverage === "property" || Boolean(ev.propertyRecord?.found);
  const note = `The official figures below are for homes (residential) — no official ${kind} price benchmark is connected, so none of them is applied to this ${kind}.`;
  return {
    ...ev,
    benchmarkValue: null,
    benchmarkLabel: `${ev.benchmarkLabel || "Official benchmark"} — residential, not applied`,
    governmentValue: ownRecord ? ev.governmentValue ?? null : null,
    transactionValue: ownRecord ? ev.transactionValue ?? null : null,
    marketArea: `${ev.marketArea ? `${ev.marketArea} — ` : ""}no official ${kind} benchmark`,
    source: `${note} ${ev.source || ""}`.trim(),
    sourceParts: Array.isArray(ev.sourceParts) ? [{ title: "Property type", text: note }, ...ev.sourceParts] : ev.sourceParts,
    coverage: ownRecord ? ev.coverage : "none",
    priceTrendPercent: null,
    rentalBenchmark: null,
    comparableSales: null,
    residentialOnly: true
  };
}

// France, as titled blocks: the town's DVF sales, homes of a similar size
// and land, the official energy rating (ADEME DPE) and what each class sold
// for here, and what a renovation the customer entered can and cannot show.
function franceParts(raw, dvf, sim, sizeFits, wantsHouse, eur) {
  const town = raw.commune?.name || "this town";
  const kind = wantsHouse ? "house" : "apartment";
  const parts = [];
  const all = sim?.all;
  parts.push({ title: "DVF sales (official)", text: `${dvf.source || "DVF (DGFiP)"} — ${dvf.sampleSize?.toLocaleString("en-US") ?? 0} single-dwelling sales in ${town}, ${dvf.transactionWindow || "latest two years"}.${all?.sampleSize ? ` All ${kind}s: ${all.sampleSize} sales, median ${eur(all.medianEurPerM2)}/m², median size ${Math.round(all.medianSurface)} m².` : ""}` });
  if (sim?.size) {
    const b = sim.size;
    parts.push({ title: "Similar size", text: b.sampleSize
      ? `${b.sampleSize} ${kind} sales of ${sim.surfaceRange[0]}–${sim.surfaceRange[1]} m² in ${town}: median ${eur(b.medianEurPerM2)}/m²${b.sampleSize >= 4 ? ` (middle half ${eur(b.p25EurPerM2)}–${eur(b.p75EurPerM2)})` : ""}, median price ${eur(b.medianTransactionEur)}. ${sizeFits ? "Used as the benchmark: same type and similar size." : "Fewer than 10 sales — context only; the benchmark stays the town-wide figure, which includes smaller and larger homes."}`
      : `No ${kind} sale of ${sim.surfaceRange[0]}–${sim.surfaceRange[1]} m² in ${town} in this period — the benchmark is the town-wide figure, which is based on homes of other sizes.` });
  }
  if (sim?.sizeLand) {
    const b = sim.sizeLand;
    parts.push({ title: "Similar land", text: b.sampleSize
      ? `Of those, ${b.sampleSize} on ${sim.landRange[0]}–${sim.landRange[1]} m² of land: median ${eur(b.medianEurPerM2)}/m², median price ${eur(b.medianTransactionEur)}${b.sampleSize < 10 ? " — fewer than 10 sales, context only" : ""}.`
      : `None of them on ${sim.landRange[0]}–${sim.landRange[1]} m² of land in this period.` });
  }
  const en = raw.energy;
  if (en) {
    const own = en.own;
    const bc = en.byClass;
    const ownText = own?.found
      ? `This house's energy rating (DPE): class ${own.label}, issued ${own.date}${own.surface ? ` (${Math.round(own.surface)} m²)` : ""}.`
      : own && !own.found ? "No DPE is registered at this address in ADEME's database (certificates since July 2021) — a DPE is compulsory for a sale: ask the seller for it." : "";
    let classText = "";
    if (bc?.matched) {
      const u = bc.usable;
      classText = ` ${bc.matched} of ${bc.salesTotal} house sales in ${town} matched to the DPE registered at the same address before the sale${u.length ? `: ${u.map((c) => `class ${c.label} median ${eur(c.medianEurPerM2)}/m² (${c.sampleSize} sales)`).join(", ")}` : ""}${bc.classes.length > u.length ? `; ${bc.classes.filter((c) => c.sampleSize < 10).map((c) => c.label).join(", ")}: fewer than 10 sales each` : ""}.`;
      const mine = own?.found ? u.find((c) => c.label === own.label) : null, d = u.find((c) => c.label === "D");
      if (mine && d && mine.label !== "D") classText += ` Here, class ${mine.label} houses sold ${Math.abs((mine.medianEurPerM2 / d.medianEurPerM2 - 1) * 100).toFixed(1)}% ${mine.medianEurPerM2 >= d.medianEurPerM2 ? "above" : "below"} class D (not adjusted for size or age).`;
    } else if (en.unavailableReason === "too_many") classText = ` Prices by energy class are not computed for a town this large.`;
    if (ownText || classText) parts.push({ title: "Energy rating (DPE)", text: `${ownText}${classText} Source: ${en.source}.` });
  }
  const rv = raw.renovation;
  if (rv?.renovated) {
    const stale = en?.own?.found && rv.year && Number(String(en.own.date).slice(0, 4)) < rv.year;
    parts.push({ title: "Renovation", text: `Renovation entered${rv.year ? ` (${rv.year})` : ""}. The official sales above include homes in every condition, so a renovated home can justify a price above them. The measurable part is the energy class: ${en?.byClass?.usable?.length ? "the class figures above show what each class sold for here" : "no class figures are available here"}. ${stale ? "The registered DPE predates the renovation — ask for the post-work DPE. " : ""}For work that does not change the class (kitchen, bathrooms, finishes) no official figure exists — ask for the invoices.` });
  }
  return parts;
}

function normalizeMarketEvidence(country, raw, propertyType, property = null) {
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
    // same type AND a similar size (±25%) when there are 10+ such sales —
    // the town-wide median mixes every size (Lieusaint: 94 m² median house)
    const sim = dvf.similar || null;
    const sizeFits = sim?.size?.sampleSize >= 10;
    const benchmarkSource = sizeFits ? sim.size : typeBucket?.sampleSize >= 10 ? typeBucket : dvf; // 2 house sales in Lyon 2e are not a benchmark
    const ac = String(dvf.area || ""), arr = /^751\d\d$/.test(ac) ? Number(ac.slice(3)) : /^6938\d$/.test(ac) ? Number(ac.slice(4)) : /^132\d\d$/.test(ac) ? Number(ac.slice(3)) : null; // 75108 → 8e, 69382 → 2e, 13208 → 8e
    // FIX: the commune-wide rental average is meaningless for a street like
    // Rue Cambon (Place Vendôme) — applying it there produced a confidently
    // wrong "estimated rent" that dragged the score down to "Avoid" for a
    // genuinely prime address. When the micro-location detector (see
    // parisSignals in api/france-intelligence.js) flags the property as
    // prime/ultra-prime, skip the estimate entirely: no rent shown is more
    // honest than a wrong one driving the score.
    const isPrimeOutlier = Boolean(raw.microLocation?.prestige?.isPrime);
    const byArr = Array.isArray(dvf.byArrondissement) && dvf.byArrondissement.length ? dvf.byArrondissement : null;
    const eur = (x) => "€" + Math.round(x).toLocaleString("en-US");
    const ord = (n) => `${n}${n === 1 ? "er" : "e"}`;
    const cityWideNote = byArr
      ? `No single benchmark for the whole city: DVF prices differ by arrondissement from ${eur(byArr[byArr.length - 1].medianEurPerM2)}/m² (${ord(byArr[byArr.length - 1].arrondissement)}) to ${eur(byArr[0].medianEurPerM2)}/m² (${ord(byArr[0].arrondissement)}) — enter the street address or the arrondissement for this property's own benchmark. Medians by arrondissement (single-dwelling sales, ${dvf.transactionWindow || "latest year"}): ${byArr.map((x) => `${ord(x.arrondissement)} ${eur(x.medianEurPerM2)} (${x.sampleSize.toLocaleString("en-US")})`).join(" · ")}.` + (dvf.missingArrondissements?.length ? ` No data could be loaded this time for: ${dvf.missingArrondissements.map(ord).join(", ")} — the range above may be incomplete.` : "")
      : null;
    // the ministry's rent map: advertised rents incl. charges, flats and
    // houses separately; "maille" = estimated on a wider area (few ads)
    const rentPart = rental.available && rental.rentEurPerM2 != null ? { title: "Rent (Carte des loyers 2025)", text: `${rental.source}: advertised ${rental.kind === "house" ? "house" : "flat"} rents in ${raw.commune?.name || "the commune"}, charges included, €${rental.rentEurPerM2.toFixed(2)}/m² a month${rental.lowerEurPerM2 != null && rental.upperEurPerM2 != null ? ` (prediction interval €${rental.lowerEurPerM2.toFixed(2)}–${rental.upperEurPerM2.toFixed(2)})` : ""}${/maille/i.test(rental.estimatedOn || "") ? ", estimated on a wider area because the commune has few ads" : rental.adsInCommune ? `, from ${Math.round(rental.adsInCommune).toLocaleString("en-US")} ads in the commune` : ""}. Asking rents in ads, not signed leases.${isPrimeOutlier ? " Not used for the yield at this prime address." : ""}` } : null;
    return {
      benchmarkValue: benchmarkSource?.medianEurPerM2 ?? null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: sizeFits ? `DVF Benchmark (${wantsHouse ? "houses" : "apartments"} ${sim.surfaceRange[0]}–${sim.surfaceRange[1]} m²)` : wantsHouse ? "DVF Benchmark (houses)" : "DVF Benchmark",
      governmentValue: null,
      transactionValue: benchmarkSource?.medianTransactionEur ?? null,
      transactionPeriod: dvf.transactionWindow ?? null,
      marketArea: raw.commune?.name ? raw.commune.name + (arr && !/arrondissement/i.test(raw.commune.name) ? ` — ${arr}${arr === 1 ? "er" : "e"} arrondissement` : "") : null,
      source: (cityWideNote ? cityWideNote + " " : "") + `INSEE + ${dvf.source || "DVF (DGFiP)"}${dvf.sampleSize ? ` — ${dvf.sampleSize.toLocaleString("en-US")} single-dwelling sales` : ""} + geo.api.gouv.fr`,
      sourceParts: [...(franceParts(raw, dvf, sim, sizeFits, wantsHouse, eur) || []), ...(rentPart ? [rentPart] : [])],
      coverage: benchmarkSource?.medianEurPerM2 != null ? "city" : "none",
      // the ministry's commune rent map — rent/yield when none is entered
      rentalBenchmark: rental.available && !isPrimeOutlier
        ? { monthlyRentPerSqm: rental.rentEurPerM2 ?? null, grossYieldPercent: null, source: rental.source }
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
        ? dvf.micro.nearest.slice(0, 5).map((x) => ({ ...x, type: [x.type, x.surface ? `${Math.round(x.surface)} m²` : null, x.land ? `land ${Math.round(x.land)} m²` : null].filter(Boolean).join(" · ") }))
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
    // The address's own Catastro value zone (lib/spain/catastroZone.js) is
    // far more specific than the province-level MIVAU figure: when it gives
    // a per-m² module (flats, terraced houses) that is the benchmark; a
    // detached house's module is a total for the zone's representative home
    // (land included) → context only, never divided into a fake per-m² value.
    const cz = raw.catastroZone || null;
    const czPerM2 = cz?.status === "ok" && cz.product?.perM2Comparable ? cz.product.valuePerM2 : null;
    const spain = spainRecord(cz, property);
    // local Catastro evidence exists (the zones around the place, or a zone
    // valued on another basis): a whole-province average is context only —
    // never the verdict for an Altea Hills villa
    const localZones = ["area", "other_type_only", "ok"].includes(cz?.status);
    const provPeriod = raw.year && raw.quarter ? `, Q${raw.quarter} ${raw.year}` : "";
    const provTrend = raw.annualChangePercent != null ? ` Change on a year earlier: ${raw.annualChangePercent > 0 ? "+" : ""}${raw.annualChangePercent}% (the price trend used).` : "";
    const provinceNote = benchmark != null && raw.province ? `MIVAU appraised value of free-market homes, ${raw.province} province average${provPeriod}: €${Math.round(benchmark).toLocaleString("en-US")}/m² (province-wide context — not applied to this property).${provTrend}` : null;
    if (localZones && czPerM2 == null) {
      return {
        benchmarkValue: null,
        benchmarkUnit: "perSqm",
        benchmarkLabel: "Catastro value zones (see record)",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: null,
        marketArea: cz.geo?.label || raw.city || null,
        propertyRecord: spain.record,
        sourceParts: [...spain.parts, ...(provinceNote ? [{ title: "MIVAU (province)", text: provinceNote }] : [])],
        source: spain.parts.map((x) => x.text).join(" ") + (provinceNote ? " " + provinceNote : ""),
        coverage: "city",
        priceTrendPercent: raw.annualChangePercent ?? null
      };
    }
    return {
      benchmarkValue: czPerM2 ?? benchmark,
      benchmarkUnit: "perSqm",
      // the MIVAU figure is the PROVINCE's average appraised value — named
      // as such, never as the town's
      benchmarkLabel: czPerM2 != null ? `Catastro zone ${cz.zone} value / m²` : benchmark != null && raw.province ? `MIVAU appraised value — ${raw.province} province average` : "MIVAU Benchmark",
      governmentValue: czPerM2 != null ? null : (raw.governmentValue ?? null),
      // VDP003's "transaction value" is a province-wide quarterly total in
      // an unstated unit — not a price for this property → not shown
      transactionValue: null,
      transactionPeriod: null,
      marketArea: czPerM2 != null ? `${cz.geo?.muni || raw.city} — Catastro zone ${cz.zone}`
        : cz?.geo?.label && ["area", "other_type_only", "ok"].includes(cz.status) ? `${cz.geo.label}${benchmark != null && raw.province ? ` (benchmark: ${raw.province} province)` : ""}`
        : benchmark != null && raw.province ? `${raw.province} province` : null,
      propertyRecord: spain.record,
      sourceParts: spain.parts.length ? [...spain.parts, ...(provinceNote && czPerM2 != null ? [{ title: "MIVAU (province)", text: provinceNote }] : [])] : null,
      source: spain.parts.length ? spain.parts.map((x) => x.text).join(" ") + (provinceNote && czPerM2 != null ? " " + provinceNote : "")
        : benchmark != null && raw.province ? `MIVAU (Ministry of Housing) average appraised value of free-market homes, ${raw.province} province${provPeriod}.${provTrend}` : "MIVAU / INE / Catastro",
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
    const gbp = (x) => "£" + Math.round(x).toLocaleString("en-US");
    const txText = tx.available && tx.level
      ? `HM Land Registry Price Paid — ${tx.sampleSize} market sales of ${tx.typeLabel} in ${tx.level} ${tx.areaName} (${tx.transactionWindow}): median ${gbp(tx.medianTransactionPrice)}, middle half ${gbp(tx.p25TransactionPrice)}–${gbp(tx.p75TransactionPrice)}.`
      : tx.reason === "not_residential"
        ? "HM Land Registry Price Paid — covers home sales only; not used for this property type."
        : "HM Land Registry Price Paid — no area with enough recent market sales matched this address (add the postcode).";
    const hpiText = raw.averagePrice != null
      ? `UK House Price Index (HM Land Registry / ONS), ${raw.hpiArea}, ${raw.period}: average price of ${raw.hpiTypeLabel} ${gbp(raw.averagePrice)}${raw.annualChangePercent != null ? `, ${raw.annualChangePercent >= 0 ? "+" : ""}${raw.annualChangePercent}% in a year` : ""}.`
      : "UK House Price Index — no local authority matched this address, so no local average is applied (the national figure is not used as a local one).";
    const own = tx.ownSale ? ` This property's last registered sale: ${gbp(tx.ownSale.price)} on ${String(tx.ownSale.date).slice(0, 10)}${tx.ownSale.category === "B" ? " (not a standard market sale)" : ""}.` : "";
    return {
      benchmarkValue: raw.averagePrice ?? null,
      benchmarkUnit: "total",
      benchmarkLabel: raw.averagePrice != null ? `UK HPI average price — ${raw.hpiArea}, ${raw.hpiTypeLabel}` : "UK HPI Average Price",
      governmentValue: null,
      transactionValue: tx.available && tx.level ? tx.medianTransactionPrice : null,
      transactionPeriod: tx.available && tx.level ? tx.transactionWindow : null,
      marketArea: tx.level ? `${tx.areaName} (${tx.level})${raw.hpiArea ? ` — ${raw.hpiArea}` : ""}` : (raw.hpiArea || null),
      source: `${hpiText} ${txText}${own}`,
      sourceParts: [{ title: "UK House Price Index", text: hpiText }, { title: "Price Paid (market sales)", text: txText + own }],
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
            // the area the customer typed, never a sale's address (Price
            // Paid address data: non-commercial licence only)
            location: tx.level ? `${tx.level} ${tx.areaName}` : null,
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
    // a national median is never a town's benchmark; Statbel's own
    // "too few sales" note (Brussels detached houses) → context only
    if (!region || raw.volatilityNote) {
      return {
        benchmarkValue: null,
        benchmarkUnit: "total",
        benchmarkLabel: region ? `Statbel Median Price (${region}) — context only` : "Statbel Median Price (National) — context only",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: raw.period ?? null,
        marketArea: region ? `${region} — too few sales for a reliable figure, not applied` : `${countryLabel(country)} — town not matched to a Belgian region; national figure not applied`,
        source: `Statbel (${raw.period}): ${region || "Belgium"} median ${raw.medianPrice != null ? "€" + raw.medianPrice.toLocaleString("en-US") : "n/a"} per ${bucket || "home"}${raw.annualChangePercent != null ? `, ${raw.annualChangePercent >= 0 ? "+" : ""}${raw.annualChangePercent}% YoY` : ""}${raw.volatilityNote ? ` — ${raw.volatilityNote}` : " — a national figure, shown as context only"}.`,
        sourceUrl: raw.sourceUrls?.statbel || null,
        coverage: "none",
        priceTrendPercent: raw.volatilityNote ? (raw.nationalAnnualChangePercent ?? null) : (raw.annualChangePercent ?? null)
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
    const trendText = val.fairValue != null
        ? (val.source || "U.S. Census Bureau + FHFA + public property records")
        : stateHpi.oneYear != null
          ? `${macro.laAssessor?.parcel || macro.njSales?.parcel || macro.nysParcel?.status === "ok" || macro.local?.hasRecord ? "" : "No county property record found — "}FHFA ${stateHpi.name || "state"} ${metroHpi?.level === "nonmetro" ? "" : metroHpi ? "metro " : ""}HPI: ${stateHpi.oneYear >= 0 ? "+" : ""}${stateHpi.oneYear}% YoY${stateHpi.period ? ` (${stateHpi.period})` : ""}.`
          : "No official price benchmark found for this address — county property record and state price index both unavailable.";
    const usParts = [
      { title: "Official property record", text: macro.local?.summary || null },
      { title: "Area sales (NYC Dept. of Finance)", text: nycSalesContext(macro.nycSales) },
      { title: "Los Angeles County Assessor", text: laAssessorContext(macro.laAssessor) },
      { title: "New Jersey sales (NJ Treasury)", text: njSalesContext(macro.njSales, raw.localBenchmark) },
      { title: "New York State parcel record", text: nysParcelContext(macro.nysParcel) },
      { title: val.fairValue != null ? "Valuation basis" : "Price trend (FHFA)", text: trendText }
    ].filter((x) => x.text);
    const prop = raw.property || {};
    const gv = macro.local?.governmentValue || null;
    const hasUsRecord = Boolean(macro.local?.hasRecord || val.fairValue != null || prop.livingAreaSqFt || prop.yearBuilt);
    // always present for a US property, so the layout never changes; found:false = rows say so
    const usRecord = {
      found: hasUsRecord,
      authority: macro.local?.source || val.source || (macro.laAssessor?.parcel ? macro.laAssessor.source || "Los Angeles County Assessor" : null),
      authorityUrl: macro.local?.sourceUrl || (macro.laAssessor?.parcel ? macro.laAssessor.sourceUrl || null : null),
      governmentValue: gv?.value ?? val.fairValue ?? null,
      governmentValueLabel: gv ? [gv.label, gv.asOf && !String(gv.label || "").includes(gv.asOf) ? gv.asOf : null].filter(Boolean).join(" · ") : (val.fairValue != null ? (val.method || null) : null),
      nonMarketValue: macro.local?.nonMarketValue || null,
      areaMedian: usAreaMedian(macro.nycSales) || (macro.local?.areaMedianPrice ? `$${Math.round(macro.local.areaMedianPrice.value).toLocaleString("en-US")} median price · ${macro.local.areaMedianPrice.sales.toLocaleString("en-US")} qualified sales of ${macro.local.areaMedianPrice.typeLabel}, ${macro.local.areaMedianPrice.area} (${macro.local.areaMedianPrice.periodFrom} to ${macro.local.areaMedianPrice.periodTo})` : null),
      askingSameBasis: macro.nycSales?.askingPerUnitGrossSqFt ? `$${macro.nycSales.askingPerUnitGrossSqFt.toLocaleString("en-US")} per sq ft ($${Number(macro.nycSales.askingPrice).toLocaleString("en-US")} ÷ ${macro.nycSales.unitGrossSqFt.toLocaleString("en-US")} sq ft unit share)` : null,
      lastSalePrice: tx.salePrice ?? null,
      lastSaleDate: tx.saleDate ?? null,
      livingAreaSqFt: prop.livingAreaSqFt ?? null,
      yearBuilt: prop.yearBuilt ?? null,
      bedrooms: prop.bedrooms ?? null,
      bathrooms: prop.bathrooms ?? null
    };
    // Florida: the ZIP's median price of county-qualified (arm's-length)
    // sales of the same type → a whole-home benchmark when no per-sq-ft
    // one exists (same kind as Ireland's CSO median)
    const amp = val.valuePerSqFt == null && !raw.localBenchmark ? macro.local?.areaMedianPrice || null : null;
    if (amp?.value) {
      return {
        benchmarkValue: amp.value,
        benchmarkUnit: "total",
        benchmarkLabel: `Median sale price — ${amp.typeLabel}, ${amp.area}`,
        governmentValue: macro.local?.governmentValue?.value ?? null,
        transactionValue: tx.salePrice ?? null,
        transactionPeriod: tx.saleDate ?? null,
        marketArea: `${amp.area}${raw.property?.county ? `, ${raw.property.county}` : ""} — ${amp.sales} qualified sales of ${amp.typeLabel}, ${amp.periodFrom} to ${amp.periodTo}`,
        source: usParts.map((x) => x.text).join(" "),
        sourceUrl: amp.sourceUrl,
        sourceParts: usParts,
        propertyRecord: usRecord,
        coverage: "city",
        priceTrendPercent: stateHpi.oneYear ?? null,
        officialChecks: Array.isArray(raw.officialChecks) && raw.officialChecks.length ? raw.officialChecks : null
      };
    }
    return {
      // NJ: municipal median $/sq ft of LIVING area from usable Treasury
      // sales, same type — comparable to the user's own size, so it is a
      // real benchmark (unlike NYC's gross-area or LA's context figures).
      benchmarkValue: val.valuePerSqFt ?? raw.localBenchmark?.valuePerSqFt ?? null,
      benchmarkUnit: "perSqft",
      benchmarkLabel: val.valuePerSqFt == null && raw.localBenchmark ? "Local Sales Median / Sq Ft" : "US Fair Value / Sq Ft",
      // Texas etc.: the appraisal district's own market value (display only).
      governmentValue: val.fairValue ?? macro.local?.governmentValue?.value ?? null,
      transactionValue: tx.salePrice ?? null,
      transactionPeriod: tx.saleDate ?? null,
      marketArea: (val.valuePerSqFt == null && raw.localBenchmark?.area) || raw.property?.county || raw.area || raw.city || null,
      // FIX: when NEITHER the county parcel lookup NOR the FHFA state HPI
      // came back, this fell all the way through to the generic "U.S.
      // Census Bureau + FHFA..." citation string — which reads like a
      // source backing real numbers, when every benchmark/transaction
      // field above it is actually null. Now says plainly that no match
      // was found, instead of implying data that isn't there.
      source: usParts.map((x) => x.text).join(" "),
      // The same evidence as separate, titled blocks (the report renders
      // these instead of one long paragraph) + the property's own official
      // record as uniform rows — identical layout for every US county.
      sourceParts: usParts,
      propertyRecord: usRecord,
      coverage: val.fairValue != null ? "property" : raw.localBenchmark ? "city" : (raw.macroEvidence ? "national" : "none"),
      priceTrendPercent: stateHpi.oneYear ?? null,
      // Official hazard / regulation lookups (FEMA flood, CAL FIRE, CGS,
      // LA wildfire damage, LA rent control) — see usOfficialChecks().
      officialChecks: Array.isArray(raw.officialChecks) && raw.officialChecks.length ? raw.officialChecks : null
    };
  }

  if (c === "portugal") {
    const hpi = raw.housingPriceIndex || {};
    const change = hpi.annualChangePercent ?? hpi.annualVariation ?? null;
    const rental = raw.rental || {};
    const lp = raw.localPrice || null;
    const rentTxt = rental.available ? ` INE median rent of new lease contracts, 12 months to ${rental.period}: €${rental.rentEurPerM2.toFixed(2)}/m² a month in ${rental.matchedArea} (${rental.level}${rental.changePercent != null ? `, ${rental.changePercent >= 0 ? "+" : ""}${rental.changePercent}% vs ${rental.comparedWith}` : ""})${rental.coverageNote ? ` — ${rental.coverageNote}` : ""}${property?.monthlyRent ? "" : "; with no rent entered the yield uses it × the size (estimated)"}.` : "";
    if (lp?.status === "ok" && (lp.typeMatch?.value ?? lp.medianEurPerM2) != null) {
      // INE's own local figure: median €/m² of the actual sales in the 12
      // months to the quarter, for this parish/municipality (by typology
      // when the bedrooms are known) — the same kind of evidence as France's
      // DVF median, published by INE itself.
      const value = lp.typeMatch?.value ?? lp.medianEurPerM2;
      const typ = lp.typeMatch ? lp.typeMatch.key.replace(" ou mais", "+").replace(" ou ", "/") : null;
      const where = lp.level === "parish" ? `${lp.area} (parish${lp.municipality ? `, ${lp.municipality}` : ""})` : lp.area;
      return {
        benchmarkValue: value,
        benchmarkUnit: "perSqm",
        benchmarkLabel: `INE median sale price / m² — ${lp.area}${typ ? `, ${typ}` : ""}`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: lp.period,
        marketArea: where,
        source: `INE Portugal — median price of homes sold in ${where}, 12 months to ${lp.period}: €${value.toLocaleString("en-US")}/m²${typ ? ` (${typ} homes; all homes €${lp.medianEurPerM2?.toLocaleString("en-US") ?? "—"}/m²)` : ""}${lp.yoyPercent != null ? `, ${lp.yoyPercent >= 0 ? "+" : ""}${lp.yoyPercent}% vs ${lp.comparedWith}` : ""}. National index ${change != null ? (change >= 0 ? "+" : "") + change + "% YoY" : "unavailable"}.${rentTxt}`,
        sourceUrl: lp.sourceUrl,
        coverage: "city",
        priceTrendPercent: lp.yoyPercent ?? change ?? null,
        rentalBenchmark: rental.available
          ? { monthlyRentPerSqm: rental.rentEurPerM2 ?? null, grossYieldPercent: null, source: rental.source }
          : null
      };
    }
    return {
      benchmarkValue: null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: "INE Portugal HPI (National)",
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: hpi.period ?? hpi.quarter ?? null,
      marketArea: lp?.status === "not_covered"
        ? `${countryLabel(country)} — place not recognised; enter the municipality`
        : `${countryLabel(country)} — city-level price data not yet connected`,
      source: `${lp?.status === "not_covered" ? "The place was not recognised as a Portuguese parish or municipality (INE publishes a median sale price for every municipality) — enter the municipality name to get its local figure. " : ""}INE Portugal — national index ${change != null ? (change >= 0 ? "+" : "") + change + "% YoY" : "unavailable"}`,
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

  // Japan: MLIT's residential price index for the narrowest published
  // area and the home's type; no official price level without MLIT's API key
  if (c === "japan" && raw.jp) {
    const jp = raw.jp;
    const pct = (v) => `${v >= 0 ? "+" : ""}${v}%`;
    const t = `MLIT Real Estate Price Index ${jp.period}, ${jp.area}, ${jp.typeLabel}: ${jp.change != null ? pct(jp.change) : "n/a"} on a year earlier (${jp.sample} transactions in the month${jp.national ? "" : `; Japan overall ${pct(jp.nationalChange)}`}). Built from registered transactions; no price level is published.`;
    const note = "MLIT's per-transaction prices (Real Estate Information Library) need an API key — not yet held — so there is no official price level here.";
    return {
      benchmarkValue: null, benchmarkUnit: "perSqm", benchmarkLabel: "Market price level (MLIT transaction data needs an API key — not yet connected)",
      governmentValue: null, transactionValue: null, transactionPeriod: jp.period,
      marketArea: `${jp.area} — official price trend; no official price level is published`,
      source: `${t} ${note}`, sourceUrl: jp.sourceUrl, coverage: jp.national ? "national" : "regional", priceTrendPercent: jp.change,
      sourceParts: [{ title: "MLIT — price index", text: t }, { title: "Not available", text: note }]
    };
  }
  // Hong Kong: RVD average price / rent per m² of SALEABLE area of the
  // property's region × size class (second-hand sales); 20+ transactions
  if (c === "hong kong") {
    const hk = raw.hk || {};
    const pct = (v) => `${v >= 0 ? "+" : ""}${v}%`;
    const hkd = (v) => `HK$${Math.round(v).toLocaleString("en-US")}`;
    const rng = hk.classRange ? `${hk.classRange[0]}${hk.classRange[1] === null || hk.classRange[1] === Infinity ? "+" : `–${hk.classRange[1] - 0.1}`} m² saleable` : "";
    const where = hk.region ? `${hk.region}${hk.cls ? `, class ${hk.cls} (${rng})` : ""}` : null;
    const prov = (x) => x?.provisional ? ", provisional" : "";
    const parts = [];
    let benchmarkValue = null, rentalBenchmark = null;
    if (hk.price) {
      const t = `RVD average price ${hk.price.period}${prov(hk.price)}, ${where}: ${hkd(hk.price.value)} per m² of saleable area (second-hand sales; the size entered is read as the saleable area, 實用面積)${hk.price.fewerThan20 ? " — fewer than 20 transactions, so context only" : ""}.`;
      parts.push({ title: "RVD — average price", text: t });
      if (!hk.price.fewerThan20) benchmarkValue = hk.price.value;
    }
    if (hk.rent) {
      parts.push({ title: "RVD — average rent", text: `RVD average rent ${hk.rent.period}${prov(hk.rent)}, ${where}: ${hkd(hk.rent.value)} per m² a month${hk.rent.fewerThan20 ? " — fewer than 20 lettings, context only" : property?.monthlyRent ? "" : ". No rent was entered, so the yield uses this rent (estimated)."}` });
      if (!hk.rent.fewerThan20) rentalBenchmark = { monthlyRentPerSqm: hk.rent.value, grossYieldPercent: null, source: hk.source };
    }
    const trendTxt = `RVD price index ${hk.trend?.period || ""}${prov(hk.trend)}${hk.cls ? `, class ${hk.cls}` : ""} (territory-wide): ${pct(hk.trend?.change)} on a year earlier${hk.cls ? ` (all classes ${pct(hk.trend.all)})` : ""}${hk.yieldPct != null ? `. RVD market yield for class ${hk.cls}: ${hk.yieldPct}% (${hk.yieldPeriod})` : ""}.`;
    parts.push({ title: "RVD — price index", text: trendTxt });
    const missing = !hk.region ? "Type the district or area (e.g. Mid-Levels, Kowloon City, Sha Tin) for the regional average." : !hk.cls ? "Enter the saleable area for the class average." : "";
    return {
      benchmarkValue, benchmarkUnit: "perSqm", benchmarkLabel: where ? `RVD average price, ${where}` : "RVD average price per m² (saleable area)",
      governmentValue: null, transactionValue: null, transactionPeriod: hk.price?.period || hk.trend?.period || null,
      marketArea: where ? `${where}${benchmarkValue ? "" : " — context only"}` : "Hong Kong — enter the district / area",
      source: [...parts.map((x) => x.text), missing].filter(Boolean).join(" "),
      sourceUrl: hk.sourceUrl || "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
      coverage: benchmarkValue ? "city" : "national", priceTrendPercent: hk.trend?.change ?? null, rentalBenchmark,
      sourceParts: missing ? [...parts, { title: "Missing", text: missing }] : parts
    };
  }
  // Singapore: URA's price index by type (no official price level without
  // URA's data service key) + URA's median rent of the customer's condo project
  if (c === "singapore") {
    const sg = raw.sg || {};
    const pct = (v) => `${v >= 0 ? "+" : ""}${v}%`;
    const p = sg.ppi;
    const kind = sg.landed ? "landed homes" : "non-landed homes (condominiums and apartments)";
    let trendTxt = p ? `URA private residential price index ${p.period}, ${kind}: ${pct(p.yoyPercent)} on a year earlier (all private homes ${pct(sg.ppiAll.yoyPercent)})` : "URA price index unavailable";
    let change = p?.yoyPercent ?? null;
    if (!sg.landed && sg.region?.yoyPercent != null) { trendTxt += `; ${sg.region.name} non-landed ${pct(sg.region.yoyPercent)}`; change = sg.region.yoyPercent; }
    const parts = [{ title: "URA — price index", text: `${trendTxt}.` }];
    let rentalBenchmark = null;
    if (sg.rent) {
      const r = sg.rent;
      const t = `URA median rent ${r.period}, ${r.project} (postal district ${r.district}): S$${r.psfMonth} per sq ft a month (middle half S$${r.p25}–${r.p75}), ${r.contracts} rental contracts${r.monthly ? ` → S$${r.monthly.toLocaleString("en-US")} a month for ${property?.size} m²` : ""}.${r.monthly && !property?.monthlyRent ? " No rent was entered, so the yield uses this rent (estimated)." : ""}`;
      parts.push({ title: "URA — rent of this project", text: t });
      if (r.monthly) rentalBenchmark = { monthlyRentFlat: r.monthly, grossYieldPercent: null, source: r.source };
    }
    let benchmarkValue = null, saleLabel = null;
    if (sg.sale) {
      const s2 = sg.sale;
      const kindTxt = s2.kind === "resale" ? "resales and sub-sales" : "new sales from the developer (no resales with 10+ in the period)";
      const t = `URA transactions ${s2.from} to ${s2.to}, ${s2.project}: median S$${s2.psm.toLocaleString("en-US")} per m² of strata area from ${s2.n} single-unit ${kindTxt}${s2.other ? `; new sales S$${s2.other.psm.toLocaleString("en-US")} (${s2.other.n})` : ""}.`;
      parts.splice(1, 0, { title: "URA — transactions of this project", text: t });
      benchmarkValue = s2.psm; saleLabel = `URA median ${s2.kind === "resale" ? "resale" : "new-sale"} price, ${s2.project}`;
    }
    const note = sg.sale ? "" : "URA's transaction prices are per project — type the condo project's name for its official median price.";
    // Singapore Open Data Licence v1.0: a visible notice naming the dataset,
    // the access date and the source, with a link to the licence
    const lic = [sg.sale && `Private Residential Property Transactions accessed on ${sg.sale.accessed} from the Urban Redevelopment Authority (URA)`,
      sg.rent && `Rentals of Non-Landed Residential Buildings accessed on ${sg.rent.accessed} from URA via data.gov.sg`].filter(Boolean);
    if (lic.length) parts.push({ title: "Licence", text: `Contains information from ${lic.join(" and ")} which is made available under the terms of the Singapore Open Data Licence version 1.0 (https://data.gov.sg/open-data-licence).` });
    return {
      benchmarkValue, benchmarkUnit: "perSqm", benchmarkLabel: saleLabel || "URA median price per m² (type the condo project's name)",
      governmentValue: null, transactionValue: null, transactionPeriod: p?.period ?? null,
      marketArea: (sg.sale || sg.rent) ? `${(sg.sale || sg.rent).project}, Singapore` : "Singapore — type the condo project's name for its official price and rent",
      source: [trendTxt + ".", ...parts.slice(1).map((x) => x.text), note].filter(Boolean).join(" "),
      sourceUrl: sg.ppiUrl || "https://tablebuilder.singstat.gov.sg/table/TS/M212261",
      coverage: (sg.sale || sg.rent) ? "city" : "national", priceTrendPercent: change, rentalBenchmark,
      sourceParts: note ? [...parts, { title: "Missing", text: note }] : parts
    };
  }
  if (c === "greece") {
    const gz = greeceRecord(raw.zonePrice, property);
    const hpi = raw.housingPriceIndex || {};
    // the Bank of Greece index is of APARTMENT prices → never a house's trend
    const flatGR = /apart|flat|studio|penthouse/i.test(String(propertyType || ""));
    const areaGR = hpi.regionalArea || "Greece (national)";
    const changeAll = hpi.annualChangePercent ?? null;
    const change = flatGR ? changeAll : null;
    const rentTrend = raw.rentTrend || null;
    const estRent = raw.estimatedRent || null;
    const pct = (v) => `${v >= 0 ? "+" : ""}${v}%`;
    return {
      benchmarkValue: null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: "Market price level (Greece publishes none — see the zone price below)",
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: hpi.period ?? null,
      marketArea: `${areaGR} — official price trend; no official price level is published`,
      source: `Bank of Greece — apartment price index ${hpi.period || ""}, ${areaGR}: ${changeAll != null ? pct(changeAll) + " on a year earlier" : "unavailable"}${hpi.regionalArea && hpi.nationalAnnualChangePercent != null ? ` (Greece overall ${pct(hpi.nationalAnnualChangePercent)})` : ""}${flatGR ? "" : ". The index covers apartments only, so it is not used as this property's trend"}${rentTrend?.available ? `. ${rentTrend.source}: rents (national) ${pct(rentTrend.annualChangePercent)} on a year earlier (${rentTrend.period})` : ""}.`,
      coverage: hpi.regionalArea ? "regional" : "national",
      priceTrendPercent: change,
      propertyRecord: gz.record,
      sourceParts: [...gz.parts, { title: "Bank of Greece", text: `Apartment price index ${hpi.period || ""}, ${areaGR}: ${changeAll != null ? pct(changeAll) + " on a year earlier" : "unavailable"}${hpi.regionalArea && hpi.nationalAnnualChangePercent != null ? ` (Greece overall ${pct(hpi.nationalAnnualChangePercent)})` : ""}${flatGR ? "" : " — apartments only, not used as this property's trend"}.${hpi.newAnnualChangePercent != null ? ` New apartments ${pct(hpi.newAnnualChangePercent)}, older apartments ${pct(hpi.oldAnnualChangePercent)} (Greece overall).` : ""}` },
        ...(rentTrend?.available ? [{ title: rentTrend.source, text: `Rents (national): ${pct(rentTrend.annualChangePercent)} on a year earlier (${rentTrend.period}). ${rentTrend.note || ""}`.trim() }] : []),
        ...(estRent?.available ? [{ title: estRent.source, text: `Estimated asking rent, ${estRent.area}: €${estRent.eurPerM2PerMonth}/m²/month (${estRent.period}). ${estRent.note || ""}`.trim() }] : [])],
      // Spitogatos SPI is a private, asking-price listings index — real
      // market evidence, but not a government statistic like France/
      // Portugal's rentalBenchmark sources. Labelled as such in `source`
      // so the report never implies it carries the same weight.
      rentalBenchmark: estRent?.available
        ? { monthlyRentPerSqm: estRent.eurPerM2PerMonth, grossYieldPercent: null, source: `${estRent.source} (asking-price index, not a government statistic) — ${estRent.area}, ${estRent.period}` }
        : null
    };
  }

  const EUROSTAT_ONLY_COUNTRIES = [
    "netherlands", "poland", "austria", "switzerland", "czech republic", "czechia", "hungary", "bulgaria",
    "croatia", "cyprus", "denmark", "estonia", "finland", "ireland", "latvia", "lithuania",
    "luxembourg", "malta", "romania", "slovakia", "slovenia", "sweden", "norway", "iceland"
  ];
  // Canada: Statistics Canada New Housing Price Index per metro / province
  // (trend only — no official price level per city exists)
  if (c === "canada") {
    const ca = canadaTrend({ text: `${property?.address || ""}, ${property?.city || raw.city || ""}`, propertyType });
    if (ca) {
      return {
        benchmarkValue: null,
        benchmarkUnit: "total",
        benchmarkLabel: "Statistics Canada — no official price level per city",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: ca.period || null,
        marketArea: ca.found ? `${ca.area} — official new-home price trend; no official price level is published` : "Canada — enter the city and province",
        source: ca.text,
        sourceUrl: ca.sourceUrl || "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810020501",
        coverage: ca.found ? "city" : "national",
        priceTrendPercent: ca.found ? ca.trend : null,
        sourceParts: [{ title: "Statistics Canada", text: ca.text }]
      };
    }
  }
  // Mexico: SHF prices of MORTGAGED homes per state = context only (they
  // skew to economy / social housing; cash and resort purchases are largely
  // missing — a Playa del Carmen flat read "167% above market"); the
  // municipality's / state's official index change = the trend
  if (c === "mexico") {
    const mx = mexicoBenchmark({ text: `${property?.address || ""}, ${property?.city || raw.city || ""}` });
    if (mx) {
      const ctx = mx.found ? `${mx.text} This median covers mortgage-financed homes of every kind in the whole state, so it is shown as context and not compared with this property's price.` : mx.text;
      return {
        benchmarkValue: null,
        benchmarkUnit: "total",
        benchmarkLabel: mx.found ? `${mx.label} (context only)` : "SHF median home price",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: mx.period || null,
        marketArea: mx.found ? `${mx.area} — official state median of mortgaged homes, context only` : "Mexico — enter the city or state",
        source: ctx,
        sourceUrl: mx.sourceUrl || "https://www.gob.mx/shf",
        coverage: mx.found ? "city" : "national",
        priceTrendPercent: mx.found ? mx.trend : null,
        sourceParts: [{ title: "Sociedad Hipotecaria Federal", text: ctx }]
      };
    }
  }
  // City of São Paulo: the city's own ITBI (transfer-tax) sale records
  if (c === "brazil") {
    const sp = saoPauloBenchmark({ text: `${property?.address || ""}, ${property?.city || raw.city || ""}`, propertyType });
    if (sp) {
      return {
        benchmarkValue: sp.found ? sp.value : null,
        benchmarkUnit: "total",
        benchmarkLabel: sp.found ? sp.label : "São Paulo ITBI registered sales",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: sp.period || null,
        marketArea: sp.found ? sp.area : sp.area ? `${sp.area} — too few sales of this kind` : "São Paulo — enter the street and number or CEP",
        source: sp.text,
        sourceUrl: sp.sourceUrl || "https://prefeitura.sp.gov.br/fazenda/w/acesso_a_informacao/31501",
        coverage: sp.found ? "city" : "national",
        priceTrendPercent: null,
        sourceParts: [{ title: "Prefeitura de São Paulo — ITBI", text: sp.text }]
      };
    }
  }
  // Australia: ABS median transfer prices per capital-city area / rest of
  // state = context only — a whole metro (Greater Sydney, 5 M people) is not
  // a suburb's market: a Bondi house would read "far above market"
  if (c === "australia") {
    const au = australiaBenchmark({ text: `${property?.address || ""}, ${property?.city || raw.city || ""}`, propertyType, bedrooms: property?.bedrooms });
    // official rent of new bonds (NSW postcode / SA suburb) → the yield when no rent is entered
    const auRent = au?.rent ? { rentalBenchmark: { monthlyRentFlat: au.rent.monthly, grossYieldPercent: null, source: au.rent.source }, part: { title: `Rent — ${au.rent.who}`, text: `${au.rent.text}${property?.monthlyRent ? "" : " No rent was entered, so the yield uses this rent (estimated)."}` } } : null;
    const withAuRent = (r) => auRent ? { ...r, rentalBenchmark: auRent.rentalBenchmark, source: `${r.source} ${auRent.part.text}`, sourceParts: [...r.sourceParts, auRent.part] } : r;
    if (au?.suburb) {
      return withAuRent({
        benchmarkValue: au.value, benchmarkUnit: "total", benchmarkLabel: au.label, governmentValue: null, transactionValue: null,
        transactionPeriod: au.period, marketArea: au.area, source: au.text, sourceUrl: au.sourceUrl, coverage: "city", priceTrendPercent: null,
        sourceParts: [{ title: au.who || "State Valuer-General", text: au.text }]
      });
    }
    if (au) {
      const ctx = au.found ? `${au.text} The median covers the whole ${au.area} area, so it is shown as context and not compared with this property's price.` : au.text;
      return withAuRent({
        benchmarkValue: null,
        benchmarkUnit: "total",
        benchmarkLabel: au.found ? `${au.label} (context only)` : "ABS median transfer price",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: au.period || null,
        marketArea: au.found ? `${au.area} — official area-wide median, context only` : au.area ? `${au.area} — too few transfers of this kind` : "Australia — enter the suburb and state",
        source: ctx,
        sourceUrl: au.sourceUrl || "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings",
        coverage: au.found ? "city" : "national",
        priceTrendPercent: null,
        sourceParts: [{ title: "Australian Bureau of Statistics", text: ctx }]
      });
    }
  }

  // Dubai: DLD's own registered sales (prebuilt from its transaction export)
  if (c === "united arab emirates") {
    const db = dubaiBenchmark({ text: `${property?.address || ""}, ${property?.city || raw.city || ""}`, propertyType, bedrooms: property?.bedrooms });
    if (db) {
      return {
        benchmarkValue: db.found ? db.value : null,
        benchmarkUnit: db.found ? db.unit : "perSqm",
        benchmarkLabel: db.found ? db.label : "Dubai Land Department registered sales",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: db.period || null,
        marketArea: db.found ? `${db.area}, Dubai` : db.area ? `${db.area}, Dubai — too few registered sales of this kind` : "Dubai — enter the DLD area or project",
        source: db.text,
        sourceUrl: db.sourceUrl || "https://dubailand.gov.ae/en/open-data/real-estate-data/",
        coverage: db.found ? "city" : "national",
        priceTrendPercent: null,
        sourceParts: [{ title: "Dubai Land Department", text: db.text }]
      };
    }
  }
  if (c === "germany" || c === "italy" || c === "israel" || c === "united arab emirates" || c === "turkey" || EUROSTAT_ONLY_COUNTRIES.includes(c)) {
    const hpi = raw.housingPriceIndex || {};
    let change = hpi.annualChangePercent ?? hpi.annualVariation ?? null;
    const sourceName = c === "germany" ? "Destatis" : c === "italy" ? "Istat" : c === "israel" ? "CBS Israel" : c === "united arab emirates" ? "Dubai Land Department" : c === "turkey" ? "TCMB" : "Eurostat";
    let trendSource = `${sourceName} — national index ${change != null ? (change >= 0 ? "+" : "") + change + "% YoY" : "unavailable"}`;
    // Germany's TOP-7 metros: Destatis's own metro change for flats / houses
    // a newer / finer official index for the property's area and type
    // (Destatis TOP-7 metros, Central Bank of Cyprus districts)
    const deReg = hpi.regional || null;
    const deFlat = /apart|flat|studio|penthouse/i.test(String(propertyType || ""));
    const deChange = deReg ? (deFlat ? deReg.flatsAnnualChangePercent : deReg.housesAnnualChangePercent) : null;
    if (deReg && deChange != null) {
      const houseWord = c === "germany" ? "one- and two-family houses" : "houses";
      const overall = c === "germany" ? ` (Germany overall ${change >= 0 ? "+" : ""}${change}%)` : deReg.national || deReg.nationalAll == null ? "" : ` (${countryLabel(country)} overall ${deReg.nationalAll >= 0 ? "+" : ""}${deReg.nationalAll}%, ${deReg.period} vs ${deReg.comparedWith})`;
      const typeWord = deReg.allTypes ? "all dwellings" : deFlat ? "flats" : houseWord;
      trendSource = `${deReg.sourceName || sourceName} house price index ${deReg.period}, ${deReg.area}: ${typeWord} ${deChange >= 0 ? "+" : ""}${deChange}% on a year earlier${overall}${deReg.note ? `. ${deReg.note}` : ""}`;
      change = deChange;
    }
    // FIX: this branch only ever had a % trend (no absolute price), leaving
    // "Market Benchmark" blank for every one of these countries — the exact
    // gap a user flagged ("find the average price of a property recently
    // purchased in the area"). lib/data/recentTransactionPrices.js supplies
    // a real, sourced absolute figure (national stats office, land
    // registry, or recognized market observatory — actual registered
    // transactions preferred over asking-price indices) where research
    // found one; countries without a credible source stay blank rather
    // than guess, same discipline as every other data module here.
    // a country may carry several official regional figures (Switzerland:
    // Zurich, Geneva) → the one for the property's place and type
    let recent = getRecentTransactionPrice(country);
    if (recent?.alternatives?.length) {
      const isHouse = /house|villa|detached|chalet/i.test(String(propertyType || "")) && !/apart|flat/i.test(String(propertyType || ""));
      const typeOk = (x) => !x.appliesTo || (x.appliesTo === "flats" ? !isHouse : x.appliesTo === "houses" ? isHouse : true);
      const pick = recent.alternatives.find((x) => typeOk(x) && recentAreaFits(x.area, property?.city || raw.city));
      if (pick) recent = { ...pick };
    }
    // City of Zurich flats: the city's own per-m² figure by quarter / Kreis
    if (c === "switzerland" && !/house|villa|detached|chalet/i.test(String(propertyType || ""))) {
      const zh = zurichCondo(`${property?.address || ""}, ${property?.city || raw.city || ""}`);
      if (zh) recent = zh;
    }
    // Real bug (Sept 2026): a figure published for ONE area (Milan, Berlin,
    // Tel Aviv, Nicosia, Zagreb…) was applied to every city of the country
    // — an Olbia villa was measured against Milan. Now it is the benchmark
    // only for a property in that area (or when it is a national figure,
    // labelled national); elsewhere it is named as context, not applied.
    // Italy: the OMI zone quotation (lib/italy/omi.js)
    let omi = c === "italy" ? raw.omi : null;
    if (omi && ["ok", "comune_range", "needs_locality"].includes(omi.status)) {
      const eur = (x) => "€" + Math.round(x).toLocaleString("en-US");
      const r = (x) => `${x.type.toLowerCase()} (${x.state.toLowerCase()} condition) ${eur(x.min)}–${eur(x.max)}/m²`;
      if (omi.status === "ok") {
        // a renovated home: the agency's own range for excellent condition
        // ("ottimo") of the same type, when the zone publishes one
        const best = property?.renovated ? omi.rows.find((x) => x.type === omi.main.type && /^ottimo$/i.test(x.state)) : null;
        const renoNote = property?.renovated
          ? best && best !== omi.main
            ? ` Renovation entered${property.renovationYear ? ` (${property.renovationYear})` : ""}: the benchmark uses the agency's range for EXCELLENT condition (ottimo) instead of the zone's usual ${omi.main.state.toLowerCase()} condition — an official price difference between conditions, not an estimate.`
            : best ? ` Renovation entered: the zone's usual condition is already excellent (ottimo).` : ` Renovation entered, but this zone publishes no separate range for excellent condition — the benchmark stays the usual condition.`
          : "";
        if (best) omi = { ...omi, main: best };
        const mid = (omi.main.min + omi.main.max) / 2;
        const zoneTxt = `OMI zone ${omi.zone} of ${omi.comune} ("${omi.zoneName}")${omi.matchedBy === "address" ? ` — the address (${omi.matchedAddress}) placed inside the zone perimeter on the agency's OMI map` : ""}`;
        return {
          benchmarkValue: mid,
          benchmarkUnit: "perSqm",
          benchmarkLabel: `OMI zone ${omi.zone} — midpoint of ${eur(omi.main.min)}–${eur(omi.main.max)}/m²`,
          governmentValue: null,
          transactionValue: null,
          transactionPeriod: omi.period,
          marketArea: `${omi.comune} — OMI zone ${omi.zone} ("${omi.zoneName}")`,
          source: `${omi.source}, ${omi.period}: ${zoneTxt}. The agency's €/m² ranges (gross area) for this zone: ${omi.rows.map(r).join("; ")}${omi.prevalentType ? ` (the zone's prevailing type: ${omi.prevalentType.toLowerCase()})` : ""}. Benchmark = midpoint of the range for ${best ? `${omi.main.state.toLowerCase()} condition` : `the zone's most common condition (${omi.main.state.toLowerCase()})`}; OMI ranges are calibrated on registered deeds.${omi.main.rentMin != null ? ` Rents in the same zone and type: €${omi.main.rentMin}–${omi.main.rentMax}/m² a month (${omi.main.rentSurface || "gross"} area) — the midpoint is used for the yield when no rent is entered.` : ""}${renoNote} ${trendSource}.`,
          sourceUrl: omi.sourceUrl,
          coverage: "city",
          priceTrendPercent: change ?? null,
          // the agency's rent range for the same zone, type and condition
          rentalBenchmark: omi.main.rentMin != null && omi.main.rentMax != null ? { monthlyRentPerSqm: (omi.main.rentMin + omi.main.rentMax) / 2, grossYieldPercent: null, source: `${omi.source}, ${omi.period} — zone ${omi.zone} rent range` } : null
        };
      }
      const ctx = omi.boundary
        ? `${omi.source}, ${omi.period}: the address (${omi.matchedAddress}) lies within 25 m of the boundary between OMI zones ${omi.zones.map((z) => `${z.zone} ("${z.zoneName}", ${eur(z.main.min)}–${eur(z.main.max)}/m²)`).join(" and ")} — the zone depends on which side the building stands, so none is applied.`
        : omi.status === "comune_range"
        ? `${omi.source}, ${omi.period}: ${omi.comune} has ${omi.zonesTotal} OMI zones; for this home type they range from ${eur(omi.low.main.min)}/m² (zone ${omi.low.zone}, "${omi.low.zoneName}") to ${eur(omi.high.main.max)}/m² (zone ${omi.high.zone}, "${omi.high.zoneName}"). Name the locality / neighbourhood to get the property's own zone — a town-wide range is not applied to this property.`
        : `${omi.source}, ${omi.period}: ${omi.comune} is divided into ${omi.zonesTotal} OMI zones with very different values — enter the neighbourhood (quartiere) with the address, e.g. "Testaccio, Roma", for the property's own zone.`;
      return {
        benchmarkValue: null,
        benchmarkUnit: "perSqm",
        benchmarkLabel: "OMI zone value (see source)",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: omi.period,
        marketArea: omi.comune,
        source: `${ctx} ${trendSource}.`,
        sourceUrl: omi.sourceUrl,
        coverage: "city",
        priceTrendPercent: change ?? null
      };
    }
    // Germany / NRW: the Gutachterausschuss' Immobilienrichtwert of the
    // address's own zone (lib/germany/irw.js) — € per m² of living area for
    // the board's stated reference home, from its register of all sales
    const irw = c === "germany" ? raw.irw : null;
    const eurDe = (x) => "€" + Math.round(x).toLocaleString("en-US");
    const irwOne = (z) => `${eurDe(z.value)}/m² (${z.reference || "reference home not stated"}${z.area ? `; zone ${z.area}` : ""})`;
    if (irw?.stag) { const [dd, mm, yy] = String(irw.stag).split("."); const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mm) - 1]; if (M && yy) irw.stag = `${Number(dd)} ${M} ${yy}`; }
    const irwHead = irw ? `BORIS-NRW, Immobilienrichtwerte as of ${irw.stag || "1 Jan"}${irw.street ? ` — ${irw.street} ${irw.number}, ${irw.municipality}` : irw.municipality ? ` — ${irw.municipality}` : ""}` : "";
    if (irw?.status === "ok") {
      const z = irw.main;
      const others = (irw.others || []).map((o) => `${o.submarket} ${irwOne(o)}`).join("; ");
      const text = `${irwHead}: ${z.board || "the local Gutachterausschuss"} publishes ${eurDe(z.value)} per m² of living area for ${z.submarket} in this zone${z.area ? ` (${z.area})` : ""}, derived from its register of all purchase contracts. Reference home: ${z.reference || "not stated"}. The value is for that reference home — the board's own conversion factors for another size, age, standard or floor (its published PDF, linked as the source) are not applied here.${others ? ` Other reference values at this address: ${others}.` : ""}`;
      return {
        benchmarkValue: z.value,
        benchmarkUnit: "perSqm",
        benchmarkLabel: `Immobilienrichtwert — ${irw.municipality}${z.area ? ` ${z.area}` : ""}, ${z.submarket}`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: irw.stag,
        marketArea: `${irw.municipality}${z.area ? ` — ${z.area}` : ""} (reference-value zone ${z.number || ""})`.replace(" )", ")"),
        source: `${text} ${trendSource}.`,
        sourceParts: [{ title: "Immobilienrichtwert (Gutachterausschuss)", text }, { title: "Price trend", text: `${trendSource}.` }],
        sourceUrl: z.factorsUrl || irw.sourceUrl,
        coverage: "city",
        priceTrendPercent: change ?? null
      };
    }
    const irwNote = !irw ? "" : irw.status === "several"
      ? ` ${irwHead}: the Gutachterausschuss publishes ${irw.candidates.length} reference values for ${irw.submarket} at this address, one per reference home — ${irw.candidates.map(irwOne).join("; ")}. No single one is applied: compare the property with each reference home.`
      : irw.status === "no_zone_for_type"
        ? ` ${irwHead}: no reference value for ${irw.submarket} at this address.${irw.others?.length ? ` Published there: ${irw.others.map((o) => `${o.submarket} ${irwOne(o)}`).join("; ")} — another home type, not applied.` : ""}`
        : irw.status === "no_zone" ? ` ${irwHead}: the local Gutachterausschuss has published no reference-value zone for this spot.`
        : irw.status === "street_not_found" || irw.status === "number_not_found" ? ` BORIS-NRW: "${irw.street}${irw.number ? " " + irw.number : ""}" was not found in NRW's official address register (Geobasis NRW) for ${irw.municipality} — check the street spelling and house number for the zone's reference value.`
        : irw.status === "needs_address" ? ` NRW publishes official reference values per zone (BORIS-NRW) — enter the street and house number in ${irw.municipality} for this property's value.`
        : "";
    // an NRW address with official reference values that cannot be applied
    // as one benchmark (several reference homes, another home type only…):
    // shown as they are — never replaced by another city's figure
    if (irwNote && irw.status !== "needs_address") {
      const n = irw.status === "several" ? `${irw.candidates.length} official reference values — see source` : irw.status === "no_zone_for_type" ? `no official reference value for ${irw.submarket} here` : irw.status === "no_zone" ? "no official reference-value zone here" : "address not found in NRW's register";
      return {
        benchmarkValue: null,
        benchmarkUnit: "perSqm",
        benchmarkLabel: "Immobilienrichtwert (see source)",
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: irw.stag,
        marketArea: `${irw.municipality} — ${n}`,
        source: `${irwNote.trim()} ${trendSource}.`,
        sourceParts: [{ title: "Immobilienrichtwert (Gutachterausschuss)", text: irwNote.trim() }, { title: "Price trend", text: `${trendSource}.` }],
        sourceUrl: irw.sourceUrl,
        coverage: "city",
        priceTrendPercent: change ?? null
      };
    }
    // Germany outside NRW: the city's valuation board (lib/germany/cityReports.js)
    const cr = c === "germany" && !(irw && irwNote) ? raw.cityReport : null;
    if (cr) {
      const one = (v) => `${v.segment}: ${eurDe(v.value)}/m² (${v.stat}${v.sales ? `, ${v.sales.toLocaleString("en-US")} sales` : ""})`;
      const head = `${cr.board}, ${cr.period}`;
      const main = cr.status === "ok" ? cr.main : null;
      const text = `${head}: ${main
        ? `${one(main)} — from the board's register of all notarised sales, applied as the benchmark.`
        : cr.status === "several"
          ? `${cr.candidates.length} figures for this home type — ${cr.candidates.map(one).join("; ")}. No single one is applied: compare the property with each.`
          : "no per-m² figure for this home type."}${cr.others.length ? ` Also published: ${cr.others.map(one).join("; ")}.` : ""}${cr.notes.length ? ` ${cr.notes.join(" ")}` : ""} City-wide figure — not the property's street or condition.`;
      return {
        benchmarkValue: main ? main.value : null,
        benchmarkUnit: "perSqm",
        benchmarkLabel: main ? `${cr.city} — ${main.segment} (${cr.period})` : `${cr.city} valuation board (see source)`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: cr.period,
        marketArea: main ? `${cr.city} (city-wide)` : `${cr.city} — ${cr.status === "several" ? `${cr.candidates.length} official figures, see source` : "no official figure for this home type"}`,
        source: `${text} ${trendSource}.`,
        sourceParts: [{ title: "Valuation board (Gutachterausschuss)", text }, { title: "Price trend", text: `${trendSource}.` }],
        sourceUrl: cr.sourceUrl,
        coverage: "city",
        priceTrendPercent: change ?? null
      };
    }
    // the national statistics office's own LOCAL figure for this place
    // (municipality / Eircode area / county) — lib/europe/localPrices.js
    const lp = raw.localPrice;
    if (lp?.status === "ok" && Number.isFinite(lp.value)) {
      const cur = { EUR: "€", NOK: "NOK ", SEK: "SEK ", DKK: "DKK " }[lp.currency] ?? `${lp.currency} `;
      const fmt = (v) => `${cur}${Math.round(v).toLocaleString("en-US")}${lp.unit === "perSqm" ? "/m²" : ""}`;
      const others = (lp.others || []).map((o) => `${o.type} ${fmt(o.value)}${o.sales != null ? ` (${o.sales} sales)` : ""}`).join("; ");
      return {
        benchmarkValue: lp.value,
        benchmarkUnit: lp.unit,
        benchmarkLabel: `${lp.source.split(" — ")[0]} — ${lp.area}, ${lp.typeLabel}`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: lp.period,
        marketArea: lp.area,
        source: `${lp.source}: ${lp.basis}. ${lp.area}, ${lp.typeLabel}, ${lp.period}: ${fmt(lp.value)}${lp.salesCount ? ` (${lp.salesCount.toLocaleString("en-US")} sales)` : ""}${lp.yoyPercent != null ? `, ${lp.yoyPercent >= 0 ? "+" : ""}${lp.yoyPercent}% on the year before` : ""}.${others ? ` Other home types there: ${others}.` : ""} ${trendSource}.`,
        sourceUrl: lp.sourceUrl,
        coverage: "city",
        priceTrendPercent: lp.yoyPercent ?? change ?? null
      };
    }
    const LOCAL_NOTES = {
      needs_address: " Croatia's official approximate values (PPV) are per street block — enter the street and number (e.g. \"Marmontova 5, Split\").",
      address_not_found: " The address was not found in Croatia's official address register (ISPU) — check the street and number (Croatian spelling).",
      ambiguous_address: " Several addresses in Croatia's register match — add the town.",
      no_house_values: " Croatia's official approximate values (PPV) are published for flats and land only, not houses.",
      fi_no_detached: " Statistics Finland publishes prices per area for dwellings in housing companies (flats, terraced houses) only — not for detached houses.",
      is_few_sales: " Iceland's purchase register has fewer than 10 usable sales of this home type there in the last 12 months — no local figure.",
      fi_few_sales: " Statistics Finland publishes no price for this area and home type (too few sales).",
      lu_no_houses: " Luxembourg's Observatoire de l'Habitat publishes prices per commune for apartments only, not houses.",
      pl_flats_only: " Poland's official price statistics (GUS per powiat, NBP per city) cover flats only — no official price per m² for houses, so a flat price is not applied.",
      pl_few_sales: " GUS publishes no median for this powiat and flat type (fewer than 20 market sales).",
      lu_few_sales: " Luxembourg's Observatoire de l'Habitat publishes no price for a commune with fewer than 10 apartment sales in the last 12 months."
    };
    const localNote = irwNote + (LOCAL_NOTES[lp?.status] || (lp?.status === "needs_district" || lp?.status === "context" ? ` ${lp.note}` : lp?.status === "apartments_not_covered" ? " Sweden's apartments are tenant-owner shares (bostadsrätter), not real property — the official price statistics cover houses only." : ""));
    // a context-only local figure that still carries the place's own official change
    if (lp?.status === "context" && Number.isFinite(lp.yoyPercent) && lp.trendText) { trendSource = lp.trendText; change = lp.yoyPercent; }
    const national = recent && /national|malta & gozo/i.test(recent.area);
    // a figure for flats only (Iceland's 60–90 m² flats, Finland's housing
    // companies) is not a house's benchmark
    const wantsHouseType = /house|villa|detached|chalet/i.test(String(propertyType || "")) && !/apart|flat/i.test(String(propertyType || ""));
    const flatsOnly = Boolean(recent && wantsHouseType && (recent.appliesTo === "flats" || /apartment|flats?\b|housing compan|multi-d|ejerlejlighed|condominium|stockwerkeigentum/i.test(`${recent.basis || ""} ${recent.source || ""}`)));
    // a figure whose source does not say which homes it covers is context only
    const typeUnstated = recent?.appliesTo === "unstated";
    const fit = recent && !national && !flatsOnly && !typeUnstated ? (recent.placeMatched || recentAreaFits(recent.area, property?.city || raw.city)) : false;
    if (recent && national) {
      // a whole country's average says nothing about one town (Amsterdam vs
      // the Dutch average) → named as context, never the verdict
      const fmt = recent.unit === "perSqm" ? `${Math.round(recent.value).toLocaleString("en-US")} per m²` : `${Math.round(recent.value).toLocaleString("en-US")} per home`;
      return {
        benchmarkValue: null,
        benchmarkUnit: recent.unit,
        benchmarkLabel: `${sourceName} HPI (National)`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: recent.period ?? hpi.period ?? null,
        marketArea: `${countryLabel(country)} — no official local price figure for ${property?.city || "this place"} yet`,
        source: `${trendSource}. National average (${recent.source}, ${recent.period || "latest"}): ${fmt} — whole-country context only, not applied to ${property?.city || "this property"}.${localNote}`,
        coverage: "national",
        priceTrendPercent: change ?? null
      };
    }
    if (recent && !fit) {
      return {
        benchmarkValue: null,
        benchmarkUnit: recent.unit,
        benchmarkLabel: `${sourceName} HPI (National)`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: hpi.period ?? hpi.quarter ?? null,
        marketArea: lp?.status === "needs_address" ? `${countryLabel(country)} — enter the street and number for this property's official price block` : `${countryLabel(country)} — no official price figure for ${property?.city || "this city"} yet`,
        source: typeUnstated
          ? `${trendSource}. Official figure on file (${recent.source}, ${recent.area}, ${recent.period}): ${Math.round(recent.value).toLocaleString("en-US")}${recent.unit === "perSqm" ? " per m²" : " per home"} — the published table does not state which home types it covers, so it is context only.${localNote}`
          : flatsOnly
          ? `${trendSource}. The official price figure on file (${recent.source}, ${recent.area}) covers flats only — not applied to a house.${localNote}`
          : `${trendSource}. The official price figure on file covers ${recent.area} only (${recent.source}) — not applied to ${property?.city || "this city"}.${localNote}`,
        coverage: "national",
        priceTrendPercent: change ?? null
      };
    }
    if (recent) {
      return {
        benchmarkValue: recent.value,
        benchmarkUnit: recent.unit,
        benchmarkLabel: `${recent.source} (${recent.area})`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: recent.period,
        marketArea: recent.area,
        source: `${recent.source} — ${recent.basis}. ${trendSource}.${localNote}`,
        coverage: /national/i.test(recent.area) ? "national" : "city",
        priceTrendPercent: change ?? null
      };
    }
    return {
      benchmarkValue: null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: lp?.status === "context" && lp.label ? lp.label : deReg && deChange != null ? `${deReg.sourceName || sourceName} price index — ${deReg.area}` : `${sourceName} HPI (National)`,
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: lp?.status === "context" && lp.period ? lp.period : deReg && deChange != null ? deReg.period : (hpi.period ?? hpi.quarter ?? null),
      // Dubai's index isn't a UAE-wide figure — say so rather than implying
      // national coverage the source doesn't have.
      marketArea: c === "united arab emirates" ? (raw.status === "NO_CURRENT_OFFICIAL_SOURCE" ? "United Arab Emirates — no current official price source reachable" : "Dubai only — other emirates not covered") : deReg && deChange != null && !deReg.national && c !== "germany" ? `${deReg.area} — official price trend; no official price level is published` : lp?.status === "context" && lp.area ? (lp.marketArea || `${lp.area} — official figure on another basis, not applied (see source)`) : `${countryLabel(country)} — city-level data not yet connected`,
      source: c === "united arab emirates" && raw.status === "NO_CURRENT_OFFICIAL_SOURCE" ? raw.message : `${trendSource}${localNote ? "." + localNote : ""}`,
      coverage: "national",
      priceTrendPercent: change ?? null
    };
  }

  const REGIONAL_FIXTURE_COUNTRIES = [
    "serbia", "bosnia and herzegovina", "montenegro", "north macedonia", "ukraine", "albania", "andorra", "monaco",
    "russia", "kazakhstan", "canada", "mexico", "brazil", "australia", "new zealand", "argentina",
    "chile", "colombia", "peru", "uruguay", "dominican republic", "georgia", "south africa", "morocco", "kenya",
    "thailand", "indonesia", "south korea", "india", "japan", "sri lanka", "cambodia", "armenia"
  ];
  if (REGIONAL_FIXTURE_COUNTRIES.includes(c) && (raw.cityTrends || raw.nationalTypeTrends)) {
    // official price TRENDS only (Stats SA metros, Morocco IPAI, KNBS):
    // no price level exists in these sources → never a benchmark
    const where = String(property?.city || raw.city || "");
    const w = ` ${where.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9']+/g, " ")} `;
    const kind = /apart|flat|studio|penthouse|condo/i.test(propertyType || "") ? "flats" : /house|villa|town|home/i.test(propertyType || "") ? "houses" : null;
    const fmt = (x) => `${x >= 0 ? "+" : ""}${x}%`;
    const metro = (raw.cityTrends || []).find((m) => m.aliases.some((a) => w.includes(` ${a} `)));
    const nat = raw.nationalChangePercent ?? null;
    let trend = nat, area = countryLabel(country), detail;
    if (metro) {
      const t = kind && metro[kind] != null ? metro[kind] : metro.total;
      trend = t; area = metro.name;
      detail = `${metro.name}: ${fmt(metro.total)} over 12 months (all homes)${metro.flats != null ? `; flats ${fmt(metro.flats)}, houses ${fmt(metro.houses)}` : ""}${raw.typeNote ? ` (${raw.typeNote})` : ""}.`;
    } else if (raw.cityTrends) {
      detail = `No metro match for ${where || "this place"} — the official index is published for the 8 metros only; national ${fmt(nat)} shown as context.`;
    } else {
      const tt = raw.nationalTypeTrends || {};
      const t = kind === "flats" ? tt.flats : kind === "houses" ? (tt.houses ?? tt.villas) : null;
      if (t != null) trend = t;
      const q = raw.cityQuarterly ? Object.entries(raw.cityQuarterly).find(([k]) => w.includes(` ${k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} `) || (k === "Tanger" && /\btangier\b/.test(w)) || (k === "Fès" && /\bfez\b/.test(w))) : null;
      detail = `National ${fmt(nat)} over 12 months${Object.keys(tt).length ? ` (${Object.entries(tt).map(([k, v]) => `${k} ${fmt(v)}`).join(", ")})` : ""}.${q ? ` ${q[0]}: ${fmt(q[1])} on the previous quarter (only the quarterly change is published by city).` : ""}${raw.coverageNote ? ` ${raw.coverageNote}.` : ""}`;
    }
    return {
      benchmarkValue: null,
      benchmarkUnit: "perSqm",
      benchmarkLabel: `${countryLabel(country)} official price index (trend only)`,
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: raw.period ?? null,
      marketArea: `${area} — official price trend; no official price level is published`,
      source: `${raw.sources?.official || countryLabel(country)}, ${raw.period}: ${detail}`,
      sourceUrl: raw.sourceUrls?.official || null,
      coverage: metro ? "city" : "national",
      priceTrendPercent: trend
    };
  }
  if (REGIONAL_FIXTURE_COUNTRIES.includes(c)) {
    // a city's figure applies only to that city; a national figure is
    // context, never a town's benchmark (same rule as recentAreaFits above)
    const where = property?.city || raw.city || "";
    // Monaco (Oct 2026): IMSEE's Real Estate Observatory breaks the
    // principality down by quartier, and the spread is real -- Larvotto
    // 71,167 EUR/m² vs Moneghetti 43,797 EUR/m², nearly double. A single
    // national average misrepresents any specific address, so a named
    // district match (via its own aliases, same alias-matching idea as
    // recentAreaFits) is tried first; every other REGIONAL_FIXTURE_COUNTRIES
    // entry leaves raw.districts unset, so districtMatch is always null for
    // them and this block is a no-op there (behavior unchanged).
    let districtMatch = null;
    if (Array.isArray(raw.districts)) {
      const w = ` ${String(where).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9']+/g, " ")} `;
      districtMatch = raw.districts.find((d) => (d.aliases || []).some((a) => w.includes(` ${a} `)));
    }
    const resolvedCityName = districtMatch?.name ?? raw.cityName;
    const resolvedCityBenchmarkValue = districtMatch?.benchmarkValue ?? raw.cityBenchmarkValue;
    const resolvedCityChangePercent = districtMatch?.changePercent ?? raw.cityChangePercent;
    const fits = raw.regionMatch ? true : districtMatch ? true : raw.cityName ? recentAreaFits(raw.cityName, where) : false;
    if (!fits) {
      const cityTxt = raw.cityName && raw.cityBenchmarkValue != null ? ` The official figure on file covers ${raw.cityName} only (${Math.round(raw.cityBenchmarkValue).toLocaleString("en-US")} per m²) — not applied to ${where || "this place"}.` : "";
      const natTxt = raw.nationalBenchmarkValue != null ? ` National average ${raw.currencyLabel || ""}${Math.round(raw.nationalBenchmarkValue).toLocaleString("en-US")}${raw.benchmarkUnit === "total" ? " per home" : " per m²"} — whole-country context only.${raw.coverageNote ? ` ${raw.coverageNote}` : ""}` : "";
      const districtsTxt = Array.isArray(raw.districts) && raw.districts.length
        ? ` Districts on file: ${raw.districts.map((d) => `${d.name} ${Math.round(d.benchmarkValue).toLocaleString("en-US")}`).join(", ")} per m² — include the district name in the address/city field (e.g. "Larvotto, Monaco") to match one.`
        : "";
      const nat = raw.changeIsMonthly ? null : (raw.nationalChangePercent ?? null);
      return {
        benchmarkValue: null,
        benchmarkUnit: raw.benchmarkUnit || "perSqm",
        benchmarkLabel: `${countryLabel(country)} Official Estimate`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: raw.period ?? null,
        marketArea: raw.nationalBenchmarkValue != null ? `${countryLabel(country)} — official national figure only (context); none published for ${where || "this place"}` : `${countryLabel(country)} — no official local price figure for ${where || "this place"} yet`,
        source: `${raw.sources?.official || countryLabel(country)}${nat != null ? ` — national ${nat >= 0 ? "+" : ""}${nat}% YoY` : ""}.${cityTxt}${natTxt}${districtsTxt}`,
        coverage: "national",
        priceTrendPercent: nat
      };
    }
    // a figure for flats only is never a house's benchmark; offer (asking)
    // prices are never a benchmark; a month-on-month change is never shown
    // as the yearly trend
    const kindRF = /apart|flat|studio|penthouse|condo/i.test(propertyType || "") ? "flats" : /house|villa|town|home/i.test(propertyType || "") ? "houses" : null;
    // a flats-only series' change is not a house's trend either
    const trendRF = raw.changeIsMonthly || (raw.flatsOnly && kindRF === "houses") ? null : (resolvedCityChangePercent ?? raw.nationalChangePercent ?? null);
    const changeIsLocal = resolvedCityChangePercent != null;
    if (raw.askingPrices || (raw.flatsOnly && kindRF === "houses")) {
      const why = raw.askingPrices ? `${raw.askingNote || "built from OFFER (asking) prices, not closed sales"} — shown as context, never as the benchmark` : "for apartments only — not applied to a house";
      return {
        benchmarkValue: null,
        benchmarkUnit: raw.benchmarkUnit || "perSqm",
        benchmarkLabel: `${countryLabel(country)} official figure (context only)`,
        governmentValue: null,
        transactionValue: null,
        transactionPeriod: raw.period ?? null,
        marketArea: `${resolvedCityName || countryLabel(country)} — official figure ${raw.askingPrices ? (raw.askingPartly ? "partly from asking prices" : "from asking prices") : "for apartments only"}, not applied`,
        source: `${raw.sources?.official || countryLabel(country)}: ${resolvedCityName || countryLabel(country)}${resolvedCityBenchmarkValue != null ? ` ${raw.currencyLabel || ""}${Math.round(resolvedCityBenchmarkValue).toLocaleString("en-US")}${raw.benchmarkUnit === "total" ? " per home" : " per m²"}` : ""} (${raw.period}) — ${why}.${trendRF != null ? ` Change ${trendRF >= 0 ? "+" : ""}${trendRF}% on a year earlier.` : ""}${raw.coverageNote ? ` ${raw.coverageNote}` : ""}`,
        sourceUrl: raw.sourceUrls?.official || null,
        coverage: "city",
        priceTrendPercent: trendRF
      };
    }
    const benchmarkValue = resolvedCityBenchmarkValue ?? null;
    const changePercent = trendRF;
    const area = resolvedCityName || countryLabel(country);
    return {
      benchmarkValue,
      benchmarkUnit: raw.benchmarkUnit || "perSqm",
      benchmarkLabel: `${countryLabel(country)} Official Estimate${resolvedCityName ? ` (${resolvedCityName})` : ""}`,
      governmentValue: null,
      transactionValue: null,
      transactionPeriod: raw.period ?? null,
      marketArea: area,
      source: `${raw.sources?.official || countryLabel(country)}${changePercent != null ? ` — ${!changeIsLocal && resolvedCityName ? "national " : ""}${changePercent >= 0 ? "+" : ""}${changePercent}% YoY` : ""}${raw.coverageNote ? ` (${raw.coverageNote})` : ""}`,
      sourceUrl: raw.sourceUrls?.official || null,
      coverage: benchmarkValue != null ? "city" : "national",
      priceTrendPercent: changePercent ?? null
    };
  }

  return null;
}

function countryLabel(country) {
  return String(country || "").trim() || "This market";
}

// Returns {data, error} rather than a bare value — a country with no
// adapter at all (error:null, the honest "not enough verified evidence
// yet" case) used to be indistinguishable from this country's own adapter
// throwing, timing out, or getting a non-2xx from Pradixium's own
// /api/* endpoint. Both silently became a bare `null`, which read on
// screen exactly like a real coverage gap and left the actual failure
// with no trace anywhere (not the response, not a log) — the call site
// below now records the real error into the same `errors` object the AI
// agents already report through.
async function fetchGovernmentData(property, origin) {
  const country = String(property?.country || "").trim().toLowerCase();
  const endpoint = COUNTRY_ENDPOINTS[country];
  if (!endpoint) return { data: null, error: null };

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
  if (property.bedrooms) params.set("bedrooms", property.bedrooms);
  if (property.landArea) params.set("landArea", property.landArea);
  if (property.renovated) params.set("renovated", "1");
  if (property.renovationYear) params.set("renovationYear", property.renovationYear);

  const controller = new AbortController();
  // market-data.js runs its 3 sources in parallel with 8s timeouts each,
  // so it always resolves well under 10s. 15s here is a safe margin.
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(`${origin}/api/${endpoint}?${params.toString()}`, { signal: controller.signal });
    if (!r.ok) return { data: null, error: `/api/${endpoint} returned HTTP ${r.status}` };
    const json = await r.json();
    return json?.success ? { data: json.data || json, error: null } : { data: null, error: `/api/${endpoint}: ${json?.error || "responded success:false"}` };
  } catch (e) {
    return { data: null, error: `/api/${endpoint}: ${String(e?.message || e)}` };
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
// this endpoint never sees or needs the service-role key, EXCEPT for the
// API-key path just below, which by nature can't be scoped by the
// caller's own RLS token (the caller isn't a signed-in browser session).
async function checkApiKeyEntitlement(rawKey) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return false;
  try {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/api_keys?key_hash=eq.${keyHash}&revoked_at=is.null&select=user_id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!r.ok) return false;
    const rows = await r.json();
    const row = rows[0];
    if (!row) return false;

    // Best-effort, never blocks the response on it.
    fetch(`${SUPABASE_URL}/rest/v1/api_keys?key_hash=eq.${keyHash}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ last_used_at: new Date().toISOString() })
    }).catch(() => {});

    // A key survives after the plan lapses unless explicitly revoked
    // (api/business-api-key.js), so still confirm the plan is active now —
    // API access is a Business-plan benefit, not a permanent grant.
    const r2 = await fetch(
      `${SUPABASE_URL}/rest/v1/purchases?user_id=eq.${row.user_id}&kind=eq.business&select=expires_at`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!r2.ok) return false;
    const purchases = await r2.json();
    const now = Date.now();
    return purchases.some((p) => p.expires_at && new Date(p.expires_at).getTime() > now);
  } catch {
    return false;
  }
}

async function checkEntitlement(authHeader, signature, legacySignature) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  if (token.startsWith("px_live_")) return checkApiKeyEntitlement(token);
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
      // "monthly_usage" marks a report already spent from the individual
      // monthly plan's per-cycle cap (see api/consume-monthly-slot.js) —
      // permanent access to that specific report, same as "report".
      // legacySignature only matches a report purchased before the Oct
      // 2026 signature fix — never written for a new purchase.
      return (row.kind === "report" || row.kind === "monthly_usage") && (row.report_signature === signature || (legacySignature && row.report_signature === legacySignature));
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
  //
  // FIX (Oct 2026): the old signature was only country+city+price+size --
  // two genuinely DIFFERENT properties that happen to share a city and a
  // round listing price/size (common: new-build units, coincidental
  // matches) collided onto the same signature. Once either one was
  // purchased, isReportPaid()/checkEntitlement() would treat the OTHER
  // property as already paid for -- a real, silent monthly-cap bypass /
  // revenue leak, not just a theoretical edge case. Now folds in the
  // address, bedrooms, bathrooms, propertyType and monthlyRent (all
  // already collected and already on `property`) so two unrelated
  // properties essentially can't collide. legacySignature keeps
  // recognizing the reports already purchased under the old, narrower
  // format (13 live rows as of this fix) -- it is only ever compared
  // against, never written for a new purchase.
  const signature = [property.country, property.city, property.address, property.price, property.size, property.bedrooms, property.bathrooms, property.propertyType, property.monthlyRent].join("|");
  const legacySignature = [property.country, property.city, property.price, property.size].join("|");
  const entitlementPromise = checkEntitlement(req.headers.authorization, signature, legacySignature);

  let marketData = body?.marketData || null;
  let marketDataError = null;
  if (!marketData) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = `${proto}://${req.headers.host}`;
    const fetched = await fetchGovernmentData(property, origin);
    marketData = fetched.data;
    marketDataError = fetched.error;
  }

  const marketEvidence = nonResidentialEvidence(normalizeMarketEvidence(property.country, marketData, property.propertyType, property), property.propertyType);
  // Germany: the municipality's Zensus 2022 average rent — used for the
  // yield only when no rent was entered (flagged as estimated there)
  const deRent = /^germany$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) ? marketData?.rent : null;
  if (marketEvidence && deRent?.rentPerSqm) {
    const sz = Number(property.size);
    const text = `Zensus 2022 (census of ${deRent.date}): average net cold rent (Nettokaltmiete) of let dwellings in ${deRent.municipality} (${deRent.land}): €${deRent.rentPerSqm.toFixed(2)}/m²${deRent.letDwellings ? ` over ${deRent.letDwellings.toLocaleString("en-US")} let dwellings` : ""}. It covers all existing tenancies, not the rent of a new letting today.${property.monthlyRent ? "" : sz > 0 ? ` No rent was entered, so the yield uses ${sz} m² × €${deRent.rentPerSqm.toFixed(2)} = €${Math.round(sz * deRent.rentPerSqm).toLocaleString("en-US")}/month (estimated).` : ""}`;
    marketEvidence.rentalBenchmark = { monthlyRentPerSqm: deRent.rentPerSqm, grossYieldPercent: null, source: deRent.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: "Rent (Zensus 2022)", text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // Spain: the municipality's official rent (MIVAU SERPAVI, tax returns of
  // habitual-residence lets) — used for the yield only when no rent was
  // entered (flagged as estimated there)
  const esRent = /^spain$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? spainRent(marketData?.catastroZone?.geo?.muniCode || marketData?.catastroZone?.town?.muniCode, property.propertyType, marketData?.catastroZone?.geo?.type === "portal" ? { lat: marketData.catastroZone.geo.lat, lon: marketData.catastroZone.geo.lon } : null) : null;
  if (esRent) {
    const town = marketData.catastroZone.geo?.muni || marketData.catastroZone.town?.muni || "the municipality";
    const sz = Number(property.size);
    const where = esRent.level === "section" ? `this address's census section (${esRent.section}, ${town})` : town;
    const muniTxt = esRent.level === "section" && esRent.municipality ? ` ${town} as a whole: €${esRent.municipality.median.toFixed(2)} (${esRent.municipality.homes.toLocaleString("en-US")} homes).` : "";
    const text = `${esRent.source} (last updated ${esRent.lastUpdate}): ${esRent.year} tax returns of homes let as a habitual residence in ${where} — ${esRent.kind === "house" ? "houses" : "flats"}: median €${esRent.median.toFixed(2)}/m² a month, middle half €${esRent.p25.toFixed(2)}–${esRent.p75.toFixed(2)}, ${esRent.homes.toLocaleString("en-US")} let homes (Catastro built area).${muniTxt} Existing leases of that year, not today's asking rents.${property.monthlyRent ? "" : sz > 0 ? ` No rent was entered, so the yield uses ${sz} m² × €${esRent.median.toFixed(2)} = €${Math.round(sz * esRent.median).toLocaleString("en-US")}/month (estimated).` : ""}`;
    marketEvidence.rentalBenchmark = { monthlyRentPerSqm: esRent.median, grossYieldPercent: null, source: esRent.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Rent (MIVAU SERPAVI ${esRent.year})`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // US: the ZIP's median gross rent by bedrooms (Census ACS 5-year B25031)
  // — the yield basis only when no rent was entered (flagged as estimated)
  const usR = /^(united states|usa|us)$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? usRent(marketData?.property?.zip || property.zip, property.bedrooms ?? marketData?.property?.bedrooms, marketData?.property?.city || marketData?.city, marketData?.property?.state || marketData?.region) : null;
  if (usR) {
    const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
    const use = !usR.topCoded && !property.monthlyRent;
    const text = `${usR.source}: median gross rent of ${usR.label} in ${usR.place ? `${usR.place} (the whole city — enter the street address or ZIP for the local figure)` : `ZIP ${usR.zip}`}, ${usR.period}: ${usR.topCoded ? `${usd(usR.value - 1)} or more (the Census top-codes this median — not used as a number)` : `${usd(usR.value)} a month`}. Gross rent includes utilities paid by the tenant and covers existing tenancies over the 5-year period, not today's asking rents.${use ? ` No rent was entered, so the yield uses ${usd(usR.value)}/month (estimated).` : ""}`;
    if (use) marketEvidence.rentalBenchmark = { monthlyRentFlat: usR.value, grossYieldPercent: null, source: usR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: "Rent (Census ACS)", text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // New Zealand: median weekly rent of new private tenancies (MBIE bond
  // data) — suburb (SA2) by type × bedrooms, else the council area
  const nzR = /^new zealand$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? newZealandRent(`${property.address || ""}, ${property.city || ""}`, property.propertyType, property.bedrooms) : null;
  if (nzR) {
    const nzd = (x) => "NZ$" + Math.round(x).toLocaleString("en-US");
    const what = (k) => { const [t, b] = k.split("|"); return `${t === "ALL" ? "all dwellings" : t.toLowerCase() + "s"}${b === "ALL" ? "" : `, ${b} bedroom${b === "1" ? "" : "s"}`}`; };
    const many = nzR.several?.length ? ` Suburb areas of that name (Stats NZ SA2, ${nzR.quarter || nzR.period}): ${nzR.several.slice(0, 8).map((x) => `${x.area} ${nzd(x.values[0])}/week (${what(x.key)}, ${x.values[1]} bonds)`).join("; ")} — several areas, none picked; enter the exact area name to use one.` : "";
    const v = nzR.values;
    const monthly = v ? Math.round(v[0] * 52 / 12) : null;
    const use = v && !property.monthlyRent;
    const head = v ? `median weekly rent of new tenancies in ${nzR.level === "sa2" ? `${nzR.area} (${nzR.ta}, Stats NZ SA2 area)` : `${nzR.area} (whole council area)`}, ${nzR.period}, ${what(nzR.key)}: ${nzd(v[0])} (middle half ${nzd(v[2])}–${nzd(v[3])}, ${v[1].toLocaleString("en-US")} bonds lodged).` : "no single area matched.";
    const text = `${nzR.source}, ${head}${many} Rents agreed on new private lettings.${use ? ` No rent was entered, so the yield uses ${nzd(v[0])} × 52 ÷ 12 = ${nzd(monthly)}/month (estimated).` : ""}`;
    if (use) marketEvidence.rentalBenchmark = { monthlyRentFlat: monthly, grossYieldPercent: null, source: nzR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Rent (MBIE bond data)`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // Japan: average rent per m² of PRIVATE rented homes (2023 Housing and
  // Land Survey) for the municipality / ward — × the entered size → yield
  const jpR = /^japan$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? japanRent(`${property.address || ""}, ${property.city || ""}`) : null;
  if (jpR) {
    const yen = (x) => "¥" + Math.round(x).toLocaleString("en-US");
    const sz = Number(property.size);
    const text = jpR.ambiguous
      ? `${"Statistics Bureau of Japan, 2023 Housing and Land Survey (table 122-4)"}: the place matches several areas (${jpR.ambiguous.join("; ")}) — enter the prefecture or city (e.g. "Kita-ku, Osaka") for the area's average rent.`
      : `${jpR.source}: average monthly rent per m² of floor area of private rented homes in ${jpR.area}: ${yen(jpR.perM2)}/m² (${jpR.homes.toLocaleString("en-US")} private rented homes, rent-free homes excluded; survey date 1 October ${jpR.year}). An average of ALL existing tenancies (old and new buildings, long-standing leases), not today's asking rents.${jpR.level === "pref" ? " A whole-prefecture average — not used for the yield; enter the city or ward." : !property.monthlyRent && sz > 0 ? ` No rent was entered, so the yield uses ${sz} m² × ${yen(jpR.perM2)} = ${yen(sz * jpR.perM2)}/month (estimated).` : ""}`;
    if (!jpR.ambiguous && jpR.level !== "pref" && !property.monthlyRent) marketEvidence.rentalBenchmark = { monthlyRentPerSqm: jpR.perM2, grossYieldPercent: null, source: jpR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: "Rent (Housing and Land Survey 2023)", text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // Ireland: RTB average rent of new tenancies for the place, type and
  // bedrooms (CSO RIQ02) — the yield basis only when no rent was entered
  const ieR = /^ireland$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? irelandRent(`${property.address || ""}, ${property.city || ""}`, property.propertyType, property.bedrooms) : null;
  if (ieR) {
    const eur = (x) => "€" + Math.round(x).toLocaleString("en-US");
    const what = `${ieR.type === "All property types" ? "all home types" : ieR.type.toLowerCase()}, ${ieR.beds === "All bedrooms" ? "all bedroom counts" : ieR.beds.toLowerCase()}`;
    const text = `${ieR.source}, ${ieR.quarter}: average monthly rent of new tenancies registered in ${ieR.place} (${what}): ${eur(ieR.monthly)}. These are rents agreed on new lettings in that quarter.${property.monthlyRent ? "" : ` No rent was entered, so the yield uses ${eur(ieR.monthly)}/month (estimated).`}`;
    if (!property.monthlyRent) marketEvidence.rentalBenchmark = { monthlyRentFlat: ieR.monthly, grossYieldPercent: null, source: ieR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Rent (RTB ${ieR.quarter})`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // Canada: CMHC average rent by bedrooms (purpose-built rental, October
  // survey) — the yield basis for an apartment only when no rent was entered
  const caR = /^canada$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? canadaRent(`${property.address || ""}, ${property.city || ""}`, property.bedrooms) : null;
  if (caR) {
    const cad = (x) => "C$" + Math.round(x).toLocaleString("en-US");
    const isFlat = /apart|flat|condo|studio|penthouse/i.test(String(property.propertyType || ""));
    const use = isFlat && caR.monthly && !property.monthlyRent;
    const area = caR.geo.replace(/, (Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland and Labrador|Prince Edward Island)$/, "");
    const all = ["bachelor", "1-bed", "2-bed", "3-bed"].map((l, i) => caR.row[i] != null ? `${l} ${cad(caR.row[i])}` : null).filter(Boolean).join(", ");
    const text = `${caR.source}, October ${caR.year}, ${area}: average monthly rents ${all}. These average ALL occupied units in purpose-built rental buildings (long-standing tenancies included) — not new lettings, rented condominiums or houses.${!isFlat ? " Not used for a house's yield." : use ? ` No rent was entered, so the yield uses the ${["bachelor", "1-bed", "2-bed", "3-bed"][caR.beds]} average ${cad(caR.monthly)}/month (estimated).` : ""}`;
    if (use) marketEvidence.rentalBenchmark = { monthlyRentFlat: caR.monthly, grossYieldPercent: null, source: caR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Rent (CMHC ${caR.year})`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // Finland: average rent per m² of non-subsidised flats (new contracts),
  // Statistics Finland — the yield basis for a flat only when no rent was
  // entered (the statistics cover rental flats, not houses)
  const fiR = /^finland$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? finlandRent(`${property.address || ""} ${property.city || ""}`, property.bedrooms) : null;
  if (fiR) {
    const isFlat = !/house|villa|detached|cottage|terrace|town/i.test(String(property.propertyType || ""));
    const sz = Number(property.size);
    const use = isFlat && !property.monthlyRent && sz > 0;
    const text = `${fiR.source}, ${fiR.quarter}, ${fiR.city}: average rent of ${fiR.basis === "new" ? "NEW rental contracts" : "all rental contracts"} for ${fiR.room === "Total" ? "all flats" : fiR.room.toLowerCase().replace("+", "s and larger")}: €${fiR.perSqm.toFixed(2)}/m² a month (${fiR.n.toLocaleString("en-US")} contracts).${!isFlat ? " The statistics cover rental flats — not used for a house's yield." : use ? ` No rent was entered, so the yield uses ${sz} m² × €${fiR.perSqm.toFixed(2)} = €${Math.round(sz * fiR.perSqm).toLocaleString("en-US")}/month (estimated).` : ""}`;
    if (use) marketEvidence.rentalBenchmark = { monthlyRentPerSqm: fiR.perSqm, grossYieldPercent: null, source: fiR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Rent (Statistics Finland ${fiR.quarter})`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // Norway: SSB rental market survey average rent by zone and rooms — the
  // yield basis only when no rent was entered
  const noR = /^norway$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? norwayRent(`${property.address || ""} ${property.city || ""}`, property.bedrooms) : null;
  if (noR) {
    const nok = (x) => "NOK " + Math.round(x).toLocaleString("en-US");
    const text = `${noR.source}, ${noR.year}, ${noR.zone}: average monthly rent of ${noR.rooms} dwellings ${nok(noR.monthly)} (${nok(noR.perSqmYear)} per m² a year). Rooms counted as living rooms + bedrooms (kitchen excluded); all current tenancies in the survey.${property.monthlyRent ? "" : ` No rent was entered, so the yield uses ${nok(noR.monthly)}/month (estimated).`}`;
    if (!property.monthlyRent) marketEvidence.rentalBenchmark = { monthlyRentFlat: noR.monthly, grossYieldPercent: null, source: noR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Rent (SSB ${noR.year})`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // Sweden: SCB median rent per m² of rental flats (hyresrätter, regulated
  // first-hand stock) — the yield basis for a flat only when no rent was
  // entered; context for a house
  const seR = /^sweden$/i.test(String(property.country || "").trim()) && !/commercial|land/i.test(String(property.propertyType || "")) && marketEvidence
    ? swedenRent(`${property.address || ""} ${property.city || ""}`) : null;
  const seC = /^sweden$/i.test(String(property.country || "").trim()) && marketEvidence && /apart|flat|condo|studio|penthouse/i.test(String(property.propertyType || ""))
    ? swedenCondo(`${property.address || ""} ${property.city || ""}`) : null;
  if (seC) {
    const sek = (x) => "SEK " + Math.round(x).toLocaleString("en-US");
    const ch = seC.prevMedian ? ` (${seC.prevYear}: ${sek(seC.prevMedian)}, ${seC.median >= seC.prevMedian ? "+" : ""}${(((seC.median / seC.prevMedian) - 1) * 100).toFixed(1)}%)` : "";
    const text = `${seC.source}, ${seC.year}, ${seC.region}: median price of the ${seC.n.toLocaleString("en-US")} tenant-owned flats (bostadsrätter) sold — ${sek(seC.median)} per flat${ch}. A whole-flat price over the whole area, any size or location in it — context, not this flat's benchmark.`;
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Tenant-owned flats (SCB ${seC.year})`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }
  if (seR) {
    const isFlat = !/house|villa|detached|cottage|terrace|town/i.test(String(property.propertyType || ""));
    const sz = Number(property.size);
    const perMonth = seR.perSqmYear / 12;
    const use = isFlat && !property.monthlyRent && sz > 0;
    const text = `${seR.source}, ${seR.year}, ${seR.municipality}: median rent SEK ${seR.perSqmYear.toLocaleString("en-US")} per m² a year (±${seR.moe}), i.e. SEK ${perMonth.toFixed(0)}/m² a month, of first-hand rental flats (hyresrätter, rents set in the regulated utility-value system). Sub-letting an owned flat follows other rules.${!isFlat ? " Not used for a house's yield." : use ? ` No rent was entered, so the yield uses ${sz} m² × SEK ${perMonth.toFixed(0)} = SEK ${Math.round(sz * perMonth).toLocaleString("en-US")}/month (estimated).` : ""}`;
    if (use) marketEvidence.rentalBenchmark = { monthlyRentPerSqm: perMonth, grossYieldPercent: null, source: seR.source };
    marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: `Rent (SCB ${seR.year})`, text }];
    marketEvidence.source = `${marketEvidence.source} ${text}`;
  }

  // each source's own licence / attribution terms (lib/data/licences.js),
  // only for the sources this report's evidence used
  if (marketEvidence) {
    const used = [marketEvidence.source, ...(marketEvidence.sourceParts || []).map((p) => p.text)].join(" ");
    const lic = licenceNotices(property.country, used, marketData);
    if (lic.length && !(marketEvidence.sourceParts || []).some((p) => p.title === "Licence")) {
      const text = lic.join(" ");
      marketEvidence.sourceParts = [...(marketEvidence.sourceParts || [{ title: "Market evidence", text: marketEvidence.source }]), { title: "Licence", text }];
      marketEvidence.source = `${marketEvidence.source} Licence: ${text}`;
    }
  }

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
  // Germany: the property's federal state (from its municipality) sets the
  // Grunderwerbsteuer rate
  const closingCosts = getClosingCosts(property.country, { state: /^germany$/i.test(String(property.country || "").trim()) ? (marketData?.rent?.land || (marketData?.irw?.ags ? "Nordrhein-Westfalen" : null)) : /^(united kingdom|uk)$/i.test(String(property.country || "").trim()) ? (marketData?.nation || null) : /^australia$/i.test(String(property.country || "").trim()) ? (australiaBenchmark({ text: `${property?.address || ""}, ${property?.city || ""}`, propertyType: property.propertyType })?.state || null) : null, price: Number(property.price) || null });

  // Recurring annual ownership tax (property tax / taxe foncière / IBI /
  // Council Tax / Arnona, etc.) — a separate, ongoing cost from the
  // one-time closing costs above. Same rule: only covers countries with a
  // verified, citable rate (see lib/data/propertyTax.js), silent
  // everywhere else.
  let propertyTax = getPropertyTax(property.country, { state: /^australia$/i.test(String(property.country || "").trim()) ? (australiaBenchmark({ text: `${property?.address || ""}, ${property?.city || ""}`, propertyType: property.propertyType })?.state || null) : null, municipality: marketData?.localPrice?.status === "ok" ? (marketData.localPrice.municipality || marketData.localPrice.area) : null, nuts3: marketData?.localPrice?.nuts3 || null });
  // US: the area's own median taxes paid ÷ median value (Census ACS) in
  // place of the state-range line
  if (propertyTax && /^(united states|usa|us)$/i.test(String(property.country || "").trim())) {
    const mp = marketData?.property || {};
    const ut = usPropertyTax({ zip: mp.zip || property.zip, placeKey: usPlaceKey(mp.city || marketData?.city, mp.state || marketData?.region), place: `${mp.city || marketData?.city}, ${mp.state || marketData?.region}`, countyFips: mp.countyFips, county: mp.county, stateCode: mp.stateCode, state: mp.state || marketData?.region });
    if (ut) {
      const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
      const ratio = !ut.taxTop && ut.value && !ut.valueTop && ut.level !== "state" ? ut.tax / ut.value * 100 : null;
      const price = Number(property.askingPrice || property.price);
      propertyTax = { ...propertyTax, rateRange: undefined,
        shortLabel: ratio != null ? `≈${ratio.toFixed(2)}% (${ut.area} medians)` : `${ut.taxTop ? usd(ut.tax - 1) + "+" : usd(ut.tax)} median a year (${ut.area})`,
        rate: `${ut.area}, ${ut.period}: owners' median real estate taxes ${ut.taxTop ? `${usd(ut.tax - 1)} or more` : `${usd(ut.tax)} a year`}; median home value ${ut.value == null ? "not published" : ut.valueTop ? `${usd(ut.value - 1)} or more` : usd(ut.value)}${ratio != null ? ` → ratio of the two medians ≈${ratio.toFixed(2)}%${price > 0 ? ` (≈${usd(price * ratio / 100)} a year at the asking price — an indication only)` : ""}` : ""}.`,
        basis: `${propertyTax.basis} The ratio divides two separate medians (taxes actually paid by owner-occupiers; owners' own estimate of their home's value) — the real bill depends on this property's assessed value, local rates and exemptions such as homestead; a new owner can be reassessed at the purchase price.`,
        source: ut.source, sourceUrl: "https://www.census.gov/programs-surveys/acs/data/summary-file.html" };
    }
  }

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
  // The customer can choose the report's language (a French agency selling
  // a Spanish flat to French clients); otherwise the property country's.
  const REPORT_LANGUAGES = { en: "English", fr: "Français", es: "Español", de: "Deutsch", it: "Italiano", pt: "Português", nl: "Nederlands", ru: "Русский" };
  const chosenLanguage = String(property.reportLanguage || "").toLowerCase();
  const reportLanguage = REPORT_LANGUAGES[chosenLanguage]
    ? { code: chosenLanguage, label: REPORT_LANGUAGES[chosenLanguage] }
    : resolveReportLanguage(property.country, property.city);

  const requestedAgents = Array.isArray(agents) && agents.length ? agents : Object.keys(AGENT_REGISTRY);
  const results = {};
  const errors = {};
  if (marketDataError) errors.marketData = marketDataError;

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
