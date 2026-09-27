/* PRADIXIUM™ — Minneapolis core: Hennepin County, MN (Hennepin County GIS,
 * HennepinData/LAND_PROPERTY "County Parcels")
 * Last sale with the county's sale code: only "W" (warranty deed) counts —
 * "R" is the county's own "excluded from ratio studies" (non-market), and
 * multi-parcel (M), quit-claim (Q), contract-for-deed (C) and "other" (O)
 * are left out. Sale dates are month-level (YYYYMM).
 * Also: estimated market value (Government Value, display only), total
 * tax, year built, school district. ZIP context = median price of W sales
 * of the same property type, last 12 months — context only.
 */
const URL = "https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/1/query";
const SOURCE = "Hennepin County — County Parcels (assessor & taxpayer services)";
const SOURCE_URL = "https://www.hennepin.us/residents/property";
const MIN_SALES = 10;
const ym = (v) => { const m = String(v ?? "").match(/^(\d{4})(\d{2})$/); return m ? `${m[1]}-${m[2]}` : null; };

export function matches(geo) {
  return String(geo?.countyFips || "") === "27053";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a) return null;
  const q = (params, ms = 7000) => h.json(URL + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const j = await q({ where: `HOUSE_NO=${Number(a.number)} AND STREET_NM LIKE '${h.escapeSql(a.street)}%'${z ? ` AND ZIP_CD='${z.zip}'` : ""}`, outFields: "PID,HOUSE_NO,STREET_NM,CONDO_NO,ZIP_CD,SALE_DATE,SALE_PRICE,SALE_CODE,MKT_VAL_TOT,TAX_TOT,BUILD_YR,PR_TYP_NM1,SCHOOL_DIST_NO,MUNIC_NM,LAT,LON" });
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => h.s(r.STREET_NM).toUpperCase() === a.street);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.CONDO_NO) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.CONDO_NO));
  const r = rows.length === 1 ? rows[0] : null;
  if (!r) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Hennepin County: several units at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;

  const lastSale = h.s(r.SALE_CODE) === "W" && Number(r.SALE_PRICE) > 0 && ym(r.SALE_DATE) ? { price: Number(r.SALE_PRICE), date: ym(r.SALE_DATE), source: `${SOURCE} — warranty-deed sale (month-level date)` } : null;
  const mv = Number(r.MKT_VAL_TOT) > 0 ? Number(r.MKT_VAL_TOT) : null;
  const parts = [`Hennepin County parcel ${h.s(r.PID)} (${h.s(r.MUNIC_NM)}${h.s(r.PR_TYP_NM1) ? `, ${h.s(r.PR_TYP_NM1).toLowerCase()}` : ""}): ${lastSale ? `last warranty-deed sale ${usd(lastSale.price)} in ${lastSale.date}` : "no qualifying warranty-deed sale on the current record"}${mv ? `; estimated market value ${usd(mv)}` : ""}.`];

  if (z && h.s(r.PR_TYP_NM1)) {
    const now = new Date(), from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const since = `${from.getFullYear()}${String(from.getMonth() + 1).padStart(2, "0")}`;
    const ns = await q({ where: `ZIP_CD='${z.zip}' AND PR_TYP_NM1='${h.escapeSql(r.PR_TYP_NM1)}' AND SALE_CODE='W' AND SALE_PRICE>0 AND SALE_DATE>='${since}'`, outFields: "SALE_PRICE,SALE_DATE", resultRecordCount: "2000" }, 4000);
    if (Array.isArray(ns?.features) && !ns.exceededTransferLimit) {
      const p = ns.features.map((f) => Number(f.attributes.SALE_PRICE)).sort((x, y) => x - y);
      const d = ns.features.map((f) => ym(f.attributes.SALE_DATE)).filter(Boolean).sort();
      const m = Math.floor(p.length / 2);
      if (p.length >= MIN_SALES) parts.push(`ZIP ${z.zip}: ${p.length} warranty-deed sales of ${h.s(r.PR_TYP_NM1).toLowerCase()} properties (${d[0]} to ${d[d.length - 1]}), median price ${usd(p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2)} — whole-property price, context only; not used in the verdict.`);
      else parts.push(`ZIP ${z.zip}: only ${p.length} warranty-deed sales of this property type in the last 12 months — not enough for a local figure.`);
    }
  }
  const checks = [];
  if (Number(r.TAX_TOT) > 0) checks.push({ id: "propertyTax", label: "Property tax (current tax year, total)", value: `${usd(Number(r.TAX_TOT))} — Hennepin County`, level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" });
  if (h.s(r.SCHOOL_DIST_NO)) checks.push({ id: "schoolDistrict", label: "School district", value: `ISD/SD ${h.s(r.SCHOOL_DIST_NO)}`, level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" });
  return {
    source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "), lastSale, benchmark: null,
    governmentValue: mv ? { value: mv, asOf: null, label: "Hennepin County estimated market value" } : null,
    location: Number(r.LAT) && Number(r.LON) ? { latitude: Number(r.LAT), longitude: Number(r.LON) } : null,
    property: { yearBuilt: Number(r.BUILD_YR) || null, bedrooms: null, bathrooms: null, livingAreaSqFt: null },
    checks, hasRecord: true
  };
}
