/* PRADIXIUM™ — Cleveland core: Cuyahoga County, OH (FIPS 39035) — Cuyahoga
 * County Fiscal Officer "Open_Data_Parcels" (Cleveland + non-Cleveland)
 * Shown: the certified total value for the tax year (equals the market
 * value in the Fiscal Officer's sales dataset — checked on sample parcels,
 * Sept 2026) as Government Value, total residential living area, land use.
 * Not shown: sales — the transfer amount carries no arm's-length/validity
 * code (only a deed type), so it is not presented as a market sale.
 */
const B = "https://gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer/";
const SOURCE = "Cuyahoga County Fiscal Officer (open data parcels)";
const SOURCE_URL = "https://fiscalofficer.cuyahogacounty.gov/";
const DIRS = new Set(["N", "S", "E", "W"]);
const TYPES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "TER", "HWY", "SQ", "PT", "RUN", "ROW", "CV", "PLZ", "RDG", "XING", "PASS", "OVAL", "LOOP"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "39035";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const type = w.length > 1 && TYPES.has(w[w.length - 1]) ? w.pop() : "";
  const params = { where: `par_addr='${h.escapeSql(a.number)}' AND par_street='${h.escapeSql(w.join(" "))}' AND par_zip=${Number(z.zip)}`, outFields: "parcelpin,par_predir,par_suffix,par_unit,tax_year,certified_tax_total,total_res_liv_area,tax_luc_description", returnGeometry: "false", f: "json" };
  const res = await Promise.all([0, 1].map((l) => h.json(B + l + "/query?" + new URLSearchParams(params), 6000).catch(() => null)));
  let rows = res.flatMap((j) => (j?.features || []).map((f) => f.attributes))
    .filter((r) => (!dir || !h.s(r.par_predir) || h.s(r.par_predir) === dir) && (!type || !h.s(r.par_suffix) || h.s(r.par_suffix) === type));
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.par_unit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.par_unit));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Cuyahoga County Fiscal Officer: more than one parcel matches this address, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.certified_tax_total) > 0 ? Number(r.certified_tax_total) : null, year = r.tax_year ? String(r.tax_year) : null;
  const la = Number(r.total_res_liv_area) > 0 ? Number(r.total_res_liv_area) : null;
  const facts = [h.s(r.tax_luc_description).toLowerCase(), la && `${la.toLocaleString("en-US")} sq ft living`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Cuyahoga County Fiscal Officer parcel ${h.s(r.parcelpin)}${facts ? ` (${facts})` : ""}${value ? `: ${year ? year + " " : ""}market value ${usd(value)}` : ""}. Sales are not shown: the county's transfer records carry no arm's-length code.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `Cuyahoga County Fiscal Officer ${year ? year + " " : ""}market value` } : null,
    location: null,
    property: { livingAreaSqFt: la, yearBuilt: null, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
