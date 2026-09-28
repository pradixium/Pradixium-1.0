/* PRADIXIUM™ — Detroit (City of Detroit Office of the Assessor, "Property
 * Sales" on the city's open data hub, updated daily)
 * Every recorded transfer with the assessor's Michigan "terms of sale"
 * code. Only "03-ARM'S LENGTH" counts, and only for 100% of a single
 * parcel — family, government, trust, estate, foreclosure, multi-parcel
 * and "other" transfers are all excluded.
 *  - the property's own last arm's-length sale (Transaction rows)
 *  - same assessor ECF neighborhood, same property class, last 12 months:
 *    median sale price — whole-property price, context only
 * The data covers the City of Detroit only (not the rest of Wayne County).
 */
const URL = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query";
const SOURCE = "City of Detroit Office of the Assessor — Property Sales";
const SOURCE_URL = "https://data.detroitmi.gov/";
const ARMS = "term_of_sale='03-ARM''S LENGTH' AND pct_property_transferred=100 AND is_multi_parcel_sale='False' AND amt_sale_price>0";
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
  const mine = await q({ where: `street_number=${Number(number)} AND street_name='${h.escapeSql(name)}'${unit ? "" : " AND (unit_number IS NULL OR unit_number='')"}`, outFields: "parcel_id,address,unit_number,sale_date,amt_sale_price,term_of_sale,pct_property_transferred,is_multi_parcel_sale,property_class_description,ecf_neighborhood,neighborhood", orderByFields: "sale_date DESC", resultRecordCount: "200" });
  let rows = (mine?.features || []).map((f) => f.attributes);
  if (unit) rows = rows.filter((r) => h.unitKey(r.unit_number) === unit);
  if (!rows.length) return null; // not in the City of Detroit sales file
  const parcels = [...new Set(rows.map((r) => r.parcel_id))];
  if (parcels.length !== 1) return { source: SOURCE, sourceUrl: SOURCE_URL, summary: "City of Detroit Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false };

  const arms = rows.find((r) => h.s(r.term_of_sale) === "03-ARM'S LENGTH" && Number(r.pct_property_transferred) === 100 && h.s(r.is_multi_parcel_sale) === "False" && Number(r.amt_sale_price) > 0);
  const lastSale = arms ? { price: Number(arms.amt_sale_price), date: h.s(arms.sale_date).slice(0, 10), source: `${SOURCE} — arm's-length sale` } : null;
  const ref = rows[0], parts = [];
  parts.push(`City of Detroit Assessor, parcel ${h.s(ref.parcel_id)} (${h.s(ref.neighborhood) || "neighborhood " + h.s(ref.ecf_neighborhood)}): ${lastSale ? `last arm's-length sale ${usd(lastSale.price)} on ${lastSale.date}` : "no arm's-length sale on record"}.`);

  if (h.s(ref.ecf_neighborhood) && h.s(ref.property_class_description)) {
    const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const ns = await q({ where: `ecf_neighborhood='${h.escapeSql(ref.ecf_neighborhood)}' AND property_class_description='${h.escapeSql(ref.property_class_description)}' AND sale_date>=DATE '${since}' AND ${ARMS}`, outFields: "amt_sale_price,sale_date", resultRecordCount: "1000" }, 4000); // this service can take >10 s here; context only, so it may be dropped
    if (Array.isArray(ns?.features) && !ns.exceededTransferLimit) {
      const p = ns.features.map((f) => Number(f.attributes.amt_sale_price)).sort((a, b) => a - b);
      const d = ns.features.map((f) => h.s(f.attributes.sale_date).slice(0, 10)).sort();
      const m = Math.floor(p.length / 2);
      if (p.length >= MIN_SALES) parts.push(`Assessor neighborhood ${h.s(ref.ecf_neighborhood)}: ${p.length} arm's-length ${h.s(ref.property_class_description).toLowerCase()} sales (${d[0]} to ${d[d.length - 1]}), median price ${usd(p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2)} — whole-property price, context only; not used in the verdict.`);
      else parts.push(`Assessor neighborhood ${h.s(ref.ecf_neighborhood)}: only ${p.length} arm's-length sales in the last 12 months — not enough for a local figure.`);
    }
  }
  return { source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "), lastSale, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: true };
}
