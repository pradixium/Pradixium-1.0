/* PRADIXIUM™ — Bulgaria: National Statistical Institute (NSI) house price
 * statistics, Q2 2026 release (23 Sept 2026 calendar; PDF
 * nsi.bg/en/file/38137/housing_price_statistics-1_en.pdf): all dwellings
 * (new + existing, transaction prices from an administrative source)
 * +15.5% on Q2 2025 and +4.5% on Q1 2026; by city the release gives ONLY
 * the change on the previous quarter → shown as that, never as a yearly
 * trend. Ruse had no figure in this release. Update each quarter from the
 * next release (NSI calendar: Q3 2026 on 23 Dec 2026).
 */
const NSI_Q = {
  period: "2026-Q2",
  comparedWith: "2025-Q2",
  national: { yoy: 15.5, qoq: 4.5 },
  cityQoq: { Sofia: 2.4, Plovdiv: 5.8, Varna: 2.8, Burgas: -1.5, "Stara Zagora": 2.9 },
  source: "National Statistical Institute of Bulgaria — Housing price statistics, second quarter of 2026",
  sourceUrl: "https://www.nsi.bg/en/file/38137/housing_price_statistics-1_en.pdf"
};
const ALIASES = { Sofia: ["sofia", "sofiya", "софия"], Plovdiv: ["plovdiv", "пловдив"], Varna: ["varna", "варна"], Burgas: ["burgas", "bourgas", "бургас"], "Stara Zagora": ["stara zagora", "стара загора"] };
const norm = (s) => ` ${String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zа-я ]/g, " ").replace(/\s+/g, " ").trim()} `;

// → the orchestrator's generic regional hook (allTypes: one figure for all dwellings)
export function bulgariaRegionalTrend({ city, address } = {}) {
  const t = norm(`${address || ""} ${city || ""}`);
  const hit = Object.entries(ALIASES).find(([, a]) => a.some((x) => t.includes(` ${x} `)));
  const pct = (v) => `${v >= 0 ? "+" : ""}${v}%`;
  const note = hit ? `${hit[0]}: ${pct(NSI_Q.cityQoq[hit[0]])} on the previous quarter (by city the NSI publishes only the quarterly change)` : null;
  return {
    period: NSI_Q.period, comparedWith: NSI_Q.comparedWith, area: "Bulgaria (national)", national: true, allTypes: true,
    flatsAnnualChangePercent: NSI_Q.national.yoy, housesAnnualChangePercent: NSI_Q.national.yoy, allAnnualChangePercent: NSI_Q.national.yoy,
    note, sourceName: "National Statistical Institute of Bulgaria (NSI)", source: NSI_Q.source, sourceUrl: NSI_Q.sourceUrl
  };
}
