/* PRADIXIUM™ — the attribution / licence notice each data source's own terms
 * require, added to the report's sources as a "Licence" block — only for a
 * source the report's evidence actually used (its text matches).
 *
 * Every entry was checked on the body's own licence page (Oct 3 2026):
 *  UK      gov.uk Price Paid / UK HPI pages — the HMLR statement, OGL v3.0;
 *          ONS — "Source: Office for National Statistics licensed under the
 *          Open Government Licence v.3.0"
 *  France  Licence Ouverte 2.0 — source + date of last update
 *  Germany Datenlizenz Deutschland – Namensnennung 2.0 (Zensus, Destatis):
 *          provider, licence + link, changes noted; BORIS-NRW dl-de/zero
 *  Canada  Statistics Canada Open Licence — "Adapted from Statistics
 *          Canada, product, reference date. This does not constitute an
 *          endorsement by Statistics Canada of this product."
 *  CC BY 4.0 (credit, licence link, changes indicated): ABS, NSW, SA, VIC,
 *          CSO Ireland, CBS ("Bron: CBS. Eigen bewerking"), SSB, Statistics
 *          Finland, Statistik Austria, Statistics Denmark (StatBank code,
 *          "own calculations"), HMS Iceland, Agenzia delle Entrate – OMI,
 *          INE Portugal, ČSÚ (+ link to its conditions), KSH (active link),
 *          GURS Slovenia, VZD Latvia
 *  SCB     CC0 — "Source: Statistics Sweden" recommended
 *  Israel  CBS open licence — CBS, product, date of access, link, licence link
 *  Japan   MLIT site terms (PDL1.0) — 出典 + "を加工して作成" when processed
 *  HK      DATA.GOV.HK terms — the Government and RVD named as owners
 *  S.Africa Stats SA release imprint — Stats SA as source of the basic data,
 *          processing stated as the user's own
 *  Turkey  EVDS terms — source named; a translation is not TCMB's official
 *          one; no extra fee is charged for the data (the report price is
 *          the same in every country)
 *  Spain   Catastro licence (licdescargaES.pdf, cl. 6 + 12): commercial use of
 *          transformed information allowed; cite the Dirección General del
 *          Catastro and the date of access
 *  Dubai   Dubai Government open data (Law No. 26 of 2015): attribution to the
 *          Dubai Government and the Dubai Land Department; no suggestion of
 *          endorsement (the licence page itself did not answer — see CLAUDE.md)
 * Singapore has its own block in the orchestrator (dataset + access date).
 */

const CC = "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)";
const OWN = "figures selected and recalculated (medians, changes, unit conversions) by Pradixium; not endorsed by the publisher";

const RULES = [
  { c: /^(uk|united kingdom|england|scotland|wales|northern ireland)$/, m: /Land Registry|Price Paid|UK HPI|House Price Index/i,
    t: () => `Contains HM Land Registry data © Crown copyright and database right ${new Date().getUTCFullYear()}. This data is licensed under the Open Government Licence v3.0 (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). UK HPI: Office for National Statistics and HM Land Registry; figures are for the area and period stated above.` },
  { c: /^(uk|united kingdom|england|scotland|wales|northern ireland)$/, m: /Private Rents|ONS\b|Office for National Statistics/i,
    t: () => "Source: Office for National Statistics licensed under the Open Government Licence v.3.0." },

  { c: /^france$/, m: /DVF|valeurs foncières/i,
    t: (raw) => `Demandes de valeurs foncières (DVF): DGFiP — Ministères économiques et financiers, geolocated files by Etalab (data.gouv.fr), Licence Ouverte 2.0 (https://www.etalab.gouv.fr/licence-ouverte-open-licence/)${raw?.dvfLastUpdate ? `, last updated ${raw.dvfLastUpdate}` : ""}; ${OWN}.` },
  { c: /^france$/, m: /INSEE/i, t: () => "Source: Insee (price index and rent reference index, periods stated above), Licence Ouverte 2.0." },
  { c: /^france$/, m: /ADEME|DPE/, t: () => "ADEME — DPE logements existants (dpe03existant, data.ademe.fr), Licence Ouverte 2.0; matched to DVF sales by Pradixium." },
  { c: /^france$/, m: /Carte des loyers/i, t: () => "Carte des loyers 2025 — Ministère de la Transition écologique (DHUP) / ANIL, data.gouv.fr, Licence Ouverte 2.0, last updated 11 December 2025." },

  { c: /^germany$/, m: /Zensus/i,
    t: () => "Zensus 2022: © Statistische Ämter des Bundes und der Länder, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), https://ergebnisse.zensus2022.de; rent × size calculated by Pradixium." },
  { c: /^germany$/, m: /Destatis|Statistisches Bundesamt/i,
    t: () => "Statistisches Bundesamt (Destatis), Häuserpreisindex, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), https://www-genesis.destatis.de." },
  { c: /^germany$/, m: /BORIS|Immobilienrichtwert/i,
    t: () => "Immobilienrichtwerte: Gutachterausschüsse für Grundstückswerte in NRW, BORIS-NRW, Datenlizenz Deutschland – Zero – Version 2.0 (www.govdata.de/dl-de/zero-2-0); assigned to addresses by Pradixium." },

  { c: /^canada$/, m: /Statistics Canada|StatCan|New Housing Price Index/i,
    t: () => "Adapted from Statistics Canada, New Housing Price Index (Table 18-10-0205-01), reference month as stated above. This does not constitute an endorsement by Statistics Canada of this product." },
  { c: /^canada$/, m: /CMHC/,
    t: () => "Adapted from Statistics Canada, Canada Mortgage and Housing Corporation average rents for areas with a population of 10,000 and over (Table 34-10-0133-01), October survey as stated above. This does not constitute an endorsement by Statistics Canada of this product." },

  { c: /^australia$/, m: /ABS\b|Australian Bureau of Statistics/i, t: () => `Source: Australian Bureau of Statistics (data API, RES_DWELL; ASGS allocation files), ${CC}; ${OWN}.` },
  { c: /^australia$/, m: /Communities and Justice|DCJ/i, t: () => `© State of New South Wales (Department of Communities and Justice), Rent and Sales Report, ${CC}.` },
  { c: /^australia$/, m: /South Australia|data\.sa\.gov\.au/i, t: () => `© Government of South Australia (Valuer-General; Private Rental Report), data.sa.gov.au, ${CC}.` },
  { c: /^australia$/, m: /Victoria/i, t: () => `© State of Victoria (Valuer-General Victoria; Homes Victoria), ${CC}.` },

  { c: /^ireland$/, m: /CSO|Central Statistics Office/i, t: () => `Source: Central Statistics Office (CSO), Ireland, ${CC}; ${OWN}.` },
  { c: /^ireland$/, m: /RTB|Residential Tenancies Board/, t: () => `Source: Residential Tenancies Board (RTB) statistics hosted by the CSO (table RIQ02), ${CC}.` },
  { c: /^new zealand$/, m: /Ministry of Business, Innovation and Employment/, t: () => `Source: the Ministry of Business, Innovation and Employment (Tenancy Services rental bond data), licensed under Creative Commons Attribution 3.0 New Zealand (https://creativecommons.org/licenses/by/3.0/nz/); area names and boundaries: Stats NZ, CC BY 4.0; ${OWN}.` },
  { c: /^netherlands$/, m: /CBS/, t: () => `Bron: CBS. Eigen bewerking Pradixium. ${CC}.` },
  { c: /^norway$/, m: /SSB|Statistics Norway|Statistisk sentralbyrå/i, t: () => `Kilde: Statistisk sentralbyrå (SSB), ${CC}; ${OWN}.` },
  { c: /^finland$/, m: /Statistics Finland|Tilastokeskus/i, t: () => `Source: Statistics Finland, ${CC}; ${OWN}.` },
  { c: /^austria$/, m: /Statistik Austria/i, t: () => `Quelle: STATISTIK AUSTRIA, ${CC}; Inhalte bearbeitet (ausgewählt) von Pradixium.` },
  { c: /^denmark$/, m: /Statistics Denmark|StatBank|Danmarks Statistik/i, t: () => "Source: Own calculations based on data from Statistics Denmark – StatBank.dk/EJEN77." },
  { c: /^sweden$/, m: /SCB|Statistics Sweden/i, t: () => "Source: Statistics Sweden (SCB), CC0; selected by Pradixium." },
  { c: /^iceland$/, m: /HMS|Kaupskrá/i, t: () => `Húsnæðis- og mannvirkjastofnun (HMS), Kaupskrá fasteigna, ${CC}; medians calculated by Pradixium.` },
  { c: /^italy$/, m: /OMI|Agenzia delle Entrate/i, t: () => `Fonte: «Agenzia delle Entrate – OMI», ${CC}; zone and midpoint selected by Pradixium.` },
  { c: /^portugal$/, m: /INE\b|Instituto Nacional de Estatística/i, t: () => `Fonte: Instituto Nacional de Estatística, IP – Portugal, ${CC}; ${OWN}.` },
  { c: /^(czech republic|czechia)$/, m: /ČSÚ|Czech Statistical|Český statistický/i,
    t: () => "Zdroj: Český statistický úřad — conditions of use: https://csu.gov.cz/podminky_pro_vyuzivani_a_dalsi_zverejnovani_statistickych_udaju_csu. The year-on-year change is derived by Pradixium, not a ČSÚ figure." },
  { c: /^hungary$/, m: /KSH|Hungarian Central Statistical/i, t: () => `Forrás: KSH (https://www.ksh.hu), ${CC}.` },
  { c: /^slovenia$/, m: /GURS|Surveying and Mapping Authority/i, t: () => `Surveying and Mapping Authority of the Republic of Slovenia (GURS), Annual Report on the Slovenian Real Estate Market, data for the year stated above, ${CC}.` },
  { c: /^latvia$/, m: /VZD|State Land Service/i, t: () => `Valsts zemes dienests (VZD), market statistical indicators, data.gov.lv, ${CC}.` },

  { c: /^spain$/, m: /Catastro/,
    t: (raw) => `Fuente: Dirección General del Catastro, Ministerio de Hacienda del Reino de España (mapa de valores)${raw?.catastroZone?.accessed ? `, consultado el ${raw.catastroZone.accessed}` : ""}; zone matched to the address by Pradixium. Not an official cadastral product.` },
  { c: /^(united states|usa|us)$/, m: /American Community Survey/,
    t: () => "Source: U.S. Census Bureau, American Community Survey 5-Year Estimates (tables B25031, B25103, B25077). This product uses Census Bureau data but is not endorsed or certified by the Census Bureau." },
  { c: /^spain$/, m: /MIVAU|SERPAVI/,
    t: () => "Fuente: Ministerio de Vivienda y Agenda Urbana (MIVAU) — SERPAVI database (last updated 8 July 2026) and Valor tasado de la vivienda (period stated above); reused under MIVAU's legal notice (commercial and non-commercial reuse, source and update date cited); figures selected by Pradixium." },
  { c: /^(uae|united arab emirates|dubai)$/, m: /Dubai Land Department|DLD/,
    t: () => "Source: Dubai Government — Dubai Land Department, Real Estate Data (transactions open data); medians calculated by Pradixium. Not endorsed by the Dubai Government." },
  { c: /^israel$/, m: /CBS|Central Bureau of Statistics/i,
    t: () => "The Central Bureau of Statistics (CBS), release 256/2026 (accessed 30 September 2026), available online: https://www.cbs.gov.il — copied and distributed as is, according to the CBS license at https://www.cbs.gov.il/en/Pages/Enduser-license.aspx." },
  { c: /^japan$/, m: /MLIT|不動産価格指数/,
    t: () => "出典：「不動産価格指数（住宅）」（国土交通省）（https://www.mlit.go.jp/totikensangyo/totikensangyo_tk5_000085.html）を加工して作成 — Source: MLIT Real Estate Price Index (residential); year-on-year changes calculated by Pradixium." },
  { c: /^japan$/, m: /Housing and Land Survey/,
    t: () => "出典：「令和5年住宅・土地統計調査」（総務省統計局）、政府統計の総合窓口（e-Stat）（https://www.e-stat.go.jp/）を加工して作成 — Source: Statistics Bureau of Japan, 2023 Housing and Land Survey via e-Stat (Government of Japan Standard Terms of Use, PDL1.0-compatible); area names in English from Japan Post postcode data." },
  { c: /^hong kong$/, m: /RVD|Rating and Valuation/i,
    t: () => "Source: Rating and Valuation Department, Government of the Hong Kong SAR (Property Market Statistics, also on DATA.GOV.HK); the intellectual property rights belong to the Government of the HKSAR. Selected by Pradixium." },
  { c: /^south africa$/, m: /Stats SA|Statistics South Africa/i,
    t: () => "Stats SA (Statistics South Africa) is the source of the basic data; the application and analysis shown here are Pradixium's own processing of the data." },
  { c: /^turkey$/, m: /TCMB|EVDS/,
    t: () => "Kaynak: TCMB, EVDS (https://evds3.tcmb.gov.tr). English series names are Pradixium's translation, not an official TCMB translation; year-on-year changes calculated by Pradixium from the index values." }
];

export function licenceNotices(country, text, raw = null) {
  const c = String(country || "").trim().toLowerCase();
  const s = String(text || "");
  const out = [];
  for (const r of RULES) if (r.c.test(c) && r.m.test(s)) out.push(r.t(raw));
  return [...new Set(out)];
}
