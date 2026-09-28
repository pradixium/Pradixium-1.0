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
  generated from the Census/OMB files; ALL 387 metros + each state's non-metro
  area via `lib/data/usHpiCounties.js` ← `python3 scripts/build-us-hpi.py`,
  FHFA all-transactions quarterly files, refresh each quarter), FEMA flood zone, and — in California —
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
  `node scripts/build-stl-sales.mjs` (City of St. Louis Assessor sales +
  parcel Access files; needs mdbtools — the city's file currently ends Nov
  2024, so its ZIP figures are context only).
- St. Louis (#23): City (29510) = last valid sale (Assessor sale type 10) +
  appraised value + ZIP context; St. Louis County (29189) = facts +
  appraised value only (Missouri: the county publishes no sale prices).
- San Antonio (#24): Bexar (48029) in `lib/usLocal/texas.js` — BCAD final
  (post-protest) value from Bexar County GIS "Parcels" (reloaded each fall;
  no tax year in the layer, so none is shown).
- Austin (#25): Travis (48453) in `texas.js` — TCAD market value from Travis
  County TNR's published copy "TCAD_Parcels_Dec_2025" (2025 roll). TNR
  publishes dated copies: when a newer one appears, point the URL at it and
  update the label/year.
- Portland (#26): Multnomah/Washington/Clackamas via Oregon Metro RLIS
  `lib/usLocal/portlandMetro.js` — assessor Real Market Value + assessed
  value; RLIS SALEPRICE is unscreened, so not shown. Clark County WA (the
  Vancouver side) not yet covered.
- Sacramento (#27): not covered at property level — California publishes no
  sale prices and Prop 13 assessed values are not market values (same as
  Riverside/SF/SD).
- Pittsburgh (#28): Allegheny (42003) `lib/usLocal/allegheny.js`, live SQL on
  WPRDC — the county's VALID sales (SALECODE 0) + finished living area →
  ZIP benchmark that FEEDS THE VERDICT (like NJ), last valid sale, facts.
  The county's fair market value is 2012 base-year → text only. WPRDC's
  firewall only accepts a form-encoded POST with a User-Agent (the shared
  `h.json(url, ms, init)` now takes fetch options).
- Las Vegas (#29): Clark County NV (32003) `lib/usLocal/clarkNV.js` — last
  sale only when the Assessor's Sales_view code is R ("normally … arm's
  length", Assessor Sales Codes PDF); year built. No value in the GIS
  (Assessor bulk files are paid → not used). Addresses carried by two
  parcels (house + extra lot sold together) show nothing.
- Cincinnati (#30): Hamilton County OH (39061) `lib/usLocal/hamiltonOH.js` —
  Auditor market value, annual taxes (official check), year built, finished
  sq ft (text). Sales not shown: VALID/SALTYP empty on every 2025+ sale
  (checked Sept 2026). Kentucky/Butler/Warren/Clermont counties not covered.
- Kansas City (#31): not covered yet — Jackson County MO GIS
  (jcgis.jacksongov.org) times out from cloud IPs (sandbox + WebFetch);
  Johnson County KS publishes no parcel values. Retry Jackson from Vercel.
- Columbus (#32): Franklin County OH (39049) `lib/usLocal/franklinOH.js` —
  current appraised value, above-grade living area, beds/baths; last sale
  only if it is the parcel's latest sale AND in the Auditor's ValidSale='Y'
  file (that file covers Jan 2023–Jul 2025); ZIP context from it (fixed
  window from 2024-07-17), context only.
- Indianapolis (#33): Marion County IN (18097) `lib/usLocal/marionIN.js` —
  Assessor total assessed value (Government Value) + class. Sales: Indiana
  SDF data is only in the DLGF/Gateway interactive search — a possible
  future source if an official bulk file is found.
- Cleveland (#34): Cuyahoga (39035) `cuyahoga.js` — Fiscal Officer
  Open_Data_Parcels (Cleveland + non-Cleveland layers): certified total
  (= market value) + tax year, living area. Transfers have no validity code.
- Nashville (#35): Davidson (47037) `nashville.js` — Metro Nashville Parcels
  TotlAppr. No sale validity code → sales not shown.
- Milwaukee (#40): City of Milwaukee MPROP via CKAN datastore
  `milwaukee.js` — current-year assessed value, finished area, beds/baths.
  Sales file screening not documented → not shown. Suburbs: no record.
- Raleigh (#41): Wake (37183) `wake.js` — assessed value, heated area,
  year built. Sale price has no validity code → not shown.
- Utah statewide incl. Salt Lake City (#46): `utah.js` — UGRC
  `Parcels_<County>_LIR` for all 29 counties (market value + as-of date,
  deduped by PARCEL_ID). Utah = non-disclosure.
- Wisconsin statewide: `wisconsin.js` — Statewide Parcel Map V12
  (Wisconsin_Statewide_Parcels_DB, 2025 roll): estimated fair market value,
  assessed value, net tax. City of Milwaukee's MPROP module runs first.
- Dispatcher (`lib/usLocal/index.js`): matching modules are tried in order
  until one returns something — city modules can fall back to statewide ones.
- North Carolina statewide fallback: `northCarolina.js` — NC OneMap parcels
  (parval + the county's own parvaltype label; counties revalue on
  different cycles → display only). Wake/Mecklenburg modules run first.
  Some counties (Guilford) publish no site address there. Query ~3–6 s.
- Massachusetts statewide fallback: `massachusetts.js` — MassGIS Property Tax
  Parcels (TOTAL_VAL + town FY, RES_AREA, year built). LS_PRICE unscreened →
  not shown. Boston module runs first. Matches on the geocoder's town name.
- Vermont statewide: `vermont.js` — VCGI standardized parcels + Grand List
  (REAL_FLV + GLYEAR; towns reappraise on different cycles).
- Tucson: Pima County (04019) `pima.js` — Assessor Full Cash Value + tax
  year via City of Tucson PropertyHousing layer 40 (regional records);
  USPS abbreviations (PLZ/CMNO…) normalised; ZIP optional.
- Hartford (#50) + all of CT: `connecticut.js` — OPM Real Estate Sales
  (data.ct.gov 5mzw-sjtu, Socrata): last sale only with NO non-usable code;
  town median of usable single-family sales in the latest grand-list year
  (context). File runs to Sep 2025 (2024 GL) as of Sept 2026.
- Virginia Beach metro (#37): City of Norfolk (51710) `norfolk.js` — Socrata
  g7sg-tivf (FY25 dataset, updated daily): assessed value + effective year,
  finished living area. Virginia Beach city itself: GIS unreachable
  (proxy 502) — not covered yet.
- Providence (#39): City of Providence (44007) `providence.js` — 2025
  Property Tax Roll (Socrata 6ub4-iebe): assessment + 2025 tax. Next year:
  point at the new roll's dataset id.
- Still metro trend + FEMA only: Kansas City (#31), OKC (#42, no official
  open parcel values found), Richmond (#44, city GIS resets connections).
- Not covered at property level (metro trend + FEMA only), checked Sept 2026:
  Louisville (LOJIC/PVA layers carry no values), Grand Rapids (Kent County
  open parcels have no values), Birmingham (Jefferson AL has only the tax
  assessed value, a fraction of market), Memphis (Shelby County GIS behind
  Cloudflare), San Jose / Fresno (California).
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

**Who builds what (two Claude sessions work on this repo):** US local data for
metros #23–#50 (St. Louis onward, in rank order) is being built by the session
titled "Pradixium 2.0 Beta" on branch `claude/ecstatic-hypatia-coi9oe`. Before
adding a US metro, check `lib/usLocal/index.js` on `origin/main` and this list,
so the same metro is never built twice.

## Lithuania (in progress)

The user's earlier "Italy/Spain/Lithuania data" request meant Lithuania's state
real-property register/cadastre — Registrų centras (registrucentras.lt).
Checked Sept 2026: registrucentras.lt and regia.lt sit behind a Cloudflare
challenge, data.gov.lt / get.data.gov.lt return a WAF "Attack ID" block page
and osp.stat.gov.lt returns 403 to cloud IPs — do not try to bypass them.
Plan: the user downloads the official open-data files in a normal browser and
they are turned into a generated data file (same pattern as NJ/FL).

Shipped: **Lithuania Auction Watch** (`lithuania-auctions.html` + `api/lt-auctions.js`)
— live bailiff (kind 1) and insolvency-administrator (kind 2) real-estate
auctions from evarzytynes.lt (Registrų centras). List pages only; never read
detail pages' contacts/owner names. Per-m² start price only for one whole
property in m² (not "1/4 dalis" shares, not multi-property lots). Fails closed
on format change. **Paused (Sept 2026, user's decision): removed from the live site
(page, API, "Distressed Assets" menu link) until Registrų centras confirms in
writing that showing the auctions with links back to them is fine.** To restore,
revert the "Take Distressed Assets off the live site" commit. The unreleased
"Government value" button (unique number + copy/open link to RC's mass-valuation
search, which Cloudflare blocks for servers incl. Vercel) is part of it. Shekel
prices were tried and dropped by the user — EUR only. Next: the RC "average
market value" (mass valuation) page as the Lithuanian benchmark.

## Net Yield / Cash-on-Cash fix (shipped Sept 2026)

`engine.js` had three places computing "Net Yield" and "Cash-on-Cash" off a flat,
undeclared 22% expense-ratio assumption ("rough placeholder, AI/agent refines this")
— a straight violation of the data-honesty rule, pre-dating both active sessions. No
official per-country expense benchmark or user-entered opex exists, so these now
resolve to `null` (renders as "—") instead of a guessed number. Gross Yield (rent/
price, the property's own economics) is unaffected. `cashOnCashReturnPercent()` is
now a stub that always returns null, with a comment explaining why — the mortgage
debt-service math it used to combine with the fake opex is not dead-code-removed,
just no longer used for this figure, in case a real expense source shows up later.

## Report feedback field (shipped Sept 2026)

One short free-text prompt at the end of every report ("anything you expected to
see here and didn't?"), all 7 languages, submits to `api/feedback.js` → a private
Supabase `feedback` table (RLS on, no public policies — only the service role can
read it). Deliberately NOT a public feature-request board or voting list: the user
was explicit — "no Roman senate," feedback is a one-way signal he reviews himself,
not a crowd-sourced roadmap. Don't build a public-facing version of this without
being asked.

## Session roles going forward (Sept 2026)

Two Claude sessions work this repo concurrently. Going forward, by the user's own
split: **this session (Claude A / "Pradixium 1.0") = business, marketing, go-to-
market, and light cross-cutting bug fixes** (like the Net Yield fix above); the
other session (Claude B / "Pradixium 2.0 Beta", branch `claude/ecstatic-hypatia-
coi9oe`) = technical data-coverage content (US metros #23+, Lithuania). Don't pick
up new country/county data-building work in this session without checking with the
user first — that's Claude B's lane now, to avoid both sessions colliding on main.

Go-to-market plan as discussed: first paying-ish customers via a narrow beachhead
the user has real personal access to (not just a language he speaks) — candidates
raised were Israeli overseas-property-investor Facebook groups, free reports in
exchange for honest testimonials (never incentivized/bought reviews — Trustpilot
etc. only once there are real reviews to show, not an empty profile). "This is to
test the water," not a scaled campaign yet.

## Business/legal decisions (Sept 2026, user's own calls — not to be revisited without him raising it)

- **Staying an Irish company for now.** Explicitly considered and declined a
  Delaware C-Corp "flip" (the standard move for US-acquirer M&A, and the
  Israeli-tech norm) — no VC fundraising planned, and a flip is cheap and easy to
  do *later*, right before an actual M&A process starts, vs. expensive once the
  company is worth more (Irish exit tax on accrued value at the time of transfer).
  Revisit only if a real acquirer or real fundraising need appears.
- **Moat reality-check, concluded:** the actual code/data-pipeline build (this
  entire multi-country coverage system) took ~2 weeks with AI tooling, not months
  — so "hard to build" is not a real moat anymore in an AI-accelerated world, and
  won't get harder to copy over time, only easier. What *is* still real and not
  AI-shortcuttable: real paying/trusting customers accumulated over calendar time,
  and the accumulated *judgment calls* about what counts as sufficiently verified
  per country (not just the code that expresses them). Conclusion the user reached
  himself: stop optimizing for defensibility, optimize for real customers and
  speed, full stop.
- **No acqui-hire/early-exit planning.** Explicitly rejected planning around an
  early "someone sees the potential and buys us" scenario as gambling, not a plan.
  Real revenue and a genuinely finished product come first; "wants people to love
  and adopt it, then monetization" (his words) — not the reverse.

## Vercel account structure (Sept 2026)

Project `pradixium` is `prj_4db8toVuFK5mfcaIUGyQid06y9O1`, team `Haluzim` is
`team_fnwR6mhKjhFrsnKW36UPriM5`. **Quirk found in this session: calling the Vercel
MCP `list_projects` with an explicit `teamId` for Haluzim returned only 1 of its 6
projects (not `pradixium`); calling it with no `teamId` at all correctly returned
all 6.** If a future session sees "pradixium isn't in my Vercel team," this is
almost certainly the same tool-scoping quirk, not a real access problem — retry
without `teamId` before concluding anything is broken or escalating to the user.

Haluzim also hosts unrelated projects (`degaja1.0`, `degaja`, `aitrade26`,
`n-luxury-design`, `pradixium-test-deploy`) — the same Sikul25/Degaja mixing the
GitHub move was meant to fix, just not fixed here. **User's explicit decision:
leave it.** Unlike the public GitHub account, nobody outside the team can see
which Vercel team hosts pradixium.com — it's internal infrastructure, not brand-
facing, so it doesn't carry the reputational risk that justified the GitHub split.
Not worth paying for a dedicated team just for tidiness. Vercel also only allows
transferring a project to a Team you belong to (not to a personal/non-Team
account), and creating a new Team requires payment — another reason this was
dropped rather than routed around.

## Known gaps before a real public push (raised Sept 2026, not yet closed)

Flagged directly to the user, unresolved as of this writing:
- **No live end-to-end paid-customer test has ever been run** — no one has signed
  up, paid with a real card, received a report, and cancelled, start to finish.
  The Stripe Customer Portal fix (self-service cancellation) is untested live.
  Recommended: the user should run this once, manually, with a real small charge,
  before driving real traffic to the site.
- **Production error monitoring — resolved, was a false alarm.** The
  `get_runtime_errors` MCP tool returned 403, but Vercel's own Observability
  dashboard (Edge Requests, Function errors/timeouts, Compute) was already
  live and free on the current plan — the 403 was that one specific MCP/API
  endpoint, not a real gap. Confirmed via screenshot: 0% errors, 0% timeouts.
  Also enabled **Vercel Web Analytics** (visitor stats) the same way — it was
  already free/enabled on the dashboard side but collecting no data because
  this plain-HTML site never sent it anything; fixed by adding
  `<script defer src="/_vercel/insights/script.js"></script>` before
  `</body>` on all 9 top-level pages (shipped).
- **Launch coupon (in progress):** `api/create-checkout-session.js` now sets
  `allow_promotion_codes: true` (shipped) so Stripe's own hosted checkout
  shows a promo-code field. The user is creating the actual Coupon +
  Promotion Code directly in the Stripe Dashboard — capped at
  **max_redemptions: 20**, deliberately **no expiry date** ("Redeem by" left
  blank) — for the first-20-free/testimonial-gathering push. No code here
  validates or tracks redemptions; Stripe enforces the cap itself.

## For the other session (Claude B): Georgia data gap flagged (Sept 2026)

The user is specifically interested in Georgia (the country) as a hot,
current market for Israeli buyers — real tax advantages (territorial
taxation, 0% capital gains after 2 years held, no transfer tax), confirmed
via web search against secondary sources (law-firm/expat blogs, not yet
cross-checked against rs.ge/NAPR directly). Georgia already has solid,
correctly-sourced `closingCosts.js` and `propertyTax.js` entries (NAPR,
Georgia Revenue Service). **Missing and worth prioritizing if there's a
natural gap in the US work below:** `foreignBuyerRules.js` (Georgia is
known for unusually open foreign-ownership rules — worth verifying and
adding) and a `recentTransactionPrices.js` / `globalIndexTrends.js` entry
(price trend). Same honesty bar as everything else — only add what clears
it against Georgia's own official sources.
