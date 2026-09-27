/* PRADIXIUM™ — Philadelphia (City of Philadelphia open data, phl.carto.com)
 *  - OPA properties (Office of Property Assessment): address → account,
 *    market value, livable area, beds, baths, year built, type
 *  - RTT summary (Department of Records, realty transfer tax): recorded
 *    deeds. A sale counts only when it is a plain DEED of a single
 *    property on which realty transfer tax was paid — family transfers
 *    are exempt from the tax and sheriff's / miscellaneous deeds are
 *    separate document types, so they drop out.
 * Condo units: RTT condo deeds mostly lack the OPA account and ZIP, so the
 * unit's own sale is matched by "<location> UNIT <unit>" and no condo ZIP
 * figure is shown. The house ZIP figure (median price and price per livable sq ft of those
 * taxable single-property deeds, same type, last 12 months) is context
 * only: the tax filter is not an assessor's arm's-length qualification.
 */
const SQL = "https://phl.carto.com/api/v2/sql?q=";
const SOURCE = "City of Philadelphia — Office of Property Assessment & Department of Records";
const SOURCE_URL = "https://opendataphilly.org/";
const MIN_SALES = 10;
const CONDO = "o.building_code_description LIKE 'RES CONDO%'";
const HOUSE = "o.category_code_description='SINGLE FAMILY' AND o.building_code_description NOT LIKE '%CONDO%'";
const TAXED_SALE = "r.document_type='DEED' AND r.property_count=1 AND r.state_tax_amount>0 AND r.total_consideration>0";

export function matches(geo) {
  return String(geo?.countyFips || "") === "42101";
}

export async function evidence({ geo, address, zip, propertyType, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a) return null;
  const run = async (sql) => (await h.json(SQL + encodeURIComponent(sql), 9000))?.rows || null;
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const unit = h.unitFromAddress(address);
  let rows = await run(`SELECT parcel_number, location, unit, zip_code, market_value, total_livable_area, number_of_bedrooms, number_of_bathrooms, year_built, category_code_description, building_code_description FROM opa_properties_public o WHERE location='${h.escapeSql(`${a.number} ${a.street}`)}'${z ? ` AND zip_code LIKE '${z.zip}%'` : ""}`);
  if (!Array.isArray(rows)) return null;
  if (unit) rows = rows.filter((r) => h.unitKey(r.unit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.unit));
  const r = rows.length === 1 ? rows[0] : null;

  const t = h.s(propertyType).toLowerCase();
  const isCondo = r ? /condo/i.test(h.s(r.building_code_description)) : /apartment|condo/.test(t);
  const parts = [];
  let lastSale = null, property = null, gov = null;
  if (r) {
    // condo deeds usually carry no OPA account in RTT, so units match on "<location> UNIT <unit>"
    const who = h.s(r.unit) ? `r.street_address='${h.escapeSql(`${r.location} UNIT ${h.s(r.unit)}`)}'` : `r.opa_account_num='${h.escapeSql(r.parcel_number)}'`;
    const s0 = (await run(`SELECT recording_date, total_consideration FROM rtt_summary r WHERE ${who} AND ${TAXED_SALE} ORDER BY recording_date DESC LIMIT 1`))?.[0];
    if (s0) lastSale = { price: Number(s0.total_consideration), date: h.s(s0.recording_date).slice(0, 10), source: `${SOURCE} — deed with realty transfer tax paid` };
    if (Number(r.market_value) > 0) gov = { value: Number(r.market_value), asOf: null, label: "Philadelphia OPA market value" };
    property = {
      livingAreaSqFt: Number(r.total_livable_area) > 0 ? Number(r.total_livable_area) : null,
      bedrooms: Number(r.number_of_bedrooms) > 0 ? Number(r.number_of_bedrooms) : null,
      bathrooms: Number(r.number_of_bathrooms) > 0 ? Number(r.number_of_bathrooms) : null,
      yearBuilt: Number(r.year_built) > 0 ? Number(r.year_built) : null
    };
    parts.push(`Philadelphia OPA account ${r.parcel_number}: ${lastSale ? `last taxable sale ${usd(lastSale.price)} on ${lastSale.date}` : "no taxable single-property sale on record"}${gov ? `; OPA market value ${usd(gov.value)}` : ""}.`);
  } else if (!unit && rows.length === 0) {
    // address not found as a single OPA record — ZIP context only
  }

  // ZIP context for houses only: condo deeds in RTT mostly lack both the
  // OPA account and the ZIP, so a condo ZIP figure would be incomplete.
  if (z && !isCondo && (r || /house|villa|town/.test(t))) {
    const stats = (await run(`SELECT count(*) n, percentile_cont(0.5) WITHIN GROUP (ORDER BY r.total_consideration) med, percentile_cont(0.5) WITHIN GROUP (ORDER BY r.total_consideration / NULLIF(o.total_livable_area,0)) med_sqft, count(NULLIF(o.total_livable_area,0)) n_area, min(r.recording_date) d0, max(r.recording_date) d1 FROM rtt_summary r JOIN opa_properties_public o ON o.parcel_number=r.opa_account_num WHERE r.zip_code LIKE '${z.zip}%' AND r.recording_date > now() - interval '12 months' AND ${TAXED_SALE} AND ${isCondo ? CONDO : HOUSE}`))?.[0];
    const n = Number(stats?.n) || 0, label = isCondo ? "condominiums" : "single-family homes";
    if (n >= MIN_SALES) parts.push(`ZIP ${z.zip}: ${n} taxable single-property deed sales of ${label} (${h.s(stats.d0).slice(0, 10)} to ${h.s(stats.d1).slice(0, 10)}), median ${usd(stats.med)}${Number(stats.n_area) >= MIN_SALES ? `, median ${usd(stats.med_sqft)} per livable sq ft` : ""} — context only; not used in the verdict.`);
    else if (stats) parts.push(`ZIP ${z.zip}: only ${n} taxable sales of ${label} in the last 12 months — not enough for a local figure.`);
  }

  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: parts.join(" ") || null,
    lastSale, benchmark: null, governmentValue: gov,
    location: null, property, checks: [], hasRecord: Boolean(r)
  };
}
