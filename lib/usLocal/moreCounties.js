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
import { arcQuery, arcQueryBox, arcQueryNear, splitStreet, structuredEvidence } from "./_structured.js";

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
  "51013": {
    name: "Arlington County Real Estate Assessments", source: "Arlington County, Virginia — Department of Real Estate Assessments (county open data hub)",
    sourceUrl: "https://www.arlingtonva.us/Government/Programs/Real-Estate-Assessments",
    valueLabel: "assessed value (land + improvements; Virginia assesses at fair market value)", idLabel: "RPC",
    note: "Sales are not shown: market sales carry no validity code in this dataset.",
    find: async ({ num, name, h }) => {
      const base = "https://datahub-v2.arlingtonva.us/api/RealEstate";
      const ps = await h.json(`${base}/Property?` + new URLSearchParams({
        $select: "realEstatePropertyCode,propertyStreetNbr,propertyStreetDirectionPrefixCode,propertyStreetName,propertyStreetTypeCode,propertyStreetDirectionSuffixCode,propertyUnitNbr,propertyCityName,propertyZipCode,propertyYearBuilt,propertyClassTypeDsc,propertyExpiredInd",
        $filter: `propertyStreetNbr eq ${Number(num)} and propertyStreetName eq '${h.escapeSql(name)}'`, $top: "50"
      }), 6000).catch(() => []);
      const live = (Array.isArray(ps) ? ps : []).filter((p) => !p.propertyExpiredInd);
      const codes = [...new Set(live.map((p) => p.realEstatePropertyCode))].slice(0, 10);
      if (!codes.length) return [];
      const as = await h.json(`${base}/Assessment?` + new URLSearchParams({
        $select: "realEstatePropertyCode,assessmentDate,totalValueAmt",
        $filter: codes.map((c) => `realEstatePropertyCode eq '${h.escapeSql(c)}'`).join(" or "), $orderby: "assessmentDate desc", $top: "60"
      }), 6000).catch(() => []);
      return live.map((p) => {
        const a = (Array.isArray(as) ? as : []).find((x) => x.realEstatePropertyCode === p.realEstatePropertyCode);
        return { id: p.realEstatePropertyCode, zip: h.s(p.propertyZipCode), town: h.s(p.propertyCityName), dir: p.propertyStreetDirectionPrefixCode, type: p.propertyStreetTypeCode, post: p.propertyStreetDirectionSuffixCode,
          unit: p.propertyUnitNbr, value: a?.totalValueAmt, year: a ? h.s(a.assessmentDate).slice(0, 4) : null, built: p.propertyYearBuilt, use: h.s(p.propertyClassTypeDsc).replace(/^\d+-/, "") };
      });
    }
  },
  "19113": {
    name: "Linn County / Cedar Rapids Assessor", source: "Linn County, Iowa — GIS RealEstateParcel (Linn County and City of Cedar Rapids assessors, county tax system)",
    sourceUrl: "https://www.linncountyiowa.gov/",
    valueLabel: "assessed value (land + improvements; Iowa assesses at market value)",
    note: "The taxable value after Iowa's rollback is lower and is not shown.",
    find: ({ num, name, h }) => arcQuery(h, "https://services.arcgis.com/i14SLLmXo7Hn9vNc/arcgis/rest/services/RealEstateParcel/FeatureServer/0",
      `SitusAddress LIKE '${num} %${h.escapeSql(name)}%'`, "GPN,SitusAddress,SitusCity,SitusZip,Class,AssessmentYear,ValueTotal")
      .then((rs) => rs.map((r) => {
        const m = h.s(r.SitusAddress).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        return st && m[1] === num && st.name === name ? { id: r.GPN, zip: h.s(r.SitusZip), town: h.s(r.SitusCity), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.ValueTotal, year: r.AssessmentYear, use: h.s(r.Class) } : null;
      }).filter(Boolean))
  },
  "47065": {
    name: "Hamilton County Assessor of Property", source: "Hamilton County, Tennessee — Assessor of Property (county GIS Live_Parcels)",
    sourceUrl: "https://assessor.hamiltontn.gov/",
    valueLabel: "appraised value (land + building + yard items)", note: "The assessed value (25% for homes, Tennessee's ratio) is not shown; sale prices in this layer carry no validity code.",
    spatial: true,
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://mapsdev.hamiltontn.gov/hcwa03/rest/services/Live_Parcels/MapServer/0",
      `STNUM = '${num}' AND STNAME = '${h.escapeSql(name)}'`, "GISLINK,STNUM,DIRPFX,STNAME,TYPESFX,APPVALUE", geo, 1000, 7000)
      .then((rs) => { const seen = new Set(); return rs.filter((r) => !seen.has(r.GISLINK) && seen.add(r.GISLINK)).map((r) => ({ id: h.s(r.GISLINK), zip: "", town: "", dir: h.s(r.DIRPFX), type: h.s(r.TYPESFX), unit: "", value: r.APPVALUE })); })
  },
  "47125": {
    name: "Montgomery County Assessor of Property", source: "Montgomery County, Tennessee — Assessor of Property (county GIS Parcels)",
    sourceUrl: "https://mcgtn.org/assessor",
    valueLabel: "market appraised value (land + improvements)", idLabel: "parcel",
    note: "The layer carries these values on the 2027 record year (the assessor's working roll), shown as published. The assessed value (25% for homes) is not shown; sale reason codes are not documented, so sales are not shown.",
    find: ({ num, name, h }) => arcQuery(h, "https://gis.mcgtn.org/arcgis/rest/services/Parcels/MapServer/0",
      `PropertyAddress LIKE '${num} %${h.escapeSql(name)}%'`, "GISLINK,PropertyAddress,PropertyCity,MktAppraisedValue,YearBuilt,LivingArea,PropertyTypeDesc")
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const m = h.s(r.PropertyAddress).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.GISLINK)) return null;
        seen.add(r.GISLINK);
        return { id: h.s(r.GISLINK), zip: "", town: h.s(r.PropertyCity), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "",
          value: Number(h.s(r.MktAppraisedValue).replace(/[$,]/g, "")) || null, built: r.YearBuilt, area: r.LivingArea, use: h.s(r.PropertyTypeDesc) };
      }).filter(Boolean); })
  },
  "29095": {
    name: "Jackson County Assessment", source: "Jackson County, Missouri — Assessment Department (county GIS parcel viewer, Ascend property table)",
    sourceUrl: "https://www.jacksongov.org/Government/Departments/Assessment",
    valueLabel: "market value (land + improvements)",
    note: "The assessed value (19% for homes, Missouri's ratio) is not shown; the county's layer publishes no sale prices.",
    find: ({ num, name, h }) => arcQuery(h, "https://jcgis.jacksongov.org/arcgis/rest/services/ParcelViewer/ParcelsAscendRelate/MapServer/2",
      `situs_address LIKE '${num} %${h.escapeSql(name)}%'`, "parcel_number,situs_address,situs_city,situs_zip,tax_year,Market_Value_Total,year_built,num_bedrooms,tot_sqf_l_area,landuse_cd_descr", 7000)
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const m = h.s(r.situs_address).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.parcel_number)) return null;
        seen.add(r.parcel_number);
        return { id: r.parcel_number, zip: h.s(r.situs_zip), town: h.s(r.situs_city), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "",
          value: r.Market_Value_Total, year: h.s(r.tax_year), built: r.year_built, beds: r.num_bedrooms, area: r.tot_sqf_l_area, use: h.s(r.landuse_cd_descr) };
      }).filter(Boolean); })
  },
  "40109": {
    name: "Oklahoma County Assessor", source: "Oklahoma County Assessor (public tax parcels, the Assessor's own parcel viewer)",
    sourceUrl: "https://www.oklahomacounty.org/236/Assessor",
    valueLabel: "current market value", idLabel: "account",
    note: "The assessed value (at most 11% of market for homes in Oklahoma) is not shown; a sale is shown only when the Assessor marked it Valid.",
    find: ({ num, name, h }) => arcQuery(h, "https://services8.arcgis.com/euhkr1dAJeQBIjV0/arcgis/rest/services/TaxParcelsPublics_view/FeatureServer/0",
      `location LIKE '${num} %${h.escapeSql(name)}%'`, "accountno,location,locationcity,accttype,currentmarket,SalePrice,RecordedDate,SalesValidity", 7000)
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const town = h.s(r.locationcity).toUpperCase();
        let a = h.s(r.location).toUpperCase().replace(/\s+/g, " ").trim();
        if (town && a.endsWith(" " + town)) a = a.slice(0, -town.length - 1);
        const m = a.match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.accountno)) return null;
        seen.add(r.accountno);
        const sale = h.s(r.SalesValidity) === "Valid" && Number(r.SalePrice) > 1000 && /^\d{4}-\d{2}-\d{2}/.test(h.s(r.RecordedDate))
          ? { price: Number(r.SalePrice), date: h.s(r.RecordedDate).slice(0, 10), label: "Assessor sales validity: Valid" } : null;
        return { id: h.s(r.accountno), zip: "", town: town === "UNINCORPORATED" ? "" : town, dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.currentmarket, use: h.s(r.accttype), sale };
      }).filter(Boolean); })
  },
  "45045": {
    name: "Greenville County (City of Greenville GIS)", source: "Greenville County, SC parcel records as published by the City of Greenville GIS (AddressSearch/Property)",
    sourceUrl: "https://www.greenvillecounty.org/RealProperty/",
    valueLabel: "fair market value", idLabel: "parcel",
    note: "This layer covers the Greenville city area only; its sale prices carry no validity code and are not shown.",
    spatial: true,
    // situs = STRNUM + LOCATE (street name without type); STREET/CITY/ZIP5 are the mailing address
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://citygis.greenvillesc.gov/arcgis/rest/services/AddressSearch/Property/MapServer/3",
      `STRNUM = '${num}'`, "PIN,STRNUM,LOCATE,FAIRMKTVAL,SQFEET,BEDROOMS,BATHRMS", geo, 500, 7000)
      .then((rs) => { const seen = new Set(); return rs.filter((r) => h.s(r.LOCATE).toUpperCase() === name && !seen.has(r.PIN) && seen.add(r.PIN))
        .map((r) => ({ id: h.s(r.PIN), zip: "", town: "", dir: "", type: "", unit: "", value: r.FAIRMKTVAL, area: r.SQFEET, beds: r.BEDROOMS, baths: r.BATHRMS })); })
  },
  "47149": {
    name: "Rutherford County Assessor of Property", source: "Rutherford County, Tennessee — county GIS ParcelsCAMA (Assessor of Property records)",
    sourceUrl: "https://rutherfordcountytn.gov/",
    valueLabel: "appraised value (land + building + yard items)",
    note: "The layer carries these values on the 2027 record year (the assessor's working roll), shown as published. The assessed value (25% for homes) is not shown; sale prices carry no validity code and are not shown.",
    find: ({ num, name, h }) => arcQuery(h, "https://services.arcgis.com/36I6IHIdr660pAyH/arcgis/rest/services/ParcelsCAMA1/FeatureServer/0",
      `STREETNO = '${num}' AND FormattedLocation LIKE '${num} %${h.escapeSql(name)}%'`, "GISLINK,FormattedLocation,UNIT,LocationCity,LocationZip,TotalValue,AccountType")
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const m = h.s(r.FormattedLocation).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.GISLINK)) return null;
        seen.add(r.GISLINK);
        return { id: h.s(r.GISLINK), zip: h.s(r.LocationZip), town: h.s(r.LocationCity), dir: st.dir, type: st.type, post: st.post, unit: m[3] || h.s(r.UNIT), value: r.TotalValue, use: h.s(r.AccountType).replace(/^\d+\s*-\s*/, "") };
      }).filter(Boolean); })
  },
  "45051": {
    name: "Horry County Assessor", source: "Horry County, SC — county GIS (Address Points → Parcels, Assessor market values)",
    sourceUrl: "https://www.horrycounty.org/Departments/Assessor",
    valueLabel: "market value (land + improvements)", idLabel: "PIN",
    note: "The assessed value (4% of market for an owner-occupied home in South Carolina) is not shown; the layer carries a sale date but no sale price.",
    find: async ({ num, name, h }) => {
      const B = "https://www.horrycounty.org/gisweb/rest/services/Public";
      const ad = await arcQuery(h, `${B}/AddressPoints/MapServer/0`, `StreetNum = ${Number(num)} AND STREETNAME LIKE '${h.escapeSql(name)}%'`, "PIN,STREETNAME,UNIT,ADDRESS,CITY,ZIPCODE");
      const pins = [...new Set(ad.map((a) => Number(a.PIN)).filter(Boolean))].slice(0, 10);
      if (!pins.length) return [];
      const ps = await arcQuery(h, `${B}/Parcels/MapServer/1`, `PIN IN (${pins.join(",")})`, "PIN,MarketProp");
      return ad.map((a) => {
        const st = splitStreet(h.s(a.STREETNAME).toUpperCase());
        const p = ps.find((x) => Number(x.PIN) === Number(a.PIN));
        return st.name === name ? { id: h.s(a.PIN), zip: h.s(a.ZIPCODE), town: h.s(a.CITY), dir: st.dir, type: st.type, post: st.post, unit: h.s(a.UNIT), value: p?.MarketProp } : null;
      }).filter(Boolean);
    }
  },
  "39017": {
    name: "Butler County Auditor", source: "Butler County, Ohio — Auditor parcel records (county GIS, Butler County Engineer's Office)",
    sourceUrl: "https://www.bcohio.gov/auditor",
    valueLabel: "current-year appraised value", note: "The taxable value (35% in Ohio) is not shown; the layer's sale fields are not documented, so sales are not shown.",
    spatial: true,
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://gismaps.bceo.org/server/rest/services/ReadOnly/AccelaMobile/MapServer/3",
      `ADRNO = ${Number(num)} AND ADRSTR = '${h.escapeSql(name)}'`, "PIN,ADRNO,ADRDIR,ADRSTR,ADRSUF,VCurYr,SFLA,YRBLT", geo, 1000, 7000)
      .then((rs) => { const seen = new Set(); return rs.filter((r) => !seen.has(r.PIN) && seen.add(r.PIN))
        .map((r) => ({ id: h.s(r.PIN), zip: "", town: "", dir: h.s(r.ADRDIR), type: h.s(r.ADRSUF), unit: "", value: r.VCurYr, area: r.SFLA, built: r.YRBLT })); })
  },
  "08069": {
    name: "Larimer County Assessor", source: "Larimer County, Colorado — Assessor 2025 reappraisal, residential improved parcels (county GIS)",
    sourceUrl: "https://www.larimer.gov/assessor",
    valueLabel: "actual value (Colorado assessors value homes at market level)", idLabel: "parcel",
    note: "This layer covers residential improved parcels only; its sale prices carry no validity code and are not shown.",
    find: ({ num, name, h }) => arcQuery(h, "https://services.arcgis.com/4Y5FNypV9g2Wgf92/arcgis/rest/services/ResImps_ValChange_2025_Final/FeatureServer/0",
      `LOCADDRESS LIKE '${num} %${h.escapeSql(name)}%'`, "PARCELNUM,LOCADDRESS,LOCCITY,ACTUAL2025,YRBLT,SF")
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const m = h.s(r.LOCADDRESS).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.PARCELNUM)) return null;
        seen.add(r.PARCELNUM);
        return { id: h.s(r.PARCELNUM), zip: "", town: h.s(r.LOCCITY), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.ACTUAL2025, year: "2025", area: r.SF, built: r.YRBLT };
      }).filter(Boolean); })
  },
  "39085": {
    name: "Lake County Auditor", source: "Lake County, Ohio — Auditor parcel records (county GIS Parcels)",
    sourceUrl: "https://www.lakecountyohio.gov/auditor/",
    valueLabel: "appraised value (land + building)", note: "The taxable value (35% in Ohio) is not shown; the layer's sale prices carry no validity code.",
    find: ({ num, name, h }) => arcQuery(h, "https://gis.lakecountyohio.gov/arcgis/rest/services/GIS/GIS_Parcels_Publish/FeatureServer/0",
      `A_HOUSENO = '${num}' AND A_ST_NAME = '${h.escapeSql(name)}'`, "PIN,A_HOUSENO,A_UNITNUM,A_ST_PREFIX,A_ST_NAME,A_ST_TYPE,A_ST_SUFFIX,A_USPS_CITY,A_ZIPCODE,A_VAL_TOTAL,A_YEAR_BUILT")
      .then((rs) => { const seen = new Set(); return rs.filter((r) => !seen.has(r.PIN) && seen.add(r.PIN)).map((r) => ({ id: h.s(r.PIN), zip: h.s(r.A_ZIPCODE), town: h.s(r.A_USPS_CITY),
        dir: h.s(r.A_ST_PREFIX), type: h.s(r.A_ST_TYPE), post: h.s(r.A_ST_SUFFIX), unit: h.s(r.A_UNITNUM), value: r.A_VAL_TOTAL, built: r.A_YEAR_BUILT })); })
  },
  "39099": {
    name: "Mahoning County Auditor", source: "Mahoning County, Ohio — Auditor parcel records (county GIS, public cadastral service)",
    sourceUrl: "https://www.mahoningcountyoh.gov/150/Auditor",
    valueLabel: "market value (land + improvements)", note: "The taxable value (35% in Ohio) is not shown; a value is shown only when land + improvements equal the total (agricultural-use parcels differ).",
    spatial: true,
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://gisapp.mahoningcountyoh.gov/arcgis/rest/services/PUBLIC_WEBSITE_CADASTRAL/MapServer/2",
      `LOCNUM = '${num}'`, "PARCEL_ID,LOCNUM,LOCPREF,LOCSTREET,LOCSUFFIX,MARKETLAND,MARKETIMPR,TOTALMARKET", geo, 1000, 7000)
      .then((rs) => { const seen = new Set(); return rs.filter((r) => h.s(r.LOCSTREET).toUpperCase() === name && !seen.has(r.PARCEL_ID) && seen.add(r.PARCEL_ID)).map((r) => {
        const land = Number(r.MARKETLAND) || 0, imp = Number(r.MARKETIMPR) || 0, tot = Number(r.TOTALMARKET) || 0;
        return { id: h.s(r.PARCEL_ID), zip: "", town: "", dir: h.s(r.LOCPREF), type: h.s(r.LOCSUFFIX), unit: "", value: tot && Math.abs(land + imp - tot) < 1 ? tot : null };
      }); })
  },
  "04015": {
    name: "Mohave County Assessor", source: "Mohave County, Arizona — Assessor parcel records (county GIS PARCELS)",
    sourceUrl: "https://www.mohave.gov/departments/assessor/",
    valueLabel: "full cash value (Arizona's market-based value)", idLabel: "parcel",
    note: "Arizona sets values a year ahead, so the tax year shown can be next year. The limited (capped) value used for taxes is not shown; sale prices carry no validity code.",
    find: ({ num, name, h }) => arcQuery(h, "https://mcgis.mohave.gov/arcgis/rest/services/PARCELS/MapServer/3",
      `SITE_ADDRESS LIKE '${num} %${h.escapeSql(name)}%'`, "TAXPIN,PARCEL,TAX_YEAR,SITE_ADDRESS,CITY,ZIP,FULL_CASH_VALUE", 7000)
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const m = h.s(r.SITE_ADDRESS).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#|SPC)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        const id = h.s(r.TAXPIN || r.PARCEL);
        if (!st || m[1] !== num || st.name !== name || seen.has(id)) return null;
        seen.add(id);
        return { id, zip: h.s(r.ZIP), town: h.s(r.CITY), dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.FULL_CASH_VALUE, year: h.s(r.TAX_YEAR) };
      }).filter(Boolean); })
  },
  "02020": {
    name: "Municipality of Anchorage Assessor", source: "Municipality of Anchorage — Property Appraisal (PropertyInformation, municipal open data)",
    sourceUrl: "https://www.muni.org/Departments/finance/property_appraisal/",
    valueLabel: "appraised value (land + building)", idLabel: "parcel",
    note: "Alaska publishes no sale prices (non-disclosure), so no sale is shown.",
    find: ({ num, name, h }) => arcQuery(h, "https://services2.arcgis.com/Ce3DhLRthdwbHlfF/arcgis/rest/services/PropertyInformation_Hosted/FeatureServer/0",
      `GIS_Site_Street_Number = '${num}' AND GIS_Site_Street_Name = '${h.escapeSql(name)}'`,
      "Parcel_ID,Appraisal_Year,Condo_Unit_Number,Appraised_Total_Value,YearBuilt,GIS_Site_Street_Pre,GIS_Site_Street_Type,GIS_Site_Street_Suf,GIS_Site_City,GIS_Site_Zipcode")
      .then((rs) => { const seen = new Set(); return rs.filter((r) => !seen.has(r.Parcel_ID) && seen.add(r.Parcel_ID)).map((r) => ({ id: h.s(r.Parcel_ID), zip: h.s(r.GIS_Site_Zipcode), town: h.s(r.GIS_Site_City),
        dir: h.s(r.GIS_Site_Street_Pre), type: h.s(r.GIS_Site_Street_Type), post: h.s(r.GIS_Site_Street_Suf), unit: h.s(r.Condo_Unit_Number), value: r.Appraised_Total_Value, year: h.s(r.Appraisal_Year), built: Number(r.YearBuilt) || null })); })
  },
  "29077": {
    name: "Greene County Assessor", source: "Greene County, Missouri — Assessor (county iasWorld parcel service)",
    sourceUrl: "https://greenecountymo.gov/assessor/",
    valueLabel: "market value (land + improvements)", idLabel: "parcel",
    note: "Missouri assesses homes at 19% of market value (not shown); the county publishes no sale prices.",
    spatial: true,
    // L_ADR* = the property's location (ADR* is the mailing address)
    // this 10.4 server ignores spatial filters: a parcel counts when its city
    // is the geocoded town or "GREENE COUNTY" (unincorporated); two candidates
    // left → "several parcels", never a guess
    find: ({ num, name, h, geo }) => arcQuery(h, "https://greenecountyassessor.org/arcgis/rest/services/IasWorldParcel_LatLong/MapServer/0",
      `L_ADRNO = ${Number(num)} AND L_ADRSTR = '${h.escapeSql(name)}'`, "PIN,L_ADRNO,L_ADRDIR,L_ADRSTR,L_ADRSUF,L_CITYNAME,RESLAND,RESBLDG,AGLAND,AGBLDG,COMLAND,COMBLDG,YRBLT,SFLA", 7000)
      .then((rs) => { const seen = new Set(), town = h.s(geo?.city).toUpperCase().replace(/\s+(CITY|CDP|TOWN|VILLAGE)$/, "");
        return rs.filter((r) => [town, "GREENE COUNTY"].includes(h.s(r.L_CITYNAME).toUpperCase()) && !seen.has(r.PIN) && seen.add(r.PIN)).map((r) => ({ id: h.s(r.PIN), zip: "", town: "", dir: h.s(r.L_ADRDIR), type: h.s(r.L_ADRSUF), unit: "",
        value: ["RESLAND", "RESBLDG", "AGLAND", "AGBLDG", "COMLAND", "COMBLDG"].reduce((t, k) => t + (Number(r[k]) || 0), 0) || null, built: r.YRBLT, area: r.SFLA })); })
  },
  "39045": {
    name: "Fairfield County Auditor", source: "Fairfield County, Ohio — Auditor parcel records (county GIS open data)",
    sourceUrl: "https://www.co.fairfield.oh.us/auditor/",
    valueLabel: "appraised value (land + building)", note: "The taxable value (35% in Ohio) is not shown; sale types are not documented, so sales are not shown.",
    spatial: true,
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://gis.co.fairfield.oh.us/arcgis/rest/services/OpenData/ParcelBoundaries/MapServer/0",
      `ADRNO = ${Number(num)} AND ADRSTR = '${h.escapeSql(name)}'`, "PIN,ADRNO,ADRDIR,ADRSTR,ADRSUF,ADRSUF2,APPRVAL,SFLA,YRBLT", geo, 1000, 7000)
      .then((rs) => { const seen = new Set(); return rs.filter((r) => !seen.has(r.PIN) && seen.add(r.PIN)).map((r) => ({ id: h.s(r.PIN), zip: "", town: "",
        dir: h.s(r.ADRDIR), type: h.s(r.ADRSUF), post: h.s(r.ADRSUF2), unit: "", value: r.APPRVAL, area: r.SFLA, built: r.YRBLT })); })
  },
  "04003": {
    name: "Cochise County Assessor", source: "Cochise County, Arizona — Assessor parcel tax information (Cochise County GIS)",
    sourceUrl: "https://www.cochise.az.gov/assessor",
    valueLabel: "full cash value (Arizona's market-based value)", idLabel: "parcel",
    note: "Arizona sets values a year ahead, so the tax year shown can be next year. The limited (capped) value used for taxes is not shown.",
    spatial: true,
    // city/state/zip in this layer belong to the mailing address → location match
    find: ({ num, name, h, geo }) => arcQueryBox(h, "https://services6.arcgis.com/Yxem0VOcqSy8T6TE/arcgis/rest/services/Cad_Parcel_TaxInfo/FeatureServer/0",
      `situs_address LIKE '${num} %'`, "apn,tax_year,situs_address,fcv", geo, 1000, 7000)
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const m = h.s(r.situs_address).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#|SPC)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.apn)) return null;
        seen.add(r.apn);
        return { id: h.s(r.apn), zip: "", town: "", dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.fcv, year: h.s(r.tax_year) };
      }).filter(Boolean); })
  },
  "45085": {
    name: "Sumter County Assessor", source: "Sumter County, South Carolina — parcel records (Sumter City-County GIS)",
    sourceUrl: "https://www.sumtercountysc.org/assessor",
    valueLabel: "market value (land + building + site improvements)", idLabel: "parcel",
    note: "The assessed value (4% of market for an owner-occupied home in South Carolina) is not shown; the layer has no sale prices.",
    spatial: true,
    find: ({ num, name, h, geo }) => arcQueryNear(h, "https://gis.sumter-sc.com/server/rest/services/BaseMaps/Sumter_City_County/MapServer/7",
      `parcel_address_one LIKE '${num} %'`, "parid,parcel_address_one,market_value_total", geo, 1000, 7000)
      .then((rs) => { const seen = new Set(); return rs.map((r) => {
        const m = h.s(r.parcel_address_one).toUpperCase().replace(/\s+/g, " ").trim().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.parid)) return null;
        seen.add(r.parid);
        return { id: h.s(r.parid), zip: "", town: "", dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: r.market_value_total };
      }).filter(Boolean); })
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
