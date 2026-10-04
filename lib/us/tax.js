/* PRADIXIUM™ — US: median real estate taxes paid and median value of
 * owner-occupied homes (Census ACS 5-year B25103 / B25077) for the ZIP,
 * else the city (Census place), else the county, else the state
 * ← scripts/build-us-tax.py. Top-coded medians are stored negative.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "usTaxPrices.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const FIPS = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56", PR: "72" };

export function usPropertyTax({ zip, placeKey, countyFips, stateCode, county, place, state }) {
  const d = load();
  if (!d) return null;
  const z = (String(zip || "").match(/\b(\d{5})\b/) || [])[1];
  const pick = (row, level, area) => row && row[0] != null ? { level, area, tax: Math.abs(row[0]), taxTop: row[0] < 0, value: row[1] == null ? null : Math.abs(row[1]), valueTop: row[1] < 0, source: d.source, period: d.period } : null;
  return (z && pick(d.zcta[z], "zip", `ZIP ${z}`))
    || (placeKey && pick(d.place[placeKey], "place", place))
    || (countyFips && pick(d.county[String(countyFips).padStart(5, "0")], "county", county || `county ${countyFips}`))
    || (stateCode && FIPS[stateCode] && pick(d.state[FIPS[stateCode]], "state", state || stateCode))
    || null;
}
