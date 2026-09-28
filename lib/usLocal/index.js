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
import * as clarkNV from "./clarkNV.js";
import * as hamiltonOH from "./hamiltonOH.js";
import * as franklinOH from "./franklinOH.js";
import * as marionIN from "./marionIN.js";
import * as cuyahoga from "./cuyahoga.js";
import * as nashville from "./nashville.js";
import * as milwaukee from "./milwaukee.js";
import * as utah from "./utah.js";
import * as wake from "./wake.js";
import * as connecticut from "./connecticut.js";
import * as norfolk from "./norfolk.js";
import * as providence from "./providence.js";
import * as wisconsin from "./wisconsin.js";
import * as northCarolina from "./northCarolina.js";
import * as massachusetts from "./massachusetts.js";
import * as vermont from "./vermont.js";
import * as pima from "./pima.js";
import * as california from "./california.js";
import * as washington from "./washington.js";
import * as arkansas from "./arkansas.js";
import * as minnesota from "./minnesota.js";
import * as gwinnett from "./gwinnett.js";
import * as oaklandMI from "./oaklandMI.js";
import * as coloradoCounties from "./coloradoCounties.js";
import * as nassau from "./nassau.js";
import * as honolulu from "./honolulu.js";
import * as dekalbGA from "./dekalbGA.js";
import * as starkOH from "./starkOH.js";
import * as summitOH from "./summitOH.js";
import * as illinois from "./illinois.js";
import * as texasStatewide from "./texasStatewide.js";
import * as adaID from "./adaID.js";
import * as washoeNV from "./washoeNV.js";
import * as ottawaMI from "./ottawaMI.js";
import * as ebrLA from "./ebrLA.js";
import * as indiana from "./indiana.js";
import * as moreCounties from "./moreCounties.js";
import * as montana from "./montana.js";

export const US_LOCAL_MODULES = [cookCounty, texas, florida, dc, philadelphia, boston, maricopa, fulton, detroit, hennepin, kingCounty, denver, maryland, fairfax, mecklenburg, stLouisCity, stLouisCounty, portlandMetro, allegheny, clarkNV, hamiltonOH, franklinOH, marionIN, cuyahoga, nashville, milwaukee, utah, wake, connecticut, norfolk, providence, wisconsin, northCarolina, massachusetts, vermont, pima, california, washington, arkansas, minnesota, gwinnett, oaklandMI, coloradoCounties, nassau, honolulu, dekalbGA, starkOH, summitOH, illinois, texasStatewide, adaID, washoeNV, ottawaMI, ebrLA, indiana, moreCounties, montana];

// The first matching module that finds something wins; a city-only module
// (e.g. City of Milwaukee) that finds nothing lets a statewide one try next.
export async function usLocalEvidence(ctx) {
  for (const mod of US_LOCAL_MODULES.filter((m) => m.matches(ctx.geo))) {
    try {
      const r = await mod.evidence(ctx);
      if (r) return r;
    } catch { /* try the next module */ }
  }
  return null;
}
