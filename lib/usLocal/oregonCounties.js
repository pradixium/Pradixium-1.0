/* PRADIXIUM™ — Oregon counties outside the Portland metro (which is
 * covered by portlandMetro.js / Oregon Metro RLIS). Each county assessor's
 * own public layer; the Real Market Value (RMV, land + improvements) is
 * shown as Government Value, display only. Oregon taxes the (capped)
 * assessed value, which is lower — it is not shown. None of these layers
 * states the roll year, so none is shown.
 *  - Marion (41047, Salem): county GIS Public/Parcels — RMVTOTAL, living
 *    area, year built. SALEPRICE has no validity code → not shown.
 *  - Deschutes (41017, Bend): county OpenData tables — Assessor Account
 *    (situs) → Roll Values (RMV_Total) + Sales: the latest sale is shown
 *    only when the Assessor's reject code is 33 "CONFIRMED SALE".
 *  - Lane (41039, Eugene): county Address (Site) points → map-taxlot →
 *    Parcels (total_mkt_land_value + total_mkt_imp_value; published weekly
 *    by Lane County Assessment and Taxation).
 * Owner names are never requested.
 */
import { arcQuery, splitStreet, structuredEvidence } from "./_structured.js";

const MARION = "https://gis.co.marion.or.us/arcgis/rest/services/Public/Parcels/MapServer/0";
const DESCH = "https://maps.deschutes.org/arcgis/rest/services/OpenData/TablesFD/MapServer";
const LANE = "https://lcmaps.lanecounty.org/arcgis/rest/services/LaneCountyMaps/AddressParcel/MapServer";
const inList = (h, xs) => xs.map((x) => `'${h.escapeSql(x)}'`).join(",");
const ymd = (ms) => (Number.isFinite(Number(ms)) && ms ? new Date(Number(ms)).toISOString().slice(0, 10) : null);

const COUNTIES = {
  "41047": {
    name: "Marion County Assessor", source: "Marion County, Oregon — Assessor (county GIS parcels)",
    sourceUrl: "https://www.co.marion.or.us/AO",
    valueLabel: "real market value (land + improvements)", note: "Oregon taxes a lower, capped assessed value (not shown); sale prices in this layer carry no validity code.",
    find: ({ num, name, h }) => arcQuery(h, MARION, `STREETNUM = '${num}' AND STREETNAME = '${h.escapeSql(name)}'`,
      "TAXLOT,STREETNUM,PRE_DIR,STREETNAME,STREETTYPE,POST_DIR,UNITNUM,SITUSCSZ,RMVTOTAL,YEARBUILT,LIVINGAREA,PRPCLSDESC")
      .then((rs) => rs.map((r) => {
        const csz = h.s(r.SITUSCSZ).toUpperCase().split(",").map((x) => x.trim());
        return { id: r.TAXLOT, zip: csz[2] || "", town: csz[0] || "", dir: r.PRE_DIR, type: r.STREETTYPE, post: r.POST_DIR, unit: r.UNITNUM,
          value: r.RMVTOTAL, area: r.LIVINGAREA, built: r.YEARBUILT, use: h.s(r.PRPCLSDESC) };
      }))
  },
  "41017": {
    name: "Deschutes County Assessor", source: "Deschutes County, Oregon — Assessor (county open data: accounts, roll values, sales)",
    sourceUrl: "https://www.deschutes.org/assessor",
    valueLabel: "real market value (land + improvements)", note: "Oregon taxes a lower, capped assessed value (not shown).",
    find: async ({ num, name, h }) => {
      const acc = await arcQuery(h, `${DESCH}/1`, `House_Number = '${num}' AND Street_Name = '${h.escapeSql(name)}'`,
        "TaxLot,Direction,Street_Name,Street_Type,Unit_Number,City,Zip");
      const lots = [...new Set(acc.map((r) => h.s(r.TaxLot)).filter(Boolean))].slice(0, 10);
      if (!lots.length) return [];
      const [vals, sales] = await Promise.all([
        arcQuery(h, `${DESCH}/3`, `Taxlot IN (${inList(h, lots)})`, "Taxlot,RMV_Total"),
        arcQuery(h, `${DESCH}/9`, `Taxlot IN (${inList(h, lots)})`, "Taxlot,Reject_Code_1,Total_Sales_Price_1,Sales_Date_1")
      ]);
      return acc.map((r) => {
        const v = vals.find((x) => x.Taxlot === r.TaxLot), s = sales.find((x) => x.Taxlot === r.TaxLot);
        const sale = s && h.s(s.Reject_Code_1) === "33" && Number(s.Total_Sales_Price_1) > 1000 && ymd(s.Sales_Date_1)
          ? { price: Number(s.Total_Sales_Price_1), date: ymd(s.Sales_Date_1), label: "Assessor code 33, confirmed sale" } : null;
        return { id: r.TaxLot, zip: h.s(r.Zip), town: h.s(r.City), dir: r.Direction, type: r.Street_Type, unit: r.Unit_Number, value: v?.RMV_Total, sale };
      });
    }
  },
  "41039": {
    name: "Lane County Assessment and Taxation", source: "Lane County, Oregon — Assessment and Taxation (county GIS site addresses + taxlots, published weekly)",
    sourceUrl: "https://www.lanecounty.org/government/county_departments/assessment_and_taxation",
    valueLabel: "real market value (land + improvements)", idLabel: "map-taxlot", note: "Oregon taxes a lower, capped assessed value (not shown). Sales are not in this layer.",
    find: async ({ num, name, h }) => {
      const ad = await arcQuery(h, `${LANE}/0`, `house_nbr = ${Number(num)} AND street_name = '${h.escapeSql(name)}'`,
        "pre_direction_code,street_name,street_type_code,unit_id,city_name,five_digit_zip_code,maptaxlot");
      const lots = [...new Set(ad.map((r) => h.s(r.maptaxlot)).filter(Boolean))].slice(0, 10);
      if (!lots.length) return [];
      const ps = await arcQuery(h, `${LANE}/2`, `MAPTAXLOT IN (${inList(h, lots)})`, "MAPTAXLOT,LANDVAL,IMPVAL,YEARBLT,NUMACCNTS");
      return ad.map((r) => {
        const p = ps.find((x) => x.MAPTAXLOT === r.maptaxlot);
        // a taxlot carrying several accounts (condos, multiple buildings) has no single value
        const value = p && Number(p.NUMACCNTS || 1) === 1 ? (Number(p.LANDVAL) || 0) + (Number(p.IMPVAL) || 0) : null;
        return { id: r.maptaxlot, zip: h.s(r.five_digit_zip_code), town: h.s(r.city_name), dir: r.pre_direction_code, type: r.street_type_code, unit: r.unit_id, value, built: p?.YEARBLT };
      });
    }
  }
};

export function matches(geo) {
  return Boolean(COUNTIES[String(geo?.countyFips || "")]);
}

export function evidence(ctx) {
  return structuredEvidence(COUNTIES[String(ctx.geo.countyFips)], ctx);
}
