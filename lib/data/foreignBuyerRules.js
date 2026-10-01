/* PRADIXIUM™ — Foreign Buyer Access rules
 * A distinguishing feature for a platform built around the foreign-buyer
 * market: does this country let a non-resident foreign national actually
 * buy this kind of property, and is there a cost or approval step that
 * applies ONLY to foreign buyers (an ownership ban, ownership cap, permit
 * requirement, or foreign-buyer tax surcharge)?
 *
 * Same honesty discipline as every other data source in this project:
 * only countries with a verifiable, citable rule are listed here — every
 * other country stays silent (no card shown) rather than assuming "no
 * restriction" without having checked. These are structural ownership
 * rules, not prices, so they change far less often than a market index —
 * but law can still change, so every entry links back to its primary
 * source and the UI should tell users to verify before relying on it.
 *
 * A growing set of entries (Singapore, Philippines, Malaysia, and — added
 * Oct 1 2026 — Saudi Arabia, Qatar, Kuwait, China, Hong Kong, Taiwan) cover
 * markets not yet in the country dropdown/COUNTRY_ENDPOINTS (see
 * api/orchestrator.js) — kept here ready to go live the moment each market
 * gets a full data adapter (price/tax/closing-cost coverage), since the
 * Foreign Buyer Access research is already done; they're simply
 * unreachable in an actual property report until then. Building that full
 * adapter is separate, much larger work (the US alone took ~2 weeks) —
 * this file only ever carries the foreign-ownership-rule piece.
 */
const RULES = {
  canada: {
    status: "RESTRICTED",
    summary: "Non-Canadians are banned from buying most residential properties (3 units or fewer) in urban areas until January 1, 2027. Permanent residents, protected persons, and work-permit holders with 183+ days of validity remaining are exempt.",
    extraCost: "N/A — purchase may be barred outright rather than taxed",
    source: "Prohibition on the Purchase of Residential Property by Non-Canadians Act",
    sourceUrl: "https://laws-lois.justice.gc.ca/eng/acts/P-25.2/page-1.html"
  },
  australia: {
    status: "RESTRICTED",
    summary: "Foreign persons, including temporary residents, are banned from buying established dwellings until June 30, 2029. Foreign buyers may still buy new/near-new dwellings or vacant land for development with Foreign Investment Review Board (FIRB) approval.",
    extraCost: "FIRB application fee (varies by price) plus, in most states, an 8% foreign buyer stamp duty surcharge",
    source: "Australian Taxation Office / Foreign Investment Review Board",
    sourceUrl: "https://foreigninvestment.gov.au/news-and-reports/news/changes-foreign-purchases-established-dwellings"
  },
  "new zealand": {
    status: "RESTRICTED",
    summary: "Non-resident foreign buyers are generally barred from buying existing homes under the Overseas Investment Act. Australian and Singaporean citizens/residents are exempt under trade treaties; some new-build apartments may also qualify.",
    extraCost: "N/A — purchase is generally barred rather than taxed, outside treaty exemptions",
    source: "Overseas Investment Act 2005 (Land Information New Zealand)",
    sourceUrl: "https://www.linz.govt.nz/overseas-investment/individual-overseas-investors/buying-residential-land"
  },
  switzerland: {
    status: "RESTRICTED",
    summary: "Non-resident foreign nationals need a cantonal permit under the Lex Koller law to buy residential property, subject to a limited annual national quota. EU/EFTA citizens who are Swiss residents are generally exempt.",
    extraCost: "Cantonal permit process; permits are limited and can take months to obtain",
    source: "Federal Act on the Acquisition of Real Estate by Persons Abroad (Lex Koller)",
    sourceUrl: "https://www.fedlex.admin.ch/eli/cc/1974/1998_1998_1998/en"
  },
  mexico: {
    status: "WORKAROUND REQUIRED",
    summary: "Within the 'Restricted Zone' (50km of the coast or 100km of a border), foreign buyers cannot hold direct title — they must purchase through a bank trust (fideicomiso) or a Mexican corporation. Outside that zone, foreigners can hold direct title.",
    extraCost: "Fideicomiso setup plus an annual bank trustee fee, typically USD 500-700/year",
    source: "Mexican Constitution Article 27 / Ministry of Economy (Secretaría de Economía)",
    sourceUrl: "https://www.gob.mx/se"
  },
  thailand: {
    status: "RESTRICTED",
    summary: "Foreigners cannot own land in Thailand. Condominium units can be foreign-owned, but only up to 49% of a building's total saleable floor area — the remaining 51%+ must stay Thai-owned.",
    extraCost: "N/A — a structural ownership cap, not a tax",
    source: "Thailand Condominium Act B.E. 2522",
    sourceUrl: "https://www.dol.go.th/"
  },
  singapore: {
    status: "TAX SURCHARGE",
    summary: "Foreign non-resident buyers can purchase most private property, but pay a steep Additional Buyer's Stamp Duty (ABSD) on top of the standard stamp duty. Public HDB flats remain off-limits to foreigners.",
    extraCost: "60% Additional Buyer's Stamp Duty (ABSD) on the purchase price",
    source: "Inland Revenue Authority of Singapore (IRAS)",
    sourceUrl: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-selling-property/what-is-stamp-duty/additional-buyer's-stamp-duty-(absd)"
  },
  denmark: {
    status: "RESTRICTED",
    summary: "Non-resident buyers who are not EU/EEA citizens (or who have not lived in Denmark for 5 years in total) generally need permission from the Danish Ministry of Justice before buying residential property.",
    extraCost: "N/A — approval is required rather than a tax",
    source: "Danish Act on the Acquisition of Real Property (Ministry of Justice)",
    sourceUrl: "https://www.justitsministeriet.dk/"
  },
  vietnam: {
    status: "RESTRICTED",
    summary: "Foreigners may only buy within licensed housing projects, capped at 30% of units in an apartment building or 10% of houses in a landed project, generally on a renewable leasehold basis (typically 50 years).",
    extraCost: "N/A — a structural ownership cap, not a tax",
    source: "Vietnam Law on Residential Housing (2023, effective 2024)",
    sourceUrl: "https://vanban.chinhphu.vn/"
  },
  philippines: {
    status: "RESTRICTED",
    summary: "Foreigners cannot own land in the Philippines but may own condominium units, capped at 40% of the total floor area of a given condominium project.",
    extraCost: "N/A — a structural ownership cap, not a tax",
    source: "Philippine Condominium Act (Republic Act 4726)",
    sourceUrl: "https://hlurb.gov.ph/"
  },
  "united arab emirates": {
    status: "OPEN",
    summary: "In Dubai's designated freehold zones (and similar zones in other emirates), foreign nationals can hold full freehold title with no ownership restriction.",
    extraCost: "None beyond the standard 4% Dubai Land Department transfer fee paid by all buyers",
    source: "Dubai Land Department",
    sourceUrl: "https://dubailand.gov.ae/"
  },
  "united states": {
    status: "OPEN",
    summary: "No federal restriction on foreign nationals buying US residential real estate. A small number of states restrict land purchases by certain foreign governments/entities near military or agricultural sites — not typical individual homebuyers.",
    extraCost: "None specific to foreign buyers (standard closing costs apply; FIRPTA withholding applies on a later resale)",
    source: "US Department of the Treasury / Committee on Foreign Investment in the United States (CFIUS)",
    sourceUrl: "https://home.treasury.gov/policy-issues/international/the-committee-on-foreign-investment-in-the-united-states-cfius"
  },
  "united kingdom": {
    status: "OPEN",
    summary: "No restriction on foreign ownership of UK residential property. Since 2023, overseas entities that own UK property must register their beneficial owners on a public register.",
    extraCost: "2% non-resident Stamp Duty Land Tax surcharge (England/Northern Ireland) on top of standard rates",
    source: "UK Register of Overseas Entities / HM Revenue & Customs",
    sourceUrl: "https://www.gov.uk/guidance/register-an-overseas-entity"
  },
  japan: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Japanese real estate, including residency status — among the most open property markets in the world. There is no minimum residency, visa, or citizenship requirement to hold title.",
    extraCost: "None specific to foreign buyers beyond standard registration/acquisition taxes all buyers pay",
    source: "Ministry of Land, Infrastructure, Transport and Tourism (MLIT)",
    sourceUrl: "https://www.mlit.go.jp/en/"
  },
  "south korea": {
    status: "OPEN",
    summary: "Foreign nationals can buy most residential property in South Korea, subject to a real-estate acquisition report filed with the local district office within 60 days of signing the contract (a reporting requirement, not an approval gate). A small number of designated military/border/cultural-heritage zones require prior permission.",
    extraCost: "None specific to foreign buyers beyond the standard acquisition tax all buyers pay",
    source: "Act on Report on Real Estate Transactions, Etc. (South Korea)",
    sourceUrl: "https://www.reb.or.kr/rebEng/main.do"
  },
  india: {
    status: "RESTRICTED",
    summary: "A foreign national who is not a Person of Indian Origin (PIO) or Non-Resident Indian (NRI), and who is not resident in India, generally cannot acquire immovable property in India without specific Reserve Bank of India approval. NRIs and Overseas Citizens of India (OCI) can freely buy residential/commercial property (agricultural land and plantations excepted).",
    extraCost: "N/A — approval requirement rather than a tax, for non-NRI/OCI foreign nationals",
    source: "Reserve Bank of India — Foreign Exchange Management Act (FEMA) regulations",
    sourceUrl: "https://www.rbi.org.in/"
  },
  "sri lanka": {
    status: "RESTRICTED",
    summary: "Foreign nationals (and foreign-majority-owned companies) are barred from buying freehold land outright — land can only be acquired on a lease of up to 99 years. Condominium apartment units, however, can be bought with full freehold ownership if paid for via an inward foreign remittance.",
    extraCost: "None specific beyond standard VAT (18%, as of 2024) on primary-market condominium purchases — the special land-lease tax on foreigners was repealed in 2017",
    source: "Land (Restrictions on Alienation) Act (Sri Lanka)",
    sourceUrl: "https://www.cbsl.gov.lk/"
  },
  cambodia: {
    status: "RESTRICTED",
    summary: "Foreigners cannot own land in Cambodia, but may own condominium units — capped at 70% of the total units in a given co-owned building, and never on the ground floor.",
    extraCost: "N/A — a structural ownership cap, not a tax",
    source: "Law on Foreign Ownership (2010, Cambodia)",
    sourceUrl: "https://www.nbc.gov.kh/"
  },
  indonesia: {
    status: "RESTRICTED",
    summary: "Foreigners cannot hold freehold (Hak Milik) title. Since 2021 reforms, a foreign individual resident in Indonesia can hold a 'Hak Pakai' (right-of-use) title directly on a landed house or apartment/condo unit above a regional minimum price threshold — a workaround, not full ownership.",
    extraCost: "N/A — a title-type restriction rather than a tax",
    source: "Government Regulation 18/2021 (Indonesia)",
    sourceUrl: "https://www.bi.go.id/"
  },
  israel: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying residential property in Israel; non-residents follow the same purchase and registration process as citizens, with standard identification requirements.",
    extraCost: "None specific to foreign buyers, though non-residents do not receive the discounted first-home purchase-tax bracket reserved for Israeli residents",
    source: "Israel Tax Authority (Real Estate Taxation)",
    sourceUrl: "https://www.gov.il/en/departments/israel_tax_authority"
  },
  france: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying French property — resident or non-resident, EU or non-EU, no minimum investment and no special authorization required. Every buyer, French or foreign, completes the purchase through a notaire (a public officer), which is the actual gating step for any buyer, not a foreign-buyer-specific one.",
    extraCost: "None specific to foreign buyers on the purchase itself; non-EU sellers pay a higher capital gains tax rate (33.33%) than EU/EEA sellers (19%) on a later resale",
    source: "Notaires de France",
    sourceUrl: "https://www.notaires.fr/en/housing-tax-system/buying-and-selling-special-cases/purchase-france-non-residents"
  },
  spain: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Spanish property — EU or non-EU, resident or not. Every buyer, Spanish or foreign, needs a NIE (foreigner ID number) to sign the deed and register the purchase — the same identification step required of any buyer, not an approval gate specific to foreigners.",
    extraCost: "None specific to foreign buyers; the property-linked 'Golden Visa' investor-residency route (previously from EUR 500,000) was abolished for new applicants in April 2025 under Organic Law 1/2025",
    source: "Colegio de Registradores de España (Corpme)",
    sourceUrl: "https://www.registradores.org/en/-/el-colegio-de-registradores-presenta-una-gui-a-para-la-compra-de-vivienda-en-espa%C3%B1a-dirigida-a-extranjeros"
  },
  portugal: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Portuguese property, regardless of nationality or residency status. The only requirement common to every buyer, Portuguese or foreign, is a NIF (tax identification number).",
    extraCost: "None specific to foreign buyers; the real-estate route into the Golden Visa program and the NHR tax regime have both been closed to new applicants (2023 and 2024 respectively)",
    source: "Instituto dos Registos e do Notariado (IRN)",
    sourceUrl: "https://irn.justica.gov.pt/"
  },
  italy: {
    status: "WORKAROUND REQUIRED",
    summary: "EU/EEA citizens buy exactly like Italian citizens — no test at all. A non-EU citizen without an Italian residence permit is subject to a 'condition of reciprocity': the notary must confirm, via the Foreign Ministry's official reciprocity tables, that an Italian citizen could equally buy property in the buyer's own country, before the sale can be completed. Most Western countries (the US and UK, for example) clear this test; a non-EU buyer holding an Italian residence permit is exempt from it entirely, same as a resident.",
    extraCost: "N/A — an eligibility check the notary must run, not a tax",
    source: "Ministero degli Affari Esteri e della Cooperazione Internazionale (MAECI) — Rights and Reciprocity",
    sourceUrl: "https://www.esteri.it/en/temi/diplomazia_giuridica/condizreciprocita/"
  },
  germany: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying German property since a 1998 reform removed the prior nationality-based approval requirement entirely. A narrow exception can apply to specific security-sensitive sites under the Foreign Trade and Payments Act, and some federal states add scrutiny for agricultural land — neither is relevant to an ordinary residential purchase.",
    extraCost: "None specific to foreign buyers",
    source: "Deutscher Bundestag — Wissenschaftliche Dienste (\"Ausländischer Immobilienerwerb\")",
    sourceUrl: "https://www.bundestag.de/resource/blob/1022230/WD-7-053-24-pdf.pdf"
  },
  greece: {
    status: "WORKAROUND REQUIRED",
    summary: "No restriction across most of Greece. In the frontier areas designated under Law 1892/1990 (art. 25) — specific areas in the North of Greece and islands in the East — a buyer who is not a national of an EU or EFTA country needs a permit from the committee of the region's Decentralised Administration before the purchase can complete. Check with the notary whether the property lies in a frontier area.",
    extraCost: "A permit step for non-EU/EFTA buyers in frontier areas only; no official processing time or fee is published",
    source: "Greek Law 1892/1990, art. 25 — Greece's contribution to the European Land Registry Association (ELRA)",
    sourceUrl: "https://www.elra.eu/contact-point-contribution/greece/legal-restrictions-5/"
  },
  netherlands: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Dutch property, resident or not, EU or non-EU. Some municipalities apply local 'opkoopbescherming' (buy-to-let protection) rules requiring an owner to live in a newly bought home for a period before renting it out — a local housing-policy rule applying equally to Dutch and foreign buyers, not a nationality-based restriction.",
    extraCost: "None specific to foreign buyers",
    source: "Rijksoverheid (Government of the Netherlands)",
    sourceUrl: "https://www.rijksoverheid.nl/"
  },
  cyprus: {
    status: "WORKAROUND REQUIRED",
    summary: "EU citizens buy with the same rights as Cypriots, no approval needed. A non-EU citizen can buy, but is limited to one property per family unit (one apartment, one house, or a plot up to 4,014 sqm) and must obtain Council of Ministers approval, applied for after signing the contract of sale — a routine, fee-free process that typically takes a few weeks.",
    extraCost: "No fee for the approval itself, but it is a required approval step for non-EU buyers, and caps them to one property",
    source: "Ministry of Interior, Republic of Cyprus — Immovable Property (Aliens) Law, Cap. 109",
    sourceUrl: "https://www.gov.cy/moi/en/purchasing-property/"
  },
  ireland: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Irish property, regardless of nationality or residency status. Stamp duty is based only on the property's value, not the buyer's nationality or residency.",
    extraCost: "None specific to foreign buyers",
    source: "Citizens Information Board (Ireland) — Stamp Duty on Property",
    sourceUrl: "https://www.citizensinformation.ie/en/housing/owning-a-home/buying-a-home/stamp-duty/"
  },
  belgium: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Belgian property — EU or non-EU, resident or not, including land. Every buyer, Belgian or foreign, goes through the same notary-led process; identity, source-of-funds and anti-money-laundering checks are the real gating step for any buyer, not a foreign-buyer-specific one.",
    extraCost: "None specific to foreign buyers",
    source: "Notaire.be (Fédération Royale du Notariat Belge)",
    sourceUrl: "https://www.notaire.be/"
  },
  sweden: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Swedish property — no citizenship, residency, or personal identity number (personnummer) is required to hold title. The only real limitation is agricultural land and protected natural areas, which need county-administration permission for any buyer, Swedish or foreign, not a nationality-based rule.",
    extraCost: "None specific to foreign buyers",
    source: "Lantmäteriet (Swedish national land registry)",
    sourceUrl: "https://www.lantmateriet.se/en/real-property/registration-of-ownership--property-and-site-leasehold/the-rules-are-essentially-the-same-regarding-registration-of-ownership-for-foreign-and-swedish-citizens/"
  },
  norway: {
    status: "OPEN",
    summary: "No general restriction on EEA or non-EEA nationals buying residential property in Norway. A non-resident buyer without a Norwegian national ID needs a temporary D-number from the Tax Administration to register title. Agricultural/forested land above a size threshold needs a concession permit under the Concession Act — a land-use rule applying to any buyer, Norwegian or foreign, not specific to nationality.",
    extraCost: "None specific to foreign buyers beyond obtaining a D-number",
    source: "Kartverket (Norwegian Mapping Authority / Land Registry)",
    sourceUrl: "https://www.kartverket.no/en"
  },
  poland: {
    status: "WORKAROUND REQUIRED",
    summary: "EU/EEA/Swiss citizens buy exactly like Polish citizens, no permit needed for any property type. A non-EU/EEA/Swiss citizen needs a Ministry of Interior and Administration (MSWiA) permit to buy a house, land, or agricultural/forest land — but this permit is NOT required to buy a self-contained apartment/flat (a unit with its own Land Register entry), the common ownership structure most foreign buyers actually use.",
    extraCost: "No permit fee for the common apartment-purchase route; a house/land purchase needing the MSWiA permit commonly takes 6-10 months to approve",
    source: "Ministry of the Interior and Administration (MSWiA), Poland",
    sourceUrl: "https://www.gov.pl/web/mswia-en/apply-for-a-permit-to-acquire-real-estate-shares-stocks-by-foreign-citizens"
  },
  austria: {
    status: "WORKAROUND REQUIRED",
    summary: "EU/EEA/Swiss citizens buy exactly like Austrian citizens. A citizen of any other country generally needs approval from the relevant Land's (province's) Grundverkehr (land transfer) authority before buying real estate — rules and strictness vary by the nine Länder, with some (Tyrol, Vorarlberg, Salzburg) notably stricter on second homes, and agricultural/forestry land facing the most scrutiny everywhere.",
    extraCost: "N/A — a provincial approval requirement, not a tax; fees and timelines vary by Land",
    source: "Rechtsinformationssystem des Bundes (RIS) — Landesrecht, Grundverkehrsgesetze",
    sourceUrl: "https://ris.bka.gv.at/Land/"
  },
  "czech republic": {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Czech property of any kind, since all remaining restrictions (which had applied mainly to agricultural land and dated to the transition period after EU accession) were lifted on 1 May 2011. A buyer of any nationality purchases under the same legal conditions as a Czech citizen.",
    extraCost: "None specific to foreign buyers",
    source: "Ministry of Foreign Affairs of the Czech Republic",
    sourceUrl: "https://mzv.gov.cz/riyadh/en/trade_and_economy/acquisition_of_real_estate_in_the_czech/index.html"
  },
  hungary: {
    status: "WORKAROUND REQUIRED",
    summary: "EU/EEA/Swiss citizens buy freely, no permit needed (agricultural/forest/heritage land excepted — barred to essentially all foreigners, EU included). A non-EU/EEA/Swiss citizen needs a purchase permit from the county government office (kormányhivatal) covering the property's location — a real approval step, not just paperwork, taking about 30 days.",
    extraCost: "Approximately EUR 130-161 permit fee for non-EU/EEA/Swiss buyers",
    source: "Hungarian Government (Kormányhivatal — county government offices)",
    sourceUrl: "https://kormanyhivatal.hu/"
  },
  croatia: {
    status: "WORKAROUND REQUIRED",
    summary: "Citizens of EU member states, Iceland, Liechtenstein, Norway, and Switzerland buy on the same footing as Croatian citizens. Any other foreign national can buy only if their own country grants Croatian citizens the equivalent right (the 'reciprocity' principle) — confirmed by, and requiring written approval from, the Ministry of Justice before the land registry will register the new owner, commonly taking 3-7 months in total.",
    extraCost: "N/A — an approval/reciprocity-confirmation requirement, not a tax",
    source: "Ministry of Justice and Public Administration, Republic of Croatia",
    sourceUrl: "https://mpudt.gov.hr/information-on-reciprocity-in-the-acquisition-of-ownership-rights-in-real-estate-between-the-republic-of-croatia-and-countries-other-than-eu-member-states-republic-of-iceland-principality-of-liechtenstein-kingdom-of-norway-or-swiss-confederation-25361/25361"
  },
  turkey: {
    status: "WORKAROUND REQUIRED",
    summary: "Turkey abolished its old country-by-country reciprocity requirement in 2012, so citizens of most countries can buy — Syria, Armenia, and North Korea remain nationality-barred outright. Every purchase, regardless of buyer nationality, is automatically screened by the Land Registry against designated military/security zones and is blocked if it falls inside one. A foreign buyer is also capped at 30 hectares nationally and cannot exceed 10% of a district's total area.",
    extraCost: "None specific beyond standard title-deed fees, but the military-zone screening and area caps are real, non-waivable limits, not just paperwork",
    source: "General Directorate of Land Registry and Cadastre (TKGM), Turkey",
    sourceUrl: "https://www.tkgm.gov.tr/"
  },
  finland: {
    status: "WORKAROUND REQUIRED",
    summary: "EU/EEA citizens buy freely, no permit needed. A non-EU/EEA citizen needs a Ministry of Defence permit to buy real property that includes land — but this is NOT required to buy an apartment held as shares in a housing company, the standard way most Finnish apartments are owned and the route most foreign buyers actually use. The permit process can also refuse an acquisition on national-security grounds (e.g. near borders or defence sites), for any buyer.",
    extraCost: "EUR 170 permit fee for a land purchase by a non-EU/EEA buyer; typically up to 3 months to process. No fee/permit for the common housing-company-share route",
    source: "Ministry of Defence, Finland",
    sourceUrl: "https://defmin.fi/en/licences-and-services/authorisation-to-non-eu-and-non-eea-buyers-to-buy-real-estate"
  },
  bulgaria: {
    status: "WORKAROUND REQUIRED",
    summary: "Non-EU citizens can buy apartments and buildings freely, in their own name. They cannot directly own land, though — a house with a yard or a standalone plot needs a Bulgarian company (an EOOD, the routine, low-cost workaround; EU/EEA citizens don't need this). Agricultural, forest, and vineyard land is off-limits to ALL foreigners, EU included, without 5 years' Bulgarian residency and registration as an agricultural producer.",
    extraCost: "N/A — a company-formation step for land/house-with-land, not a tax; unnecessary for the common apartment purchase",
    source: "Republic of Bulgaria — Point of Single Contact (Constitution Art. 22)",
    sourceUrl: "https://psc.egov.bg/en/psc-right-of-ownership"
  },
  romania: {
    status: "WORKAROUND REQUIRED",
    summary: "Buying an apartment (a share in a building's common areas, not direct land ownership) is unrestricted for any nationality, registered directly with no company needed. A non-EU/EEA citizen cannot directly own a house-with-land or standalone land in their own name — as of 2026 Romania has no reciprocity treaty enabling this — and needs a Romanian company instead.",
    extraCost: "N/A — a company-formation step for land/house-with-land, not a tax; unnecessary for the common apartment purchase",
    source: "ANCPI (Agenția Națională de Cadastru și Publicitate Imobiliară)",
    sourceUrl: "https://www.ancpi.ro/"
  },
  slovakia: {
    status: "WORKAROUND REQUIRED",
    summary: "Non-EU citizens can buy apartments and buildings without restriction. Agricultural/forest land is subject to reciprocity — barred if the buyer's home country doesn't grant Slovaks the same right — unless the buyer has run a business on that land for 3+ years and holds Slovak temporary residence, or buys through a Slovak-registered company (treated as a resident regardless of the owners' nationality).",
    extraCost: "N/A — a reciprocity/eligibility test for agricultural land only, not relevant to an ordinary apartment/house purchase",
    source: "Act No. 140/2014 Z.z. (Slovak Republic) — SLOV-LEX",
    sourceUrl: "https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2014/140/20190211"
  },
  slovenia: {
    status: "WORKAROUND REQUIRED",
    summary: "EU, EEA and OECD-member citizens (a notably wide exemption — includes the US, Canada, Japan, etc.) buy without restriction. A citizen of any other country needs the Ministry of Justice to confirm 'reciprocity' (that a Slovenian could buy equivalently in that person's own country) before registering title, decided within 90 days. Countries with no reciprocity (e.g. Russia, China) are blocked from direct ownership; a Slovenian company is the usual workaround.",
    extraCost: "N/A — an approval/reciprocity-confirmation requirement, not a tax",
    source: "Ministry of Justice, Republic of Slovenia (e-Uprava)",
    sourceUrl: "https://e-uprava.gov.si/si/podrocja/nepremicnine-in-okolje/parcele/pravice-tujcev.html"
  },
  malta: {
    status: "WORKAROUND REQUIRED",
    summary: "Buying in a Special Designated Area (SDA) needs no permit, for anyone, any nationality. Outside an SDA, a non-EU/EEA citizen (or an EU/EEA citizen who hasn't lived in Malta 5+ years, unless the property will be their primary residence) needs an AIP (Acquisition of Immovable Property) permit, typically issued within about 35 days. A non-resident can hold only one property in Malta regardless.",
    extraCost: "EUR 233 AIP permit fee where required",
    source: "Malta Tax and Customs Administration (MTCA)",
    sourceUrl: "https://mtca.gov.mt/personal-tax/property-taxes/acquisition-of-immovable-property-in-malta-by-non-residents"
  },
  estonia: {
    status: "WORKAROUND REQUIRED",
    summary: "Apartments and houses are open to any nationality. A non-EU/EEA citizen needs government authorization for agricultural/forest land, land on most small islands, or land in designated border-zone municipalities (parts of Ida-Viru, Tartu, Põlva and Võru counties) — national-security grounds. Since a January 2026 change, Russian and Belarusian citizens without a long-term Estonian residence permit are separately barred from acquiring ANY Estonian property, apartments included — a nationality-specific rule, not a land-type one.",
    extraCost: "N/A — an authorization requirement for specific land types/zones, not a tax",
    source: "Riigi Teataja (Estonian State Gazette) — Restrictions on Acquisition of Immovables Act (KAOKS)",
    sourceUrl: "https://www.riigiteataja.ee/akt/KAOKS"
  },
  brazil: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying urban residential property (an apartment or house in a city) — the typical purchase. Restrictions apply only to RURAL land: foreigners are collectively capped at 25% of any municipality's rural land, individual holdings are size-limited, and rural land within Brazil's 150km border strip needs INCRA or military authorization. None of this applies to ordinary urban real estate.",
    extraCost: "None specific to foreign buyers of urban property",
    source: "INCRA (Instituto Nacional de Colonização e Reforma Agrária)",
    sourceUrl: "https://www.gov.br/incra/pt-br"
  },
  argentina: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying urban residential property (an apartment or house in a city) — the typical purchase. Law 26,737 restricts only RURAL land: foreign nationals are collectively capped at 15% of rural land nationally (30% of that per single nationality), 1,000 hectares per owner in core agricultural zones, and rural land in border-security zones or adjoining major water bodies needs prior authorization. None of this applies to ordinary urban real estate. (The law's 2023 repeal-by-decree is under an active court challenge, so it remains technically in force.)",
    extraCost: "None specific to foreign buyers of urban property",
    source: "Registro Nacional de Tierras Rurales (RENAT), Ministry of Justice, Argentina",
    sourceUrl: "https://www.argentina.gob.ar/justicia/tierrasrurales"
  },
  // Fourth batch (Sept 2026): Georgia flagged high-priority by the user
  // (a hot, current market for Israeli buyers); the other 7 picked for a
  // mix of geography and how cleanly a primary source resolved. Serbia
  // was independently re-verified after the first research pass mislabeled
  // it OPEN — the Ministry of Justice's own text on Article 82a of the Law
  // on the Basis of Proprietary Relations applies reciprocity ("под
  // условима реципроцитета") to the apartment/residential-building case
  // too, not only the business-property case, so it belongs in the
  // workaround bucket like Italy's reciprocity test, not OPEN.
  georgia: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying an apartment, house, or any non-agricultural property — no residency, visa, or citizenship requirement to register title. The only restriction is on agricultural land: a foreign owner must sell it to a Georgian citizen or entity within 6 months or it passes to the state (with compensation).",
    extraCost: "N/A",
    source: "Law of Georgia on Ownership of Agricultural Land (Legislative Herald of Georgia)",
    sourceUrl: "https://matsne.gov.ge/en/document/view/32998"
  },
  latvia: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying an apartment or house. The only restriction is on agricultural and forest land: non-EU/EEA/Swiss nationals need municipal permission and an approved land-use plan to buy it, and a separate, nationality-neutral rule bars land purchases in designated border, coastal-protection, or nature-reserve zones.",
    extraCost: "N/A — outside the agricultural/forest-land and protected-zone cases",
    source: "Saeima (Parliament of the Republic of Latvia)",
    sourceUrl: "https://www.saeima.lv/en/news/saeima-news/25729-rules-for-purchasing-agricultural-land-revised"
  },
  lithuania: {
    status: "WORKAROUND REQUIRED",
    summary: "Buying an apartment is unrestricted for any nationality, since land under most multi-apartment buildings belongs to the state — the purchase doesn't involve directly owning land. Buying a house comes with its land plot, and Lithuanian constitutional law reserves land ownership to individuals/entities from a country meeting EU/NATO/EEA/OECD ('European and transatlantic integration') criteria; a buyer from outside that list can't hold the land under a house.",
    extraCost: "N/A — an eligibility test for land ownership, not a fee; doesn't apply to the apartment route",
    source: "Seimas of the Republic of Lithuania — Register of Legal Acts",
    sourceUrl: "https://e-seimas.lrs.lt/rs/legalact/TAD/TAIS.59894/"
  },
  iceland: {
    status: "RESTRICTED",
    summary: "A foreign national from outside the EEA who isn't domiciled in Iceland generally cannot buy real property outright — every deed must go to the Ministry of Justice, which only approves it where the property will be used directly in a business or the applicant has a demonstrable close connection to Iceland (e.g. marriage to an Icelandic citizen), and even then the property is capped at 3.5 hectares. EEA nationals face a materially lighter path.",
    extraCost: "N/A — a ministerial approval gate, not a tax; realistically a barrier for a buyer with no Icelandic connection",
    source: "Government of Iceland, Ministry of Justice — Act No. 19/1966 on the Right of Ownership and Use of Real Property",
    sourceUrl: "https://www.government.is/topics/foreign-nationals/foreign-nationals-real-property-rights/"
  },
  chile: {
    status: "OPEN",
    summary: "No general restriction on foreign nationals buying Chilean residential property. The only restriction is nationality- and geography-specific: citizens of Chile's three bordering countries (Argentina, Bolivia, Peru), and companies they control, need presidential authorization to acquire real estate within designated border zones — nationals of every other country face no such rule anywhere in Chile.",
    extraCost: "N/A — outside the bordering-country/border-zone case",
    source: "Dirección Nacional de Fronteras y Límites del Estado (DIFROL), Chilean Ministry of Foreign Affairs",
    sourceUrl: "https://www.difrol.cl/en/procedures/immovable-property-in-border-areas/"
  },
  colombia: {
    status: "OPEN",
    summary: "No general restriction on foreign nationals buying Colombian urban residential property (an ordinary apartment or house). Restrictions apply only to rural or border-zone land — designated border municipalities and rural-land ceilings measured in Unidades Agrícolas Familiares — not to an ordinary urban purchase.",
    extraCost: "N/A — outside the rural/border-land case",
    source: "Superintendencia de Notariado y Registro (SNR)",
    sourceUrl: "https://servicios.supernotariado.gov.co/files/content/conceptos/2018/170181-CONSULTA2115.PDF"
  },
  peru: {
    status: "OPEN",
    summary: "Article 71 of Peru's Constitution places foreigners \"in the same condition as Peruvians\" for property ownership. The only carve-out is within 50km of an international border, where foreigners cannot acquire land, mines, forests, water, or energy sources — a zone that doesn't reach Peru's cities, including Lima, which sits well outside the 50km strip.",
    extraCost: "N/A — outside the border-zone case",
    source: "Congreso de la República del Perú — Constitución Política del Perú (1993), Art. 71",
    sourceUrl: "https://www2.congreso.gob.pe/sicr/cendocbib/con3_uibd.nsf/9C1C43653C97169D052578C300776BC1/$FILE/Constituci%C3%B3n_Pol%C3%ADtica_delPer%C3%BA_1993_art.58-77.pdf"
  },
  serbia: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreign individual not conducting business in Serbia may acquire an apartment or residential building under the same substantive conditions as a Serbian citizen — but Article 82a of the Law on the Basis of Proprietary Relations conditions this on reciprocity: Serbia's own Ministry of Justice text applies the reciprocity requirement to the apartment case, not only to business real estate. In practice this is satisfied for most Western buyers' home countries, but it is a real test, not a formality.",
    extraCost: "N/A — a reciprocity test, not a fee",
    source: "Ministry of Justice, Republic of Serbia",
    sourceUrl: "https://www.mpravde.gov.rs/sr/tekst/3579/pravo-stranaca-da-sticu-nepokretnosti.php"
  },
  // FIX (Sept 2026): user asked to widen coverage beyond Europe again.
  // These 6 were researched together; China is deliberately NOT included —
  // the research could only find secondary (law-firm/press) reporting of
  // a 2006 MOHURD/SAFE circular and a more recent relaxation, with no
  // primary MOFCOM/MOHURD document reachable from this sandbox. That
  // doesn't clear this file's honesty bar, so China stays unlisted rather
  // than guessed, per this project's standing rule.
  malaysia: {
    status: "WORKAROUND REQUIRED",
    summary: "Foreigners can buy freehold residential property, but only above a minimum price threshold set per state (from RM500,000 in Penang mainland/Melaka/Sarawak up to RM2–3 million in Selangor/Penang Island; RM1 million in Kuala Lumpur), plus written State Authority consent on every transaction regardless of price. Malay Reserved Land, Bumiputera-allocated units, and low/medium-cost housing are off-limits entirely.",
    extraCost: "Flat 8% stamp duty on the Memorandum of Transfer for non-citizen/non-permanent-resident buyers (effective 1 Jan 2026), vs. a tiered ~1–4% scale for citizens/PRs",
    source: "Economic Planning Unit, Prime Minister's Department of Malaysia — Guidelines on the Acquisition of Properties (implemented via each state's Land Office under the National Land Code 1965)",
    sourceUrl: "https://www.epu.gov.my/"
  },
  morocco: {
    status: "OPEN",
    summary: "Foreigners have full freehold ownership (melk) of urban residential property — apartments and villas — on equal terms with Moroccan citizens, with no prior authorization required since a 1996 reform. Only agricultural land and land in military/national-security zones are off-limits.",
    extraCost: "None specific — registration duties (4% primary residence / 6% secondary) apply identically regardless of nationality",
    source: "Dahir n° 1-95-217 (1996); property registered with the Agence Nationale de la Conservation Foncière, du Cadastre et de la Cartographie (ANCFCC)",
    sourceUrl: "https://ancfcc.gov.ma/"
  },
  panama: {
    status: "OPEN",
    summary: "Foreigners have the same ownership rights as Panamanian citizens for titled residential property nationwide, as individuals or via a Panamanian corporation/foundation, with no residency or citizenship requirement. The only restriction is geographic: no foreign ownership within 10km of a land border, and restrictions on island ownership (pre-1972 titles excepted).",
    extraCost: "None specific — standard 2% property transfer tax and closing costs apply equally to foreign and Panamanian buyers",
    source: "Constitution of the Republic of Panama (1972), Articles 290–291",
    sourceUrl: "https://www.asamblea.gob.pa/"
  },
  qatar: {
    status: "WORKAROUND REQUIRED",
    summary: "Foreigners can only buy FREEHOLD property in specific Cabinet-designated zones (e.g. The Pearl, Lusail, West Bay Lagoon, Al Khor Resort — 10 areas), or hold a 99-year leasehold in a further 16 designated areas. Outside these zones, non-Qatari ownership is prohibited entirely.",
    extraCost: "None specific — Qatar levies no general property transfer tax or stamp duty",
    source: "Law No. 16 of 2018 Regulating the Ownership and Use of Real Estate by Non-Qataris, Ministry of Justice (State of Qatar)",
    sourceUrl: "https://www.almeezan.qa/"
  },
  mauritius: {
    status: "WORKAROUND REQUIRED",
    summary: "Foreigners cannot buy ordinary residential land/houses freely — they must buy either within an Economic Development Board-approved Property Development Scheme (PDS, no fixed regulatory minimum but a high-end de facto price point, and a residence permit above USD 375,000), or an apartment in a building of at least ground+2 floors, which requires EDB approval and a minimum price of Rs 6,000,000 (~USD 130,000) but no residence-permit requirement.",
    extraCost: "None specific beyond the scheme-approval requirement itself — registration duty is a flat 5% regardless of nationality within an approved scheme",
    source: "Non-Citizens (Property Restriction) Act 1975 (as amended); Economic Development Board (EDB) Mauritius",
    sourceUrl: "https://www.fscmauritius.org/media/omsfm2mf/non-citizens-property-restriction-act-1975.pdf"
  },
  "south africa": {
    status: "OPEN",
    summary: "No law restricts property ownership by nationality or residence. The Deeds Registries Act and the Alienation of Land Act neither require foreign buyers to be resident nor cap what they may own — the same registration and conveyancing process applies to everyone.",
    extraCost: "N/A — transfer duty and conveyancing costs are the same regardless of the buyer's nationality",
    source: "Deeds Registries Act 47 of 1937; Alienation of Land Act 68 of 1981 (Republic of South Africa)",
    sourceUrl: "https://www.acts.co.za/deeds_registries_act_1937.php"
  },
  egypt: {
    status: "WORKAROUND REQUIRED",
    summary: "Non-Egyptians may own built property or vacant (non-agricultural, non-desert) land for private residential use, but are capped at two properties nationwide, each no larger than 4,000 sqm, and may not resell within 5 years of acquiring it. Agricultural and desert land cannot be owned by foreigners at all; some Red Sea/Sinai tourist zones grant Egyptians-equivalent freehold or long leasehold rights by separate decree.",
    extraCost: "No foreign-buyer-specific tax found beyond the ownership caps and 5-year resale restriction themselves",
    source: "Law No. 230 of 1996 Regulating Non-Egyptians' Ownership of Built Real Estate and Vacant Lands — General Authority for Investment and Free Zones (GAFI)",
    sourceUrl: "https://www.investinegypt.gov.eg/PublishingImages/Lists/ContentPageDetails/AllItems/Ownership%20of%20Real%20Property%20for%20Private%20Residential%20Purposes%20by.pdf"
  },
  kenya: {
    status: "WORKAROUND REQUIRED",
    summary: "A non-citizen cannot hold freehold title. The standard, routinely-used path is a leasehold of up to 99 years, which covers an ordinary apartment or house purchase the same way it applies to any freehold land a non-citizen holds. A company counts as 'foreign' (and therefore leasehold-only) unless it is 100% Kenyan-owned.",
    extraCost: "N/A — a leasehold-only structure, not an extra tax; standard stamp duty and legal fees still apply to any buyer",
    source: "Constitution of Kenya 2010, Sixth Schedule Article 8(1) — Embassy of Kenya, Washington DC",
    sourceUrl: "https://kenyaembassydc.org/wp-content/uploads/Can-foreigners-own-property-in-Kenya.pdf"
  },
  bahamas: {
    status: "OPEN",
    summary: "A non-Bahamian buying an ordinary single-family home or condominium for personal residential use registers the purchase with the Investments Board after closing and receives a Certificate of Registration — no advance permit needed for this ordinary case. A permit from the Board is required only above a modest acreage threshold, or for commercial/vacant land intended for development.",
    extraCost: "Investments Board registration fee; a permit application fee applies only to the larger-acreage/commercial case",
    source: "International Persons Landholding Act 1993 (Ch. 140), as amended",
    sourceUrl: "https://faolex.fao.org/docs/pdf/bha78071.pdf"
  },
  "dominican republic": {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Dominican real estate — foreign and local buyers are treated equally, and a foreigner can hold title directly in their own name. The only nationality-based limit is a priority-purchase rule for citizens on land directly on the national border, which does not apply to ordinary urban or resort residential property.",
    extraCost: "None specific to foreign buyers; registering the investment with CEI-RD is only needed to claim Law 16-95's investment-promotion benefits, not to complete an ordinary purchase",
    source: "Foreign Investment Law 16-95 (1995) + Real Estate Registration Law 108-05 — Centro de Exportación e Inversión de la República Dominicana (CEI-RD)",
    sourceUrl: "https://cei-rd.gob.do/"
  },
  barbados: {
    status: "OPEN",
    summary: "No cap or ban on foreign nationals buying residential property — the same purchase and title process applies as for a citizen. The one extra step is that a non-resident buyer needs prior permission from the Central Bank of Barbados' Exchange Control Authority before completing the purchase, which the conveyancing attorney handles as a routine part of the transaction; the sale can be void if this permission isn't obtained first.",
    extraCost: "N/A — a routine regulatory approval step, not a tax; funds brought in for the purchase are registered with the Bank so they can later be repatriated",
    source: "Exchange Control Act, Cap. 71, Laws of Barbados — Central Bank of Barbados",
    sourceUrl: "https://www.centralbank.org.bb/faqs/exchange-control-faqs"
  },
  // Monaco (Oct 2026): the daily data-scan routine first found only
  // secondary (law-firm/agency) sources and correctly declined to add it;
  // asked to dig further, found the actual primary basis — the
  // Constitution itself, plus the registration-duty schedule confirming
  // the "no restriction" claim isn't just an absence of a rule.
  // Seventh batch (Oct 1 2026): the user told me, bluntly, to stop waiting
  // to be handed a source and go find the official body for every
  // remaining country myself, immediately. Started with the 4 largest/
  // most-active REGIONAL_FIXTURE_COUNTRIES gaps rather than the whole
  // 30-country list at once, so each one still gets the same per-country
  // verification as every earlier batch, not a rushed guess.
  russia: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying a Russian apartment, house, or dacha — no residency, citizenship, or prior approval needed for an ordinary residential purchase. The Land Code (Art. 15) bars foreign ownership only of land in designated border zones, seaport territory, and agricultural land (leasehold only); a site of defense/strategic significance can separately require Government Commission clearance, not relevant to ordinary housing.",
    extraCost: "N/A — all transactions must be priced and settled in rubles, a rule applying to every buyer, not a foreign-buyer-specific cost",
    source: "Land Code of the Russian Federation (Federal Law No. 136-FZ), Article 15 — official English translation filed as part of Russia's WTO accession documentation",
    sourceUrl: "https://www.wto.org/english/thewto_e/acc_e/rus_e/wtaccrus58_leg_26.pdf"
  },
  kazakhstan: {
    status: "RESTRICTED",
    summary: "A foreign national must hold Kazakhstani permanent-residence status to own housing on the same footing as a citizen (Law No. 2337, Art. 9). A foreigner only temporarily present or residing in Kazakhstan — the case for almost any non-resident buyer — cannot hold title to residential property directly.",
    extraCost: "N/A — gated by residency status, not a tax",
    source: "Law of the Republic of Kazakhstan No. 2337 'On the Legal Status of Foreigners' (19 June 1995, as amended), Article 9 — Adilet (official legal information system)",
    sourceUrl: "https://adilet.zan.kz/eng/docs/U950002337_/"
  },
  armenia: {
    status: "OPEN",
    summary: "No restriction on a foreign national buying an apartment, or a house together with its adjoining residential plot — both are explicit statutory exceptions to the Constitution's general rule against foreign land ownership. The real restriction is on agricultural land and standalone/vacant land, which a foreign buyer cannot hold directly (a lease or an Armenian-registered company are the usual routes) — not relevant to an ordinary home purchase.",
    extraCost: "N/A — outside the agricultural/standalone-land case",
    source: "Constitution of the Republic of Armenia; Land Code of the Republic of Armenia (2001, as amended 2018) — ARLIS (Armenian Legal Information System)",
    sourceUrl: "https://www.arlis.am/hy/acts/221255"
  },
  "bosnia and herzegovina": {
    status: "WORKAROUND REQUIRED",
    summary: "In the Federation of Bosnia and Herzegovina, a foreign national can acquire real estate only where reciprocity exists — i.e. a BiH citizen has the equivalent right in the buyer's own country. The Federal Ministry of Justice publishes and updates a reciprocity list annually (due by 31 January); as of May 2026 it ran to 59 countries with reciprocity confirmed, with several others (e.g. Egypt, India, Indonesia, Qatar) explicitly listed as lacking it. This entry covers the Federation only — Republika Srpska, the country's other entity, administers its own separate real-estate regime.",
    extraCost: "N/A — a reciprocity-confirmation requirement, not a tax",
    source: "Federal Ministry of Justice of the Federation of Bosnia and Herzegovina — Reciprocity List for Acquisition of Real Estate",
    sourceUrl: "https://fmp.gov.ba/"
  },
  andorra: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreign (non-Andorran) buyer needs prior authorization from the Ministry of Economy (Autorització Prèvia d'Inversió Estrangera) before completing a real estate purchase — a real approval step, not just paperwork, under Law 5/2025 (replacing the older Law 10/2012). The decision is due within about 1 month, extendable by 15 days. The old flat cap of two apartments per foreign individual has been abolished, but Law 5/2025 added its own quantitative limits on the number of properties a foreign investor may acquire (properties committed to long-term affordable rental of 10+ years are exempt).",
    extraCost: "No separate fee highlighted beyond the standard application; the real cost is the approval step and timeline itself",
    source: "Llei 5/2025, del 6 de març, de creixement sostenible i accés a l'habitatge (Andorra) — U.S. Department of State, 2026 Investment Climate Statement: Andorra",
    sourceUrl: "https://www.state.gov/reports/2026-investment-climate-statements/andorra"
  },
  "north macedonia": {
    status: "WORKAROUND REQUIRED",
    summary: "EU and OECD member-state citizens buy an apartment on the same terms as North Macedonian citizens, no approval needed. Any other foreign national can acquire an apartment only under reciprocity, confirmed by the Minister of Justice — the same mechanism used in Serbia, Croatia, and Bosnia and Herzegovina. Agricultural land cannot be owned by any foreign national; a long-term lease needs the Minister of Justice's consent plus agriculture- and finance-ministry input.",
    extraCost: "N/A — a reciprocity-confirmation requirement for non-EU/OECD buyers, not a tax",
    source: "Law on Ownership and Other Real Rights, Republic of North Macedonia — Ministry of Justice (reciprocity determination)",
    sourceUrl: "https://www.pravda.gov.mk/"
  },
  ukraine: {
    status: "OPEN",
    summary: "No restriction on a foreign national buying an apartment or house (with its land, if within city/settlement limits) — the same purchase and registration process applies as for a Ukrainian citizen. The Land Code bars foreign ownership only of agricultural land (pending a repeal referendum that hasn't happened) and non-agricultural land outside city limits unless it's for a targeted/registered use. Ongoing martial law allows the state to restrict or requisition property on a case-by-case basis for military necessity — a real practical risk to weigh, but not itself a ban on foreign ownership.",
    extraCost: "N/A — outside the agricultural/rural-land case",
    source: "Land Code of Ukraine",
    sourceUrl: "https://zakon.rada.gov.ua/laws/show/2768-14"
  },
  nigeria: {
    status: "WORKAROUND REQUIRED",
    summary: "All land in Nigeria is vested in each state's Governor under the Land Use Act — no one, citizen or foreigner, holds freehold title, only a right of occupancy. Before a foreigner can acquire that right by assignment, mortgage, or sublease, the Governor's consent (Section 22) must be obtained, or the transaction stays legally incomplete even after money changes hands. In practice, Governors generally cap a foreigner's leasehold at 25 years, well short of what a Nigerian citizen can be granted.",
    extraCost: "N/A — a consent/registration step and a shorter leasehold cap specific to foreign buyers, not a tax",
    source: "Land Use Act 1978 (Cap. L5, Laws of the Federation of Nigeria 2004), Section 22",
    sourceUrl: "https://www.lawsofnigeria.placng.org/view2.php?sn=228"
  },
  "puerto rico": {
    status: "OPEN",
    summary: "No local restriction on foreign nationals buying Puerto Rico residential real estate — as a US territory, Puerto Rico imposes no additional rule beyond what applies on the US mainland. The same federal-level review (CFIUS) that can apply to the mainland for a narrow set of national-security-sensitive transactions applies equally here, not to an ordinary home purchase.",
    extraCost: "None specific to foreign buyers (standard closing costs apply; FIRPTA withholding applies on a later resale, as on the mainland)",
    source: "US Department of the Treasury / Committee on Foreign Investment in the United States (CFIUS)",
    sourceUrl: "https://home.treasury.gov/policy-issues/international/the-committee-on-foreign-investment-in-the-united-states-cfius"
  },
  moldova: {
    status: "OPEN",
    summary: "No restriction on a foreign national buying an apartment or house (with its residential land) in Moldova. The Land Code bars direct foreign ownership only of agricultural and forest-fund land; land of that kind received by a foreigner through inheritance, a court decision, or a mortgage must be sold on within a year of acquiring it.",
    extraCost: "N/A — outside the agricultural/forest-land case",
    source: "Land Code of the Republic of Moldova (in force 1 April 2025) — Ministry of Justice of the Republic of Moldova",
    sourceUrl: "https://www.legis.md/"
  },
  liechtenstein: {
    status: "RESTRICTED",
    summary: "Real estate acquisition is gated by the Grundverkehr (land-transaction) approval regime, administered by the Office of Justice (Amt für Justiz): a non-resident of any nationality is excluded from buying outright, and even a third-country (non-EEA) national already resident needs government permission, granted only for a proven living/business need after a period of residence. Residence permits themselves are capped nationally at 89 a year (72 for EU/EEA citizens, 17 for Swiss), so the realistic path to ever qualifying is narrow.",
    extraCost: "N/A — an approval/residency-eligibility gate, not a tax; realistically a barrier for almost any non-resident buyer",
    source: "Grundverkehrsgesetz (Land Transaction Act), Liechtenstein — Office of Justice (Amt für Justiz)",
    sourceUrl: "https://llv.li/en/individuals/building-and-living/land-transfer"
  },
  "san marino": {
    status: "OPEN",
    summary: "Since Law no. 173 of 24 December 2018 (Art. 51), a foreign national can buy a building or part of one in San Marino by an ordinary inter-vivos transaction without needing the Council of XII's prior authorization that used to apply — a genuine liberalization, not just unenforced paperwork. A property acquired by inheritance (mortis causa) instead follows the separate rule in Law 118/2010, Art. 25.",
    extraCost: "N/A — no authorization fee for the ordinary purchase case",
    source: "Law No. 173 of 24 December 2018, Article 51 (San Marino) — Consiglio Grande e Generale (San Marino's parliament)",
    sourceUrl: "https://www.consigliograndeegenerale.sm/"
  },
  bolivia: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying ordinary residential property outside the border zone. Article 262 of Bolivia's Constitution bars any foreign person or company from acquiring property of any kind within 50km of a national border (the 'zona de seguridad fronteriza') — a zone that doesn't reach any of Bolivia's major cities. Violating it is severe: the property passes to the State with no compensation at all, not just a fine.",
    extraCost: "N/A — outside the 50km border-zone case",
    source: "Constitution of the Plurinational State of Bolivia (2009), Article 262",
    sourceUrl: "https://www.constituteproject.org/constitution/Bolivia_2009"
  },
  ecuador: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying ordinary urban or residential property. The Ley de Seguridad Pública y del Estado bars any foreign natural or legal person from possessing, acquiring, or holding a concession on land within the 40km-wide frontier security zone along Ecuador's land borders (plus a 10-nautical-mile maritime strip) — an exceptions process exists via the national security coordinating body, but this zone doesn't reach Ecuador's main cities (Quito, Guayaquil, Cuenca).",
    extraCost: "N/A — outside the 40km frontier-zone case",
    source: "Ley de Seguridad Pública y del Estado (Ecuador) — Ministerio de Defensa Nacional",
    sourceUrl: "https://www.defensa.gob.ec/wp-content/uploads/downloads/2015/04/ene15_LEY-DE-SEGURIDAD-PUBLICA-Y-DEL-ESTADO.pdf"
  },
  paraguay: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying ordinary urban residential property, and no general restriction on rural property either — except for Law 2532/2005: a citizen (or a company mainly owned by citizens) specifically of a neighboring country — Argentina, Bolivia, or Brazil — cannot own, co-own, or hold usufruct over RURAL property inside the 50km border security zone, absent a specific executive-decree exception. The rule doesn't reach ordinary urban property and doesn't apply to buyers of other nationalities.",
    extraCost: "N/A — a narrow, nationality- and geography-specific rural-land case",
    source: "Ley N° 2532/2005 'Que establece la Zona de Seguridad Fronteriza de la República del Paraguay'",
    sourceUrl: "https://paraguay.justia.com/nacionales/leyes/ley-2532-feb-17-2005/gdoc"
  },
  "cayman islands": {
    status: "OPEN",
    summary: "No restriction on foreign individuals buying Cayman Islands real estate — no government licence is needed, and title is government-guaranteed via the Torrens land-registration system. The restrictions that exist target foreign-controlled COMPANIES owning income-producing/commercial real estate (which need Trade and Business Licensing and Local Companies Control Law approval), not an individual buying a home.",
    extraCost: "None specific to foreign individual buyers",
    source: "Cayman Islands Land Registry",
    sourceUrl: "https://www.caymanlandinfo.ky/"
  },
  azerbaijan: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreigner can own a building, apartment, house, or commercial unit outright — the Land Code (Art. 48) reserves direct land ownership to Azerbaijani citizens only. An apartment in a multi-unit building isn't affected (the land is held collectively), but a standalone house's land plot is available to a foreign owner only on a leasehold of up to 99 years, not as owned land.",
    extraCost: "N/A — a title-type (leasehold vs. freehold land) restriction, not a tax",
    source: "Land Code of the Republic of Azerbaijan, Article 48 — State Committee on Property Issues of the Republic of Azerbaijan",
    sourceUrl: "https://emlak.gov.az/"
  },
  kosovo: {
    status: "WORKAROUND REQUIRED",
    summary: "An EU-state citizen or company buys exactly like a Kosovo citizen, no condition attached. Since the Law on Property Rights of Foreign Citizens (Feb 2022, implementing regulation in force since late 2023), any other foreign national can acquire real estate only where reciprocity exists — Kosovo's own citizens must have the equivalent right in the buyer's country — determined and maintained in a database by the Ministry of Justice.",
    extraCost: "N/A — a reciprocity-confirmation requirement for non-EU buyers, not a tax",
    source: "Law No. 08/L-085 on Property Rights of Foreign Citizens in the Republic of Kosovo — Official Gazette of the Republic of Kosovo",
    sourceUrl: "https://md.rks-gov.net/"
  },
  "trinidad and tobago": {
    status: "OPEN",
    summary: "In Trinidad, a foreign investor can buy up to one acre of land for residential use (or five acres for business) with no license needed at all — covering the great majority of ordinary home purchases; a licence from the Ministry of Finance (about 20 working days) is only needed above that size. Tobago is stricter: since 2007, every land purchase by a foreign investor there needs a licence from the Tobago House of Assembly regardless of size.",
    extraCost: "N/A — a licensing requirement only above the acreage threshold (Trinidad) or for any purchase (Tobago), not a tax",
    source: "Foreign Investment Act, Trinidad and Tobago — Ministry of Finance",
    sourceUrl: "https://www.finance.gov.tt/wp-content/uploads/2014/05/51.pdf"
  },
  maldives: {
    status: "RESTRICTED",
    summary: "The Constitution reserves land ownership to Maldivian citizens outright — a foreign buyer can only ever hold a leasehold (30-50 years for residential use; effectively up to 99 years for a qualifying tourism project), never freehold title. A 2015 constitutional amendment that allowed foreign freehold ownership for USD 1 billion+ reclamation projects was itself repealed by Parliament. The Special Economic Zones Act offers freehold-equivalent rights only to projects clearing a very high bar (commonly cited around USD 150 million in committed capital) — irrelevant to an ordinary buyer.",
    extraCost: "N/A — a leasehold-only structural restriction, not a tax; realistically a barrier for any buyer outside a large qualifying project",
    source: "Constitution of the Republic of Maldives",
    sourceUrl: "https://www.un.org/en/ga/sixth/70/docs/maldives_constitution.pdf"
  },
  belarus: {
    status: "OPEN",
    summary: "No restriction on a foreign national buying an apartment or house — the same rights and process as a Belarusian citizen. The land under a privately-owned house is held by the foreign owner on a leasehold (commonly up to 99 years) rather than outright, the standard structure for a foreign buyer. Separately, since a January 2024 decree, a BELARUSIAN COMPANY whose owners include persons from a designated 'unfriendly' state must pay a 25% fee to the state budget to sell that company's real estate — a corporate-divestment/sanctions measure, not a rule affecting an individual foreign buyer's purchase.",
    extraCost: "N/A for an individual purchase — the land is leasehold rather than owned outright, not an extra fee",
    source: "Civil Code of the Republic of Belarus; Decree on asset-sale procedures for 'unfriendly'-state owners (Jan 2024) — National Legal Internet Portal of Belarus (pravo.by)",
    sourceUrl: "https://pravo.by/"
  },
  // Four countries closed out from the "researched, not shipped" list in
  // the fifth batch above, after being told to search harder rather than
  // accept the first inconclusive pass: each now has an actual statute or
  // official body behind it, not just consistent blog claims.
  uruguay: {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Uruguayan real estate of any kind — the same rights, process, and lack of residency/permit requirement as a Uruguayan citizen, with no cap on the number of properties owned.",
    extraCost: "N/A",
    source: "Investment Law No. 16.906 (Uruguay) — IMPO (Centro de Información Oficial, Uruguay's official legal database)",
    sourceUrl: "https://www.impo.com.uy/"
  },
  montenegro: {
    status: "WORKAROUND REQUIRED",
    summary: "An ordinary apartment or house away from the coast/border generally follows the same purchase process as for a citizen. The Law on Property and Other Real Rights specifically bars FOREIGN ownership (not just a general rule) of natural resources, agricultural land, forests, cultural-heritage sites of exceptional importance, property within 1km of the state border, and — notably, given Montenegro's coastline-driven appeal — property on islands; these fall outside what a foreign buyer can acquire directly.",
    extraCost: "N/A — a structural ownership exclusion for the listed categories, not a tax",
    source: "Law on Property and Other Real Rights, Montenegro — Government of Montenegro",
    sourceUrl: "https://www.gov.me/en"
  },
  albania: {
    status: "OPEN",
    summary: "No restriction on a foreign individual or company buying a building, apartment, or house — including the (non-agricultural) land beneath it — with full freehold title registered in their own name at the State Cadastre Agency (ASHK). The restriction is specifically on agricultural land, which a foreigner cannot buy directly.",
    extraCost: "N/A — outside the agricultural-land case",
    source: "State Cadastre Agency of Albania (Agjencia Shtetërore e Kadastrës, ASHK)",
    sourceUrl: "https://ashk.gov.al/"
  },
  jamaica: {
    status: "OPEN",
    summary: "No restriction on foreign nationals owning Jamaican freehold land, houses, or condominiums — the same rights as a citizen, with no nationality distinction anywhere in the registration or tax machinery (Tax Administration Jamaica's own transfer-tax schedules make no distinction by the buyer's passport).",
    extraCost: "N/A",
    source: "Tax Administration Jamaica (TAJ)",
    sourceUrl: "https://www.jamaicatax.gov.jm/"
  },
  uzbekistan: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreign individual can buy an apartment, house, or commercial building outright. Article 17 of the Land Code reserves the LAND itself to Uzbekistani ownership — a foreign buyer's land plot comes only as a leasehold (commonly up to 50 years), never as owned land, and a foreigner cannot take part in the separate non-agricultural land privatization scheme that's open to Uzbekistani residents.",
    extraCost: "N/A — a title-type (leasehold vs. freehold land) restriction, not a tax",
    source: "Land Code of the Republic of Uzbekistan, Article 17",
    sourceUrl: "https://lex.uz/"
  },
  kyrgyzstan: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreign individual can own an apartment or building outright. Article 5 of the Land Code limits a foreigner to a paid, temporary-use right over the land itself — never ownership — so a standalone house's land plot is held on a lease, not owned, the same basic structure as neighboring Kazakhstan and Uzbekistan.",
    extraCost: "N/A — a title-type (temporary-use vs. owned land) restriction, not a tax",
    source: "Land Code of the Kyrgyz Republic, Article 5",
    sourceUrl: "https://www.informea.org/en/legislation/land-code-kyrgyz-republic"
  },
  tajikistan: {
    status: "RESTRICTED",
    summary: "All land in Tajikistan is the exclusive property of the state — no one, citizen or foreigner, owns land outright; a foreigner can be granted a land-use right of up to 50 years (Land Code, Art. 25), shorter than a Tajik citizen's indefinite first-tier right. As of a 2026 legislative change, foreign citizens are newly allowed to buy RESIDENTIAL PROPERTY, but only within government-designated areas — a real, still-narrow gate (and a very recent change, worth re-confirming which areas qualify before relying on it).",
    extraCost: "N/A — a land-tenure and designated-area restriction, not a tax",
    source: "Land Code of the Republic of Tajikistan, Article 25; 2026 residential-property amendment (designated areas)",
    sourceUrl: "http://www.cawater-info.net/library/eng/tj/land_code.pdf"
  },
  turkmenistan: {
    status: "RESTRICTED",
    summary: "All land is state-owned; a foreigner cannot buy land outright, only lease it, and critically, a lease for residential premises is capped at just 5 years (vs. up to 40 years for a construction project) under the Land Code. Turkmen law does not expressly forbid a foreigner from owning the building itself (Law on Property 2015, Art. 6(2); Housing Code 2013, Art. 2), but the short residential land-lease term makes any real long-term position structurally difficult regardless.",
    extraCost: "N/A — a severely limited land-lease term, not a tax",
    source: "Land Code of Turkmenistan, Articles 17 and 48; Law on Property of Turkmenistan (21 Nov 2015), Article 6(2)",
    sourceUrl: "https://www.state.gov/reports/2026-investment-climate-statements/turkmenistan"
  },
  // Markets not yet in COUNTRY_ENDPOINTS (Oct 1 2026) — see the file header.
  "saudi arabia": {
    status: "WORKAROUND REQUIRED",
    summary: "A brand-new regime: the Law on Real Estate Ownership by Non-Saudis (in force 21 January 2026) replaced the old 2000 law's capital-threshold/purpose-based approvals with geographic zoning. A non-Saudi (individual or company) can now acquire full ownership, long-term leasehold, or usufruct rights, but only within zones designated by the Real Estate General Authority (REGA) — Riyadh and Jeddah are explicitly named as early zones. Outside a designated zone, ownership is not available.",
    extraCost: "N/A — a zone-eligibility gate, not a tax; very recent (Jan 2026), so which zones are actually open is worth re-confirming before relying on it",
    source: "Law on Real Estate Ownership by Non-Saudis (2025), Umm Al-Qura Official Gazette — Real Estate General Authority (REGA)",
    sourceUrl: "https://rega.gov.sa/"
  },
  qatar: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreign national can hold full freehold title only within 9 designated zones (including Lusail, The Pearl, and West Bay), or a 99-year renewable usufruct right in a further 16 designated zones (including Musheireb and Al Sadd). Outside these 25 zones, non-Qatari ownership isn't available.",
    extraCost: "N/A — a zone-eligibility gate, not a tax",
    source: "Law No. 16 of 2018 on Regulating Non-Qatari Ownership and Use of Properties — Ministry of Justice / Qatar's official non-Qatari-ownership instruction manual",
    sourceUrl: "https://www.qatartourism.com/content/dam/qatar-tourism/non-qatari-realestate/instruction-manual.pdf"
  },
  kuwait: {
    status: "RESTRICTED",
    summary: "Law No. 74 of 1979 generally bars foreign ownership of Kuwaiti real estate. GCC nationals and other Arab-country citizens have a lighter path but are still capped at one property each. A non-GCC foreign national can buy only after 10 years' residence in Kuwait, a clean criminal record, and Council of Ministers approval — and even then is capped at one property of up to 1,000 sqm.",
    extraCost: "N/A — an approval/eligibility gate with a 10-year residency prerequisite, not a tax; realistically a barrier for almost any non-resident buyer",
    source: "Law No. 74 of 1979 Concerning the Ownership of Real Estate by Non-Kuwaitis",
    sourceUrl: "https://www.tamimi.com/law-update-articles/foreign-investment-in-kuwait/"
  },
  china: {
    status: "RESTRICTED",
    summary: "A foreign national cannot buy real estate in China for investment purposes at all — only for genuine self-use/self-residence, and only after having worked or studied continuously in mainland China for at least one year on a valid residence permit (the 2006 'Circular 171' rule). Even then, a foreign individual or family is capped at ONE residential property nationwide.",
    extraCost: "N/A — an eligibility gate (1-year residence + self-use only) and a 1-property national cap, not a tax",
    source: "Circular on Regulating the Access of and Administration over the Foreign Capital in Real Estate Market (2006, 'Circular 171') — Ministry of Natural Resources / Ministry of Housing and Urban-Rural Development",
    sourceUrl: "https://www.mnr.gov.cn/"
  },
  "hong kong": {
    status: "OPEN",
    summary: "No restriction on foreign nationals buying Hong Kong property — since 28 February 2024, the 15% Buyer's Stamp Duty surcharge that previously applied only to non-permanent-resident/non-local buyers was eliminated. Every buyer, local or foreign, now pays the same Ad Valorem Stamp Duty scale regardless of residency or nationality.",
    extraCost: "None specific to foreign buyers since the Feb 2024 reform",
    source: "Rating and Valuation Department / Inland Revenue Department, Hong Kong SAR",
    sourceUrl: "https://www.rvd.gov.hk/"
  },
  taiwan: {
    status: "WORKAROUND REQUIRED",
    summary: "Taiwan's Land Act (Art. 18-19) grants property-purchase rights only to nationals of a country that lets a Taiwanese citizen buy real estate there (reciprocity) — the Ministry of the Interior maintains the list, currently around 77 countries including the US, UK, Japan, South Korea, and Malaysia. Some countries face 'conditional reciprocity' with extra limits (e.g. Philippine citizens cannot buy a standalone house); citizens of Indonesia, Vietnam, Myanmar, and Macau are barred from buying altogether. Agricultural, military, and border-zone land is off-limits to any foreign buyer regardless of reciprocity.",
    extraCost: "N/A — a reciprocity-eligibility gate (and, for a non-listed country, an equal-reciprocity certificate process via Taiwan's overseas offices), not a tax",
    source: "Land Act of the Republic of China (Taiwan), Articles 18-19 — Ministry of the Interior",
    sourceUrl: "https://www.moi.gov.tw/"
  },
  oman: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreigner can hold full freehold title only within an Integrated Tourism Complex (ITC) — a government-approved mixed residential/hospitality development (at least 200,000 sqm, at least 20km from an international border, with residential units capped at no more than the number of hotel units). Outside an ITC, non-Omani freehold ownership isn't available. Transactions are registered through the Ministry of Housing and Urban Planning's Amlak system.",
    extraCost: "N/A — a zone-eligibility gate, not a tax",
    source: "Royal Decree No. 12/2006, Law on Foreign Ownership of Real Estate in Integrated Tourism Complexes — Ministry of Housing and Urban Planning",
    sourceUrl: "https://www.haa.gov.om/"
  },
  bahrain: {
    status: "WORKAROUND REQUIRED",
    summary: "A non-GCC foreign national can hold full freehold title, including the underlying land, only within designated Investment Areas named in Legislative Decree No. 2 of 2001 and its updates — Amwaj Islands, Bahrain Bay, Dilmunia, Durrat Al Bahrain, Diyar Al Muharraq, Riffa Views, Marsa Al Seef, and (added April 2025) Bilaj Al Jazayer, among others. Outside these zones, non-GCC freehold ownership isn't available; every acquisition must be formally recorded with the Survey and Land Registration Bureau (SLRB) to carry legal effect.",
    extraCost: "N/A — a zone-eligibility gate, not a tax",
    source: "Legislative Decree No. 2 of 2001 (Bahrain) — Survey and Land Registration Bureau (SLRB)",
    sourceUrl: "https://www.slrb.gov.bh/"
  },
  jordan: {
    status: "WORKAROUND REQUIRED",
    summary: "A foreign national (other than a fellow Arab-country citizen, who is exempt from this test) can own urban residential property only where reciprocity exists — Jordanian citizens must be able to buy equivalently in the buyer's own country. Approval runs through the Department of Lands and Survey (DLS) and, depending on size/location, up to the Minister of Finance or the Council of Ministers; an approved purchase of land must generally be developed within 5 years.",
    extraCost: "N/A — a reciprocity/approval requirement, not a tax",
    source: "Law No. 47 of 2006 on Leasing and Selling Immovable Assets to Non-Jordanians and Juristic Persons — Department of Lands and Survey (DLS)",
    sourceUrl: "https://dls.gov.jo/"
  },
  lebanon: {
    status: "OPEN",
    summary: "A foreign national can own up to 3,000 sqm of land/built property in aggregate across Lebanon with no permit needed at all — comfortably covering an ordinary apartment or house. Only above that threshold does a Council of Ministers decree become necessary (entirely discretionary, no appeal). Separately, Lebanon caps how much land ALL foreigners combined may ever hold — 3% of any province's area, 10% of Beirut's — a national ceiling, not an individual buyer's problem in practice.",
    extraCost: "N/A — outside the 3,000 sqm/individual-permit case",
    source: "Legislative Decree No. 11614 (4 January 1969), as amended by Law No. 296/2001 — Investment Development Authority of Lebanon (IDAL)",
    sourceUrl: "https://investinlebanon.gov.lb/"
  },
  pakistan: {
    status: "RESTRICTED",
    summary: "Foreign ownership is heavily gated rather than banned outright: a foreigner generally needs a Ministry of Interior NOC, provincial Home Department approval, and Board of Investment clearance before buying. Purchase is barred entirely in the federal capital Islamabad, residential plots in provincial capitals are capped at 300 sqm, a foreign buyer is limited to two residential properties nationwide, and Sindh and Balochistan provinces broadly restrict foreign ownership further still.",
    extraCost: "N/A — a multi-agency approval gate plus size/location/count caps, not a tax",
    source: "Foreigners Act, 1946, Section 3(1) (federal orders restricting foreigners' property acquisition) — Board of Investment, Pakistan",
    sourceUrl: "https://boi.gov.pk/"
  },
  bangladesh: {
    status: "WORKAROUND REQUIRED",
    summary: "Bangladeshi law reserves direct land ownership to citizens — a foreigner cannot buy a standalone house with its land. Since 1996, however, a foreigner CAN buy a flat/apartment outright, the route most foreign buyers actually use; a 99-year lease is the alternative for land, and a locally-incorporated company (even 100% foreign-owned) can hold land where an individual cannot.",
    extraCost: "N/A — an ownership-structure restriction for land/houses, not a tax; doesn't apply to the apartment route",
    source: "Transfer of Property Act 1882 / Registration Act 1908 (Bangladesh); Foreign Private Investment (Promotion and Protection) Act 1980",
    sourceUrl: "https://bida.gov.bd/"
  },
  tunisia: {
    status: "WORKAROUND REQUIRED",
    summary: "Buying land or a building in an ordinary residential zone needs prior authorization from the regional Governor (Decree of 4 June 1957) — a real, mandatory approval step; the sale contract is void without it. A purchase within a designated industrial or tourist zone, for an economic/tourism project, is free of this requirement. Agricultural land cannot be bought by a foreigner at all — only leased.",
    extraCost: "N/A — a governor-authorization requirement for the ordinary-zone case, not a tax",
    source: "Decree of 4 June 1957 on Real Estate Transactions (Tunisia)",
    sourceUrl: "https://www.commerce.gov.tn/"
  },
  "costa rica": {
    status: "OPEN",
    summary: "Outside Costa Rica's Maritime Zone, a foreign buyer holds direct freehold title in their own name, registered at the National Registry (Registro Nacional) — no trust/fideicomiso structure needed, the same process as a citizen. The exception is the Maritime Zone itself (200m inland from the high-tide line): the first 50m is inalienable public land (no ownership or lease at all), and in the next 150m a foreigner who hasn't lived in Costa Rica for 5+ years is capped at 49% of a concession, majority-owned by a Costa Rican.",
    extraCost: "N/A — outside the narrow coastal Maritime Zone case",
    source: "Ley sobre la Zona Marítimo Terrestre (Ley 6043), Article 47 — Registro Nacional de Costa Rica",
    sourceUrl: "https://www.rnpdigital.com/"
  },
  guatemala: {
    status: "OPEN",
    summary: "Outside specific protected zones, a foreign buyer has exactly the same property rights as a Guatemalan — buy, sell, rent, inherit, and develop, with no distinction. Article 123 of the Constitution reserves land within 15km of an international border (Mexico, Belize, Honduras, El Salvador) to Guatemalans of origin only, and separately restricts ownership within 3km of an ocean coastline, 200m of a lake shore, or 100m of a navigable river.",
    extraCost: "N/A — outside the specific border/coastal/lake/river zones",
    source: "Constitution of the Republic of Guatemala, Article 123 — Registro General de la Propiedad",
    sourceUrl: "https://www.rgp.org.gt/"
  },
  nicaragua: {
    status: "OPEN",
    summary: "No restriction on a foreign national buying a house, condo, apartment, or urban lot — the same rights as a citizen (Constitution, Art. 44; Foreign Investment Law, Ley 344), registered directly in their own name at the Public Registry (Registro Público). The exceptions are geographic: direct foreign ownership is barred within 5km of the Honduran or Costa Rican border, the first 50m of coastline is public domain, and Caribbean Coast communal/indigenous territories aren't freely tradeable to anyone, foreign or Nicaraguan.",
    extraCost: "N/A — outside the border/coastal/communal-territory cases",
    source: "Constitution of Nicaragua, Article 44; Foreign Investment Law (Ley 344) — Registro Público de la Propiedad",
    sourceUrl: "https://www.poderjudicial.gob.ni/"
  },
  ghana: {
    status: "WORKAROUND REQUIRED",
    summary: "Ghana's 1992 Constitution bars a non-Ghanaian from acquiring freehold land outright — a real, nationality-based rule, not just a default. The route for a foreign buyer is a leasehold, legally capped at 50 years under the Land Act 2020 (a Ghanaian citizen can lease for up to 99 years). A building constructed on leased land is fully owned by the foreign buyer; only the underlying land is leasehold. Registration with the Lands Commission is mandatory either way.",
    extraCost: "N/A — a title-type (50-year leasehold vs. freehold) restriction, not a tax",
    source: "Constitution of the Republic of Ghana (1992); Land Act, 2020 (Act 1036) — Lands Commission",
    sourceUrl: "https://lc.gov.gh/"
  },
  ethiopia: {
    status: "WORKAROUND REQUIRED",
    summary: "A major, very recent change: Proclamation No. 1388/2025 opened residential property ownership to foreign nationals for the first time ever, ending a decades-long total ban. A foreign buyer (other than a naturalized Ethiopian or dual citizen) now needs prior authorization from the Ministry of Urban and Infrastructure Development, must meet a minimum investment threshold (around USD 150,000 per transaction), pass a background/security check, and is generally limited to one residential property at a time.",
    extraCost: "N/A — an authorization requirement plus a ~USD 150,000 investment-threshold gate, not a tax; this is brand new (2025), worth re-confirming the current threshold before relying on it",
    source: "Proclamation No. 1388/2025 (Ethiopia) — Ministry of Urban and Infrastructure Development",
    sourceUrl: "https://www.mudc.gov.et/"
  },
  monaco: {
    status: "OPEN",
    summary: "No restriction on a foreign individual, of any nationality, buying Monegasque real estate — Article 32 of the Constitution grants foreigners every private right not formally reserved to nationals, and no law reserves real estate ownership to Monegasque citizens. Monaco's registration-duty schedule confirms this isn't just silence: an individual buyer (Monegasque or foreign) pays the same 4.5% rate, while the higher 7.5-10% rate targets opaque corporate/offshore acquisition structures specifically, regardless of the beneficial owner's nationality.",
    extraCost: "None specific to foreign individual buyers; the higher registration duty applies only when buying through a non-transparent corporate/offshore entity, not based on the buyer's nationality",
    source: "Constitution of the Principality of Monaco (1962, rev. 2002), Article 32 — Journal de Monaco n°7542 (12 April 2002)",
    sourceUrl: "https://legimonaco.mc/constitution/"
  }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

export function getForeignBuyerRule(country) {
  const rule = RULES[normalizeCountry(country)];
  return rule ? { ...rule } : null;
}

// Proper-case display name for each key, since RULES is keyed lowercase
// for lookup. Used only by listForeignBuyerRules() below.
const DISPLAY_NAMES = {
  canada: "Canada", australia: "Australia", "new zealand": "New Zealand",
  switzerland: "Switzerland", mexico: "Mexico", thailand: "Thailand",
  singapore: "Singapore", denmark: "Denmark", vietnam: "Vietnam",
  philippines: "Philippines", "united arab emirates": "United Arab Emirates",
  "united states": "United States", "united kingdom": "United Kingdom",
  japan: "Japan", "south korea": "South Korea", india: "India",
  "sri lanka": "Sri Lanka", cambodia: "Cambodia", indonesia: "Indonesia",
  israel: "Israel", france: "France", spain: "Spain", portugal: "Portugal",
  italy: "Italy", germany: "Germany", greece: "Greece",
  netherlands: "Netherlands", cyprus: "Cyprus", ireland: "Ireland",
  belgium: "Belgium", sweden: "Sweden", norway: "Norway", poland: "Poland",
  austria: "Austria", "czech republic": "Czech Republic", hungary: "Hungary",
  croatia: "Croatia", turkey: "Turkey", finland: "Finland",
  bulgaria: "Bulgaria", romania: "Romania", slovakia: "Slovakia",
  slovenia: "Slovenia", malta: "Malta", estonia: "Estonia",
  brazil: "Brazil", argentina: "Argentina",
  georgia: "Georgia", latvia: "Latvia", lithuania: "Lithuania", iceland: "Iceland",
  chile: "Chile", colombia: "Colombia", peru: "Peru", serbia: "Serbia",
  malaysia: "Malaysia", morocco: "Morocco", panama: "Panama", qatar: "Qatar",
  mauritius: "Mauritius", "south africa": "South Africa", egypt: "Egypt",
  kenya: "Kenya", bahamas: "Bahamas", "dominican republic": "Dominican Republic",
  barbados: "Barbados", monaco: "Monaco", russia: "Russia", kazakhstan: "Kazakhstan",
  armenia: "Armenia", "bosnia and herzegovina": "Bosnia and Herzegovina",
  andorra: "Andorra", "north macedonia": "North Macedonia", ukraine: "Ukraine",
  nigeria: "Nigeria", "puerto rico": "Puerto Rico", moldova: "Moldova",
  liechtenstein: "Liechtenstein", "san marino": "San Marino", bolivia: "Bolivia",
  ecuador: "Ecuador", paraguay: "Paraguay", "cayman islands": "Cayman Islands",
  azerbaijan: "Azerbaijan", kosovo: "Kosovo", "trinidad and tobago": "Trinidad and Tobago",
  maldives: "Maldives", belarus: "Belarus", uruguay: "Uruguay", montenegro: "Montenegro",
  albania: "Albania", jamaica: "Jamaica", uzbekistan: "Uzbekistan", kyrgyzstan: "Kyrgyzstan",
  tajikistan: "Tajikistan", turkmenistan: "Turkmenistan",
  "saudi arabia": "Saudi Arabia", qatar: "Qatar", kuwait: "Kuwait", china: "China",
  "hong kong": "Hong Kong", taiwan: "Taiwan", oman: "Oman", bahrain: "Bahrain",
  jordan: "Jordan", lebanon: "Lebanon", pakistan: "Pakistan", bangladesh: "Bangladesh",
  tunisia: "Tunisia", "costa rica": "Costa Rica", guatemala: "Guatemala",
  nicaragua: "Nicaragua", ghana: "Ghana", ethiopia: "Ethiopia"
};

// Every covered country, alphabetically by display name — powers the free
// public "Can foreigners buy property here?" checker (foreign-buyer-check.html).
export function listForeignBuyerRules() {
  return Object.keys(RULES)
    .map((key) => ({ country: DISPLAY_NAMES[key] || key, ...RULES[key] }))
    .sort((a, b) => a.country.localeCompare(b.country));
}
