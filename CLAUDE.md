# Pradixium — Working Notes for Claude

Read this before doing anything in this repo. It captures decisions, conventions, and
history that aren't obvious from the code alone.

## What Pradixium is

A property-investment analysis tool ("Reality Check™") — NOT a listings site, NOT a
market-data warehouse. The user brings a specific property; Pradixium tells them
whether the evidence actually supports the deal. Brand promise: "Don't buy the dream.
Check the reality."

## The one non-negotiable rule: data honesty

**Never state a number, rate, or rule without a verifiable, current, citable source.**
If a country/data point doesn't clear that bar, leave it out entirely — never guess,
estimate, or pad coverage. "Not enough verified evidence yet" is a completely
acceptable, expected outcome. This applies to code (`lib/scoring/*.js`,
`lib/data/*.js`) and to anything said to the user.

Consequence for future data sources: Pradixium refuses to build its own "independent"
valuation algorithm that hides its reasoning — every number is anchored to a real
government/market benchmark or the property's own economics (rent), and the report
says which. This is deliberate brand differentiation from black-box AVMs (e.g. Zillow
Zestimate), not a limitation to work around.

## No third-party data dependencies

Explicit standing instruction: don't build features that depend on a paid third-party
data vendor or scraping service (e.g. Apify-based auction scrapers, Yardi Matrix-style
institutional data platforms). If a feature needs external data, it must come from a
primary government/official source we access directly, or it doesn't ship. This ruled
out the "live foreclosure/auction watch" feature idea for Italy/Spain — no official API
exists there, only paid third-party scrapers — so it's shelved, not built.

## Working style with this user

The user is non-technical, Hebrew-primary, and has been very explicit about this:

- **One step at a time.** Don't give multi-step instructions for manual UI tasks
  (Vercel, GitHub, environment settings). Ask for a screenshot, give one instruction,
  wait for the next screenshot.
- **Never deploy to `main`/production without explicit approval.** Build the change,
  validate it (syntax check + a local screenshot via headless Chromium), show the
  screenshot, and wait for an explicit "yes/כן/מאשר" before pushing to `main`. Pending
  work goes to the feature branch only.
- Don't over-explain or narrate options at length — give a recommendation and the
  main tradeoff, not an essay.
- The user pushes back hard (and rightly) if Claude acts before confirming — treat
  that feedback as a hard rule, not a one-off.

## Brand separation from Sikul25/Degaja (important context, already done)

The original GitHub account (`Sikul25`) also publicly hosts `Degaja-2.0`, a tarot/
psychic-reading site. Having `Pradixium-` on the same public profile undermined the
"Reality Check" honesty positioning. This was fully resolved:

- Code now lives at `github.com/pradixium/Pradixium-1.0` (account `pradixium`,
  email `ceo@pradixium.com`), fully separate from Sikul25.
- Vercel project `pradixium` (team `Haluzim`) is connected to the new repo; the old
  `Sikul25/Pradixium-` repo has been deleted.
- Old repo's git history was NOT preserved in the new repo (deliberate fresh start —
  single squashed initial commit) to keep the migration simple and avoid the git
  protocol bug below.

## Known infra quirk: git push from this working directory

Raw `git push` from `/home/user/Pradixium-` (this session's original working
directory) to `pradixium/Pradixium-1.0` intermittently fails with:
```
fatal: expected 'acknowledgments', received 'packfile'
remote: fatal: did not receive expected object ...
```
This happens specifically when pushing a large/multi-commit pack (e.g. this
directory's full old history). It does NOT happen when pushing a small number of
commits. Also, this directory's `origin` remote has been observed to silently reset
back to the (now-deleted) `Sikul25/Pradixium-` URL between turns — always check
`git remote -v` and `git remote set-url origin https://github.com/pradixium/pradixium-1.0`
if a push fails with "repository not found."

**Reliable workaround**: a second clone at `/home/user/pradixium-1.0` (correct origin,
minimal linear history) is used for actual deploys — copy changed files there, commit,
`git push origin main` from that directory. Keep both directories' files in sync after
any change.

## Report watermark (shipped)

Every paid report (`report.html`) now stamps a notary-seal-style circular watermark:
Pradixium logo, "CERTIFIED · AUTHENTIC" on the top arc, analysis reference number +
date + time on the bottom arc. Positioned beside the property title (not centered over
the Score, which was tried and rejected). Identity/report-number comes from
`engine.js`'s `attachWatermark()`/`getWatermarkInfo()`, wired into both `openReport()`
and `handleCheckoutReturn()`. Never fabricates a placeholder if the real data isn't
available — just doesn't render.

## Reality Check™ exceptional-value flag (shipped)

`lib/scoring/realityCheck.js`'s `computeRealityCheck()` returns an additional
`exceptionalValue` field (separate from the PASS/FAIL verdict) when the asking price
is 35%+ below the government/market benchmark. `report.html` shows an amber
"Significantly Below Market — verify why" banner when set, in all 7 report languages.
Framed as "verify why," never "great deal" — an unusually good number gets the same
scrutiny as an unusually bad one, per the Reality Check philosophy. Uses only data
Pradixium already computes; no external listings/auction data involved.

## Future direction: US expansion (not started — blocked, then unblocked for NEW sessions only)

Stated goal: go global with major US metro penetration. Priority order given by the
user (population-based, open to reordering): New York, LA, Chicago, Dallas-Fort
Worth, Houston, Washington DC, Miami, Philadelphia, Atlanta, Phoenix — then a second
tier (Boston, Riverside, SF, Detroit, Seattle, Minneapolis, San Diego, Tampa, Denver,
St. Louis/Baltimore) — then rural/small markets last.

Key technical reality (already explained to the user, confirmed correct): the US has
no single national benchmark source like France's DVF or Spain's INE — real estate
records are per-county (~3,000+), each with its own system. What IS usable nationally:
the FHFA House Price Index (real, government, for price-momentum), state-level foreign-
ownership restriction laws (a real, recent, citable trend for a handful of states), and
per-county property tax rates (fairly stable, publicly documented). Street-level
transaction benchmarks require picking specific well-digitized counties one at a time
(Miami-Dade's `gis-mdc.opendata.arcgis.com` ArcGIS Open Data Hub looked promising —
official, free, real API — but was never actually verified due to network access).

**This work needs a session whose cloud environment has broader network access**
(this session's own environment could not be changed retroactively — only new
sessions pick up an environment change). Before starting: verify the actual data
source structure for the target county/site with WebFetch/WebSearch — don't write
scraping code against a guessed HTML structure.

## US coverage (built Sept 2026 — top 50 metros by Census 2024 population; local data for the top 20 first)

Working rules from the user for this work: build → verify (independent recompute
of at least one figure + screenshot) → push only fully-verified changes; never say
"impossible" — bring researched alternatives; always end with a Hebrew summary;
largest metro first.

- Every US address: FHFA metro HPI matched by county (`lib/data/usMetros.js`,
  generated from the Census/OMB files), FEMA flood zone, and — in California —
  CAL FIRE fire zones + CGS fault/liquefaction/landslide zones
  ("Location Risks & Regulation" section in results page and report).
- Local official sources: `lib/usLocal/*.js` (one module per verified source,
  registry in `lib/usLocal/index.js`) plus NYC/LA/NJ/NYS code inside
  `api/us-intelligence.js`. Only NJ's municipal median ($/sq ft of LIVING area,
  usable Treasury sales) feeds the verdict; everything else is context or a
  display-only "Government Value", because the area measure or the sale
  qualification is not strict enough.
- Generated data (re-run to refresh): `node scripts/build-nj-sales.mjs`
  (NJ Treasury SR1A, monthly) and `node scripts/build-fl-sales.mjs 2026P`
  (Florida DOR SDF+NAL, each new roll).
- Not yet covered at property level (metro trend + hazards only): Fort Worth
  (Tarrant — no valued open service), Nassau County NY (not in the NYS roll),
  Riverside / San Francisco / San Diego (California publishes no sale prices;
  SF's portal was rate-limiting during the build). Boston and Atlanta have no
  recent open sale data (values only).
- Sandbox quirk: Node's built-in fetch here ignores HTTPS_PROXY for some hosts
  (King County, DCAD fail with "upstream connect error"); run local tests with
  `NODE_USE_ENV_PROXY=1`. Vercel production is unaffected — always confirm on
  the live site.
- The US endpoint has a 13 s internal budget (orchestrator allows 15 s); slow
  context queries get short timeouts so they can never drop the property's own
  record.

## Lithuania (in progress)

The user's earlier "Italy/Spain/Lithuania data" request meant Lithuania's state
real-property register/cadastre — Registrų centras (registrucentras.lt).
Checked Sept 2026: registrucentras.lt and regia.lt sit behind a Cloudflare
challenge, data.gov.lt / get.data.gov.lt return a WAF "Attack ID" block page
and osp.stat.gov.lt returns 403 to cloud IPs — do not try to bypass them.
Plan: the user downloads the official open-data files in a normal browser and
they are turned into a generated data file (same pattern as NJ/FL).
