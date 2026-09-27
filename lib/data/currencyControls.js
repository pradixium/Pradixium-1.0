/* PRADIXIUM™ — Currency & Capital Transfer Controls
 * Distinct from the ordinary exchange-rate fluctuation risk shown
 * elsewhere on the site: this covers real, legally-binding restrictions on
 * moving money INTO the country to fund a purchase, or OUT of it later
 * (an annual FX quota for residents, a central-bank approval threshold, a
 * mandatory capital-registration step, or a sanctions-driven block on
 * repatriation). A property can look like a great deal on paper and still
 * be a trap if the investor's own money can't legally get there, or their
 * profits can't legally get back out.
 *
 * Same honesty discipline as every other data source in this project: only
 * countries with a verifiable, citable rule from a central bank, ministry
 * of finance, or a reputable law-firm/Big-4-style capital-controls guide
 * citing the official regulation are listed here. A country with a
 * genuinely liberalized/free capital account is still worth stating
 * explicitly (that's a real finding, not a gap) — but a country with no
 * entry here simply hasn't been researched yet, not "confirmed free."
 * Capital-control regimes can change fast (several entries below shifted
 * materially in 2024-2026) — the UI should tell users to verify current
 * rules before relying on this for a purchase decision.
 */
const CONTROLS = {
  china: {
    status: "Annual outbound FX quota (citizens/residents), approval required above it",
    summary: "Chinese residents may convert and remit up to US$50,000 per person per year without special approval. Using this quota (or splitting remittances among multiple people, i.e. 'ant moving') to fund an overseas property purchase is explicitly illegal beyond the quota; amounts above $50,000 require specific SAFE approval, which is rarely granted for outbound real estate.",
    transferLimit: "$50,000/year per individual (not usable, even in aggregate via family members, for overseas property beyond this cap)",
    requiresApproval: true,
    source: "State Administration of Foreign Exchange (SAFE) / People's Bank of China",
    sourceUrl: "https://www.safe.gov.cn/en/2017/1230/1391.html"
  },
  india: {
    status: "Annual outbound FX quota (Liberalised Remittance Scheme), RBI approval above it",
    summary: "Resident individuals may remit up to US$250,000 per financial year under the RBI's Liberalised Remittance Scheme (LRS) for permitted purposes, explicitly including purchase of overseas property. Family members can each use their own $250,000 quota and pool funds as co-owners for a single purchase. Remittances above the cap require specific RBI approval.",
    transferLimit: "$250,000/financial year per individual (poolable across family co-owners)",
    requiresApproval: true,
    source: "Reserve Bank of India (RBI)",
    sourceUrl: "https://www.rbi.org.in/commonperson/english/scripts/FAQs.aspx?Id=1834"
  },
  argentina: {
    status: "Capital controls largely lifted (April 2025 reform)",
    summary: "Argentina's long-standing 'cepo cambiario' (multi-tier FX controls, including a personal savings-dollar allowance and effective bans on profit repatriation) was substantially dismantled by the Milei government in April 2025. As of 2026 the official, MEP and blue-dollar rates have converged, and inbound property-purchase funds and outbound repatriation now move mainly through ordinary authorized-bank channels rather than a formal quota regime.",
    transferLimit: "None currently (formal quotas removed April 2025); use authorized banks and keep documentation as rules can still shift",
    requiresApproval: false,
    source: "Banco Central de la República Argentina (BCRA) / Dentons legal alert",
    sourceUrl: "https://www.dentons.com/en/insights/alerts/2025/april/16/removal-of-foreign-exchange-controls-in-argentina"
  },
  nigeria: {
    status: "Mandatory capital registration (Certificate of Capital Importation) to preserve repatriation rights",
    summary: "There is no cap on inbound investment capital, but every foreign investor must obtain a Certificate of Capital Importation (CCI) from a Nigerian bank when funds enter the country. The e-CCI is the sole legal basis for later repatriating the investment, profits, or sale proceeds through the official FX market — failing to register the inflow can trap funds in Nigeria.",
    transferLimit: "No numeric cap on inflow; repatriation rights depend entirely on holding a valid CCI",
    requiresApproval: true,
    source: "Central Bank of Nigeria (CBN)",
    sourceUrl: "https://www.mondaq.com/nigeria/inward-foreign-investment/1730914/certificate-of-capital-importation-for-capital-goods-and-equipment-imports-into-nigeria-key-considerations-for-foreign-investors"
  },
  egypt: {
    status: "Mandatory foreign-currency inbound transfer for property purchase; documentation required for repatriation",
    summary: "Since March 26, 2024, a foreign buyer must prove the purchase price was transferred into Egypt in foreign currency through a CBE-authorized bank. When later reselling, repatriation of sale proceeds is permitted but is conditioned on producing the original bank certificate of inward transfer and paying due taxes — there is no automatic guarantee without that paperwork.",
    transferLimit: "No numeric cap, but 100% of the purchase price must arrive via official FX banking channel",
    requiresApproval: false,
    source: "Central Bank of Egypt (CBE) / Egyptian Cabinet Circular 41",
    sourceUrl: "https://www.businesstodayegypt.com/amp/1/2721/Egypt-eases-restrictions-on-foreign-real-estate-ownership-now-requires"
  },
  vietnam: {
    status: "Mandatory investment capital account; largely free profit repatriation",
    summary: "Foreign investors must channel all investment capital, and later any profit or dividend remittance, through a licensed-bank Investment Capital Account under SBV Circular 38/2026/TT-NHNN. Real estate deals face extra land-use/security review, and borrowing for real estate speculation is barred, but once tax and reporting obligations are met, there are no significant additional restrictions on repatriating capital or profits.",
    transferLimit: "No numeric quota; foreign loans of 12+ months require separate SBV registration (SBV Hanoi handles loans ≥ $10 million)",
    requiresApproval: true,
    source: "State Bank of Vietnam (SBV)",
    sourceUrl: "https://www.alitium.com/vietnam-outbound-investment-foreign-exchange-controls-and-capital-transfer-framework"
  },
  ethiopia: {
    status: "Liberalized repatriation (2024 reform) but subject to real FX-availability shortages",
    summary: "Following Ethiopia's mid-2024 forex overhaul, foreign investors can have banks process repatriation of dividends, sale/liquidation proceeds and reclaimed capital without needing NBE's individual approval, provided required documents are filed. In practice, actual transfers can be delayed weeks or months by hard-currency shortages, and capital must be registered with the NBE within one year of entry or repatriation rights can be lost.",
    transferLimit: "No numeric quota; one-year window to register inbound capital with NBE to preserve repatriation eligibility",
    requiresApproval: false,
    source: "National Bank of Ethiopia (NBE)",
    sourceUrl: "https://capitalethiopia.com/2026/02/08/nbe-eases-repatriation-rules-boosting-fdi-potential/"
  },
  venezuela: {
    status: "Central bank-controlled FX market; repatriation of proceeds practically constrained",
    summary: "All foreign-currency exchange in Venezuela is centralized through the Banco Central de Venezuela (BCV), which sets the exchange rate. There is no rule specifically barring foreigners from owning residential property, but converting local sale/rental proceeds to USD and wiring them abroad is reported as operationally complex and unreliable given the controlled FX system.",
    transferLimit: "Not quantified; FX conversion routed exclusively through BCV-controlled market",
    requiresApproval: true,
    source: "Banco Central de Venezuela (BCV)",
    sourceUrl: "https://mylatinlife.com/venezuela-real-estate-foreigners/"
  },
  zimbabwe: {
    status: "Free inbound investment; RBZ prior authorization required for outward repatriation",
    summary: "Foreign investors can bring capital into Zimbabwe with no restriction on the amount. Repatriating profits, dividends or capital back out, however, requires prior Reserve Bank of Zimbabwe authorization, with approval conditioned on foreign-currency availability and compliance with exchange-control policy — it is legally permitted but not automatic.",
    transferLimit: "No cap on inflow; outflow subject to RBZ case-by-case authorization (no fixed numeric limit found)",
    requiresApproval: true,
    source: "Reserve Bank of Zimbabwe (RBZ), Exchange Control Regulations (S.I. 109 of 1996)",
    sourceUrl: "https://www.rbz.co.zw/index.php/regulation-supervision/exchange-control/foreign-investment-trade-framework/89-foreign-investment-trade-operational-framework"
  },
  pakistan: {
    status: "SBP approval required for repatriation of certain property sale proceeds",
    summary: "Foreign inbound funds for property purchase typically flow through a Non-Resident Rupee Value Account (NRVA) or Non-Resident Foreign Currency Account, with withdrawals for approved purposes. Sale proceeds are not automatically eligible for repatriation — the State Bank of Pakistan can require specific permission, particularly where the property was originally funded through certain types of local lending, and the process commonly takes 2-3 months.",
    transferLimit: "No numeric quota found; repatriation eligibility depends on correct registration of inward capital and, in some cases, SBP permission",
    requiresApproval: true,
    source: "State Bank of Pakistan (SBP)",
    sourceUrl: "https://saleemlawfirm.com/blog/foreign-exchange-regulations-in-pakistan/"
  },
  bangladesh: {
    status: "Central bank approval required above a repatriation threshold",
    summary: "Authorized Dealer banks can independently clear repatriation of a foreign investor's property/investment sale proceeds up to BDT 1 billion without seeking Bangladesh Bank's prior approval (raised tenfold from the previous BDT 100 million ceiling). Amounts above that threshold require specific Bangladesh Bank approval. Post-tax dividend/profit remittance on non-resident investment does not require prior approval.",
    transferLimit: "BDT 1,000,000,000 (~US$8.3M) — AD-bank-approvable ceiling for sale-proceeds repatriation; above this, Bangladesh Bank approval is required",
    requiresApproval: true,
    source: "Bangladesh Bank",
    sourceUrl: "https://tahmidurrahman.com/new-capital-repatriation-rules-by-bangladesh-bank/"
  },
  angola: {
    status: "Liberalized — no prior BNA licensing needed for most registered-investment repatriation",
    summary: "Under BNA Notice 11/2021, most foreign-investment repatriation operations by non-residents (excluding the oil sector) no longer require prior Banco Nacional de Angola licensing; commercial banks handle compliance directly. Repatriation still depends on the investor having met investment-project obligations and paid due taxes, and practical foreign-currency shortages can constrain actual transfers.",
    transferLimit: "No numeric cap found; repatriation conditioned on tax/investment-project compliance, not a licensing quota",
    requiresApproval: false,
    source: "Banco Nacional de Angola (BNA)",
    sourceUrl: "https://www.plmj.com/en/knowledge/informative-notes/Angola-New-foreign-exchange-rules-for-foreign-investment-and-capital-transactions/31861/"
  },
  ukraine: {
    status: "Wartime capital controls — repatriation of Ukrainian asset/property-sale proceeds currently blocked",
    summary: "Under Ukraine's martial-law FX regime, cross-border currency operations are prohibited unless expressly permitted by the National Bank of Ukraine. As of the NBU's 2026 liberalization updates, a foreign investor who sells Ukrainian real estate (or other assets) to a domestic buyer still cannot transfer the sale proceeds abroad — the funds may be held locally but not remitted internationally.",
    transferLimit: "Repatriation of real-estate/asset sale proceeds effectively prohibited under current martial-law rules (no exception found for property sales)",
    requiresApproval: true,
    source: "National Bank of Ukraine (NBU)",
    sourceUrl: "https://chamber.ua/news/investment-into-ukraine-sapital-repatriation-regime-and-currency-control-restrictions/"
  },
  "south africa": {
    status: "Free capital account for non-residents; documentation required for future repatriation",
    summary: "SARB exchange controls on non-residents have been abolished — foreigners can invest in South African property without prior SARB approval, provided the deal is at arm's length and fair market value. However, the receiving bank must issue a 'deal receipt'/proof of the inward foreign-currency transfer, and without that documentation a foreign owner cannot repatriate the proceeds of a later resale. Foreign buyers financing locally are also capped at borrowing 100% of the amount they brought in (i.e., roughly 50% loan-to-value).",
    transferLimit: "No cap on inflow; local financing capped near 50% LTV; repatriation requires proof of the original inward transfer",
    requiresApproval: false,
    source: "South African Reserve Bank (SARB), Financial Surveillance Department",
    sourceUrl: "https://www.resbank.co.za/content/dam/sarb/what-we-do/financial-surveillance/financial-surveillance-documents/2026/Currency%20and%20Exchanges%20Manual%20for%20Authorised%20Dealers.pdf"
  },
  "sri lanka": {
    status: "Free capital account via Inward Investment Account",
    summary: "Foreign buyers must route property-purchase funds through an Inward Investment Account (IIA) or equivalent inward remittance channel monitored by the Central Bank's Department of Foreign Exchange. Once routed this way, 100% of the sale/investment proceeds can be repatriated overseas without restriction — the inward-remittance proof is the key requirement, not a cap.",
    transferLimit: "No cap; 100% outward remittance of investment proceeds is freely permitted once inward-remittance is documented",
    requiresApproval: false,
    source: "Central Bank of Sri Lanka, Department of Foreign Exchange",
    sourceUrl: "https://www.dfcc.lk/personal/foreign-currency-accounts/inward-investment-account"
  },
  algeria: {
    status: "No statutory approval requirement, but heavy bureaucratic transfer procedure",
    summary: "Algeria imposes few statutory limits on foreign investors converting or repatriating income (dividends, sale proceeds) as long as the original investment was a cash contribution in foreign currency remitted from abroad. In practice, however, the conversion/transfer process involves roughly 30 procedural steps and commonly takes three to six months. Separately, taking more than 10,000 Algerian dinars in cash out of the country, or exchanging dinars abroad, is illegal.",
    transferLimit: "No formal numeric investment-repatriation cap; cash-currency export capped at 10,000 DZD",
    requiresApproval: false,
    source: "Bank of Algeria (Banque d'Algérie)",
    sourceUrl: "https://generisonline.com/understanding-foreign-exchange-controls-in-algeria/"
  },
  turkey: {
    status: "Mandatory FX conversion and documentation requirement for property deals",
    summary: "The CBRT requires that payment for real-estate purchases by foreign individuals be conducted in foreign currency: the buyer wires foreign currency into a Turkish bank, the bank sells it to the CBRT on the buyer's behalf before title registration, and issues a Foreign Exchange Purchase Certificate (Döviz Alım Belgesi, DAB) confirming the USD-equivalent amount. That same DAB documentation is what supports repatriating proceeds if the property is later resold.",
    transferLimit: "No numeric quota; 100% of the purchase price must be exchanged through a bank with a DAB issued",
    requiresApproval: false,
    source: "Central Bank of the Republic of Türkiye (CBRT)",
    sourceUrl: "https://www.esin.av.tr/2022/02/28/foreign-currency-requirement-in-property-acquisition-by-foreigners/"
  },
  russia: {
    status: "Central-bank restrictions and sanctions vary sharply by the investor's nationality",
    summary: "There is no Western sanction that bars foreigners from owning Russian property outright, but the Bank of Russia has repeatedly extended special settlement/withdrawal restrictions (e.g., on foreign-cash withdrawals and on certain deposit/capital movements) that apply differently to citizens of 'unfriendly' sanctioning states versus 'neutral' countries. Repatriating profits or sale proceeds out of Russia is described as significantly harder, or potentially impossible, for investors from the US, EU, UK, Canada and Australia specifically.",
    transferLimit: "No single numeric cap; restrictions are decree-based and nationality-dependent (e.g., Presidential Decrees No. 377 and No. 550 of 2026 on settlement regimes)",
    requiresApproval: true,
    source: "Bank of Russia (CBR) / Russian Presidential Decrees",
    sourceUrl: "https://cbr.ru/press/event/?id=26921"
  },
  belarus: {
    status: "Sanctions-driven block on divestment/repatriation for investors from 'unfriendly' states",
    summary: "Since a law that took effect in January 2023, Belarus restricts investors from countries it designates 'unfriendly' (including the US) from selling shares in Belarusian companies or withdrawing their investment, and authorizes seizure of such investors' property. Combined with Belarusian banks' exclusion from SWIFT and hard-currency shortages following a 2022 external-debt default, this makes inbound investment and any later repatriation for Western investors extremely restricted — this is fundamentally a sanctions/counter-sanctions regime layered on top of ordinary FX rules.",
    transferLimit: "Not quantified; effectively blocked for 'unfriendly-state' investors rather than capped",
    requiresApproval: true,
    source: "U.S. Department of State, Investment Climate Statement: Belarus (2025) / Belarusian 'unfriendly states' legislation",
    sourceUrl: "https://www.state.gov/reports/2025-investment-climate-statements/belarus"
  },
  cuba: {
    status: "U.S. sanctions prohibit U.S.-person property transactions absent a specific OFAC license",
    summary: "This is a U.S. sanctions restriction, not a Cuban capital control: under the Cuban Assets Control Regulations (31 CFR Part 515), a person subject to U.S. jurisdiction is generally prohibited from purchasing, leasing, or otherwise financially engaging in Cuban real estate transactions unless authorized by a general or specific OFAC license. Violations carry civil penalties up to $91,522 per transaction and criminal penalties up to $1 million and 10 years' imprisonment.",
    transferLimit: "Not applicable — transactions are prohibited outright for U.S. persons absent an OFAC license (no quota regime)",
    requiresApproval: true,
    source: "U.S. Treasury Office of Foreign Assets Control (OFAC), Cuban Assets Control Regulations",
    sourceUrl: "https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V/part-515"
  }
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

export function getCurrencyControls(country) {
  const entry = CONTROLS[normalizeCountry(country)];
  return entry ? { ...entry } : null;
}
