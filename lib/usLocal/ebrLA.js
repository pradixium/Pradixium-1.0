/* PRADIXIUM™ — East Baton Rouge Parish, LA (FIPS 22033; Baton Rouge) —
 * City-Parish open data (data.brla.gov), maintained by the EBR Parish
 * Assessor's Office:
 *  - "Tax Parcel" (ei2c-krsr): physical address → assessment number
 *  - "EBRP Tax Roll" (myfc-nh6n): fair market value per assessment line
 *    (land/acreage, improvement …) and tax year
 * Shown: the assessment's fair market value for the latest tax year (sum
 * of its real-property lines) as Government Value, display only. The
 * assessed value is 10% of it for the sampled residential parcels
 * (Louisiana's residential ratio) and is not shown. Not shown: sales
 * (sale year only), owner/taxpayer names (never requested).
 * Matching: the parcel address has no city/ZIP, so the parcel must lie in
 * a ~600 m box around the geocoded point and match number + street.
 */
import { splitStreet } from "./_structured.js";

const PARCELS = "https://data.brla.gov/resource/ei2c-krsr.json";
const ROLL = "https://data.brla.gov/resource/myfc-nh6n.json";
const SOURCE = "East Baton Rouge Parish Assessor (City-Parish open data: Tax Parcel + Tax Roll)";
const SOURCE_URL = "https://www.ebrpa.org/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "22033";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  const x = Number(geo?.longitude), y = Number(geo?.latitude);
  if (!a || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const st = splitStreet(a.street), d = 0.003;
  const box = `POLYGON ((${x - d} ${y - d}, ${x + d} ${y - d}, ${x + d} ${y + d}, ${x - d} ${y + d}, ${x - d} ${y - d}))`;
  const ps = await h.json(PARCELS + "?" + new URLSearchParams({
    $select: "assessment_num,physical_address",
    $where: `starts_with(physical_address,'${h.escapeSql(a.number)} ') AND intersects(the_geom,'${box}')`, $limit: "50"
  }), 6000).catch(() => null);
  const unit = h.unitFromAddress(address);
  let rows = (ps || []).filter((p) => {
    const m = h.s(p.physical_address).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
    if (!m || m[1] !== a.number) return false;
    const s = splitStreet(m[2]);
    p._unit = m[3] || "";
    return s.name === st.name && (!st.dir || !s.dir || s.dir === st.dir) && (!st.type || !s.type || s.type === st.type);
  });
  const found = rows.length;
  if (unit) rows = rows.filter((p) => h.unitKey(p._unit) === unit);
  else if (rows.length > 1) rows = rows.filter((p) => !p._unit);
  const ids = [...new Set(rows.map((p) => h.s(p.assessment_num)).filter(Boolean))];
  if (ids.length !== 1) return ids.length > 1 || (!unit && found > 1) ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "East Baton Rouge Parish Assessor: several assessments at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const roll = await h.json(ROLL + "?" + new URLSearchParams({
    $select: "tax_year,assessment_type,unit_type,fair_market_val", assessment_no: ids[0], $where: `tax_year >= '${new Date().getFullYear() - 2}'`, $limit: "50"
  }), 6000).catch(() => null);
  const yr = (roll || []).reduce((m, r) => (h.s(r.tax_year) > m ? h.s(r.tax_year) : m), "");
  const lines = (roll || []).filter((r) => h.s(r.tax_year) === yr && /REAL/i.test(h.s(r.assessment_type)));
  const value = lines.reduce((t, r) => t + (Number(r.fair_market_val) || 0), 0) || null;
  const usd = (v) => "$" + Math.round(v).toLocaleString("en-US");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `East Baton Rouge Parish Assessor, assessment ${ids[0]}${value ? `: ${yr} fair market value ${usd(value)} (${lines.map((r) => h.s(r.unit_type).toLowerCase()).join(" + ")})` : ""}. Sales are not in these datasets.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: yr, label: `East Baton Rouge Parish Assessor ${yr} fair market value` } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
