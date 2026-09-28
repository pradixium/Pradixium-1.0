/* PRADIXIUM™ — Providence core: City of Providence, RI (in Providence County,
 * FIPS 44007) — City of Providence "2025 Property Tax Roll" (Tax Assessor,
 * data.providenceri.gov, Socrata 6ub4-iebe)
 * Shown: total assessment on the 2025 roll (Government Value, display only)
 * and the 2025 tax bill as an official check. Owner names are never
 * requested. No sales in this dataset. Other towns in the county: no record.
 */
const API = "https://data.providenceri.gov/resource/6ub4-iebe.json";
const SOURCE = "City of Providence Tax Assessor — 2025 Property Tax Roll";
const SOURCE_URL = "https://data.providenceri.gov/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "44007";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const w = a.street.split(/\s+/);
  if (w.length > 1) w.pop();
  const j = await h.json(API + "?" + new URLSearchParams({
    $select: "tax_map,unit,short_desc,civic,street,suffix,total_assmt,total_taxes",
    $where: `civic='${h.escapeSql(a.number)}' AND upper(street)='${h.escapeSql(w.join(" "))}'`,
    $limit: "20"
  }), 6000).catch(() => null);
  let rows = Array.isArray(j) ? j : [];
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(h.s(r.unit).replace(/^0+/, "")) === unit.replace(/^0+/, ""));
  else if (rows.length > 1) rows = rows.filter((r) => /^0*$/.test(h.s(r.unit)));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "City of Providence Tax Assessor: several accounts at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.total_assmt) > 0 ? Number(r.total_assmt) : null, tax = Number(r.total_taxes) > 0 ? Number(r.total_taxes) : null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `City of Providence Tax Assessor plat/lot ${h.s(r.tax_map)}${h.s(r.short_desc) ? ` (${h.s(r.short_desc).toLowerCase()})` : ""}${value ? `: 2025 assessment ${usd(value)}` : ""}${tax ? `; 2025 taxes ${usd(tax)}` : ""}.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: "2025", label: "City of Providence 2025 assessment" } : null,
    location: null, property: null,
    checks: tax ? [{ id: "propertyTax", label: "Property tax (2025 roll)", value: usd(tax), level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" }] : [],
    hasRecord: true
  };
}
