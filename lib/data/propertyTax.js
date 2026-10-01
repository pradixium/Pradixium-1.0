import { readFileSync } from "node:fs";
import path from "node:path";
/* PRADIXIUM™ — Annual Property Tax (Recurring Ownership Cost)
 * The tax an owner pays every year just for holding the property — taxe
 * foncière, IBI, Council Tax, Grundsteuer, ENFIA, Arnona, etc. This is a
 * companion to closingCosts.js (the one-time cost paid at purchase), not
 * a replacement for it — a buyer needs both numbers.
 *
 * Same honesty discipline as every other data source in this project:
 * only countries with a verifiable, citable rate/mechanism are listed.
 * Several of these taxes are NOT a clean percentage of market value —
 * Council Tax (UK) is a flat charge per value band, Grundsteuer (Germany)
 * and the Belgian précompte immobilier multiply an assessed value by a
 * municipal rate that varies too widely for one honest national %, ENFIA
 * (Greece) is a per-m² zone-price formula, and Arnona (Israel) is a
 * per-m²-per-year municipal tariff. Rather than force those into a
 * misleading single percentage, their `rate` field is a plain description
 * of the actual mechanism instead of a number — that is the honest
 * answer, not a hedge.
 *
 * Sources are the relevant tax authority / valuation office / ministry of
 * finance where the rate or mechanism is legally set. These are
 * legal/structural rules, not a market price index — they change far
 * less often than market data, but tax law does change (Germany's 2025
 * Grundsteuer reform, Portugal's non-resident IMT change), so verify
 * before relying on this for a real transaction.
 */
const TAX = {
  france: {
    // shortLabel is what's shown in the UI's short-value slot (the same
    // size used for a plain number elsewhere) — the full rate/rateRange
    // sentence always still appears in the basis text underneath it, so
    // nothing is lost, it's just not crammed into a spot sized for a
    // number.
    shortLabel: "Taxe foncière (commune-set rate)",
    rate: "No flat % — 50% of the cadastral rental value (valeur locative cadastrale) × the municipal/departmental rate voted annually by each commune",
    basis: "Taxe foncière sur les propriétés bâties, owed by whoever owns the property on Jan 1, paid annually regardless of primary/second-home status (unlike the now-abolished taxe d'habitation on primary residences). Rates and the underlying cadastral values vary enormously commune to commune; national average bill was ~€1,125/year in 2026 at unchanged local rates. New builds often get a temporary 2-year exemption set by the commune.",
    source: "Direction Générale des Finances Publiques (DGFiP)",
    sourceUrl: "https://www.impots.gouv.fr/particulier/questions/comment-est-calculee-ma-taxe-fonciere-pourquoi-t-elle-augmente-en-2026"
  },
  spain: {
    shortLabel: "0.4%–1.3% (IBI, municipality-set)",
    rateRange: "0.4%–1.1% (urban) / 0.3%–0.9% (rural) / up to 1.3% (special-characteristics properties)",
    basis: "Impuesto sobre Bienes Inmuebles (IBI) — applied to the valor catastral (an official assessed value, typically below market value) set by the Catastro. Each ayuntamiento sets its own annual rate within these legal min/max bands; large or capital-city municipalities may apply added surcharges up to the special maximum. E.g. Madrid ~0.414% urban, Barcelona ~0.66% in 2026.",
    source: "Ley Reguladora de las Haciendas Locales — administered by each municipal tax office / Dirección General del Catastro",
    sourceUrl: "https://www.boe.es/buscar/act.php?id=BOE-A-2004-4214"
  },
  "united kingdom": {
    shortLabel: "Council Tax (band-based)",
    rate: "Band-based flat charge, not a % of value — England/Scotland use 8 bands (A–H) based on 1 April 1991 values; Wales uses 9 bands (A–I) based on 1 April 2003 values; Northern Ireland uses domestic rates on a 2005 capital value instead of banding",
    basis: "Council Tax is set annually per band by each local authority, not by central government. England's average Band D charge for 2026/27 is £2,392/year, ranging roughly £1,028–£2,765 by council; Band A is 6/9 and Band H is 18/9 of the Band D figure. Single-occupant, empty-home and second-home premiums/discounts vary by council.",
    source: "Valuation Office Agency (VOA) — bands; individual local authorities — annual rate per band",
    sourceUrl: "https://www.gov.uk/council-tax-bands"
  },
  germany: {
    shortLabel: "Grundsteuer (municipality-set)",
    rate: "No flat % — Grundsteuerwert (new assessed value, post-2025 reform) × Steuermesszahl (0.31‰ for single-family/rental-residential/condo property, 0.34‰ for other types) × Hebesatz (municipal multiplier, commonly 200%–967%+, set annually by each municipality)",
    basis: "Grundsteuer B, owed annually by the registered owner as of Jan 1. The Jan 2025 reform replaced the outdated Einheitswert with the new Grundsteuerwert; most states use the federal model above, but Bavaria, Hamburg, Hesse, Lower Saxony and Baden-Württemberg opted for their own area/value-based state models instead. Because the Hebesatz varies so widely by municipality, no single national effective rate can be honestly quoted.",
    source: "Bundesministerium der Finanzen (Federal Ministry of Finance)",
    sourceUrl: "https://www.bundesfinanzministerium.de/Content/DE/FAQ/faq-die-neue-grundsteuer.html"
  },
  italy: {
    shortLabel: "0%–1.06% (IMU; primary residence often exempt)",
    rateRange: "0% (non-luxury primary residence — exempt) / 0.86% base, municipal range 0%–1.06% (second home, investment property, land) / 0.5% base, municipal range 0%–0.6% (luxury primary residence: cadastral categories A/1, A/8, A/9, with a €200/year deduction)",
    basis: "Imposta Municipale Unica (IMU) is calculated on the property's revalued rendita catastale (rendita × 1.05 × a 160 coefficient for residential), not market value. Non-luxury owner-occupied primary residences have been fully IMU-exempt since 2020; each comune sets its own rate within these national bands.",
    source: "Dipartimento delle Finanze — Ministero dell'Economia e delle Finanze (MEF)",
    sourceUrl: "https://www.finanze.gov.it/it/fiscalita/fiscalita-regionale-e-locale/Imposta-municipale-propria-IMU/"
  },
  portugal: {
    // AIMI (a separate wealth-style surtax above a per-owner VPT
    // threshold) is deliberately excluded here — this is the base
    // recurring tax every owner pays, not the surtax that only applies
    // above a high per-owner total assessed-value threshold.
    shortLabel: "0.3%–0.8% (IMI, municipality-set)",
    rateRange: "0.3%–0.45% (urban property; up to 0.5% in exceptional cases) / flat up to 0.8% (rural property)",
    basis: "Imposto Municipal sobre Imóveis (IMI) is levied on the property's Valor Patrimonial Tributário (VPT, the official tax-assessed value, usually well below market value), owed by whoever is registered as owner on Dec 31 of the prior year. Each of Portugal's 308 municipalities sets its own urban rate annually within the band (199 of 308 apply the 0.3% floor for the 2025 tax year, Portal das Finanças).",
    ptImi: true,
    source: "Autoridade Tributária e Aduaneira (AT) — Portal das Finanças",
    sourceUrl: "https://www.portaldasfinancas.gov.pt/pt/menu.action?pai=5261&segId=CD"
  },
  greece: {
    shortLabel: "ENFIA (per-m² zone-based tax)",
    rate: "Not a flat % — the main tax (κύριος φόρος) on each building is a per-m² charge derived from the state-set zone price (τιμή ζώνης) of its location, roughly €2–€13+/m²/year before adjustment, multiplied by coefficients for floor, age, façade/orientation and use; land plots are taxed under a parallel zone-price-based formula. A smaller supplementary tax applies progressively above a per-taxpayer total property-value threshold.",
    basis: "ENFIA (Ενιαίος Φόρος Ιδιοκτησίας Ακινήτων) is owed annually by whoever owns the property as of Jan 1, declared via the E9 form on the myAADE portal; total liability is the sum of the per-building/per-plot main tax across everything the person owns, plus supplementary tax if applicable. Zone prices are set/updated by the Ministry of Finance and can differ block-by-block within the same city.",
    source: "Independent Authority for Public Revenue (ΑΑΔΕ)",
    sourceUrl: "https://www.aade.gr/en/services-information/useful-guides/user-guide-basic-tax-rights-disabled/unified-property-tax-enfia"
  },
  belgium: {
    // The Flanders figure isn't apples-to-apples with the Brussels/
    // Wallonia base rate — Flanders restructured its base rate in its
    // 2018 reform, so don't later "simplify" these into one flat
    // cross-region comparison.
    shortLabel: "Précompte immobilier (region-set)",
    rate: "Not a flat % of market value — indexed cadastral income (revenu cadastral indexé) × a regional base rate (1.25% in Wallonia and Brussels; a differently-structured ~3.97% in Flanders since its 2018 reform) × additional municipal and provincial surcharge multipliers set independently by each commune/province, which can multiply the base tax several-fold",
    basis: "Précompte immobilier / onroerende voorheffing is owed annually by whoever owns the property on Jan 1. The federal government sets and indexes the cadastral income nationally, but each Region sets its own base rate and reductions (e.g. for a sole/primary residence), and municipalities and provinces layer on their own surcharges — so the effective total varies too widely by commune for one honest national figure.",
    source: "SPF Finances / FOD Financiën (federal) with the Walloon, Flemish and Brussels-Capital Regions (base rate) and local authorities (surcharges)",
    sourceUrl: "https://finances.belgium.be/fr/particuliers/habitation/precompte_immobilier"
  },
  "united states": {
    shortLabel: "0.29%–1.88% (varies by state)",
    rateRange: "0.29%–1.88% by state (2026 data); ~0.90% unweighted national average across states",
    basis: "Property tax is set and collected locally (county/municipality/school district) based on the jurisdiction's own assessed value of the property — assessment ratios, reassessment cycles and exemptions (e.g. homestead exemptions) vary by state and even by county, so the effective rate varies hugely even within one state. New Jersey and Illinois tie for the highest state figure (1.88%); Hawaii is lowest (0.29%).",
    source: "Tax Foundation, using U.S. Census Bureau American Community Survey data",
    sourceUrl: "https://taxfoundation.org/data/all/state/property-taxes-by-state-county/"
  },
  israel: {
    shortLabel: "Arnona (per-m² municipal tariff)",
    rate: "Per-m²-per-year municipal tariff, not a % of value — Ministry of Interior sets a national band of ₪41.07–₪142.31 per m²/year for residential property (2026, non-independent local authorities); each municipality then fixes its own actual tariff within that band in its annual arnona order",
    basis: "Arnona (ארנונה) is billed to whoever occupies the property (the owner, if owner-occupied), based on the property's registered square meterage, usually paid in bi-monthly installments; a nationwide automatic 1.626% uplift was applied for 2026. Rates differ substantially city to city — Tel Aviv, Jerusalem and Haifa each publish their own tariff tables (צו ארנונה) and can vary further by neighborhood/zone and use.",
    source: "Israel Ministry of Interior (משרד הפנים) — local-authority arnona tariff regulations",
    sourceUrl: "https://www.gov.il/BlobFolder/guide/tax/he/Guides_local-goverment-criticism_arnona-22-5-25.pdf"
  },
  "united arab emirates": {
    shortLabel: "5% of annual rental value",
    rate: "5% of the property's annual rental value — there is no separate annual property-ownership/wealth tax in Dubai or the wider UAE",
    basis: "Dubai Municipality Housing Fee, billed monthly (1/12 of the 5% annual figure) as a line item on the DEWA electricity/water bill for every DEWA-metered residential unit. For owner-occupiers it's 5% of Dubai Municipality's estimated annual rental value, benchmarked to the RERA Rental Index. UAE nationals are exempt. This is a municipal-services fee, not a tax on ownership or property value, and is entirely separate from the one-time 4% DLD transfer fee paid at purchase.",
    source: "Dubai Municipality, billed/collected in partnership with DEWA (Dubai Electricity & Water Authority)",
    sourceUrl: "https://housingfees.dm.gov.ae/",
    marketAreaNote: "Dubai only — other emirates set their own rules."
  },

  // ---- Added via the weekly country data-coverage scan ----
  austria: {
    shortLabel: "Grundsteuer (municipality-set, Hebesatz)",
    rate: "No flat % — Einheitswert (assessed value, generally well below market value) × Steuermesszahl (graduated statutory tariff) × Hebesatz (municipal multiplier, up to 500%, set annually by each municipality)",
    basis: "Grundsteuer B is owed annually; because the Hebesatz is set independently by each of Austria's ~2,000 municipalities, no honest single national rate exists. Bills under €75/year are paid once (May 15); larger bills are split into quarterly installments.",
    source: "Bundesministerium für Finanzen (BMF)",
    sourceUrl: "https://www.bmf.gv.at/themen/steuern/immobilien-grundstuecke/grundbesitzabgaben-einheitsbewertung/grundsteuer.html"
  },
  netherlands: {
    shortLabel: "OZB (municipality-set, ~0.04%–0.25%)",
    rateRange: "~0.038%–0.25% of the WOZ value (owners' rate) — e.g. Amsterdam ~0.038% (lowest), Appingedam ~0.25% (one of the highest); most municipalities fall between 0.10% and 0.14%",
    basis: "Onroerendezaakbelasting (OZB) is levied by each municipality on the WOZ-waarde (officially assessed value under the Wet WOZ, based on Jan 1 of the prior year); each municipal council sets its own owners'-rate annually — there is no national rate.",
    source: "COELO (Centre for Research on Local Government Economics, University of Groningen) — Atlas van de lokale lasten, compiled from official municipal tariff data",
    sourceUrl: "https://coelo.nl/atlas-lokale-lasten/benchmarks-en-rangnummers/"
  },
  switzerland: {
    shortLabel: "Liegenschaftssteuer (cantonal — several cantons: none)",
    rate: "Not a flat national % — where levied, roughly 0.02%–0.3% of the property's cantonal tax value (generally below market value), set independently per canton/municipality",
    basis: "Liegenschaftssteuer is a cantonal/communal tax charged in addition to ordinary income/wealth tax on real estate. Zürich, Schwyz, Glarus, Zug, Solothurn, Basel-Landschaft and Aargau levy none; Geneva, Vaud, Fribourg, Bern, Valais and others do. Distinct from the Eigenmietwert (imputed rental value, a separate income-tax item Swiss voters decided to abolish in a Dec 2024 referendum, implementation pending).",
    source: "Swiss Federal Tax Administration (ESTV) — Dossier Steuerinformationen",
    sourceUrl: "https://www.estv.admin.ch/dam/estv/de/dokumente/estv/steuersystem/dossier-steuerinformationen/d/d-liegenschaftssteuer.pdf.download.pdf/d-liegenschaftssteuer.pdf"
  },
  denmark: {
    shortLabel: "Grundskyld + Ejendomsværdiskat (two-part)",
    rate: "Two components: (1) Grundskyld — a municipal land tax = the kommune's own rate (2026 range roughly 3.1‰–17.7‰) × 80% of assessed land value; (2) Ejendomsværdiskat — a national tax on the whole property's value (owner-occupiers only) = 0.51% of 80% of assessed value up to a 2026 threshold of DKK 9,007,000, 1.4% above it",
    basis: "Grundskyld is billed and rate-set by the municipality on land value alone; ejendomsværdiskat is a national tax on total property value. The 2024 housing-tax reform replaced the old system with these rates applied to new, higher post-2022 valuations, with a rebate ensuring no owner pays more in total than under the pre-reform rules.",
    source: "Skatteforvaltningen / Vurderingsstyrelsen",
    sourceUrl: "https://www.vurderingsportalen.dk/ejerbolig/boligskat/forstaa-din-boligskat/"
  },
  sweden: {
    shortLabel: "Fastighetsavgift — 0.75%, capped at SEK 10,425/yr (2026)",
    rate: "0.75% of the taxeringsvärde (assessed tax value, ~75% of market value), capped at a fixed SEK 10,425/year for 2026 for a house — the cap binds once assessed value reaches ~SEK 1,390,000. Rental apartment buildings instead pay 0.3%, capped at SEK 1,724/unit. New builds are exempt for 15 years.",
    basis: "Kommunal fastighetsavgift is, despite the name, a national flat/capped charge (not municipality-set), replacing the old uncapped fastighetsskatt for most homes since 2008. Owners 65+ or on sickness/disability compensation get the fee capped at 4% of household income.",
    source: "Skatteverket (Swedish Tax Agency)",
    sourceUrl: "https://www.skatteverket.se/privat/fastigheterochbostad/fastighetsavgiftochfastighetsskatt.4.69ef368911e1304a625800013531.html"
  },
  norway: {
    shortLabel: "Eiendomsskatt (optional, municipality-set, max 0.4%)",
    rate: "Not levied everywhere — eiendomsskatt is optional per kommune. Where charged on residential/holiday property, capped by law at 4‰ (0.4%) of assessed value; e.g. Oslo currently charges 1.7‰.",
    basis: "The Eigedomsskattelova sets the national legal framework and rate ceiling, but each municipality independently decides whether to levy the tax at all, its actual rate within the ceiling, its valuation method, and any basic tax-free deduction.",
    source: "Ministry of Finance (Finansdepartementet) / Eigedomsskattelova; rates set and published by individual municipalities",
    sourceUrl: "https://www.oslo.kommune.no/skatt-og-naring/eiendomsskatt-og-avgift/eiendomsskatt/hvor-mye-skal-du-betale-i-eiendomsskatt/"
  },
  poland: {
    shortLabel: "Podatek od nieruchomości (per-m², municipality-set)",
    rate: "Not a % of value — a per-m² annual charge on floor area, capped nationally for 2026 at PLN 1.25/m²/year for residential space and PLN 35.53/m²/year for business-use space",
    basis: "Podatek od nieruchomości is based on floor area and use, not market value. The Ministry of Finance sets a CPI-indexed national ceiling each year, and each of Poland's ~2,477 gminy then votes its own rate up to that ceiling.",
    source: "Ministerstwo Finansów — Obwieszczenie w sprawie górnych granic stawek kwotowych podatków i opłat lokalnych na 2026 r.",
    sourceUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WMP20250000726"
  },
  "czech republic": {
    shortLabel: "Daň z nemovitých věcí (per-m², municipal coefficient)",
    rate: "Not a % of value — land tax is per-m² cadastral area × a rate by land type; building/unit tax is a base CZK/m² rate (raised ~80% in the Jan 2024 reform) × a municipal coefficient each town can set by ordinance",
    basis: "Daň z nemovitých věcí (Act No. 338/1992 Coll.) is owed by whoever is the registered owner on Jan 1, split into a land component and a buildings/units component. Because both the base rate and the local coefficient vary so widely, no single national percentage is honest.",
    source: "Finanční správa ČR (Czech Financial Administration)",
    sourceUrl: "https://portal.gov.cz/en/rozcestniky/dan-z-nemovitych-veci-RZC-102"
  },
  hungary: {
    shortLabel: "Építményadó (municipality-set; most homes exempt)",
    rate: "Not a % of market value — where a municipality levies it at all, up to a national cap of HUF 1,100/m² or 1.8% of assessed value per year, set locally. Most district/city councils exempt an owner-occupied private residence entirely; where it applies it's typically a commercial-property or above-threshold-size charge.",
    basis: "Építményadó (building tax) is an optional local tax under the Local Taxes Act — each municipality decides whether to levy it at all, and at what rate up to the national ceiling. The large majority of Hungarian municipalities, including most of Budapest, exempt a privately owned residential home outright, so this cannot be honestly reduced to one national number.",
    source: "Nemzeti Jogszabálytár (National Legislation Database) — 1990. évi C. törvény a helyi adókról (Local Taxes Act)",
    sourceUrl: "https://njt.jog.gov.hu/jogszabaly/1990-100-00-00"
  },
  romania: {
    shortLabel: "Impozit pe clădiri (0.08%–0.2%, council-set)",
    rateRange: "0.08%–0.2% (residential, individual owners) / 0.2%–1.3% (non-residential buildings)",
    basis: "Impozitul pe clădiri is set annually by each local council within these national Fiscal Code bands, applied to the building's taxable value. Paid in two installments (Mar 31, Sep 30); up to a 10% early-payment discount available at the local council's option.",
    source: "Ministerul Finanțelor — Codul Fiscal, Titlul IX (Impozite şi taxe locale)",
    sourceUrl: "https://www.mfinante.gov.ro/static/10/Mfp/legislatie/cod_fiscal/titlul_9.htm"
  },
  bulgaria: {
    shortLabel: "Данък върху недвижимите имоти (0.01%–0.45%)",
    rateRange: "0.01%–0.45% (0.1‰–4.5‰ of the official tax-assessed value, set by each municipal council)",
    basis: "Assessed on the property's данъчна оценка (an official assessed value, typically below market price) as of Jan 1; each of Bulgaria's 265 municipalities sets its own rate annually within this national band, due by March 1.",
    source: "Министерство на финансите / Национална агенция за приходите (NRA)",
    sourceUrl: "https://www.minfin.bg/bg/778"
  },
  croatia: {
    shortLabel: "Porez na nekretnine (€0.60–€8.00/m², council-set)",
    rate: "Not a % of value — a flat annual per-m² charge on usable floor area, set by each municipality/city within a national range of €0.60–€8.00/m²/year",
    basis: "New tax in force since 1 Jan 2025, replacing the old holiday-home-only levy. Applies to nearly all residential property EXCEPT a permanent/primary residence (exempt) and units under a long-term lease of 10+ months (exempt).",
    source: "Porezna uprava (Croatian Tax Administration)",
    sourceUrl: "https://porezna-uprava.gov.hr/en/immovable-property-tax_jdp/7490"
  },
  slovakia: {
    shortLabel: "Daň z nehnuteľností (per-m², municipality-set)",
    rate: "Not a % of value — a per-m² annual charge; residential/apartment rates typically run €0.33–€0.66/m²/year, non-residential up to €0.66–€3.33/m²/year",
    basis: "Daň z nehnuteľností (Act No. 582/2004 Z.z.) is set and administered by each municipality within statutory bands, owed by whoever is the registered owner on Jan 1; larger cities apply higher multipliers than small towns.",
    source: "Zákon č. 582/2004 Z. z. o miestnych daniach / Ministerstvo financií SR",
    sourceUrl: "https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2004/582/20091201.html"
  },
  slovenia: {
    shortLabel: "NUSZ (municipality-set, per-m²)",
    rate: "Not a flat % — NUSZ is a municipal compensation charge on either unbuilt land area or a building's floor space, at a per-m² rate each municipality sets by its own ordinance. Slovenia has no separate nationwide ad-valorem property tax.",
    basis: "NUSZ is owed by the direct user of the property (usually the owner), assessed annually by FURS from data each municipality supplies. New owner-built homes can get a 5-year exemption if the owner directly paid the land-preparation costs.",
    source: "Finančna uprava Republike Slovenije (FURS)",
    sourceUrl: "https://www.fu.gov.si/davki_in_druge_dajatve/podrocja/nadomestilo_za_uporabo_stavbnega_zemljisca_nusz/"
  },
  estonia: {
    shortLabel: "Maamaks (0.1%–1%, land only)",
    rateRange: "0.1%–1.0% of the land's taxable value in most municipalities (up to 2% in the maximum permitted case); e.g. Tallinn applies 0.5% for residential-use land and 1% for other-use land",
    basis: "Maamaks (land tax) taxes ONLY the land under a property — the building/apartment itself carries no separate annual property tax in Estonia. Land under a person's own home is generally exempt up to a locally-set area threshold.",
    source: "Maksu- ja Tolliamet (Estonian Tax and Customs Board, EMTA)",
    sourceUrl: "https://www.emta.ee/en/private-client/taxes-and-payment/other-taxes/land-tax"
  },
  latvia: {
    shortLabel: "Nekustamā īpašuma nodoklis (0.2%–3%)",
    rateRange: "0.2%–0.6% (residential land/buildings, typical) up to 1.5%–3% (commercial property, land, or a residential property classified as unfit-for-use)",
    basis: "Nekustamā īpašuma nodoklis (NĪN) is assessed on the property's cadastral value (an official assessed value) as of Jan 1; each local council sets its own rate within the national bands set by the Real Estate Tax Law.",
    source: "Valsts ieņēmumu dienests (VID, State Revenue Service)",
    sourceUrl: "https://www.vid.gov.lv/en/real-estate-tax"
  },
  lithuania: {
    shortLabel: "Nekilnojamojo turto mokestis (mostly 0% below threshold)",
    rate: "Functions as a high-value threshold tax rather than a general annual property tax — a non-taxable amount of at least €450,000 applies per declared primary residence (0.1%–1% only on any excess), and a lower non-taxable band (up to €150,000) applies to other real estate, above which 0.2%–1% tiered rates apply",
    basis: "Levied by VMI, but an ordinary Lithuanian home falls entirely under the thresholds and pays nothing. Municipal councils set the precise rate within the legal bands; thresholds and tiers were restructured effective 2026.",
    source: "Valstybinė mokesčių inspekcija (VMI, State Tax Inspectorate)",
    sourceUrl: "https://www.vmi.lt/evmi/koks-yra-nekilnojamojo-turto-mokes%C4%8Dio-tarifas-"
  },
  malta: {
    shortLabel: "No annual property tax",
    rate: "None — Malta levies no recurring national or municipal tax on property ownership",
    basis: "Unlike most EU states, Malta has no annual property/council tax at all. A distinct, separate charge — ground rent (ċens), typically €40–€250/year — applies only to property built on emphyteutical (leased) land, a private-law land-lease obligation rather than a tax; most freehold property carries no such charge.",
    source: "Office of the Commissioner for Tax and Customs (CFR/MTCA)",
    sourceUrl: "https://mtca.gov.mt/personal-tax/property-taxes/general-information-on-duty"
  },
  cyprus: {
    shortLabel: "No national annual property tax",
    rate: "None at national level — the standalone Immovable Property Tax (based on 1980 assessed values) was abolished from the 2017 tax year onward; no national replacement has been introduced since",
    basis: "Before 2017, IPT was charged at 0.2% of a person's total property holdings at their Jan-1980 assessed value. Some individual municipalities and sewerage boards separately levy their own small local annual charges, but these vary too much by district to state one honest national figure.",
    source: "Department of Lands and Surveys / Cyprus Tax Department",
    sourceUrl: "https://portal.dls.moi.gov.cy/en/"
  },
  serbia: {
    shortLabel: "Porez na imovinu (0.4%–2%, council-set)",
    rateRange: "0.4%–2% (progressive statutory brackets by assessed value)",
    basis: "Porez na imovinu — for individuals, calculated on the property's assessed value as determined by the local tax administration, owed by whoever owns the property on Jan 1. The band is the statutory ceiling; each municipality sets its own actual rate within it.",
    source: "Law on Property Taxes — Tax Administration of Serbia / local tax administrations",
    sourceUrl: "https://www.purs.gov.rs/sr/fizicka-lica/pregled-propisa/zakoni/331/zakon-o-porezima-na-imovinu.html"
  },
  montenegro: {
    shortLabel: "Porez na nepokretnosti (0.25%–1%)",
    rateRange: "0.25%–1% (up to 1.5% for certain secondary/tourist-use properties)",
    basis: "Porez na nepokretnosti, annual, on the property's market value as assessed by the local tax authority; exact rate set by each municipality within the statutory band. Primary-residence owners get a 20% personal reduction plus 10% per household member, capped at 50%.",
    source: "Zakon o porezu na nepokretnosti — Poreska uprava Crne Gore with municipal-level rate-setting",
    sourceUrl: "https://www.gov.me/en/taxadministration"
  },
  "north macedonia": {
    shortLabel: "Данок на имот (0.10%–0.20%)",
    rateRange: "0.10%–0.20%",
    basis: "Данок на имот, annual, on assessed/market value determined by the municipality's own valuation committee; the actual rate within this national band is set annually by each municipal council.",
    source: "Law on Property Taxes — Ministry of Finance of North Macedonia",
    sourceUrl: "https://finance.gov.mk/en-GB/oblasti/danoci-na-imot"
  },
  albania: {
    shortLabel: "Taksa mbi ndertesat (0.05%–0.2%)",
    rateRange: "0.05%–0.2% (residential buildings)",
    basis: "Taksa mbi ndertesat (part of taksa mbi pasurinë e paluajtshme). Since a 2018 reform, calculated from the property's market value (reference price × coefficient × rate × surface area). Owed annually, generally due by April 30.",
    source: "Law on Local Taxes — Ministry of Finance and Economy",
    sourceUrl: "https://financa.gov.al/taksa-mbi-pasurine-e-paluajtshme-e-cila-perbehet-prej-takses-mbi-ndertesat-dhe-takses-mbi-token-bujqesore/"
  },
  andorra: {
    shortLabel: "Foc i lloc (flat per-m², parish-set)",
    rate: "No % of value — 'Foc i lloc' is a flat per-m² municipal charge, averaging roughly €0.75/m² of usable/built surface (varies by parish); a separate vacant-property surcharge of €5.05/m² applies after 2 years' vacancy",
    basis: "Set annually by each of Andorra's 7 comuns (parishes) independently — no single national rate table. Only owners aged 18–65 pay it. The vacant-property surcharge is a national mechanism under Llei 3/2019 (housing law).",
    source: "Set at parish (comú) level; vacant-property surcharge under Llei 3/2019 — Govern d'Andorra",
    sourceUrl: "https://www.govern.ad/"
  },
  georgia: {
    shortLabel: "Income-linked property tax (0.05%–1%)",
    rateRange: "0.05%–0.2% for families with prior-year income under GEL 100,000 / 0.8%–1% for families with income at or above GEL 100,000 (exempt entirely if family income is under GEL 40,000)",
    basis: "An income-linked system: the applicable rate band depends on the owner's household income in the preceding year, applied to the market value of the property at year-end; owners self-declare and pay via the Revenue Service portal, due by Nov 15.",
    source: "Tax Code of Georgia (property tax chapter) — Revenue Service (rs.ge)",
    sourceUrl: "https://www.rs.ge/"
  },
  armenia: {
    shortLabel: "Real-estate tax (0.05%–1.5%, progressive)",
    rateRange: "0.05%–1.5% (progressive by value tier)",
    basis: "Real-estate tax on the cadastral value of the property as assessed by the Cadastre Committee, with minimum value thresholds below which the 0.05% floor rate applies. A 2020 Tax Code reform is being phased in gradually, reaching 100% of the calculated amount starting in 2026.",
    source: "Tax Code of the Republic of Armenia (2020 property-tax reform) — State Committee of the Real Estate Cadastre",
    sourceUrl: "https://www.cadastre.am/en"
  },
  azerbaijan: {
    shortLabel: "Əmlak vergisi (flat per-m² above 30m²)",
    rate: "No % of value — a flat per-m² municipal-tier charge on residential floor area exceeding a 30 m² per-owner exemption: 0.4 AZN/m²/year in Baku; 0.3 AZN/m² in Ganja, Sumgait and Absheron region; 0.2 AZN/m² in other cities/regions; 0.1 AZN/m² in towns of regional subordination",
    basis: "Əmlak vergisi (property tax) under the Tax Code of the Republic of Azerbaijan, applied only to the area of a residential property above the 30 m² exemption threshold per owner.",
    source: "Tax Code of the Republic of Azerbaijan (Vergi Məcəlləsi) — State Tax Service",
    sourceUrl: "https://taxes.gov.az/uploads/2019/VM_new2019.pdf"
  },
  "bosnia and herzegovina": {
    shortLabel: "No unified national tax (entity/canton-set)",
    rate: "Republika Srpska: reported flat ~0.20% of market value annually. Federation of BiH: cantonal — reported as either a per-m² charge or 0.05%–1% of value depending on the canton; owner-occupied primary homes are reportedly untaxed in FBiH. Brčko District: not confirmed.",
    basis: "No unified national property tax law — Republika Srpska has its own uniform-rate law; each of FBiH's 10 cantons legislates independently, a genuine structural fact of Bosnia and Herzegovina's constitution rather than a data gap.",
    source: "Center of Excellence in Finance (CEF, a Southeast-Europe intergovernmental public-finance institute) / entity-level laws — no single national tax authority exists for this",
    sourceUrl: "https://www.cef-see.org/property-taxation-in-bosnia-and-herzegovina-basic-characteristics-2016-04-25"
  },
  ukraine: {
    shortLabel: "Up to 1.5% of minimum wage per m² (council-set, capped)",
    rate: "No flat % of value — each local council sets its own annual rate up to a statutory ceiling of 1.5% of the minimum wage in force on Jan 1 of the reporting year, applied per square meter of taxable area",
    basis: "Податок на нерухоме майно, відмінне від земельної ділянки (Tax Code of Ukraine Art. 266). The first 60 m² of an apartment, 120 m² of a house, or 180 m² combined is exempt — only excess area is taxed.",
    source: "State Tax Service of Ukraine; rate set annually by each local council under Tax Code Art. 266",
    sourceUrl: "https://zakon.rada.gov.ua/laws/show/2755-17"
  },
  moldova: {
    shortLabel: "0.1% baseline (Chișinău ~0.185%, municipality-set)",
    rateRange: "0.1% of the assessed/cadastral value nationally (statutory baseline) — each municipal/local council sets its own annual rate within limits; Chișinău Municipal Council set 0.185% of cadastral value for 2026",
    basis: "Impozitul pe bunurile imobiliare, levied on the cadastral value of residential property as assessed by the territorial cadastral authority. A primary residence occupied by the same owner for the preceding 3 years is exempt.",
    source: "Ministry of Finance of the Republic of Moldova; Fiscal Code, Title VI; local rate set annually by each municipal/local council",
    sourceUrl: "https://www.mf.gov.md/ro/content/modific%C4%83rile-efectuate-%C3%AEn-codul-fiscal-pentru-anul-2026-privind-impozitele-%C8%99i-taxele-locale"
  },
  canada: {
    shortLabel: "0.3%–2.7% (varies by municipality)",
    rateRange: "~0.3%–2.7% of assessed value",
    basis: "Property tax is set annually by each of Canada's ~3,500 municipalities against an assessed value from the province's own assessment authority (e.g. MPAC in Ontario, BC Assessment in BC). The spread is wide — Vancouver ~0.3% vs. Winnipeg/Windsor over 2%.",
    source: "Provincial property assessment authorities (e.g. Municipal Property Assessment Corporation — MPAC)",
    sourceUrl: "https://www.mpac.ca/"
  },
  mexico: {
    shortLabel: "0.05%–1.2% (Predial, municipality-set)",
    rateRange: "0.05%–1.2%, typically 0.1%–0.3% for residential",
    basis: "Predial is levied annually by the municipio on the valor catastral (official cadastral value, usually 30%–60% of market value). Each municipality sets its own rate and offers an early-payment discount (commonly 20–25% in Jan/Feb).",
    source: "Municipal treasuries / cadastres, coordinated nationally under SHCP",
    sourceUrl: "https://www.gob.mx/hacienda"
  },
  bahamas: {
    shortLabel: "Real Property Tax (owner-occupied vs. commercial bands)",
    rate: "Owner-occupied: 0% on the first $300,000; 0.625% on $300,001–$500,000; 1% above $500,000 — capped at $150,000/year total. Commercial/rental: 0.75% up to $500,000, 1% on $500,000–$2,000,000, 1.5% above, no cap. Bahamian-owned vacant land is exempt.",
    basis: "Real Property Tax Act, administered by the Department of Inland Revenue against the property's assessed market value.",
    source: "Bahamas Department of Inland Revenue",
    sourceUrl: "https://inlandrevenue.finance.gov.bs/real-property-tax/"
  },
  "cayman islands": {
    shortLabel: "None — no annual property tax",
    rate: "None. The Cayman Islands levies no annual property tax, income tax, capital gains tax, or wealth tax of any kind.",
    basis: "Government revenue from real estate comes entirely from the one-time Stamp Duty paid at purchase rather than any recurring ownership tax.",
    source: "Cayman Islands Government / Ministry of Finance",
    sourceUrl: "https://www.gov.ky/"
  },
  jamaica: {
    shortLabel: "Progressive by unimproved land value (up to ~1.3%)",
    rateRange: "Flat minimum charge at the lowest value band, rising progressively to roughly 1.3% at the top band (properties valued over J$30 million)",
    basis: "Property tax is levied annually on the unimproved value of the land (excluding buildings), per the National Land Agency's valuation roll, in increasing bands set by the Property Tax Act.",
    source: "Tax Administration Jamaica (TAJ) / National Land Agency",
    sourceUrl: "https://www.jamaicatax.gov.jm/property-tax2/"
  },
  barbados: {
    shortLabel: "Land Tax (0%–1% residential, 0.95% commercial)",
    rateRange: "0% up to BBD 400,000 (residential, effective 1 April 2026), rising progressively to a 1% top band, with an annual cap for owner-occupied homes; 0.95% flat for non-residential/commercial property",
    basis: "Land Tax, levied annually on the improved value (land + buildings) as assessed by the Barbados Land Valuation Division.",
    source: "Barbados Revenue Authority (BRA)",
    sourceUrl: "https://bra.gov.bb/About/Tax-Types/Land-Tax/"
  },
  "trinidad and tobago": {
    shortLabel: "2% of Annual Taxable Value — rollout incomplete",
    rate: "2% of the Annual Taxable Value (ATV) — reduced from 3% by the Property Tax (Amendment) Act 2024, retroactive to 1 January 2024",
    basis: "Land and Building Tax. The Commissioner of Valuations sets each property's Annual Rental Value; ATV = ARV less a 10% statutory deduction, plus a further 50% reduction for owner-occupied residential property. National billing/collection is still being phased in while the Valuation Roll is completed.",
    source: "Trinidad and Tobago Inland Revenue Division / Property Tax Act (Amendment) 2024",
    sourceUrl: "https://www.ird.gov.tt/propertytax/noticeofassessment/faqs"
  },
  "dominican republic": {
    shortLabel: "IPI — 1% above a per-owner exemption threshold",
    rate: "1% on the portion of an individual's aggregate assessed real estate value above an inflation-indexed exemption threshold (RD$10,695,494 / ~US$182,206 for 2026)",
    basis: "Impuesto al Patrimonio Inmobiliario (IPI) — DGII totals the assessed value of all real estate an individual owns; only the excess above the threshold is taxed, paid in two installments.",
    source: "Dirección General de Impuestos Internos (DGII)",
    sourceUrl: "https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/impuestoPatrimonioInmobiliario.aspx"
  },
  "puerto rico": {
    shortLabel: "8.03%–11.83% (CRIM, on a frozen 1957 value)",
    rateRange: "8.03%–11.83%, municipality-set",
    basis: "CRIM (Centro de Recaudación de Ingresos Municipales) applies its rate not to current market value but to a legacy assessed value pegged to 1957 — a sale does NOT trigger reassessment to the purchase price, so the effective burden relative to actual market value is far lower than the nominal rate suggests. Owner-occupied primary residences get an exemption on the first $15,000 of assessed value.",
    source: "Centro de Recaudación de Ingresos Municipales (CRIM)",
    sourceUrl: "https://www.crimpr.net/"
  },
  brazil: {
    shortLabel: "IPTU (0.6%–1.5%, municipality-set)",
    rateRange: "0.6%–1.5% typical residential range (São Paulo: 1% residential / 1.5% non-residential)",
    basis: "IPTU (Imposto Predial e Territorial Urbano) is levied annually on the município's own assessed valor venal (well below market value), owed by whoever owns the property on Jan 1. Each municipality sets its own rate and annual-increase caps.",
    source: "Secretarias Municipais da Fazenda (each municipality); e.g. Prefeitura de São Paulo",
    sourceUrl: "https://prefeitura.sp.gov.br/web/fazenda/w/servicos/iptu/2456"
  },
  argentina: {
    shortLabel: "Impuesto Inmobiliario (province-set)",
    rateRange: "~1%–4.5% (Buenos Aires province, 2026 scale); CABA and other provinces run their own separate scales",
    basis: "Impuesto Inmobiliario is a provincial tax on the jurisdiction's own fiscal assessed value (typically well below market value). Each of Argentina's 23 provinces plus CABA sets its own scale independently — Buenos Aires province is given here as the representative example, not a national figure.",
    source: "Provincial tax authorities (e.g. ARBA for Buenos Aires province)",
    sourceUrl: "https://www.arba.gov.ar/archivos/Publicaciones/leyimpositiva2026.pdf"
  },
  chile: {
    shortLabel: "Contribuciones (0.89%–1.04%, SII avalúo fiscal)",
    rateRange: "0.893% (residential, up to CLP 214,395,361 assessed value) / 1.042% on the excess and on non-residential property — H1 2026",
    basis: "Contribuciones de Bienes Raíces (Impuesto Territorial) is levied on the avalúo fiscal (SII's own assessed value, below market value). Residential properties at/below a national exempt threshold pay nothing. Rates reset with the periodic reavalúo (roughly every 4 years).",
    source: "Servicio de Impuestos Internos (SII)",
    sourceUrl: "https://www.sii.cl/servicios_online/1048-.html"
  },
  colombia: {
    shortLabel: "Predial Unificado (0.5%–1.6%, municipality-set)",
    rateRange: "5–16 per mil (0.5%–1.6%) for developed property; up to 33 per mil (3.3%) for undeveloped urbanizable land",
    basis: "Impuesto Predial Unificado is levied on the avalúo catastral (IGAC's official cadastral value, or a self-declared avalúo). National law sets the band; each municipal council fixes its own rate within it.",
    source: "Ley 44 de 1990, administered by each municipality; cadastral values set by IGAC",
    sourceUrl: "https://www.igac.gov.co/"
  },
  peru: {
    shortLabel: "Predial (0.2%–1%, UIT-tiered)",
    rateRange: "0.2% up to 15 UIT / 0.6% from 15–60 UIT / 1.0% above 60 UIT of assessed value",
    basis: "Impuesto Predial is a progressive, nationally uniform scale under the Ley de Tributación Municipal, applied to the predio's autoavalúo (official land/construction unit values published annually), not market price.",
    source: "Ley de Tributación Municipal (TUO, D.Leg. 776)",
    sourceUrl: "https://www.satt.gob.pe/impuesto-predial"
  },
  uruguay: {
    shortLabel: "Contribución Inmobiliaria (department-set)",
    rate: "Not a flat national % — Montevideo applies a progressive scale of 0.18%–1.80% on valor catastral; each of Uruguay's 19 departments sets its own separate scale",
    basis: "Contribución Inmobiliaria is collected annually by each departmental intendencia. Montevideo's scale is given as the representative example, not a national figure.",
    source: "Intendencia de Montevideo (representative example) — each department sets its own rate",
    sourceUrl: "https://tramites.montevideo.gub.uy/print/pdf/node/23583"
  },
  paraguay: {
    shortLabel: "Impuesto Inmobiliario (1% of fiscal value)",
    rate: "1% of the property's valor fiscal (official assessed value, well below market value)",
    basis: "Impuesto Inmobiliario is levied annually on the valor fiscal set by the Servicio Nacional de Catastro for every urban/rural property; the fiscal-value schedule is revalued periodically by decree and collected by each municipality.",
    source: "Servicio Nacional de Catastro / Ministerio de Economía y Finanzas (MEF)",
    sourceUrl: "https://www.catastro.gov.py/liquidacion_impuestos"
  },
  bolivia: {
    shortLabel: "IPBI (progressive, annually-set scale)",
    rate: "Not a flat % — a progressive bracket scale (illustrative range ~0.35%–1.5%+ by bracket) on the municipal avalúo fiscal; the exact table is republished annually by the Poder Ejecutivo under Ley 843 (Título IV)",
    basis: "IPBI is owed annually by the registered owner on the municipality's own assessed value, not market value; because the rate scale is reissued every year, this should be treated as illustrative/mechanism-only pending the current-year table.",
    source: "Ley 843 (Título IV); annual Resolución Suprema — Ministerio de Economía y Finanzas Públicas",
    sourceUrl: "https://economiayfinanzas.gob.bo/sites/default/files/2021-08/RS_09407_2012.pdf"
  },
  ecuador: {
    shortLabel: "Predial Urbano (0.025%–0.5%, canton-set)",
    rateRange: "0.025%–0.5% (0.25 to 5 per mil) of the assessed cadastral value",
    basis: "Impuesto Predial Urbano is levied on the avalúo catastral (reviewed at least every 2 years). National law (COOTAD) sets the legal min/max band; each cantonal municipality fixes its own rate within it by annual ordinance.",
    source: "COOTAD, administered by each GAD Municipal",
    sourceUrl: "https://gadgualaquiza.gob.ec/x2/wp-content/uploads/2026/01/ORDENANZA-IMPUESTO-PREDIOS-URBANO-2026-2027-signed-signed-signed-signed-signed.pdf"
  },
  australia: {
    shortLabel: "State land tax + council rates",
    rate: "No national rate — each state taxes the unimproved LAND value (not the building) of land you own above its threshold, the home you live in usually exempt; most states add a surcharge for foreign owners; councils levy their own rates",
    basis: "Land tax is assessed on the Valuer-General's land value of all taxable land an owner holds in that state, added together. Council rates are set by each local council on its own valuation — no state-wide figure exists.",
    source: "State and territory revenue offices",
    sourceUrl: "https://www.sro.vic.gov.au/land-tax",
    // the property's own state (from the suburb match): the official land
    // tax schedule + foreign-owner surcharge, checked Oct 1 2026. The tax
    // is on the LAND value (not the price), so no amount is computed.
    // SA and NT: their revenue offices answer 403 to servers → not listed.
    byAuState: {
      "New South Wales": { label: "NSW land tax: 1.6% of land value above $1,075,000 (+ $100); foreign owners 5% surcharge", text: "Revenue NSW, land tax years 2025 onwards: nil up to a combined land value of $1,075,000 (threshold frozen), then $100 + 1.6% of the land value above it; premium rate above $6,571,000: $88,036 + 2%. Surcharge land tax for a foreign person: 5% of the land value of residential land, no threshold, even where ordinary land tax is exempt (4% in 2023–24, 2% in 2018–22).", source: "Revenue NSW", url: "https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/land-tax/surcharge-land-tax/what-is-surcharge-land-tax" },
      "Victoria": { label: "VIC land tax: from $500 a year above $50,000 land value; absentee owners +4%", text: "State Revenue Office Victoria, general rates from the 2024 land tax year: nil below a total taxable land value of $50,000; $500 ($50,000–100,000); $975 ($100,000–300,000); $1,350 + 0.3% above $300,000; $2,250 + 0.6% above $600,000; $4,650 + 0.9% above $1 m; $11,850 + 1.65% above $1.8 m; $31,650 + 2.65% above $3 m. Absentee owner surcharge (a foreign owner not ordinarily resident): 4% of the land value on top (e.g. $13,350 + 4.3% above $300,000).", source: "State Revenue Office Victoria", url: "https://www.sro.vic.gov.au/about-us/rates-and-statistics/current-rates/land-tax-current-rates" },
      "Queensland": { label: "QLD land tax: from $600,000 land value (absentees from $350,000 + 3% surcharge)", text: "Queensland Revenue Office: individuals pay nil below a total taxable land value of $600,000, then $500 + 1¢ per $1 above $600,000; $4,500 + 1.65¢ above $1 m; $37,500 + 1.25¢ above $3 m; $62,500 + 1.75¢ above $5 m; $150,000 + 2.25¢ above $10 m. An absentee (a foreign individual without a permanent visa who does not usually live in Australia) pays from $350,000: $1,450 + 1.7¢ per $1 above $350,000 … plus an absentee surcharge of 3% of (taxable value − $350,000).", source: "Queensland Revenue Office", url: "https://qro.qld.gov.au/land-tax/calculate/absentee/" },
      "Western Australia": { label: "WA land tax: from $300,000 land value; Perth adds MRIT 0.14%", text: "Department of Treasury and Finance WA: nil up to an aggregated taxable land value of $300,000; $300 ($300,001–420,000); $300 + 0.25% above $420,000; $1,750 + 0.9% above $1 m; $8,950 + 1.8% above $1.8 m; $66,550 + 2% above $5 m; $186,550 + 2.67% above $11 m. In the Perth metropolitan region the metropolitan region improvement tax adds 0.14% of the value above $300,000. The department lists no foreign-owner land tax surcharge.", source: "Department of Treasury and Finance WA", url: "https://www.wa.gov.au/organisation/department-of-treasury-and-finance/land-tax-assessment" },
      "Tasmania": { label: "TAS land tax: 0.45% above $125,000 land value (1.5% above $500,000); foreign owners +2%", text: "State Revenue Office Tasmania, rates from 1 July 2025: nil below a total land value of $125,000; $50 + 0.45% of the value above $125,000; $1,737.50 + 1.5% above $500,000. Foreign investor land tax surcharge: 2% of the assessed land value of general land acquired by a foreign person on or after 1 July 2022 (payable even below the land tax threshold).", source: "State Revenue Office Tasmania", url: "https://www.sro.tas.gov.au/land-tax/rates-of-land-tax" },
      "Australian Capital Territory": { label: "ACT land tax on rented homes: $1,778 fixed + 0.54%–1.26% of land value; foreign owners +0.75%", text: "ACT, Taxation Administration (Amounts Payable—Land Tax) Determination 2026 (DI2026-152, from 1 July 2026): fixed charge $1,778 plus a marginal percentage of the land's base value — 0.54% up to $150,000; $810 + 0.64% above $150,000; $1,610 + 1.24% above $275,000; $10,600 + 1.25% above $1 m; $23,100 + 1.26% above $2 m. Foreign ownership surcharge: 0.75% of the base value. (ACT land tax falls on residential land that is rented out, not on a home the owner lives in.)", source: "ACT Government (DI2026-152)", url: "https://legislation.act.gov.au/di/2026-152/" }
    }
  },
  "new zealand": {
    shortLabel: "Council rates (0.2%–0.7%, council-set)",
    rateRange: "~0.2%–0.7% of a property's council-assessed capital/rateable value per year (e.g. ~0.34% in Auckland vs. ~0.69% in Dunedin, 2026 figures)",
    basis: "Council rates are set annually by each of NZ's 78 territorial local authorities under the Local Government (Rating) Act 2002, combining a rate-in-the-dollar on the rateable value with fixed and targeted charges. No national rate, and no separate NZ land tax or capital-gains tax on the family home.",
    source: "Local Government (Rating) Act 2002 — administered by each territorial local authority",
    sourceUrl: "https://www.linz.govt.nz/guidance/property-valuation"
  },
  japan: {
    shortLabel: "Fixed Asset Tax 1.4% + City Planning Tax up to 0.3%",
    rate: "1.4% (Fixed Asset Tax, standard municipal rate) + up to 0.3% (City Planning Tax, only inside designated urbanization-promotion areas)",
    basis: "Both billed annually to whoever owns the property as of Jan 1, based on assessed value from the triennial fixed-asset valuation (not market value). A residential-land reduction taxes the first 200m² of land under a qualifying home at 1/6 assessed value for Fixed Asset Tax and 1/3 for City Planning Tax.",
    source: "Local Tax Act (地方税法) — administered by each municipality",
    sourceUrl: "https://www.jetro.go.jp/en/invest/setting_up/section3/page8.html"
  },
  "south korea": {
    shortLabel: "Property Tax 0.1%–0.4% + CRET above ₩900M",
    rateRange: "0.1%–0.4% (Property Tax, progressive municipal tax on the government-assessed 'standard market price', typically 60–70% of actual value) + an additional national Comprehensive Real Estate Tax, progressively 0.5%–5%, on assessed holdings above ₩900M (₩1.2B for a taxpayer's sole home)",
    basis: "Property Tax is billed annually to whoever owns real estate as of June 1, plus a Local Education Tax surtax of 20% of the property-tax amount. CRET is a separate national tax that only higher-value holdings incur.",
    source: "Local Tax Act (property tax); Gross Real Estate Tax Act (CRET) — National Tax Service",
    sourceUrl: "https://www.nts.go.kr/english/index.do"
  },
  india: {
    shortLabel: "Municipal property tax (city-set method & rate)",
    rate: "No national rate — each Municipal Corporation sets its own method and rate: Annual Rental Value (e.g. Chennai, Hyderabad), Capital Value System (e.g. Mumbai), or Unit Area Value System (e.g. Delhi, Bengaluru, Kolkata). An effective annual bill commonly works out to roughly 0.1%–2% of the property's value, but there's no single statutory percentage.",
    basis: "Property tax is a municipal tax under each state's own Municipal Corporation Act — the largest source of municipal own-revenue in Indian cities. Rates, exemptions and rebates are set locally.",
    source: "State Municipal Corporation Acts, administered by each city's municipal corporation",
    sourceUrl: "https://mcdonline.nic.in/"
  },
  indonesia: {
    shortLabel: "PBB (land & building tax), up to 0.5%",
    rateRange: "Up to 0.5% (national ceiling; each regional government sets its own rate at or below this)",
    basis: "Pajak Bumi dan Bangunan (PBB) — annual tax on the assessed sale value (NJOP) of land/buildings, typically set below market value. Since 2014 decentralization, PBB for rural/urban property is collected by each regency/city government; the 0.5% ceiling was set by the 2022 HKPD Law.",
    source: "Law No. 1 of 2022 (HKPD Law), administered locally by each regional tax office (Bapenda)",
    sourceUrl: "https://www.pajak.go.id/en"
  },
  thailand: {
    shortLabel: "Land and Building Tax, 0.02%–0.10% (residential)",
    rateRange: "0.02%–0.10% for residential property under the current Royal Decree rates (well below the Act's 0.3% statutory ceiling); an individual's owner-occupied primary home is exempt on the first THB 50 million of appraised value",
    basis: "Land and Building Tax, effective 2020, assessed on the Treasury Department's official appraised value and billed annually by the local administrative organization. The Land and Building Tax Act B.E. 2562 (2019) sets ceilings of 0.3% residential / 1.2% commercial, but the government has repeatedly issued Royal Decrees setting actual rates far lower.",
    source: "Land and Building Tax Act B.E. 2562 (2019) — Ministry of Finance",
    sourceUrl: "https://www.mof.go.th/en/"
  },
  vietnam: {
    shortLabel: "Non-agricultural land use tax, 0.03%–0.15% (land only)",
    rateRange: "0.03% (within the local residential land-use quota) / 0.07% (up to 3× the quota) / 0.15% (beyond 3×) — land only; Vietnam has no separate annual tax on the building/house itself",
    basis: "Non-agricultural Land Use Tax, assessed annually on land area × the province's own periodically-published land price table (not market value or transaction price), owed by whoever holds the land-use rights.",
    source: "Law on Non-Agricultural Land Use Tax (2010) — General Department of Taxation, Ministry of Finance",
    sourceUrl: "https://gdt.gov.vn/"
  },
  cambodia: {
    shortLabel: "Property Tax, 0.1% (above ~US$25,000 threshold)",
    rate: "0.1%",
    basis: "Applies annually to land, houses and other buildings in Phnom Penh and other cities/provincial towns whose assessed value exceeds KHR 100 million (~US$25,000); the tax base is 80% of assessed value less that threshold. A separate, higher Unused Land Tax applies instead to vacant/undeveloped land.",
    source: "Prakas No. 493 MEF.PrK (2010) — General Department of Taxation, Ministry of Economy and Finance",
    sourceUrl: "https://www.tax.gov.kh/en"
  },
  finland: {
    shortLabel: "Kiinteistövero (municipality-set, 0.41%–2.00%)",
    rateRange: "0.41%–1.00% (permanent/primary residential building) / 0.93%–2.00% (general rate — other buildings) / 1.30%–2.00% (land)",
    basis: "Kiinteistövero is levied on the property's taxable value (verotusarvo, a Tax Administration assessment generally below market value) as of Jan 1. Each municipality sets its own rate annually within these statutory national bands (in force 2024–2026).",
    source: "Finnish Tax Administration (Vero) / municipal councils",
    sourceUrl: "https://www.vero.fi/henkiloasiakkaat/omaisuus/kiinteistovero/kiinteiston-arvo-ja-kiinteistoveroprosentit/kiinteistoveroprosentit/"
  },
  ireland: {
    shortLabel: "Local Property Tax (LPT) — band-based, ~0.09%–0.3%",
    rate: "Band-based, not a flat % below €1.26m — the 2026 base rate is 0.0906% of the property's own market-value band (bands re-set every few years; the 2026–2030 valuations use 1 Nov 2025 values, all bands widened 20%). Above €1.26m: 0.0906% on the first €1.26m + 0.25% on the portion between €1.26m and €2.1m + 0.3% above €2.1m. Local authorities may also apply a Local Adjustment Factor of up to ±25% on top of the base rate.",
    basis: "LPT is a self-assessed annual charge on residential property based on its own valuation band, owed by whoever owns it on the liability date; the Finance (Local Property Tax) (Amendment) Act 2025 set the current structure.",
    source: "Revenue (Irish Tax and Customs)",
    sourceUrl: "https://www.revenue.ie/en/property/local-property-tax/valuing-your-property/valuation-bands-rates.aspx"
  },
  luxembourg: {
    shortLabel: "Impôt foncier (very low, municipality-set multiplier)",
    rate: "No flat % — a 1941-era assessed rental value (valeur unitaire, rarely reindexed since) × a statutory assessment rate (taux d'assiette) × a municipal multiplier (taux communal, set annually per commune, typically 200%–800% — e.g. ~750% in Luxembourg City). The result is usually only tens to a few hundred euros a year for an average home — among the lowest recurring property taxes in Europe.",
    basis: "Impôt foncier is billed annually by the commune where the property sits, owed by the registered owner. A reform overhauling the valuation base has been legislated but isn't due to be billed before 2027 at the earliest, so the old 1941-based system still applies through 2026.",
    source: "Administration des contributions directes (ACD) / Ministère des Finances",
    sourceUrl: "https://impotsdirects.public.lu/fr/az/i/impot_fonci.html"
  },
  iceland: {
    shortLabel: "Fasteignaskattur (municipality-set, up to 0.5%)",
    rate: "Up to 0.5% of the property's fasteignamat (official assessed value) for residential housing — a statutory ceiling; each municipality sets its own actual rate up to that cap (a separate, higher cap of up to 1.32% applies to commercial property).",
    basis: "Fasteignaskattur is billed annually by the municipality, based on the nationally produced fasteignamat valuation, owed by the registered owner.",
    source: "Lög um tekjustofna sveitarfélaga nr. 4/1995 (Municipal Revenue Sources Act) — Alþingi",
    sourceUrl: "https://www.althingi.is/lagas/nuna/1995004.html"
  },
  monaco: {
    shortLabel: "No annual property tax",
    rate: "None — Monaco levies no annual property tax, housing tax, or wealth tax on real estate. Ownership carries no recurring government levy on the property itself (only condominium/service charges apply). Caveat: a French national resident in Monaco remains subject to French tax rules under the 1963 France–Monaco bilateral convention.",
    basis: "Confirmed on Monaco's official public-services portal, which states plainly there is no wealth tax, annual property tax, or council-tax equivalent in the Principality.",
    source: "Gouvernement Princier de Monaco — Monservicepublic",
    sourceUrl: "https://monservicepublic.gouv.mc/en/themes/tax/information/general-information/tax-in-monaco"
  },
  belarus: {
    shortLabel: "Real Estate Tax — 0.1% (individuals)",
    rate: "0.1%",
    basis: "Налог на недвижимость, on the cadastral value of residential property, owed by individual owners; local Councils of Deputies may adjust the rate (generally not more than 2x) — this adjustment cannot be applied to apartments/rooms in multi-unit buildings.",
    source: "Ministry of Taxes and Duties of the Republic of Belarus (nalog.gov.by)",
    sourceUrl: "https://nalog.gov.by/individuals/property_taxation/real_estate_taxation/10015/"
  },
  russia: {
    shortLabel: "Налог на имущество — 0.1%–2% (cadastral value)",
    rateRange: "0.1% standard (houses, apartments, rooms, garages) — municipalities may raise it up to 3x or cut it to 0% / up to 0.5% for other property types / up to 2% for premium commercial-type objects or property valued over RUB 300 million",
    basis: "Налог на имущество физических лиц (Tax Code Ch. 32), on the property's cadastral value; municipalities (or the Moscow/St. Petersburg/Sevastopol legislatures) set the actual local rate within these statutory bands.",
    source: "Federal Tax Service of Russia (ФНС России)",
    sourceUrl: "https://www.nalog.gov.ru/rn77/taxation/taxes/nnifz/"
  },
  kazakhstan: {
    shortLabel: "Individual property tax — 0.05%–2% (progressive)",
    rateRange: "0.05% (properties valued up to ~KZT 2 million) rising progressively to 2% (highest-value residential property); legal entities instead pay a flat 1.5% on net book value",
    basis: "Individual property tax (merged with the former separate land tax since 2020), assessed on the state-appraised value under the Tax Code, with an optional local 'luxury coefficient' (up to +50%) added for 2026; local maslikhats can further adjust rates.",
    source: "Tax Code of the Republic of Kazakhstan — State Revenue Committee, Ministry of Finance (kgd.gov.kz)",
    sourceUrl: "https://kgd.gov.kz/en"
  },
  kyrgyzstan: {
    shortLabel: "Flat per-m² charge (Bishkek: 75 KGS/m²/yr)",
    rate: "Not a % of value — since a 2024/2025 reform, tax = floor area × a flat sum-per-m² rate set for each locality (Bishkek: 75 KGS/m²/year); the first 80 m² of an apartment or 150 m² of a house is exempt.",
    basis: "Налог на имущество on residential buildings/premises, administered by the State Tax Service, replacing an older market-price/materials/age-based formula.",
    source: "State Tax Service under the Ministry of Finance of the Kyrgyz Republic (sti.gov.kg)",
    sourceUrl: "https://sti.gov.kg/"
  },
  uzbekistan: {
    shortLabel: "Property tax — 0.36%–2% (cadastral value)",
    rateRange: "0.36% / 0.48% / 0.64% / 1.5% depending on the property's declared use and type for most residential real estate — up to 2% cited for certain categories; local Kengashes may apply a 0.7–1.3 coefficient",
    basis: "Individual property tax under the Tax Code, on the property's cadastral value (minimum taxable base UZS 42 million); rates/coefficients are revised almost annually as part of the government's budget-and-tax-policy directions.",
    source: "Tax Committee of the Republic of Uzbekistan (soliq.uz) / Government portal (gov.uz)",
    sourceUrl: "https://gov.uz/ru/advice/70/document/1329"
  },
  // Oct 1 2026: gaps found by diffing tonight's Foreign Buyer Access
  // additions against this file's existing coverage, then researched to
  // the same bar as every other entry here.
  nigeria: {
    shortLabel: "Land Use Charge (Lagos): 0.0394%–0.394%",
    rateRange: "0.0394% owner-occupied residential / 0.132% residential let to a third party or mixed-use / 0.394% commercial",
    basis: "Land Use Charge (LUC), an annual charge on the assessed market value of real property in Lagos State — the dominant, most-cited example of the broader Nigerian pattern of state-level, not federal, annual property charges, so the exact mechanism and rate differ by state. Early-payment and owner-occupancy reliefs (e.g. a discount for paying before the due date) are available on application, not automatic. A 2026 reform also added a 100% surcharge on undeveloped plots to discourage land-banking.",
    source: "Lagos State Government — Land Use Charge Law",
    sourceUrl: "https://lagosstate.gov.ng/"
  },
  paraguay: {
    shortLabel: "Impuesto Inmobiliario: 1% of fiscal value",
    rate: "1% of the property's fiscal (cadastral) valuation — the general national rate set by law, collected by the municipality where the property sits",
    basis: "Impuesto Inmobiliario, assessed on the fiscal value (valor fiscal) of urban property (per m²) or rural property (per hectare), not market value. Fiscal values are adjusted annually by the Executive based on the Central Bank's CPI figure for the preceding 12 months (a 4.1% adjustment was set for 2026).",
    source: "Paraguayan municipal tax legislation (Ordenanza General de Tributos Municipales); Banco Central del Paraguay (fiscal-value adjustment)",
    sourceUrl: "https://www.hacienda.gov.py/"
  },
  "san marino": {
    shortLabel: "No ordinary annual property tax",
    rate: "San Marino has no recurring annual property tax (no equivalent of Italy's IMU) — real estate is subject only to one-off/extraordinary taxes when the government specifically legislates one (e.g. a 2018 extraordinary real-estate tax assessed against end-2017 cadastral records), not a standing yearly charge.",
    basis: "Confirmed absence of an ordinary wealth/property tax in San Marino's tax system, which instead relies on a single-phase consumption tax (in place of VAT) and targeted extraordinary measures.",
    source: "Repubblica di San Marino — tax legislation (Decreti Delegati)",
    sourceUrl: "https://www.consigliograndeegenerale.sm/"
  },
  maldives: {
    shortLabel: "No annual property tax",
    rate: "No annual property tax applies to an ordinary property owner in the Maldives. A separate, unrelated charge — tourism land rent — applies only to islands/plots leased from the government for operating a tourist resort, priced per sqm of leased land, not relevant to ordinary residential ownership.",
    basis: "Confirmed absence of a general annual property tax in the Maldivian tax system as administered by MIRA; rental income itself (not ownership) is instead subject to a 10% withholding tax.",
    source: "Maldives Inland Revenue Authority (MIRA)",
    sourceUrl: "https://www.mira.gov.mv/"
  },
  kosovo: {
    shortLabel: "Property tax: 0.10%–1.50% (progressive, by use)",
    rateRange: "Primary residence 0.10%–0.60% (first €15,000 of assessed value deducted); secondary residence 0.20%–1.00%; commercial property 0.40%–1.50%; agricultural land a flat 0.10%",
    basis: "Annual property tax under a progressive model introduced for 2026 (replacing the previous flat-rate system), assessed on the property's market value as determined by the municipality; the exact rate within each band is set by the municipality, so two otherwise-identical properties in different municipalities can owe different amounts.",
    source: "Tax Administration of Kosovo (ATK) — Property Tax Department",
    sourceUrl: "https://www.atk-ks.org/"
  }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

let imi;
function ptImiRate(municipality, nuts3) {
  if (imi === undefined) { try { imi = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "portugalImi.json"), "utf8")); } catch { imi = null; } }
  if (!imi || !municipality) return null;
  const n = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const code = imi.byName[n(municipality)] || imi.byName[n(`${municipality} ${nuts3 || ""}`)];
  return code ? { ...imi.municipalities[code], year: imi.year, source: imi.source, sourceUrl: imi.sourceUrl } : null;
}

export function getPropertyTax(country, { state, municipality, nuts3 } = {}) {
  const entry = TAX[normalizeCountry(country)];
  if (!entry) return null;
  const { byAuState, ptImi, ...out } = entry;
  // Portugal: the property's own municipality's IMI rate (AT's published list)
  const m = ptImi ? ptImiRate(municipality, nuts3) : null;
  if (m) {
    const t = (x) => `${Number(x.toFixed(3))}%`;
    if (m.urban != null) return { ...out, shortLabel: `IMI ${t(m.urban)} of the VPT (${municipality})`, rate: `${municipality}: ${t(m.urban)} a year on urban property (rural ${t(m.rural)}), tax year ${m.year} — on the VPT (the tax-assessed value, usually below the market price), not the price`, source: m.source, sourceUrl: m.sourceUrl };
    out.basis = `${out.basis} ${municipality} sets its IMI rate per parish — see the Portal das Finanças list for the parish.`;
  }
  const st = byAuState && state ? byAuState[state] : null;
  if (st) return { ...out, shortLabel: st.label, rate: st.text, basis: "Assessed on the Valuer-General's land value (the land only, not the building) of all taxable land the owner holds in the state; a home the owner lives in is usually exempt from ordinary land tax. Council rates come on top and are set by each council.", source: st.source, sourceUrl: st.url };
  if (byAuState && state) out.basis = `${out.basis} ${state}'s land tax schedule could not be read from its revenue office here — check it there.`;
  return out;
}
