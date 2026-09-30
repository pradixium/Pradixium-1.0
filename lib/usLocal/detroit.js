/* PRADIXIUM™ — Detroit (City of Detroit Office of the Assessor, "Property
 * Sales" on the city's open data hub, updated daily)
 * Every recorded transfer with the assessor's Michigan "terms of sale"
 * code. Only "03-ARM'S LENGTH" counts, and only for 100% of a single
 * parcel — family, government, trust, estate, foreclosure, multi-parcel
 * and "other" transfers are all excluded.
 *  - the property's own last arm's-length sale (Transaction rows)
 *  - same assessor ECF neighborhood, same property class, 12 months:
 *    median sale price, prebuilt (lib/data/detroitSales.js). For class 401
 *    (residential; condos have their own "C…" ECF neighborhoods) it is the
 *    whole-home benchmark (areaMedianPrice), other classes context only
 * The data covers the City of Detroit only (not the rest of Wayne County).
 */
const URL = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query";
const SOURCE = "City of Detroit Office of the Assessor — Property Sales";
import { DETROIT_SALES, DETROIT_SALES_META } from "../data/detroitSales.js";
const SOURCE_URL = "https://data.detroitmi.gov/";
const MIN_SALES = 10;
const DIRS = new Set(["N", "S", "E", "W"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "26163";
}

export async function evidence({ geo, address, zip, h }) {
  const z = h.uspsZip(zip, geo);
  const w = h.s(geo?.matchedAddress).split(",")[0].toUpperCase().split(/\s+/);
  const number = /^\d+$/.test(w[0] || "") ? w.shift() : null;
  if (DIRS.has(w[0]) && w.length > 1) w.shift();
  // no ZIP filter: the file is City of Detroit only, and boundary streets
  // carry a different ZIP in the geocoder (19745 Kelly Rd: 48225 vs 48205);
  // the single-parcel check below still refuses any ambiguity.
  if (!number || !w.length) return null;
  const name = w.length > 1 ? w.slice(0, -1).join(" ") : w[0];
  const q = (params, ms = 6000) => h.json(URL + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const unit = h.unitFromAddress(address);
  const mine = await q({ where: `street_number=${Number(number)} AND street_name='${h.escapeSql(name)}'${unit ? "" : " AND (unit_number IS NULL OR unit_number='')"}`, outFields: "parcel_id,address,unit_number,sale_date,amt_sale_price,term_of_sale,pct_property_transferred,is_multi_parcel_sale,property_class_code,property_class_description,ecf_neighborhood,neighborhood", orderByFields: "sale_date DESC", resultRecordCount: "200" });
  let rows = (mine?.features || []).map((f) => f.attributes);
  if (unit) rows = rows.filter((r) => h.unitKey(r.unit_number) === unit);
  if (!rows.length) return null; // not in the City of Detroit sales file
  const parcels = [...new Set(rows.map((r) => r.parcel_id))];
  if (parcels.length !== 1) return { source: SOURCE, sourceUrl: SOURCE_URL, summary: "City of Detroit Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false };

  const arms = rows.find((r) => h.s(r.term_of_sale) === "03-ARM'S LENGTH" && Number(r.pct_property_transferred) === 100 && h.s(r.is_multi_parcel_sale) === "False" && Number(r.amt_sale_price) > 0);
  const lastSale = arms ? { price: Number(arms.amt_sale_price), date: h.s(arms.sale_date).slice(0, 10), source: `${SOURCE} — arm's-length sale` } : null;
  const ref = rows[0], parts = [];
  parts.push(`City of Detroit Assessor, parcel ${h.s(ref.parcel_id)} (${h.s(ref.neighborhood) || "neighborhood " + h.s(ref.ecf_neighborhood)}): ${lastSale ? `last arm's-length sale ${usd(lastSale.price)} on ${lastSale.date}` : "no arm's-length sale on record"}.`);

  // neighborhood figure: prebuilt from the same file (the live service
  // takes 30 s+ on a neighborhood filter) — scripts/build-detroit-sales.mjs
  let areaMedianPrice = null;
  const ecf = h.s(ref.ecf_neighborhood).toUpperCase();
  if (ecf && h.s(ref.property_class_code)) {
    const g = DETROIT_SALES[`${ecf}|${h.s(ref.property_class_code)}`];
    const residential = h.s(ref.property_class_code) === "401";
    const kind = residential ? (/^C/.test(ecf) ? "condominium" : "residential") : h.s(ref.property_class_description).toLowerCase();
    if (g) {
      parts.push(`Assessor ECF neighborhood ${ecf}: ${g.n} arm's-length ${kind} sales (${g.from} to ${g.to}), median price ${usd(g.median)} — ${residential ? "the benchmark: a whole-home median, not adjusted for size" : "whole-property price, context only; not used in the verdict"}.`);
      if (residential) areaMedianPrice = { value: g.median, sales: g.n, area: `Assessor ECF neighborhood ${ecf}`, typeLabel: `${kind} properties (class 401)`, periodFrom: g.from, periodTo: g.to, source: SOURCE, sourceUrl: SOURCE_URL };
    } else {
      parts.push(`Assessor ECF neighborhood ${ecf}: fewer than ${MIN_SALES} arm's-length sales of this class between ${DETROIT_SALES_META.windowFrom} and ${DETROIT_SALES_META.windowTo} — not enough for a local figure.`);
    }
  }
  return { source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "), lastSale, benchmark: null, governmentValue: null, areaMedianPrice, location: null, property: null, checks: [], hasRecord: true };
}
