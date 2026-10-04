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
- **Standing approval for country data work (user, Sept 30 2026):** "continue
  in depth to more countries — don't wait for my approval, upload, execute,
  don't delay." Claude B deploys each finished, VERIFIED country (official
  sources, hand recompute, screenshots, smoke test of other countries,
  merge origin/main first) straight to `main` and reports afterwards. This
  covers country/local data coverage only — anything else (pricing,
  payments, UI redesigns, legal text) still needs an explicit yes.
- **Never deploy to `main`/production without explicit approval** (except
  the standing approval above). Build the change,
  validate it (syntax check + a local screenshot via headless Chromium), show the
  screenshot, and wait for an explicit "yes/כן/מאשר" before pushing to `main`. Pending
  work goes to the feature branch only.
- **Work method for country data (user, Oct 1 2026): ONE country at a time,
  squeezed dry, then the next.** Do not hop between countries when a source
  is blocked. For the current country go through the full checklist before
  moving on: (1) local official price benchmark per area AND per home type
  (flat / house), (2) official trend, (3) rent (for the yield), (4) closing
  costs + transfer taxes, (5) annual property tax, (6) foreign-buyer rules,
  (7) property-level official record where one exists. Each item ends as
  "done" or "officially impossible — reason" in this file. A blocked
  source that needs the user's browser download → ask for it once and keep
  squeezing the same country's other items meanwhile.
- **Audience is GLOBAL (user, Oct 2 2026): "זה גלובלי לא רק ישראלים".**
  Prioritise countries by their weight for international property buyers
  worldwide, not by Israeli demand.
- Don't over-explain or narrate options at length — give a recommendation and the
  main tradeoff, not an essay.
- The user pushes back hard (and rightly) if Claude acts before confirming — treat
  that feedback as a hard rule, not a one-off.
- Never remind the user about Anthropic API billing/credit or auto-reload —
  it is handled, he has his own reminders (user, Sept 30 2026, explicit).
- He alone decides which session does what — don't bring up the session
  split in replies.

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
  (Florida DOR SDF+NAL, each new roll — ALL Florida counties from the Census
  county list; 66 of 67 in 2026P: Citrus had no SDF/NAL file, skipped).
  `node scripts/build-stl-sales.mjs` (City of St. Louis Assessor sales +
  parcel Access files; needs mdbtools — the city's file currently ends Nov
  2024, so its ZIP figures are context only).
- Florida benchmark (Sept 30 2026): the ZIP's MEDIAN PRICE of county-
  qualified (01/02) single-parcel sales of the same type (flSales.js) is
  now the whole-home benchmark (benchmarkUnit "total", like Ireland's CSO
  median) when no per-sq-ft benchmark exists — `areaMedianPrice` from
  florida.js → us-intelligence macro.local → orchestrator. Per-sq-ft stays
  context (FDOR effective area includes garages/porches). Recompute check
  from the raw Dade 2026P SDF+NAL in Python: ZIP 33139 condos 1,521
  sales, median $505,000 = the file.
- Same whole-home median benchmark (Sept 30 2026): Cook County (Chicago)
  — the Assessor neighborhood's median price of clean sales of the
  parcel's own group, last 12 months of data (check: nbhd 72380 houses
  327 sales, $342,000 = SoQL recompute); Connecticut — the town's median
  of usable single-family sales, houses only (check: West Hartford GL
  2024, 518 sales, $550,000). 10+ sales. DC (Sept 30 2026): the OTR
  neighborhood's median of "Market Sale" sales of the EXACT OTR class
  (row / semi / detached house, horizontal / vertical condo; the extract
  holds each property's latest sale), 12 months (check: Old City 1 row
  houses 310 sales, $950,000; Old City 2 vertical condos 231, $470,000).
  Detroit (Sept 30 2026): ECF neighborhood + class 401 median of the
  Assessor's "03-ARM'S LENGTH" single-parcel sales, PREBUILT in
  lib/data/detroitSales.js ← `NODE_USE_ENV_PROXY=1 node
  scripts/build-detroit-sales.mjs` (monthly; the live service takes 30 s+
  on a neighborhood filter). Condos have "C…" ECF neighborhoods. Check:
  4R406 → 81 sales, $70,000 (raw query recompute).
  Oklahoma County (Sept 30 2026, user asked for it despite the short
  window): TaxParcelsPublics_view carries a price only for deeds recorded
  in the last ~10 days (Annual_Deed_2025 / Annual_Deeds have NO prices) →
  median of the Assessor's Valid sales of improved (market > land)
  residential accounts of the same kind (condo by subdivision name /
  manufactured home = "MH" nbhd / house): nbhd with 10+, else the city;
  text says "short window". Generic hook `areaMedian` in _structured.js.
  Check: Oklahoma City houses 212 sales, $237,000 (Sept 14–23).
  Memphis (Sept 30 2026): Shelby QualifiedSales has no type/ZIP, so
  `node scripts/build-shelby-sales.mjs` (monthly) joins each sale's PARID
  to CERTParcel NBHD + LUC + LANDUSE + CLASS (R only, not LUC 000 vacant),
  drops price+date shared by several parcels (multi-parcel deeds) →
  lib/data/shelbySales.js: "N|NBHD|LUC" then "Z|ZIP|LUC", 10+ sales.
  SINGLE-FAMILY → benchmark; MULTI-FAMILY → context. Sales query needs
  ESRI_OID in outFields (else 400). Check: NBHD 00709G04 LUC 062 → 33
  sales, $342,800 (raw recompute incl. multi-parcel rule).
  Minneapolis (Sept 30 2026): Hennepin ZIP median of SALE_CODE "W"
  (warranty deed) sales of the same PR_TYP_NM1, 12 months, month-level
  dates. The codes are exclusive (R = "EXCLUDED FROM RATIO STUDIES",
  M = multi-parcel, Q/C/O/L) → W = kept in the county's ratio studies.
  Homes (residential, condo, townhouse, zero lot line, two-unit, triplex)
  → benchmark; others context. Check: ZIP 55406 residential 355 sales,
  $373,000 (raw query).
  Maryland (Sept 30 2026, all counties incl. Baltimore + DC suburbs):
  ZIP × RESITYP (SF/TH/CN) median of SDAT CONVEY1 = 1 (private arm's-
  length, improved) transfers, 12 months to the file's latest transfer
  (May 2026 roll → 2025-04-29..2026-04-28), PREBUILT lib/data/mdSales.js
  ← `NODE_USE_ENV_PROXY=1 node scripts/build-md-sales.mjs` (monthly, after
  each SDAT refresh). Each account holds its latest transfer only. Check:
  ZIP 20814 SF 159 sales, $1,322,750 (direct query).
  Fairfax VA (Sept 30 2026): ZIP × LUC_DESC median of DTA "Valid and
  verified sale" sales (every other SALEVAL_DESC label excluded), 12
  months, PREBUILT lib/data/fairfaxSales.js ← `NODE_USE_ENV_PROXY=1 node
  scripts/build-fairfax-sales.mjs` (monthly): sales → Real Estate Parcels
  Data (LUC_DESC) + Address Points (ZIP; a parcel in two ZIPs dropped).
  The sales table repeats each sale per tax year → de-duplicated; server
  pages are 1,000 rows. Homes → benchmark. Check: ZIP 22042 single-family
  detached 221 sales, $849,900 (recomputed the other way: ZIP → pins).
  Fixes (Sept 30 2026, live check): Connecticut — an address never sold
  since 2001 used to return nothing (no town median); now the geocoder's
  town is used and the record says "no sale recorded" (hasRecord false).
  Cook — a condo building typed without its unit → the building's own
  Assessor neighborhood condo median (never the unit's record). Check:
  1234 N Dearborn nbhd 74022 condos 822 sales, $385,500 (SoQL).
  Rejected: none left from this pass.
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
- California counties outside LA: `california.js` — San Diego (SANDAG),
  Riverside, Contra Costa, San Joaquin, San Francisco (DataSF roll), Orange
  (Treasurer-Tax Collector secured tax layer; no situs city/ZIP → parcel
  within 250 m of the geocoded point, `spatial: true`), San Bernardino (county
  Site Address point → PRCLNUM or containing parcel in "Parcels with Redacted
  Owner Name"; shows Prop 13 base year), Sonoma (Parcels Public, roll year),
  Alameda (county open data Parcels: Land + Imps), Placer (County Parcels
  public view), Tulare (public tax parcels; no city/ZIP → spatial 250 m),
  Solano (Parcels Public Aumentum: valland + valimp, rollyear, beds/baths;
  siteroad has no type, direction spelled out "WEST C").
  Monterey's parcel layer has values but no situs address → not used.
  The Prop 13
  assessed value is shown in the TEXT only, labelled "not current market
  value" — never governmentValue, never the verdict (same basis as LA).
  Parcel counts only when its ZIP or town matches (geocoder ZIPs differ).
  CA BOE's "<County> 2026 Roll Year" services are tax-rate-area boundaries,
  not values. Sacramento (#27; its Assessor "Sales by Property Type" layer
  holds only ~57k parcels with unscreened transfer-tax prices), San
  Bernardino (no situs address),
  Santa Clara, Alameda: no open valued parcel layer found yet.
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
- Kansas City (#31): Jackson County MO (29095) in `moreCounties.js` —
  jcgis.jacksongov.org ParcelViewer/ParcelsAscendRelate table 2
  (Ascend_GisInfo): Market_Value_Total + tax_year (whole table is 2024 as
  of Sept 2026), beds, living area, year built; assessed = 19%. The server
  answered normally in Sept 2026 (it timed out earlier). Johnson County KS
  publishes no parcel values.
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
- OKC (#42): Oklahoma County (40109) in `moreCounties.js` — the
  Assessor's own parcel viewer (Experience Builder app 10a159706dc7…,
  config read via arcgis.com item data) → TaxParcelsPublics_view:
  currentmarket (no year field), last sale only when SalesValidity =
  "Valid" (others: Unvalidated, Quit-Claim, DEMP/Multi-Parcel, Other
  Invalid…). location = "912 STONEHENGE DR EDMOND" (city appended).
  Never request name1-3/mailing fields.
- Still metro trend + FEMA only: Richmond (#44, city GIS resets
  connections).
- Not covered at property level (metro trend + FEMA only), checked Sept 2026:
  Louisville (LOJIC/PVA layers carry no values), Grand Rapids (Kent County
  open parcels have no values), Birmingham (Jefferson AL has only the tax
  assessed value, a fraction of market), San Jose / Fresno (California).
- Memphis: Shelby County TN (47157) `shelbyTN.js` — county GIS
  scgis.shelbycountytn.gov (found in the Register of Deeds map's JS
  bundle): Parcel/CERTParcel (structured situs, no value) + Assessor/
  QualifiedSales (the Assessor's QUALIFIED sales, Jan 2022 → current):
  most recent qualified sale per parcel. The server needs legacy TLS
  renegotiation → the module's own https.Agent with
  SSL_OP_LEGACY_SERVER_CONNECT (local test: curl with an OPENSSL_CONF
  "Options = UnsafeLegacyServerConnect", injected as h.legacyJson).
- NYC property level: `lib/usLocal/nyc.js` (all 5 boroughs; before it,
  NYC reports had NO property record — only FEMA + the ZIP-level 1–3 family
  sales context). DOF "Property Valuation and Assessment Data" 8y4t-faws
  (latest FY; period 3 = final, else tentative; FY2027 final as of Sept
  2026), PLUTO 64uk-42ks (year built, floors, units, gross area), Rolling
  Sales usep-8jbt (building context). Queried in PARALLEL by address
  (DOF alone ~1–3 s). Rules: tax class 1 (1–3 family) → DOF market value
  as Government Value (sales-based). Class 2 condos/co-ops/rentals → TEXT
  ONLY: RPTL §581 values them as rentals, far below sale prices (e.g. a
  350 W 57th St unit: DOF $326k). Class 4 commercial → text only (income
  basis). Condo unit lots cannot be tied to an apartment number in these
  datasets → building-level range. Building sales: count + median of
  $10,000+ recorded sales, last 12 months; a price+date shared by several
  unit records = one multi-unit deed → excluded (350 W 57th: 5 records →
  3 single-unit, median $665,000, recomputed by hand). Street matching via
  nycStreet(): "WEST 57 STREET" = "W 57TH ST"; Queens "41-15" numbers kept.
  Lots can carry a house-number RANGE (125 Prospect Park W is in lot range
  "115-155") → a second DOF query for ranges, limited by the geocoder ZIP
  (without it the query takes >7 s); same-side parity check. Geocoding:
  the Census geocoder knows neither "NYC" nor a street's borough ("3531 3rd
  Avenue NYC NY" → nothing; it is in the Bronx) → `api/us-intelligence.js`
  asks NYC DCP GeoSearch (geosearch.planninglabs.nyc, PAD, free, no key —
  so no Geoclient key needed) IN PARALLEL, keeps it only when exactly one
  borough has that number on that street, then re-geocodes with borough +
  ZIP. A whole address typed into the city field is treated as the address.
  CONDO / CO-OP (Sept 2026, closes the launch-blocking gap below):
  `nycDofSales()` apartment branch joins the ZIP's condo unit sales (Rolling
  Sales categories 12/13/15, multi-unit deeds dropped) to each unit lot's
  DOF `gross_sqft` = the unit's SHARE of the building's gross floor area
  (checked: 340 W 57th's 597 unit shares sum exactly to PLUTO bldgarea
  527,488 and resarea 493,199) → median $/sq ft + middle half, labelled
  "includes a share of common areas, not interior area", context only.
  Co-ops: median price only (no unit area anywhere). Recompute checks:
  ZIP 10019 → 327 condo sales, median $1,411; 146 co-op sales, median
  $722,500. Apartment number → unit lot via DOF Digital Tax Map "Condominium
  Units" (eguu-7ie3, unit_designation) in nyc.js; then asking ÷ unit share
  on the same basis (350 W 57th St Apt 2F = lot 1010471180, 554 sq ft).
  Condo buildings: PLUTO files the condo under its BILLING lot's address →
  unit lots → condo_number (eguu-7ie3) → PLUTO `condono` (350 W 57th →
  "340 WEST 57 STREET", condo 115). Module returns `nonMarketValue`
  (DOF value + "not a market value" label) for the uniform record table.
  The site sends an address typed in the city field as BOTH address and
  city → us-intelligence drops the duplicate city (else nothing geocodes);
  Queens "43-39" numbers accepted there too; unit found mid-string
  ("350 W 57th St Apt 2F, New York, NY").
- Uniform US record (Sept 2026): orchestrator US branch returns
  `marketEvidence.propertyRecord` (always present for a US property;
  found:false when nothing matched) + `sourceParts` (titled blocks);
  `source` is still the joined text (compliance report uses it).
  The city's
  Socrata server answers the same query in 1–8 s → hedged requests
  (second after 3 s). Test addresses must exist: the Census geocoder
  happily interpolates non-existent numbers (1520 Metropolitan Ave).
- Shared matcher `lib/usLocal/_structured.js` (`structuredEvidence`): for
  official layers with a structured situs address — number + name must
  match, dir/type agree when both present, ZIP OR town must match, unit
  rules, "add the unit number". New simple sources should use it.
- Washington statewide (outside King): `washington.js` — WA Geoservices
  "Current Parcels" (Parcels_2026, all 39 counties): county assessor land +
  building value (Government Value), link to the county's parcel page. Some
  counties (Pierce) have no situs city/ZIP → parcel must be within 250 m of
  the geocoded point, number + street core match, directions agree.
- Arkansas statewide: `arkansas.js` — AGISO County Assessor Mapping Program
  (Planning_Cadastre layer 6): TotalValue (land + imp) as Government Value;
  AssessValue is exactly 20% of it (Arkansas assessment ratio), not shown.
- Minnesota statewide (outside Hennepin): `minnesota.js` — MnGeo "Parcels,
  Compiled from Opt-In Open Data Counties" (all 87 counties): EMV total +
  mkt_year, finished sq ft, year built. sale_value has no validity code →
  not shown. co_code is the full 5-digit FIPS.
- Gwinnett GA (13135): `gwinnett.js` — county GIS Property_and_Tax Tax
  Master Table: TOTVAL1 (land + dwelling) as Government Value, no year in
  layer; TAXTOT1 = exactly 40% of it (GA assessment ratio) → not shown.
- Oakland MI (26125): `oaklandMI.js` — Tax Parcel Plus: assessed value
  shown in text; Government Value = 2 × assessed, labelled as derived
  (Michigan assesses at 50% of true cash value, MCL 211.27a). Taxable value
  (capped) not shown. Beds/baths/living area.
- Colorado (Denver metro): `coloradoCounties.js` — Arapahoe (OpenDataService
  Parcels: Appr_Value; Sale price has no validity code → not shown) and
  Adams (Parcels address → PARCELNB → Property_Values acttotalval; several
  accounts on one parcel → no value shown), Jefferson (GIS Parcel: sum of
  VALACT..VALACT6 tax-class values; PRPSTRNUM zero-padded to 5) and Douglas
  (OpenData location layer 5 → values layer 4, summed per account).
- Nassau NY (36059): `nassau.js` — data.ny.gov 7vem-aaz7 (NYS local
  assessment rolls): full_market_value = 1000 × assessment (Nassau's 0.1%
  level) from the county's own rolls only (3 towns + "Glen Cove/Long Beach,
  County Roll"; the cities' own rolls skipped). No ZIP/coords in the rows →
  parcel's school district must match one of the geocoder's school
  districts (geocodeRaw now returns `schoolDistricts`). Use exact street
  strings (IN list) — LIKE is ~3 s on this dataset. nysParcel skips Nassau.
- Honolulu (15003): `honolulu.js` — HOLIS Address Points (tmk, hyphenated
  Oahu house numbers "47-490" parsed directly) → CadastralTables ASMTGIS
  (land + building value, latest taxyr). Condo TMKs hold many units
  (suffix) → a unit is needed.
- DeKalb GA (13089): `dekalbGA.js` — county "Parcels" (address → ParcelID)
  joined to "Tax_Parcels_2025" (APPRAISED_VALUE + TAXYR). New layer each
  year: update TAX_LAYER to Tax_Parcels_<year>. That layer stalls on cold
  starts (20 s) → `arcQueryHedged` (second request after 2 s, first wins).
- Stark County OH (39151, Canton): `starkOH.js` — Auditor GIS parcels
  (APPRAISED_TOTAL_VALUE + TAXYR) + Sales and Transfers: last sale only if
  the parcel's latest transfer is "0-QUALIFIED - ARMSLENGTH" and single
  parcel; otherwise the code is named.
- Summit County OH (39153, Akron): `summitOH.js` — Fiscal Office
  parcels_cama/Tax_Parcel_Sales: cntmktvalue (no tax year in layer), floor
  area, year built; town = taxing jurisdiction. Sales not shown (undocumented
  sale codes; Parcel_Sales table ends 2020).
- Illinois statewide (outside Cook): `illinois.js` — IDOR PTAX-203
  transfer declarations (illinois-edp.data.socrata.com it54-y4c6, weekly,
  since 2013). Market sale = deed recorded + 1 parcel + not split + NO Line
  10 circumstance (10a = "0", 10b–10r false); price = Line 13 net
  consideration. Last such sale for the address + ZIP 12-month count/median
  of residences (Line 8 "B") — context only. Never request name columns.
  Recompute check (Sept 2026): ZIP 60502 → 235 sales, median $405,000.
- Texas statewide fallback: `texasStatewide.js` — TxGIO "StratMap Land
  Parcels most recent" (feature.geographic.texas.gov, compiled from each
  appraisal district: SOURCE, DATE_ACQ, TAX_YEAR 2025, MKT_VALUE). Only
  `identify` works (no attribute query) → parcels within ~45 m of the
  geocoded point, keep the one whose situs number+street match. Checked
  Sept 2026: values present for nearly all districts; NO values from El
  Paso, Smith, Potter, Randall (partial Hays) → the account is shown with
  "no market value". Runs only where texas.js has no county entry.
- Ada County ID (16001, Boise): `adaID.js` — AdaCountyGIS Parcels layer 5:
  TOTALVALUE + PROPYEAR (Idaho: market-value assessment; non-disclosure →
  no sales). Padded strings → LIKE 'x %' then exact trim match.
- Washoe NV (32031, Reno): `washoeNV.js` — Assessor_ParcelCentroid: beds,
  baths, year built, building sq ft; TOTALAPR = Nevada statutory taxable
  value (NRS 361.227, not market; assessed = 35%) → TEXT ONLY (textOnly).
  SALEPRICE unscreened → not shown.
- Ottawa County MI (26139): `ottawaMI.js` — county GIS ParcelsPublic (AV →
  TCV = 2×, derived label) + "Ottawa County Arms Length Sales" (org: Ottawa
  County Geospatial Insights & Solutions; terms "03-ARM'S LENGTH", since
  2004): last arm's-length single-parcel sale + ZIP 12-month median of
  improved residential (context). Recompute check: ZIP 49424 → 490, $385,100.
- East Baton Rouge Parish LA (22033): `ebrLA.js` — data.brla.gov Tax Parcel
  (ei2c-krsr; physical_address → assessment_num; its FMV field is always 0)
  + EBRP Tax Roll (myfc-nh6n; sum of real-property lines' fair_market_val,
  latest tax_year). No city/ZIP → SoQL intersects() with a ~600 m box.
- `moreCounties.js` (structured matcher): Chesterfield VA (51041, county
  Cadastral ParcelsEnriched: FairMarketValue — whole layer is 2024 as of
  Sept 2026), St. Charles MO (29183, open_data Tax_Information situs layer:
  TotalMarketValue; assessed = 19%), Tulsa OK (40143, Assessor parcels as
  published by INCOG: TotalAcctValue + load date; numbered streets written
  without ordinals "E 39 ST S"). Sales not shown in all three (codes
  undocumented / no validity code).
  Also: Chatham GA (13051, SAGIS Parcel Digest 2025: FairMarketValue; last
  sale shown only when Sale_Quality = "Q" qualified), Lancaster NE (31109,
  Lincoln–Lancaster GIS TaxParcels: CNTASSDVAL — NE assesses at actual
  value), York SC (45091, county Parcels: AprTotVal; no city/ZIP → spatial
  250 m; layer answers in 1–6 s → 9 s timeout), Lorain OH (39093,
  2024_Reval_Tax_Parcels: total_value_2024), Canadian OK (40017,
  ParcelDataService: total_val; cap_val is the capped value, not shown).
  `_structured.js` now has `arcQueryNear` and optional row `sale`.
  Cobb GA (13067, Tax Assessor "taxassessorsdaily" CobbParcels: FMV_TOTAL;
  ASV = 40%; situs has no city/ZIP → spatial 250 m on ST_NUMBER).
  Arlington VA (51013, county data hub OData API datahub-v2.arlingtonva.us:
  Property → latest Assessment totalValueAmt + year; ALWAYS $select — the
  records carry owner/grantee names; market sales have a blank type code
  (undocumented) → sales not shown).
  Linn IA (19113, county RealEstateParcel: ValueTotal + AssessmentYear,
  both Linn County and Cedar Rapids assessors; rollback taxable not shown).
  Jackson OR skipped: its tax-lot LANDVALUE/IMPVALUE are undocumented.
  Tennessee: Hamilton (47065, county server mapsdev.hamiltontn.gov
  Live_Parcels: APPVALUE; no city/ZIP → spatial 1 km) and Montgomery
  (47125, Clarksville, gis.mcgtn.org Parcels: MktAppraisedValue as "$"
  strings, record year 2027 = working roll, said so; ReasonCode Q/D/L/DSUB
  undocumented → sales not shown). Greenville SC (45045): county parcels
  as republished by the City of Greenville GIS (AddressSearch/Property
  layer 3, city area only ~20 km box — not counted as county coverage):
  FAIRMKTVAL; situs = STRNUM + LOCATE (no type), STREET/CITY/ZIP5 are the
  MAILING address → spatial 500 m. Found via disc3.py (reads the
  county's own ArcGIS map-app configs for their services).
  Rutherford TN (47149, Murfreesboro; Rutherford County GIS org
  "RCGIS" ParcelsCAMA1: TotalValue on record year 2027 = working roll,
  said so). Horry SC (45051, Myrtle Beach; county gisweb Public/
  AddressPoints → PIN → Public/Parcels layer 1 MarketProp; assessed 4%
  owner-occupied, not shown; no sale price in layer).
  Butler OH (39017, gismaps.bceo.org ReadOnly/AccelaMobile layer 3 —
  Auditor CAMA: VCurYr = MKTVCurYr; ADRNO/ADRSTR/ADRSUF, no city/ZIP →
  spatial 1 km; V-sale fields undocumented → no sales).
  Larimer CO (08069, Larimer County org "larimer":
  ResImps_ValChange_2025_Final — ACTUAL2025, residential improved parcels
  only; layer also has owner NAME → never requested).
  Lake OH (39085, gis.lakecountyohio.gov GIS_Parcels_Publish: A_VAL_TOTAL,
  structured A_* situs; A_TAXP_NAME/A_O_* = names → never requested),
  Mahoning OH (39099, PUBLIC_WEBSITE_CADASTRAL layer 2: TOTALMARKET shown
  only when MARKETLAND + MARKETIMPR = total — CAUV parcels differ; no
  city/ZIP → spatial 1 km; resultRecordCount unsupported), Mohave AZ
  (04015, mcgis.mohave.gov PARCELS layer 3: FULL_CASH_VALUE + TAX_YEAR —
  Arizona values one year ahead, 2027 is legitimate in 2026), Anchorage AK
  (02020, Municipality org "muniorg" PropertyInformation_Hosted:
  Appraised_Total_Value + Appraisal_Year, GIS_Site_* situs).
  Skipped: Pinal AZ (CNTASSDVAL alias "Current Assessed Value" but holds
  full cash value — ambiguous), Delaware OH (ADDR1 undocumented: situs or
  mailing?), Richmond VA city layer (building number only, no street),
  Baldwin AL (layer owner not identifiable).
  Greene MO (29077, Springfield; greenecountyassessor.org
  IasWorldParcel_LatLong: sum of RES/AG/COM LAND+BLDG = the Assessor's
  "Market" value — checked against the Assessor's own 2026 datalet for
  1234 E O'Gorman Ct: 40,000 + 185,400 = 225,400, assessed 19%. L_ADR* =
  situs, ADR* = mailing. The 10.41 server ignores spatial filters → town
  match incl. "GREENE COUNTY" (unincorporated); resultRecordCount
  unsupported). Missouri: no statewide file; many rural counties only
  have Vanguard-hosted HTML sites (missouriassessors.com) → not used.
  Fairfield OH (39045, gis.co.fairfield.oh.us OpenData/ParcelBoundaries:
  APPRVAL; ADRNO/ADRSTR/ADRSUF/ADRSUF2, no city → spatial), Cochise AZ
  (04003, Cochise County GIS Cad_Parcel_TaxInfo: fcv + tax_year; city/zip
  = MAILING; layer rejects distance queries → new `arcQueryBox` envelope
  helper in _structured.js), Sumter SC (45085, gis.sumter-sc.com
  BaseMaps/Sumter_City_County layer 7: market_value_total). Skipped:
  Bannock ID (server takes 3–12 s per query), Mat-Su AK (no situs),
  Portsmouth VA (layer owner not identifiable), Florence SC (building
  value only).
  Comptroller statewide file (86 other
  counties, Assessment_Data_##.dbf) NOT yet requested (user, Sept 2026: no
  e-mails sent to any agency yet — no registered company) — the online form
  needs a U.S. address. TDEC "LH_Parcel_FP" is only a ~21k
  parcel extract, not usable.
- Indiana statewide (outside Marion): `indiana.js` reads
  `lib/data/indiana/<FIPS>.json.gz`, built by
  `python3 scripts/build-in-parcels.py 2025` from each county's DLGF
  "Real Property" (PARCEL) file on Indiana Gateway (ASP.NET download form,
  field positions per 50 IAC 26-20-4; every record checked land + imp =
  total). Gross assessed value (true tax value) as Government Value. Re-run
  (without --force it only fills missing counties; the Gateway resets
  connections now and then). `vercel.json` includeFiles ships the data
  with `api/us-intelligence.js`. Rows are matched by ZIP, then county-wide
  by the parcel city = geocoded town (geocoder ZIPs differ).
- Montana statewide: `montana.js` — Montana Cadastral Framework (State
  Library, DOR records): TotalValue + TaxYear; ag/forest land is
  productivity value (said in the text). Non-disclosure state → no sales.
- Colorado statewide fallback: `coloradoStatewide.js` — OIT "Colorado
  Public Parcels" composite (gis.colorado.gov): apprValTot (string field!)
  + the date the State received each county's file. Values + addresses for
  Weld, Boulder, Mesa, Broomfield, Summit, La Plata, Garfield and other
  small counties; El Paso, Larimer, Grand, Gunnison, Morgan … deliver no
  values, Pueblo no addresses. countyFips is inconsistent ("069" vs "69").
  Spatial 1 km + number/street match, so two parcels sharing an address
  give "several parcels", not a guess. Check: Weld 095910101005 assessed
  45,080 / appraised 721,253 = 6.25% (CO residential rate).
- Oregon outside Portland metro: `oregonCounties.js` — Marion (41047,
  county GIS Public/Parcels RMVTOTAL), Deschutes (41017, OpenData tables:
  Assessor Account → Roll Values RMV_Total + Sales; latest sale shown only
  with reject code 33 "CONFIRMED SALE"; old MapServer — no
  resultRecordCount), Lane (41039, Address (Site) → maptaxlot → Parcels
  total_mkt_land + total_mkt_imp, weekly; NUMACCNTS > 1 → no value). RMV
  only; capped assessed value not shown; no roll year in any layer.
- Texas additions (`texas.js`, generic `find` configs): Tarrant (TAD roll as
  published by City of Fort Worth "Parcels_Public_View" — whole county, 2024
  roll as of Sept 2026, shown with its year), Collin (CCAD's own layer; the
  layer already holds next year's empty roll → falls back to prevVal* with
  its year), Fort Bend (FBCAD Public Data, no tax year in layer), Denton
  (county "Parcels_FC", value carried on the 2027 working roll — said so;
  a 2027 appraisal cannot exist before 1 Jan 2027). DuPage IL skipped: its
  "FCV" fields equal the billed (1/3) value — ambiguous. Williamson
  skipped: WCAD layer's current values are 0.
- Boston and Atlanta have no recent open sale data (values only).
- Coverage tracker (session scratch, not in repo): county population from
  Census 2024 estimates vs the modules' matchers — ~55% of US population had
  a local property record as of the Nassau commit (Sept 2026).
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

## France DVF source (Sept 2026)

`api/france-intelligence.js` read DVF from api.cquest.org — an unofficial
community mirror, down with HTTP 502 in Sept 2026, so every French report had
no benchmark. Now the official Etalab "geo-dvf" CSVs on files.data.gouv.fr
(`/geo-dvf/latest/csv/<year>/communes/<dep>/<insee>.csv`): latest two yearly
files (falls back one year if the new file is not out yet); Paris/Lyon/
Marseille are filed per arrondissement — an ADDRESS uses its arrondissement
(api-adresse citycode/postcode), a city-only query reads all arrondissements
for the latest year (Paris: 20 files, ~16 MB, ~3 s). Sales grouped by
id_mutation: "Vente" of exactly one Appartement/Maison (Dépendance rows
allowed, any other local drops the deed). Orchestrator: a type bucket needs
≥ 10 sales, Market Area names the arrondissement. City-only "Paris"/"Lyon"/
"Marseille" → NO city-wide benchmark (Paris 2025 arrondissement medians run
€8,035 19e → €14,158 6e): `byArrondissement` medians as context + "enter
the address or arrondissement"; a postcode ("75016 Paris") → that
arrondissement. Deeds span files (46 in Paris 2025, one price for lots in
two arrondissements) → grouped across files, attributed to the dwelling's
file; a per-file recompute differs by 1–2 sales for that reason. Recompute check: Lyon 2e
(69382, 2024–2025) 736 sales, median €5,140/m² (Python from the raw files).

**Size, land, energy rating (Sept 2026, Claude B):** the benchmark is the
same type within ±25% of the entered size when 10+ such sales exist (a 150 m²
Lieusaint house: 13 sales, €2,886/m² vs town-wide €3,254 at a 95 m² median);
houses with a land area also get the ±40% land subset (context). DPE: ADEME
"dpe03existant" (data.ademe.fr, Licence Ouverte) — the house's own latest DPE
by number + street, and DVF house sales matched to the DPE at the same
address dated before the sale → median €/m² per class (10+ sales), towns
with ≤ 6,000 house DPEs only (larger → not computed, said so). Houses only
(flats share an address). A "renovated + year" input changes the text only:
no official figure prices a renovation; the energy class is its measurable
part. Notaires de France "valeur verte" 2024 study: its PDF answers 403 to
servers → not used. Check: Lieusaint 66/86 matched, C €3,222 (23), D €3,189
(40), recomputed in Python.

## Germany, deep (Sept 2026, Claude B)

- NRW (18 M people): `lib/germany/irw.js` — the Gutachterausschüsse's
  Immobilienrichtwerte (BORIS-NRW open data, dl-de/zero, 1 Jan 2026): €/m²
  of living area for a stated REFERENCE home per zone and submarket (flats
  resale / new build, detached, semi/terraced, multi-family). Every one of
  NRW's 4.5 M official house coordinates (Geobasis NRW Gebäudereferenzen)
  is pre-assigned its zones → `lib/data/germany/nrw/<AGS>.json.gz` (11 MB)
  ← `python3 scripts/build-de-nrw-irw.py` (re-run each spring). The board's
  conversion factors (PDF) are NOT applied — the reference home is stated.
  Several values for one address (Solingen/Ratingen/Hilden publish one per
  house form) → all listed, none applied; another home type only → context.
  Check: 20/20 random addresses = the live BORIS-NRW WMS GetFeatureInfo.
- Other states: home IRW are not open data (checked: Lower Saxony, Hamburg,
  Bremen, Hessen — land values only; Hessen's and Lower Saxony's price
  calculators are paid products; Lower Saxony's district dashboards are
  Tableau with export blocked by a WAF → not used). Instead
  `lib/germany/cityReports.js` ← `lib/data/germany/cityReports.json`: the
  big cities' valuation boards' own published figures, copied by hand with
  their definition (segment, mean/median, period): Berlin, Hamburg,
  München, Stuttgart, Leipzig, Dresden, Hannover, Bremen, Wiesbaden
  (+ Nürnberg ranges only). Applied only for the property's type; several
  (Munich semi/end/mid-terrace) → none. Frankfurt's site answers 403 to
  servers and to WebFetch → not used. Brandenburg publishes only
  state-level regional averages. Update each city when its board
  publishes (mostly Feb–June).
- Rent: `lib/germany/rents.js` — Zensus 2022 average net cold rent per m²
  per municipality (10,683) ← `scripts/build-de-rents.py`; existing
  tenancies, 15 May 2022 — said so; used for the yield only when no rent
  is entered. Check: Munich €12.89, Berlin €7.67 = the Zensus release.
- Grunderwerbsteuer per state in `closingCosts.js` `byState` (state from
  the municipality); Bremen 5.5% since 1 Jul 2025 (Brem.GBl. 2025 Nr. 9).
- Trend: Destatis HPI Q2 2026 (+0.6%); TOP-7 metros get Destatis's metro
  change for flats (−0.4%) / houses (+0.7%). Update each quarter.
- Listing text: German label-first rooms ("Schlafzimmer 1"; "Zimmer" =
  rooms, never bedrooms); German terms + 5-digit postcode → Germany.
- Not available: comparable sales (the Kaufpreissammlung is confidential
  by law), per-property Grundsteuer (needs the owner's Grundsteuerwert).

## Spain Catastro zones + Portugal INE local prices (Sept 2026, Claude B)

- Spain: `lib/spain/catastroZone.js` — address → CartoCiudad (IGN geocoder)
  → the Catastro's official values map (SECDameGeoJSON.aspx, 2027 map with
  2026 sales data): the address's zone, its representative home and average
  value. €/m² modules (flats, terraced) feed the verdict; detached houses
  get a whole-home total (land included) → context only. A resort /
  locality name (Altea Hills, Puerto Banús, Corralejo — LOCALITY_ALIASES)
  or a street with no numbered portals (urbanisations: "C. Petunia, Altea")
  → the range of zones within 700 m, never one zone as the property's
  value; the MIVAU province average then becomes context only. The site's
  single "address / city" field is parsed by `splitSpanishInput()`
  (street, localities, town — the first part that is a town; islands /
  coasts are not towns). Prebuilt maps for the 287 municipalities > 25,000
  inhabitants: `lib/data/spainZones/` ← `python3 scripts/build-es-zones.py`
  (re-run each autumn when the next map is published; each file validated
  geographically); smaller towns are read live. Basque Country + Navarre
  have their own cadastres → not covered. Check: Calle de Serrano 50,
  Madrid → zone R00, €10,020/m², 158 homes (recomputed from the live map).
- Spain MIVAU VDP006 has NO province row for the four single-province
  regions (Madrid, Asturias, Navarra, Murcia) — only "Total CCAA" → that
  row is used for them (Madrid had no MIVAU figure/trend before, Sept 30
  2026; Madrid Q2 2026 €4,089.6 vs €3,630.9 → +12.6%).
- Spain foreign-buyer demand (Sept 30 2026): the old hand table (press
  figures marked "secondary source, unverified", several wrong — Baleares
  32.8 vs 29.86 — plus city figures and an Alicante nationality split the
  Registradores do not publish) was replaced by `ERI_FOREIGN_SHARE` in
  market-data.js: Registradores ERI Anuario 2025 p. 76, all 50 provinces
  (share of home purchases by foreigners 2025 + pp change). Update each
  spring from the next Anuario. MIVAU names like "Palmas, Las" are
  reordered before matching (Las Palmas had no MIVAU figure before).
- Spain MIVAU benchmark is a PROVINCE average → labelled as such; the VDP003
  "transaction value" (province total, unit unstated) is no longer shown.
- Portugal: `lib/portugal/inePrices.js` ← `python3 scripts/build-pt-prices.py`
  (INE indicator 0012241, quarterly): median €/m² of sales in the last 12
  months by parish/municipality and typology (bedrooms → T0/T1…T4+). INE
  publishes these only for the Lisbon/Porto metros, the Algarve and towns
  > 100k → elsewhere no local figure (said so). Check: Almancil Q1 2026
  T4+ €7,449/m² (recomputed from INE's JSON API). Sept 30 2026: INE
  0012236 (same median, by buyer sector) adds the all-dwellings figure
  for EVERY municipality (304 with a value, incl. Madeira/Azores) →
  `allTypesOnly` areas; its Total = 0012241's Total where both exist
  (Cascais 4,687 / Braga 2,100 / Tavira 3,152 / Funchal 3,322). Check:
  Évora €2,255, Óbidos €2,242, Viseu €1,595 (Q1 2026).
- Single-area figures (Milan's OMI etc.) are applied only to that area
  (`recentAreaFits` in the orchestrator).

## Europe local prices (Sept 2026, Claude B)

- UK (`api/uk-intelligence.js`): HM Land Registry renamed the HPI columns
  (Region_Name/Average_Price) — every local UK figure had been empty. Now:
  UK HPI average of the property's local authority AND type (Property-Type
  file), Price Paid category-A market sales only, narrowest area with
  enough sales (postcode → sector → district → local authority → town).
  No local match → no benchmark (never the national one). "London" is
  never the City of London.
- `lib/europe/localPrices.js` (called by api/eurostat-hpi-intelligence.js):
  NL CBS 83625NED per municipality (PDOK geocoder), NO SSB 14545 NOK/m² per
  municipality + type (06035 was discontinued after 2024; 14545 = the
  existing-dwellings price index's 2025 table: owner-occupied + co-op, FINN.no-
  registered agency sales ~70%, BRA-i, no new builds — whole table fetched
  once and cached), SE SCB BO0501 houses per municipality (apartments =
  bostadsrätter, not covered — said so), IE CSO HPM08 per Eircode routing
  area / HPM07 per county, DK Statistics Denmark EJEN77 per landsdel.
  National averages are context only. Denmark fix (Oct 1 2026): the
  government address service DAWA (api.dataforsyningen.dk) was shut down
  (HTTP 410) → every Danish report had no figure; now place → landsdel
  from Statistics Denmark's own NUTS classification + town table BY1
  (lib/data/denmarkPlaces.json ← `python3 scripts/build-dk-places.py`;
  municipality names win, town names in two landsdele dropped; districts
  that are not BY1 towns, e.g. Hellerup, are not matched). Check:
  Byen København flats 2026 Q2 1,384 sales, DKK 6,168k (+16.7%) = direct
  StatBank query.
- Italy (`lib/italy/omi.js`): Agenzia delle Entrate OMI quotations via its
  public GEOPOI OMI service (zoneomi.php richiesta=3/5/8, stampaomi.php):
  a locality typed by the customer is matched to the OMI zone NAMES of the
  municipality (Porto Cervo → Arzachena E7). One zone → midpoint of the
  prevailing-condition range is the benchmark; several → town range as
  context; > 20 zones (Rome, Milan) → asks for the neighbourhood.
  Municipality list: `python3 scripts/build-it-comuni.py`.
- Italy renovation (Sept 2026): the "Renovated?" input switches the OMI
  benchmark to the agency's own EXCELLENT-condition ("ottimo") range of the
  same type when the zone publishes one (Porto Cervo E7 flats: normale
  €4,000–5,800 → ottimo €5,200–7,700/m²); otherwise the usual condition,
  said so. Other countries have no official condition split (checked:
  UK HPI/Price Paid, Spain Catastro zones, Portugal INE, NL/NO/SE/IE/DK/AT
  statistics, Croatia PPV) → the input changes nothing there.
- Luxembourg (Sept 2026): `scripts/build-lu-prices.py` →
  lib/data/luxembourgPrices.json — Ministère du Logement / Observatoire de
  l'Habitat (data.public.lu, CC0): registered average €/m² of existing
  apartments per commune, 12 months (Luxembourg-Ville Jul 2025–Jun 2026:
  €10,269, 613 sales); capital's quarters → Luxembourg-Ville; no price
  under 10 sales; houses not published. Re-run each quarter. (The
  "prix affinés" file is a modelled price → not used.)
- Source audit (Sept 2026): every figure must link to the official body
  itself. Removed (secondary links only, primary not verifiable from here):
  Cyprus (landbank), Malta (pedament; nso.gov.mt 403), Latvia (news),
  Georgia asking prices, Milan blog figure (OMI is live), Dubai level
  (famproperties) and trend (CBRE) — Dubai Pulse unreachable from the
  sandbox; Vietnam fixture (+65%, market reports) → pending. Replaced with
  primary: Israel (CBS release 256/2026: Tel Aviv Q2 2026 ₪4,553,500;
  israel-intelligence now parses api.cbs.gov.il month[0].date[0]
  .percentYear), Estonia (Maa- ja Ruumiamet Q1 2026 review €2,971/m²;
  stat.ee +5.8%), Norway trend (SSB 07221 +4.4%). Still industry bodies
  (not government): Finans Danmark / Eiendom Norge national context.
- Finland (Sept 2026): `scripts/build-fi-prices.py` → lib/data/
  finlandPrices.json — Statistics Finland ashi 13mu (postcode: flats by
  1 / 2 / 3+ rooms, terraced) + 13mx (municipality: flats, terraced),
  latest year, asset-transfer-tax data; postcode first (bedrooms 0/1/2+ →
  1/2/3+ rooms, unknown → sales-weighted mean of the three), else
  municipality (Swedish names mapped). Detached houses are not in these
  statistics → said so. Check: Tampere flats 2025 €3,062 (3,402 sales).
- Iceland (Sept 2026): `scripts/build-is-prices.py` → lib/data/
  icelandPrices.json — HMS Kaupskrá fasteigna (every recorded purchase
  agreement, CSV on HMS's public object storage, updated nightly):
  ONOTHAEFUR_SAMNINGUR = 0 (HMS's own "usable" flag) + FULLBUID = 1, 12
  months, median ISK/m² per postcode / municipality for Fjölbýli (flats),
  Einbýli (detached), Sérbýli (semi/terraced), 10+ sales. Check: Reykjavík
  flats 822,865 ISK/m² (2,584 sales). Re-run monthly.
- A fixed figure for flats only is never applied to a house (orchestrator
  `flatsOnly`). Denmark: Statistics Denmark stops at landsdel; EJEN88's
  per-m² key figure is empty for homes. Sweden: bostadsrätter are not in
  SCB's statistics (no official flat price).
- Austria: `scripts/build-at-prices.py` → lib/data/austriaPrices.json —
  Statistik Austria median €/m² per political district (houses, flats;
  Vienna per Bezirk) read from Statistik Austria's STATatlas GeoServer
  (gs-atlas, map them_v_immopreise) + Gemeindeverzeichnis.
- Croatia: statutory "Plan približnih vrijednosti" (PPV 1.1.2026) via the
  ministry geoportal ISPU (api/v1/gis/search-text → search-geom →
  identify, catalog item 383 / WMS layer 405): €/m² for flats by size
  band per price block. No house values in the PPV. New plan each year →
  update PPV_FLATS in lib/europe/localPrices.js from gis/catalog-izbornik.
- Georgia (Sept 30 2026): Geostat RPPI Q2 2026 (Tbilisi NEW homes only):
  flats +4.8%, detached houses +5.5% as the trend (by type); the release's
  district medians per m² (GEL, flats + houses, read from the p. 3 chart
  and checked against the bar lengths) are web-scraped OFFER prices →
  regional fixture with `askingPrices` = context only, never the
  benchmark. Batumi / other cities: no official series (said so).
- Greece (Sept 30 2026): the Bank of Greece APARTMENT price index is
  labelled by its real area (Athens, Thessaloniki, small islands/resorts
  → "other areas"; any other town → national, never guessed as "other
  cities"); not used as a house's trend. bankofgreece.gr answers 403 to
  servers and WebFetch → see "Greece, squeezed" (Q2 2026 via BIS).
- Regional fixtures (Serbia, Montenegro, LatAm, Asia…): city figure only
  for that city, national figures as context.
- Turkey: TCMB EVDS has official TL/m² by province but needs a free API
  key (user must register). **Assigned by the user to the OTHER session
  (Claude A / "Pradixium 1.0"), Sept 2026 — Claude B does not build Turkey.**
  Oct 2 2026: the user handed Turkey to Claude B. Live Turkey was broken —
  EVDS moved to evds3.tcmb.gov.tr/igmevdsms-dis/ (header `key`); the old
  evds2 /service/evds/ URL 302s to an HTML page → fixed.
- Cyprus (Sept 30 2026): `lib/europe/cyprus.js` ← `scripts/build-cy-rppi.py
  2026Q2` → lib/data/cyprusIndexPrices.json — Central Bank of Cyprus RPPI
  (valuation-based, quarterly): change on a year earlier by DISTRICT
  (Nicosia, Limassol, Larnaca, Paphos, Famagusta) × flats/houses; towns and
  resorts mapped to districts (Germasogeia → Limassol, Peyia → Paphos, Ayia
  Napa/Protaras → Famagusta); unknown town → national, named as national.
  Passed as housingPriceIndex.regional (the orchestrator's generic regional
  hook, shared with Germany's TOP-7). No official price LEVEL: the DLS
  comparable-sales service is for registered valuers only. Re-run each
  quarter. Check: Limassol flats 154.14/142.96 → +7.8%; national +8.5% =
  the CBC release.
- Bulgaria (Sept 30 2026): `lib/europe/bulgaria.js` — NSI housing price
  statistics Q2 2026 (all dwellings, transaction prices): +15.5% on Q2
  2025 as the trend (newer than Eurostat), + the city's change on the
  previous quarter for Sofia/Plovdiv/Varna/Burgas/Stara Zagora (the only
  per-city figure the release gives) as text. Per-city annual indices sit
  only in the Infostat JSF app (no open export). Update each quarter.
- Poland (Sept 30 2026, flats only — both sources cover lokale mieszkalne;
  a house → "flats only", no flat price applied): the 16 voivodeship
  capitals + Gdynia → NBP BaRN TRANSACTION prices (average, VAT incl.,
  REPORTED BY AGENTS AND DEVELOPERS to the NBP — not notarial deeds), latest
  quarter, + NBP's hedonic y-o-y index per city as the trend
  (`scripts/build-pl-nbp.py`, static.nbp.pl/dane/rynek-nieruchomosci/
  ceny_mieszkan.xlsx — nbp.pl itself sits behind Incapsula, not used);
  everywhere else → GUS BDL median per m² of ALL market sales per powiat,
  by market and size band (P3787/P3783, 20+ sales; newest powiat year is
  2024 — the 2025 quarters are listed but empty at powiat level)
  (`scripts/build-pl-prices.py`, gmina → powiat via unit id[:9]+"000";
  124 duplicate gmina names → not matched). Check: Kraków NBP Q2 2026
  14,792 zł/m², hedonic −1.5% (raw 98.548); GUS 2024 Kraków 14,378 (6,081
  sales). The old Warsaw fixture (wrongly "notarial deeds") was removed.
- Speed (Sept 30 2026): Denmark asks StatBank ONE fixed EJEN77 query (all
  11 landsdele × flats/houses/summer houses, Tid=(-n+5)) while the address
  is geocoded — StatBank answers an already-computed query in ~1 s, a new
  one in ~6 s (city lookups 6–9 s → < 2 s). UK Price Paid (67 MB) is split
  on '","' (every field is quoted; same rows as the full CSV parser).
- Czech Republic (Sept 30 2026): `czech` in lib/europe/localPrices.js ←
  `scripts/build-cz-prices.py` (ČSÚ "Ceny nemovitostí 2023–2025" Tab. 1,
  from ČÚZK cadastre sale prices): average Kč/m² per district (okres, 76 +
  Praha), 2023/2024/2025. Flats = price ÷ total floor area → benchmark,
  change = 2024→2025 average (not quality-adjusted). Family houses = the
  house's SHARE of the sale ÷ HABITABLE area → context only (status
  "context", marketArea says "another basis"). Towns that are not district
  names (Mariánské Lázně) → not matched (the ČSÚ municipality→district
  codelist relation could not be exported). The Prague fixture was removed:
  its basis did not say "flats" and it was applied to Prague HOUSES.
  Check: Praha flats 131,520 / 115,889 → +13.5%.
- Hungary (Sept 30 2026): `hungary` in lib/europe/localPrices.js ←
  `scripts/build-hu-prices.py <release slug>` (KSH, NAV duty data):
  Budapest from STADAT lak0028 latest year — USED-home section only (the
  table also has new homes further down: Budapest new flats 1,616k were
  once picked by mistake): houses/terraced 924k → benchmark; flats split
  into non-panel multi-unit 1,258k and panel estates 1,119k → two figures,
  none applied (context). County seats: the quarterly release's table
  (houses + flats together) → context + the town's own y-o-y as the trend
  (lp status "context" with yoyPercent/trendText/label/marketArea — generic
  hooks in the orchestrator). Budapest fixture removed. Next release: new
  slug (lakaspiaci-arak-lakasarindex-2026-ii-negyedev…).
- Currency (Sept 30 2026, site-wide bug): the form's currency fell back to
  EUR for every country off a short list, while the benchmarks are in local
  currency (Prague CZK 131,520/m², Budapest HUF, Japan JPY) → "asking vs
  market" was wrong. Now `COUNTRY_CURRENCY` (identical in engine.js,
  compliance-report.html, business-portfolio.html) = the currency of the
  official benchmark: local currency, except Serbia EUR (RGZ), Peru and
  Uruguay USD (BCRP/INE and the market quote them), Cambodia/Ecuador/Puerto
  Rico USD. Bulgaria = EUR since 1 Jan 2026.
- Greece zone prices (Sept 30 2026): `lib/greece/zones.js` — the Ministry
  of Finance / ΑΑΔΕ objective-value zone prices (τιμές ζώνης, ZONES_LATEST:
  layer 1 area zones, layer 0 street-frontage zones; in force since
  1 Jan 2022, 2021 revision) read through the public map app's own proxy
  (maps.gsis.gr/valuemaps2/PHP/proxy.php — the ArcGIS server itself 404s
  direct; the same request the public map makes, no challenge bypassed).
  Address → Esri World geocoder (the one the ministry's map uses). Exact
  address → its own street's frontage zone within 30 m, else the single
  area zone; boundary → both listed; town/neighbourhood → the municipal
  unit's range + median (+ zones within 400 m for "Kolonaki, Athens").
  Shown as the official record rows + text, NEVER the benchmark (a tax
  base, not a market price). Check: Tsimiski 45 → frontage 724 €2,100,
  area 726 €1,600 = the ministry PDF PINAKES_APAA_726; Thessaloniki unit
  47 zones €950–2,450, median €1,350 (separate query). Islands like
  Mykonos: outside the zone system (out-of-plan valuation) → said so.
  minfin.gov.gr (transfer-values register) is behind a captcha; BoG
  publishes indices only.
- Slovenia (Sept 30 2026): `slovenia` in lib/europe/localPrices.js ←
  `python3 scripts/build-si-prices.py 2025` (GURS Annual Report on the
  Slovenian Real Estate Market, English PDF on e-prostor.gov.si, from the
  ETN register): per market analysis area (30 MAAs) and local area (123
  LAAs): existing flats median €/m² of USEFUL floor area (no balconies/
  basements) + p25/p75 → benchmark; houses with land = median WHOLE price →
  context; MAA's 2024→2025 change → trend. MAA boundaries are published
  only as map images → a place counts only when GURS names it (an LAA name
  part, or a town the report lists "including …" in an MAA); names in two
  areas dropped (Bežigrad, Šempeter, Šmartno); Ljubljana/Maribor
  neighbourhoods only with the city named. Other places → "enter the town"
  + national figures as context. Parser cross-checks every MAA against the
  report's Table 9. Ljubljana fixture (SURS 4,900) removed. Recompute from
  the raw ETN 2025 file (open-market, single flat, not new-build, price ÷
  useful area): Maribor municipality €2,671 (805) vs GURS MAA €2,670 (785),
  Celje €2,656 vs €2,660. The raw ETN open data (ipi.eprostor.gov.si JGP,
  per-year CSV) marks a sale "Tržen posel" only ~18 months later (most 2025
  sales still "V preverjanju") → not used directly. The mass-valuation file
  (EV, generalised values as at 1 Jan 2025) also carries OWNER NAMES → not
  used. Re-run each spring with the next report's year.
- Latvia (Sept 30 2026): `latvia` in lib/europe/localPrices.js ←
  `python3 scripts/build-lv-prices.py` (VZD market statistical indicators,
  data.gov.lv "tirgus-statistika", CC BY 4.0, from Land Register sales):
  per city/town/parish, median WHOLE price of apartments by rooms (1–4)
  and houses by floor-area band, last full year. VZD says they are made
  automatically without reviewing each sale (min €10 in the file), Riga
  only as a whole → CONTEXT only, 10+ sales per figure. Check: Riga
  2-room 2025 from VZD's raw NĪTIS file (single apartment, whole share)
  4,973 sales, median €52,000 vs VZD 4,985 / €51,700. VZD's raw NĪTIS
  transaction file (nekustama-ipasuma-tirgus-datu-bazes-atvertie-dati)
  has no market-sale flag → not used for our own statistics. Re-run each
  February.
- Live audit fixes (Sept 30 2026, all 91 dropdown countries × flat/house
  run against production; `/tmp` audit script, re-run after big changes):
  - Regional fixtures now carry `flatsOnly` (Serbia, Montenegro, Peru,
    Dominican Rep.) — a flat figure is never a house's benchmark;
    `askingPrices` (Dominican Rep. ONE ROE = offer prices → context only);
    `changeIsMonthly` (never shown as the YoY trend). recentTransactionPrices
    entries may carry `appliesTo: "flats" | "unstated"` (Croatia flats;
    Slovakia "unstated": NBS's JS-rendered regional table could not be
    re-checked for flats vs all homes → context only). The flats regex also
    knows "condominium / Stockwerkeigentum" (Zurich was applied to houses).
  - Serbia: `scripts/build-rs-prices.py` → lib/data/serbiaPrices.json — RGZ
    quarterly report (Register of Real Estate Prices) Tables 10–11: median
    €/m² of flats per city (28) and per Belgrade inner cadastral
    municipality (10), YoY, sales; existing/new split as context. Built into
    a `regions` fixture (Palilula / Stari grad need "Beograd" — Niš has a
    Palilula). Q2 2026: Belgrade 3,245 (2,717 sales), Vračar 3,558, Novi Sad
    2,420. Re-run each quarter (file name on rgz.gov.rs "Квартални …").
  - Montenegro: MONSTAT "Cijene stanova u novogradnji" Q2 2026 by MONSTAT
    region (footnote 1 lists the municipalities): coastal 2,838 (+21.6% vs
    Q2 2025 2,333), Podgorica 2,510 (+19.1%), central/northern no trend
    (composition swings). NEW flats from signed contracts only.
  - Uruguay: the Feb 2025 Montevideo figure (19 months old, MoM change shown
    as YoY) removed; INE release page: national median −5.56% 12-month
    (June 2026). INE's report host (www5.ine.gub.uy) has a broken TLS chain /
    503 → the Montevideo level could not be refreshed.
  - Belgium: a town not matched to a region no longer gets the NATIONAL
    median as benchmark; Brussels detached (Statbel's own "too few sales")
    → context. statbel.fgov.be pages sit behind an F5 bot challenge (not
    bypassed); bestat API has no per-municipality price views.
  - Estonia: `estonia` resolver ← lib/data/estoniaPrices.json (hand copy of
    the Land Board's quarterly review): Tallinn resale flats 2,971 (+5.9%);
    2-room (40–55 m²) resale figures for Tartu 2,400, Pärnu 1,988 and some
    Tallinn districts → benchmark only for a 40–55 m² flat; no house prices.
  - Munich: Halbjahresreport 2026 (semi/terraced resale 7,950/7,500/7,650;
    new flats 9,800/10,550 context). Resale flats still chart-only.
  - UAE: no fetch any more (Dubai Pulse resets connections, dataset last
    updated Apr 2024) — each report had waited ~11 s; honest message now.
- UK rents + taxes (Sept 30 2026): the hand fixture of 5 ONS region rents
  (any unmatched town got the ENGLAND average in its yield/score) is
  replaced by `lib/data/ukRents.json` ← `python3 scripts/build-uk-rents.py`
  (ONS Price Index of Private Rents xlsx, latest month): the property's own
  local authority (England/Wales LAs, London boroughs), by bedrooms or home
  type; no match → no rent. Scotland is published per rental market area
  (Lothian…), not council → Edinburgh gets none. Re-run monthly. Check:
  Manchester 2-bed £1,233, Westminster £3,196 = the ONS file. uk-intelligence
  returns `nation` (HPI AreaCode E/W/S/N) → closingCosts `byNation`:
  Scotland LBTT (Revenue Scotland: 0/2/5/10/12%, ADS 8%) and Wales LTT
  (Welsh Government: 0/6/7.5/10/12%, higher rates 5–17%) instead of SDLT.
  HPI file months are probed in parallel with HEAD (the newest is ~2 months
  back; the old code tried each missing month in turn).
- Closing costs added (Sept 30 2026): South Africa (SARS transfer duty
  brackets from 1 Apr 2026), Kenya (Ministry of Lands service charter:
  stamp duty 2% or 4%, KSh 1,000 registration), Morocco (CGI 2026 art.
  133-I-F 4% built / G 5% land / B-7° 3% social; ANCFCC 1.5% + 100 DH,
  min 500). Only verified parts are listed (no notary/agency guesses).
  NOTE: realityCheck's parsePercent() averages the FIRST TWO "%" numbers of
  totalEstimatedRange — write totals so those two are the buyer's range
  (Barbados' total started with the seller's 3.5% and was reworded).
- Armenia (Sept 30 2026): regional fixture — Cadastre Committee quarterly
  market analysis (cadastre.am/storage/files/1-ii2026.pdf, table 3.6-2,
  copied from the rendered page): market-averaged AMD/m² of flats per
  Yerevan district (12 district averages, Q2 2026 vs Q2 2025). The
  Committee builds them from contract prices AND offer prices →
  `askingPrices` → context only; "Yerevan" alone → the district range.
  The PDF's Armenian text layer is garbled (custom fonts) — read the table
  from a rendered image (pymupdf) and check figures against the text
  layer's numbers. Update each quarter. Also: a flats-only series' change is
  no longer used as a HOUSE's trend (Serbia/Montenegro/Peru/Armenia).
- Egypt closing costs skipped: the Shahr Aqari fee table (Law 9/2022) is
  only reported by state media (Ahram), not on the Ministry of Justice's own
  site.
- Checked Sept 30 2026, not usable: Dubai — DLD transaction search behind
  reCAPTCHA; its indexes GraphQL (gateway.dubailand.gov.ae/indexes-api) is
  open but publicly WRITABLE (full of test/pentest rows) → not a verifiable
  source. Estonia — Maa- ja Ruumiamet price query (maaamet.ee/kinnisvara/
  htraru) sits behind a Cloudflare challenge and calls itself "informative
  and unofficial"; its quarterly PDF has national indices only.
- Checked Sept 30 2026, needs the user: Japan — MLIT Real Estate
  Information Library transaction-price API (reinfolib, official) needs a
  free API key (401 without; the old webland API is gone) — application
  form reinfolib.mlit.go.jp/api/request/ (user type 法人, ~5 business
  days; terms allow commercial use with MLIT's credit line, Art. 7).
  User, Sept 30 2026: WAIT until the Irish company is registered; Australia — NSW
  Valuer General bulk sales files (every recorded sale, free) sit behind a
  Cloudflare challenge for servers → could be downloaded by the user in a
  browser (NJ/FL pattern).
- Not possible yet (checked Sept 2026): Greece (see above), Bulgaria (NSI per-city prices ended
  2014), Cyprus/Romania (no open per-area price data found).

## Full audit, Sept 30 2026 (all 91 dropdown countries on production)

Blockers found — do not retry the same route:
- Gulf: Saudi MoJ / REGA sales data is published on open.data.gov.sa
  (503 / no answer to foreign servers and WebFetch) → needs a browser
  download by the user (NJ/FL pattern). MoJ sale records carry the home
  type only for 2023 Q1–Q3 → REGA's per-type indicators preferred.
  Qatar MoJ bulletin: moj.gov.qa unreachable, figures only via press →
  not used. UAE: DLD transactions only via the site's captcha search →
  user browser download (in progress with the user). Saudi Arabia,
  Qatar, Kuwait, Bahrain, Oman are NOT in the dropdown yet.
- Seattle (King County) EXTR_RPSale.csv and Phoenix (Maricopa) R102 sales
  affidavits carry buyer/seller NAMES → not used (same rule as Slovenia's
  EV file); the copy downloaded for inspection was deleted.
- Monaco IMSEE 2025: price per m² is now a regression model (IMSEE's own
  method note) → modelled, not used (like Luxembourg "prix affinés");
  imsee.mc answers 403 to servers.
- Slovakia NBS regional prices: only via press; basis (sales vs offers)
  not confirmable from NBS itself → still context only.
- Croatia PPV needs street + number; a city-only input now says so
  (was "no official price figure for Split yet").

- Switzerland (Sept 30 2026): recentTransactionPrices entries may carry
  `alternatives` (other regions' official figures, each with appliesTo);
  the orchestrator picks the one whose area fits the place + type.
  Geneva: OCSTAT "Informations statistiques n° 11 – Nov 2025" (2024
  transactions): non-new free-market PPE flats median CHF 10,853/m²
  (controlled ZD PPE 7,041 and new free-market 10,284 separate); houses
  median CHF 2.190 m. Next edition ~Nov 2026 (2025 data).
  City of Zurich flats: `lib/europe/zurichCity.js` ← `python3
  scripts/build-zh-condo.py` (Statistik Stadt Zürich open data
  BAU515OD5157, yearly): median CHF/m² of living area of Stockwerkeigentum
  free sales by Quartier (10+ counted sales; ranges like "2-6" → its
  Kreis) → Kreis → whole city (2025: 720 sales, CHF 17,646). Shipped with
  the orchestrator via vercel.json includeFiles.

- Israel (Sept 30 2026): CBS release 256/2026 p. 5 prints exact Q2 2026
  averages (free market, 1–6 rooms, provisional) for Tel Aviv 4,553.5k,
  Herzliya 3,578.1k, Ramat Gan 3,070.0k, Jerusalem 3,058.5k, Haifa
  1,816.4k, Ashkelon 1,729.1k, Be'er Sheva 1,236.2k → `alternatives` of
  the israel entry. The other 11 cities are only unlabelled chart bars →
  not used (read CBS's full city table when reachable; cbs.gov.il does
  not answer from the sandbox, the PDF came via WebFetch). Hebrew RTL text
  layer is scrambled → read from the rendered page image.
  nadlan.gov.il (Tax Authority deals, every sale) → its API
  (api.nadlan.gov.il) sits behind reCAPTCHA Enterprise → not used.

## Dubai (Oct 1 2026, Claude B)

`lib/uae/dubaiSales.js` ← `python3 scripts/build-dubai-sales.py <export.csv|.xlsx …>`
→ lib/data/dubaiSales.json. Source: the Dubai Land Department's own
"Transactions" export (dubailand.gov.ae → Open Data → Real Estate Data),
downloaded by the user in a browser (the portal does not answer servers;
no names in it — TOTAL_BUYER/SELLER are counts). The user opened the CSV
in Excel → .xlsx with each CSV line in column A; the script reads both
(cells split at a comma re-joined; the ~50 lines Excel broke at embedded
line breaks are skipped and counted). Rules: GROUP "Sales" + PROCEDURE
"Sale" (ready) or "Sell - Pre registration" (off-plan) only; residential
Unit/Flat and Building/Villa; a TRANSACTION_NUMBER on several rows =
multi-property deed → dropped; 6 months up to the latest sale; 10+ sales.
Flats → median AED/m² of the registered unit area (project → area +
bedrooms → area); villas → median WHOLE price (DLD's villa area may be
the plot). Ready vs off-plan never mixed (the other stage = context).
Area names come in two spellings in the export (upper/mixed case → merged;
"DUBAI MARINA" vs "Marsa Dubai" both exist → NOT merged, each matched only
when typed). Abbreviations only for the DLD names themselves (JVC, JLT,
JBR, JVT, DSO). "Downtown Dubai"/"Downtown" → DLD area "Burj Khalifa"
(evidence in the export itself: its projects are Downtown's — St. Regis /
Vida "Downtown Dubai", The Address Dubai Opera, Boulevard Point — and DLD's
nearest-landmark field reads "Downtown Dubai" for 1,040 of its sales);
labelled "Downtown Dubai (DLD area Burj Khalifa)" with a note that some
towers marketed as Downtown are registered in Business Bay (project name
wins). Check: Downtown 2-bed ready flats 228 sales, AED 25,989/m². First build: export Jan–Oct 1
2026, window 2026-04-02..2026-10-01, 60,748 sales, 122 areas. Check:
Business Bay ready flats 861 sales, median AED 18,603/m² (separate
Python recompute from the raw xlsx). Refresh monthly with a new export.

## Australia (Oct 1 2026, Claude B)

`lib/australia/absPrices.js` ← `python3 scripts/build-au-prices.py`
(quarterly) → lib/data/australiaPrices.json: ABS data API dataflow
RES_DWELL (data.api.abs.gov.au, keyless) — UNSTRATIFIED median price of
residential property transfers, established houses vs attached dwellings
(flats/units/townhouses), per Greater Capital City area and rest of each
state (15 areas), latest quarter (preliminary — counts get revised up).
CONTEXT ONLY (decided the same day): a whole metro median is not a
suburb's market — a Bondi house read "far above market" against Greater
Sydney. The year-earlier median is context, never the trend. Place → area from ABS's own
ASGS Ed. 3 allocation files (MB_2021_AUST + SAL_2021_AUST joined on mesh
block; a suburb needs 95%+ of its area in one GCCSA) + SA4/SA3 region
names (Gold Coast, Sunshine Coast) + capital names. A name in several
states (Richmond, Manly) needs the state; a capital name alone = the
capital (Perth). Check: Greater Sydney houses 2026 Q2 8,932 transfers,
AUD 1,487,600 = a direct API query.
SUBURB BENCHMARK (Oct 1 2026): `scripts/build-au-suburbs.py` →
lib/data/australiaSuburbs.json — Valuer-General of South Australia
"Metropolitan Median House Sales" (data.sa.gov.au, quarterly XLSX): a
house in an SA suburb with 10+ sales gets its suburb median as the
benchmark (171 suburbs, 2026 Q2; check Magill 35 sales AUD 1,325,000 =
the raw file). Victoria (Oct 1 2026): the user downloaded Valuer-General
Victoria's "median-house-march-quarter-2026.xls" (land.vic.gov.au answers
403 to servers) → `python3 scripts/build-au-suburbs.py --vic-house <xls>
[--vic-unit <xls>]`: 515 suburbs with 10+ sales (the file's "^" = fewer
than 10, "*" = carried forward → skipped). Check: Richmond 65 sales AUD
1,373,000; Abbotsford 14, 1,510,000 = the raw rows. Units file (Oct 1
2026): 274 suburbs with 10+ sales, 2026 Q1. Check: South Yarra 219 sales
AUD 533,000; Richmond 180, 557,500 = the raw rows. Place matching: the suburb
wins over a capital typed after it, and a typed capital gives the state
("12 Smith St, Richmond, Melbourne" → Richmond VIC). NSW Valuer General
bulk Property Sales Information (valuation.property.nsw.gov.au) is licensed
CC BY-NC-ND 4.0 — NON-COMMERCIAL → not usable by Pradixium (and the files
sit on valuergeneral.nsw.gov.au, 403). NSW is covered by the DCJ postcode
medians instead (CC BY 4.0, dcj.nsw.gov.au copyright page). SA data.sa.gov.au
and the VIC Valuer-General files: CC BY 4.0.

TRANSFER DUTY (Oct 1 2026): closingCosts.js australia `byAuState` — the
suburb match's state → duty computed on the asking price from the state's
own schedule (investor / general rates, no concessions) + the foreign
surcharge: NSW (Revenue NSW 2026–27 thresholds, premium > $3.87 m, SPD 9%),
VIC (SRO non-PPR table, FPAD 8%), QLD (QRO general rates, AFAD 8%), WA
(general rate since 1 Jul 2022, FTD 7%), TAS (rates since 21 Oct 2013,
FIDS 8%), ACT (DI2026-155 Table 2, from 1 Jul 2026; no foreign rate in
it), NT (Stamp Duty Act Sch 1 formula, as in force 1 Jul 2025; no
surcharge). SA: Revenue SA + legislation.sa.gov.au + AustLII all 403 →
officially blocked from here, the text says so. Checks: QRO's own example
$850,000 → $31,275; NSW $1 m → $39,187; VIC $1.4 m → $77,000 (5.5% flat
band). NSW thresholds are CPI-indexed each 1 July and the ACT issues a new
DI each July → update both every July.

RENTS + NSW BENCHMARK (Oct 1 2026): `python3 scripts/build-au-rents.py`
(quarterly) → lib/data/australiaRents.json. NSW: Department of Communities
and Justice "Rent and Sales Report" (dcj.nsw.gov.au, xlsx linked on the
report page): Table 4 sale prices per POSTCODE, strata (units/townhouses)
vs non-strata (houses), from Notices of Sale lodged with NSW Land Registry,
5% trimmed per LGA, 10 or fewer sales unpublished, "s" = 11–30 → the
postcode median is now the NSW BENCHMARK (before the SA/VIC suburb
records). Table 2 weekly rents of new bonds per postcode × type ×
bedrooms. SA: Private Rental Report (data.sa.gov.au) per suburb × flats /
houses × bedrooms. Suburb → postcode from ABS MB × POA_2021 (80%+ of
the suburb's area), a typed postcode wins. Rent → rentalBenchmark
monthlyRentFlat (weekly × 52 ÷ 12) → yield when no rent entered. Check:
postcode 2150 strata 221 sales, AUD 620,000; 2-bed flats 429 bonds, $700/wk
= the raw rows. VIC (Homes Victoria rental report) and QLD (RTA) rent
sites do not answer from here → need a browser download.

LAND TAX (Oct 1 2026): propertyTax.js australia `byAuState` (state from
the suburb match): each state's official land tax schedule + foreign-owner
surcharge as TEXT — the tax is on the Valuer-General LAND value, not the
price, so no amount is computed. NSW (threshold $1,075,000 frozen, $100 +
1.6%, premium $6,571,000; surcharge 5% from 2025), VIC (2024 general rates
+ 4% absentee surcharge), QLD (individuals from $600,000; absentees from
$350,000 + 3% surcharge), WA (from $300,000; Perth MRIT 0.14%; no foreign
surcharge listed), TAS (rates from 1 Jul 2025; FILTS 2% since 1 Jul 2022),
ACT (DI2026-152: $1,778 + 0.54–1.26%, foreign surcharge 0.75%; rented
homes). SA + NT: revenue offices 403 → not listed, said so. The old
"AUD 1,300–2,500 council rates" line had no source → removed.

FOREIGN BUYERS (Oct 1 2026): foreignBuyerRules.js australia re-checked on
foreigninvestment.gov.au (residential land guidance): established-dwelling
ban 1 Apr 2025 → 30 Jun 2029, new/near-new + vacant land with approval,
annual vacancy fee (183 days); extraCost now lists the verified state
surcharges (duty and land tax).
AUSTRALIA CHECKLIST STATUS (Oct 1 2026): (1) price — DONE NSW (postcode),
SA houses, VIC houses + units; QLD/WA/TAS/ACT/NT: no open official
suburb file found (WA Landgate 403; QLD/TAS/ACT none published) → ABS
area context only. (2) trend — officially impossible: ABS RPPI
discontinued; area medians a year apart are context, not an index.
(3) rent — DONE NSW, SA; VIC Homes Victoria "Moving annual rents by
suburb" (CC BY 4.0, discover.data.vic.gov.au lists it, files on
dffh.vic.gov.au which does not answer here) → user download requested;
QLD RTA unreachable. VIC DONE Oct 1 2026 with the user's download
(`build-au-rents.py --vic-rent <xlsx>`; Sep 2025 quarter = the latest on
data.vic): per suburb GROUP ("Richmond-Burnley"), a suburb name maps to
its group when it is in exactly one; flats 1–3 bed, houses 2–4 bed,
10+ lettings. Check: South Yarra 2-bed flats 1,288 lettings, $700/wk.
(4) duty — DONE 7 states, SA blocked. (5) land tax —
DONE 6 states, SA/NT blocked. (6) foreign buyers — DONE. (7) property
record — officially impossible for free commercial use: NSW PSI is
non-commercial; VIC/WA/TAS valuation portals are paid or 403.

## Portugal, squeezed (Oct 1 2026, Claude B)

- (1) price — DONE earlier (INE 0012241 / 0012236 per parish & municipality).
  Comporta → Grândola municipality (it is in Carvalhal parish, which INE
  does not publish); "not_covered" now means "place not recognised" (every
  municipality has an INE median).
- (2) trend — DONE: INE HPI Q2 2026 +16.5% (q/q +3.6%, index 301.43,
  2015=100) via Eurostat prc_hpi_q (the INE figure); update MARKET in
  api/portugal-intelligence.js each quarter. Local YoY = the INE median's.
- (3) rent — DONE: `python3 scripts/build-pt-rents.py` (quarterly) →
  lib/data/portugalRents.json — INE 0014696 (median rent €/m² of NEW lease
  contracts, 12 months, Metodologia 2026; code found via smi.ine.pt
  indicator 19464) for 308 municipalities + the parishes INE publishes;
  matched parish, else its municipality (code[:7]); no national fallback.
  Replaced a hand table (8 places, mixed vintages, Lagos/Faro → "Algarve",
  every other town → national rent). Check: Lisboa €17.43, Porto €14.48,
  Loulé €12.33 (Q2 2026) = the raw INE JSON.
- (4) closing — DONE: closingCosts.js `ptImt` — IMT on the asking price,
  CIMT art. 17 n.º 1 c) (not own permanent home) table from Lei 73-A/2025
  with the n.º 3 split rule; single 6% / 7.5% above €633,931 / €1,150,853;
  10% for tax-haven buyers (n.º 4) in the text; + Imposto do Selo 0.8%
  (TGIS verba 1.1). The old "flat 7.5% for non-residents from 2026" claim
  is NOT in the law → removed. Checks: €250,000 → €8,105; €500,000 →
  €27,300 (= 8% − €12,700 parcel).
- (5) IMI — DONE: `python3 scripts/build-pt-imi.py` (each January) →
  lib/data/portugalImi.json — AT Portal das Finanças "Taxas IMI por
  Município" public form, all districts, latest year with rates (2025,
  paid in 2026): urban + rural rate per municipality; 8 municipalities set
  rates per parish ("-") → text says so. Check: 199 of 308 at 0.3% (= the
  press report of the AT list), Oeiras 0.45%, Cascais 0.35% (raw page).
  Rate × VPT (tax value, not the price) → rate shown, no amount.
- (6) foreign buyers — DONE earlier (OPEN).
- (7) property record — officially impossible: the caderneta predial
  (VPT, owner) is only available to the owner via the AT portal.

## Georgia, squeezed (Oct 2 2026, Claude B)

- (1) price — officially impossible: Geostat's RPPI (the only official
  series) is built from web-scraped OFFER prices of new Tbilisi homes
  (Geostat's own method note) → district medians stay context. The Geostat
  "Real estate activities" page (categories/405, sent by the user) holds
  only sector accounts (turnover, value added, employment) — no prices.
  NAPR publishes transaction COUNTS only (press), napr.gov.ge does not
  answer here.
- (2) trend — DONE (Geostat RPPI Q2 2026 flats +4.8%, houses +5.5%), now
  labelled as the change in ASKING prices.
- (3) rent — no official rent LEVEL; the trend IS official: Geostat CPI
  detail indices (same month a year earlier = 100), COICOP row "Apartment
  rent", national: 110.872 in Sep 2026 → +10.9% (text/context only, not
  used for the yield). NBG also publishes rent + price indices and a
  capitalisation rate (annual rent ÷ price) for typical 1- and 3-room
  flats in Saburtalo and Varketili (Tbilisi) from OFFER prices, monthly,
  only in the interactive analytics.nbg.gov.ge dashboard (does not answer
  here). DONE Oct 2 2026 without it: NBG's monthly "Financial Sector
  Review — Analytical Tables and Charts" PDF (nbg.gov.ge/fm/…/
  financial-sector-review-eng.pdf, reachable) prints the same series in
  Table 4.3 "Real Estate Indices" (GEL, Jan 2010 = 100): Aug 2026 price
  219.4 vs 220.6 → −0.5%, rent 237.5 vs 242.5 → −2.1% → context text in
  the Georgia fixture. The cap rate is not in the PDF. Update monthly.
  RPPI files (categories/698): YoY flats 104.81 / houses 105.48 for Q2
  2026; district file Q2 2026 = the fixture's values (Mtatsminda 6,730,
  Vake 5,914). NOTE: those xlsx rows hold 22–26 quarters — read the LAST
  value, not a truncated print.
- (4) closing — DONE earlier (no transfer tax; NAPR flat registration fee).
- (5) property tax — DONE, re-verified on matsne (Tax Code art. 202(5):
  0.05–0.2% below GEL 100,000 family income, 0.8–1% at or above; art.
  206(1)(a): exempt up to GEL 40,000 preceding-year income).
- (6) foreign buyers — DONE earlier (OPEN; agricultural land only).
- (7) property record — not used: the NAPR public-registry extract
  carries owner names.

## Greece, squeezed (Oct 2 2026, Claude B)

- (1) price — officially impossible: no official transaction price LEVEL
  (Bank of Greece publishes indices only; the zone prices are a tax base;
  the minfin transfer-values register is behind a captcha).
- (2) trend — DONE: BoG Q2 2026 apartments +5.5% (Athens 5.0, Thessaloniki
  4.7, other cities 5.4, other areas 7.1; new 6.2 / older 5.0) — the
  official page 403s, figures from its search snippet + the national rate
  recomputed from the BIS series for Greece (stats.bis.org WS_SPP
  Q.GR.N.628, from the BoG): 122.3916 / 116.0215 → +5.5%. Update
  GREECE_HPI each quarter (BIS API answers here).
- (3) rent — the old "BoG residential rent index 116.1, +8.7%" had NO
  source: BoG's open data (data.gov.gr) has office + retail rent indices
  only → removed. Now ELSTAT CPI release (statistics.gr, reachable),
  Table 5 "Rentals for dwellings": Aug 2026 +6.2% on a year earlier,
  national, its own source block. No official rent LEVEL → no yield
  without an entered rent. Update monthly.
- (4) closing — DONE: transfer tax 3% + 3% municipal = 3.09% on the
  HIGHER of price and objective value (AADE page); new-build VAT 24%
  suspended to 31.12.2026 (Law 5246/2025 art. 12, read on taxheaven);
  notary 0.80/0.70/0.65/0.55% + VAT (ΥΑ 111376/2012 as amended 2015);
  Cadastre 5‰ (decision 2/12-1-2026). Lawyer/agency lines (market
  convention) dropped. Total 4.4–4.6% (check: €300k → 4.51%, €2m → 4.42%).
- (5) ENFIA — DONE: Property Tax Code Law 5219/2025 art. 11 table
  (€2.00–16.20/m² basic tax over 9 zone-price bands; the old text said
  "€2–13+"); supplementary tax = legal entities only (art. 12; the old
  text applied it to individuals); 2026 −50% / 2027 exempt for tax
  residents' MAIN homes in settlements ≤ 1,500 people (Law 5246/2025
  art. 10).
- (6) foreign buyers — DONE earlier (ELRA, Law 1892/1990 border areas).
- (7) property record — DONE as zone prices (lib/greece/zones.js); the
  cadastre extract carries owner names and is paid → not used.

## Turkey, squeezed (Oct 2 2026, Claude B — the user handed Turkey over)

- (1) price level — DONE as CONTEXT: TCMB "Konut Birim Fiyatları" +
  "Değerlemesi Yapılan Konutların Birim Kiraları" (quarterly, all 81
  provinces): median TL per m² of GROSS area (outliers removed) from the
  valuation reports banks order for mortgage applications (KFE-Metaveri.pdf
  definitions) — appraisals, not sale prices → text, never the benchmark.
  Series codes from TCMB's PUBLIC EVDS tables (igmevdsms-dis/public/charts/
  portlet/<id>, linked from KFE-Tablo.pdf; no key) saved by the build
  script; values fetched live with the key (TP.BIRIMFIYAT.<P>, TP.BK.<P>).
  Live check Oct 2 2026: Muğla 2026-Q2 TL 82,290/m², rent TL 352/m²/month;
  Türkiye TL 51,850 / TL 258. The public /fe data endpoint needs a session
  → not used.
- (2) trend — DONE (moved to EVDS Oct 3 2026, see Licence compliance):
  `lib/turkey/kfe.js` ← `python3 scripts/build-tr-kfe.py` (was: KFE.pdf): Table 1/2 (Türkiye,
  İstanbul, Ankara, İzmir) + Grafik 4/8 (19 İBBS region groups, provinces
  as TCMB lists them; values printed in bar order, pairing checked against
  the tables, the script stops on a mismatch). Aug 2026: Türkiye +23.0%
  (real −6.5%), İstanbul +26.3, Muğla region +17.9. Districts buyers type
  (Bodrum, Alanya, Kadıköy, Çeşme…) → province (DISTRICTS table). Passed as
  housingPriceIndex.regional. Fallback when EVDS fails: the same release.
  Base is 2023=100 (old label said 2010).
- (3) rent — new-tenant rent index (YKKE) change, same release, per region
  (İstanbul +34.5%) → text; no official rent level → no yield.
- (4) closing — DONE: tapu harcı 2% buyer + 2% seller on the declared price
  (≥ tax value), Law 492 Tariff 4 item 20(a), Decision 2012/3735, Law 7566.
- (5) emlak vergisi — DONE: Law 1319 art. 8 homes 0.1%, ×2 in metropolitan
  municipalities; 2026 tax value capped at 2× 2025 (temp. art. 23).
- (6) foreign buyers — DONE earlier.
- (7) property record — officially impossible: TKGM e-Tapu needs the
  owner's e-Devlet login.

## Licence compliance (Oct 3 2026, Claude B — user: "תכבד את כל ההוראות והחוקים פה")

Every source's own reuse terms were read on the body's page; the required
attribution is added as a "Licence" source block by `lib/data/licences.js`
(only for sources the report's evidence used; the orchestrator calls
`licenceNotices()` after the evidence is built). Found and fixed:
- Turkey: TCMB's WEBSITE content (the KFE.pdf release) needs TCMB's written
  permission for commercial use (tcmb.gov.tr Kullanım Şartları) — the
  regional figures came from it. EVDS's own terms (docId=18) allow use with
  the source named, also commercially if no extra fee is charged for the
  data, and a translation must say it is not TCMB's → everything now comes
  live from EVDS: TP.KFE.<region> / TP.YKKE.<region> for the 19 İBBS groups
  (codes from TCMB's public EVDS tables, `build-tr-kfe.py`, no PDF). No key
  / EVDS down → "unavailable", no fallback figures. The "real change" line
  (from the PDF text) is gone.
- France rents: the file used was a PRIVATE company's aggregation
  (Terralyse "rendement locatif") with its own price method, and it gave
  houses the FLAT rent → replaced by the ministry's own Carte des loyers
  2025 files (pred-app / pred-mai, DHUP/ANIL, Licence Ouverte), flats and
  houses separately, with the prediction interval and "estimated on a wider
  area" flag. Check: Ambérieu-en-Bugey flats €12.32 = both files.
- Licence Ouverte needs the date of last update → DVF's date is read from
  the data.gouv.fr API (cached 6 h).
- Stats SA: older releases forbade selling the data; the CURRENT P0160
  imprint only asks to name Stats SA as the source of the basic data and to
  say the analysis is the user's own → allowed, notice added.
- Not commercial-use-safe, still not used: NSW Valuer General (CC BY-NC-ND),
  KSH tailored extracts (CC BY-NC; STADAT tables are CC BY 4.0 — those are
  what we use), INE Portugal's OLD terms (now CC BY 4.0).
- Not yet checked: Dubai DLD export terms, US county open-data portals,
  NBP/GUS, Spain INE/MIVAU, Serbia RGZ, Mexico SHF, Brazil SP (source named
  in the text meanwhile).

## Singapore (Oct 3 2026, Claude B — added to the dropdown)

`api/singapore-intelligence.js` + `lib/singapore/sg.js` ← `python3
scripts/build-sg.py` (quarterly) → lib/data/singapore.json.
- (1) price — DONE Oct 3 2026 with the user's URA access key (the user
  holds it — NEVER commit it; ask for it at refresh time): `URA_KEY=… python3
  scripts/build-sg.py` → PMI_Resi_Transaction (4 batches, ~132k caveats, no
  names) → per project, 12 months to the latest month (2025-10..2026-09):
  median S$ per m² of STRATA area of single-unit non-landed sales (Apartment
  / Condominium / EC), resale+sub-sale and new sale kept apart, 10+ each →
  463 projects. Benchmark = resale median, else new-sale (labelled). The
  project's URA market segment (CCR/RCR/OCR) now picks the regional PPI.
  Check: Treasure at Tampines 124 resales, S$19,405 (separate recompute
  from the raw batches). Without URA_KEY the script keeps the old sales
  block. HDB resale prices are public but foreigners cannot buy HDB flats →
  not used.
  TERMS (URA API Terms of Service + Singapore Open Data Licence v1.0):
  commercial use allowed; call the service only from a server (we only
  call it at build time); every report using the data shows the licence
  notice ("Contains information from … accessed on … from URA … Singapore
  Open Data Licence version 1.0" + link) — the "Licence" source block.
- (2) trend — DONE: URA PPI via SingStat tables M212261 (all / landed /
  non-landed) and M212271 (CCR / RCR / OCR, only when typed). 2026-Q2:
  all +2.9%, landed +7.0%, non-landed +1.8% (219.4/213.2 etc.). SingStat
  answers 403 without an Accept header.
- (3) rent — DONE: URA "Rentals of Non-Landed Residential Buildings"
  (data.gov.sg d_149ac00…): median S$ per sq ft per MONTH (unit stated in
  URA's API docs) of major projects with 10+ contracts, 621 projects
  2026-Q2. Only when the customer types the project's URA name → × m² ×
  10.7639 → the yield. Check: 18 Woodsville 5.63 × 80 m² → S$4,848/month.
- (4) closing — DONE: IRAS BSD marginal bands computed (`tiers` hook in
  closingCosts.js; IRAS's own example S$4,500,100 → S$209,606) + ABSD
  60% for foreigners (FTA nationals e.g. US as citizens).
- (5) property tax — DONE: IRAS rates (non-owner-occupied 12–36% of the
  Annual Value from 2024; owner-occupied 0–32% from 2025) as text.
- (6) foreign buyers — DONE earlier (TAX SURCHARGE).
- (7) property record — officially impossible: no open per-unit record.

## Hong Kong (Oct 3 2026, Claude B — added to the dropdown)

`api/hong-kong-intelligence.js` + `lib/hongkong/rvd.js` ← `python3
scripts/build-hk.py` (monthly) → lib/data/hongKong.json, from the Rating
and Valuation Department's Property Market Statistics xls (rvd.gov.hk).
- (1) price — DONE: average price per m² of SALEABLE area, second-hand
  sales, region (HK Island / Kowloon / New Territories) × class (A < 40,
  B 40–69.9, C 70–99.9, D 100–159.9, E ≥ 160 m²), latest month
  (provisional "*" said so); "( )" = fewer than 20 transactions → context.
  Benchmark (perSqm) — the entered size is read as saleable area. Place →
  region via the 18 districts + named areas (longest match). Check: Aug
  2026 NT class B HK$110,084, Kowloon B HK$137,442 = the raw cells.
- (2) trend — DONE: RVD price index by class (1999 = 100), y-o-y; all
  classes Aug 2026 320.5 / 288.8 → +11.0% (recomputed).
- (3) rent — DONE: RVD average rent per m² a month, same region × class
  → monthlyRentPerSqm → the yield; RVD class yield as context.
- (4) closing — DONE: AVD residential scale from 26 Feb 2026 (GovHK page),
  same for every buyer since 28 Feb 2024; computed (`hkAvd`). Checks:
  HK$4.2m → HK$40,100; HK$10m → HK$370,000.
- (5) rates — DONE: 5% of rateable value; progressive 5/8/12% above
  HK$550,000 RV from 2025; Government rent 3% (Cap. 515).
- (6) foreign buyers — DONE earlier (OPEN).
- (7) property record — not used: Land Registry searches are paid and
  carry owner names.

## Japan (Oct 3 2026, Claude B)

`api/japan-intelligence.js` + `lib/japan/mlit.js` ← `python3
scripts/build-jp.py` (monthly) → lib/data/japanPrices.json: MLIT 不動産価格
指数（住宅）, ORIGINAL series (原系列), latest month (Dec 2025, published
31 Mar 2026 — MLIT's page lists nothing newer as of Oct 2026): narrowest
published area (Tokyo / Aichi / Osaka prefecture → Greater Tokyo /
Keihanshin → the 9 regions; a city name beats a ward name — Kita, Minato,
Chuo exist in Osaka/Nagoya too) × type (condominium / detached), y-o-y +
sample count. Check: Japan condos 221.24/204.16 → +8.4%, Tokyo +9.8%,
Osaka +12.9% (hand recompute from the xlsx). No price level: MLIT's
transaction API (reinfolib) needs a key — company registration first.
The regional fixture's unsourced "¥36 million average home" and an
unverified land-price line were removed (the fixture stays for the
Global Index).

## Brazil — City of São Paulo (Oct 1 2026, Claude B)

`lib/brazil/saoPaulo.js` ← `python3 scripts/build-br-sp-itbi.py <2025.xlsx>
<2026.xlsx>` (monthly; files listed on prefeitura.sp.gov.br/fazenda/w/
acesso_a_informacao/31501 — the page answers 403 to curl, read it via
WebFetch; the xlsx files download fine with a browser User-Agent) →
lib/data/saoPauloSales.json. Source: Secretaria Municipal da Fazenda
"Guias de ITBI pagas" (every paid transfer-tax declaration; NO buyer/seller
names). Rules: Natureza "1.Compra e venda", Proporção 100, "Ativo Predial",
declared value > R$10k; a date+value+cartório shared by several SQLs =
multi-unit deed → dropped (only ~1% of those are flat + its garage);
12 months to the last full month; per IPTU fiscal sector (SQL[:3]), 10+.
Benchmark = median WHOLE declared price (flats "APARTAMENTO EM
CONDOMÍNIO", houses "RESIDÊNCIA"); per m² of IPTU built area = context
(a flat's IPTU area includes common-area share). Place → sector: CEP,
else street (file abbreviations R/AV/AL/DR/BRIG/STA… — the ABBR table)
+ nearest same-side number within 300, else a bairro the file puts 60%+
in one sector (Moema yes; Pinheiros/Vila Mariana span sectors → asks for
the street). First build: 2025-09-01..2026-08-31, 87,725 sales, 228
sectors. Check: sector 014 (Jardins) flats 612 sales, R$1,700,223.
FipeZap (listings) stays context for the rest of Brazil.

## Mexico (Oct 1 2026, Claude B)

`lib/mexico/shf.js` ← `python3 scripts/build-mx-shf.py <INEGI AGEEML csv>`
→ lib/data/mexicoShf.json: SHF Índice de Precios de la Vivienda 2026 Q2 —
per state average + quartile prices (median = 50%) of homes bought with a
MORTGAGE (built from appraisals; new + used, houses + condos together) and
the state's annual index change; annual change of the 56 municipalities in
the release (Benito Juárez/Cancún +9.69, Solidaridad/Playa del Carmen
+9.96, Los Cabos +8.48 …). SHF's page prints only the national figures
(avg 1,960,032 / median 1,299,580); the state and municipal tables are
images there → copied by hand from IIEG Jalisco's reproduction (its
national row = SHF's). Re-copy each quarter. Place → state/municipality:
INEGI AGEEML localities (seat or ≥ 2,500 people; a name in several states
only if 10× the next) + state names/aliases (CDMX, Riviera Maya…).
CONTEXT ONLY: mortgaged homes skew to economy/social housing (a Playa del
Carmen flat read "167% above market") → never the benchmark; the
municipal (else state) index change IS the trend.

## Canada (Oct 1 2026, Claude B)

`lib/canada/nhpi.js` ← `python3 scripts/build-ca-prices.py` (monthly) →
lib/data/canadaPrices.json: Statistics Canada New Housing Price Index
(18-10-0205, WDS API keyless), house+land index change on a year earlier
per CMA (27) / province — NEW houses only → a house's trend, context for a
flat. No official price level per city: CHSP 46-10-0030's "median sale
price … market sale" cells are all empty (".."); CMHC absorbed-unit prices
not checked yet. Suburbs not in a CMA name (Mississauga) → the province if
typed. Check: Toronto 2026-08 −4.3% (index 106.0) = the WDS series.

## Checked Oct 1 2026, not usable (do not retry the same route)

- Brazil, Porto Alegre ITBI (dadosabertos.poa.br/dataset/itbi): publishes
  the TAX BASE (city's own valuation), area, % transferred — no declared
  price, no property type, years to 2025 → not a market price.
- Mexico: SHF open-data xlsx (gob.mx/cms/uploads/…/Indice_SHF_datos_
  abiertos_2_trim_2026.xlsx) sits behind a bot challenge for servers and
  per SHF holds index changes only; no per-city price level exists
  officially (only state prices of MORTGAGED homes → context).
- Kazakhstan: BNS news releases now give deal COUNTS only; city prices are
  in taldau (JS-loaded results) — resale prices there come from listing
  ads (BNS method) → context at best. Not built.
- North Macedonia: the statistics office's per-m² prices stopped in 2017;
  the cadastre agency's price register is an interactive search — no file.
- Canada CHSP 46-10-0030 market-sale medians: every cell "..".
- Puerto Rico: no FHFA series (no PR metro rows, not in the state file).

## Africa (Sept 2026, Claude B)

Trend-only fixtures in `api/regional-fixture-intelligence.js` — none of these
publishes an official price LEVEL, so benchmarkValue stays null and the
orchestrator's trend-only branch shows "official price trend; no official
price level is published":
- South Africa: Stats SA RPPI P0160 (Deeds Office transactions, monthly PDF;
  statssa.gov.za blocks curl → read via WebFetch, never bypassed): YoY for the
  8 metros × all/flats (sectional title)/houses (freehold); outside a metro →
  national YoY as context. Update each month's PDF.
- Morocco: Bank Al-Maghrib & ANCFCC IPAI (quarterly): national YoY by type +
  city quarter-on-quarter only (that is all it publishes by city).
- Kenya: KNBS house price index (quarterly): national flats/houses YoY.
- Nigeria, Egypt → pending (NBS has no house prices; CBE's index is still in
  development and built from listings). Mauritius skipped: Statistics
  Mauritius primary release not reachable/verifiable.

## Listing link / pasted listing import (Sept 2026, Claude B)

`api/property-url.js` + `lib/listing/detect.js`: country from the listing's
JSON-LD (ISO codes/names), the site's domain (country TLDs + ~50 national
portals on .com) — never guessed; currency from JSON-LD or the symbol next
to the price (₪ TL AED zł Kč Ft …); square feet → m² (unitCode FTK/SQF or
"sq ft" next to the number); text regexes run on the visible text only (an
SVG path once gave "£80"); price from og:description first; room labels
only as "BEDROOMS 1" / "Bedrooms: 1" (in "3 beds 2 baths" the label is
followed by the other number). Checked Sept 2026: most big portals block
server reads (Idealista, Zillow, Zoopla, Immobiliare, Madlan, Bayut,
Domain, Daft, Hemnet… 403/captcha) — never worked around. Instead: POST
{ text, url } = the listing text the customer copies from the page (any
site); the form shows it automatically when a link is blocked. The client
fills EMPTY fields only, says what it filled, and does not enter a price in
another currency than the chosen country's. Real test: Rightmove
146099750 → £499,000, 47 m² (506 sq ft), 1 bed, 1 bath.

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
**Follow-up (Sept 2026, Claude B):** the server still computed net yield with
the same 22% in `lib/scoring/pradixiumScore.js`, feeding the score and the
Reality Check text ("Net yield (2.6%) is thin…" on a live LA report). Now
gross yield only: Reality Check PASS at ≥ 4% gross (the old 3%-net line ÷
0.78), yield score 8% gross → 100, cost-of-entry uses gross < 5%;
`netYieldPercent` is always null; the AI agent is told never to state a net
yield.

## Unofficial figures removed (Sept 30 2026, from a live Thessaloniki report)

- `getClosingCosts()` drops every fee line whose source is "Market
  convention" / non-binding guidance / surveys (86 lines, mostly agency
  commissions and lawyer fees) and then the total too (the totals were
  written including them) → `omittedUnofficial`; the report says "Not
  totalled — only the official taxes and fees are listed". Reality
  Check's cost-of-entry check then simply does not run.
- Fair value: the old last tier (asking price nudged ±10% by demand/
  trend = an own valuation) is gone → tier "none", value null, so no Fair
  Value Gap / Suggested Offer from it. Rent-implied tier kept (the
  property's own economics, labelled).
- Greece foreign-buyer entry: only what ELRA (Greece's land-registry
  contribution) states — Law 1892/1990 art. 25, frontier areas, permit
  from the Decentralised Administration committee for non-EU/EFTA buyers;
  "parts of Crete", "routinely granted" and "3-6 months" removed.

## Report AI model (Sept 30 2026, owner's decision)

`lib/agents/propertyInvestmentAgent.js` DEFAULT_MODEL = `claude-haiku-4-5`
(was `claude-sonnet-4-6`): full paid report ~21 s → 8–11 s on the live site
(France, 6 runs). Prompts, rules and figures unchanged (score, fair value,
benchmark are computed in code). The owner's priority: English wording
quality — if it drops, switch back (one line) or try `claude-sonnet-5-5`
(`modelOptions()` sends thinking `between_tools` for it). The site chat
(`api/chat.js`) was left on its own model. A paid report whose AI step
fails still opens with all official figures (engine.js, AI sections say so).

## Report feedback field (shipped Sept 2026)

One short free-text prompt at the end of every report ("anything you expected to
see here and didn't?"), all 7 languages, submits to `api/feedback.js` → a private
Supabase `feedback` table (RLS on, no public policies — only the service role can
read it). Deliberately NOT a public feature-request board or voting list: the user
was explicit — "no Roman senate," feedback is a one-way signal he reviews himself,
not a crowd-sourced roadmap. Don't build a public-facing version of this without
being asked.

## Session roles going forward (Sept 2026, re-confirmed and widened Oct 1 2026)

Two Claude sessions work this repo concurrently. Going forward, by the user's own
split: **this session (Claude A / "Pradixium 1.0") = business, marketing, go-to-
market, and light cross-cutting bug fixes** (like the Net Yield fix above); the
other session (Claude B / "Pradixium 2.0 Beta", branch `claude/ecstatic-hypatia-
coi9oe`) = technical data-coverage content (US metros #23+, Lithuania). Don't pick
up new country/county data-building work in this session without checking with the
user first — that's Claude B's lane now, to avoid both sessions colliding on main.

**Re-confirmed and widened (Oct 1 2026):** this session nearly duplicated its
OWN earlier work — `FIRST1000`/`launch1000` was created by THIS session on
Sept 30 2026 (documented a few paragraphs below, in the Launch coupon
section) at the user's explicit direction, but that fact had fallen out of
this session's active context after a conversation compaction, so when the
user referenced "the 1000 code" this session queried Stripe cold, found it,
and nearly created a duplicate coupon (`002`, since deleted, 0 redemptions,
no harm done) before realizing it already existed. Not a two-session
collision after all — a same-session memory gap, caught only because this
session now queries Stripe directly instead of trusting its own recall. The
user's broader point stands regardless, and his explicit fix: **"אדמיניסטרציה
תהיה אצלך"** — this session
now owns ALL business-facing administration (Stripe coupons/pricing, account
settings, Vercel config, anything outside the codebase itself), plus design
completions/fixes, new features, and advertising/marketing — not just the
narrower "business, marketing, go-to-market, light cross-cutting fixes" from
Sept. Claude B's lane stays "enriching the material and improving the
report" — i.e. new country/county data coverage and report-content
depth, not administration of any kind. Rationale in the user's words:
"לפעמים מנסים לרוץ אחרי שני ארנבות ולא תופסים כלום" (chasing two rabbits at
once catches neither) — administration specifically must have exactly one
owner so this exact collision (two sessions touching the same live payment
config, neither aware of the other) cannot repeat. Before touching Stripe,
Vercel, or any other external account going forward: query the live state
first (as this session now does reflexively), since CLAUDE.md alone may be
stale relative to what Claude B or the user did directly.

Go-to-market plan as discussed: first paying-ish customers via a narrow beachhead
the user has real personal access to (not just a language he speaks) — candidates
raised were Israeli overseas-property-investor Facebook groups, free reports in
exchange for honest testimonials (never incentivized/bought reviews — Trustpilot
etc. only once there are real reviews to show, not an empty profile). "This is to
test the water," not a scaled campaign yet.

**Facebook dropped as a channel (Oct 1 2026):** the user can't get a Facebook
business account approved, so Facebook groups are off the table — not a
strategy choice, a real access blocker. Gave a researched list of
international real-estate forums/communities as the replacement beachhead
candidates instead: most relevant to Pradixium's actual niche (cross-border
buyers, not domestic landlords) are SkyscraperCity (city/country-segmented,
heavy foreign-buyer discussion), The Property Forum (organized by region),
and expat-specific communities (InterNations property groups, ExpatForum.com)
— these match the "Israeli buying abroad" profile directly. Largest general
communities: BiggerPockets (2.5-3M members, US-heavy) and r/realestateinvesting
(2M members, Reddit). Recommended starting point: r/realestateinvesting and
SkyscraperCity, both of which tolerate genuine value-add answers with a link
when relevant (not direct self-promotion) — matches where people already ask
exactly the "is this price fair" question Pradixium answers. Not yet acted
on; no account created or outreach done anywhere.

**Update (Oct 2 2026):** SkyscraperCity sells a Business Premium
subscription ($199) that grants permission to post promotional content
directly — the platform's own sanctioned advertising tier, not a
borderline self-promotion workaround. Decision: worth trying given the
low cost and directly-relevant audience, but timed to after Sagacitas
Ltd's CRO registration completes (more credible to present as a
registered business when opening a paid business account), and run
alongside — not instead of — the free organic channels (Telegram real-
estate groups, personal outreach) already in motion. Not yet purchased.

## Telegram Ads campaign — first paid channel, shipped Oct 3 2026

First actual paid-advertising spend (vs. free organic outreach above).
Platform: ads.telegram.org, the **TON-denominated self-serve cabinet**
(shows as "CPM in Gram") — not the official EUR Cabinet, which needs a
€1,000-2,000 minimum deposit and is too big a commitment for "testing the
water." The TON cabinet's real minimums: ~20 TON one-time top-up to fund
the Ads account balance, 1 TON/day minimum campaign budget (~$1.45/TON on
the day this was done — check live, it moves). Funding flow: buy TON via
Telegram's own `@wallet` bot (card, no separate exchange needed) →
fragment.com → Pay for Telegram Ads → pick the Telegram Ads account →
amount in TON. Fragment requires identity verification (KYC) for the TON
purchase — this is MiCA (EU crypto regulation), not a red flag.

**Real gotchas hit, worth knowing in advance next time:**
- **Targeting (language, topic, specific-channel) locks permanently once
  the ad is created** — decide this up front, there's no editing it after.
- **The Ad Text field has its own character limit (~160) and rejects a
  literal URL/domain in the text** — the destination goes in the separate
  "URL you want to promote" field instead (`t.me/<bot or channel>`, not an
  external pradixium.com link — this field is Telegram-entity-only).
- **One language per ad, not one ad for several target languages** — the
  ad text itself doesn't auto-translate per viewer, so running in several
  languages (this campaign: Hebrew, English, French, German) means
  creating a separate ad per language, each with its own translated text.
- **First rejection: "ad destination was rejected — Profile details."**
  Telegram requires the promoted bot/channel to have BOTH a profile photo
  AND a non-empty About or Description text — @PradixiumBot had the photo
  but an empty About. Fixed in BotFather → Edit Info.
- **BotFather field mix-up that's easy to repeat:** the bot's **Name**
  field (top of Edit Info, meant to stay short, e.g. "Pradixium") is a
  different field from **Description** (shown under "What can this bot
  do?") and **About** (shown on the profile page) — accidentally pasting
  the long About paragraph into the Name field throws "Sorry, this isn't a
  proper name for a bot." Also observed: a bot Name containing **".com"
  gets rejected** by BotFather — keep it to a plain word.
- **BotFather supports per-language Name/About/Description** via the
  language dropdown next to "Info" (defaults to "Default") — used this to
  give the bot a Hebrew About distinct from the English/French/German one,
  matching each ad's target language.
- **"Send to Review" has its own rate limit** ("cannot send too
  frequently") separate from the review outcome itself — a quick retry
  after a rejection fix just hits this, not a real error; wait and retry.
- **Ad lifecycle is explicit, not automatic:** created → Review (pending)
  → Active or On Hold (user's own choice, doesn't auto-start) — "On Hold"
  right after creation is the expected default, not a stuck state.
- Geo note from the platform itself: ads here will **not** show to users
  in Russia or Ukraine (Telegram's own restriction, not something this
  project chose).

Ad copy used (English, the base version other languages were translated
from): "Would you buy a property without checking it against real market
data first? We do it in seconds. Questions? @PradixiumBot" — a curiosity-
hook style deliberately chosen over a direct pitch. Dropped an earlier
"in 30 seconds" framing since response time was never actually measured —
same honesty discipline applied to marketing copy as to the product itself.

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
- **Launch coupon — fully shipped (Sept 2026).** `api/create-checkout-session.js`
  sets `allow_promotion_codes: true` so Stripe's own hosted checkout shows a
  promo-code field. Coupon `001` ("Launch Deal": 100% off, `once`,
  max_redemptions 20) was created by the user directly in the Stripe
  Dashboard. The customer-facing **Promotion Code** — the actual code word
  typed into Checkout — was created via the Stripe MCP connector directly
  from this session (`promo_1UKhWiHtvGmNh6t8LoRMN5OB`, code `FIRST20`,
  active, linked to coupon 001, no extra restrictions) once the user granted
  write access through the connector's reconsent flow. No code here
  validates or tracks redemptions; Stripe enforces the 20-redemption cap
  itself. First-20-free/testimonial-gathering flow is now fully live.

  **Two more launch coupons added since, both live in Stripe (not this
  repo's code — `allow_promotion_codes: true` already covers any of
  them):**
  - `FIRST100` (coupon `launch100`, 100% off, `once`, max_redemptions 100)
    — created directly in the Stripe Dashboard by the user, found by this
    session on a later Stripe check rather than something the user told it
    about; already had 8 redemptions at that point. Flagging this
    explicitly so a future session doesn't assume the coupon list here is
    exhaustive — always check Stripe directly before creating a new one.
  - `FIRST1000` (coupon `launch1000`, 100% off, `once`, max_redemptions
    1000) — created Sept 30 2026 via the Stripe MCP connector, at the
    user's explicit direction to scale the free-trial/testimonial-gathering
    push to 1000 people with no ad spend. Stripe coupons can't have
    `max_redemptions` edited after creation (confirmed via the API's own
    parameter docs — only `name`/`metadata`/`currency_options` are
    editable), which is why this is a third coupon rather than a bump to
    an existing one.

  **Oct 3 2026: narrowed to one live code.** The user, understandably
  frustrated that this session didn't already know about `FIRST1000` from
  the note above (it wasn't re-read carefully enough before answering —
  a real lesson, not his error), asked to leave only the 1000 code live.
  Coupons `001` and `launch100` were **deleted** (not just deactivated —
  this MCP's Stripe tool only exposes create/list/retrieve/delete for
  promotion codes, no update/deactivate endpoint) via `DeleteCouponsCoupon`.
  Deleting the coupon a promotion code points to makes that code stop
  working for new redemptions without touching anyone who already
  redeemed it. **As of now, `FIRST1000` (code `FIRST1000`) is the only
  live promo code** — always verify in Stripe before assuming otherwise,
  per the standing note above.

## Pricing tiers (Sept 2026)

Four ways to pay, all in `api/create-checkout-session.js`:
- **One-time report — $29.99.** Single property, no recurring charge.
- **Individual monthly — $29.99/month.** NEW. Capped at **3 reports per
  30-day cycle** (not unlimited) — the flexible entry point for someone not
  ready to commit to the annual plan. No trial.
- **Individual annual — $2,999.99/year.** Unlimited reports, 7-day trial.
- **Business — $299.99/month.** Unlimited reports, no trial, for companies
  & institutions (banks, funds, agencies).

**Real bug found and fixed while adding the monthly plan:** the Supabase
`purchases.kind` CHECK constraint only allowed `'report'` and
`'subscription'` — the already-shipped `business` plan could never actually
insert its entitlement row, so business signups silently failed to grant
access. Fixed via `apply_migration` to allow
`report/subscription/business/monthly/monthly_usage`, plus a partial unique
index on `(user_id, report_signature) where kind='monthly_usage'` so the
same report can never be double-counted against the 3-report cap (e.g. two
tabs open at once).

**How the 3-report cap is enforced (`monthly` plan only):** the client can
only ever SELECT its own `purchases` rows (RLS) — it can't grant itself
access by writing a fake usage row. `api/consume-monthly-slot.js` (service
role) is the one place a slot actually gets spent: called only when the
user clicks to actually open a report they haven't unlocked yet (never
just from rendering the button label, or every page view would burn the
cap). It checks the active `monthly` row's own `created_at` as the cycle
anchor — floor((now − anchor) / 30 days) picks the current cycle. Once a
report is spent from the quota it's unlocked for good, same model as a
one-time `report` purchase.

**Stripe renewal webhook (shipped Sept 30 2026, found by the recurring
oversight routine before it ever fired for a real customer).** Until this
fix, the only place any `subscription`/`business`/`monthly` purchase row's
`expires_at` was ever set was `verify-checkout-session.js`, run once right
after the initial checkout — Stripe renews a subscription in place with no
new Checkout Session, so a real subscriber's `expires_at` (35 days for
business/monthly, 372 for the annual plan) would lapse on schedule even
though Stripe kept charging them successfully every cycle, locking out a
paying customer. `api/stripe-webhook.js` now listens for Stripe's
`invoice.payment_succeeded` event (HMAC-SHA256 signature check via Node's
own `crypto`, no `stripe` npm dependency, same zero-dependency convention
as the rest of `api/*.js`) and rolls `expires_at` forward using the same
duration rule, skipping the invoice that fires for a brand-new
subscription itself (`billing_reason === "subscription_create"`, already
handled by `verify-checkout-session.js`) to avoid creating a duplicate
purchases row in a race between the two. Registered as Stripe webhook
`we_1ULNmrHtvGmNh6t8pAjBEBgV` → `https://pradixium.com/api/stripe-webhook`,
signing secret in Vercel's `STRIPE_WEBHOOK_SECRET` — confirmed live via
the Stripe and Vercel MCP connectors (endpoint `enabled`, env var present
in production). Hadn't fired for a real customer yet when found (zero
`subscription`/`business`/`monthly` purchase rows existed at the time).

**Race condition fixed (Sept 30 2026).** The check-then-insert above used
to be two separate round trips from `api/consume-monthly-slot.js` itself —
two requests for two DIFFERENT properties arriving close together could
each pass the count check before either INSERT committed, letting more
than 3 reports through in one cycle. Moved into one Postgres function,
`consume_monthly_slot` (migration `add_consume_monthly_slot_atomic_function`
+ `fix_consume_monthly_slot_stripe_session_id`), which takes a per-user
`pg_advisory_xact_lock` before checking and inserting, so concurrent calls
for the same user serialize instead of racing; the API route is now a thin
wrapper that calls it via `rpc/consume_monthly_slot`. Verified live against
a scratch `purchases` row (cleaned up after): 4 truly concurrent calls
against a quota of 3 correctly let exactly 3 through and rejected the 4th,
and re-consuming an already-spent signature stays idempotent. The same
testing also caught a second, independent, already-live bug: `purchases.
stripe_session_id` is `NOT NULL`, which the original INSERT (in both the
old JS and my first draft of the new function) never set — every monthly
plan slot consumption had been failing with a 502 in production before
this fix, regardless of the race condition; the function now sets a
synthetic `monthly_usage_<uuid>` placeholder for these rows, since a quota
usage row isn't tied to any real Stripe session. Not yet exercised: a real
end-to-end call through the deployed Vercel route with a live monthly-plan
account (the Postgres function itself was tested directly; the thin HTTP
wrapper around it was not).

**Business-plan differentiation (raised by the user):** the concern was a
company just using the cheap individual plan instead of paying for
Business, since the underlying report data/grade must be identical for
everyone (data-honesty rule — never degrade quality by price). The
differentiation has to be in usage rights, not data quality. 4 ideas
raised; user approved building all of them, this session's own priority
order: white-label branding (shipped) → API access (shipped) → bulk/
portfolio analysis (shipped) → compliance/audit-trail PDF export (shipped).
All 4 now shipped.

**White-label branding — shipped.** `terms.html` §3a: individual-tier
reports (one-time, monthly, annual) are personal-use-only — may not be
resold, redistributed, or white-labeled; that requires Business. Backed by
an actual mechanism, not just the legal clause: `business-branding.html`
(new page, gated on an active `business` purchases row) lets a Business
account set a company name + upload a logo (Supabase Storage bucket
`business-logos`, public-read/own-folder-write; table `business_branding`,
owner-only RLS). `engine.js`'s `getWatermarkInfo()`/`attachWatermark()`
fetch that row only when the viewer's active plan is `business`, and
`report.html`'s `renderWatermark()` swaps in `renderBusinessBranding()`
(their logo + name next to the property title) instead of the Pradixium
seal — individual-tier reports are structurally incapable of ever showing
this, not just told not to. No branding configured yet → falls back to the
default Pradixium seal, never blank. Verified visually (headless Chromium,
both the business-branded path and the unchanged default-seal path render
correctly) — the actual Supabase Storage upload round-trip could not be
exercised in this sandbox (jsdelivr CDN blocked here, same known
limitation as the account-gate testing note above); confirm the real
upload once on the live site before telling a Business customer to use it.
Linked from `mockups/index.html` (Business Solutions page).

**API access — shipped.** Same page (`business-branding.html`) now also
has an "API access" card: generate/revoke a `px_live_...` key (table
`api_keys`, only its SHA-256 hash stored — plaintext shown once, at
creation, in `api/business-api-key.js`). `api/orchestrator.js` accepts
that key as an alternate `Authorization: Bearer` value in
`checkEntitlement()` — `checkApiKeyEntitlement()` looks it up, confirms
the owner still has an active `business` purchases row (a key isn't a
permanent grant), and resolves `paid:true` — this is the exact same
endpoint and response shape the web UI already calls, no separate API
surface to maintain. One active key per account (generating a new one
revokes the old) — kept deliberately simple for a non-technical business
owner rather than building key rotation/multiple-keys UI. No rate limiting
built — billing itself is the only usage limiter for now; revisit if
abused. Verified: syntax-checked, the hash-generate/hash-verify round trip
tested directly in Node, and the settings-page UI screenshotted — the
actual live key → orchestrator call was not exercised (would need a real
Business account + a live ANTHROPIC_API_KEY, not available in this
sandbox).

**Bulk/portfolio analysis — shipped.** New page `business-portfolio.html`
(same sign-in + active-`business`-plan gate as branding/API): paste or
upload a CSV (address, city, country, price, size, bedrooms, bathrooms,
propertyType, monthlyRent — only country + price required), capped at 25
rows per run. Calls `api/orchestrator.js` directly with the signed-in
business user's own Supabase session token (not an API key — this is the
in-browser tool, not the API itself), 3 requests at a time, and renders a
ranked comparison table (Score, Rating, Gross Yield, government
Benchmark, Asking vs Market — same sign convention as `engine.js`'s
`renderMarketEvidence()`: positive = below market = good) sorted by
Pradixium Score once the run completes. Business plan already grants
unlimited unredacted access per-property, so no separate paywall logic
needed here. Verified: CSV parsing (including a quoted comma inside an
address) tested directly in Node; the full analyze → render → sort flow
tested in headless Chromium with Supabase and `/api/orchestrator` mocked
(ranking, gross-yield math, and the sign convention all came back
correct); the missing-required-field and >25-rows validation errors also
confirmed. Not exercised: a real orchestrator call (same sandbox
limitation as the API-access note above).

**Compliance/audit-trail report — shipped, all 4 differentiators now
done.** New `compliance-report.html`: a formal, sources-cited document
(NOT the same layout as the paid report — a dedicated evidence-ledger
table plus a "Sources & Citations" appendix), printable to PDF via the
browser's own `window.print()` — no PDF library added, consistent with
this project's zero-dependency design. Two modes, same page:
  - Single property: reads the same `pradixiumReportData` localStorage key
    report.html already populates (`engine.js`'s `buildReportData()`) —
    no new data plumbing, so every figure matches the paid report exactly.
    A new "Compliance Report" button on report.html itself opens it, shown
    only when `watermarkIsBusiness` is true — a new field on
    `getWatermarkInfo()`/`attachWatermark()`, separate from
    `businessBranding` (which stays null until a logo/name is configured)
    so the button doesn't wrongly stay hidden for a Business account that
    just hasn't set up branding yet.
  - Portfolio: `business-portfolio.html` has a "Download Compliance
    Report" button that stores every successfully-analyzed property's
    full raw `api/orchestrator.js` response (not the redacted/rendered
    version) into `pradixiumPortfolioResults`, then opens this page —
    one section per property plus a deduplicated sources index across the
    whole portfolio.
  Sources are never invented: both modes only ever display the `source`/
  `sourceUrl` strings the government-data pipeline itself already
  produces (`marketEvidence.source`, `foreignBuyerAccess.source`,
  `closingCosts.source`, `propertyTax.source`, `currencyControls.source`)
  — a property with no sourced figures says so plainly rather than
  showing something fabricated. Verified visually in headless Chromium:
  both modes screenshotted with realistic mock data (correct citations,
  correct dedup, correct verdicts); fixed one real layout bug caught this
  way (the fixed Print button overlapped the title text) before shipping.

## Foreign Buyer Access — 9 more countries added (Sept 2026)

The user flagged that France had no entry at all (silent, not wrong) and
asked to scan more countries. `lib/data/foreignBuyerRules.js` went from 20
to 29 entries — added France, Spain, Portugal, Germany, Netherlands,
Ireland (all `OPEN`), and Italy, Greece, Cyprus (`WORKAROUND REQUIRED` —
Italy's non-EU reciprocity test via MAECI, Greece's border/military-zone
permit, Cyprus's Council of Ministers approval + one-property cap for
non-EU buyers). Same honesty discipline as the rest of this file: each
entry cites a real official/quasi-official body (Notaires de France,
Spain's Colegio de Registradores, Portugal's IRN, the German Bundestag's
own research service, Greece's Ministry of National Defence, the Dutch
government, Cyprus's Ministry of Interior, Ireland's Citizens Information
Board, Italy's Foreign Ministry) — verified via web search against each
body's own page, not just secondary law-firm/expat blogs (those surfaced
first and were used only to know what to verify, never as the cited
source itself). Verified: `getForeignBuyerRule()` tested directly in Node
for all 9 new countries plus one unlisted country (correctly stays null);
`foreign-buyer-check.html` screenshotted for both an `OPEN` (France) and a
`WORKAROUND REQUIRED` (Cyprus) entry, real function output, not mocked
text. Also fixed 3 pages that hardcoded the old "20 countries" figure
(`foreign-buyer-check.html`, `index.html`, `guides/index.html`) — found by
grepping for it, not something the user pointed out.

**Second batch (same day): 10 more, 29 → 39.** The user pushed back on
stopping at the language-matched set ("why aren't you handling the rest of
the 85 silent countries") — added Belgium, Sweden, Norway, Czech Republic
(`OPEN`) and Poland, Austria, Hungary, Croatia, Turkey, Finland
(`WORKAROUND REQUIRED`). Same per-country web-search verification against
an official body each time (Notaire.be, Sweden's Lantmäteriet, Norway's
Kartverket, Poland's MSWiA, Austria's RIS/Länder Grundverkehr law, Czech
MFA, Hungary's kormányhivatal, Croatia's Ministry of Justice — with a
direct official reciprocity-info page, Turkey's TKGM land registry,
Finland's Ministry of Defence). Two of these have a genuinely common
"workaround" most buyers actually use, worth calling out: Poland and
Finland both exempt a self-contained apartment/housing-company-share
purchase from the non-EU permit that a house-with-land purchase would
need — verified specifically (not assumed) before writing `WORKAROUND
REQUIRED` instead of `RESTRICTED`. Also updated the "20/29 countries"
copy again, now "39", in the same 3 pages.

**Third batch (same day): 8 more, 39 → 47.** User asked to keep going.
Added Brazil, Argentina (`OPEN`) and Bulgaria, Romania, Slovakia,
Slovenia, Malta, Estonia (`WORKAROUND REQUIRED`). Same per-country
official-source verification (Bulgaria's psc.egov.bg, Romania's ANCPI,
Slovakia's SLOV-LEX, Slovenia's Ministry of Justice/e-Uprava, Malta's Tax
and Customs Administration, Estonia's Riigi Teataja state gazette,
Brazil's INCRA, Argentina's RENAT land registry). Two judgment calls worth
recording:
  - **Brazil and Argentina are `OPEN`, not `WORKAROUND REQUIRED`,** even
    though both have real foreign-ownership caps — because those caps
    apply only to RURAL/agricultural land and border zones, never to an
    ordinary urban apartment or house purchase (the case this field is
    actually describing for a typical Pradixium user). Same reasoning
    already used for Norway/Sweden's agricultural carve-outs.
  - **Bulgaria and Romania both let a non-EU citizen buy an apartment
    outright, no company needed** — the restriction (no direct land
    ownership without a domestic company) only bites for a house-with-land
    or standalone land purchase. Checked specifically for each country
    rather than assumed from Poland/Finland's apartment-exemption pattern.
Also updated the "39/47 countries" copy again, in the same 3 pages.

**Full gap sweep (Oct 1 2026): 67 -> 96, closing essentially the entire
remaining gap in this product's own country list.** After the Monaco
episode, the user gave a direct, blunt instruction: stop waiting to be
handed a source, find the official body for every covered-but-missing
country myself, immediately ("תשאל את עצמך על כולם ומייד"). Computed the
actual gap precisely — diffed `api/orchestrator.js`'s `COUNTRY_ENDPOINTS`
(every country this product serves data for) against
`foreignBuyerRules.js`'s coverage — rather than guessing at what was
missing. That gap was 30 countries; 29 of them now have a real entry,
each with its own primary law/constitution article or official ministry/
registry, researched and verified with the same per-country discipline as
every earlier batch (not a rushed sweep): Russia, Kazakhstan, Armenia,
Bosnia and Herzegovina, Andorra, North Macedonia, Ukraine, Nigeria, Puerto
Rico, Moldova, Liechtenstein, San Marino, Bolivia, Ecuador, Paraguay,
Cayman Islands, Azerbaijan, Kosovo, Trinidad and Tobago, Maldives,
Belarus, Uruguay, Montenegro, Albania, Jamaica, Uzbekistan, Kyrgyzstan,
Tajikistan, Turkmenistan. Four of these (Uruguay, Montenegro, Albania,
Jamaica) were the exact four this file had earlier "researched but
deliberately not shipped" for lacking a clear-enough source — closed out
properly this time by searching harder for the actual statute/body rather
than re-accepting the same inconclusive blog-level sourcing. The only
country from the computed gap NOT added is Luxembourg, for the specific,
documented reason above (Code Civil Art. 11's still-unamended 1804
reciprocity clause) — a real, found distinction, not a skipped step.
"67/71/77/83/88/96 countries" copy bumped across all 3 pages as each
batch landed. Shipped in 5 separate commits on the same branch so each
batch's reasoning stays attributable and the diff stays reviewable, not
one giant unreviewable commit.

**What's left, honestly:** every country this product's own
`COUNTRY_ENDPOINTS` list serves now has a Foreign Buyer Access entry
except Luxembourg. The dropdown's full universe is wider than
`COUNTRY_ENDPOINTS` (the 85-dropdown-country figure from earlier batches
includes countries with no data adapter at all yet) — closing that larger
gap is a separate, lower-priority piece of work than closing the gap in
countries this product actually already serves, which is what today's
sweep targeted and finished.

**Then: explicitly told to go further — countries not in our database at
all (Oct 1 2026).** After the 67->96 sweep, the user asked for a reference
list of official real-estate-statistics bodies for every country/territory
in the world. Gave one explicitly labeled as unverified general knowledge,
not shippable data — when the user then said "add all of them," refused:
that list was names of bodies, never checked one-by-one for an actual
current, citable rule, and shipping it wholesale would be exactly the kind
of fabrication this file's entire discipline exists to prevent. Instead,
kept going country-by-country at the same verified pace. The user then
clarified the real ask: the countries NOT YET in this product's database
at all (not in `COUNTRY_ENDPOINTS`) — a different, legitimate piece of
work from the 67->96 sweep (which only closed gaps in ALREADY-supported
countries). Researched and added 6 major not-yet-supported markets,
101 total now: Saudi Arabia (WORKAROUND REQUIRED — a brand-new law in
force 21 Jan 2026, REGA-designated zones only, replacing the old 2000
capital-threshold regime), Qatar (WORKAROUND REQUIRED — Law 16/2018, 9
freehold + 16 usufruct designated zones), Kuwait (RESTRICTED — Law No. 74
of 1979, a non-GCC buyer needs 10 years' residence + Council of Ministers
approval, capped at 1 property/1,000 sqm), China (RESTRICTED — 2006
"Circular 171": self-use only, 1+ year residence/study prerequisite, one
property nationwide, investment purchases banned outright), Hong Kong
(OPEN — the 15% non-resident Buyer's Stamp Duty surcharge was eliminated
28 Feb 2024; every buyer now pays the same scale), Taiwan (WORKAROUND
REQUIRED — Land Act Art. 18-19 reciprocity, Ministry of Interior's list of
~77 countries, with some countries facing extra conditions and four
nationalities barred outright). Same "ready but unreachable until a full
data adapter exists" status as Singapore/Philippines/Malaysia already in
this file — the public free checker (`foreign-buyer-check.html`) shows all
of them regardless, since it reads this file directly and was never gated
by `COUNTRY_ENDPOINTS`; only the PAID per-property report needs the full
adapter to actually apply one. "96/101 countries" copy bumped in the same
3 pages. Building a full adapter (price/tax/closing-cost data, not just
this one rule) for any of these 6 is separate, much larger work — not
started here.

**Fourth batch (Sept 30 2026): 3 more, 62 → 65.** Added Kenya (`WORKAROUND
REQUIRED` — Constitution of Kenya 2010, Sixth Schedule Article 8(1), a
non-citizen's freehold reverts to a 99-year peppercorn leasehold; sourced
via the Embassy of Kenya, Washington DC's own published PDF since the
national legislation portal (new.kenyalaw.org) was unreachable from this
session's network — same egress-block pattern already seen elsewhere in
this file), Bahamas (`OPEN` — International Persons Landholding Act 1993;
an ordinary single-family home/condo purchase is registration-only, no
advance permit, via FAOLEX's copy of the Act since laws.bahamas.gov.bs
wasn't reachable either), and Dominican Republic (`OPEN` — Foreign
Investment Law 16-95 + Real Estate Registration Law 108-05, CEI-RD; equal
treatment for foreign buyers, well-corroborated across many independent
sources though CEI-RD's own site returned a DNS failure from this
session). Researched via a subagent under a strict official-source-only
brief, then cross-checked myself with follow-up searches before writing
anything — this file's honesty bar applies to the verification step
itself, not just the final entry.

**Two more researched and deliberately NOT shipped this batch:** Nigeria
and Ukraine. Nigeria's Land Use Act 1978 has no express foreigner
restriction in its own text; secondary legal-analysis sources disagree
with each other on whether foreigners can hold land at all (one line of
analysis says yes with Governor's consent like any buyer, another says no
foreigner can own land outright) — genuinely unresolved, not just
unreachable, so it stays silent rather than picking a side. Ukraine's Land
Code (Articles 81–82, allowing non-agricultural real estate but not
agricultural land) is well-documented but zakon.rada.gov.ua was blocked
by this session's network egress, and — separately — wartime martial law
has affected the State Land Cadastre's actual operation since Feb 2022;
given both an unverifiable primary source and a genuinely unstable
real-world situation, this one needs a session that can reach the
official portal and re-check current wartime procedure, not a guess from
secondary sources. "60/62/65 countries" copy updated again, in the same
3 pages.

**Fifth batch (Sept 30 2026): 1 more, 65 → 66.** Added Barbados (`OPEN` —
Exchange Control Act, Cap. 71; a non-resident needs prior Central Bank of
Barbados exchange-control permission before completing the purchase, a
routine step the conveyancing attorney handles, not an ownership gate).
Sourced directly from the Central Bank of Barbados' own domain
(centralbank.org.bb) — the strongest sourcing tier this file uses — though
this session's own network egress block prevented a second, independent
fetch of that exact page to double-check it word-for-word.

**Four more researched this batch, deliberately NOT shipped:** Jamaica
(OPEN-looking, but the clearest description found was a Jamaican embassy
page, not Bank of Jamaica's own site — and a repeatedly-claimed "5 acre"
foreign-ownership cap had no official source at all), Uruguay (OPEN
conclusion is very likely correct and consistently reported, but no
specific IMPO/DNR statute citation could be confirmed at all — every
source was a law-firm or property-marketing page), Montenegro
(WORKAROUND-shaped — reciprocity test + border/island/agricultural
exclusions under the Law on Proprietary and Ownership Legal Relations —
but the Official Gazette text itself wasn't directly read this session,
only located), and Albania (OPEN for units, WORKAROUND for land — Law No.
7980 on land, via FAOLEX rather than Albania's own gazette/cadastre
portal). All four have a correct-looking answer backed by consistent
secondary reporting, but none yet clears this file's "verified against
the government's own page" bar — closing that loop (a direct read of
IMPO, the Montenegro gazette PDF, or Albania's ASHK/QBZ) is the concrete
next step for any future batch touching these four. "65/66 countries"
copy updated again, in the same 3 pages.

**Sixth batch (Oct 1 2026): 1 more, 66 → 67 — Monaco, the daily scan's own
unresolved case, closed properly.** The daily data-freshness routine had
twice correctly declined to add Monaco (and Luxembourg) for lack of an
official source, finding only law-firm/property-agency claims of "no
restriction." The user explicitly pushed back ("תחפש בעוד מקורות לגביהם אל
תהיה עצלן" — look harder, don't be lazy) rather than accept that as final.
Monaco: dug past the law-firm layer and found the actual primary basis —
Constitution of Monaco (1962, rev. 2002) Article 32, "L'étranger jouit
dans la Principauté de tous les droits publics et privés qui ne sont pas
formellement réservés aux nationaux" (a foreigner enjoys every public/
private right not formally reserved to nationals), consistently quoted
across independent legal-text mirrors (constituteproject.org, icnl.org,
rightofassembly.info) since legimonaco.mc itself is blocked by this
sandbox's network egress policy (confirmed via direct curl: 403 at the
proxy, not the site's own WAF). Cross-checked against Monaco's
registration-duty schedule (Projet de loi n°884, via conseil-national.mc
search results): an individual buyer pays the standard ~4.5% rate
regardless of nationality; the higher 7.5-10% rate targets opaque
corporate/offshore acquisition structures specifically (the subject of
April 2026's Proposition de loi n°276 on foreign-entity transparency) —
confirming the "no restriction" claim is a real, deliberate policy choice
for individuals, not just an absence of a rule anyone's checked. Added as
`OPEN`. Monaco already has `closingCosts.js`/`propertyTax.js` coverage, so
this goes live immediately (unlike Singapore/Philippines, which are held
for a country not yet in the dropdown). Luxembourg was researched with
the same intensity but came back genuinely murkier, not just under-time:
its Code Civil Article 11 ("L'étranger jouira dans le Luxembourg des
mêmes droits civils que ceux qui sont ou seront accordés aux Luxembourgeois
par les traités de la nation à laquelle cet étranger appartiendra") is
still the literal, unamended 1804 reciprocity clause as of the current
(2023) consolidated Code Civil text — i.e., formally conditioned on a
treaty with the buyer's home country, not an unconditional guarantee like
Monaco's Article 32. Every secondary source still says "no restrictions in
practice," which is very likely true (EU law + Luxembourg's wide treaty
network cover virtually every real buyer), but that's a materially
different, weaker claim than what this file asserts for its `OPEN`
entries elsewhere — so Luxembourg stays unlisted rather than papering over
a real distinction found by looking harder, not proof the first pass was
lazy. "66/67 countries" copy updated in the same 3 pages.

## Monaco: real district-level benchmark wired in, a dead-data bug fixed (Oct 1 2026)

Same conversation, same "don't be lazy" push: the user supplied the exact
official source directly — `imsee.mc`'s Real Estate Observatory (IMSEE =
Institut Monégasque de la Statistique et des Études Économiques, Monaco's
national statistics institute). `imsee.mc` is blocked by this sandbox's
network egress policy exactly like every other `.mc` domain (confirmed via
direct curl: 403 at the proxy's CONNECT tunnel — and, surprisingly, this
same session also saw every other domain, including `example.com`, fail
the same way for a stretch, i.e. a general sandbox-wide outage, not a
Monaco-specific block — re-verify this isn't still the case next session
before assuming `.mc` is uniquely blocked). Pulled the actual 2025 figures
via WebSearch instead, cross-confirmed across multiple independent
secondary reports (monaco-tribune.com, hellomonaco.com, miells.com, two
separate searches) that all cited identical IMSEE numbers: national
average €57,569/m² (−1.4% vs 2024's €58,402), and by quartier — Larvotto
€71,167 (+2.2%, the first district ever to cross €70k), Monte-Carlo
€54,009 (+4.8%), Fontvieille €52,518 (+4.5%), La Condamine €52,104 (−0.7%),
La Rousse €51,265 (+3.2%), Les Moneghetti €43,797 (+3.3%). 2025 was also
IMSEE's first year using a revised methodology (linear regression
combining sales, resales, and construction period).

**Found and fixed a real, consequential bug while wiring this in:** Monaco
already had an IMSEE entry in `api/regional-fixture-intelligence.js`
(built by Claude B, pre-dating this session) with the national average and
a `coverageNote` *mentioning* the district spread in prose — but
`api/orchestrator.js`'s `REGIONAL_FIXTURE_COUNTRIES` branch only ever
applies a benchmark when `raw.cityName` is set and matches the property's
address; Monaco's fixture never set it. The practical effect: **every
single Monaco report, regardless of district, rendered "no official local
price figure for this place yet"** — the €57,569 average was mentioned
only as unused text, never shown as an actual Market Benchmark number.
Given the ~2x spread between Larvotto and Moneghetti, using the blended
national figure as a real benchmark for every address would have been
wrong anyway — so leaving it text-only wasn't itself the bug, but having
real per-district data and not surfacing it for an address that names its
district was.

Fixed properly rather than patched: added a `districts` array (name +
aliases + benchmarkValue + changePercent per quartier) to Monaco's fixture,
threaded it through the API response, and extended
`orchestrator.js`'s shared `REGIONAL_FIXTURE_COUNTRIES` block with a
`districtMatch` step (alias-matching against the property's address/city
field, same idea as `recentAreaFits`) that resolves to the named district's
own figure when the address mentions one (e.g. "Larvotto, Monaco"),
falling back to the pre-existing national-average-as-context behavior
otherwise. This block is shared by ~30 countries (Mexico, Kenya, Canada,
etc.) — the new logic is strictly additive (`raw.districts` is undefined
for every one of them, so `districtMatch` stays null and nothing changes);
verified directly by calling the real handler for Mexico/Kenya/Canada and
confirming `districts: null` and unchanged `cityBenchmarkValue`/
`nationalBenchmarkValue` in each response. Verified for Monaco itself by
calling the real handler with test addresses: "Larvotto, Monaco" →
Larvotto's own 71,167/+2.2%; "10 Avenue Princesse Grace, Monte-Carlo,
Monaco" → Monte-Carlo's 54,009/+4.8%; plain "Monaco" (no district named) →
correctly falls through to the national-average/context-only path,
unchanged from before. The single property-search field on `index.html`
already accepts "address, city or postal code" as free text, so a user or
agent naming the quartier (the normal way Monaco listings are described)
now gets matched automatically — no UI change needed.

## Foreign Buyer Access: full world coverage (Oct 1 2026, 67 -> 190)

After the Monaco episode and the 67->96 sweep of already-supported
countries, the user escalated twice more, explicitly: first "go find
every not-yet-supported country's rule too, not just the gaps in
countries we already serve," then — after correctly refusing to bulk-
import a general reference list of statistics-body names as if it were
verified data — an explicit instruction to cover literally every country
and territory in the world, including unstable/post-conflict/pariah
states, accepting a thin or imperfect entry now (to complete later) over
having none at all, but never a guessed one.

Worked through essentially the entire world in bounded, verified batches
of 5-7 countries at a time, each with the same per-country sourcing
discipline as every earlier entry in this file (a real statute,
constitutional article, or named official body — never invented).
67 -> 190 total entries, in ~25 separate commits on the
`foreign-buyer-monaco` branch so each batch's reasoning stays
attributable. Final status breakdown: 71 OPEN, 81 WORKAROUND REQUIRED, 37
RESTRICTED, 1 TAX SURCHARGE (Singapore).

Regions covered, roughly in the order worked: the original 67->96 gap-fill
(ex-Soviet states, Balkans, Monaco's own neighbors) -> Gulf states, China,
Hong Kong, Taiwan -> Middle East (Jordan, Lebanon, Iraq, Syria, Yemen) and
South Asia (Pakistan, Bangladesh, Nepal) -> Central America and the
Caribbean's early entries -> most of Sub-Saharan Africa, country by
country (West, East, Central, Southern) -> the hardest conflict/pariah
cases (Libya, Sudan, Afghanistan, Somalia, North Korea, Cuba) -> the
Pacific island states (Fiji, Vanuatu, Samoa, Tonga, Solomon Islands,
Palau, Micronesia, Marshall Islands, Nauru) -> the remaining Eastern
Caribbean (Antigua, St Lucia, St Kitts, St Vincent, Grenada, Dominica,
Guyana, Suriname).

**Notable findings from the hardest cases**, worth remembering as a
validated methodology, not just a one-off result: even North Korea had a
real, citable answer (sourced to a Library of Congress Law Library report
on foreigners' property rights, since no NK government legal portal
exists) — "private property is outlawed" is itself a verifiable fact, not
a guess. Same for Somalia, Sudan, South Sudan, and Yemen: the formal legal
position is findable and real, even where (stated explicitly in each of
those entries) the practical, on-the-ground enforceability is a separate
and serious risk given active conflict or collapsed registry
administration. The user's framing — "in the internet age, every country
holds a record" — held up in every single case tried. No sandbox network
block was ever actually hit during this entire sweep (WebSearch alone was
sufficient throughout); the earlier Monaco-era `.mc`-domain WebFetch
blocks turned out not to generalize to this exercise at all.

**What's still open, flagged rather than forced:** Kiribati and Tuvalu
were researched but not added — only generic constitutional-framework and
customary-land-tenure background was found for either, nothing specific
enough to state the actual current foreign-ownership rule without
guessing. A handful of very small dependent territories (e.g. Greenland,
Bermuda, French/UK/US overseas territories with their own distinct legal
regimes separate from their parent state) were not attempted in this
sweep and remain a reasonable next target if the user wants the list
pushed even further. Luxembourg remains deliberately excluded for the
specific, already-documented Code Civil Art. 11 reciprocity-clause reason
(see the earlier batch note above) — not an oversight.

**Reachability note, unchanged from the original Singapore/Philippines
pattern:** any country added here that isn't yet in `api/orchestrator.js`'s
`COUNTRY_ENDPOINTS` (roughly half of what was added in this sweep) shows
immediately on the free public checker (`foreign-buyer-check.html`, which
reads this file directly and was never gated by `COUNTRY_ENDPOINTS`), but
won't yet appear inside an actual paid property report for that country
until a full price/tax/closing-cost data adapter exists — a separate,
much larger undertaking per country (the US alone took ~2 weeks) that
this sweep did not attempt.

**First pass at closing it for already-reachable countries (Oct 1 2026):**
asked to "go back over the countries you added and add data." Diffed
tonight's 190 Foreign Buyer Access additions against `closingCosts.js`/
`propertyTax.js` coverage, restricted to the ~90 of them already in
`COUNTRY_ENDPOINTS` (so the data lands in an actual report immediately,
not just the free checker). UAE/Dubai explicitly excluded per the user's
own instruction — Claude B is working there concurrently. Found and
closed 8 gaps, each sourced the same way as everything else in this file:
Nigeria (closing: Lagos's Governor's Consent + stamp duty + registration
stack, ~3%–3.5%; tax: Lagos Land Use Charge, 0.0394%–0.394% by occupancy
type — both explicitly flagged as state-set, not national, since Nigeria
has no uniform national rate), Paraguay (closing: municipal ITM 0.3%–0.5%
+ registry inscription 0.8%; tax: Impuesto Inmobiliario, a flat 1% of
fiscal value, annually CPI-adjusted), San Marino (closing: imposta di
registro 5% on an ordinary resale, 17% single-phase tax on a new build
from a developer; tax: confirmed as a genuine "none" — no ordinary annual
property tax exists, only one-off extraordinary measures when
specifically legislated), Maldives (closing: 15% land-transfer tax + flat
MVR 500 stamp duty, explicitly caveated that a foreign buyer's real
transaction is a leasehold/unit assignment under project terms, not an
ordinary land transfer; tax: confirmed as a genuine "none" for ordinary
owners), Kosovo (tax only: a brand-new 2026 progressive model, 0.10%–1.50%
by property-use category — no closing-cost entry added, since no specific
transfer-tax rate could be confirmed with confidence).

**Liechtenstein closed out right after, once the user supplied the exact
official page** (llv.li's Land Register page) — llv.li is blocked by this
sandbox's egress proxy exactly like every other domain hit tonight
(confirmed via direct curl: 403 at the CONNECT tunnel), so WebSearch was
used instead, the same technique that worked for Monaco's Constitution
text. Found the actual rate: no German-style Grunderwerbsteuer exists at
all (the only real-estate-specific tax, Grundstücksgewinnsteuer, is a
seller-side capital GAINS tax on resale profit, not a buyer cost) — but a
real, citable Land Register fee does apply: 0.6% (6‰) of the purchase
price, minimum CHF 200, per the actual ordinance (Verordnung vom 11.
Februar 2003 über die Grundbuch- und Handelsregistergebühren, LGBl. 2003
Nr. 67, Annex 1 Section B). No propertyTax.js entry was added for
Liechtenstein, deliberately: its real annual mechanism is a wealth tax on
a person's TOTAL net assets (a notional 4% yield added to income, taxed
at the progressive Erwerbssteuer scale) — not a standalone, property-
specific rate this file's schema can honestly reduce to one number
without being more confusing than helpful.

**Still deliberately left out — researched, not forced:** Tajikistan and
Turkmenistan (multiple searches came back with only vague qualitative
statements — "rates vary," "not detailed in available sources" — with no
actual percentage or official body confirming one; same honesty bar as
every other gap in this file). An `officialOnly()`
filter already in `closingCosts.js` strips any field whose source reads
as non-government (e.g. "Market convention") and nulls the computed
total if it does — caught and fixed for Paraguay during this batch (a
first draft cited the notary-fee split as "Market convention" inside the
total, which silently zeroed the whole total; moved to a plain mention
outside the computed range instead).

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

**Update (Oct 2026): competitor spotted, worth using as a lead — not a
source.** The user found `mendo.ge` advertising in an Israeli real-estate
Telegram group — a free tool specific to Georgia covering: a $150K
real-estate investment-residency threshold, a 5% rental-income tax, a
183-day tax-residency day-counter, and bank-readiness/capital-transfer
pre-checks for Tbilisi/Batumi. This is NOT a source to cite — it's a
competitor's own marketing claims — but it's a strong hint of exactly
which Georgian rules/thresholds are real and worth verifying directly
against Georgia's own official sources (presumably Public Registry/NAPR,
Georgia Revenue Service rs.ge, and whatever law sets the investment-
residency threshold) before adding to `foreignBuyerRules.js` or anywhere
else. If any of these four numbers check out against an official source,
they're fair game to add with that official citation — same as always,
never cite mendo.ge itself as the source.

## For the other session (Claude B): NYC condo/co-op benchmark gap — user calls this launch-blocking (Sept 2026)

**Done by Claude B (Sept 2026)** — see the NYC CONDO / CO-OP note in the US coverage list (option 2 was possible: the DOF roll has a per-unit area).

**Urgent, flagged directly by the user as a launch blocker.** Live end-to-end test
(Sept 2026): analyzed a real Manhattan address (298 E 26th Street, NYC, $1,700,000
asking, ~52 sqm) and paid for the report via Stripe. **Correction after further
investigation the same day: the report the user saw (every field blank, including
Asking Price and Size — screenshotted) was NOT mainly this data gap.** It was a
separate, much bigger bug in `engine.js`'s `refreshFullReportData()`: on the
fresh page load after Stripe's redirect, the analysis form is empty, but
`buildReportData()` (via `getInputs()`) read price/size/country/etc. straight
from those empty DOM fields instead of from the already-cached `property` object
— so literally every field came back null, regardless of country or data
source. Fixed and verified (engine.js now refills the form from the cached
`pradixiumPropertyInputs` before rendering; confirmed via a scripted repro that
`pradixiumReportData` now correctly contains askingPrice/size/gross yield/etc.
after a simulated Stripe return). Also added a retry in `handleCheckoutReturn()`
for the entitlement-visibility race `refreshFullReportData()`'s own comment
already anticipated. See the "silently-blocked report popup" fix above — same
test, same session, a related but distinct bug (that one was about the popup
never opening at all; this one was about the report being blank once it did).

**The real, narrower, still-open gap for your session:** with the above fixed,
a Manhattan condo/co-op report now populates every other section correctly and
only the government market-benchmark row itself stays legitimately empty,
because `api/us-intelligence.js`'s `nycDofSales()` only computes a $/sqft
benchmark for `NYC_HOUSE_CATEGORIES` (1–3 family houses); for condos/co-ops it
deliberately returns `status:'no_unit_area'` with no number, since NYC DOF's
Rolling Sales dataset (`data.cityofnewyork.us/resource/usep-8jbt.json`) doesn't
reliably report gross_square_feet for condo/co-op unit sales — the existing
"never guess" behavior, not a bug in itself. The problem is scope: **condos/co-ops
are the majority of Manhattan's residential market**, and New York is priority #1
in the US expansion list below — so this isn't an edge case, it's the common case
for the #1 metro, and the user is explicit that a thin report on a first purchase
kills repeat business ("הבן אדם יקנה את הדוח פעם וגמרנו").

Two real, honesty-compatible ways to enrich this without fabricating a number
(discussed with the user, not yet built — his call to route this to your session
rather than have this session touch new US data-source work, per the lane split
below):
1. A median-price-**by-unit-type** (studio/1BR/2BR, from bedroom/category fields
   already in the same DOF dataset) as **context**, not feeding the verdict — same
   pattern already used elsewhere in this file for partial/unscreened sources
   (e.g. Florida, RLIS SALEPRICE). Still real, still government-sourced, just not
   per-sqft.
2. Check whether NYC has any other official source with per-unit condo square
   footage (PLUTO is lot-level, not unit-level, and was already considered
   insufficient for this — worth re-verifying rather than assuming). Do not reach
   for a paid third-party source (StreetEasy, PropertyShark, etc.) — ruled out by
   the standing "no third-party data dependencies" rule.

Whichever path, verify before shipping per the usual rule: independent recompute
of at least one figure + screenshot, and say plainly if the data genuinely isn't
there rather than filling the gap with something unverified.

## For the other session (Claude B): `/api/orchestrator` is dangerously slow for US properties — confirmed with real numbers (Sept 2026)

**Also flagged as launch-blocking, with hard data this time (not just a hunch).**
After the blank-report bug above was fixed, a live re-test on a Manhattan address
(3531 3rd Avenue, NYC) still came back with the AI-generated sections (Investment
Highlights, Key Risks, Investor Action, Demand Intelligence) and the government
Market Evidence showing placeholder text, while the property's own numbers
(Asking Price, Size, Rent, Gross Yield) rendered correctly. Pulled real numbers
from Vercel Observability (`vercel.function_invocation.function_duration_ms`,
`max`, grouped by route, prj_4db8toVuFK5mfcaIUGyQid06y9O1, Sept 28 2026
17:00–18:30 UTC) rather than guessing from logs I don't have access to:
- `/api/us-intelligence`: **13,053 ms** max — landing almost exactly on the
  documented `US_BUDGET_MS = 13000` internal cap in `api/us-intelligence.js`.
- `/api/orchestrator` (the full request, including the AI agent step that runs
  *after* that budget): **28,904 ms** max.

So the orchestrator's own internal design (US_BUDGET_MS deliberately protecting
the property's own record over the AI/context enrichment, per your own comment
in that file) is working as intended, but the US property-data-gathering path
itself is slow enough that it's actually consuming its full budget and pushing
total request time toward 30 seconds — dangerously close to common serverless
function ceilings, and a bad first-purchase experience regardless of whether it
technically succeeds. `vercel.json` has no explicit `maxDuration` override for
this route, so it's running on whatever the plan default is.

Not yet investigated (deliberately left to your session, since it's the
US-data-gathering path you own): *why* `/api/us-intelligence` is this slow for a
NYC address specifically — parallelizing sub-queries that currently run
sequentially, caching per-address results, trimming which local-data modules
run for a given address, or raising `US_BUDGET_MS`/adding a `maxDuration` are
all on the table, but should be verified against real timing data (the
Observability query above, or `get_runtime_logs`/`get_runtime_errors` if those
work from your session — they 403'd from this one regardless of `teamId`) rather
than guessed.

**Answer from Claude B (same day):** the 13 s was that address failing to
geocode ("NYC" + no borough — 3531 3rd Ave is in the Bronx), so every lookup
ran to the budget. Fixed (bc940a3, NYC GeoSearch fallback): 3.1 s now, 350 W
57th St 4.7 s. Client side (engine.js, pending the user's approval): paid
refresh timeout 35 → 60 s, 3 attempts, and the report is NOT opened when the
full analysis never arrives (clear "payment saved, tap again" message
instead); `startCheckout` refuses a per-report purchase with no country/
price (a real "|||" purchase exists); vercel.json maxDuration 60 for the
orchestrator.

**The user's own instruction on this:** he asked that this be routed to your
session first; if it doesn't get picked up, this session will fix it directly
rather than leave it open — carefully, to avoid colliding with your work on the
same files. Check `lib/usLocal/*.js` and `api/us-intelligence.js` for what's
already in flight before starting.

## "Pradixium Deal Rating™" — new trademark, renamed from plain "Deal Rating" (Sept 2026)

User asked to add "Reality Check™" and a new "Pradixium Deal Rating™"
trademark to the footer notice (`mockups/index.html`, the "X™, Y™ ... are
trademarks of Pradixium" sentence). Reality Check™ already carried the ™
symbol everywhere in the product (all 7 report languages) — just needed
adding to that footer list. Deal Rating did not — confirmed with the user
and renamed the actual label too, not just the footer claim, so the
trademark isn't a dangling claim for a term nobody sees:
- `report.html`: `lblDealRating` default text + all 7 language-dictionary
  `dealRating:` values → localized per the same convention `scoreCaption`
  already uses (en/de/nl keep the English brand phrase, es/it/pt/fr get
  their existing translated noun + "Pradixium™" appended).
- `index.html`: the free-preview metric box label, "DEAL RATING" →
  "PRADIXIUM DEAL RATING™".
- The underlying rating *values* (Excellent/Good/Fair/Weak/Avoid) are
  unchanged — only the field label changed.
Verified: all 7 language-dictionary replacements confirmed as exact
single matches (not a blind find/replace); rendered in headless Chromium
(English, "Pradixium Deal Rating™: Good" in the Investment Decision
section) — the language-toggle button itself couldn't be exercised in
this sandbox test (it only renders once the AI agent's localized content
is present, not something easy to mock), but the 7 dictionary values were
verified directly in the source, not assumed.

## "Pradixium Business Super Intelligent™" — new trademark naming the existing Business suite (Oct 2026)

Not a new feature — the user's own naming for the whole already-shipped
Business tier suite (white-label branding, API access, bulk/portfolio
analysis, compliance report, business dashboard preview), consistent with
this project's rule of naming a thing only once it's actually built.
`mockups/index.html` ("Business Solutions" landing page):
- The page's `eyebrow` label (small category tag above the H1) changed
  from "Business Solutions" to "Pradixium Business Super Intelligent™" —
  the H1 and body copy are unchanged.
- Added to the page's trademark footer sentence, alongside the existing
  five marks: "...Pradixium Deal Rating™ and Pradixium Business Super
  Intelligent™ are trademarks of Pradixium."
Verified visually in headless Chromium (both the top-of-page eyebrow and
the footer trademark line render correctly) before pushing.

Also reconfirmed while documenting this: the slogan "Don't buy the dream.
Check the reality." was already shipped (Reality Check™ tagline in
`report.html`'s dictionary, and `index.html`'s homepage) — nothing new
needed there.

## Luxembourg closed out, world coverage 190 → 191 (Oct 1 2026)

Luxembourg was the one country this project's own `COUNTRY_ENDPOINTS` list
still lacked a Foreign Buyer Access entry for (flagged in the Sixth batch
note above), specifically because Code civil Article 11's literal text is
still the unamended 1804 reciprocity clause — conditioned on a treaty with
the buyer's home country, not an unconditional guarantee. The user pushed
back on leaving a real, described market out just because the law itself
reads one way on paper ("אנחנו לא מחליטים לגבי החוק רק מציינים עובדה
קיימת" — we're not ruling on the law, just stating an existing fact) and
asked for it to go in, given Luxembourg's real weight as Europe's
wealthiest country per capita and a major financial/commercial real-estate
hub. Took that as a mandate to look harder for the actual current-practice
basis, not to paper over the gap — and found one: Code civil Article 3
(lex rei sitae) subjects an immovable to Luxembourg law regardless of the
owner's nationality, so Article 11's reciprocity clause (which addresses
civil rights generally) was never the operative rule for property-holding
capacity in the first place — the same doctrinal distinction already
confirmed for France (also still carrying an unamended Article 11) via its
own Article 3, which is why France was already listed as OPEN.

The real, institutional confirmation: the Chamber of Deputies' own
scientific research unit (Cellule scientifique) was tasked with studying
whether Luxembourg COULD adopt a Swiss-style "Lex Koller" prior-
authorization regime for non-resident foreign buyers — study CS-2022-DR-029
(March 2024), "Peut-on restreindre l'accès à la propriété immobilière aux
étrangers non-résidents au Luxembourg?". Its own conclusion: such a regime
would likely be incompatible with Luxembourg's legal order (no admissible
justification found) and foreign buyers aren't even a driver of the
housing-price/supply crisis that motivated the question — the clearest
possible confirmation that today's baseline is unrestricted, since the
entire study's premise is "can we add a restriction," not "here is the
restriction that exists." `chd.lu` (the Chamber of Deputies' own domain) is
blocked by this sandbox's network egress proxy like every other `.lu`
government domain tried this session — confirmed via curl, worked around
via WebSearch, same pattern as Monaco/Liechtenstein. Added as `OPEN`, with
the one real carve-out noted in the summary (agricultural/protected land,
not ordinary residential property — same treatment already used for
Norway/Sweden/Brazil/Argentina's agricultural-only restrictions). Luxembourg
already has `closingCosts.js`/`propertyTax.js` coverage, so this is live in
the paid report immediately, not held for a missing data adapter.
"190/191 countries" copy bumped in the same 3 pages (`index.html`,
`foreign-buyer-check.html`, `guides/index.html`). Verified: `node --check`,
`getForeignBuyerRule("luxembourg")`/`listForeignBuyerRules()` tested
directly in Node (191 total, Luxembourg present), and a local server
serving the real `/api/foreign-buyer-rules-list` handler + the actual
`foreign-buyer-check.html` screenshotted in headless Chromium — the
Luxembourg card renders correctly with the OPEN badge, full summary, and a
working source link.

Separately, confirmed (same conversation) that Luxembourg's apartment-price
benchmark the user asked about is NOT a gap — it's been live since a
previous session (`lib/data/luxembourgPrices.json` → `lib/europe/
localPrices.js` → `api/eurostat-hpi-intelligence.js`). Re-verified end to
end in Node: Luxembourg-Ville (€10,269/m², 613 sales) and Esch-sur-Alzette
(€6,427/m², 239 sales) both resolve correctly with real sourced data. The
one real, intentional limitation: only 51 of the 100 communes have 10+
sales in the trailing 12 months; the other 49 correctly return "not enough
sales" rather than a number, per the project's data-honesty rule — not a
bug. Also checked `https://geoportail.lu/en/documentation/eshop/` (sent by
the user): confirmed via WebSearch (the domain itself is proxy-blocked,
same as other `.lu` sites) that it's ACT's (Administration du Cadastre et
de la Topographie) manual commercial order system for maps/cadastral
extracts/GIS layers — not a source of transaction prices, and not an API,
so it doesn't close any open Luxembourg gap; no action taken on it.

## For the other session (Claude B): official API access becomes possible once the company is registered (Oct 1 2026)

The user flagged this for your data-coverage work specifically: several
government/statistics-office data sources we've hit across this project
require a formal API application (not just an open endpoint) — a named,
verifiable requesting organization, sometimes with a registered business
email domain. Right now none of that exists, so every official data
source integrated so far has had to be one reachable without an approval
step. Once the Irish company's registration is finalized (user's own
timeline: launch planned for after Sukkot, company ready "a day or two"
before that), there will be a real registered-company email address to
apply with. His own reasoning, worth remembering when picking which
countries to prioritize for a formal API application: **an Irish
registration is taken seriously** by foreign government data offices —
Ireland's regulatory environment reads as strict/credible internationally
(this is also the stated reason, elsewhere in this file, for not flipping
to a Delaware C-Corp), so an application from a registered Irish entity
should carry more weight than an unregistered individual's request. If
you hit a data source during this work that's gated behind a formal API
application rather than a public endpoint, this is the path forward — not
something to work around with scraping, consistent with the project's
no-third-party/no-scraping rule. No action needed from this session until
the registration is actually confirmed done.

## Entitlement signature collision fix — same-building identical units (Oct 3 2026, PR #41, not yet merged)

Found by this session's own recurring oversight/stress-test routine
(adversarial reasoning over the entitlement-gate code, per that routine's
charter — money-touching code is its highest priority). Two different
units in the same new-build building — same floor plan, so identical
price/size/bedrooms/bathrooms/estimated rent, and an address that's just
the building's street address (no unit number) — produced the exact same
report_signature. Once either unit's report was purchased,
isReportPaid()/checkEntitlement() silently treated the OTHER unit as
already paid for: a real revenue leak (standardized-unit new-build condos
are a common case for this product), not theoretical. This is the exact
scenario the Oct 2026 "fold in address/beds/baths/propertyType/
monthlyRent" fix's own comment already named as its motivating case,
without fully closing it.

Fix: an optional "Unit / Apartment / Floor" field added to the property
form (index.html), threaded into getInputs(), reportSignature(), the
cached property object, and — critically — refreshFullReportData()'s
Stripe-return form refill in engine.js (missing that last one would have
reintroduced a silent "paid report shows as locked" bug after a Stripe
redirect, the exact bug class this routine watches for), plus the
matching server-side signature in api/orchestrator.js. Blank by default,
zero behavior change for houses/single units. Backward compatible: a
midReportSignature()/midSignature fallback (mirroring the existing
legacySignature pattern) keeps every report already purchased under the
current 9-field format recognized — verified with a standalone script
mirroring both join formats before pushing. node --check clean, headless
Chromium screenshot confirms the new field renders correctly in place.
Pushed as PR #41 — not merged, per standing convention, awaiting the
user's review.

## Telegram Ads — ad copy iteration and real campaign numbers (Oct 3 2026)

Follow-up to the campaign setup documented above. English ad text went
through two more revisions same day, each requiring a fresh moderation
review (editing an ad's text resets it to "On Hold," same as a new ad;
targeting stays locked either way): a curiosity-driven version ("That
perfect overseas deal? 9 out of 10 don't survive a Reality Check...") and
then, once FIRST1000 was confirmed live (see above), a version leading
with that real offer ("First 1000 reports free. Real government data, no
sales pitch — see if your deal survives a Reality Check."). Declined the
user's "add an insult to the reader" idea (e.g. "Are you dumb?") — real
risk of moderation rejection for abusive content, and insulting the
audience tends to suppress clicks, not raise them, in direct-response
advertising generally.

Real numbers so far, not promising: the English ad's actual CTR is
~0.11% (2 actions / 1,799 views at the time), well below the ~0.5-1%+
typical benchmark for a well-targeted Telegram channel ad — confirmed via
Supabase (purchases table: zero new purchases since Sept 30) and Vercel
Web Analytics (daily pageviews actually declining Sept 28 to Oct 3:
57,80,38,15,7,0; no referrer bucket cleanly attributable to Telegram,
likely merged into the 39-visitor "no referrer" bucket since Telegram's
in-app browser often strips it). The Hebrew ad only went active Oct 3
(after a slow approval cycle) and had 0 actions at ~40 views as of
Shabbat — too early and confounded by Shabbat timing to read yet.

This session's recommendation to the user, given above: stop scaling
Telegram ad spend (currently 1 TON/day, ~$1.45 — too small a budget to
read real signal from anyway) until the funnel itself is proven. No live
customer has ever been through the complete flow end to end (same gap
flagged earlier in this file, under "Known gaps before a real public
push"). Recommended instead: 5 people from the user's own personal
network who are actually shopping for overseas property right now, each
given the property check for free via FIRST1000, with an explicit ask for
honest feedback afterward — this is the original beachhead plan from the
Go-to-market section above, not yet actually executed. Not acted on by
this session (it's outreach the user does personally); just the
recommendation, given plainly when he asked directly whether the product
itself might be unnecessary — the honest answer given: the underlying
cross-border-property-buying behavior is real and documented (active
Facebook/Telegram communities), but there is no real demand signal for
Pradixium specifically yet either way, because so few real people have
been through the paid flow.

Market research done this session, not yet acted on (reference for a
future session or the user's own outreach), all real/sourced, nothing
invented:
- Dubai investor communities found: Facebook's "Dubai Expat Community"
  (110k+ members, general expat group, not real-estate-specific),
  Meetup's "Real Estate Investors Meetup in Dubai" (522 members) and
  "Networking Behomes Real Estate" (427 members), the curated/private
  "Real Estate Club Dubai," and r/DubaiPropertyHub. No public
  forum/group found specifically for Chinese or European investors in
  Dubai — Chinese buyer activity there runs through WeChat/Weibo, which
  aren't publicly searchable, so nothing invented in that gap.
- Juwai.com (confirmed real and large: 3.3M monthly visitors, 6M+
  listings, 111 countries) is the dominant portal connecting Chinese
  buyers to overseas property, including real, sourced France activity
  (Chinese buyers are the largest foreign-buyer group in the Paris/
  Ile-de-France market, 16%, plus 30+ Bordeaux vineyard purchases in two
  years). It's a paid listing/lead-gen platform for agents/developers
  (~$550/month for its basic "Asia Pro 10" package, 10 listings), not a
  free community — and it markets through WeChat/Weibo, not Telegram/
  Facebook. Confirms the Chinese-buyer market is real and large, but
  doesn't directly fit Pradixium (we sell a service, not a listed
  property) without further checking whether Juwai has a separate
  media/display-ad product rather than a listing package — not yet
  checked.
- A Hebrew-language Telegram travel group, "Kivunim Georgia Batumi
  Tbilisi" (5,662 members, ~200 online) — general Georgia-travel content
  (vacation deals), not real-estate-investor-specific. Flagged by the
  user as a possible future channel for Georgia property outreach; left
  as-is for now, not posted to.

Marketing copy drafted (reusable reference, not yet deployed anywhere): a
short "who actually checks if the price is fair" pitch — broker/friend
conflict-of-interest framing, $30-report-as-insurance framing, ending with
the existing "Don't buy the dream. Check the reality." tagline — in
Hebrew, English, French, German and Spanish. Not yet used in any live ad
or outreach message as of this writing.

## Standing git rule (Oct 4 2026, user's explicit instruction, applies to both sessions): never force-push, always a fresh branch

The daily data-scan routine's original design reused one fixed branch name
(claude/t90-pradiium-foreign-buyer-market-14yv9o), resetting it from main
each run with `git checkout -B ... origin/main` and force-pushing over
whatever was there. On Oct 4 2026 that force-push was blocked by this
session's own safety tooling (flagged as a destructive git operation) --
reasonably so, since force-push is inherently the kind of operation that
can silently destroy someone else's work on a shared branch, even when
in this specific case it would have been safe (a disposable, single-session
scratch branch).

**The user's explicit, standing instruction after this**: never force-push,
never try to work around a block the system puts up on purpose -- a block
is a signal to stop, not a puzzle to route around. Open a brand new branch
with a fresh name instead whenever the old recurring-branch pattern would
need a force-push. This applies to BOTH sessions working this repo (this
one and Claude B's). Practical effect: zero real downside -- every branch
still gets squash-merged into main the same way regardless of its name, so
the only difference is a few more branch names accumulating in GitHub's
branch list over time, which is harmless. The daily-scan routine's prompt
should be treated as updated to "push to a fresh branch each run" rather
than reusing and resetting one fixed name -- if you hit the same fixed-branch
instruction in an older stored routine prompt, follow this note instead.

## iOS app — not started, open question (Oct 4 2026)

User asked if an iOS app for the App Store is feasible. Yes, technically
(Swift/SwiftUI) — but publishing requires things this session genuinely
cannot do: an Apple Developer account ($99/yr, user's own), a Mac with
Xcode to build/sign, and going through Apple's review process. Not yet
clear whether the user has access to a Mac / wants to set up a Developer
account. Revisit when he answers that, before writing any actual code.
