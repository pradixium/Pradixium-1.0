# Pradixium — Brand Philosophy

_Recorded verbatim from the founder's product philosophy notes, for future reference when writing marketing copy, the About page, or onboarding content. Not yet published anywhere on the live site — this is a reference document, not shipped copy._

## The core positioning

The strongest Pradixium story isn't "we find you the highest return." It's **"we help you avoid being fooled."**

In property investing, there is a huge difference between **selling an investment opportunity** and **independently testing it**.

## The manifesto

> ### THE REAL ESTATE MARKET DOESN'T NEED MORE DREAMS. IT NEEDS A REALITY CHECK.
>
> Real estate is full of promises.
>
> Exceptional yields. Guaranteed appreciation. "Below-market" opportunities. Perfect locations. Limited-time deals. Beautiful projections.
>
> But smart investors know one thing: **A property is only as good as the numbers behind it.**
>
> That's the problem Pradixium was built to tackle.
>
> Pradixium is an AI-powered real estate intelligence platform designed to give investors something the market often lacks: **a neutral, pragmatic and data-driven second opinion.**
>
> We don't sell the property. We don't represent the developer. We don't promise returns. We don't manufacture yields. We don't tell investors what they want to hear.
>
> We analyse the available evidence and test the investment against reality.
>
> **VALUATION. MARKET DATA. COMPARABLES. RENTAL ECONOMICS. PRICE GAPS. RISKS. ASSUMPTIONS.**
>
> Then comes the **Reality Check™**:
>
> **PASS** — the numbers are supported by the available evidence.
> **FAIL** — the investment story doesn't stand up to the available evidence.
>
> Because before putting €100,000, €500,000 or €1 million into a property, every intelligent investor should have access to an independent tool asking one simple question:
>
> ### DOES THIS DEAL ACTUALLY MAKE SENSE?
>
> **Pradixium™**
>
> **Don't buy the dream. Check the reality.**

## Why this framing works

Gives Pradixium a clear enemy without attacking any particular company: **hype, bad assumptions, and information asymmetry.**

## Product architecture this implies

**DISCOVER → ANALYSE → REALITY CHECK → DECIDE**

More powerful positioning than "an AI property valuation tool."

| Stage | Feature | Status |
|---|---|---|
| Discover | **Deal Discovery™** | Live — scoped as a per-device shortlist/comparison tool (`deal-discovery.html`), not a live market scanner: Pradixium has no real listings feed to discover new deals from, so it never invents one. Users add any property they've analyzed (button on the results page) and compare Score, Reality Check verdict, Deal Rating, and net yield side by side. Stored in `localStorage`, not account-synced yet. |
| Analyse | **Pradixium Score™** | Live — `lib/scoring/pradixiumScore.js`, weighted composite (yield, value vs market, demand, price trend), shown on every report. |
| Analyse | **Fair Value** | Live — computed by the AI agent (`lib/agents/propertyInvestmentAgent.js`), shown as "Estimated Fair Value" and the Fair Value Gap. |
| Reality Check | **Reality Check™ (PASS/FAIL)** | Live — `lib/scoring/realityCheck.js`, computed server-side in `api/orchestrator.js`. Five deterministic checks (valuation vs. government/market benchmark, net yield sanity, price momentum, foreign-buyer access, cost of entry vs. yield), each only counted when real data backs it. FAIL on any single failed check or 2+ soft warnings, otherwise PASS; fewer than 2 checked items hides the section entirely rather than forcing a verdict. Shown on both the free results page (`index.html`) and the paid report (`report.html`, fully translated across all 7 languages).

## Note on naming

"Reality Check™," "Deal Discovery™," and "Pradixium Score™" read as a coherent trademark family — worth keeping consistent capitalization/™ usage if/when these ship as user-facing feature names.
