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
  israel: "Israel"
};

// Every covered country, alphabetically by display name — powers the free
// public "Can foreigners buy property here?" checker (foreign-buyer-check.html).
export function listForeignBuyerRules() {
  return Object.keys(RULES)
    .map((key) => ({ country: DISPLAY_NAMES[key] || key, ...RULES[key] }))
    .sort((a, b) => a.country.localeCompare(b.country));
}
