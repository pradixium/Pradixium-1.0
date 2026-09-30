/* PRADIXIUM™ — Fairfax County, VA (DC metro's largest county) — Fairfax
 * County Department of Tax Administration open data
 *  - Address Points: address → parcel PIN
 *  - Real Estate Sales Data: every transfer with the county's own
 *    validity label; only "Valid and verified sale" counts (not "No
 *    consideration", related-party, multi-parcel, non-representative …)
 *  - Assessed Values (latest tax year, appraised total — Government
 *    Value, display only) and Dwelling Data (living area SFLA, beds,
 *    baths, year built)
 * The sales table carries no area or neighborhood → the ZIP × land-use
 * median is prebuilt by joining it to Address Points and the Real Estate
 * Parcels Data (scripts/build-fairfax-sales.mjs); homes → benchmark.
 */
const B = "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/";
const ADDR = B + "Address_Points/FeatureServer/0/query";
const SALES = B + "OpenData_A5/FeatureServer/1/query";
const VALUES = B + "OpenData_A6/FeatureServer/2/query";
const DWELL = B + "OpenData_A7/FeatureServer/2/query";
import { FAIRFAX_SALES } from "../data/fairfaxSales.js";
const PARCELS = B + "Tax_Administration_Real_Estate_Parcels_Data/FeatureServer/0/query";
// homes: their ZIP median of valid and verified sales is the benchmark
const HOME_LUC = /^(Single-family|Townhouse|Duplex|Garden Style condominium|Multiplex in condominium|High rise apartments condo|Medium rise apartments condo|Low rise apartments condo)/i;
const SOURCE = "Fairfax County Department of Tax Administration — Real Estate open data";
const SOURCE_URL = "https://www.fairfaxcounty.gov/taxes/real-estate";

export function matches(geo) {
  return String(geo?.countyFips || "") === "51059";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const q = (url, params, ms = 6000) => h.json(url + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const unit = h.unitFromAddress(address);
  const ap = await q(ADDR, { where: `STREET_NUM='${h.escapeSql(a.number)}' AND ADDRESS_1 LIKE '${h.escapeSql(`${a.number} ${a.street}`)}%' AND ZIP='${z.zip}' AND ADDRESS_STATUS='Current'`, outFields: "PARCEL_PIN,ADDRESS_1,UNIT_NUMBER" });
  let rows = (ap?.features || []).map((f) => f.attributes).filter((r) => h.s(r.ADDRESS_1).toUpperCase().startsWith(`${a.number} ${a.street}`));
  if (unit) rows = rows.filter((r) => h.unitKey(r.UNIT_NUMBER) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.UNIT_NUMBER));
  const pins = [...new Set(rows.map((r) => h.s(r.PARCEL_PIN)).filter(Boolean))];
  if (pins.length !== 1) return (ap?.features || []).length ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Fairfax County: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const pin = pins[0], w = `PARID='${h.escapeSql(pin)}'`;

  const [sales, vals, dw, luc] = await Promise.all([
    q(SALES, { where: `${w} AND SALEVAL_DESC='Valid and verified sale' AND PRICE>0`, outFields: "SALEDT,PRICE", orderByFields: "SALEDT DESC", resultRecordCount: "1" }),
    q(VALUES, { where: w, outFields: "TAXYR,APRTOT", orderByFields: "TAXYR DESC", resultRecordCount: "1" }),
    q(DWELL, { where: w, outFields: "SFLA,YRBLT,RMBED,FIXBATH", resultRecordCount: "1" }),
    q(PARCELS, { where: w, outFields: "TAXYR,LUC_DESC", orderByFields: "TAXYR DESC", resultRecordCount: "1" })
  ]);
  // ZIP median of the county's valid and verified sales, same land-use
  // code, 12 months — prebuilt (scripts/build-fairfax-sales.mjs)
  const lucDesc = h.s(luc?.features?.[0]?.attributes?.LUC_DESC).trim();
  const g = lucDesc ? FAIRFAX_SALES[`${z.zip}|${lucDesc}`] : null;
  const home = HOME_LUC.test(lucDesc);
  const areaMedianPrice = g && home ? { value: g.median, sales: g.n, area: `ZIP ${z.zip}`, typeLabel: lucDesc.toLowerCase(), periodFrom: g.from, periodTo: g.to, source: SOURCE, sourceUrl: SOURCE_URL } : null;
  const areaText = g ? ` ZIP ${z.zip}: ${g.n} valid and verified sales of "${lucDesc.toLowerCase()}" parcels (${g.from} to ${g.to}), median price ${usd(g.median)} — ${home ? "the benchmark: a whole-home median, not adjusted for size" : "whole-property price, context only; not used in the verdict"}.` : "";
  const s0 = sales?.features?.[0]?.attributes, v0 = vals?.features?.[0]?.attributes, d0 = dw?.features?.[0]?.attributes;
  const lastSale = s0 && Number.isFinite(s0.SALEDT) ? { price: Number(s0.PRICE), date: new Date(s0.SALEDT).toISOString().slice(0, 10), source: `${SOURCE} — valid and verified sale` } : null;
  const value = Number(v0?.APRTOT) > 0 ? Number(v0.APRTOT) : null, year = v0?.TAXYR ? String(v0.TAXYR) : null;
  const property = d0 ? { livingAreaSqFt: Number(d0.SFLA) > 0 ? Number(d0.SFLA) : null, yearBuilt: Number(d0.YRBLT) > 0 ? Number(d0.YRBLT) : null, bedrooms: Number(d0.RMBED) > 0 ? Number(d0.RMBED) : null, bathrooms: Number(d0.FIXBATH) > 0 ? Number(d0.FIXBATH) : null } : null;
  const facts = property ? [property.livingAreaSqFt && `${property.livingAreaSqFt.toLocaleString("en-US")} sq ft living`, property.bedrooms && `${property.bedrooms} bd`, property.bathrooms && `${property.bathrooms} ba`, property.yearBuilt && `built ${property.yearBuilt}`].filter(Boolean).join(", ") : "";
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Fairfax County parcel ${pin.replace(/\s+/g, " ")}${facts ? ` (${facts})` : ""}: ${lastSale ? `last valid and verified sale ${usd(lastSale.price)} on ${lastSale.date}` : "no valid and verified sale on record"}${value ? `; ${year ? year + " " : ""}assessed value ${usd(value)}` : ""}.${areaText}`,
    lastSale, benchmark: null, areaMedianPrice,
    governmentValue: value ? { value, asOf: year, label: `Fairfax County ${year ? year + " " : ""}assessed value` } : null,
    location: null, property, checks: [], hasRecord: true
  };
}
