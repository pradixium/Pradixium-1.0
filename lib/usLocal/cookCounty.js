/* PRADIXIUM™ — Cook County, IL (Chicago metro core) local evidence
 * All from the Cook County Assessor's Office open data portal
 * (datacatalog.cookcountyil.gov, updated monthly):
 *  - Parcel Addresses (3723-97qp): address → PIN
 *  - Parcel Universe, current year (pabr-t5kh): class, assessor
 *    neighborhood, parcel centre, school district, community area,
 *    O'Hare noise contour
 *  - Parcel Sales (wvhk-k5uv): recorded sales with the Assessor's own
 *    filters — multi-parcel sales, sales under $10k, quit-claim /
 *    executor / beneficiary deeds and repeat sales within 365 days are
 *    all excluded here
 *  - Single/Multi-Family characteristics (x54s-btds) and Condo unit
 *    characteristics (3r7i-mrz4)
 * Building square feet in this data is measured from the exterior (not
 * living area), so no per-sq-ft benchmark is fed into the verdict: the
 * neighborhood figure is a median SALE PRICE for the same property
 * group, shown as context only.
 */
const BASE = "https://datacatalog.cookcountyil.gov/resource/";
const SOURCE = "Cook County Assessor's Office — open data";
const SOURCE_URL = "https://datacatalog.cookcountyil.gov/";
const COUNTY_FIPS = "17031";
const MIN_SALES = 10;
// Cook County residential classes (Assessor classification guide)
const GROUPS = {
  house: { label: "single-family homes / townhouses", classes: ["202", "203", "204", "205", "206", "207", "208", "209", "210", "234", "278", "295"] },
  condo: { label: "condominium units", classes: ["299"] },
  multi: { label: "2–6 unit apartment buildings", classes: ["211", "212"] }
};
const CLEAN_SALE = "is_multisale=false AND sale_filter_less_than_10k=false AND sale_filter_deed_type=false AND sale_filter_same_sale_within_365=false";

function groupOfClass(cls) {
  return Object.entries(GROUPS).find(([, g]) => g.classes.includes(String(cls)))?.[0] || null;
}

export function matches(geo) {
  return String(geo?.countyFips || "") === COUNTY_FIPS;
}

export async function evidence({ geo, address, zip, propertyType, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  const city = h.s(geo?.matchedAddress).split(",")[1]?.trim().toUpperCase();
  if (!a || (!z && !city)) return null;
  const where = z ? `prop_address_zipcode_1='${z.zip}'` : `prop_address_city_name='${h.escapeSql(city)}'`;
  const q = (id, params) => h.json(BASE + id + ".json?" + new URLSearchParams(params), 9000);
  const line = `${a.number} ${a.street}`;

  // 1. address → PIN (latest tax year only)
  let rows = await q("3723-97qp", { $where: `prop_address_full like '${h.escapeSql(line)}%' AND ${where}`, $select: "pin,year,prop_address_full", $order: "year DESC", $limit: "5000" });
  if (!Array.isArray(rows)) return null;
  const latestYear = rows[0]?.year;
  rows = rows.filter((r) => r.year === latestYear);
  const unit = h.unitFromAddress(address);
  let hit = rows.filter((r) => h.s(r.prop_address_full).toUpperCase() === line);
  if (unit) hit = rows.filter((r) => h.unitKey(h.s(r.prop_address_full).toUpperCase().slice(line.length)) === unit);
  const pin = hit.length === 1 ? hit[0].pin : null;

  // 2. parcel universe (class, neighborhood, location, districts)
  const uni = pin ? (await q("pabr-t5kh", { pin, $limit: "1" }))?.[0] || null : null;
  // a condo building typed without its unit: units share the building's
  // Assessor neighborhood → that figure, never the unit's own record
  const bldg = !pin && rows.length > 1 ? (await q("pabr-t5kh", { pin: rows[0].pin, $limit: "1" }))?.[0] || null : null;
  const ref = uni || (groupOfClass(bldg?.class) === "condo" ? bldg : null);
  const t = h.s(propertyType).toLowerCase();
  const wanted = /apartment|condo/.test(t) ? "condo" : /house|villa|town/.test(t) ? "house" : null;
  const group = groupOfClass(ref?.class) || wanted;

  // 3. the property's own last clean sale + characteristics
  const [sales, chars] = pin ? await Promise.all([
    q("wvhk-k5uv", { $where: `pin='${pin}' AND ${CLEAN_SALE}`, $select: "sale_date,sale_price,deed_type", $order: "sale_date DESC", $limit: "1" }),
    group === "condo"
      ? q("3r7i-mrz4", { pin, $order: "year DESC", $limit: "1" })
      : q("x54s-btds", { pin, $order: "year DESC", $limit: "1" })
  ]) : [null, null];
  const s0 = Array.isArray(sales) ? sales[0] : null;
  const lastSale = s0 && Number(s0.sale_price) > 0 ? { price: Number(s0.sale_price), date: h.s(s0.sale_date).slice(0, 10), source: `${SOURCE} — recorded sale (${h.s(s0.deed_type)} deed)` } : null;
  const c = Array.isArray(chars) ? chars[0] : null;

  // 4. neighborhood context: clean sales, same group, last 12 months of data
  let nbhd = null;
  if (ref?.nbhd_code && group) try {
    const latest = (await q("wvhk-k5uv", { $select: "max(sale_date) as d" }))?.[0]?.d;
    if (latest) {
      const end = new Date(latest), start = new Date(end);
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      const list = GROUPS[group].classes.map((x) => `'${x}'`).join(",");
      const ns = await q("wvhk-k5uv", { $where: `nbhd='${ref.nbhd_code}' AND class in(${list}) AND sale_date>'${start.toISOString().slice(0, 10)}' AND ${CLEAN_SALE}`, $select: "sale_price,sale_date", $limit: "5000" });
      if (Array.isArray(ns) && ns.length < 5000) {
        const p = ns.map((r) => Number(r.sale_price)).filter((x) => x > 0).sort((x, y) => x - y);
        const d = ns.map((r) => h.s(r.sale_date).slice(0, 10)).sort();
        const m = Math.floor(p.length / 2);
        nbhd = { code: ref.nbhd_code, label: GROUPS[group].label, sales: p.length, periodFrom: d[0] || null, periodTo: d[d.length - 1] || null, medianPrice: p.length >= MIN_SALES ? Math.round(p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2) : null };
      }
    }
  } catch { nbhd = null; } // context only — a slow/failed query must not drop the property record

  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const area = uni?.chicago_community_area_name ? `${h.s(uni.chicago_community_area_name)} (Chicago)` : h.s(uni?.cook_municipality_name) || null;
  const parts = [];
  if (pin) parts.push(`Cook County Assessor PIN ${pin}${area ? `, ${area}` : ""}${lastSale ? `: last arm's-length sale ${usd(lastSale.price)} on ${lastSale.date}` : ": no qualifying recorded sale on file"}.`);
  else if (rows.length > 1) parts.push(`Cook County Assessor: several units at this address — add the unit number for the unit's own record${ref ? "; the building's Assessor neighborhood figure is shown below" : ""}.`);
  if (nbhd?.medianPrice) parts.push(`Assessor neighborhood ${nbhd.code}: ${nbhd.sales} arm's-length sales of ${nbhd.label} (${nbhd.periodFrom} to ${nbhd.periodTo}), median price ${usd(nbhd.medianPrice)} (the benchmark: a whole-home median, not adjusted for size).`);
  else if (nbhd) parts.push(`Assessor neighborhood ${nbhd.code}: only ${nbhd.sales} arm's-length sales of ${nbhd.label} in the last 12 months — not enough for a local figure.`);

  const checks = [];
  const school = h.s(uni?.school_unified_district_name) || [h.s(uni?.school_elementary_district_name), h.s(uni?.school_secondary_district_name)].filter(Boolean).join(" / ");
  if (school) checks.push({ id: "schoolDistrict", label: "School district", value: school, level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" });
  if (uni && uni.env_ohare_noise_contour_no_buffer_bool != null) {
    const inside = String(uni.env_ohare_noise_contour_no_buffer_bool) === "true";
    checks.push({ id: "airportNoise", label: "O'Hare airport noise contour", value: inside ? "Inside the O'Hare noise contour" : "Not inside the O'Hare noise contour", level: inside ? "warn" : "ok", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" });
  }
  if (h.s(uni?.tax_tif_district_name)) checks.push({ id: "tif", label: "Tax Increment Financing district", value: h.s(uni.tax_tif_district_name), level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" });

  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: parts.join(" ") || null,
    lastSale,
    benchmark: null,
    // the neighborhood's median price of the Assessor's clean sales of the
    // same property group → the whole-home benchmark (per-sq-ft is not:
    // building area here is exterior, not living area)
    areaMedianPrice: nbhd?.medianPrice ? { value: nbhd.medianPrice, sales: nbhd.sales, area: `Assessor neighborhood ${nbhd.code}`, typeLabel: nbhd.label, periodFrom: nbhd.periodFrom, periodTo: nbhd.periodTo, source: SOURCE, sourceUrl: SOURCE_URL } : null,
    location: uni?.lat && uni?.lon ? { latitude: Number(uni.lat), longitude: Number(uni.lon) } : null,
    property: c ? {
      yearBuilt: Number(c.char_yrblt) || null,
      bedrooms: Number(c.char_beds ?? c.char_bedrooms) || null,
      bathrooms: Number(c.char_fbath ?? c.char_full_baths) || null,
      livingAreaSqFt: group === "condo" ? Number(c.char_unit_sf) || null : null
    } : null,
    checks
  };
}
