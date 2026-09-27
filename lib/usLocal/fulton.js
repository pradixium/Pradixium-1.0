/* PRADIXIUM™ — Atlanta core: Fulton County, GA (Fulton County GIS,
 * "Tax_Parcels_2025" — the Board of Assessors' 2025 digest)
 * TotAppr is the full appraised fair-market value (Georgia assesses at
 * 40%: TotAssess / TotAppr = 0.40, checked on the data). Shown as the
 * Government Value, labelled with its tax year — display only.
 * Fulton's open sales layer (Tyler_YearlySales) stops at 2022 and the
 * current-digest layer carries no values, so no sale or 2026 figure is
 * shown.
 */
const URL = "https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels_2025/FeatureServer/0/query";
const SOURCE = "Fulton County Board of Assessors — 2025 tax digest (Fulton County GIS)";
const SOURCE_URL = "https://fultonassessor.org/";
const DIRS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "13121";
}

export async function evidence({ geo, address, h }) {
  const w = h.s(geo?.matchedAddress).split(",")[0].toUpperCase().split(/\s+/);
  const number = /^\d+$/.test(w[0] || "") ? w.shift() : null;
  if (DIRS.has(w[0]) && w.length > 1) w.shift();
  if (!number || !w.length) return null;
  const street = w.length > 1 ? w.slice(0, -1).join(" ") : w[0];
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `AddrNumber='${h.escapeSql(number)}' AND AddrStreet='${h.escapeSql(street)}'`,
    outFields: "ParcelID,TaxYear,Address,AddrUnit,TotAppr,ClassCode,NbrHood,ExCode",
    returnGeometry: "false", f: "json"
  }), 9000);
  let rows = (j?.features || []).map((f) => f.attributes);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.AddrUnit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.AddrUnit));
  const r = rows.length === 1 ? rows[0] : null;
  if (!r) return { source: SOURCE, sourceUrl: SOURCE_URL, summary: (j?.features || []).length > 1 ? "Fulton County Board of Assessors: several parcels at this address — add the unit number." : null, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false };
  const value = Number(r.TotAppr) > 0 ? Number(r.TotAppr) : null, year = h.s(r.TaxYear) || "2025";
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Fulton County Board of Assessors, parcel ${h.s(r.ParcelID)}${value ? `: ${year} appraised fair-market value $${Math.round(value).toLocaleString("en-US")} (the county's valuation, not a sale price)` : ""}. Fulton's open sales data ends in 2022, so no recent sale figure is shown.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `Fulton County ${year} appraised value` } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
