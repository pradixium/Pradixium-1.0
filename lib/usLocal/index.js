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
import * as florida from "./florida.js";
import * as dc from "./dc.js";
import * as philadelphia from "./philadelphia.js";
import * as boston from "./boston.js";
import * as maricopa from "./maricopa.js";
import * as fulton from "./fulton.js";
import * as detroit from "./detroit.js";
import * as hennepin from "./hennepin.js";
import * as kingCounty from "./kingCounty.js";
import * as denver from "./denver.js";
import * as maryland from "./maryland.js";
import * as fairfax from "./fairfax.js";
import * as mecklenburg from "./mecklenburg.js";
import * as stLouisCity from "./stLouisCity.js";
import * as stLouisCounty from "./stLouisCounty.js";
import * as portlandMetro from "./portlandMetro.js";
import * as allegheny from "./allegheny.js";

export const US_LOCAL_MODULES = [cookCounty, texas, florida, dc, philadelphia, boston, maricopa, fulton, detroit, hennepin, kingCounty, denver, maryland, fairfax, mecklenburg, stLouisCity, stLouisCounty, portlandMetro, allegheny];

export async function usLocalEvidence(ctx) {
  const mod = US_LOCAL_MODULES.find((m) => m.matches(ctx.geo));
  if (!mod) return null;
  try {
    return await mod.evidence(ctx);
  } catch {
    return null;
  }
}
