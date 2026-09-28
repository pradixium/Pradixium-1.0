/* PRADIXIUM™ — further single-county assessor sources on the shared
 * structured matcher (lib/usLocal/_structured.js), each official:
 *  - Chesterfield County, VA (51041): county GIS "Cadastral" ParcelsEnriched
 *    — Real Estate Assessment fair market value + assessment year, beds,
 *    baths, finished area, year built. SalePrice has no validity code → not
 *    shown.
 *  - St. Charles County, MO (29183): county open data "Tax_Information"
 *    situs layer — Assessor total market value, year built, beds, baths,
 *    total area. Residential assessed value = 19% of it (Missouri ratio,
 *    checked on samples) → not shown. Sale codes undocumented → not shown.
 *  - Tulsa County, OK (40143): Tulsa County Assessor parcels as published by
 *    INCOG (the regional council of governments) — total account value
 *    (land + improvements), year built; the layer's load date is named.
 *    Sale validity flags are not documented by the Assessor → not shown.
 *  - Chatham County, GA (13051; Savannah): SAGIS "Parcel Digest 2025" —
 *    Board of Assessors fair market value (land + building), year built;
 *    last sale only when coded "Q" (qualified — the Georgia sale-quality
 *    code used in the state's sales ratio studies).
 *  - Lancaster County, NE (31109; Lincoln): Lincoln–Lancaster County GIS
 *    Assessor TaxParcels — current assessed value (Nebraska assesses homes
 *    at actual value), residential floor area, year built.
 *  - York County, SC (45091): county GIS Parcels — appraised total value,
 *    finished sq ft, year built; the layer has no situs city/ZIP → parcel
 *    within 250 m of the geocoded point. SalePrice unscreened → not shown.
 *  - Lorain County, OH (39093): Auditor "2024 Reval Tax Parcels" — the 2024
 *    reappraisal total value (land + building).
 *  - Canadian County, OK (40017): county Assessor ParcelDataService — total
 *    market value (land + buildings), the capped value not shown.
 */
import { arcQuery, arcQueryNear, splitStreet, structuredEvidence } from "./_structured.js";

const bare = (x) => String(x || "").replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1");
const date = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null);

const COUNTIES = {
  "51041": {
    name: "Chesterfield County Real Estate Assessment", source: "Chesterfield County, Virginia — Real Estate Assessment (county GIS parcels)",
    sourceUrl: "https://www.chesterfield.gov/828/Real-Estate-Assessment-Data",
    valueLabel: "fair market value", note: "Sales are not shown: the parcel record's sale price carries no validity code.",
    find: ({ num, name, h }) => arcQuery(h, "https://services3.arcgis.com/TsynfzBSE6sXfoLq/arcgis/rest/services/Cadastral/FeatureServer/3",
      `House_Num='${num}' AND StreetName='${h.escapeSql(name)}'`, "Tax_ID,Address,StreetType,StreetDir,Zip,AssessmentYear,FairMarketValue,Bedrooms,FullBath,HalfBath,FinishedArea,Year_Built")
      .then((rs) => rs.map((r) => ({ id: r.Tax_ID, zip: h.s(r.Zip), town: "", dir: h.s(r.StreetDir), type: h.s(r.StreetType), unit: (h.s(r.Address).match(/(?:UNIT|APT|#)\s*(\S+)$/i) || [])[1] || "", value: r.FairMarketValue, year: r.AssessmentYear, beds: r.Bedrooms, baths: Number(r.FullBath) > 0 ? Number(r.FullBath) + 0.5 * Number(r.HalfBath || 0) : null, area: r.FinishedArea, built: r.Year_Built })))
  },
  "29183": {
    name: "St. Charles County Assessor", source: "St. Charles County, Missouri — Assessor (county open data tax information)",
    sourceUrl: "https://www.sccmo.org/153/Assessor",
    valueLabel: "total market value", note: "Missouri taxes 19% of a home's market value; sale records are not shown (their codes are not documented).",
    find: ({ num, name, h }) => arcQuery(h, "https://gis-dev.sccmo.org/scc_gis/rest/services/open_data/Tax_Information_o/FeatureServer/1",
      `SitusNumber='${num}' AND SiteAddress LIKE '${num} %${h.escapeSql(name)}%'`, "Account,SiteAddress,SitusZip,Municipality,PropType,YearBuilt,TotalArea,TotalMarketValue,Bedrooms,Bathrooms,HalfBathrooms")
      .then((rs) => rs.map((r) => {
        const m = h.s(r.SiteAddress).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        return st && st.name === name ? { id: r.Account, zip: h.s(r.SitusZip), town: h.s(r.Municipality).replace(/^(City|Village|Town) of /i, "").toUpperCase(), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.TotalMarketValue, beds: Math.round(Number(r.Bedrooms)) || null, baths: Number(r.Bathrooms) > 0 ? Number(r.Bathrooms) + 0.5 * Number(r.HalfBathrooms || 0) : null, area: r.TotalArea, built: r.YearBuilt, use: h.s(r.PropType).replace(/\s*\(.*\)$/, "") } : null;
      }).filter(Boolean))
  },
  "40143": {
    name: "Tulsa County Assessor", source: "Tulsa County Assessor parcels (published by INCOG)",
    sourceUrl: "https://assessor.tulsacounty.org/",
    valueLabel: "total value (land + improvements)", note: "Sales are not shown: the layer's validity flags are not documented by the Assessor.",
    // the county writes numbered streets without the ordinal ("E 39 ST S")
    find: ({ num, name, h }) => arcQuery(h, "https://map11.incog.org/arcgis11wa/rest/services/Parcels_TulsaCo/FeatureServer/0",
      `PropertyAddress LIKE '${num} %${h.escapeSql(bare(name))}%'`, "AccountNo,PropertyAddress,PropertyZIP,PropertyCity,TotalAcctValue,YearBuilt,LoadDate,PropertyType")
      .then((rs) => rs.map((r) => {
        const m = h.s(r.PropertyAddress).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2].replace(/\bBV\b/, "BLVD")) : null;
        return st && m[1] === num && bare(st.name) === bare(name) ? { id: r.AccountNo, zip: h.s(r.PropertyZIP), town: h.s(r.PropertyCity), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.TotalAcctValue, built: r.YearBuilt, use: h.s(r.PropertyType), areaText: date(r.LoadDate) ? `roll loaded ${date(r.LoadDate)}` : null } : null;
      }).filter(Boolean))
  },
  "13051": {
    name: "Chatham County Board of Assessors", source: "Chatham County Board of Assessors (SAGIS Parcel Digest 2025)",
    sourceUrl: "https://boa.chathamcountyga.gov/",
    valueLabel: "fair market value (land + building)", note: "",
    find: ({ num, name, h }) => arcQuery(h, "https://pub.sagis.org/arcgis/rest/services/OpenData/Parcels/MapServer/27",
      `PropAddress_Num='${num}' AND PropAddress_Full LIKE '${num} %${h.escapeSql(name)}%'`, "PIN,PropAddress_Full,PropAddress_PreDir,PropAddress_StreetType,PropAddress_PostDir,PropAddress_UnitNum,PropAddress_City,PropAddress_Zip,FairMarketValue,YearBuilt,Sale_Price,Sale_YY,Sale_MM,Sale_DD,Sale_Quality")
      .then((rs) => rs.map((r) => {
        const m = h.s(r.PropAddress_Full).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        const ymd = Number(r.Sale_YY) > 1900 ? `${r.Sale_YY}-${String(r.Sale_MM).padStart(2, "0")}-${String(r.Sale_DD).padStart(2, "0")}` : null;
        return st && st.name === name ? { id: r.PIN, zip: h.s(r.PropAddress_Zip), town: h.s(r.PropAddress_City), dir: h.s(r.PropAddress_PreDir), type: h.s(r.PropAddress_StreetType), post: h.s(r.PropAddress_PostDir), unit: h.s(r.PropAddress_UnitNum), value: r.FairMarketValue, built: r.YearBuilt,
          sale: h.s(r.Sale_Quality) === "Q" && Number(r.Sale_Price) > 1000 && ymd ? { price: Number(r.Sale_Price), date: ymd, label: "sale coded Q, qualified" } : null } : null;
      }).filter(Boolean))
  },
  "31109": {
    name: "Lancaster County Assessor", source: "Lancaster County Assessor/Register of Deeds (Lincoln–Lancaster County GIS)",
    sourceUrl: "https://www.lancaster.ne.gov/180/Assessor-Register-of-Deeds",
    valueLabel: "assessed value (Nebraska assesses homes at actual value)", note: "",
    find: ({ num, name, h }) => arcQuery(h, "https://gis.lincoln.ne.gov/public/rest/services/Assessor/TaxParcels/MapServer/0",
      `SITEADDRESS LIKE '${num} %${h.escapeSql(name)}%'`, "PARCELID,SITEADDRESS,UnitNumber,CNTASSDVAL,RESFLRAREA,RESYRBLT,CLASSDSCRP")
      .then((rs) => rs.map((r) => {
        const m = h.s(r.SITEADDRESS).toUpperCase().match(/^(\d+)\s+(.+?)(?:,\s*(.*))?$/);
        const st = m ? splitStreet(m[2].replace(/\s+(UNIT|APT|#)\s*\S+$/, "")) : null;
        return st && m[1] === num && st.name === name ? { id: r.PARCELID, zip: ((m[3] || "").match(/\b(\d{5})\s*$/) || [])[1] || "", town: (m[3] || "LINCOLN").split(",")[0].trim(), dir: st.dir, type: st.type, post: st.post, unit: h.s(r.UnitNumber), value: r.CNTASSDVAL, area: r.RESFLRAREA, built: r.RESYRBLT, use: h.s(r.CLASSDSCRP) } : null;
      }).filter(Boolean))
  },
  "45091": {
    name: "York County Assessor", source: "York County, South Carolina — Assessor (county GIS parcels)",
    sourceUrl: "https://www.yorkcountygov.com/185/Assessor",
    valueLabel: "appraised value (land + building + misc.)", note: "Sales are not shown: the parcel record's sale price carries no validity code.",
    spatial: true,
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://services1.arcgis.com/2AGLxyiJoNiVHKwq/arcgis/rest/services/Parcels/FeatureServer/0",
      `PropertyAddress LIKE '${num} %'`, "ParcelID,PropertyAddress,AprTotVal,FinishedSQFT,YearBuilt,LandUseDesc", geo, 250, 9000)
      .then((rs) => rs.map((r) => {
        const m = h.s(r.PropertyAddress).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        return st && m[1] === num && st.name === name ? { id: r.ParcelID, zip: "", town: "", dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.AprTotVal, area: r.FinishedSQFT, built: r.YearBuilt, use: h.s(r.LandUseDesc) } : null;
      }).filter(Boolean))
  },
  "13067": {
    name: "Cobb County Tax Assessor", source: "Cobb County, Georgia — Tax Assessor (county GIS, daily parcel layer)",
    sourceUrl: "https://www.cobbassessor.org/",
    valueLabel: "fair market value (land + building)", note: "The assessed value is 40% of it (Georgia's assessment ratio) and is not shown.",
    spatial: true,
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://gis.cobbcounty.org/gisserver/rest/services/tax/taxassessorsdaily/MapServer/0",
      `ST_NUMBER = ${Number(num)}`, "PIN,SITUS_ADDR,UNIT_NUM,FMV_TOTAL", geo, 250, 8000)
      .then((rs) => rs.map((r) => {
        const m = h.s(r.SITUS_ADDR).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+)$/);
        const st = m ? splitStreet(m[2]) : null;
        return st && m[1] === num && st.name === name ? { id: r.PIN, zip: "", town: "", dir: st.dir, type: st.type, post: st.post, unit: h.s(r.UNIT_NUM), value: r.FMV_TOTAL } : null;
      }).filter(Boolean))
  },
  "39093": {
    name: "Lorain County Auditor", source: "Lorain County Auditor (2024 reappraisal tax parcels, county GIS)",
    sourceUrl: "https://www.loraincountyauditor.gov/",
    valueLabel: "2024 reappraisal total value (land + building)", note: "",
    find: ({ num, name, h }) => arcQuery(h, "https://services1.arcgis.com/vGBb7WYV10mOJRNM/arcgis/rest/services/2024_Reval_Tax_Parcels/FeatureServer/1",
      `loc_address LIKE '${num} %${h.escapeSql(name)}%'`, "parcel_number,loc_address,unit,loc_city,loc_zip,total_value_2024")
      .then((rs) => rs.map((r) => {
        const m = h.s(r.loc_address).toUpperCase().replace(/\s+/g, " ").match(/^(\d+)\s+(.+)$/);
        const st = m ? splitStreet(m[2]) : null;
        return st && m[1] === num && st.name === name ? { id: r.parcel_number, zip: h.s(r.loc_zip), town: h.s(r.loc_city), dir: st.dir, type: st.type, post: st.post, unit: h.s(r.unit), value: r.total_value_2024 } : null;
      }).filter(Boolean))
  },
  "40017": {
    name: "Canadian County Assessor", source: "Canadian County, Oklahoma — Assessor (county parcel data service)",
    sourceUrl: "https://www.canadiancounty.org/166/Assessor",
    valueLabel: "total market value (land + buildings)", note: "",
    find: ({ num, name, h }) => arcQuery(h, "https://services2.arcgis.com/0NjdXxmJp53hZWPd/arcgis/rest/services/ParcelDataService_2_view/FeatureServer/3",
      `situs LIKE '${num} %${h.escapeSql(name)}%'`, "account,situs,situs_city,situs_zip,total_val,prop_class")
      .then((rs) => rs.map((r) => {
        const m = h.s(r.situs).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        return st && m[1] === num && st.name === name ? { id: r.account, zip: h.s(r.situs_zip), town: h.s(r.situs_city), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.total_val } : null;
      }).filter(Boolean))
  }
};

export function matches(geo) {
  return Boolean(COUNTIES[String(geo?.countyFips || "")]);
}

export async function evidence(ctx) {
  return structuredEvidence(COUNTIES[String(ctx.geo.countyFips)], ctx);
}
