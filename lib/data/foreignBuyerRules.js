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
 * Two entries (Singapore, Philippines) cover markets not yet in the
 * country dropdown/COUNTRY_ENDPOINTS — kept here ready to go live the
 * moment those markets get a data adapter, since the research is already
 * done; they're simply unreachable until then.
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
    summary: "No restriction across most of Greece. In designated border/military-sensitive zones only (parts of Thrace, the Dodecanese including Rhodes, parts of Crete, and Lesbos/Chios), a prior permit from the Ministry of National Defence is required before the purchase can complete — this mainly affects non-EU buyers. In practice the permit is routinely granted for an ordinary residential purchase, but it is a real approval step, not just paperwork.",
    extraCost: "No fee for the permit itself, but it commonly adds 3-6 months in the affected zones",
    source: "Greek Law 1892/1990 — Ministry of National Defence",
    sourceUrl: "https://www.mod.mil.gr/"
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
  mauritius: "Mauritius"
};

// Every covered country, alphabetically by display name — powers the free
// public "Can foreigners buy property here?" checker (foreign-buyer-check.html).
export function listForeignBuyerRules() {
  return Object.keys(RULES)
    .map((key) => ({ country: DISPLAY_NAMES[key] || key, ...RULES[key] }))
    .sort((a, b) => a.country.localeCompare(b.country));
}
