/* PRADIXIUM™ — Analysis Engine (clean rewrite)
 * One flow: form → /api/orchestrator (which fetches government data AND
 * runs the AI agent server-side) → render. No client-side "intelligence
 * layers", no bridges, no duplicate systems. Results are revealed the
 * instant the response arrives — never hidden while waiting.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const set = (id, value) => { const el = $(id); if (el) el.textContent = (value === null || value === undefined || value === "") ? "—" : value; };
  const num = (v) => {
    const s = String(v ?? "").trim();
    if (!s || !/[0-9]/.test(s)) return null;
    const n = Number(s.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const money = (v, currency = "EUR") => {
    const n = num(v);
    if (n === null) return "—";
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
    catch { return "€" + Math.round(n).toLocaleString("en-US"); }
  };
  const pct = (v) => { const n = num(v); return n === null ? "—" : n.toFixed(2) + "%"; };
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

  async function fetchWithTimeout(url, options = {}, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }

  function currencyForCountry(country) {
    const c = String(country || "").toLowerCase();
    if (c === "united states" || c === "usa" || c === "us") return "USD";
    if (c === "united kingdom" || c === "uk") return "GBP";
    // Non-euro EU/EEA members added alongside the rest of Europe — without
    // these, a Danish or Swedish asking price would render with a "€"
    // symbol, which is simply the wrong currency, not just cosmetic.
    if (c === "denmark") return "DKK";
    if (c === "sweden") return "SEK";
    if (c === "norway") return "NOK";
    if (c === "iceland") return "ISK";
    // Balkans/Eastern Europe additions that don't use the euro. Montenegro,
    // Andorra and Monaco all use the euro unilaterally despite not being
    // in the Eurozone, so they need no entry here.
    if (c === "serbia") return "RSD";
    if (c === "bosnia and herzegovina") return "BAM";
    if (c === "north macedonia") return "MKD";
    if (c === "ukraine") return "UAH";
    if (c === "albania") return "ALL";
    if (c === "israel") return "ILS";
    // Eurasia + Americas + Oceania.
    if (c === "russia") return "RUB";
    if (c === "kazakhstan") return "KZT";
    if (c === "canada") return "CAD";
    if (c === "mexico") return "MXN";
    if (c === "brazil") return "BRL";
    if (c === "argentina") return "ARS";
    if (c === "australia") return "AUD";
    if (c === "new zealand") return "NZD";
    if (c === "united arab emirates") return "AED";
    if (c === "chile") return "CLP";
    if (c === "colombia") return "COP";
    if (c === "peru") return "PEN";
    return "EUR";
  }

  function getInputs() {
    return {
      country: $("country")?.value || "",
      city: $("city")?.value?.trim() || "",
      price: num($("askingPrice")?.value),
      size: num($("size")?.value),
      bedrooms: num($("bedrooms")?.value),
      bathrooms: num($("bathrooms")?.value),
      propertyType: $("propertyType")?.value || window.pradixiumPropertyType || "Apartment",
      monthlyRent: num($("monthlyRent")?.value)
    };
  }

  async function loadFromUrlIfNeeded() {
    const urlField = $("propertyUrl");
    const url = urlField?.value?.trim();
    if (!url) return;
    const price = num($("askingPrice")?.value);
    const size = num($("size")?.value);
    if (price && size) return; // already have the basics, don't overwrite

    try {
      const r = await fetchWithTimeout(`/api/property-url?url=${encodeURIComponent(url)}`, {}, 12000);
      if (!r.ok) return;
      const json = await r.json();
      if (!json.success || !json.property) return;
      const p = json.property;
      if (p.price) $("askingPrice").value = p.price;
      if (p.size) $("size").value = p.size;
      if (p.bedrooms) $("bedrooms").value = p.bedrooms;
      if (p.bathrooms) $("bathrooms").value = p.bathrooms;
      if (p.monthlyRent) $("monthlyRent").value = p.monthlyRent;
      if (p.propertyType) {
        window.pradixiumPropertyType = p.propertyType;
        const typeEl = $("propertyType");
        if (typeEl) {
          const t = String(p.propertyType).toLowerCase();
          const match = Array.from(typeEl.options).find((o) => t.includes(o.value.toLowerCase()) || (o.value === "House" && /villa|house|detached|chalet/.test(t)));
          if (match) typeEl.value = match.value;
        }
      }
      const countryEl = $("country");
      const countryOptions = $("countryOptions");
      if (countryEl && countryOptions && p.country) {
        const match = Array.from(countryOptions.options).find((o) => o.value.toLowerCase() === String(p.country).toLowerCase());
        if (match) countryEl.value = match.value;
      }
      if ($("city") && p.city) $("city").value = p.city;
      window.pradixiumPropertyAddress = p.address || p.city || "";
    } catch (e) {
      console.warn("Pradixium: could not load property from URL", e);
    }
  }

  // ISO 3166-1 alpha-2 codes for every country in the dropdown — used only
  // to format the analysis reference below (PX-<CC>-<YEAR>-<NNNNNN>), not
  // for any data lookup.
  const COUNTRY_CODES = {
    "spain": "ES", "france": "FR", "germany": "DE", "italy": "IT", "portugal": "PT",
    "united kingdom": "GB", "uk": "GB", "united states": "US", "usa": "US", "us": "US",
    "belgium": "BE", "netherlands": "NL", "poland": "PL", "austria": "AT", "switzerland": "CH",
    "czech republic": "CZ", "czechia": "CZ", "hungary": "HU", "bulgaria": "BG", "croatia": "HR",
    "cyprus": "CY", "denmark": "DK", "estonia": "EE", "finland": "FI", "ireland": "IE",
    "latvia": "LV", "lithuania": "LT", "luxembourg": "LU", "malta": "MT", "romania": "RO",
    "slovakia": "SK", "slovenia": "SI", "sweden": "SE", "norway": "NO", "iceland": "IS",
    "greece": "GR", "serbia": "RS", "bosnia and herzegovina": "BA", "montenegro": "ME",
    "north macedonia": "MK", "ukraine": "UA", "albania": "AL", "andorra": "AD", "monaco": "MC",
    "russia": "RU", "kazakhstan": "KZ", "canada": "CA", "mexico": "MX", "brazil": "BR",
    "australia": "AU", "new zealand": "NZ", "argentina": "AR", "chile": "CL", "colombia": "CO",
    "peru": "PE", "uruguay": "UY", "dominican republic": "DO", "armenia": "AM", "georgia": "GE",
    "azerbaijan": "AZ", "uzbekistan": "UZ", "kyrgyzstan": "KG", "tajikistan": "TJ",
    "turkmenistan": "TM", "moldova": "MD", "belarus": "BY", "kosovo": "XK",
    "liechtenstein": "LI", "san marino": "SM", "ecuador": "EC", "bolivia": "BO",
    "paraguay": "PY", "bahamas": "BS", "puerto rico": "PR", "cayman islands": "KY",
    "trinidad and tobago": "TT", "barbados": "BB", "jamaica": "JM", "israel": "IL",
    "united arab emirates": "AE", "thailand": "TH", "indonesia": "ID", "south korea": "KR",
    "india": "IN", "japan": "JP", "vietnam": "VN", "sri lanka": "LK", "cambodia": "KH",
    "maldives": "MV"
  };

  // A unique, incrementing reference for each analysis run — like a
  // meter reading, not a random ID — so a user can quote a specific
  // report back to support (cs@pradixium.com) unambiguously. Counts up
  // per-browser via localStorage; there is no server-side ledger.
  function nextAnalysisReference(country) {
    const key = "pradixiumAnalysisCounter";
    const next = (parseInt(localStorage.getItem(key), 10) || 0) + 1;
    localStorage.setItem(key, String(next));
    const cc = COUNTRY_CODES[String(country || "").toLowerCase()] || "XX";
    const year = new Date().getFullYear();
    return "PX-" + cc + "-" + year + "-" + String(next).padStart(6, "0");
  }

  function revealResults() {
    const results = $("results");
    if (!results) return;
    results.classList.remove("hidden");
    results.style.display = "block";
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // The orchestrator normalizes every country's raw government data into
  // one shared shape (see normalizeMarketEvidence() in api/orchestrator.js)
  // — { benchmarkValue, benchmarkUnit, benchmarkLabel, governmentValue,
  // transactionValue, transactionPeriod, marketArea, source, coverage } —
  // so this is the only rendering path needed for any country. Adding a
  // country never means touching this function again.
  const BENCHMARK_UNIT_SUFFIX = { perSqm: " / m²", perSqft: " / sqft", total: "" };

  function renderMarketEvidence(country, evidence, valueGapPercent) {
    const currency = currencyForCountry(country);
    if (!evidence) {
      set("benchmarkLabel", "MARKET BENCHMARK");
      set("governmentBenchmark", "Not available");
      set("governmentValue", "—");
      set("governmentGap", "—");
      const noEvidenceGapEl = $("governmentGap");
      if (noEvidenceGapEl) noEvidenceGapEl.style.color = "";
      set("transactionValue", "Not available");
      set("transactionPeriod", "—");
      set("marketArea", "—");
      set("marketSource", "Official market evidence.");
      return;
    }

    const suffix = BENCHMARK_UNIT_SUFFIX[evidence.benchmarkUnit] || "";
    set("benchmarkLabel", evidence.benchmarkLabel || "MARKET BENCHMARK");
    set("governmentBenchmark", evidence.benchmarkValue != null ? money(evidence.benchmarkValue, currency) + suffix : "Not available");
    set("governmentValue", evidence.governmentValue != null ? money(evidence.governmentValue, currency) : "—");
    // FIX: this used to flip valueGapPercent's sign and show a bare
    // "+3.50%"/"-3.50%" with no color cue — mathematically consistent with
    // "Fair Value Gap" above it, but read by an actual person as "negative
    // number = bad", the opposite of its real meaning here (asking price
    // is positive == BELOW the government benchmark, a good sign for a
    // buyer). Spelling out the direction in words and coloring it removes
    // the ambiguity instead of relying on a sign convention.
    const gapEl = $("governmentGap");
    if (valueGapPercent == null) {
      set("governmentGap", "—");
      if (gapEl) gapEl.style.color = "";
    } else if (valueGapPercent === 0) {
      set("governmentGap", "At market price");
      if (gapEl) gapEl.style.color = "#707b87";
    } else {
      const belowMarket = valueGapPercent > 0;
      set("governmentGap", Math.abs(valueGapPercent).toFixed(2) + "% " + (belowMarket ? "below market" : "above market"));
      if (gapEl) gapEl.style.color = belowMarket ? "#27945d" : "#d75a4d";
    }
    set("transactionValue", evidence.transactionValue != null ? money(evidence.transactionValue, currency) : "Not available");
    set("transactionPeriod", evidence.transactionPeriod || "—");
    set("marketArea", evidence.marketArea || "—");
    set("marketSource", evidence.source || "Official public market data");
  }

  // Real, individual nearby transactions (currently France only — DVF is
  // transaction-level open data; other countries' sources here are
  // aggregate benchmarks, not per-sale records) — hidden entirely when
  // absent, same pattern as Foreign Buyer Access/Closing Costs/Property
  // Tax, rather than showing an empty table.
  // Official location risks & regulation (FEMA flood zone, CAL FIRE fire
  // hazard zone, CA seismic zones, LA 2025 wildfire damage, LA rent
  // control). Every row names its government source; a lookup that failed
  // is simply absent, never shown as "not in zone".
  const CHECK_COLORS = { warn: "#b7791f", info: "#5a6b7d", ok: "#2f855a" };
  function renderOfficialChecks(checks) {
    const section = $("officialChecksSection");
    window.pradixiumLastOfficialChecks = Array.isArray(checks) && checks.length ? checks : null;
    if (!section) return;
    if (!window.pradixiumLastOfficialChecks) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    const body = $("officialChecksBody");
    if (body) {
      body.innerHTML = checks.map((c) => `<tr><td>${escapeHtml(c.label || "—")}</td><td style="color:${CHECK_COLORS[c.level] || "inherit"}">${escapeHtml(c.value || "—")}</td><td>${escapeHtml(c.source || "—")}</td></tr>`).join("");
    }
  }

  function renderComparableSales(comparableSales, currency) {
    const section = $("comparableSalesSection");
    if (!section) return;
    if (!Array.isArray(comparableSales) || !comparableSales.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    const body = $("comparableSalesBody");
    if (body) {
      body.innerHTML = comparableSales.map((c) => {
        // Not every source has geocoded distance/per-m² (France's DVF does;
        // the UK's Price Paid Data only has a matched address and a total
        // price) — fall back to the address rather than fabricate a figure.
        const location = Number.isFinite(Number(c.distanceKm))
          ? Number(c.distanceKm).toFixed(2) + " km"
          : (c.address || "—");
        const type = c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : "—";
        const price = c.eurPerM2 != null
          ? money(c.eurPerM2, currency) + "/m²"
          : (c.price != null ? money(c.price, currency) : "—");
        const date = c.date || "—";
        return `<tr><td>${escapeHtml(location)}</td><td>${escapeHtml(type)}</td><td>${escapeHtml(price)}</td><td>${escapeHtml(date)}</td></tr>`;
      }).join("");
    }
  }

  function renderDemandIntelligence(marketData) {
    const demand = marketData?.demand || null;
    if (!demand) {
      // FIX: this text used to read "...will appear here" — copy meant
      // for a page that hasn't been analyzed yet. But every call site
      // reaching this branch has already run a real analysis; the country
      // just doesn't have this dataset (built for EU markets, not every
      // country). Left as-is, that placeholder text got scraped verbatim
      // into buildReportData() and printed into the PAID report as if it
      // were an unfinished feature, not an honest "no data for this
      // country" statement.
      set("demandForeignShare", "Not available");
      set("demandStrength", "Not available");
      set("demandGeography", "—");
      set("demandPeriod", "—");
      set("demandSource", "—");
      set("demandLevel", "—");
      set("demandText", "Foreign buyer demand data is not available for this country.");
      const bar = $("demandBar");
      if (bar) bar.style.width = "0%";
      set("buyerNetherlands", "Not available");
      set("buyerUnitedKingdom", "Not available");
      set("buyerBelgium", "Not available");
      set("buyerOriginPeriod", "—");
      set("buyerOriginText", "Foreign buyer origin data is not available for this country.");
      return;
    }

    // FIX: only `demand` itself was null-checked — a partial demand object
    // missing foreignBuyerShare (or a buyerOrigin missing a nationality)
    // would throw here, get swallowed by analyzeProperty()'s try/catch,
    // and silently blank out the AI analysis too even though the
    // government data and AI both actually succeeded.
    const share = num(demand.foreignBuyerShare);
    set("demandForeignShare", share != null ? share.toFixed(2) + "%" : "—");
    set("demandStrength", demand.strength || "—");
    set("demandGeography", demand.geography || "—");
    set("demandPeriod", demand.currentPeriod || "—");
    set("demandSource", demand.source || "—");
    set("demandLevel", demand.level || "—");
    set(
      "demandText",
      `International buyer demand is ${demand.strength || ""} in ${demand.geography}. Foreign buyers represented ${share != null ? share.toFixed(2) + "%" : "an unknown share"} of residential purchases in ${demand.currentPeriod}.`
    );
    const bar = $("demandBar");
    if (bar) bar.style.width = (share != null ? Math.min(100, Math.max(0, share)) : 0) + "%";

    const origin = demand.buyerOrigin || null;
    if (origin) {
      set("buyerNetherlands", num(origin.Netherlands) != null ? origin.Netherlands + "%" : "—");
      set("buyerUnitedKingdom", num(origin.UnitedKingdom) != null ? origin.UnitedKingdom + "%" : "—");
      set("buyerBelgium", num(origin.Belgium) != null ? origin.Belgium + "%" : "—");
      set("buyerOriginPeriod", origin.period || "—");
      set(
        "buyerOriginText",
        `Top foreign buyer markets in ${origin.geography || demand.geography}: Netherlands ${origin.Netherlands}%, United Kingdom ${origin.UnitedKingdom}%, Belgium ${origin.Belgium}%.`
      );
    } else {
      set("buyerNetherlands", "Not available");
      set("buyerUnitedKingdom", "Not available");
      set("buyerBelgium", "Not available");
      set("buyerOriginPeriod", "—");
      set("buyerOriginText", "Foreign buyer origin breakdown is not available for this country.");
    }
  }

  // Only covers countries with a verified, citable foreign-ownership rule
  // (see lib/data/foreignBuyerRules.js) — the card stays hidden for every
  // other country rather than showing a blank/guessed status.
  function renderForeignBuyerAccess(access, country) {
    const section = $("foreignAccessSection");
    if (!section) return;
    if (!access) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    set("foreignAccessStatus", access.status || "—");
    set("foreignAccessCost", access.extraCost || "—");
    set("foreignAccessText", access.summary || "");
    set("foreignAccessSource", access.source ? `SOURCE: ${access.source} — verify with a local lawyer before relying on this for a purchase decision.` : "—");
    const seeAll = $("foreignAccessSeeAll");
    if (seeAll && country) {
      const slug = String(country).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      seeAll.href = "/foreign-buyer-check.html#" + slug;
    }
  }

  // Real, legally-binding restrictions on moving money into the country to
  // fund the purchase, or repatriating proceeds later (an FX quota, a
  // central-bank approval threshold, a sanctions-driven block) — distinct
  // from the ordinary exchange-rate fluctuation risk shown elsewhere.
  // Hidden entirely when the country isn't covered, same pattern as
  // Foreign Buyer Access/Closing Costs/Property Tax.
  function renderCurrencyControls(controls) {
    const section = $("currencyControlsSection");
    if (!section) return;
    if (!controls) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    set("currencyControlsStatus", controls.status || "—");
    set("currencyControlsLimit", controls.transferLimit || "—");
    set("currencyControlsApproval", controls.requiresApproval == null ? "—" : (controls.requiresApproval ? "Yes" : "No"));
    set("currencyControlsText", controls.summary || "");
    set("currencyControlsSource", controls.source ? `SOURCE: ${controls.source} — rules can change quickly; verify current requirements with a local lawyer or bank before relying on this for a purchase decision.` : "—");
  }

  // Reality Check™ — "Don't buy the dream. Check the reality." rc is
  // computed server-side (lib/scoring/realityCheck.js via api/orchestrator.js)
  // from evidence already gathered for this report; this just renders it.
  // English only here (index.html has no language toggle — that's a
  // report.html-only feature); report.html's own renderRealityCheck()
  // handles translation for the printable report.
  const RC_ICON = { PASS: "✓", WARN: "!", FAIL: "✗" };
  const RC_LABELS = {
    valuation: "Valuation vs. Evidence",
    yield: "Rental Yield vs. Reality",
    momentum: "Price Momentum",
    foreignAccess: "Foreign Buyer Access",
    costOfEntry: "Cost of Entry vs. Yield"
  };

  function realityCheckDetail(c) {
    const fmt = (x) => Math.abs(Number(x)).toFixed(1);
    if (c.id === "valuation") {
      if (c.result === "PASS") {
        return c.valueGapPercent >= 0
          ? `Asking price is ${fmt(c.valueGapPercent)}% below the government/market benchmark — supported by the evidence.`
          : "Asking price is in line with the government/market benchmark.";
      }
      if (c.result === "WARN") return `Asking price is ${fmt(c.valueGapPercent)}% above the government/market benchmark — moderately optimistic.`;
      return `Asking price is ${fmt(c.valueGapPercent)}% above the government/market benchmark — the evidence does not support this price.`;
    }
    if (c.id === "yield") {
      const y = c.netYieldPercent.toFixed(1);
      if (c.result === "PASS") return `Net yield (${y}%) clears a sane minimum for the rental-income story.`;
      if (c.result === "WARN") return `Net yield (${y}%) is thin — barely above breakeven after costs.`;
      return `Net yield (${y}%) is negative — the rental-income story does not add up at this price and rent.`;
    }
    if (c.id === "momentum") {
      const t = c.priceTrendPercent.toFixed(1);
      if (c.result === "PASS") return `Regional price trend is flat or rising (${t}% year-on-year).`;
      if (c.result === "WARN") return `Regional price trend is softening (${t}% year-on-year).`;
      return `Regional price trend is declining sharply (${t}% year-on-year) — real risk to any appreciation assumption.`;
    }
    if (c.id === "foreignAccess") {
      if (c.result === "PASS") return "Foreign buyers have open access in this market.";
      if (c.result === "WARN") return "Foreign buyers can complete this purchase, but with extra cost or a required workaround.";
      return "Foreign buyers are restricted from this type of purchase here — verify eligibility before proceeding.";
    }
    if (c.id === "costOfEntry") {
      const cost = c.closingCostPercent.toFixed(1);
      if (c.result === "PASS") return `Estimated closing costs (~${cost}%) are a normal, low-friction entry cost.`;
      if (c.result === "WARN") return `Estimated closing costs (~${cost}%) are on the high side.`;
      return `Estimated closing costs (~${cost}%) are high relative to the yield — it will take years of rent just to recoup them.`;
    }
    return "";
  }

  // Hidden entirely with fewer than 2 real checks — same honesty rule as
  // lib/scoring/realityCheck.js: too little evidence means silence, not a
  // hedge or a forced verdict.
  function renderRealityCheck(rc) {
    const section = $("realityCheckSection");
    if (!section) return;
    if (!rc || !Array.isArray(rc.checks) || rc.checks.length < 2) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    const badge = $("realityCheckBadge");
    if (badge) {
      badge.textContent = rc.verdict === "PASS" ? "PASS" : "FAIL";
      badge.className = "rc-badge " + (rc.verdict === "PASS" ? "pass" : "fail");
    }
    // A fresh result is a different property — the "Added" state from a
    // previous analysis in this same session must not carry over.
    const discoveryBtn = $("dealDiscoveryBtn");
    if (discoveryBtn) { discoveryBtn.dataset.added = ""; discoveryBtn.textContent = "+ Add to Deal Discovery™"; }
    const list = $("realityCheckList");
    if (list) {
      list.innerHTML = rc.checks.map((c) => {
        const iconClass = c.result === "PASS" ? "pass" : c.result === "WARN" ? "warn" : "fail";
        const label = RC_LABELS[c.id] || c.id;
        return `<li class="rc-item"><span class="rc-icon ${iconClass}">${RC_ICON[c.result]}</span><div><strong>${label}</strong><span>${realityCheckDetail(c)}</span></div></li>`;
      }).join("");
    }
  }

  // Deal Discovery™ — a per-browser shortlist, not a live market scanner.
  // Pradixium has no real listings feed to "discover" new deals from
  // across a market (Airbnb-style scraping would violate ToS and be
  // unreliable, same reasoning as the Airbnb scenario above) — what it can
  // honestly offer today is letting an investor save every property they
  // actually run through Pradixium and see, side by side, which one the
  // real evidence says is the strongest. Stored in localStorage: per
  // device, not account-synced (no backend table for this yet).
  const DEAL_DISCOVERY_KEY = "pradixiumDealDiscovery";

  function readDealDiscoveryList() {
    try { return JSON.parse(localStorage.getItem(DEAL_DISCOVERY_KEY) || "[]"); } catch (e) { return []; }
  }

  function saveDealDiscoveryEntry(entry) {
    const list = readDealDiscoveryList();
    list.push(entry);
    try { localStorage.setItem(DEAL_DISCOVERY_KEY, JSON.stringify(list.slice(-50))); } catch (e) {}
  }

  function wireDealDiscoveryButton() {
    const btn = $("dealDiscoveryBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (btn.dataset.added === "1") return;
      const inputs = getInputs();
      const price = num($("askingPrice")?.value);
      const agent = window.pradixiumLastAgent || {};
      const rc = window.pradixiumLastRealityCheck;
      const entry = {
        id: (window.pradixiumAnalysisReference || "property") + "-" + Date.now(),
        title: $("propertyAddress")?.textContent || [inputs.city, inputs.country].filter(Boolean).join(", ") || "Property",
        country: inputs.country,
        city: inputs.city,
        currency: currencyForCountry(inputs.country),
        askingPrice: price,
        score: window.pradixiumLastScore?.score != null
          ? Math.round(Number(window.pradixiumLastScore.score))
          : (Number.isFinite(Number(agent.score)) ? Math.round(Number(agent.score)) : null),
        dealRating: agent.dealRating || $("dealRating")?.textContent || null,
        netYieldPercent: window.pradixiumLastScore?.breakdown?.netYieldPercent ?? null,
        realityCheckVerdict: (rc && Array.isArray(rc.checks) && rc.checks.length >= 2) ? rc.verdict : null,
        savedAt: Date.now()
      };
      saveDealDiscoveryEntry(entry);
      btn.dataset.added = "1";
      btn.textContent = "✓ Added to Deal Discovery™";
    });
  }

  function renderClosingCosts(costs) {
    const section = $("closingCostsSection");
    if (!section) return;
    if (!costs) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    const tax = costs.transferTax || {};
    set("closingCostsTax", tax.rate || tax.rateRange || "—");
    set("closingCostsTotal", costs.totalEstimatedRange || "—");

    // Compose whichever fee fields this country actually has — the shape
    // varies (notaryFees, legalFees, stampDuty, registrationFees,
    // closingCosts), so only join the ones present rather than assuming
    // a fixed schema across every country.
    const feeLines = [];
    if (costs.notaryFees) feeLines.push(`Notary: ${costs.notaryFees.rate || costs.notaryFees.rateRange}`);
    if (costs.legalFees) feeLines.push(`Legal: ${costs.legalFees.rate || costs.legalFees.rateRange}`);
    if (costs.stampDuty) feeLines.push(`Stamp duty: ${costs.stampDuty.rate || costs.stampDuty.rateRange}`);
    if (costs.registrationFees) feeLines.push(`Registration: ${costs.registrationFees.rate || costs.registrationFees.rateRange || "see note"}`);
    if (costs.closingCosts) feeLines.push(`Closing costs: ${costs.closingCosts.rate || costs.closingCosts.rateRange}`);
    set("closingCostsFees", feeLines.length ? feeLines.join(" · ") : "—");

    const agency = costs.agencyCommission;
    set("closingCostsAgency", agency
      ? `Agency commission: ${agency.rate || agency.rateRange}${agency.typicalPayer ? ` (typically paid by: ${agency.typicalPayer})` : ""}`
      : "—");

    const sourceParts = [tax.source, costs.sourceUrl].filter(Boolean);
    set("closingCostsSource", sourceParts.length
      ? `SOURCE: ${tax.source || "see official source"} — rates vary by region/price bracket and change over time; verify with a local lawyer or notary before relying on this for a purchase decision.`
      : "—");
  }

  // Recurring annual ownership tax (property tax, taxe foncière, IBI,
  // Council Tax, Arnona, etc.) — a companion to the one-time closing costs
  // above. Some countries tax this as a % of value (rate/rateRange);
  // others (UK, Israel, Greece) use a banded or per-m² mechanism that
  // isn't a clean percentage, in which case the data gives a description
  // and a typical cash range instead — never a fabricated %.
  function renderPropertyTax(tax) {
    const section = $("propertyTaxSection");
    if (!section) return;
    if (!tax) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    // FIX: several countries' rate/rateRange is a full mechanism
    // description (a sentence or more — UK Council Tax bands, Germany's
    // Grundsteuer formula, etc.), not a short number. Showing that in this
    // slot (styled the same size as a short numeric value elsewhere) made
    // the row look like a wall of oversized text next to every other
    // clean, short metric box. shortLabel is always a few words; the full
    // rate/rateRange text still appears in full in the line below, so no
    // detail is lost.
    const fullRate = tax.rate || tax.rateRange || tax.typicalRange || "";
    set("propertyTaxRate", tax.shortLabel || fullRate || "—");
    set("propertyTaxBasis", [fullRate !== tax.shortLabel ? fullRate : null, tax.basis].filter(Boolean).join(" — ") || "—");

    const sourceParts = [tax.source, tax.sourceUrl].filter(Boolean);
    set("propertyTaxSource", sourceParts.length
      ? `SOURCE: ${tax.source || "see official source"} — figures are per calendar year and reflect the rate/mechanism as currently legislated; we'll update this if the underlying tax law changes. Actual amount depends on the property's official assessed value and local/municipal rates, not its market price; verify with the local tax authority before relying on this for a purchase decision.`
      : "—");
  }

  function renderRuleBasedResult(inputs) {
    const { price, size, monthlyRent } = inputs;
    const priceM2 = price && size ? price / size : null;
    const annualRent = monthlyRent ? monthlyRent * 12 : null;
    const gross = price && annualRent ? (annualRent / price) * 100 : null;
    const expenses = annualRent ? annualRent * 0.22 : null; // rough placeholder, AI/agent refines this
    const netAnnual = annualRent !== null && expenses !== null ? annualRent - expenses : null;
    const net = price && netAnnual !== null ? (netAnnual / price) * 100 : null;
    const currency = currencyForCountry(inputs.country);

    set("propertyAddress", window.pradixiumPropertyAddress || [inputs.city, inputs.country].filter(Boolean).join(", ") || "—");
    set("metaBeds", inputs.bedrooms ? inputs.bedrooms + " beds" : "— beds");
    set("metaBaths", inputs.bathrooms ? inputs.bathrooms + " baths" : "— baths");
    set("metaSize", inputs.size ? inputs.size + " m²" : "— m²");
    set("metaPriceM2", priceM2 ? money(priceM2, currency) + "/m²" : "— /m²");
    set("displayPriceM2", priceM2 ? money(priceM2, currency) + "/m²" : "—");
    set("displayAskingPrice", money(price, currency));
    set("stripAsking", money(price, currency));
    set("displayRent", monthlyRent ? money(monthlyRent, currency) + "/month" : "—");
    set("stripRent", monthlyRent ? money(monthlyRent, currency) + "/month" : "—");
    set("annualRent", annualRent ? money(annualRent, currency) + "/year" : "—");
    set("grossYield", pct(gross));
    set("netYield", pct(net));
    set("netYield2", pct(net));
    // Every yield/return figure above is denominated in the property's
    // own local currency — an honest, always-applicable disclaimer for a
    // site built around buying property in a country other than your own.
    set("currencyRiskNote", `All figures above are in ${currency}. If you'll fund this purchase (or receive rental income) in a different currency, exchange-rate movements between now and completion — and again at resale — will affect your real return independently of the yield and price figures shown here.`);

    return { priceM2, gross, net, currency };
  }

  // ── Pradixium NOI™ ────────────────────────────────────────────────────
  // Commercial income-producing property and land-development pro forma
  // analysis. Pure client-side arithmetic on what the investor enters —
  // same convention as the Airbnb/Cash-on-Cash calculators above: never a
  // modeled market estimate. Runs independently of the server round-trip
  // (these formulas need no government data), from the same call sites as
  // renderRuleBasedResult().
  function toggleCommercialFields() {
    const type = $("propertyType")?.value || "Apartment";
    const isCommercial = type === "Commercial";
    const isLand = type === "Land";
    const residential = $("residentialFields");
    const commercial = $("commercialFields");
    const landDev = $("landDevFields");
    if (residential) residential.style.display = (isCommercial || isLand) ? "none" : "";
    if (commercial) commercial.style.display = isCommercial ? "" : "none";
    if (landDev) landDev.style.display = isLand ? "" : "none";
  }

  function getCommercialInputs() {
    return {
      grossRent: num($("cGrossRent")?.value),
      vacancyPct: num($("cVacancyPct")?.value),
      otherIncome: num($("cOtherIncome")?.value),
      opex: num($("cOpex")?.value),
      loanAmount: num($("cLoanAmount")?.value),
      loanRatePct: num($("cLoanRate")?.value),
      loanYears: num($("cLoanYears")?.value)
    };
  }

  function getLandDevInputs() {
    return {
      plannedUse: $("lPlannedUse")?.value || "Multifamily",
      buildableAreaSqm: num($("lBuildableArea")?.value),
      constructionCostPerSqm: num($("lConstructionCost")?.value),
      softCostPct: num($("lSoftCostPct")?.value),
      marketRentPerSqmYear: num($("lMarketRent")?.value),
      vacancyPct: num($("lVacancyPct")?.value),
      opexPct: num($("lOpexPct")?.value),
      exitCapRatePct: num($("lExitCapRate")?.value),
      devProfitPct: num($("lDevProfitPct")?.value)
    };
  }

  // Standard fixed-rate amortized annual debt service — generalized version
  // of the same formula MORTGAGE_ASSUMPTION's cashOnCashReturnPercent()
  // uses below, taking an explicit loan/rate/term instead of the
  // residential default assumption.
  function annualDebtService(loanAmount, ratePct, years) {
    if (!loanAmount || !ratePct || !years) return null;
    const monthlyRate = ratePct / 100 / 12;
    const numPayments = years * 12;
    if (monthlyRate === 0) return loanAmount / years;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    return monthlyPayment * 12;
  }

  function computeCommercialNOI(price, c) {
    if (c.grossRent == null || c.opex == null) return null;
    const vacancyPct = c.vacancyPct ?? 0;
    const egi = c.grossRent * (1 - vacancyPct / 100) + (c.otherIncome || 0);
    const noi = egi - c.opex;
    const capRate = price ? (noi / price) * 100 : null;
    const expenseRatio = egi > 0 ? (c.opex / egi) * 100 : null;
    const debtService = annualDebtService(c.loanAmount, c.loanRatePct, c.loanYears);
    const dscr = debtService ? noi / debtService : null;
    const equity = (price && c.loanAmount) ? price - c.loanAmount : null;
    const cashOnCash = (debtService != null && equity && equity > 0) ? ((noi - debtService) / equity) * 100 : null;
    return { egi, noi, capRate, expenseRatio, debtService, dscr, cashOnCash };
  }

  // Standard institutional land-development pro forma: cost to build →
  // projected stabilized NOI → value at the target exit cap rate → work
  // backward (residual land value) to what the land itself can actually
  // justify paying, given the developer's required profit margin. This is
  // the calculation a professional developer runs before buying a site —
  // rarely exposed to an individual investor, which is the point of this
  // feature.
  function computeLandDevProForma(landPrice, l) {
    if (l.buildableAreaSqm == null || l.constructionCostPerSqm == null || l.marketRentPerSqmYear == null || l.exitCapRatePct == null) return null;
    const hardCost = l.buildableAreaSqm * l.constructionCostPerSqm;
    const softCost = hardCost * ((l.softCostPct || 0) / 100);
    const totalDevelopmentCost = (landPrice || 0) + hardCost + softCost;
    const vacancyPct = l.vacancyPct ?? 0;
    const opexPct = l.opexPct ?? 0;
    const grossIncome = l.buildableAreaSqm * l.marketRentPerSqmYear * (1 - vacancyPct / 100);
    const stabilizedNoi = grossIncome * (1 - opexPct / 100);
    const projectedValue = l.exitCapRatePct > 0 ? stabilizedNoi / (l.exitCapRatePct / 100) : null;
    const yieldOnCost = totalDevelopmentCost > 0 ? (stabilizedNoi / totalDevelopmentCost) * 100 : null;
    const developmentSpreadBps = (yieldOnCost != null) ? (yieldOnCost - l.exitCapRatePct) * 100 : null;
    const devProfitPct = l.devProfitPct ?? 15;
    const requiredProfit = (hardCost + softCost) * (devProfitPct / 100);
    const residualLandValue = projectedValue != null ? projectedValue - hardCost - softCost - requiredProfit : null;
    return { hardCost, softCost, totalDevelopmentCost, stabilizedNoi, projectedValue, yieldOnCost, developmentSpreadBps, residualLandValue };
  }

  // `stored` carries commercial/landDev input values recovered from
  // localStorage after a full page reload (e.g. returning from Stripe
  // Checkout — see analyzeProperty()'s caching comment) when the DOM form
  // fields are empty; a live analysis just re-reads the DOM instead.
  function renderCommercialAnalysis(price, currency, propertyType, stored) {
    const type = propertyType || $("propertyType")?.value || "Apartment";
    const section = $("commercialResultsSection");
    const devSection = $("landDevResultsSection");

    if (type === "Commercial") {
      if (devSection) devSection.style.display = "none";
      const c = stored?.commercial || getCommercialInputs();
      const r = computeCommercialNOI(price, c);
      if (!r) { if (section) section.style.display = "none"; window.pradixiumLastCommercial = null; return; }
      if (section) section.style.display = "";
      set("noiValue", money(r.noi, currency) + "/year");
      set("noiCapRate", r.capRate != null ? pct(r.capRate) : "—");
      set("noiEgi", money(r.egi, currency) + "/year");
      set("noiExpenseRatio", r.expenseRatio != null ? pct(r.expenseRatio) : "—");
      set("noiDscr", r.dscr != null ? r.dscr.toFixed(2) + "x" : "— (no loan entered)");
      set("noiCashOnCash", r.cashOnCash != null ? pct(r.cashOnCash) : "— (no loan entered)");
      const notes = [];
      if (r.dscr != null) {
        notes.push(r.dscr >= 1.25
          ? `DSCR of ${r.dscr.toFixed(2)}x is comfortable — most commercial lenders require at least 1.25x.`
          : `DSCR of ${r.dscr.toFixed(2)}x is below the 1.25x most commercial lenders require — this loan amount may not be financeable as entered.`);
      }
      if (r.expenseRatio != null) notes.push(`Expense ratio: ${r.expenseRatio.toFixed(1)}% of effective gross income.`);
      set("noiScoreNote", notes.join(" ") || "—");
      window.pradixiumLastCommercial = { mode: "commercial", price, currency, ...r, inputs: c };
    } else if (type === "Land") {
      if (section) section.style.display = "none";
      const l = stored?.landDev || getLandDevInputs();
      const r = computeLandDevProForma(price, l);
      if (!r) { if (devSection) devSection.style.display = "none"; window.pradixiumLastCommercial = null; return; }
      if (devSection) devSection.style.display = "";
      set("devStabilizedNoi", money(r.stabilizedNoi, currency) + "/year");
      set("devYieldOnCost", r.yieldOnCost != null ? pct(r.yieldOnCost) : "—");
      set("devTotalCost", money(r.totalDevelopmentCost, currency));
      set("devSpread", r.developmentSpreadBps != null ? (r.developmentSpreadBps >= 0 ? "+" : "") + r.developmentSpreadBps.toFixed(0) + " bps" : "—");
      set("devProjectedValue", money(r.projectedValue, currency));
      set("devResidualLandValue", money(r.residualLandValue, currency));
      const notes = [];
      if (r.developmentSpreadBps != null) {
        notes.push(r.developmentSpreadBps >= 150
          ? `Development spread of ${r.developmentSpreadBps >= 0 ? "+" : ""}${r.developmentSpreadBps.toFixed(0)} bps is within the typical 150-250 bps developers require to justify the risk of building instead of buying stabilized.`
          : `Development spread of ${r.developmentSpreadBps >= 0 ? "+" : ""}${r.developmentSpreadBps.toFixed(0)} bps is thin — below the 150-250 bps developers typically require, meaning limited margin for cost overruns or a softer exit market.`);
      }
      if (r.residualLandValue != null && price) {
        const gapPct = ((r.residualLandValue - price) / price) * 100;
        notes.push(gapPct >= 0
          ? `Residual Land Value is ${Math.abs(gapPct).toFixed(1)}% above the asking price — there's room in your assumptions even if costs run over.`
          : `Residual Land Value is ${Math.abs(gapPct).toFixed(1)}% below the asking price — at your assumptions, this land may be overpriced for this development program.`);
      }
      set("devLandGapNote", notes.join(" ") || "—");
      window.pradixiumLastCommercial = { mode: "land", price, currency, ...r, inputs: l };
    } else {
      if (section) section.style.display = "none";
      if (devSection) devSection.style.display = "none";
      window.pradixiumLastCommercial = null;
    }
  }

  // Only runs when the user left rent blank and the country adapter had a
  // real government rental benchmark (currently France's data.gouv.fr
  // commune dataset) to estimate one from — never overwrites a figure the
  // user actually typed in, and always labeled "(estimated)" so it's never
  // mistaken for the user's own number.
  function applyEstimatedRent(pradixiumScore, currency) {
    const b = pradixiumScore?.breakdown;
    if (!b?.rentIsEstimated || !b.estimatedMonthlyRent) return;
    const annualRent = b.estimatedMonthlyRent * 12;
    set("displayRent", money(b.estimatedMonthlyRent, currency) + "/month (estimated)");
    set("stripRent", money(b.estimatedMonthlyRent, currency) + "/month (est.)");
    set("annualRent", money(annualRent, currency) + "/year (estimated)");
    set("grossYield", pct(b.grossYieldPercent) + " (est.)");
    set("netYield", pct(b.netYieldPercent) + " (est.)");
    set("netYield2", pct(b.netYieldPercent) + " (est.)");
  }

  const LOCKED_LIST_ITEM = "<li>🔒 Unlock the full report — $29 — to see this</li>";

  // Same bands the AI agent is instructed to use for dealRating (see
  // lib/agents/propertyInvestmentAgent.js) — deterministic, so it works
  // as a fallback when the AI call itself fails but the Pradixium Score
  // (computed independently, server-side, in lib/scoring/pradixiumScore.js)
  // still came back fine.
  function dealRatingFromScore(score) {
    if (score >= 80) return "Excellent";
    if (score >= 65) return "Good";
    if (score >= 50) return "Fair";
    if (score >= 35) return "Weak";
    return "Avoid";
  }

  // BUG FIX: the score/deal-rating/confidence display used to live only
  // inside renderAgentResult(), which returns immediately if the AI agent
  // call failed (bad/missing API key, rate limit, timeout, transient
  // overload) — even though pradixiumScore.score/.confidence are computed
  // independently, server-side, and had already come back successfully.
  // Result: an occasional "no score" with zero explanation to the user.
  // This renders the deterministic half unconditionally; renderAgentResult
  // still overwrites it with the AI's own copy when that call succeeds.
  function renderScoreCore(pradixiumScore) {
    const hasScore = pradixiumScore && Number.isFinite(Number(pradixiumScore.score));
    const scoreNumberEl = $("scoreNumber");
    const ring = document.querySelector(".score-ring");
    if (hasScore) {
      const s = Math.round(Number(pradixiumScore.score));
      if (scoreNumberEl) scoreNumberEl.innerHTML = s + "<small>/100</small>";
      if (ring) ring.style.background = `conic-gradient(#25aa68 0 ${s}%,#e7edf0 ${s}% 100%)`;
      const rating = dealRatingFromScore(s);
      set("scoreLabel", rating);
      set("dealRating", rating);
    } else {
      if (scoreNumberEl) scoreNumberEl.innerHTML = "—<small>/100</small>";
      if (ring) ring.style.background = "conic-gradient(#e7edf0 0 100%)";
      set("scoreLabel", "—");
      set("dealRating", "—");
    }
    set("confidence", pradixiumScore?.confidence || "—");
  }

  // The score, deal rating and confidence are real signal, free — but the
  // reasoning behind them (Fair Value, highlights, risks, the investor
  // action recommendation) is the actual paid product. Before this, the
  // free preview and the paid report showed identical content; the server
  // (api/orchestrator.js) now redacts those fields for anyone who hasn't
  // paid, and this just renders whatever it was actually given.
  function renderAgentResult(agent, currency, paid) {
    if (!agent) return;
    window.pradixiumLastAgent = agent;
    window.pradixiumLastCurrency = currency;
    // Renders the deterministic score/ring/confidence first, then
    // overrides the label with the AI's own dealRating copy (normally
    // identical, per its instructions — this just prefers the agent's
    // actual output when it's present).
    renderScoreCore({ score: agent.score, confidence: agent.confidence });
    if (agent.dealRating) {
      set("scoreLabel", agent.dealRating);
      set("dealRating", agent.dealRating);
    }

    if (!paid) {
      set("fairValue", "🔒");
      set("fairValueNote", agent.fairValueBasis || "Unlock the full report to see Fair Value.");
      set("fairDelta", "🔒");
      set("suggestedOffer", "🔒");
      const highlightsEl = $("highlights");
      if (highlightsEl) highlightsEl.innerHTML = LOCKED_LIST_ITEM;
      const risksEl = $("risks");
      if (risksEl) risksEl.innerHTML = LOCKED_LIST_ITEM;
      set("investorAction", agent.investorAction || "Unlock the full report — $29 — to see the investor action recommendation.");
      return;
    }

    set("fairValue", agent.fairValue ? money(agent.fairValue, currency) : "—");
    set("fairValueNote", agent.fairValueBasis || "Pradixium Fair Value™");
    // FIX: used to show a bare signed "+3.50%"/"-3.50%" in a permanently
    // red-styled element (hardcoded class="negative" in the HTML) —
    // whatever the actual number, it always read as a warning, even when
    // negative here means a bargain (price below Fair Value). Spelling
    // out the direction and coloring it to match removes the ambiguity.
    const fairDeltaEl = $("fairDelta");
    if (agent.fairValue) {
      const price = num($("askingPrice")?.value);
      if (price) {
        const gap = ((price - agent.fairValue) / agent.fairValue) * 100;
        if (gap === 0) {
          set("fairDelta", "At fair value");
          if (fairDeltaEl) fairDeltaEl.style.color = "#707b87";
        } else {
          const belowFairValue = gap < 0;
          set("fairDelta", Math.abs(gap).toFixed(2) + "% " + (belowFairValue ? "below fair value" : "above fair value"));
          if (fairDeltaEl) fairDeltaEl.style.color = belowFairValue ? "#27945d" : "#d75a4d";
        }
      }
    } else {
      set("fairDelta", "—");
      if (fairDeltaEl) fairDeltaEl.style.color = "";
    }
    set("suggestedOffer", agent.fairValue ? money(agent.fairValue * 0.95, currency) : "—");

    if (Array.isArray(agent.investmentHighlights) && agent.investmentHighlights.length) {
      const el = $("highlights");
      if (el) el.innerHTML = agent.investmentHighlights.map((h) => "<li>" + escapeHtml(h) + "</li>").join("");
    }
    if (Array.isArray(agent.keyRisks) && agent.keyRisks.length) {
      const el = $("risks");
      if (el) el.innerHTML = agent.keyRisks.map((r) => "<li>" + escapeHtml(r) + "</li>").join("");
    }
    if (agent.investorAction) set("investorAction", agent.investorAction);
  }

  // The orchestrator call (government data + a real Claude API round-trip)
  // routinely takes 10-20+ seconds. A static "Analyzing…" label with no
  // visible progress reads as stuck long before that. Cycling through what
  // is actually happening keeps the wait feeling accounted-for.
  const ANALYSIS_LOADING_STEPS = [
    "Fetching official government price data…",
    "Checking foreign-buyer rules for this country…",
    "Running AI investment analysis…",
    "Finalizing your report…"
  ];

  function startLoadingStatus() {
    const statusEl = $("analysisLoadingStatus");
    // investorAction sits inside the results panel that revealResults()
    // just opened — that's where the person is actually looking while
    // waiting (see every screenshot they've sent), unlike
    // analysisLoadingStatus which is up by the Analyze button and can be
    // scrolled out of view by then. Updating both covers either case.
    const actionEl = $("investorAction");
    let i = 0;
    const paint = () => {
      const msg = ANALYSIS_LOADING_STEPS[i];
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.classList.remove("hidden");
      }
      if (actionEl) actionEl.textContent = msg;
    };
    paint();
    const timer = setInterval(() => {
      i = (i + 1) % ANALYSIS_LOADING_STEPS.length;
      paint();
    }, 3000);
    return () => {
      clearInterval(timer);
      if (statusEl) statusEl.classList.add("hidden");
    };
  }

  async function analyzeProperty() {
    await loadFromUrlIfNeeded();
    const inputs = getInputs();

    if (!inputs.price || !inputs.size) {
      const errEl = $("error");
      if (errEl) errEl.textContent = "Please enter at least an asking price and size.";
      throw new Error("Missing required fields");
    }
    const errEl = $("error");
    if (errEl) errEl.textContent = "";

    // 1) Fast, rule-based render — the person sees real numbers within
    //    a second, not a blank screen.
    const { currency } = renderRuleBasedResult(inputs);
    renderCommercialAnalysis(inputs.price, currency, inputs.propertyType);
    set("governmentBenchmark", "Loading…");
    set("fairValue", "Loading…");
    set("investorAction", "Analyzing with government data + AI…");
    window.pradixiumAnalysisReference = nextAnalysisReference(inputs.country);
    set("analysisReference", window.pradixiumAnalysisReference);
    set("analysisTimestamp", new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
    revealResults();

    // 2) One call to the orchestrator. It fetches government data itself
    //    and runs the AI agent — the client does not need to know how.
    const property = {
      address: window.pradixiumPropertyAddress || inputs.city,
      city: inputs.city,
      country: inputs.country,
      price: inputs.price,
      size: inputs.size,
      bedrooms: inputs.bedrooms,
      bathrooms: inputs.bathrooms,
      propertyType: inputs.propertyType,
      monthlyRent: inputs.monthlyRent,
      // Pradixium NOI™ inputs — only the branch matching propertyType is
      // ever populated with real values, but caching both is harmless and
      // means refreshFullReportData() doesn't need to know which is live.
      commercial: getCommercialInputs(),
      landDev: getLandDevInputs()
    };

    // Cached so a return trip from Stripe Checkout (full page reload, form
    // state gone) can re-request a full, unredacted analysis for the same
    // property once payment is confirmed — see handleCheckoutReturn().
    try { localStorage.setItem("pradixiumPropertyInputs", JSON.stringify(property)); } catch (e) {}

    const stopLoadingStatus = startLoadingStatus();
    try {
      const token = await getAccessToken();
      const r = await fetchWithTimeout("/api/orchestrator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ property })
      }, 35000);
      const json = await r.json().catch(() => null);

      renderMarketEvidence(inputs.country, json?.marketEvidence || null, json?.pradixiumScore?.breakdown?.valueGapPercent);
      renderComparableSales(json?.marketEvidence?.comparableSales || null, currency);
      renderOfficialChecks(json?.marketEvidence?.officialChecks || null);
      renderDemandIntelligence(json?.marketData || null);
      renderForeignBuyerAccess(json?.foreignBuyerAccess || null, inputs.country);
      renderClosingCosts(json?.closingCosts || null);
      renderPropertyTax(json?.propertyTax || null);
      renderCurrencyControls(json?.currencyControls || null);
      renderRealityCheck(json?.realityCheck || null);
      applyEstimatedRent(json?.pradixiumScore || null, currency);
      window.pradixiumReportLanguage = json?.reportLanguage || null;
      window.pradixiumLastScore = json?.pradixiumScore || null;
      window.pradixiumLastComparableSales = json?.marketEvidence?.comparableSales || null;
      window.pradixiumLastCurrencyControls = json?.currencyControls || null;
      window.pradixiumLastRealityCheck = json?.realityCheck || null;

      const agent = json?.results?.["property-investment"];
      if (agent) {
        renderAgentResult(agent, currency, Boolean(json?.paid));
      } else {
        renderScoreCore(json?.pradixiumScore || null);
        set("investorAction", "AI analysis unavailable right now — figures above are calculated directly from the numbers you entered.");
        set("fairValue", "—");
      }
    } catch (e) {
      console.warn("Pradixium: AI analysis failed, rule-based figures remain", e);
      renderMarketEvidence(inputs.country, null);
      renderComparableSales(null);
      renderOfficialChecks(null);
      renderDemandIntelligence(null);
      set("investorAction", "AI analysis unavailable right now — figures above are calculated directly from the numbers you entered.");
      set("fairValue", "—");
    } finally {
      stopLoadingStatus();
    }

    window.pradixiumLastAnalysis = { inputs, timestamp: Date.now() };
    updateReportButtonLabel();
  }

  function wireAnalyzeButton() {
    const btn = $("analyzeButton");
    if (!btn) return;
    const originalHTML = btn.innerHTML;
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = "Analyzing…";
      const safety = setTimeout(() => {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.innerHTML = originalHTML;
      }, 30000);
      try {
        await analyzeProperty();
      } catch (e) {
        console.warn("Pradixium: analyze failed", e);
      } finally {
        clearTimeout(safety);
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.innerHTML = originalHTML;
      }
    });
  }

  // Investment Scenarios (report.html) — a second way to earn the $29
  // beyond a nicer layout of the same numbers. Cash purchase yield already
  // exists above; these three add real comparison points:
  //  - Financed: a declared-assumption mortgage math, not a personalized
  //    loan quote — the assumptions are shown alongside the number.
  //  - Price trend: the real government YoY figure already computed
  //    server-side (pradixiumScore.breakdown.priceTrendPercent) but never
  //    surfaced as its own line before.
  //  - Airbnb/short-term: there is no official or reliable data source for
  //    nightly rates by area (Airbnb has no public API, and scraping their
  //    listings would violate their Terms of Service and be unreliable
  //    anyway) — so this is pure arithmetic on whatever the investor
  //    themselves types in from their own research, never a Pradixium
  //    estimate.
  const MORTGAGE_ASSUMPTION = { downPaymentPct: 30, ratePct: 6.5, years: 25 };

  function cashOnCashReturnPercent(price, annualRent) {
    if (!price || annualRent == null) return null;
    const loanAmount = price * (1 - MORTGAGE_ASSUMPTION.downPaymentPct / 100);
    const monthlyRate = MORTGAGE_ASSUMPTION.ratePct / 100 / 12;
    const numPayments = MORTGAGE_ASSUMPTION.years * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    const annualDebtService = monthlyPayment * 12;
    const annualOpex = annualRent * 0.22;
    const annualCashFlow = annualRent - annualOpex - annualDebtService;
    const cashInvested = price * (MORTGAGE_ASSUMPTION.downPaymentPct / 100);
    return cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : null;
  }

  // BUG FIX: report.html's "Decision" row used to just repeat the exact
  // same word as "Deal Rating" right above it (both fed from
  // agent.dealRating) — two rows carrying zero distinct information,
  // confusing to read. This turns it into an actual action recommendation
  // by folding in Confidence, which Deal Rating alone doesn't capture.
  function decisionFromRating(dealRating, confidence) {
    const r = String(dealRating || "").toLowerCase();
    const lowConfidence = String(confidence || "").toLowerCase() === "low";
    if (r === "excellent" || r === "good") return lowConfidence ? "Recommended — verify further (limited data)" : "Recommended";
    if (r === "fair") return lowConfidence ? "Consider — verify further (limited data)" : "Consider — weigh the trade-offs above";
    if (r === "weak" || r === "avoid") return "Not Recommended";
    return "—";
  }

  function buildReportData() {
    const inputs = getInputs();
    const currency = currencyForCountry(inputs.country);
    const priceEl = $("askingPrice");
    const price = num(priceEl?.value);
    const size = num($("size")?.value);
    const monthlyRent = num($("monthlyRent")?.value);
    const annualRent = monthlyRent ? monthlyRent * 12 : null;
    const agent = window.pradixiumLastAgent || {};
    const hasScore = agent.score !== null && agent.score !== undefined && Number.isFinite(Number(agent.score));
    const gross = price && annualRent ? (annualRent / price) * 100 : null;
    const expenses = annualRent ? annualRent * 0.22 : null;
    const net = price && annualRent !== null && expenses !== null ? ((annualRent - expenses) / price) * 100 : null;
    const cashOnCash = (price && annualRent != null) ? cashOnCashReturnPercent(price, annualRent) : null;
    const airbnbNightlyRate = num($("airbnbNightlyRate")?.value);
    const airbnbOccupancyPct = num($("airbnbOccupancy")?.value);
    const airbnbAnnualIncome = (airbnbNightlyRate && airbnbOccupancyPct)
      ? airbnbNightlyRate * 365 * (airbnbOccupancyPct / 100)
      : null;
    const airbnbGrossYield = (airbnbAnnualIncome && price) ? (airbnbAnnualIncome / price) * 100 : null;
    const priceTrendPercent = window.pradixiumLastScore?.breakdown?.priceTrendPercent ?? null;
    // The raw score-convention number (positive = asking price below the
    // government benchmark), not the "X% below/above market" display
    // string now rendered on screen — report.html applies its own wording
    // to this same raw figure.
    const governmentGap = window.pradixiumLastScore?.breakdown?.valueGapPercent ?? null;
    // FIX: lib/scoring/pradixiumScore.js already computes which factors
    // (yield, valueVsMarket, demand, priceTrend) actually had real data and
    // how much each one weighed into the headline score — this was
    // computed server-side and sent to the client, but discarded before
    // ever reaching the paid report, which just showed a bare number with
    // no explanation of how it was derived.
    const scoreBreakdown = Array.isArray(window.pradixiumLastScore?.breakdown?.components)
      ? window.pradixiumLastScore.breakdown.components
      : null;
    return {
      title: $("propertyAddress")?.textContent || "Property analysis",
      currency,
      city: inputs.city,
      country: inputs.country,
      analysisReference: window.pradixiumAnalysisReference || null,
      score: hasScore ? Math.round(Number(agent.score)) : null,
      askingPrice: price,
      size,
      priceM2: price && size ? price / size : null,
      rent: monthlyRent,
      fairValue: agent.fairValue ?? null,
      fairDelta: (agent.fairValue && price) ? ((price - agent.fairValue) / agent.fairValue) * 100 : null,
      gross,
      net,
      cashOnCash,
      mortgageDownPaymentPct: MORTGAGE_ASSUMPTION.downPaymentPct,
      mortgageRatePct: MORTGAGE_ASSUMPTION.ratePct,
      mortgageYears: MORTGAGE_ASSUMPTION.years,
      airbnbNightlyRate,
      airbnbOccupancyPct,
      airbnbAnnualIncome,
      airbnbGrossYield,
      priceTrendPercent,
      dealRating: agent.dealRating || $("dealRating")?.textContent,
      confidence: agent.confidence || $("confidence")?.textContent,
      suggestedOffer: agent.fairValue ? agent.fairValue * 0.95 : null,
      decision: decisionFromRating(agent.dealRating || $("dealRating")?.textContent, agent.confidence || $("confidence")?.textContent),
      governmentBenchmark: $("governmentBenchmark")?.textContent,
      governmentValue: $("governmentValue")?.textContent,
      governmentGap,
      transactionValue: $("transactionValue")?.textContent,
      transactionPeriod: $("transactionPeriod")?.textContent,
      marketArea: $("marketArea")?.textContent,
      marketSource: $("marketSource")?.textContent,
      foreignBuyerShare: $("demandForeignShare")?.textContent,
      demandStrength: $("demandStrength")?.textContent,
      demandGeography: $("demandGeography")?.textContent,
      demandPeriod: $("demandPeriod")?.textContent,
      demandSource: $("demandSource")?.textContent,
      buyers: $("buyerOriginText")?.textContent,
      action: $("investorAction")?.textContent,
      highlights: [...document.querySelectorAll("#highlights li")].map((li) => li.textContent.trim()),
      risks: [...document.querySelectorAll("#risks li")].map((li) => li.textContent.trim()),
      // So local clients in the property's own market (a seller, their
      // agent, a notary) can read the report too — report.html shows a
      // language toggle when these are present.
      reportLanguageCode: window.pradixiumReportLanguage?.code || null,
      reportLanguageLabel: window.pradixiumReportLanguage?.label || null,
      actionLocal: agent.localizedContent?.investorAction || null,
      highlightsLocal: Array.isArray(agent.localizedContent?.investmentHighlights) ? agent.localizedContent.investmentHighlights : null,
      risksLocal: Array.isArray(agent.localizedContent?.keyRisks) ? agent.localizedContent.keyRisks : null,
      foreignAccessStatus: $("foreignAccessStatus")?.textContent,
      foreignAccessCost: $("foreignAccessCost")?.textContent,
      foreignAccessText: $("foreignAccessText")?.textContent,
      foreignAccessSource: $("foreignAccessSource")?.textContent,
      closingCostsTax: $("closingCostsTax")?.textContent,
      closingCostsTotal: $("closingCostsTotal")?.textContent,
      closingCostsFees: $("closingCostsFees")?.textContent,
      closingCostsAgency: $("closingCostsAgency")?.textContent,
      closingCostsSource: $("closingCostsSource")?.textContent,
      propertyTaxRate: $("propertyTaxRate")?.textContent,
      propertyTaxBasis: $("propertyTaxBasis")?.textContent,
      propertyTaxSource: $("propertyTaxSource")?.textContent,
      comparableSales: Array.isArray(window.pradixiumLastComparableSales) ? window.pradixiumLastComparableSales : null,
      officialChecks: Array.isArray(window.pradixiumLastOfficialChecks) ? window.pradixiumLastOfficialChecks : null,
      currencyRiskNote: $("currencyRiskNote")?.textContent,
      currencyControlsStatus: $("currencyControlsStatus")?.textContent,
      currencyControlsLimit: $("currencyControlsLimit")?.textContent,
      currencyControlsApproval: $("currencyControlsApproval")?.textContent,
      currencyControlsText: $("currencyControlsText")?.textContent,
      currencyControlsSource: $("currencyControlsSource")?.textContent,
      scoreBreakdown,
      // Reality Check™ — set server-side by lib/scoring/realityCheck.js and
      // passed through unchanged; report.html does its own translation of
      // the check ids/results into sentences (renderRealityCheck()).
      realityCheck: window.pradixiumLastRealityCheck || null,
      // Pradixium NOI™ — set by renderCommercialAnalysis() only when
      // propertyType is Commercial or Land; null (and hidden in the
      // report) for an ordinary residential analysis.
      commercialAnalysis: window.pradixiumLastCommercial || null
    };
  }

  // The full report (report.html) is paid access — either a one-time
  // unlock for a single property, or an annual subscription covering
  // every property. The on-screen preview above (score, market evidence,
  // demand intelligence) stays free either way.
  //
  // Entitlement is tied to the signed-in Supabase account (the app
  // already requires sign-in before any analysis — see auth-supabase.js's
  // account gate), not to this browser: api/verify-checkout-session.js
  // writes a row to Supabase's purchases table only after Stripe itself
  // confirms payment, and Row Level Security means a user can only ever
  // read their own rows — there's no client-writable "I paid" flag to
  // bypass, unlike a localStorage-based gate.
  function reportSignature(data) {
    return [data.country, data.city, data.askingPrice, data.size].join("|");
  }

  async function getAccessToken() {
    try {
      const { data } = await window.pradixiumSupabase?.auth.getSession();
      return data?.session?.access_token || null;
    } catch (e) { return null; }
  }

  async function isReportPaid(data) {
    try {
      const { data: rows, error } = await window.pradixiumSupabase
        .from("purchases")
        .select("kind, report_signature, expires_at");
      if (error || !rows) return false;
      const signature = reportSignature(data);
      const now = Date.now();
      return rows.some((row) => {
        if (row.kind === "subscription" || row.kind === "business") return new Date(row.expires_at).getTime() > now;
        return row.kind === "report" && row.report_signature === signature;
      });
    } catch (e) {
      console.warn("Pradixium: could not check report entitlement", e);
      return false;
    }
  }

  // Watermark — traces an unauthorized leak/screenshot of a paid report
  // back to the account it came from. Best-effort only: any failure here
  // (missing created_at column, network hiccup, no session) just means no
  // watermark renders on report.html — never a fabricated name/date
  // standing in for a real one.
  async function getWatermarkInfo(data) {
    let name = null, email = null, purchasedAt = null;
    try {
      const { data: sessionData } = await window.pradixiumSupabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        name = (user.user_metadata && user.user_metadata.full_name) || null;
        email = user.email || null;
      }
    } catch (e) {}
    if (!email) return null;
    try {
      const { data: rows } = await window.pradixiumSupabase
        .from("purchases")
        .select("kind, report_signature, expires_at, created_at");
      const signature = reportSignature(data);
      const now = Date.now();
      const match = (rows || []).find((row) => {
        if (row.kind === "subscription" || row.kind === "business") return new Date(row.expires_at).getTime() > now;
        return row.kind === "report" && row.report_signature === signature;
      });
      purchasedAt = match?.created_at || null;
    } catch (e) {}
    return { name, email, purchasedAt };
  }

  // Shared by openReport() (repeat views) and handleCheckoutReturn() (the
  // very first view, right after Stripe redirects back) so both paths stamp
  // the same identity before report.html ever opens.
  async function attachWatermark(data) {
    const target = data || (() => {
      try { return JSON.parse(localStorage.getItem("pradixiumReportData") || "null"); } catch (e) { return null; }
    })();
    if (!target) return;
    const watermark = await getWatermarkInfo(target);
    if (!watermark) return;
    target.watermarkName = watermark.name;
    target.watermarkEmail = watermark.email;
    target.watermarkPurchasedAt = watermark.purchasedAt;
    try { localStorage.setItem("pradixiumReportData", JSON.stringify(target)); } catch (e) {}
  }

  async function updateReportButtonLabel() {
    const results = $("results");
    if (!results || results.classList.contains("hidden")) return;
    const paid = await isReportPaid(buildReportData());
    const createBtn = $("createReportBtn");
    const subscribeBtn = $("subscribeReportBtn");
    const businessBtn = $("businessSubscribeBtn");
    if (createBtn) createBtn.innerHTML = paid ? "View Full Analysis&nbsp; →" : "Unlock This Report — $29&nbsp; →";
    if (subscribeBtn) subscribeBtn.style.display = paid ? "none" : "inline-block";
    if (businessBtn) businessBtn.style.display = paid ? "none" : "inline-block";
  }

  async function startCheckout(reportData, plan) {
    const token = await getAccessToken();
    if (!token) {
      alert("Please sign in first.");
      return;
    }
    try {
      const r = await fetchWithTimeout("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyTitle: reportData.title, plan, reportSignature: reportSignature(reportData), referralCode: localStorage.getItem("pradixiumReferralCode") || null })
      }, 15000);
      const json = await r.json().catch(() => null);
      if (!json?.url) {
        alert(json?.error || "Could not start checkout right now. Please try again.");
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      console.warn("Pradixium: checkout failed", e);
      alert("Could not start checkout right now. Please try again.");
    }
  }

  function currentReportData() {
    const results = $("results");
    if (!results || results.classList.contains("hidden")) {
      alert("Analyze a property first.");
      return null;
    }
    const data = buildReportData();
    // Still cached so report.html can render immediately after the Stripe
    // redirect round-trip, without needing to re-analyze the property.
    try { localStorage.setItem("pradixiumReportData", JSON.stringify(data)); } catch (e) {}
    return data;
  }

  async function openReport() {
    const data = currentReportData();
    if (!data) return;

    if (!(await isReportPaid(data))) {
      startCheckout(data, "report");
      return;
    }

    await attachWatermark(data);

    const w = window.open("/report.html", "_blank");
    if (!w) alert("Please allow pop-ups to view the report, then try again.");
  }

  function openSubscription() {
    const data = currentReportData();
    if (!data) return;
    startCheckout(data, "subscription");
  }

  // Companies & institutions (banks, funds, agencies) — same unlimited-
  // reports access as the individual annual plan, billed monthly instead
  // (see api/create-checkout-session.js's "business" plan).
  function openBusinessSubscription() {
    const data = currentReportData();
    if (!data) return;
    startCheckout(data, "business");
  }

  function wireReportButtons() {
    const createBtn = $("createReportBtn");
    if (createBtn) createBtn.addEventListener("click", openReport);
    const headerBtn = $("headerReportBtn");
    if (headerBtn) headerBtn.addEventListener("click", openReport);
    const subscribeBtn = $("subscribeReportBtn");
    if (subscribeBtn) subscribeBtn.addEventListener("click", openSubscription);
    const businessBtn = $("businessSubscribeBtn");
    if (businessBtn) businessBtn.addEventListener("click", openBusinessSubscription);
  }

  // After returning from Stripe Checkout, the page reloads fresh — the
  // analyzed property's form state is gone. pradixiumReportData (saved to
  // localStorage right before the redirect) survives, but it was captured
  // BEFORE payment, so it's the redacted/free-preview version (the server
  // now withholds Fair Value, highlights, risks and the investor action
  // recommendation from anyone who hasn't paid — see api/orchestrator.js).
  // Opening report.html straight off that stale snapshot would show a
  // "paid" report full of 🔒 placeholders. Re-run the analysis, now
  // authenticated and paid, using the property inputs cached alongside it
  // (see analyzeProperty()), before opening the report.
  async function refreshFullReportData() {
    let property;
    try { property = JSON.parse(localStorage.getItem("pradixiumPropertyInputs") || "null"); } catch (e) { property = null; }
    if (!property) return false;

    const token = await getAccessToken();
    if (!token) return false;

    window.pradixiumPropertyAddress = property.address || null;
    const { currency } = renderRuleBasedResult(property);
    renderCommercialAnalysis(property.price, currency, property.propertyType, { commercial: property.commercial, landDev: property.landDev });
    window.pradixiumAnalysisReference = nextAnalysisReference(property.country);
    set("analysisReference", window.pradixiumAnalysisReference);
    set("analysisTimestamp", new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
    revealResults();

    try {
      const r = await fetchWithTimeout("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ property })
      }, 35000);
      const json = await r.json().catch(() => null);
      if (!json?.paid) return false; // entitlement not visible yet server-side — caller falls back

      renderMarketEvidence(property.country, json?.marketEvidence || null, json?.pradixiumScore?.breakdown?.valueGapPercent);
      renderComparableSales(json?.marketEvidence?.comparableSales || null, currency);
      renderOfficialChecks(json?.marketEvidence?.officialChecks || null);
      renderDemandIntelligence(json?.marketData || null);
      renderForeignBuyerAccess(json?.foreignBuyerAccess || null, property.country);
      renderClosingCosts(json?.closingCosts || null);
      renderPropertyTax(json?.propertyTax || null);
      renderCurrencyControls(json?.currencyControls || null);
      renderRealityCheck(json?.realityCheck || null);
      applyEstimatedRent(json?.pradixiumScore || null, currency);
      window.pradixiumReportLanguage = json?.reportLanguage || null;
      window.pradixiumLastScore = json?.pradixiumScore || null;
      window.pradixiumLastComparableSales = json?.marketEvidence?.comparableSales || null;
      window.pradixiumLastCurrencyControls = json?.currencyControls || null;
      window.pradixiumLastRealityCheck = json?.realityCheck || null;

      const agent = json?.results?.["property-investment"];
      if (!agent) {
        renderScoreCore(json?.pradixiumScore || null);
        return false;
      }
      renderAgentResult(agent, currency, true);
      currentReportData();
      return true;
    } catch (e) {
      console.warn("Pradixium: could not refresh full report after payment", e);
      return false;
    }
  }

  async function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId || params.get("unlock") !== "1") return;
    history.replaceState({}, "", window.location.pathname);

    try {
      const r = await fetchWithTimeout(`/api/verify-checkout-session?session_id=${encodeURIComponent(sessionId)}`, {}, 15000);
      const json = await r.json().catch(() => null);
      if (!json?.paid) {
        alert("Payment was not completed, so the full report hasn't been unlocked. Please try again.");
        return;
      }
      if (!json?.granted) {
        alert(json?.error || "Payment succeeded, but access could not be granted. Please contact support.");
        return;
      }
      // Best effort — if this fails (cleared storage, network hiccup),
      // report.html still opens using whatever was cached before checkout.
      await refreshFullReportData();
      await attachWatermark();
      const w = window.open("/report.html", "_blank");
      if (!w) alert('Payment confirmed! Please allow pop-ups, then click "View Full Analysis" again.');
    } catch (e) {
      console.warn("Pradixium: could not verify payment", e);
    }
  }

  // Affiliate/referral program: capture ?ref=CODE on first visit and keep
  // it until checkout, even if the person browses for a while before
  // paying. Never overwrites an existing code with a blank one, but a new
  // ?ref= link does replace an older stored code (last-touch attribution).
  function captureReferralCode() {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Za-z0-9_-]{1,40}$/.test(code)) {
      localStorage.setItem("pradixiumReferralCode", code);
    }
  }

  // Lets a country guide page (guides/<country>.html) or any external link
  // send someone straight into the analyzer with the right country already
  // selected, e.g. /index.html?country=Mexico.
  function prefillCountryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const country = params.get("country");
    const countryEl = $("country");
    const countryOptions = $("countryOptions");
    if (!country || !countryEl || !countryOptions) return;
    const match = Array.from(countryOptions.options).find((o) => o.value.toLowerCase() === country.toLowerCase());
    if (match) countryEl.value = match.value;
  }

  // Native <datalist> filtering is inconsistent across browsers — notably
  // iOS Safari, where it often shows nothing as you type instead of
  // narrowing the list. This is a small hand-rolled combobox instead:
  // type a letter, matching countries appear below, type more to narrow,
  // tap one to select — works the same everywhere.
  function wireCountryAutocomplete() {
    const input = $("country");
    const dropdown = $("countryDropdown");
    const datalist = $("countryOptions");
    if (!input || !dropdown || !datalist) return;
    const countries = Array.from(datalist.options).map((o) => o.value);
    // Cosmetic-only: the dropdown list shows a friendlier full name for a
    // few countries, but selecting one still fills the field with (and
    // submits) the short canonical value every country-data lookup in the
    // codebase keys off — so this never touches actual routing.
    const DISPLAY_NAMES = { "United States": "United States of America" };
    const labelFor = (c) => DISPLAY_NAMES[c] || c;

    function renderMatches(query) {
      const q = query.trim().toLowerCase();
      // Empty query (e.g. tapping the field for the first time) shows the
      // full country list, same as opening a native <select> — filtering
      // only kicks in once the user actually types something.
      const matches = q ? countries.filter((c) => labelFor(c).toLowerCase().startsWith(q) || c.toLowerCase().startsWith(q)) : countries;
      if (!matches.length) {
        dropdown.classList.add("hidden");
        dropdown.innerHTML = "";
        return;
      }
      dropdown.innerHTML = matches.map((c) => `<div class="country-option" data-value="${escapeHtml(c)}">${escapeHtml(labelFor(c))}</div>`).join("");
      dropdown.classList.remove("hidden");
    }

    input.addEventListener("input", () => renderMatches(input.value));
    input.addEventListener("focus", () => renderMatches(input.value));
    input.addEventListener("click", () => renderMatches(input.value));
    // mousedown (not click) fires before the input's blur — preventing its
    // default here stops the dropdown from closing before the click that
    // actually picks an option gets a chance to run.
    dropdown.addEventListener("mousedown", (e) => e.preventDefault());
    dropdown.addEventListener("click", (e) => {
      const opt = e.target.closest(".country-option");
      if (!opt) return;
      input.value = opt.getAttribute("data-value");
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
    });
    input.addEventListener("blur", () => {
      setTimeout(() => dropdown.classList.add("hidden"), 150);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") dropdown.classList.add("hidden");
    });
  }

  function wirePropertyTypeToggle() {
    const select = $("propertyType");
    if (!select) return;
    select.addEventListener("change", toggleCommercialFields);
    toggleCommercialFields();
  }

  function boot() {
    wireAnalyzeButton();
    wireReportButtons();
    wireCountryAutocomplete();
    wirePropertyTypeToggle();
    wireDealDiscoveryButton();
    handleCheckoutReturn();
    prefillCountryFromUrl();
    captureReferralCode();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
