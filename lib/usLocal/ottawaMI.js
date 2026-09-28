/* PRADIXIUM™ — Ottawa County, MI (FIPS 26139; Holland / Grand Haven) —
 * Ottawa County Geospatial Insights & Solutions:
 *  - "Ottawa County Parcels (Public)" (gis.miottawa.org): assessed value,
 *    structured situs address
 *  - "Ottawa County Arms Length Sales": the county's sales coded with the
 *    Michigan terms-of-sale code "03-ARM'S LENGTH" (since 2004)
 * Shown: true cash value = 2 × assessed value (Michigan assesses at 50% of
 * true cash value, MCL 211.27a) as Government Value, labelled as derived;
 * the address's last arm's-length single-parcel sale; ZIP context = count
 * and median of arm's-length improved residential single-parcel sales in
 * the last 12 months (context only, never the verdict). Owner names never
 * requested.
 */
import { arcQuery, splitStreet } from "./_structured.js";

const PARCELS = "https://gis.miottawa.org/arcgis/rest/services/HostedServices/ParcelsPublic/FeatureServer/0";
const SALES = "https://services2.arcgis.com/ixRLoNIl4gmM9jgg/arcgis/rest/services/Ottawa_County_Arms_Length_Sales/FeatureServer/0";
const SOURCE = "Ottawa County, Michigan — Equalization parcels + arm's-length sales (county GIS)";
const SOURCE_URL = "https://www.miottawa.org/equalization/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "26139";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const st = splitStreet(a.street);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const [ps, ctx] = await Promise.all([
    arcQuery(h, PARCELS, `AddressNumber=${Number(a.number)} AND UPPER(StreetName) LIKE '${h.escapeSql(st.name)}%'`, "FinalPIN,AddressDir,StreetName,StreetSuffix,UnitOrApt,PropertyAddress,PropertyCity,PropertyZip,AssessedValue,PropertyClassDescription", 6000),
    arcQuery(h, SALES, `PropertyZip='${z.zip}' AND terms='03-ARM''S LENGTH' AND otherparcelsinsaleflag=0 AND PropertyClassDescription='RESIDENTIAL-IMPROVED' AND saleprice>1000 AND saledate >= DATE '${since}'`, "saleprice,saledate", 6000)
  ]);
  let rows = ps.filter((p) => {
    const s = splitStreet(`${h.s(p.StreetName)} ${h.s(p.StreetSuffix)}`.toUpperCase());
    return s.name === st.name && (!st.dir || !h.s(p.AddressDir) || h.s(p.AddressDir).toUpperCase() === st.dir) && (!st.type || !s.type || s.type === st.type) && (h.s(p.PropertyZip).slice(0, 5) === z.zip || h.s(p.PropertyCity).toUpperCase() === h.s(geo?.city).toUpperCase());
  });
  const unit = h.unitFromAddress(address), found = rows.length;
  if (unit) rows = rows.filter((p) => h.unitKey(p.UnitOrApt) === unit);
  else if (rows.length > 1) rows = rows.filter((p) => !h.s(p.UnitOrApt));
  const parts = [];
  let gov = null, lastSale = null, p = null;
  if (rows.length === 1) {
    p = rows[0];
    const av = Number(p.AssessedValue) > 0 ? Number(p.AssessedValue) : null;
    const sales = await arcQuery(h, SALES, `FinalPIN='${h.escapeSql(h.s(p.FinalPIN))}'`, "saleprice,saledate,terms,otherparcelsinsaleflag", 5000);
    const last = sales.filter((s) => Number.isFinite(s.saledate)).sort((x, y) => y.saledate - x.saledate)[0];
    if (last && Number(last.otherparcelsinsaleflag) === 0 && Number(last.saleprice) > 1000) lastSale = { price: Number(last.saleprice), date: new Date(last.saledate).toISOString().slice(0, 10), source: `${SOURCE} — terms code 03, arm's length` };
    parts.push(`Ottawa County parcel ${h.s(p.FinalPIN)} (${h.s(p.PropertyClassDescription).toLowerCase()}): ${lastSale ? `last arm's-length sale ${usd(lastSale.price)} on ${lastSale.date}` : "no arm's-length single-parcel sale in the county's sales file"}${av ? `; assessed value ${usd(av)}, i.e. true cash value ${usd(2 * av)} (Michigan assesses at 50%)` : ""}.`);
    if (av) gov = { value: 2 * av, asOf: null, label: "Ottawa County true cash value (2 × assessed value; Michigan assesses at 50%)" };
  } else if (rows.length > 1 || (!unit && found > 1)) parts.push("Ottawa County: several parcels at this address — add the unit number.");
  const v = ctx.map((s) => Number(s.saleprice)).sort((x, y) => x - y), m = Math.floor(v.length / 2);
  const dates = ctx.map((s) => s.saledate).filter(Number.isFinite).sort((x, y) => x - y).map((d) => new Date(d).toISOString().slice(0, 10));
  if (v.length >= 10) parts.push(`${v.length} arm's-length sales of improved residential parcels in ZIP ${z.zip} (${dates[0]} to ${dates[dates.length - 1]}), median ${usd(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2)} — whole-property prices, context only; not used in the verdict.`);
  if (!parts.length) return null;
  return { source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "), lastSale, benchmark: null, governmentValue: gov, location: null, property: null, checks: [], hasRecord: Boolean(p) };
}
