/* PRADIXIUM™ — Nassau County, NY (FIPS 36059) — NYS Department of Taxation
 * and Finance "Property Assessment Data from Local Assessment Rolls"
 * (data.ny.gov 7vem-aaz7), latest Nassau roll year.
 * Nassau is not in the NYS Tax Parcels GIS, but its roll is in this state
 * dataset. The county assesses at 0.1% of market value, so the roll's
 * full_market_value is exactly 1,000 × the assessed value (checked on
 * sample parcels, Sept 2026) — the Nassau County Assessor's market value,
 * shown as Government Value, display only.
 * Only the county's own rolls are used (the three towns + the county rolls
 * of Glen Cove and Long Beach); the two cities' own rolls use different
 * ratios and are skipped.
 * Matching: the rows carry no ZIP or coordinates, so a parcel counts only
 * when number + street match AND its school district is one of the
 * geocoded address's school districts (Census geocoder) — this separates
 * same-named streets in different hamlets. Owner names are never read.
 */
import { splitStreet } from "./_structured.js";

const URL = "https://data.ny.gov/resource/7vem-aaz7.json";
const SOURCE = "Nassau County Assessor roll (NYS Dept. of Taxation and Finance, local assessment rolls)";
const SOURCE_URL = "https://data.ny.gov/Government-Finance/Property-Assessment-Data-from-Local-Assessment-Rol/7vem-aaz7";
const ROLLS = ["Hempstead", "North Hempstead", "Oyster Bay", "Glen Cove, County Roll", "Long Beach, County Roll"];
const LOCAL = { LA: "LN", AV: "AVE" };
const TO_ROLL = { LN: "LA" };
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z]/g, "");

export function matches(geo) {
  return String(geo?.countyFips || "") === "36059";
}

export async function evidence({ geo, h }) {
  const a = h.addressParts(geo);
  const sds = (geo?.schoolDistricts || []).map(norm).filter(Boolean);
  if (!a || !sds.length) return null;
  const st = splitStreet(a.street);
  // exact street strings are fast on this dataset (LIKE takes seconds): try
  // the name with/without its direction and with the roll's own type spellings
  const types = [...new Set(["", st.type, TO_ROLL[st.type] || st.type].filter((t) => t !== undefined))];
  const cands = [...new Set(["", st.dir].flatMap((d) => types.map((t) => [d, st.name, t].filter(Boolean).join(" "))))];
  const rs0 = await h.json(URL + "?" + new URLSearchParams({
    $select: "municipality_name,school_district_name,print_key_code,parcel_address_number,parcel_address_street,property_class_description,full_market_value,roll_year",
    county_name: "Nassau", parcel_address_number: String(Number(a.number)),
    $where: `parcel_address_street in (${cands.map((c) => `'${h.escapeSql(c)}'`).join(",")}) and roll_year >= '${new Date().getFullYear() - 2}'`, $limit: "100"
  }), 6000).catch(() => null);
  const y = (rs0 || []).reduce((m, r) => (h.s(r.roll_year) > m ? h.s(r.roll_year) : m), "");
  const rs = (rs0 || []).filter((r) => h.s(r.roll_year) === y);
  const rows = (rs || []).filter((r) => {
    if (!ROLLS.includes(h.s(r.municipality_name))) return false;
    const w = h.s(r.parcel_address_street).toUpperCase().split(/\s+/).map((x) => LOCAL[x] || x);
    const p = splitStreet(w.join(" "));
    if (p.name !== st.name || (st.dir && p.dir && p.dir !== st.dir) || (st.type && p.type && p.type !== st.type)) return false;
    const sd = norm(r.school_district_name);
    return sd && sds.some((g) => g.startsWith(sd));
  });
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Nassau County Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.full_market_value) > 0 ? Number(r.full_market_value) : null;
  const cls = h.s(r.property_class_description).toLowerCase();
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Nassau County Assessor parcel ${h.s(r.print_key_code)}${cls ? ` (${cls})` : ""}${value ? `: ${y} roll market value ${usd(value)}` : ""} (${h.s(r.municipality_name).replace(", County Roll", "")}, ${h.s(r.school_district_name)} school district). Sales are not in this dataset.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: String(y), label: `Nassau County Assessor market value (${y} roll)` } : null,
    location: null, property: null,
    checks: [{ id: "schoolDistrict", label: "School district", value: h.s(r.school_district_name), level: "info", source: "Nassau County assessment roll", sourceUrl: SOURCE_URL, basis: "parcel" }],
    hasRecord: true
  };
}
