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
 */
import { arcQuery, splitStreet, structuredEvidence } from "./_structured.js";

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
  }
};

export function matches(geo) {
  return Boolean(COUNTIES[String(geo?.countyFips || "")]);
}

export async function evidence(ctx) {
  return structuredEvidence(COUNTIES[String(ctx.geo.countyFips)], ctx);
}
