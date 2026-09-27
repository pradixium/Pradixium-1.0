/* PRADIXIUM™ — U.S. local (county/city) evidence modules
 * One module per verified official source. Each exports:
 *   matches(geo) → boolean
 *   evidence({ geo, address, zip, propertyType, h }) → {
 *     source, sourceUrl, summary,          // summary = text for the Source line
 *     lastSale: { price, date, source } | null,
 *     benchmark: { valuePerSqFt, sales, area, typeLabel, periodFrom, periodTo, source, sourceUrl, basis } | null,
 *       // ONLY when it is $/sq ft of LIVING area from arm's-length sales,
 *       // same property type — it then feeds the verdict
 *     location: { latitude, longitude } | null,   // parcel centre for hazard checks
 *     governmentValue: { value, asOf, label } | null,  // official valuation, display only
 *     property: { yearBuilt, bedrooms, bathrooms, livingAreaSqFt } | null,
 *     checks: [ { id, label, value, level, source, sourceUrl, basis } ]
 *   } | null
 * A module that cannot verify something leaves it out — never guesses.
 */
import * as cookCounty from "./cookCounty.js";
import * as texas from "./texas.js";

export const US_LOCAL_MODULES = [cookCounty, texas];

export async function usLocalEvidence(ctx) {
  const mod = US_LOCAL_MODULES.find((m) => m.matches(ctx.geo));
  if (!mod) return null;
  try {
    return await mod.evidence(ctx);
  } catch {
    return null;
  }
}
