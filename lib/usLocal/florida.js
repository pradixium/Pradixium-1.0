/* PRADIXIUM™ — Florida: Miami, Tampa and Orlando metros (11 counties)
 * 1. ZIP context from lib/data/flSales.js (scripts/build-fl-sales.mjs):
 *    Florida Department of Revenue SDF + NAL — sales the county property
 *    appraiser qualified as arm's length (codes 01/02), improved, single
 *    parcel, same type (single-family 001 / condo 004). Per-sq-ft uses
 *    FDOR "effective" area (includes weighted garages/porches), so the
 *    figure is context only — never the verdict.
 * 2. Miami-Dade only: property facts from the Miami-Dade Property
 *    Appraiser's own parcel layer (heated area, beds, baths, year built).
 *    Its "last sale" field carries no qualification code, so it is not
 *    shown as a sale.
 */
import { getFlZipSales, FL_SALES_META } from "../data/flSales.js";

const MDPA = "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/PaParcelView_gdb/FeatureServer/0/query";

export function matches(geo) {
  return FL_SALES_META.counties.includes(String(geo?.countyFips || ""));
}

export async function evidence({ geo, address, zip, propertyType, h }) {
  const z = h.uspsZip(zip, geo);
  const t = h.s(propertyType).toLowerCase();
  const type = /apartment|condo/.test(t) ? "condo" : /house|villa|town/.test(t) ? "house" : null;
  const zipSales = z ? getFlZipSales(geo.countyFips, z.zip) : null;
  const stats = type ? zipSales?.[type] : null;
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const label = type === "condo" ? "condominiums" : "single-family homes";
  const parts = [];
  if (stats) {
    parts.push(`Florida Dept. of Revenue: ${stats.sales} qualified (arm's-length) sales of ${label} in ZIP ${z.zip} (${FL_SALES_META.periodFrom} to ${FL_SALES_META.periodTo}), median price ${usd(stats.medianPrice)}${stats.medianPerEffSqFt ? `, median ${usd(stats.medianPerEffSqFt)} per sq ft of effective building area (includes weighted garages/porches — not living area)` : ""} — context only; not used in the verdict.`);
  } else if (z && type) {
    parts.push(`Florida Dept. of Revenue: fewer than ${FL_SALES_META.minSales} qualified sales of ${label} in ZIP ${z.zip} (${FL_SALES_META.periodFrom} to ${FL_SALES_META.periodTo}) — no local figure.`);
  }

  // Miami-Dade Property Appraiser — property facts only
  let property = null, location = null, hasRecord = false;
  if (String(geo.countyFips) === "12086" && z) {
    const a = h.addressParts(geo);
    if (a) {
      const j = await h.json(MDPA + "?" + new URLSearchParams({
        // the Property Appraiser writes numbered streets without ordinals ("SW 116 ST")
        where: `TRUE_SITE_ADDR LIKE '${h.escapeSql(`${a.number} ${a.street.replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1")}`)}%' AND TRUE_SITE_ZIP_CODE LIKE '${z.zip}%'`,
        outFields: "FOLIO,TRUE_SITE_ADDR,TRUE_SITE_UNIT,BEDROOM_COUNT,BATHROOM_COUNT,BUILDING_HEATED_AREA,YEAR_BUILT,X_COORD,Y_COORD",
        returnGeometry: "false", f: "json"
      }), 9000);
      let rows = (j?.features || []).map((f) => f.attributes);
      const unit = h.unitFromAddress(address);
      if (unit) rows = rows.filter((r) => h.unitKey(r.TRUE_SITE_UNIT) === unit);
      else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.TRUE_SITE_UNIT));
      if (rows.length === 1) {
        const r = rows[0];
        hasRecord = true;
        property = {
          livingAreaSqFt: Number(r.BUILDING_HEATED_AREA) > 0 ? Number(r.BUILDING_HEATED_AREA) : null,
          bedrooms: Number(r.BEDROOM_COUNT) > 0 ? Number(r.BEDROOM_COUNT) : null,
          bathrooms: Number(r.BATHROOM_COUNT) > 0 ? Number(r.BATHROOM_COUNT) : null,
          yearBuilt: Number(r.YEAR_BUILT) > 0 ? Number(r.YEAR_BUILT) : null
        };
        parts.push(`Miami-Dade Property Appraiser folio ${h.s(r.FOLIO)}: ${[property.livingAreaSqFt && `${property.livingAreaSqFt.toLocaleString("en-US")} sq ft heated`, property.bedrooms && `${property.bedrooms} bd`, property.bathrooms && `${property.bathrooms} ba`, property.yearBuilt && `built ${property.yearBuilt}`].filter(Boolean).join(", ") || "record found"}.`);
      } else if ((j?.features || []).length > 1) {
        parts.push("Miami-Dade Property Appraiser: several units at this address — add the unit number for the unit's own record.");
      }
    }
  }

  return {
    source: FL_SALES_META.source, sourceUrl: FL_SALES_META.sourceUrl,
    summary: parts.join(" ") || null,
    lastSale: null, benchmark: null, governmentValue: null,
    location, property, checks: [], hasRecord
  };
}
