/* PRADIXIUM™ — Estimated Taxes & Closing Costs
 * What a buyer actually pays on top of the asking price: transfer tax /
 * stamp duty, notary or legal fees, registration fees, and the market
 * convention for who pays the agency commission. Same honesty discipline
 * as every other data source in this project: only countries with a
 * verifiable, citable rate are listed — every other country stays silent
 * rather than guessing.
 *
 * Most of these taxes are tiered by region, property value bracket, or
 * residency status rather than one flat national number (Spain's ITP
 * varies by autonomous community, Germany's Grunderwerbsteuer by state,
 * the UK's SDLT by price band, Belgium's registration duty by region and
 * whether it's a sole/primary residence). Rather than assert a single
 * misleadingly precise figure, each entry gives the real range and says
 * what it depends on — a range is the honest answer here, not a hedge.
 *
 * Sources are the relevant tax authority / notary body / national bar
 * association where the rate is legally set, or a citable industry-
 * convention figure (e.g. agency commission %) where it isn't. These are
 * legal/structural rates, not a market price index — they change far
 * less often, but tax law does change, so verify before relying on it
 * for a real transaction.
 */
const COSTS = {
  // Sept 30 2026: verified against the tax authority / land registry itself
  "south africa": {
    transferTax: { rateRange: "0%–13% (marginal brackets)", basis: "Transfer duty from 1 April 2026: 0% up to R1,210,000; 3% of the value above R1,210,000; R13,614 + 6% above R1,663,800; R53,544 + 8% above R2,329,300; R106,784 + 11% above R2,994,800; R1,241,456 + 13% above R13,310,000.", source: "South African Revenue Service (SARS) — Transfer duty rates" },
    totalEstimatedRange: "Transfer duty per the brackets above, plus conveyancing and Deeds Office fees (not included here)",
    sourceUrl: "https://www.sars.gov.za/tax-rates/transfer-duty/"
  },
  kenya: {
    transferTax: { rateRange: "2% or 4% of the property's value", basis: "Stamp duty on a transfer of land, as listed in the Ministry of Lands' service charter (registration of transfers, April 2025).", source: "Ministry of Lands, Public Works, Housing and Urban Development (Kenya) — Service Charter" },
    registrationFees: { rate: "KSh 1,000", basis: "Registration fee for a transfer (same service charter).", source: "Ministry of Lands (Kenya) — Service Charter" },
    totalEstimatedRange: "2%–4% stamp duty + KSh 1,000 registration, plus valuation and legal fees (not included here)",
    sourceUrl: "https://lands.go.ke/sites/default/files/2025-04/SDLPP%20English%20Service%20Charter.pdf"
  },
  morocco: {
    transferTax: { rate: "4%", basis: "Droits d'enregistrement on the purchase of built premises (home, commercial, office), including their land up to 5× the built area (CGI 2026, art. 133-I-F-1°); bare land 5% (art. 133-I-G); first sale of social / low-value housing 3% (art. 133-I-B-7°).", source: "Direction Générale des Impôts — Code Général des Impôts 2026" },
    registrationFees: { rate: "1.5% + 100 DH per property (minimum 500 DH)", basis: "Droits de conservation foncière (ad valorem) to register the transfer on the land title.", source: "ANCFCC — Tarifs des droits de Conservation Foncière" },
    totalEstimatedRange: "About 5.5% of the price (registration duty plus land registry fee, see above), plus notary/adoul fees (not included here)",
    sourceUrl: "https://www.tax.gov.ma/"
  },
  france: {
    transferTax: { rateRange: "5.1%–6.3%", basis: "Droits de mutation à titre onéreux (DMTO), on resale property — set per département; new-build (VEFA) instead carries 20% VAT with a reduced 0.7% DMTO.", source: "French General Tax Code / départemental rate votes" },
    notaryFees: { rateRange: "7%–8.5% total (incl. transfer tax) on resale, ~2%–3% on new-build", basis: "\"Frais de notaire\" bundles the transfer tax above with the notary's own regulated fee and disbursements — it is not an extra cost on top of the transfer tax, but the commonly quoted all-in figure.", source: "Conseil supérieur du notariat" },
    agencyCommission: { rateRange: "4%–8%", typicalPayer: "Seller (built into the listing price) — occasionally split", source: "Market convention" },
    totalEstimatedRange: "7%–8.5% of price (resale, agency fee usually already in the asking price)",
    sourceUrl: "https://www.impots.gouv.fr/"
  },
  spain: {
    transferTax: { rateRange: "6%–13%", basis: "Impuesto de Transmisiones Patrimoniales (ITP) on resale property — set per autonomous community, often reduced for primary residence or below a value threshold; new-build instead carries 10% VAT (IVA) + 0.5%–1.5% stamp duty (AJD).", source: "Regional tax agencies (per Comunidad Autónoma)" },
    notaryFees: { rateRange: "0.2%–0.5%", basis: "State-regulated scale — the same for every notary nationwide.", source: "Colegio Notarial / Arancel Notarial" },
    registrationFees: { rateRange: "0.1%–0.25%", basis: "Land Registry (Registro de la Propiedad) inscription.", source: "Colegio de Registradores" },
    agencyCommission: { rateRange: "3%–6%", typicalPayer: "Seller — occasionally split", source: "Market convention" },
    totalEstimatedRange: "8%–13% of price (resale)",
    sourceUrl: "https://sede.agenciatributaria.gob.es/"
  },
  "united kingdom": {
    transferTax: { rateRange: "0%–17% (tiered)", basis: "Stamp Duty Land Tax (SDLT), England/Northern Ireland — 0% up to £125,000, 2% to £250,000, 5% to £925,000, 10% to £1.5m, 12% above; +5pp surcharge on an additional property; +2pp non-UK-resident surcharge. Scotland (LBTT) and Wales (LTT) use their own separate bands.", source: "HM Revenue & Customs" },
    legalFees: { rateRange: "£850–£1,500 flat (typical), rarely percentage-based", basis: "Conveyancing solicitor fees.", source: "Law Society market guidance" },
    agencyCommission: { rateRange: "1%–3%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "SDLT band + ~£2,000–£3,000 legal/survey costs (varies hugely by price band and buyer residency status)",
    sourceUrl: "https://www.gov.uk/stamp-duty-land-tax",
    // the property's own nation (from the matched UK HPI area code)
    byNation: {
      Scotland: { transferTax: { rateRange: "0%–12% (tiered)", basis: "Land and Buildings Transaction Tax (LBTT), residential, from 1 April 2021: 0% up to £145,000, 2% to £250,000, 5% to £325,000, 10% to £750,000, 12% above; first-time buyers' nil band £175,000; Additional Dwelling Supplement 8% of the whole price on an additional home (from 5 Dec 2024).", source: "Revenue Scotland" },
        totalEstimatedRange: "LBTT band (+8% ADS on an additional home) + solicitor and survey costs", sourceUrl: "https://revenue.scot/taxes/land-buildings-transaction-tax/residential-property" },
      Wales: { transferTax: { rateRange: "0%–12% main rates (5%–17% higher rates)", basis: "Land Transaction Tax (LTT), main residential rates from 10 Oct 2022: 0% up to £225,000, 6% to £400,000, 7.5% to £750,000, 10% to £1.5m, 12% above; higher residential rates (e.g. an additional home) from 11 Dec 2024: 5% up to £180,000, 8.5% to £250,000, 10% to £400,000, 12.5% to £750,000, 15% to £1.5m, 17% above.", source: "Welsh Revenue Authority / Welsh Government" },
        totalEstimatedRange: "LTT band + solicitor and survey costs", sourceUrl: "https://www.gov.wales/land-transaction-tax-rates-and-bands" }
    }
  },
  germany: {
    transferTax: { rateRange: "3.5%–6.5%", basis: "Grunderwerbsteuer — set per federal state (Bundesland): 3.5% in Bavaria up to 6.5% in Brandenburg, North Rhine-Westphalia, Saarland and Schleswig-Holstein.", source: "State rate laws (Landesgesetze über den Grunderwerbsteuersatz)" },
    // rate per state, checked Sept 2026 — the latest changes against the
    // official texts: Bremen 5.5% from 1 Jul 2025 (Brem.GBl. 2025 Nr. 9),
    // Saxony 5.5% from 1 Jan 2023 (SächsGrEStSatzG), Thuringia 5.0% from
    // 1 Jan 2024 (Thüringer Finanzministerium), Hamburg 5.5% from 1 Jan 2023
    byState: {
      "Baden-Württemberg": { rate: 5.0, since: "5 Nov 2011" },
      "Bayern": { rate: 3.5, since: "1997" },
      "Berlin": { rate: 6.0, since: "1 Jan 2014" },
      "Brandenburg": { rate: 6.5, since: "1 Jul 2015" },
      "Bremen": { rate: 5.5, since: "1 Jul 2025" },
      "Hamburg": { rate: 5.5, since: "1 Jan 2023" },
      "Hessen": { rate: 6.0, since: "1 Aug 2014" },
      "Mecklenburg-Vorpommern": { rate: 6.0, since: "1 Jul 2019" },
      "Niedersachsen": { rate: 5.0, since: "1 Jan 2014" },
      "Nordrhein-Westfalen": { rate: 6.5, since: "1 Jan 2015" },
      "Rheinland-Pfalz": { rate: 5.0, since: "1 Mar 2012" },
      "Saarland": { rate: 6.5, since: "1 Jan 2015" },
      "Sachsen": { rate: 5.5, since: "1 Jan 2023" },
      "Sachsen-Anhalt": { rate: 5.0, since: "1 Mar 2012" },
      "Schleswig-Holstein": { rate: 6.5, since: "1 Jan 2014" },
      "Thüringen": { rate: 5.0, since: "1 Jan 2024" }
    },
    notaryFees: { rateRange: "1.5%–2%, plus ~0.5% land registry entry", basis: "Notarkosten — regulated fee schedule (GNotKG).", source: "Bundesnotarkammer" },
    agencyCommission: { rateRange: "5.95%–7.14% incl. VAT total, legally split ~50/50 buyer/seller since Dec 2020 for owner-occupied homes/apartments", typicalPayer: "Split buyer/seller by law", source: "Gesetz über die Verteilung der Maklerkosten" },
    totalEstimatedRange: "9%–15% of price (transfer tax + notary + buyer's half of agency commission)",
    sourceUrl: "https://www.bundesfinanzministerium.de/"
  },
  italy: {
    transferTax: { rateRange: "2% (primary residence) / 9% (second home/investment), from a private seller", basis: "Imposta di registro — applied to the property's cadastral value, not the sale price, which is usually lower.", source: "Agenzia delle Entrate" },
    notaryFees: { rateRange: "1%–2.5%", basis: "Notary fee — not fixed by law but a common market range.", source: "Consiglio Nazionale del Notariato" },
    agencyCommission: { rateRange: "3%–5% + 22% VAT, per side", typicalPayer: "Buyer and seller each pay their own agent", source: "Market convention" },
    totalEstimatedRange: "6%–10% of price (primary residence)",
    sourceUrl: "https://www.agenziaentrate.gov.it/"
  },
  portugal: {
    transferTax: { rateRange: "1%–8% (progressive), single 6% or 7.5% rate on high values", basis: "IMT (Imposto Municipal sobre as Transmissões Onerosas de Imóveis), CIMT art. 17 n.º 1 c) — a home that will NOT be the buyer's own permanent residence (investment / second home), table in force from 2026 (Lei n.º 73-A/2025): 1% up to €106,346; then 2%, 5%, 7%, 8% marginal bands to €633,931 (the value is split per n.º 3: the bracket limit at its average rate + the excess at the next marginal rate); a single 6% on the whole value from €633,931 to €1,150,853; a single 7.5% above. A buyer domiciled in a listed tax haven pays 10% (art. 17 n.º 4).", source: "Autoridade Tributária e Aduaneira — Código do IMT, art. 17.º" },
    stampDuty: { rate: "0.8%", basis: "Imposto do Selo, Tabela Geral verba 1.1 — 0.8% of the value on the purchase (a mortgage carries its own stamp duty).", source: "Autoridade Tributária e Aduaneira — Tabela Geral do Imposto do Selo" },
    legalFees: { rateRange: "1%–2%", basis: "Lawyer fees — not fixed by law.", source: "Ordem dos Advogados (market guidance)" },
    totalEstimatedRange: "7%–9% of price",
    sourceUrl: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cimt/Pages/cimt17.aspx",
    // CIMT art. 17 n.º 1 c) + n.º 3: [upper limit, marginal %, average % at
    // the limit]; above the last: single rates on the whole value
    ptImt: { bands: [[106346, 1, 1], [145470, 2, 1.2689], [198347, 5, 2.2636], [330539, 7, 4.1578], [633931, 8, null]], single: [[1150853, 6], [Infinity, 7.5]] }
  },
  greece: {
    transferTax: { rate: "3.09%", basis: "Φόρος Μεταβίβασης Ακινήτων: 3% of the taxable value plus a 3% municipal surcharge on that tax (= 3.09%). The taxable value is the HIGHER of the agreed price and the property's objective (zone-price) value. New builds: 24% VAT is suspended until 31 Dec 2026 when the builder applies for it, and the transfer tax is charged instead (Law 5246/2025 art. 12 → VAT Code art. 70).", source: "Independent Authority for Public Revenue (ΑΑΔΕ) — Φορολογία Μεταβίβασης Ακινήτων (a.n. 1521/1950, ratified by Law 1587/1950)" },
    notaryFees: { rateRange: "0.65%–0.8% + 24% VAT", basis: "Statutory notary fee on the deed value: 0.80% up to €120,000, 0.70% €120,000–380,000, 0.65% €380,000–2,000,000, 0.55% €2–5 m (lower bands above), plus a €20 fixed fee.", source: "Ministerial Decision 111376/2012 (ΦΕΚ Β' 13/11.1.2012) on notary fees, as amended in 2015" },
    registrationFees: { rate: "0.5%", basis: "Hellenic Cadastre registration of the sale: 5‰ of the property's value (decision 2/12-1-2026; +1‰ for entries in the cadastral book of art. 10 of Law 2664/1998).", source: "Hellenic Cadastre — decision 2/12-1-2026 on fixed and proportional fees" },
    totalEstimatedRange: "about 4.4%–4.6% of price (official taxes and fees only; more if the zone value exceeds the price)",
    sourceUrl: "https://www.aade.gr/omogeneis-katoikoi-exoterikoy/kefalaio/forologia-metabibasis-akiniton-fma"
  },
  turkey: {
    transferTax: { rate: "2%", basis: "Tapu harcı (title-deed fee): 2% (binde 20) of the declared sale price — never less than the property's emlak vergisi (tax) value — charged SEPARATELY to the buyer and to the seller (2% each). Fees Law 492, Tariff (4) item 20(a), rate as raised by Council of Ministers Decision 2012/3735; base wording per Law 7566 (4 Dec 2025).", source: "Harçlar Kanunu (Law 492) — mevzuat.gov.tr" },
    totalEstimatedRange: "2% of price (the buyer's title-deed fee; the TKGM service fee, VAT on a developer's new home and any agency fee are not included)",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=492&MevzuatTur=1&MevzuatTertip=5"
  },
  singapore: {
    transferTax: { rateRange: "1%–6% (marginal)", basis: "Buyer's Stamp Duty on the purchase price or market value, whichever is higher — residential rates from 15 Feb 2023: 1% on the first S$180,000, 2% on the next S$180,000, 3% on the next S$640,000, 4% on the next S$500,000, 5% on the next S$1,500,000, 6% on the rest.", source: "IRAS — Buyer's Stamp Duty (BSD)" },
    additionalDuty: { rate: "60% for foreigners", basis: "Additional Buyer's Stamp Duty from 27 Apr 2023: foreigners 60% on any residential property; Singapore Permanent Residents 5% / 30% / 35% (1st / 2nd / 3rd+); citizens 0% / 20% / 30%. Under Free Trade Agreements some nationals (IRAS's example: the USA) are treated as Singapore citizens.", source: "IRAS — Additional Buyer's Stamp Duty (ABSD)" },
    totalEstimatedRange: "see the computed stamp duty",
    sourceUrl: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer's-stamp-duty-(bsd)",
    tiers: { cur: "S$", name: "Buyer's Stamp Duty", bands: [[180000, 1], [360000, 2], [1000000, 3], [1500000, 4], [3000000, 5], [Infinity, 6]], foreignPct: 60, foreignName: "ABSD for a foreigner" }
  },
  belgium: {
    transferTax: { rateRange: "2%–12.5%", basis: "Droits d'enregistrement / registratierechten — set per region: Flanders 2% (sole/primary home) or 12% (second home/investment); Wallonia 3% (first home) or 12.5%; Brussels 12.5% flat, with an exemption on the first €200,000 for qualifying first-time buyers under €600,000.", source: "Regional tax administrations (Flanders/Wallonia/Brussels)" },
    notaryFees: { rateRange: "~0.057%–1.06% (regulated sliding scale) plus ~€1,500 disbursements", basis: "Set by the 1950 Royal Decree scale.", source: "Fédération Royale du Notariat Belge" },
    totalEstimatedRange: "3%–15% of price depending on region and whether it's a sole/primary residence",
    sourceUrl: "https://finances.belgium.be/"
  },
  "united states": {
    transferTax: { rateRange: "0%–2.5%", basis: "Varies by state/county — many states (e.g. Texas) have none; others (Delaware, NY, NJ) charge meaningfully more.", source: "State/county recorder offices" },
    closingCosts: { rateRange: "2%–5%", basis: "Title insurance, escrow, lender/appraisal fees, recording fees — averages ~1% nationally per 2026 lender data but commonly budgeted at 2–5% including all line items.", source: "CFPB / state closing-cost surveys" },
    agencyCommission: { rateRange: "5%–6% total, typically split ~2.5–3% per side", typicalPayer: "Seller (post-2024 NAR settlement changed some buyer-agent arrangements — increasingly negotiated directly)", source: "Market convention" },
    totalEstimatedRange: "2%–5% of price in closing costs, before any agency commission (usually seller-paid)",
    sourceUrl: "https://www.consumerfinance.gov/"
  },
  israel: {
    transferTax: { rateRange: "0%–10% (tiered, sole apartment) / 8%–10% (additional property)", basis: "מס רכישה (Purchase Tax) — progressive brackets for a sole apartment, frozen through January 2028; a flat higher-tier schedule for an additional property.", source: "Israel Tax Authority (רשות המסים)" },
    legalFees: { rateRange: "0.5%–1.5%", basis: "Not government-set — the Israel Bar Association publishes a non-binding recommended minimum (~1% on the first ~₪538,000, 0.75% above) that many buyer's lawyers reference.", source: "Israel Bar Association (לשכת עורכי הדין) — recommended tariff, not mandatory" },
    agencyCommission: { rate: "~2% + VAT", typicalPayer: "Buyer (own agent) and seller (own agent) each pay their own side — not government-regulated, a long-standing market convention", source: "Market convention" },
    totalEstimatedRange: "3%–5% of price beyond the purchase tax itself (sole-apartment case)",
    sourceUrl: "https://www.gov.il/en/departments/israel_tax_authority"
  },
  "united arab emirates": {
    transferTax: { rate: "4%", basis: "Dubai Land Department (DLD) transfer fee — legally split buyer/seller but in practice almost always paid in full by the buyer.", source: "Dubai Land Department", marketAreaNote: "Dubai only — other emirates set their own rates." },
    agencyCommission: { rate: "2% + 5% VAT", typicalPayer: "Buyer, on resale (secondary market) — off-plan purchases usually carry no buyer commission, the developer pays it", source: "Market convention" },
    registrationFees: { basis: "Trustee registration fee (~AED 4,200 incl. VAT for properties over AED 500,000) plus fixed admin charges.", source: "Dubai Land Department" },
    totalEstimatedRange: "7%–10% of price (Dubai, resale)",
    sourceUrl: "https://dubailand.gov.ae/"
  },

  // ---- Added via the weekly country data-coverage scan ----
  austria: {
    transferTax: { rate: "3.5%", basis: "Grunderwerbsteuer, on the purchase price. Reduced tiered scale for transfers within the family; flat 0.5% for transfers between spouses/close relatives since 1 July 2025.", source: "Bundesministerium für Finanzen (BMF)" },
    registrationFees: { rate: "1.1%", basis: "Grundbucheintragungsgebühr (land register entry fee); from July 2025 waived on the first €500,000 of value.", source: "Bundesministerium für Justiz / Gerichtsgebührengesetz" },
    agencyCommission: { rateRange: "up to 3% net (3.6% incl. VAT) per side", typicalPayer: "Commonly split buyer/seller by agreement", source: "Immobilienmaklerverordnung 2007 (regulated maximum)" },
    totalEstimatedRange: "~7%–11% of price (transfer tax + registration + notary/legal + commission share)",
    sourceUrl: "https://www.usp.gv.at/en/themen/steuern-finanzen/weitere-steuern-und-abgaben/grunderwerbsteuer.html"
  },
  netherlands: {
    transferTax: { rateRange: "0% (starter exemption: age 18–35, primary residence, under €555,000, one-time) / 2% (primary residence, other buyers) / 8% (any other residential property, e.g. buy-to-let)", basis: "Overdrachtsbelasting, on the purchase price of existing (non-new-build) property; new-build carries VAT instead.", source: "Belastingdienst / Rijksoverheid" },
    notaryFees: { rateRange: "€900–€2,000 flat (typical total)", basis: "Fully deregulated since 1999 — freely set, shop-around market price.", source: "Koninklijke Notariële Beroepsorganisatie (KNB)" },
    agencyCommission: { rateRange: "1%–2% (selling agent, seller-paid) / 1.2%–1.8% (separate buying agent, if hired)", typicalPayer: "Seller pays their own agent by default", source: "Market convention" },
    totalEstimatedRange: "2%–8% transfer tax (occupancy/age-dependent) + ~1%–3% notary/agent costs",
    sourceUrl: "https://www.government.nl/topics/capital-transfer-tax/real-estate-transfer-tax-rates"
  },
  switzerland: {
    transferTax: { rateRange: "0%–3.3%", basis: "Handänderungssteuer, cantonal/communal — eight cantons (Zürich, Zug, Schwyz, Uri, Glarus, Schaffhausen, Aargau, Ticino) levy none, charging only a land-registry fee; elsewhere ranges from ~1% (Basel-Stadt/Lucerne) to 3.3% (Neuchâtel). Usually buyer-paid.", source: "Swiss Federal Tax Administration (ESTV)" },
    notaryFees: { rateRange: "~0.1%–1%+ of price, cantonal fixed scale", basis: "Notarial deed and land-registry fees set by cantonal law, not negotiable.", source: "Cantonal notary/land-registry fee schedules" },
    agencyCommission: { rateRange: "2%–5%", typicalPayer: "Seller — the agent is almost always mandated by the seller", source: "Market convention" },
    totalEstimatedRange: "2.5%–5% of price for transfer tax + notary + registry combined, entirely canton-dependent",
    sourceUrl: "https://www.estv.admin.ch/dam/estv/de/dokumente/estv/steuersystem/dossier-steuerinformationen/d/d-handaenderungssteuer.pdf.download.pdf/d-handaenderungssteuer.pdf"
  },
  denmark: {
    stampDuty: { basis: "Tinglysningsafgift (registration duty): DKK 1,850 fixed + 0.6% of the purchase price, to register the change of ownership (skøde). A separate registration duty applies only if a new mortgage deed is registered.", source: "Skatteforvaltningen (Skattestyrelsen)" },
    agencyCommission: { rateRange: "1%–4% (commonly ~2%–3%) incl. VAT", typicalPayer: "Seller — not the buyer", source: "Market convention" },
    totalEstimatedRange: "~1.5%–2% of price in buyer-side registration duty; agency commission is seller-paid and not part of the buyer's closing costs",
    sourceUrl: "https://skat.dk/erhverv/afgifter-paa-varer-og-ydelser-punktafgifter/tinglysningsafgift"
  },
  sweden: {
    stampDuty: { rate: "1.5% (private individuals; 4.25% for legal entities)", basis: "Stämpelskatt, paid when applying for lagfart (title registration), on the higher of the purchase price or the taxeringsvärde (assessed tax value). A separate 2% stamp duty applies for a new pantbrev (mortgage deed).", source: "Lantmäteriet (Swedish national land survey)" },
    agencyCommission: { rateRange: "1.5%–5% (commonly ~3%–4%)", typicalPayer: "Seller — always, never the buyer", source: "Market convention" },
    totalEstimatedRange: "~1.5%–2% of price in stamp duty (lagfart), plus ~2% more if a new mortgage deed is required",
    sourceUrl: "https://www.lantmateriet.se/sv/fastighet-och-mark/kopa-aga-salja-eller-ge-bort/Stampelskatt-och-avgifter/"
  },
  norway: {
    stampDuty: { rate: "2.5%", basis: "Dokumentavgift (document tax), on market value, paid when the deed (skjøte) is registered. Applies only to freehold (selveier) property — NOT charged on cooperative-housing (borettslag).", source: "Kartverket (Norwegian Mapping Authority)" },
    registrationFees: { rate: "~NOK 585 flat per document", basis: "Fixed Land Registry fee for registering the deed.", source: "Kartverket" },
    agencyCommission: { rateRange: "1%–4%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~2.5%–2.7% of price for freehold property; near-0% for a cooperative purchase (which instead carries a share of collective debt)",
    sourceUrl: "https://www.kartverket.no/en/property/dokumentavgift-og-gebyr/dokumentavgift-ved-overforing-av-fast-eigedom"
  },
  poland: {
    transferTax: { rate: "2% (resale/secondary-market only)", basis: "Podatek od czynności cywilnoprawnych (PCC) — applies when buying from a private individual; new-build from a VAT-registered developer is PCC-exempt (VAT applies instead).", source: "Ministerstwo Finansów" },
    notaryFees: { rateRange: "0.5%–3% (regulated maximum sliding scale) + 23% VAT, capped at 10,000 PLN", basis: "Taksa notarialna — maximum rates fixed by Ministry of Justice regulation.", source: "Rozporządzenie Ministra Sprawiedliwości w sprawie maksymalnych stawek taksy notarialnej" },
    agencyCommission: { rateRange: "2%–5% + 23% VAT", typicalPayer: "Historically mostly seller-paid, increasingly split", source: "Market convention" },
    totalEstimatedRange: "2%–6% of price (resale) — mostly PCC + notary fee; new-build has no PCC",
    sourceUrl: "https://www.podatki.gov.pl/pcc/"
  },
  "czech republic": {
    transferTax: { rate: "0% — abolished", basis: "Daň z nabytí nemovitých věcí (formerly 4%) was abolished by Act No. 386/2020 Coll., retroactive to Land Register entries from 1 Dec 2019.", source: "Ministerstvo financí ČR" },
    legalFees: { rateRange: "~1% of price (negotiable)", basis: "A notary is not legally required for a standard purchase; a lawyer drafts the contract and often holds the price in escrow.", source: "Market convention" },
    agencyCommission: { rateRange: "2.5%–5% + VAT", typicalPayer: "Usually seller nationally; commonly split in Prague, buyer-paid in Brno", source: "Market convention" },
    totalEstimatedRange: "~1%–2% of price beyond the price itself — no transfer tax since 2020",
    sourceUrl: "https://portal.gov.cz/en/informace/tax-liability-for-the-purchase-sale-and-ownership-of-immovable-property-INF-301"
  },
  hungary: {
    transferTax: { rate: "4%, reduced to 2% on the portion of value above HUF 1 billion; first-time buyers under 35 get a reduced/zero rate on a primary residence up to HUF 1 billion", basis: "Visszterhes vagyonátruházási illeték (property transfer duty) — NAV bills the buyer a few weeks after the deed is registered. VAT-liable new-builds are exempt from this duty instead.", source: "Nemzeti Adó- és Vámhivatal (NAV)" },
    agencyCommission: { rateRange: "3%–5% + 27% VAT", typicalPayer: "Whichever party signed the brokerage agreement — most commonly the seller", source: "Market convention" },
    totalEstimatedRange: "4%–6% of price (almost entirely the transfer duty itself)",
    sourceUrl: "https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/illetekmertekek/visszterhes-vagyonatruhazasi-illetek"
  },
  romania: {
    transferTax: { rateRange: "1% (property held over 3 years) / 3% (held 3 years or less)", basis: "Impozitul pe transferul proprietăților imobiliare — a capital-value tax legally owed by the SELLER, typically withheld by the notary at signing; does not apply to a first sale directly from a developer.", source: "Codul Fiscal (Legea nr. 227/2015), administered by ANAF" },
    notaryFees: { rateRange: "~1%–2.2% (progressive grid) + 21% VAT", basis: "Onorariul notarial follows a progressive scale set by Ministry of Justice Order.", source: "Uniunea Națională a Notarilor Publici din România" },
    registrationFees: { rateRange: "0.15% (individuals) / 0.5% (legal entities)", basis: "ANCPI land-registration tax, usually collected via the notary.", source: "Agenția Națională de Cadastru și Publicitate Imobiliară (ANCPI)" },
    agencyCommission: { rateRange: "2%–4% of value (or a fixed €500–1,500 on lower-value properties)", typicalPayer: "Whichever party engaged the agency — commonly the seller", source: "Market convention" },
    totalEstimatedRange: "2%–4% of price in notary + registration costs, plus a seller-paid 1%–3% transfer tax usually reflected in the agreed price",
    sourceUrl: "https://www.anaf.ro/"
  },
  bulgaria: {
    transferTax: { rateRange: "0.1%–3% (municipality-set; ~2%–2.5% in Sofia/Varna/Plovdiv, up to 3% in resort towns)", basis: "Данък при придобиване на имущество по възмезден начин — each municipal council votes its own rate within this national band.", source: "Министерство на финансите (Ministry of Finance)" },
    notaryFees: { rateRange: "~0.1%–1.5% on a declining scale, capped around €3,068 incl. VAT", basis: "Нотариална такса set by the Tariff for notary fees.", source: "Нотариална камара на България (Bulgarian Notary Chamber)" },
    registrationFees: { rate: "0.1%", basis: "Registry Agency entry fee for registering the deed.", source: "Агенция по вписванията (Registry Agency)" },
    agencyCommission: { rateRange: "2%–3%", typicalPayer: "Negotiable — commonly split or seller-paid", source: "Market convention" },
    totalEstimatedRange: "3%–5% of price (transfer tax + notary + registration)",
    sourceUrl: "https://www.minfin.bg/bg/784"
  },
  croatia: {
    transferTax: { rate: "3%", basis: "Porez na promet nekretnina — flat national rate on a resale property's market value, buyer-paid; new-build from a VAT-registered developer carries 25% VAT instead.", source: "Porezna uprava (Croatian Tax Administration)" },
    notaryFees: { rateRange: "~0.5%–1% (public tariff, sliding scale) plus fixed per-signature charges", basis: "Public notary verifies the contract; a foreign buyer must also have a certified court translator present.", source: "Hrvatska javnobilježnička komora" },
    agencyCommission: { rateRange: "2%–4% + 25% VAT, often charged to both sides separately", typicalPayer: "Both buyer and seller pay their own side", source: "Market convention" },
    totalEstimatedRange: "4%–6% of price (transfer tax + notary + buyer's own agency fee, resale)",
    sourceUrl: "https://porezna-uprava.gov.hr/en/real-estate-transfer-tax-information-on-the-general-rules-rate-and-taxpayer/7317"
  },
  slovakia: {
    transferTax: { rate: "0% — abolished", basis: "Daň z prevodu nehnuteľností was abolished nationwide from 1 January 2005.", source: "Ministerstvo financií SR" },
    registrationFees: { rate: "€100 (€50 if filed electronically)", basis: "Land Registry fee to register the change of ownership.", source: "Úrad geodézie, kartografie a katastra SR" },
    legalFees: { rateRange: "~1% of price (negotiable)", basis: "Lawyer fee for due diligence and drafting the purchase contract.", source: "Market convention" },
    agencyCommission: { rateRange: "3%–5% + 23% VAT", typicalPayer: "Seller, by convention", source: "Market convention" },
    totalEstimatedRange: "~1%–2% of price beyond the price itself — no transfer tax since 2005",
    sourceUrl: "https://www.mfsr.sk/sk/dane-cla-uctovnictvo/priame-dane/miestne-dane-poplatku/legislativa-sr/zakon-miestnych-daniach-poplatku/"
  },
  slovenia: {
    transferTax: { rate: "2%", basis: "Davek na promet nepremičnin (DPN) — flat rate on a resale property's sale value; a new-build from a taxable developer carries VAT instead. By statutory default the seller owes DPN, though the contract can shift it.", source: "Finančna uprava Republike Slovenije (FURS)" },
    notaryFees: { rateRange: "~0.01%–0.4% of value, typically €400–1,500", basis: "A notary must certify the sale contract for Land Registry entry.", source: "Notarska zbornica Slovenije" },
    agencyCommission: { rateRange: "2%–4% + 22% VAT (statutory cap of 4%)", typicalPayer: "Commonly seller-paid", source: "Zakon o nepremičninskem posredovanju (Real Estate Brokerage Act)" },
    totalEstimatedRange: "3%–6% of price (resale)",
    sourceUrl: "https://www.fu.gov.si/davki_in_druge_dajatve/podrocja/davek_na_promet_nepremicnin/"
  },
  estonia: {
    transferTax: { rate: "0% — no transfer tax", basis: "Estonia levies no real-estate transfer or stamp tax; a buyer pays only the notary fee and the state Land Registry fee.", source: "Maksu- ja Tolliamet (EMTA)" },
    notaryFees: { rateRange: "State-regulated sliding scale — roughly €500–900 combined for both parties on a ~€100,000 property", basis: "Notarisation is mandatory for every property transaction.", source: "Notarite Koda (Estonian Chamber of Notaries)" },
    registrationFees: { rate: "~€64 base state fee, scaling with property value", basis: "State fee to register the new owner in the Land Register.", source: "Riigi Teataja — Riigilõivuseadus (State Fees Act)" },
    agencyCommission: { rateRange: "2%–5% (commonly 3%–4%)", typicalPayer: "Seller, by convention", source: "Market convention" },
    totalEstimatedRange: "~1%–2% of price total (notary + state fee only — no transfer tax)",
    sourceUrl: "https://www.emta.ee/en/private-client/taxes-and-payment/taxable-income/transfer-immovable-property/calculation-taxable-gains"
  },
  latvia: {
    transferTax: { rateRange: "1.5% (individuals) / 2% (legal entities), capped at €142,300", basis: "State title-transfer fee, on the higher of the cadastral or contract value, paid to the Land Register (Zemesgrāmata).", source: "Valsts ieņēmumu dienests / Finanšu ministrija" },
    notaryFees: { rateRange: "0.2%–0.8% + 21% VAT (not government-fixed)", basis: "Notary use is common but not mandatory for every deal.", source: "Latvijas Zvērinātu notāru padome" },
    agencyCommission: { rateRange: "2%–5%", typicalPayer: "Seller, almost always", source: "Market convention" },
    totalEstimatedRange: "2%–4% of price (mostly the Land Register transfer fee)",
    sourceUrl: "https://www.fm.gov.lv/en/tax-rates-2"
  },
  lithuania: {
    transferTax: { rate: "0% — no transfer tax", basis: "Lithuania levies no separate real-estate transfer/stamp tax; costs are limited to the notary fee and state registration fee.", source: "Registrų centras (State Enterprise Centre of Registers)" },
    notaryFees: { rateRange: "0.33%–0.45% of price, minimum €28.96, capped around €5,792", basis: "Notarisation is mandatory for every property sale.", source: "Lietuvos notarų rūmai" },
    registrationFees: { rateRange: "~0.03%–0.5% of value (or a flat €20–100 for simple filings)", basis: "Registrų centras fee to register the ownership change.", source: "Registrų centras" },
    agencyCommission: { rateRange: "1.5%–3%", typicalPayer: "Seller, by convention", source: "Market convention" },
    totalEstimatedRange: "~0.5%–1% of price total (notary + registration — no transfer tax)",
    sourceUrl: "https://www.notarurumai.lt/en"
  },
  malta: {
    stampDuty: { rate: "5%", basis: "Duty on Documents and Transfers — standard rate, buyer-paid, on the higher of price or market value. First-time buyers get 0% on the first €200,000 (or a similar reduced band).", source: "Office of the Commissioner for Tax and Customs (CFR/MTCA)" },
    notaryFees: { rateRange: "1%–2.5% (regulated scale per Notarial Council guidelines)", basis: "A notary is mandatory for every transfer — covers a 25+ year title search, drafting and lodging with the Public Registry.", source: "Kunsill Notarili ta' Malta" },
    agencyCommission: { rateRange: "3.5% (sole agency) to 5% (open agency), + 18% VAT", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "6%–8% of price (stamp duty + notary, resale, non-first-time-buyer)",
    sourceUrl: "https://mtca.gov.mt/personal-tax/property-taxes/general-information-on-duty"
  },
  cyprus: {
    transferTax: { rateRange: "3% on the first €85,000, 5% on the next €85,000, 8% above €170,000 — permanently halved (1.5%/2.5%/4%) on resale (non-VAT) purchases", basis: "Department of Lands and Surveys title-transfer fees, buyer-paid. A first purchase from a VAT-registered developer is exempt from transfer fees instead.", source: "Department of Lands and Surveys (Cyprus)" },
    stampDuty: { rate: "0% — abolished from 1 January 2026", basis: "Cyprus repealed the Stamp Duty Laws via Law 239(I)/2025 for any document signed on/after 1 Jan 2026 (previously 0%–0.2% of price).", source: "Law 239(I)/2025 (Repeal of Stamp Duty Laws)" },
    legalFees: { rateRange: "1%–2% + 19% VAT (or a flat €1,500–3,000 on simpler deals)", basis: "Conveyancing lawyer fee for title checks, contract drafting and registration filing.", source: "Market convention" },
    agencyCommission: { rate: "~5% + 19% VAT", typicalPayer: "Seller, by convention", source: "Market convention" },
    totalEstimatedRange: "3%–6% of price (resale — transfer fees + legal fees; no stamp duty from 2026)",
    sourceUrl: "https://portal.dls.moi.gov.cy/wp-content/uploads/2022/07/Rights-and-Fees_EN.pdf"
  },
  serbia: {
    transferTax: { rate: "2.5%", basis: "Porez na prenos apsolutnih prava — applies to resale of used real estate; new construction sold first-time by a VAT-registered developer instead carries 10% VAT (residential) / 20% (commercial). Legally owed by the seller but usually passed to the buyer by contract.", source: "Law on Property Taxes — Tax Administration of the Republic of Serbia" },
    agencyCommission: { rateRange: "2%–4%", typicalPayer: "Varies — seller, buyer, or split, by contract", source: "Market convention" },
    totalEstimatedRange: "~3%–6% of price (2.5% transfer tax plus modest registration costs)",
    sourceUrl: "https://www.purs.gov.rs/sr/fizicka-lica/pregled-propisa/zakoni/331/zakon-o-porezima-na-imovinu.html"
  },
  montenegro: {
    transferTax: { rateRange: "3%–6% (progressive since a Jan 1, 2024 reform)", basis: "Porez na promet nepokretnosti on secondary-market resale — 3% up to €150,000, then progressively higher; new-build from a VAT-registered developer instead carries 21% VAT. Tax authority can override the contract price with its own market-value assessment.", source: "Zakon o porezu na promet nepokretnosti — Poreska uprava Crne Gore" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Commonly seller, but varies by contract", source: "Market convention" },
    totalEstimatedRange: "~4%–7% of price (transfer tax dominates)",
    sourceUrl: "https://www.gov.me/en/taxadministration"
  },
  "north macedonia": {
    transferTax: { rateRange: "2%–4%", basis: "Данок на промет на недвижен имот — a local tax, exact rate set annually by each municipal council within this national band, on market value as determined by the municipality's own valuation. Statutory payer is the seller, often shifted to the buyer by contract.", source: "Law on Property Taxes — Ministry of Finance of North Macedonia" },
    agencyCommission: { rateRange: "2%–4%", typicalPayer: "Varies by contract", source: "Market convention" },
    totalEstimatedRange: "2%–4% of price (transfer tax) plus modest registration costs",
    sourceUrl: "https://finance.gov.mk/en-GB/oblasti/danoci-na-imot"
  },
  albania: {
    transferTax: { rate: "2% (residential, of sale price)", basis: "Tatimi mbi kalimin e së drejtës së pronësisë — for commercial property instead a per-m² charge. Buyer-paid, collected by the notary at signing.", source: "General Directorate of Taxation" },
    notaryFees: { rateRange: "0.5%–1% (with a minimum flat fee regardless of price)", basis: "Regulated notary tariff covering contract drafting, verification and registration submission.", source: "Albanian notary tariff" },
    agencyCommission: { rateRange: "2%–3%", typicalPayer: "Varies", source: "Market convention" },
    totalEstimatedRange: "~3%–5% of price",
    sourceUrl: "https://www.tatime.gov.al/d/8/45/0/731/mbi-kalimin-e-se-drejtes-se-pronesise-se-paluajtshme-dhe-taksat-e-tatimet-qe-do-te-llogariten-"
  },
  andorra: {
    transferTax: { rate: "~4% total (national + comú/parish components); a 2026 law raised the rate for foreign real-estate investment specifically to 6% on a first property and 10% from the second dwelling onward, effective Feb 13 2026", basis: "Impost sobre Transmissions Patrimonials Immobiliàries (ITP) — combines a national tax and a communal (per-parish) tax; first-time buyers of a primary residence under certain thresholds are exempt.", source: "Llei de l'Impost sobre Transmissions Patrimonials Immobiliàries — Govern d'Andorra" },
    notaryFees: { rateRange: "€600–€1,300 flat, plus ~0.1%–0.3% of price", basis: "Regulated, always paid by the buyer.", source: "Andorran notary tariff" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Seller by convention", source: "Market convention" },
    totalEstimatedRange: "~4.5%–5.5% of price for a resident/EU-style buyer (6%–10%+ for a foreign investor under the 2026 surtax)",
    sourceUrl: "https://www.consellgeneral.ad/fitxers/documents/lleis-1989-2002/copy_of_llei-de-limpost-sobre-transmissions-patrimonials-immobiliaries.pdf/view"
  },
  georgia: {
    registrationFees: { basis: "No ad-valorem transfer tax — ownership transfer is registered with the National Agency of Public Registry (NAPR) for a flat fee tiered by processing speed, not a percentage of value.", source: "National Agency of Public Registry (NAPR), Ministry of Justice of Georgia" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Varies", source: "Market convention" },
    totalEstimatedRange: "~1%–3% of price (mostly flat registration fees, no percentage transfer tax) plus any agency commission",
    sourceUrl: "https://napr.gov.ge/en"
  },
  armenia: {
    registrationFees: { basis: "No stamp duty/transfer tax on real estate sales. A notarized sale contract is mandatory; standard registration is a flat fee plus a small state duty; first-ever registration of a never-before-registered property is free.", source: "State Committee of the Real Estate Cadastre of the Republic of Armenia" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Varies", source: "Market convention" },
    totalEstimatedRange: "well under 1% of price (flat registration/notary fees only, no ad-valorem transfer tax)",
    sourceUrl: "https://www.cadastre.am/en"
  },
  azerbaijan: {
    registrationFees: { basis: "No ad-valorem transfer tax. Notarization and state registration of the sale-purchase contract carry flat state duties, higher in Baku than in the regions.", source: "ASAN (State Agency for Public Service and Social Innovations)" },
    agencyCommission: { rateRange: "3%–6%", typicalPayer: "Varies", source: "Market convention" },
    totalEstimatedRange: "well under 1% of price in flat state duties/notary fees (no percentage transfer tax)",
    sourceUrl: "https://asan.gov.az/en"
  },
  "bosnia and herzegovina": {
    transferTax: { rateRange: "0.05%–5% in the Federation of Bosnia and Herzegovina only (each of its 10 cantons sets its own rate); none in Republika Srpska; none in Brčko District", basis: "Porez na promet nepokretnosti exists only in FBiH, where property taxation is a cantonal competence. Republika Srpska and Brčko District levy no transfer tax on real estate sales. Bosnia and Herzegovina has no single national tax authority for this — a genuine structural fact of its constitution, not a data gap.", source: "Cantonal finance ministries (FBiH); cross-referenced via the Center of Excellence in Finance (CEF), a Southeast-Europe intergovernmental public-finance institute — no single unified government portal exists for this tax" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Varies", source: "Market convention" },
    totalEstimatedRange: "0%–5%+ of price depending entirely on which entity/canton the property is in",
    sourceUrl: "https://www.cef-see.org/property-taxation-in-bosnia-and-herzegovina-basic-characteristics-2016-04-25"
  },
  ukraine: {
    transferTax: { rate: "1%", basis: "Держмито (state duty) on the notarized sale-purchase contract value — formally the seller's liability, routinely reallocated by agreement.", source: "Decree of the Cabinet of Ministers of Ukraine No. 7-93 'On State Duty'" },
    pensionFundDuty: { rate: "1%", basis: "Mandatory State Pension Insurance collection, paid by the buyer on the contract value; exempt for a citizen's first home purchase.", source: "Law of Ukraine No. 400/97-VR" },
    notaryFees: { rateRange: "~1%–2%", basis: "Private-notary service fee — no statutory fee schedule.", source: "Market convention" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Negotiable", source: "Market convention" },
    totalEstimatedRange: "~2%–4% of price in mandatory state duty + pension fund duty combined, before notary/agency fees",
    sourceUrl: "https://zakon.rada.gov.ua/laws/show/400/97-%D0%B2%D1%80"
  },
  moldova: {
    transferTax: { rate: "0.5%", basis: "State duty for state registration of an ownership transfer under a notarized sale-purchase contract, on the contract price (floored at cadastral value); buyer-paid.", source: "Law of the Republic of Moldova on the State Duty (Law No. 213/2023, in force since Jan 1, 2024)" },
    notaryFees: { rateRange: "0.1%–1.3% (regressive scale)", basis: "Regulated fee scale for notarial authentication of a real estate sale-purchase contract.", source: "Chamber of Notaries of the Republic of Moldova / Ministry of Justice" },
    registrationFees: { basis: "Cadastral registration fee to enter the ownership transfer in the Real Property Register.", source: "Public Services Agency (Agenția Servicii Publice, ASP)" },
    agencyCommission: { rateRange: "2%–5%", typicalPayer: "Seller, by convention", source: "Market convention" },
    totalEstimatedRange: "~1%–2% of price in state duty + notary + registration fees combined",
    sourceUrl: "https://www.asp.gov.md/en/servicii/bunuri-imobile/51"
  },
  canada: {
    transferTax: { rateRange: "0%–5%+ (highly province/city dependent)", basis: "Land Transfer Tax — provincial, not federal. Ontario: 0.5%–2.5% tiered (Toronto adds its own municipal LTT, effectively doubling it). BC: 1%–3% tiered. Quebec: 0.5%–1.5%+ tiered. Alberta and Saskatchewan charge no land transfer tax, only flat registration fees.", source: "Provincial ministries of finance / land titles offices" },
    legalFees: { rateRange: "C$1,500–C$3,000 flat (typical)", basis: "Real estate lawyer conveyancing fee — not government-set.", source: "Provincial law society market guidance" },
    agencyCommission: { rateRange: "~5% total, typically split ~2.5% per side", typicalPayer: "Seller", source: "Market convention (CREA/local board norms)" },
    totalEstimatedRange: "0%–5%+ of price in land transfer tax (varies hugely by province and city) plus C$1,500–3,000 legal fees",
    sourceUrl: "https://www.ontario.ca/document/land-transfer-tax"
  },
  mexico: {
    transferTax: { rateRange: "1.5%–5.5%", basis: "Impuesto Sobre Adquisición de Inmuebles (ISAI) — set per state; lowest in Chiapas (1.5%), highest in Estado de México (5.5%). Applied to the higher of the cadastral value or the transaction price.", source: "State fiscal codes (Código Financiero/Fiscal de cada Estado)" },
    notaryFees: { rateRange: "1%–2%", basis: "Notary (notario público) fee, regulated per state by each state's Colegio de Notarios.", source: "State notary colleges (Colegios de Notarios)" },
    agencyCommission: { rateRange: "5%–8% + 16% IVA", typicalPayer: "Seller, by convention", source: "Market convention" },
    totalEstimatedRange: "5%–8% of price in buyer-paid closing costs (ISAI + notary + registration + appraisal)",
    sourceUrl: "https://www.gob.mx/hacienda"
  },
  bahamas: {
    stampDuty: { rateRange: "2.5%–10% (Bahamian buyers, graduated by price band) / flat 10% (non-Bahamian/foreign buyers)", basis: "VAT on Property Conveyance. Non-Bahamian/foreign buyers pay a flat 10% regardless of price.", source: "Bahamas Department of Inland Revenue" },
    legalFees: { rateRange: "1.5%–2.5% + 10% VAT, sliding scale by price", basis: "Bahamas Bar Council conveyancing fee schedule.", source: "Bahamas Bar Council" },
    agencyCommission: { rate: "6% (developed property) / 10% (vacant land)", typicalPayer: "Seller", source: "Bahamas Real Estate Association (BREA) standard" },
    totalEstimatedRange: "~12%–15% of price for a non-Bahamian buyer (10% VAT + ~2.5% legal fees + closing admin)",
    sourceUrl: "https://inlandrevenue.finance.gov.bs/"
  },
  "cayman islands": {
    stampDuty: { rateRange: "7.5% (standard) / 10% (properties CI$2,000,000+, effective 1 Jan 2026)", basis: "Stamp Duty Act — levied on the higher of the purchase price or Lands & Survey Department valuation, buyer-paid within 45 days.", source: "Cayman Islands Stamp Duty Act / Lands and Survey Department" },
    agencyCommission: { rate: "5%", typicalPayer: "Seller", source: "Market convention (CIREBA)" },
    totalEstimatedRange: "7.5%–10% of price in stamp duty plus a 5% agency commission (usually seller-paid)",
    sourceUrl: "https://legislation.gov.ky/cms/images/LEGISLATION/SUBORDINATE/2025/2025-0003/2025-0003_SL%203%20of%202025.pdf"
  },
  jamaica: {
    transferTax: { rate: "2%", basis: "Transfer Tax Act — on the higher of sale price or market value, paid by the vendor (seller); reduced from 4% to 2% retroactive to 1 April 2019.", source: "Tax Administration Jamaica (TAJ)" },
    stampDuty: { rate: "Flat J$5,000 per document (J$100 if transaction value is under J$500,000)", basis: "A nominal flat fee per legal instrument since the 2014 reform.", source: "Tax Administration Jamaica (TAJ)" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Commonly the seller, but negotiable", source: "Realtors Association of Jamaica (RAJ) — non-binding market guidance" },
    totalEstimatedRange: "~2% of price in vendor-paid transfer tax + a nominal flat stamp duty",
    sourceUrl: "https://www.jamaicatax.gov.jm/stamp-duty-transfer-tax"
  },
  barbados: {
    transferTax: { rate: "2.5%", basis: "Property Transfer Tax — on developed property, the first BDS$150,000 is exempt, then 2.5% applies above that; bare land has no exemption. Paid by the vendor.", source: "Barbados Revenue Authority (BRA)" },
    stampDuty: { rate: "1%", basis: "Stamp duty on the Deed of Conveyance, on the full consideration — also vendor-paid.", source: "Barbados Revenue Authority (BRA)" },
    legalFees: { rateRange: "1%–2% + 17.5% VAT", basis: "Buyer and seller each retain their own attorney-at-law (a legal requirement in Barbados).", source: "Market convention / Barbados Bar Association" },
    agencyCommission: { rateRange: "4%–5% + VAT", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "Buyer ~1%–2% of price in legal fees; the seller separately pays ~3.5% (2.5% PTT + 1% stamp duty) plus 4–5% agency commission",
    sourceUrl: "https://caipo.gov.bb/wp-content/uploads/2021/09/4.-Property-Transfer-Tax-CAP-84A.pdf"
  },
  "trinidad and tobago": {
    stampDuty: { rateRange: "0% up to TT$850,000 (TT$1.5M for first-time homeowners) exempt, then 3%/5%/7.5% tiered above", basis: "Stamp Duty Act — exemption thresholds since 1 Jan 2019, buyer-paid by convention.", source: "Board of Inland Revenue (IRD)" },
    legalFees: { rateRange: "~1% of sale price (conveyance deed) + ~1.1% of loan amount if financed", basis: "Attorney's conveyancing fee — not fixed by law.", source: "Market convention" },
    agencyCommission: { rateRange: "3%–5% + 12.5% VAT", typicalPayer: "Negotiable, commonly seller-paid", source: "Market convention" },
    totalEstimatedRange: "0%–7.5% stamp duty depending on price bracket, plus ~1–2% legal fees",
    sourceUrl: "https://www.ird.gov.tt/stamp-duty"
  },
  "dominican republic": {
    transferTax: { rate: "3%", basis: "Impuesto de Transferencia Inmobiliaria — on the higher of the sale price or the DGII-assessed value, buyer-paid at registration. Low-cost/first-home properties may be exempt.", source: "Dirección General de Impuestos Internos (DGII)" },
    legalFees: { rateRange: "1%–1.5%", basis: "Buyer's attorney fee — not fixed by law.", source: "Market convention" },
    notaryFees: { rateRange: "~0.5%–1%", basis: "Notarization and document fees.", source: "Market convention" },
    agencyCommission: { rateRange: "~5%", typicalPayer: "Commonly the seller", source: "Market convention" },
    totalEstimatedRange: "4%–6% of price (3% transfer tax + ~1–1.5% legal + ~0.5–1% notary)",
    sourceUrl: "https://dgii.gov.do/herramientas/calculadoras/Paginas/Transferencia-Inmobiliaria.aspx"
  },
  "puerto rico": {
    stampDuty: { rate: "~0.1% of purchase price ($1 per $1,000) on the deed of sale, plus separate documentary stamps on any mortgage", basis: "Comprobantes de Rentas Internas (internal revenue documentary stamps), affixed and cancelled by the notary on every notarized deed.", source: "Departamento de Hacienda de Puerto Rico" },
    notaryFees: { basis: "Notarial fees on a real estate deed follow a statutory sliding-scale tariff (Ley Núm. 75 de 1987), unlike freely-negotiated mainland US closings.", source: "Ley Núm. 75 de 1987 (Ley Notarial) — Ley de Arancel Notarial" },
    agencyCommission: { rateRange: "5%–6% total, split ~2.5–3% per side", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "4%–6% of price in closing costs (stamps, registry, notary, title), scaling up for luxury properties",
    sourceUrl: "https://hacienda.pr.gov/"
  },
  brazil: {
    transferTax: { rateRange: "2%–3%", basis: "ITBI (Imposto sobre Transmissão de Bens Imóveis) — a municipal tax on the sale value or the municipality's own assessed reference value, whichever is higher; each of Brazil's ~5,570 municipalities sets its own rate.", source: "Secretarias Municipais da Fazenda (e.g. Prefeitura de São Paulo)" },
    registrationFees: { basis: "Notary deed + Cartório de Registro de Imóveis inscription fees are set per state — no single national percentage.", source: "State Tribunais de Justiça (Corregedorias-Gerais de Justiça)" },
    agencyCommission: { rate: "~6% (residential); 8% rural, 10% industrial", typicalPayer: "Seller", source: "CRECI / Federação Nacional dos Corretores de Imóveis" },
    totalEstimatedRange: "~2%–3% of price in ITBI, plus a smaller state-set cartório/notary fee",
    sourceUrl: "https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/6278"
  },
  argentina: {
    stampDuty: { rateRange: "1.5%–3.5%, typically split 50/50 buyer/seller", basis: "Impuesto de Sellos on the transfer deed — set per province/CABA (CABA 2.7%, Buenos Aires province 2%). The former federal transfer tax was abolished in 2024; post-2018 acquisitions instead trigger a 15% capital-gains tax on the seller's gain.", source: "Provincial/CABA tax authorities (e.g. ARBA for Buenos Aires province)" },
    legalFees: { rateRange: "~1%–2%", basis: "Escribano (notary) fee — not fixed nationally; each jurisdiction's Colegio de Escribanos publishes a non-binding recommended tariff.", source: "Colegio de Escribanos (per jurisdiction)" },
    agencyCommission: { rateRange: "3%–4% + VAT, per side", typicalPayer: "Buyer and seller each pay their own agent", source: "CUCICBA recommended scale" },
    totalEstimatedRange: "~4%–8% of price beyond agency commission (varies significantly by province)",
    sourceUrl: "https://www.arba.gov.ar/"
  },
  chile: {
    stampDuty: { rateRange: "0% (cash purchase) – 0.8% of the loan amount if mortgage-financed", basis: "Impuesto de Timbres y Estampillas — no general transfer tax on a cash purchase; applies only to the mortgage credit instrument when financed.", source: "Servicio de Impuestos Internos (SII)" },
    registrationFees: { rateRange: "~0.2% of price (capped)", basis: "Conservador de Bienes Raíces inscription fee, capped at a maximum regardless of price.", source: "Corte Suprema — Arancel de Conservadores de Bienes Raíces" },
    legalFees: { rateRange: "3–5 UF flat", basis: "Notary fee for the escritura pública — market-standard, not government-fixed.", source: "Market convention" },
    agencyCommission: { rate: "~2% + 19% IVA, typically per side", typicalPayer: "Seller (buyer's side sometimes pays their own 2%)", source: "Market convention" },
    totalEstimatedRange: "~1%–3% of price beyond any mortgage stamp tax (cash purchases carry very low closing costs)",
    sourceUrl: "https://www.sii.cl/"
  },
  colombia: {
    transferTax: { rateRange: "0.5%–1%", basis: "Impuesto de Registro — a departmental tax; national law sets the 0.5%–1% band and each departmental assembly fixes its own rate. Bogotá, Antioquia and Valle del Cauca charge the 1% ceiling.", source: "Departmental assemblies, under Ley 223 de 1995 — registered via the Superintendencia de Notariado y Registro" },
    notaryFees: { rateRange: "~0.27%–0.3% (sliding scale)", basis: "Derechos notariales — nationally regulated, updated annually.", source: "Superintendencia de Notariado y Registro (SNR)" },
    agencyCommission: { rate: "~3%", typicalPayer: "Seller", source: "Market convention (Fedelonjas guidance)" },
    totalEstimatedRange: "~2%–3% of price in registration tax + notarial fees",
    sourceUrl: "https://www.supernotariado.gov.co/"
  },
  peru: {
    transferTax: { rate: "3%, exempt on the first 10 UIT of value", basis: "Impuesto de Alcabala — municipal tax on the transfer value or the property's own assessed value, whichever is higher.", source: "Ley de Tributación Municipal (TUO, D.Leg. 776)" },
    legalFees: { rateRange: "0.5%–1%", basis: "Notary fees are freely negotiated since the binding tariff was abolished for free competition.", source: "Market convention" },
    registrationFees: { rateRange: "~0.3% of value, plus a small fixed fee", basis: "SUNARP inscription fee, per its official TUPA schedule.", source: "Superintendencia Nacional de los Registros Públicos (SUNARP)" },
    agencyCommission: { rate: "~3%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~4%–5% of price (alcabala + notary + SUNARP)",
    sourceUrl: "https://www.gob.pe/44819-impuesto-de-alcabala"
  },
  uruguay: {
    transferTax: { rate: "4% total (2% buyer + 2% seller)", basis: "ITP (Impuesto a las Transmisiones Patrimoniales) — on the higher of sale price or the assessed value, split equally buyer/seller.", source: "Dirección General Impositiva (DGI)" },
    legalFees: { rateRange: "~3% + VAT (non-binding recommended scale)", basis: "Escribano (notary) — required for every transfer.", source: "Asociación de Escribanos del Uruguay (AEU)" },
    agencyCommission: { rate: "~3% + VAT, per side", typicalPayer: "Buyer and seller each pay their own agent", source: "Market convention" },
    totalEstimatedRange: "~5%–6% of price beyond any agency commission (2% ITP + ~3% escribano, buyer's side)",
    sourceUrl: "https://portal.dgr.gub.uy/index.php/component/sppagebuilder/page/275"
  },
  bolivia: {
    transferTax: { rate: "3% flat", basis: "IMT (Impuesto Municipal a las Transferencias) — on the transfer value or the municipal fiscal appraisal, whichever is higher.", source: "Ley 843 (Título VI) / Decreto Supremo N° 24054" },
    registrationFees: { basis: "Derechos Reales (national property registry) charges its own registration fee, separate from IMT.", source: "Registro de Derechos Reales" },
    agencyCommission: { rate: "~3%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~3%–4% of price in IMT plus registration fees",
    sourceUrl: "https://www.gob.bo/tramites/registro-de-transferencias-onerosas-de-bienes-inmuebles"
  },
  ecuador: {
    transferTax: { rate: "1% of the tax base", basis: "Impuesto de Alcabala — set nationally at 1% by COOTAD Art. 535, on the higher of sale price or the municipal cadastral value.", source: "COOTAD Art. 535; collected by each GAD Municipal" },
    agencyCommission: { rateRange: "4%–5%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~1%–2% of price in alcabala + registration/notary fees",
    sourceUrl: "https://www.gob.ec/gadmsd/tramites/emision-impuesto-alcabalas-utilidades"
  },
  australia: {
    transferTax: { rateRange: "1%–7% (progressive, before any foreign-buyer surcharge)", basis: "Stamp duty / transfer duty — set independently by each state/territory on a progressive scale by property value. Foreign non-resident buyers pay an additional 7%–9% surcharge in most states (see Foreign Buyer Access).", source: "State/territory revenue offices (e.g. Revenue NSW)" },
    legalFees: { rateRange: "AUD 800–2,500 flat (typical)", basis: "Conveyancer/solicitor fee — not government-set.", source: "Market convention" },
    agencyCommission: { rateRange: "1.6%–2.5% (up to ~3.5% in some regional areas)", typicalPayer: "Seller", source: "Market convention (unregulated in every state)" },
    totalEstimatedRange: "1%–7% of price in stamp duty (state- and price-dependent) plus roughly AUD 1,500–3,000 in legal/conveyancing costs",
    sourceUrl: "https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty",
    // the property's own state (from the suburb match): duty computed on the
    // asking price from the state's official schedule — investor / general
    // rates (no first-home or owner-occupier concession), checked Oct 1 2026.
    // [upTo, base, % over from] — "flat" = % of the whole value.
    // South Australia: Revenue SA and the SA legislation site answer 403 to
    // servers → no schedule (said so).
    byAuState: {
      "New South Wales": { from: "2026–27 thresholds (indexed each 1 July)", who: "Revenue NSW", url: "https://www.revenue.nsw.gov.au/_resources/duties-links/current-thresholds-and-rates",
        b: [[18000, 0, 1.25, 0], [38000, 225, 1.5, 18000], [103000, 525, 1.75, 38000], [387000, 1662, 3.5, 103000], [1290000, 11602, 4.5, 387000], [3870000, 52237, 5.5, 1290000], [Infinity, 194137, 7.0, 3870000]], min: 20,
        foreign: "surcharge purchaser duty 9% of the dutiable value for a foreign person", fpct: 9 },
      "Victoria": { from: "rates for contracts from 1 July 2021 (non-principal place of residence)", who: "State Revenue Office Victoria", url: "https://www.sro.vic.gov.au/about-us/rates-and-statistics/current-rates/land-transfer-duty-non-principal-place-residence-current-rates",
        b: [[25000, 0, 1.4, 0], [130000, 350, 2.4, 25000], [960000, 2870, 6.0, 130000], [2000000, 0, 5.5, "flat"], [Infinity, 110000, 6.5, 2000000]],
        foreign: "foreign purchaser additional duty 8% of the dutiable value (contracts from 1 July 2019)", fpct: 8 },
      "Queensland": { from: "transfer duty general rates", who: "Queensland Revenue Office", url: "https://qro.qld.gov.au/duties/transfer-duty/calculate/rates/",
        b: [[5000, 0, 0, 0], [75000, 0, 1.5, 5000], [540000, 1050, 3.5, 75000], [1000000, 17325, 4.5, 540000], [Infinity, 38025, 5.75, 1000000]],
        foreign: "additional foreign acquirer duty 8% of the dutiable value", fpct: 8 },
      "Western Australia": { from: "general rate (applies to residential land from 1 July 2022)", who: "Department of Finance WA (RevenueWA)", url: "https://www.wa.gov.au/organisation/department-of-finance/transfer-duty-assessment",
        b: [[120000, 0, 1.9, 0], [150000, 2280, 2.85, 120000], [360000, 3135, 3.8, 150000], [725000, 11115, 4.75, 360000], [Infinity, 28453, 5.15, 725000]],
        foreign: "foreign transfer duty 7% on residential land (from 1 January 2019)", fpct: 7 },
      "Tasmania": { from: "rates for transfers on or after 21 October 2013", who: "State Revenue Office Tasmania", url: "https://www.sro.tas.gov.au/property-transfer-duties/rates-of-duty",
        b: [[3000, 50, 0, 0], [25000, 50, 1.75, 3000], [75000, 435, 2.25, 25000], [200000, 1560, 3.5, 75000], [375000, 5935, 4.0, 200000], [725000, 12935, 4.25, 375000], [Infinity, 27810, 4.5, 725000]],
        foreign: "foreign investor duty surcharge 8% on residential property (agreements from 1 April 2020)", fpct: 8 },
      "Australian Capital Territory": { from: "DI2026-155, Table 2 — not an eligible owner-occupier transaction, from 1 July 2026", who: "ACT Revenue Office (Taxation Administration (Amounts Payable—Duty) Determination 2026)", url: "https://legislation.act.gov.au/di/2026-155/",
        b: [[200000, 0, 1.2, 0], [300000, 2400, 2.2, 200000], [500000, 4600, 3.4, 300000], [750000, 11400, 4.32, 500000], [1000000, 22200, 5.9, 750000], [1455000, 36950, 6.4, 1000000], [Infinity, 0, 4.54, "flat"]],
        foreign: "the ACT duty determination sets no separate foreign-buyer duty rate", fpct: 0 },
      "Northern Territory": { from: "Stamp Duty Act 1978 Schedule 1 cl. 1, as in force at 1 July 2025", who: "Northern Territory Stamp Duty Act 1978", url: "https://legislation.nt.gov.au/Legislation/STAMP-DUTY-ACT-1978",
        nt: true, foreign: "the Stamp Duty Act sets no foreign-buyer surcharge", fpct: 0 }
    }
  },
  "new zealand": {
    transferTax: { rate: "0%", basis: "New Zealand abolished stamp duty on property transfers in 1999 — no government transfer tax at any price.", source: "Stamp Duty Abolition Act 1999" },
    registrationFees: { rate: "~NZD 122–200 flat", basis: "Toitū Te Whenua Land Information New Zealand (LINZ) title registration fee.", source: "Land Information New Zealand (LINZ)" },
    legalFees: { rateRange: "NZD 1,500–3,000 flat (typical)", basis: "Solicitor/conveyancing fees — not government-set.", source: "Market convention" },
    agencyCommission: { rateRange: "~3%–4% effective (commonly a tiered scale)", typicalPayer: "Seller", source: "Market convention — unregulated" },
    totalEstimatedRange: "No government transfer tax; budget roughly NZD 3,000–6,000 in legal/registration fees",
    sourceUrl: "https://www.legislation.govt.nz/act/public/1999/0061/latest/whole.html"
  },
  japan: {
    transferTax: { rateRange: "3% (land and residential dwellings, reduced rate through March 2027) / 4% (standard rate, non-residential buildings)", basis: "Real Estate Acquisition Tax — one-time prefectural tax on the property's assessed value, not the purchase price.", source: "Local Tax Act — administered by each prefectural tax office" },
    registrationFees: { rateRange: "0.3%–2.0%", basis: "Registration License Tax for ownership-transfer registration — standard 2.0%, reduced for land and for a qualifying owner-occupied home.", source: "National Tax Agency" },
    legalFees: { rate: "~JPY 100,000–150,000 flat (typical)", basis: "Judicial scrivener (shiho shoshi) fee for the registration filing.", source: "Market convention" },
    agencyCommission: { rate: "Legal maximum 3% + JPY 60,000 + consumption tax (properties over JPY 4 million)", typicalPayer: "Buyer and seller each pay their own agent", source: "Building Lots and Buildings Transaction Business Act — MLIT" },
    totalEstimatedRange: "~6%–8% of price total (acquisition tax + registration tax + judicial scrivener fee + brokerage commission)",
    sourceUrl: "https://www.mlit.go.jp/en/"
  },
  "south korea": {
    transferTax: { rateRange: "1%–3% (single home, tiered) — up to 8%–12% for a 2nd/3rd home or a home in a government-regulated area", basis: "Acquisition Tax, a local tax on the purchase price paid within 60 days of transfer, plus a Local Education Tax surtax (10% of the acquisition-tax amount).", source: "Local Tax Act — administered via the Wetax system" },
    agencyCommission: { rateRange: "0.4%–0.9% (government fee-schedule ceiling, tiered by price)", typicalPayer: "Buyer and seller each pay their own agent, up to the legal ceiling", source: "Licensed Real Estate Agents Act — MOLIT" },
    totalEstimatedRange: "~1.5%–4% of price for a typical single-home purchase, far higher for a 2nd/3rd home in a regulated area",
    sourceUrl: "https://www.nts.go.kr/english/index.do"
  },
  india: {
    transferTax: { rateRange: "3%–10%", basis: "Stamp duty on the sale deed — set by each state under its own Stamp Act, on the higher of the transaction price or the state's published guidance value. Most states discount for property registered solely in a woman's name.", source: "Indian Stamp Act, 1899, as amended by each state" },
    registrationFees: { rateRange: "~1% (often capped at a flat maximum in some states)", basis: "Registration fee for recording the sale deed, on top of stamp duty.", source: "Registration Act, 1908" },
    agencyCommission: { rateRange: "1%–2%", typicalPayer: "Varies by region", source: "Market convention" },
    totalEstimatedRange: "4%–11% of price (stamp duty + registration), varying drastically by state",
    sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2301"
  },
  indonesia: {
    transferTax: { rate: "Up to 5% (national ceiling; actual rate and non-taxable threshold set by each regional government)", basis: "Bea Perolehan Hak atas Tanah dan Bangunan (BPHTB) — regional duty on acquiring land/building rights, paid before the notary/PPAT executes the transfer deed.", source: "Law No. 1 of 2022 on Regional Tax and Retribution (HKPD Law)" },
    notaryFees: { rateRange: "~1% (typical, under a graduated maximum-fee schedule)", basis: "Notary/PPAT fee for drafting and executing the deed of sale.", source: "Ministry of Agrarian Affairs and Spatial Planning (ATR/BPN)" },
    totalEstimatedRange: "~6%–9% of price (BPHTB + notary/PPAT fee), plus 11% VAT if buying new-build directly from a developer",
    sourceUrl: "https://www.pajak.go.id/en"
  },
  thailand: {
    transferTax: { rate: "2%", basis: "Transfer fee, assessed on the Land Department's official appraised value (not the sale price), legally split 50/50 buyer/seller by default but commonly negotiated.", source: "Land Department, Ministry of Interior" },
    stampDuty: { rateRange: "0.5% (stamp duty) OR 3.3% Specific Business Tax instead — mutually exclusive", basis: "Specific Business Tax applies if the seller has owned the property under 5 years or it's a corporate sale; stamp duty applies otherwise.", source: "Revenue Department (Revenue Code)" },
    agencyCommission: { rateRange: "3%–5%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~2.5%–5.3% of appraised value (2% transfer fee + 0.5% stamp duty or 3.3% SBT)",
    sourceUrl: "https://www.dol.go.th/"
  },
  vietnam: {
    transferTax: { rate: "0.5%", basis: "Registration fee (lệ phí trước bạ) for registering the ownership certificate, on the higher of the actual transaction price or the province's own land price table.", source: "Decree 10/2022/ND-CP — General Department of Taxation" },
    legalFees: { rateRange: "~0.03%–0.1% (tiered, capped for high-value contracts)", basis: "Notarization fee, on a government-set sliding scale.", source: "Ministry of Justice notarization fee schedule" },
    agencyCommission: { rateRange: "1%–2%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~1%–2% of price (registration fee + notarization) — among the lowest in Asia",
    sourceUrl: "https://gdt.gov.vn/"
  },
  cambodia: {
    transferTax: { rate: "4%", basis: "Registration Tax (Transfer Tax) on transfer of ownership/occupancy rights, on the property's official transfer value; direct-relative transfers exempt. Legally the buyer's liability, often paid by the seller in practice.", source: "Law on Taxation — General Department of Taxation (GDT)" },
    agencyCommission: { rate: "~3%", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~4%–5% of price (mostly the 4% registration tax)",
    sourceUrl: "https://www.tax.gov.kh/en"
  },
  "sri lanka": {
    transferTax: { rateRange: "3%–4% (3% on the first Rs. 100,000 of the deed's value, 4% on the remainder)", basis: "Stamp duty on the deed of transfer, on the higher of the deed price or government-assessed market value — a devolved subject collected by each Provincial Department of Revenue. Buyer-paid by convention.", source: "Stamp Duty (Special Provisions) Act — Provincial Departments of Revenue" },
    totalEstimatedRange: "~3%–4% of price in stamp duty (plus a notary's fee, not government-fixed)",
    sourceUrl: "https://www.ird.gov.lk/en/type%20of%20taxes/sitepages/stampduty.aspx"
  },
  finland: {
    transferTax: { rateRange: "1.5% (asunto-osake / housing-company shares, e.g. most apartments) / 3% (kiinteistö / real property — house + land)", basis: "Varainsiirtovero, paid by the buyer on the debt-free price (purchase price plus the buyer's share of any housing-company loan). Reduced from 2%/4% by a reform effective 12 Oct 2023 / 1 Jan 2024; the first-time-buyer exemption was abolished at the same time.", source: "Finnish Tax Administration (Vero)" },
    registrationFees: { rate: "~€161 flat (lainhuuto / title registration)", basis: "National Land Survey of Finland (Maanmittauslaitos) registration-of-ownership fee — applies to real property (kiinteistö) purchases only; housing-company share purchases don't require this step.", source: "National Land Survey of Finland (Maanmittauslaitos)" },
    agencyCommission: { rateRange: "3%–4.5% (commonly ~4%) + VAT", typicalPayer: "Seller", source: "Market convention" },
    totalEstimatedRange: "~1.5%–3% of price in transfer tax (shares vs. real property) plus a small fixed registration fee; agency commission is seller-paid",
    sourceUrl: "https://www.vero.fi/en/individuals/property/transfer-tax/"
  },
  ireland: {
    stampDuty: { rateRange: "1% up to €1,000,000 / 2% on the portion €1,000,000–€1,500,000 / 6% on any excess above €1,500,000 (residential)", basis: "Stamp duty on the purchase price of residential property; these bands have applied since 2 Oct 2024 and were unchanged by Budget 2026. A separate, much higher 15% rate applies to bulk purchases of 10+ houses by institutional investors — not relevant to an individual buyer.", source: "Revenue (Irish Tax and Customs)" },
    legalFees: { rateRange: "€1,200–€2,500 + 23% VAT (typical range), plus outlays", basis: "Conveyancing solicitor fees — not fixed by law, freely negotiated.", source: "Law Society of Ireland (market guidance)" },
    registrationFees: { rateRange: "€400–€800 (fixed scale by price band)", basis: "Tailte Éireann (the merged Land Registry/valuation/mapping agency) fee to register the transfer of ownership, under the Land Registration Fees Order 2012.", source: "Tailte Éireann" },
    agencyCommission: { rateRange: "1%–2.5% + 23% VAT", typicalPayer: "Seller", source: "Market convention (agents are PSRA-licensed, but the rate itself is not government-set)" },
    totalEstimatedRange: "~2%–4% of price beyond the price itself for a sub-€1m home (stamp duty + legal + registration); rises sharply once price passes €1.5m",
    sourceUrl: "https://www.revenue.ie/en/property/stamp-duty/property/stamp-duty-property/rates.aspx"
  },
  luxembourg: {
    transferTax: { rate: "7% combined (6% droits d'enregistrement + 1% droit de transcription)", basis: "Levied on the purchase price, paid by the buyer. Owner-occupiers get the \"Bëllegen Akt\" tax credit — up to €40,000 per buyer (up to €80,000 for a couple buying jointly, 2026 figure) — which refunds/offsets this tax up to that cap, conditional on personally occupying the home (2 years, or 4 years for a self-build).", source: "Administration de l'enregistrement, des domaines et de la TVA (AED)" },
    notaryFees: { rateRange: "1.65% up to €7,500 / 1.10% from €7,500–€15,000 / 0.825% from €15,000–€30,000 / 0.55% above €30,000 (degressive statutory scale)", basis: "Émoluments notariaux — a regulated degressive fee schedule fixed by grand-ducal regulation, plus disbursements.", source: "Chambre des Notaires du Grand-Duché de Luxembourg" },
    agencyCommission: { rateRange: "3%–6% (commonly ~3%) + 17% VAT", typicalPayer: "Seller by default; a buyer who separately hires a search agent pays that agent's fee themselves", source: "Market convention" },
    totalEstimatedRange: "~7%–10% of price before the Bëllegen Akt credit — which can bring the effective net cost close to €0 up to €40,000/€80,000 per buyer on an owner-occupied home",
    sourceUrl: "https://pfi.public.lu/fr/citoyen/enregistrement/tarif.html"
  },
  iceland: {
    stampDuty: { rateRange: "0.8% (individual buyer) / 1.6% (legal entity) / 0.4% (first-time individual buyer — 50% reduction)", basis: "Stimpilgjald, paid when the title deed (afsal) is registered, on the higher of the purchase price or the property's official fasteignamat (assessed value), under the Stamp Duty Act no. 138/2013.", source: "Government of Iceland / Sýslumenn (District Commissioners)" },
    registrationFees: { rate: "ISK 3,800 flat per document (þinglýsingargjald)", basis: "Fixed registration fee charged by the sýslumaður to record the deed.", source: "Sýslumenn (District Commissioners) fee schedule" },
    agencyCommission: { rateRange: "~1.5%–2.8% (commonly ~2%) + 24% VAT", typicalPayer: "Seller", source: "Market convention (competition law bars agencies from coordinating rates)" },
    totalEstimatedRange: "~1%–2% of price in stamp duty + registration (buyer-side); agency commission is seller-paid",
    sourceUrl: "https://www.stjornarradid.is/verkefni/efnahagsmal/tekjur-rikissjods/skattar-og-thjonustugjold-einstaklinga/stimpilgjald/"
  },
  monaco: {
    transferTax: { rateRange: "4.5% (purchase by an individual, or by a Monaco-registered \"transparent\" civil real-estate company owned by individuals) / 6.5%–7.5% (purchase via a non-transparent or foreign corporate structure)", basis: "Droits d'enregistrement on the transfer of real estate or real-estate-company shares, under Loi n° 1.381 du 29 juin 2011 (as amended); paid by the buyer.", source: "Direction des Services Fiscaux (Monaco) / Légimonaco" },
    notaryFees: { rate: "~1.5%", basis: "Notarial fee (études notariales), plus disbursements.", source: "Notaires de Monaco" },
    agencyCommission: { rateRange: "3%–5% + TVA", typicalPayer: "Buyer — unusually, Monaco market convention has the buyer pay the agency fee, not the seller", source: "Market convention" },
    totalEstimatedRange: "~6%–10% of price for an individual buyer; materially higher through a non-transparent/foreign corporate structure",
    sourceUrl: "https://legimonaco.mc/tnc/loi/2011/06-29-1.381/"
  },
  belarus: {
    transferTax: { rate: "0% — no ad valorem transfer tax", basis: "Belarus charges no stamp duty/transfer tax on a sale; the buyer instead pays flat state duties for notarization and registration, both tied to the annually-revalued 'base value' rather than a % of price.", source: "Ministry of Taxes and Duties of the Republic of Belarus (nalog.gov.by)" },
    registrationFees: { basis: "State duty (a flat fee tied to the 'base value' — bazavaya velichina — not a % of price) for registering the transfer of ownership with the National Cadastre Agency, under Appendix 19 to the Tax Code.", source: "Ministry of Taxes and Duties of the Republic of Belarus (nalog.gov.by)" },
    notaryFees: { rateRange: "0.6 base values (unrelated parties) / 2 base values (close relatives) — flat, not a % of price", basis: "State duty for notarial certification of the real-estate sale-purchase contract, set in multiples of the base value under Appendix 19 to the Tax Code.", source: "Ministry of Taxes and Duties of the Republic of Belarus (nalog.gov.by)" },
    agencyCommission: { rateRange: "1%–5%", typicalPayer: "Varies — seller, buyer, or split by agreement", source: "Market convention" },
    totalEstimatedRange: "well under 1% of price in flat state duties/notary fees — no ad valorem transfer tax",
    foreignBuyerNote: "Foreign individuals/entities cannot own land outright (only lease it, except inside the Great Stone Industrial Park) and are barred from acquiring agricultural land, but may buy apartments and standalone buildings. Under Resolution No. 27 (Jan 2024, replacing Resolution No. 436), an investor connected to a state Belarus designates 'unfriendly' must get prior government permission to sell Belarusian real estate/shares and pay a fee of at least 25% of market value to the state.",
    sourceUrl: "https://nalog.gov.by/individuals/other_taxes/government_duty/"
  },
  russia: {
    transferTax: { rate: "0% — no ad valorem transfer tax", basis: "Russia levies no stamp duty/transfer tax on a purchase; the buyer instead pays a flat state registration duty.", source: "Federal Tax Service (ФНС России) / Rosreestr" },
    registrationFees: { rateRange: "RUB 2,000–4,000 flat (individual buyer, typical apartment)", basis: "Gosposhlina paid to Rosreestr to register the transfer of title — historically a flat RUB 2,000 for individuals; a 2025 reform ties certain filings to the property's cadastral value/type.", source: "Rosreestr (Federal Service for State Registration, Cadastre and Cartography)" },
    notaryFees: { rateRange: "0.5%–1.5% (only when notarization is legally required, e.g. shared/fractional ownership — an ordinary sale uses a simple written contract)", basis: "Not a universal statutory scale; notarization is mandated only for specific transaction types under Russian civil law.", source: "Market convention" },
    agencyCommission: { rateRange: "2%–5%", typicalPayer: "Buyer, by convention, for residential resale", source: "Market convention" },
    totalEstimatedRange: "well under 1% of price in flat registration duty, plus notary fees only if legally required",
    foreignBuyerNote: "Foreign individuals may generally buy residential/commercial property on the same terms as citizens, but cannot own (only lease) land in border zones, agricultural land, or land tied to seaport territory (Land Code of the RF). Since Presidential Decree No. 81 (1 March 2022, 'On Additional Temporary Economic Measures'), a transaction creating real-estate ownership involving a person connected to an 'unfriendly' state requires prior permission from the Government Commission for Control over Foreign Investment, with proceeds typically routed through a restricted 'C-type' ruble account.",
    sourceUrl: "https://rosreestr.gov.ru/"
  },
  kazakhstan: {
    transferTax: { rate: "0% — no ad valorem transfer tax", basis: "No stamp duty/transfer tax on a sale between individuals; the buyer pays a state registration fee plus a notary tariff instead.", source: "State Revenue Committee, Ministry of Finance of the Republic of Kazakhstan (kgd.gov.kz)" },
    registrationFees: { rateRange: "0.1% of the contract value, minimum 1 MRP (monthly calculation index)", basis: "State fee for registering the transfer of real-estate rights, paid at a CON (Public Service Center) or via a notary.", source: "Electronic Government of the Republic of Kazakhstan (egov.kz)" },
    notaryFees: { rate: "12 MRP (≈ KZT 51,900 in 2026) for an ordinary non-relative individual-to-individual sale; reduced tariffs for close relatives/rural areas; 4 MRP when mortgage-financed", basis: "Notarial tariff set by Ministry of Justice order for certifying the sale contract; MRP is a national index (KZT 4,325 in 2026).", source: "Ministry of Justice of the Republic of Kazakhstan — adilet.zan.kz (Order V2500036957)" },
    agencyCommission: { rateRange: "2%–6%", typicalPayer: "Varies by region/agreement — either party or both", source: "Market convention" },
    totalEstimatedRange: "well under 1% of price in registration + notary fees — no ad valorem transfer tax",
    sourceUrl: "https://egov.kz/cms/en/articles/buy_sale/purchase_of_real_estate"
  },
  kyrgyzstan: {
    transferTax: { rate: "0% — no ad valorem transfer tax", basis: "Kyrgyzstan charges no stamp duty/transfer tax on a sale; the buyer instead pays a flat state duty to register the ownership transfer.", source: "State Registration Service (Gosregistr)" },
    registrationFees: { basis: "Flat state duty (not a % of price) paid to register the ownership transfer with Gosregistr, tiered by payment method and party type — the cash-payment duty was raised roughly 10-fold under a Cabinet of Ministers decision effective mid-2024.", source: "Cabinet of Ministers of the Kyrgyz Republic, Resolution No. 159 of 15 April 2019 (as amended); State Registration Service (Gosregistr)" },
    notaryFees: { rateRange: "commonly reported at ~0.5% of transaction value, minimum ~1,000 KGS (market-reported, not confirmed against the primary tariff schedule)", basis: "Mandatory notarial certification of the sale contract; this figure could not be confirmed against the primary 'On State Duty' tariff schedule.", source: "Market convention / conveyancing guides (not government-verified)" },
    agencyCommission: { rateRange: "2%–5%", typicalPayer: "Varies", source: "Market convention" },
    totalEstimatedRange: "roughly 1%–2% of price in flat registration duty + notary fee — no ad valorem transfer tax",
    sourceUrl: "https://grs.gov.kg/"
  },
  uzbekistan: {
    transferTax: { rate: "0% — no ad valorem transfer tax", basis: "No stamp duty/transfer tax as such; a flat state duty is charged instead for the mandatory notarization of the sale-purchase contract.", source: "Government portal of the Republic of Uzbekistan (gov.uz)" },
    notaryFees: { rateRange: "1 BRV (base calculation value) — property in Tashkent, Nukus or a regional center / 0.5 BRV — elsewhere; flat, not a % of price", basis: "State duty for notarizing a real-estate sale contract, unified to a flat fee (replacing an older scale of up to 3 BRV that varied with floor area, and an even older percentage-of-price regime) under Law No. ЗРУ-808-сон (6 Dec 2022, in force from 7 Dec 2022) amending the Law 'On State Duty'.", source: "Law of the Republic of Uzbekistan 'On State Duty' — lex.uz" },
    agencyCommission: { rateRange: "2%–3%", typicalPayer: "Commonly the seller", source: "Market convention" },
    totalEstimatedRange: "well under 1% of price in flat notary/state-duty fees — no ad valorem transfer tax",
    foreignBuyerNote: "Citizens of 108 listed countries may buy completed or under-construction residential real estate (not land) without a residence permit, subject to minimum values (from roughly USD 100,000–400,000 depending on region, highest in Tashkent) under rules the government has revised more than once since 2022 — verify the current threshold before relying on it.",
    sourceUrl: "https://gov.uz/en"
  },
  // Oct 1 2026: gaps found by diffing tonight's Foreign Buyer Access
  // additions against this file's existing coverage, then researched to
  // the same bar as every other entry here.
  nigeria: {
    transferTax: { rateRange: "about 2.5%–3.5% combined (Lagos reference figures)", basis: "No single national transfer tax — the real cost is a state-set stack of Governor's Consent fee (commonly 1%–3% of assessed value, state-dependent; Lagos: 1.5%), stamp duty (Lagos: a flat 2% applied when seeking Governor's Consent on the transfer), and a registration fee (Lagos: 0.5%). Other states set their own consent/registration percentages under the Land Use Act, so the total varies by state.", source: "Lagos State Lands Bureau; Land Use Act 1978" },
    totalEstimatedRange: "~3%–3.5% of price in Lagos (Governor's Consent + stamp duty + registration); other states vary — legal fees not included",
    sourceUrl: "https://landsbureau.lagosstate.gov.ng/"
  },
  paraguay: {
    transferTax: { rateRange: "0.3%–0.5%", basis: "Impuesto a la Transferencia Municipal (ITM), a municipal tax on the change of ownership, set within this range by the municipality where the property is located.", source: "Municipal tax ordinances (Ordenanza General de Tributos Municipales), Paraguay" },
    registrationFees: { rate: "0.8%", basis: "Tasa de Inscripción Registral — Dirección General de los Registros Públicos inscription fee.", source: "Dirección General de los Registros Públicos, Paraguay" },
    totalEstimatedRange: "roughly 1.1%–1.3% of price (municipal transfer tax + registry inscription), before notary/escritura fees (conventionally split between buyer and seller, not included here)",
    sourceUrl: "https://www.dnit.gov.py/"
  },
  "san marino": {
    transferTax: { rate: "5%", basis: "Imposta di registro (proportional registration tax) on the sale/onerous transfer of real estate — the general rate for an ordinary resale; a first purchase directly from a builder instead carries San Marino's single-phase consumption tax at 17% in place of this registration rate. Mortgage tax and cadastral tax apply as smaller additional fixed/proportional amounts, and a non-resident foreign buyer specifically owes a government concession tax on top.", source: "Repubblica di San Marino — registration-tax legislation (Decreti Delegati)" },
    totalEstimatedRange: "about 5%+ of price for an ordinary resale (registration tax, before notary fees and the smaller mortgage/cadastral taxes); 17% for a new build bought directly from the developer",
    sourceUrl: "https://www.consigliograndeegenerale.sm/"
  },
  liechtenstein: {
    transferTax: { rate: "0% — no ad valorem transfer/stamp tax", basis: "Liechtenstein has no German-style Grunderwerbsteuer on an ordinary purchase; the real-estate-specific tax that exists (Grundstücksgewinnsteuer, under the Tax Act) is a capital GAINS tax on the seller's profit at resale, not a buyer-side cost at purchase.", source: "Tax Act (Steuergesetz, SteG), Liechtenstein" },
    registrationFees: { rate: "0.6% (6‰), minimum CHF 200", basis: "Land Register fee (Grundbuchgebühr) for registering an acquisition of property, a property share, or a building right — 6 per thousand of the purchase price (or the tax-assessed value if no price is stated), per transfer.", source: "Verordnung vom 11. Februar 2003 über die Grundbuch- und Handelsregistergebühren (LGBl. 2003 Nr. 67), Annex 1, Section B — Office of Justice" },
    totalEstimatedRange: "about 0.6% of price (Land Register fee, minimum CHF 200) — no separate transfer/stamp tax; notary and Grundverkehr approval costs not included here",
    sourceUrl: "https://www.llv.li/en/national-administration/office-of-justice/land-register"
  },
  maldives: {
    transferTax: { rate: "15%", basis: "Tax on the transfer of land (dwelling or land sold), per the Maldives Inland Revenue Authority's framework — this is the land-transfer case specifically; since the Constitution bars foreign freehold land ownership, a foreign buyer's actual transaction is normally a leasehold/unit assignment under project-specific terms rather than an ordinary land transfer, so verify which structure and tax actually applies to a given development before relying on this figure.", source: "Maldives Inland Revenue Authority (MIRA)" },
    registrationFees: { rate: "MVR 500 flat", basis: "Fixed stamp duty payable at registration.", source: "Maldives Inland Revenue Authority (MIRA)" },
    totalEstimatedRange: "15% of transaction value plus a flat MVR 500 for an ordinary land transfer; a foreign buyer's leasehold/unit purchase may follow different, project-specific terms",
    sourceUrl: "https://www.mira.gov.mv/"
  }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

// Data-honesty filter (Sept 30 2026): a fee line whose only source is
// "market convention" / non-binding guidance / surveys is not an official
// figure → it is dropped, and so is the total (the totals were written
// including those lines, so they cannot be kept). What stays: taxes and
// fees set by law or an official body. `omittedUnofficial` lists what was
// left out so the report can say so.
const UNOFFICIAL = /market convention|market guidance|non-binding|not government-verified|surveys/i;
function officialOnly(out) {
  const omitted = [];
  for (const [k, v] of Object.entries(out)) {
    if (v && typeof v === "object" && UNOFFICIAL.test(String(v.source || ""))) { omitted.push(k); delete out[k]; }
  }
  if (omitted.length) { out.totalEstimatedRange = null; out.omittedUnofficial = omitted; }
  return out;
}

// duty from a bracket schedule [upTo, base, % over from] ("flat" = % of the
// whole value); the NT uses its statutory formula up to $525,000
function auDuty(au, v) {
  if (!(v > 0)) return null;
  if (au.nt) { const V = v / 1000; return v <= 525000 ? 0.06571441 * V * V + 15 * V : v * (v < 3000000 ? 4.95 : v < 5000000 ? 5.75 : 5.95) / 100; }
  const b = au.b.find(([upTo]) => v <= upTo);
  const d = b[3] === "flat" ? v * b[2] / 100 : b[1] + (v - b[3]) * b[2] / 100;
  return Math.max(d, au.min || 0);
}

export function getClosingCosts(country, opts) {
  const r = closingCostsRaw(country, opts);
  return r ? officialOnly({ ...r }) : null;
}

function closingCostsRaw(country, { state, price } = {}) {
  const entry = COSTS[normalizeCountry(country)];
  if (!entry) return null;
  const { byState, byNation, byAuState, ptImt, tiers, ...out } = entry;
  // marginal bands on the asking price (Singapore BSD) + a flat foreign surcharge
  if (tiers && price > 0) {
    let duty = 0, lo = 0;
    for (const [hi, pc] of tiers.bands) { if (price > lo) duty += (Math.min(price, hi) - lo) * pc / 100; lo = hi; }
    duty = Math.floor(duty);
    const m = (n) => `${tiers.cur}${Math.round(n).toLocaleString("en-US")}`;
    const pct = (n) => `${Number(n.toFixed(2))}%`;
    const f = tiers.foreignPct ? price * tiers.foreignPct / 100 : null;
    out.transferTax = { ...out.transferTax, rate: `${tiers.name} ${m(duty)} (${pct(duty / price * 100)} of ${m(price)})${f ? `; ${tiers.foreignName} ${m(f)} (${tiers.foreignPct}%)` : ""}`, rateRange: undefined };
    out.totalEstimatedRange = `${pct(duty / price * 100)} of price in ${tiers.name}${f ? ` (${pct(duty / price * 100 + tiers.foreignPct)} for a foreign buyer with ${tiers.foreignName})` : ""}, plus legal fees`;
  }
  // Portugal: IMT on the asking price (investment / second-home table) + 0.8% stamp duty
  if (ptImt && price > 0) {
    let imt;
    const last = ptImt.bands[ptImt.bands.length - 1][0];
    if (price <= ptImt.bands[0][0]) imt = price * ptImt.bands[0][1] / 100;
    else if (price <= last) {
      const k = ptImt.bands.findIndex(([lim]) => price <= lim);
      const [prevLim, , prevAvg] = ptImt.bands[k - 1];
      imt = prevLim * prevAvg / 100 + (price - prevLim) * ptImt.bands[k][1] / 100;
    } else imt = price * ptImt.single.find(([lim]) => price <= lim)[1] / 100;
    const eur = (n) => `€${Math.round(n).toLocaleString("en-US")}`;
    const pct = (n) => `${Number(n.toFixed(2))}%`;
    out.transferTax = { ...out.transferTax, rate: `IMT ${eur(imt)} (${pct(imt / price * 100)} of ${eur(price)}) + stamp duty ${eur(price * 0.008)} (0.8%)`, rateRange: undefined };
    out.totalEstimatedRange = `${pct(imt / price * 100 + 0.8)} of price in IMT and stamp duty (investment / second-home rates; a buyer domiciled in a listed tax haven pays 10% IMT), plus registry, notary and lawyer fees`;
  }
  // Australia: the state's own duty on the asking price
  const au = byAuState && state ? byAuState[state] : null;
  if (byAuState && state === "South Australia") {
    out.transferTax = { ...out.transferTax, basis: `${out.transferTax.basis} South Australia's schedule could not be read from Revenue SA (its site does not answer automated requests) — check revenuesa.sa.gov.au.` };
  }
  if (au) {
    const duty = auDuty(au, price);
    const aud = (n) => `AUD ${Math.round(n).toLocaleString("en-US")}`;
    const pct = (n) => `${Number(n.toFixed(2))}%`;
    out.transferTax = {
      rate: duty != null ? `${aud(duty)} (${pct(duty / price * 100)} of ${aud(price)}) — ${state}${au.fpct ? `; a foreign buyer pays ${au.fpct}% more (${aud(price * au.fpct / 100)})` : ""}` : `${state}: see schedule`,
      basis: `${state} transfer duty, ${au.from}, computed on the asking price from the official schedule (investor rates — no first-home or owner-occupier concession; the state may assess on market value if higher). ${au.foreign[0].toUpperCase()}${au.foreign.slice(1)}${au.fpct && price ? ` (${aud(price * au.fpct / 100)} on this price)` : ""}.`,
      source: au.who
    };
    out.sourceUrl = au.url;
    out.totalEstimatedRange = duty != null ? `${pct(duty / price * 100)} of price in ${state} transfer duty${au.fpct ? ` (${pct(duty / price * 100 + au.fpct)} for a foreign buyer)` : ""}, plus conveyancing and registration fees` : out.totalEstimatedRange;
  }
  // UK: Scotland and Wales have their own transfer taxes
  if (byNation && state && byNation[state]) { const n = byNation[state]; return { ...out, ...n, transferTax: n.transferTax, legalFees: out.legalFees, agencyCommission: out.agencyCommission }; }
  // the property's own state known (Germany): its rate, not the range
  const st = byState && state ? byState[state] : null;
  if (st) {
    const pct = (x) => `${Number(x.toFixed(2))}%`;
    out.transferTax = { ...out.transferTax, rate: pct(st.rate), rateRange: undefined, basis: `Grunderwerbsteuer in ${state}: ${pct(st.rate)} of the price (since ${st.since}); the rate is set by each federal state.` };
    out.totalEstimatedRange = `${pct(st.rate + 2)}–${pct(st.rate + 2.5 + 3.57)} of price (${pct(st.rate)} transfer tax + notary and land registry, plus up to 3.57% as the buyer's half of an agent's commission)`;
  }
  return out;
}
