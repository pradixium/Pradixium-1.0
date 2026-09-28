/* PRADIXIUM™ — Columbus core: Franklin County, OH (FIPS 39049) — Franklin
 * County Auditor GIS (gis.franklincountyohio.gov)
 *  - ParcelFeatures/Parcel_Features "Tax Parcel": current base total value
 *    (Government Value, display only), above-grade residential floor area
 *    (living area), beds, baths, year built, and the parcel's latest sale
 *    (its VALID flag is empty — unscreened)
 *  - RealEstate/Sales_Information "Sales Details": sales with the Auditor's
 *    own ValidSale Y/N flag — published for Jan 2023 to Jul 2025 only
 * Shown: the last sale only when it is the parcel's latest sale AND the
 * Auditor flagged it valid; ZIP context from valid single-parcel sales of
 * the same class in the file's last 12 months — with its period, context
 * only (the flagged file stops in Jul 2025), never the verdict.
 */
const B = "https://gis.franklincountyohio.gov/hosting/rest/services/";
const PARCELS = B + "ParcelFeatures/Parcel_Features/MapServer/0/query";
const SALES = B + "RealEstate/Sales_Information/MapServer/0/query";
const SOURCE = "Franklin County Auditor (Franklin County GIS)";
const SOURCE_URL = "https://www.franklincountyauditor.com/";
const CLASS = { "510": "one-family homes", "550": "condominium units" };

export function matches(geo) {
  return String(geo?.countyFips || "") === "39049";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const q = (url, params, ms = 6000) => h.json(url + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const d = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null);

  const j = await q(PARCELS, { where: `SITEADDRESS LIKE '${h.escapeSql(`${a.number} ${a.street.split(/\s+/).slice(0, -1).join(" ") || a.street}`)}%' AND ZIPCD='${z.zip}'`, outFields: "PARCELID,SITEADDRESS,UNIT,CLASSCD,CLASSDSCRP,TOTVALUEBASE,RESFLRAREA_AG,RESYRBLT,BEDRMS,BATHS,HBATHS,SALEDATE,SALEPRICE" });
  const pre = `${a.number} ${a.street.split(/\s+/).slice(0, -1).join(" ") || a.street}`;
  // Census "AVE"/"WAY" vs Auditor "AV"/"WY": compare on number + street name only
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const s = h.s(r.SITEADDRESS).toUpperCase(); return s === `${a.number} ${a.street}` || s === pre || s.startsWith(pre + " "); });
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.UNIT) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.UNIT));
  const r = rows.length === 1 ? rows[0] : null;

  const cls = r ? h.s(r.CLASSCD) : null;
  const typeCls = cls && CLASS[cls] ? cls : null;
  const [vs, ctx] = await Promise.all([
    r ? q(SALES, { where: `PARCELID='${h.escapeSql(r.PARCELID)}' AND ValidSale='Y' AND SalePrice>0`, outFields: "SALEDATE,SalePrice,ParcelCount", orderByFields: "SALEDATE DESC", resultRecordCount: "1" }) : null,
    typeCls ? q(SALES, { where: `ZIPCD='${z.zip}' AND CLASSCD='${typeCls}' AND ValidSale='Y' AND ParcelCount=1 AND SalePrice>0 AND SALEDATE>=DATE '2024-07-17'`, outFields: "SalePrice,RESFLRAREA_AG,SALEDATE", resultRecordCount: "4000" }, 7000) : null
  ]);

  const v0 = vs?.features?.[0]?.attributes;
  const latest = r ? d(r.SALEDATE) : null;
  const lastSale = v0 && Number(v0.ParcelCount) === 1 && d(v0.SALEDATE) && d(v0.SALEDATE) === latest ? { price: Number(v0.SalePrice), date: d(v0.SALEDATE), source: `${SOURCE} — sale flagged valid by the Auditor` } : null;
  const list = (ctx?.features || []).map((f) => f.attributes);
  const med = (xs) => { const v = [...xs].sort((x, y) => x - y), m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const withArea = list.filter((x) => Number(x.RESFLRAREA_AG) > 0);
  const dates = list.map((x) => d(x.SALEDATE)).filter(Boolean).sort();

  const parts = [];
  if (r) {
    const value = Number(r.TOTVALUEBASE) > 0 ? Number(r.TOTVALUEBASE) : null;
    const la = Number(r.RESFLRAREA_AG) > 0 ? Number(r.RESFLRAREA_AG) : null;
    const ba = Number(r.BATHS) > 0 ? Number(r.BATHS) + (Number(r.HBATHS) > 0 ? 0.5 * Number(r.HBATHS) : 0) : null;
    const facts = [h.s(r.CLASSDSCRP).toLowerCase(), la && `${la.toLocaleString("en-US")} sq ft above grade`, Number(r.BEDRMS) > 0 && `${r.BEDRMS} bd`, ba && `${ba} ba`, Number(r.RESYRBLT) > 0 && `built ${r.RESYRBLT}`].filter(Boolean).join(", ");
    const saleText = lastSale ? `last sale ${usd(lastSale.price)} on ${lastSale.date}, flagged valid by the Auditor`
      : latest && Number(r.SALEPRICE) > 0 ? `latest sale on record (${latest}) has no Auditor validity flag, so it is not shown as a market sale`
      : "no sale on record";
    parts.push(`Franklin County Auditor parcel ${h.s(r.PARCELID)}${facts ? ` (${facts})` : ""}: ${saleText}${value ? `; appraised value ${usd(value)}` : ""}.`);
    if (list.length >= 10) parts.push(`Franklin County Auditor: ${list.length} valid sales of ${CLASS[typeCls]} in ZIP ${z.zip} (${dates[0]} to ${dates[dates.length - 1]}, the latest period the Auditor's validated sales file covers), median price ${usd(med(list.map((x) => Number(x.SalePrice))))}${withArea.length >= 10 ? `, median ${usd(med(withArea.map((x) => Number(x.SalePrice) / Number(x.RESFLRAREA_AG))))} per sq ft above grade` : ""} — context only; not used in the verdict.`);
    return {
      source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "),
      lastSale, benchmark: null,
      governmentValue: value ? { value, asOf: null, label: "Franklin County Auditor appraised value" } : null,
      location: null,
      property: { livingAreaSqFt: la, yearBuilt: Number(r.RESYRBLT) > 0 ? Number(r.RESYRBLT) : null, bedrooms: Number(r.BEDRMS) > 0 ? Number(r.BEDRMS) : null, bathrooms: ba },
      checks: [], hasRecord: true
    };
  }
  return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Franklin County Auditor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
}
