/* PRADIXIUM™ — St. Louis metro core: City of St. Louis, MO (independent
 * city, FIPS 29510) — City of St. Louis Assessor's Office
 * 1. Property facts + appraised value: the Assessor's public parcel
 *    service (land use, year built, units; appraised land + improvements on
 *    the current tax bill — Government Value, display only).
 * 2. The parcel's last VALID sale and ZIP context: lib/data/stlSales.js
 *    (scripts/build-stl-sales.mjs) from the Assessor's Property Sales file —
 *    only sale type 10 "Valid: improved, open market, arms length",
 *    single-parcel. The city's file currently ends in Nov 2024, so the ZIP
 *    figures are shown as context with their period — never the verdict.
 * Condominium units live in a separate layer without the appraisal or
 * parcel keys, so a unit gets facts + ZIP context only.
 */
import { getStlZipSales, getStlLastValidSale, STL_SALES_META } from "../data/stlSales.js";

const B = "https://maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/";
const PARCELS = B + "11/query", CONDOS = B + "10/query";
const SOURCE = "City of St. Louis Assessor's Office";
const SOURCE_URL = "https://www.stlouis-mo.gov/government/departments/assessor/";
const DIRS = new Set(["N", "S", "E", "W"]);
const TYPES = new Set(["ST", "AV", "AVE", "BLVD", "DR", "PL", "CT", "RD", "LN", "TER", "PKWY", "WAY", "PLZ", "CIR", "SQ", "TRL", "HWY", "ROW"]);
const USE = { 1110: "single-family home", 1111: "townhouse", 1114: "condominium", 1115: "condominium", 1120: "two-family", 1130: "three-family", 1140: "four-family", 1185: "multi-family" };
const FIELDS = "CityBlock,Parcel,OwnerCode,LowAddrNum,HighAddrNum,StPreDir,StName,StType,StdUnitNum,SITEADDR,ZIP,AsrLandUse1,NbrOfUnits,FirstYearBuilt,BillYear,AprResLand,AprResImprove,AprComLand,AprComImprove,AprAgrLand,AprAgrImprove";

export function matches(geo) {
  return String(geo?.countyFips || "") === "29510";
}

export async function evidence({ geo, address, zip, propertyType, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a) return null;
  const words = a.street.split(/\s+/);
  const dir = DIRS.has(words[0]) && words.length > 1 ? words.shift() : "";
  if (words.length > 1 && TYPES.has(words[words.length - 1])) words.pop();
  const name = words.join(" "), n = Number(a.number);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const where = `LowAddrNum<=${n} AND HighAddrNum>=${n} AND StName='${h.escapeSql(name)}'${dir ? ` AND StPreDir='${dir}'` : ""}`;
  const q = (url) => h.json(url + "?" + new URLSearchParams({ where, outFields: FIELDS, returnGeometry: "false", f: "json" }), 7000).catch(() => null);

  const unit = h.unitFromAddress(address);
  const [pj, cj] = await Promise.all([q(PARCELS), unit ? q(CONDOS) : null]);
  let rows = (pj?.features || []).map((f) => f.attributes);
  let condo = null;
  if (unit) {
    const units = (cj?.features || []).map((f) => f.attributes).filter((r) => h.unitKey(r.StdUnitNum) === unit);
    if (units.length === 1) condo = units[0];
  }

  // ZIP context (latest two years the city publishes)
  const t = h.s(propertyType).toLowerCase();
  const type = condo || /apartment|condo/.test(t) ? "condo" : /house|villa|town/.test(t) ? "house" : null;
  const stats = z && type ? getStlZipSales(z.zip)?.[type] : null;
  const label = type === "condo" ? "condominiums" : "single-family homes and townhouses";
  const context = stats
    ? `City of St. Louis Assessor: ${stats.sales} valid (arm's-length) sales of ${label} in ZIP ${z.zip} (${STL_SALES_META.periodFrom} to ${STL_SALES_META.periodTo}, the latest the city publishes), median price ${usd(stats.medianPrice)}${stats.medianPerSqFt ? `, median ${usd(stats.medianPerSqFt)} per sq ft of living area` : ""} — context only; not used in the verdict.`
    : z && type ? `City of St. Louis Assessor: fewer than ${STL_SALES_META.minSales} valid sales of ${label} in ZIP ${z.zip} (${STL_SALES_META.periodFrom} to ${STL_SALES_META.periodTo}) — no local figure.` : "";

  if (condo) {
    const yb = Number(condo.FirstYearBuilt) > 0 ? Number(condo.FirstYearBuilt) : null;
    return {
      source: SOURCE, sourceUrl: SOURCE_URL,
      summary: [`City of St. Louis Assessor: condominium unit ${h.s(condo.StdUnitNum)} at ${h.s(condo.SITEADDR).replace(/\s+/g, " ").trim()}${yb ? `, building from ${yb}` : ""} (the city's condominium records carry no appraisal or sale link).`, context].filter(Boolean).join(" "),
      lastSale: null, benchmark: null, governmentValue: null, location: null,
      property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null }, checks: [], hasRecord: true
    };
  }
  if (rows.length !== 1) {
    const summary = [rows.length > 1 ? "City of St. Louis Assessor: several parcels match this address — add the unit number." : null, context].filter(Boolean).join(" ");
    return summary ? { source: SOURCE, sourceUrl: SOURCE_URL, summary, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  }

  const r = rows[0];
  const value = ["AprResLand", "AprResImprove", "AprComLand", "AprComImprove", "AprAgrLand", "AprAgrImprove"].reduce((sum, k) => sum + (Number(r[k]) || 0), 0) || null;
  const year = r.BillYear ? String(r.BillYear) : null;
  const sale = r.CityBlock != null ? getStlLastValidSale(r.CityBlock, r.Parcel, r.OwnerCode) : null;
  const lastSale = sale ? { price: sale.price, date: sale.date, source: `${SOURCE} — valid (arm's-length) sale` } : null;
  const yb = Number(r.FirstYearBuilt) > 0 ? Number(r.FirstYearBuilt) : null;
  const use = USE[Number(r.AsrLandUse1)];
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: [`City of St. Louis Assessor parcel ${Number(r.CityBlock)}-${Number(r.Parcel)}${use ? ` (${use}${yb ? `, built ${yb}` : ""})` : yb ? ` (built ${yb})` : ""}: ${lastSale ? `last valid sale ${usd(lastSale.price)} on ${lastSale.date}` : `no valid sale in the city's sales file since 2010 (file ends ${STL_SALES_META.latestSale})`}${value ? `; appraised value ${usd(value)}${year ? ` on the ${year} tax bill` : ""}` : ""}.`, context].filter(Boolean).join(" "),
    lastSale, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `City of St. Louis Assessor appraised value${year ? ` (${year} tax bill)` : ""}` } : null,
    location: null,
    property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
