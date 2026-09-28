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
  (Florida DOR SDF+NAL, each new roll — ALL Florida counties from the Census
  county list; 66 of 67 in 2026P: Citrus had no SDF/NAL file, skipped).
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
  undocumented → sales not shown). Comptroller statewide file (86 other
  counties, Assessment_Data_##.dbf) requested by the user by e-mail — the
  online form needs a U.S. address. TDEC "LH_Parcel_FP" is only a ~21k
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
anchor — floor((now − anchor) / 30 days) picks the current cycle — since
there is still no Stripe renewal webhook in this project (same known
limitation already accepted for `subscription`/`business` expiry). Once a
report is spent from the quota it's unlocked for good, same model as a
one-time `report` purchase.

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

**Still not done, still not exhaustive:** ~38 of the 85 dropdown countries
remain silent (correctly — unverified). Continuing this kind of expansion
in bounded, verified batches rather than one unverifiable sweep is the
right pace to keep the honesty bar real; say so plainly if the user wants
the rest pushed further in a future session.

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
