/* PRADIXIUM™ — US: median GROSS rent by bedrooms per ZIP (ZCTA), ACS
 * 5-year table B25031 (U.S. Census Bureau) ← scripts/build-us-rents.py.
 * Gross rent includes tenant-paid utilities and covers existing tenancies
 * over the 5-year period. A top-coded median ("$3,500 or more", stored
 * negative) is shown as such and never used as a number.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "usRents.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const LABEL = ["all rented homes", "studios", "1-bedroom homes", "2-bedroom homes", "3-bedroom homes", "4-bedroom homes", "homes with 5+ bedrooms"];
export function usRent(zip, bedrooms) {
  const d = load();
  const z = (String(zip || "").match(/\b(\d{5})\b/) || [])[1];   // "ZCTA5 60610" / "60610-1234"
  const row = d && z ? d.zcta[z] : null;
  if (!row) return null;
  const b = Number(bedrooms);
  const i = Number.isFinite(b) && bedrooms !== null && bedrooms !== "" ? Math.min(6, Math.max(1, Math.round(b) + 1)) : 0;
  const v = row[i];
  if (v == null) return null;
  return { zip: z, label: LABEL[i], value: Math.abs(v), topCoded: v < 0, source: d.source, period: d.period };
}
