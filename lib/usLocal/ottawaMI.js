/* PRADIXIUM™ — Ottawa County, MI (FIPS 26139; Holland / Grand Haven) —
 * Ottawa County Geospatial Insights & Solutions:
 *  - "Ottawa County Parcels (Public)" (gis.miottawa.org): assessed value,
 *    structured situs address
 *  - "Ottawa County Arms Length Sales": the county's sales coded with the
 *    Michigan terms-of-sale code "03-ARM'S LENGTH" (since 2004)
 * Shown: true cash value = 2 × assessed value (Michigan assesses at 50% of
 * true cash value, MCL 211.27a) as Government Value, labelled as derived;
 * the address's last arm's-length single-parcel sale; ZIP BENCHMARK (Oct
 * 2026, same standard as Detroit's "03-ARM'S LENGTH") = median price of
 * arm's-length improved residential single-parcel sales of the same kind
 * (the layer's iscondo flag: condo vs other homes), last 12 months, 10+
 * sales; a liber/page on several rows = one multi-parcel deed → dropped.
 * The kind comes from the parcel's own sales rows; unknown → both medians
 * as context, none applied. Owner / grantor / grantee never requested.
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
    arcQuery(h, SALES, `PropertyZip='${z.zip}' AND terms='03-ARM''S LENGTH' AND otherparcelsinsaleflag=0 AND PropertyClassDescription='RESIDENTIAL-IMPROVED' AND saleprice>1000 AND saledate >= DATE '${since}'`, "saleprice,saledate,iscondo,liberpage", 6000)
  ]);
  let rows = ps.filter((p) => {
    const s = splitStreet(`${h.s(p.StreetName)} ${h.s(p.StreetSuffix)}`.toUpperCase());
    return s.name === st.name && (!st.dir || !h.s(p.AddressDir) || h.s(p.AddressDir).toUpperCase() === st.dir) && (!st.type || !s.type || s.type === st.type) && (h.s(p.PropertyZip).slice(0, 5) === z.zip || h.s(p.PropertyCity).toUpperCase() === h.s(geo?.city).toUpperCase());
  });
  const unit = h.unitFromAddress(address), found = rows.length;
  if (unit) rows = rows.filter((p) => h.unitKey(p.UnitOrApt) === unit);
  else if (rows.length > 1) rows = rows.filter((p) => !h.s(p.UnitOrApt));
  const parts = [];
  let gov = null, lastSale = null, p = null, condo = null;
  if (rows.length === 1) {
    p = rows[0];
    const av = Number(p.AssessedValue) > 0 ? Number(p.AssessedValue) : null;
    const sales = await arcQuery(h, SALES, `FinalPIN='${h.escapeSql(h.s(p.FinalPIN))}'`, "saleprice,saledate,terms,otherparcelsinsaleflag,iscondo", 5000);
    const k = sales.map((x) => h.s(x.iscondo).toUpperCase()).find((x) => x === "TRUE" || x === "FALSE");
    if (k) condo = k === "TRUE";
    const last = sales.filter((s) => Number.isFinite(s.saledate)).sort((x, y) => y.saledate - x.saledate)[0];
    if (last && Number(last.otherparcelsinsaleflag) === 0 && Number(last.saleprice) > 1000) lastSale = { price: Number(last.saleprice), date: new Date(last.saledate).toISOString().slice(0, 10), source: `${SOURCE} — terms code 03, arm's length` };
    parts.push(`Ottawa County parcel ${h.s(p.FinalPIN)} (${h.s(p.PropertyClassDescription).toLowerCase()}): ${lastSale ? `last arm's-length sale ${usd(lastSale.price)} on ${lastSale.date}` : "no arm's-length single-parcel sale in the county's sales file"}${av ? `; assessed value ${usd(av)}, i.e. true cash value ${usd(2 * av)} (Michigan assesses at 50%)` : ""}.`);
    if (av) gov = { value: 2 * av, asOf: null, label: "Ottawa County true cash value (2 × assessed value; Michigan assesses at 50%)" };
  } else if (rows.length > 1 || (!unit && found > 1)) parts.push("Ottawa County: several parcels at this address — add the unit number.");
  const lp = new Map();
  for (const x of ctx) { const k = h.s(x.liberpage); if (k) lp.set(k, (lp.get(k) || 0) + 1); }
  const single = ctx.filter((x) => !h.s(x.liberpage) || lp.get(h.s(x.liberpage)) === 1);
  const group = (isCondo) => {
    const g = single.filter((x) => (h.s(x.iscondo).toUpperCase() === "TRUE") === isCondo);
    if (g.length < 10) return null;
    const v = g.map((x) => Number(x.saleprice)).sort((a, b) => a - b), m = Math.floor(v.length / 2);
    const d = g.map((x) => x.saledate).filter(Number.isFinite).sort((a, b) => a - b).map((t) => new Date(t).toISOString().slice(0, 10));
    return { n: v.length, median: v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2, from: d[0], to: d[d.length - 1], label: isCondo ? "condominium units" : "homes other than condominiums" };
  };
  let areaMedianPrice = null;
  const gs = condo === null ? [group(false), group(true)].filter(Boolean) : [group(condo)].filter(Boolean);
  for (const g of gs) {
    const bench = condo !== null;
    parts.push(`ZIP ${z.zip}: ${g.n} arm's-length single-parcel sales of improved residential ${g.label} (${g.from} to ${g.to}), median ${usd(g.median)} — ${bench ? "the benchmark: a whole-home median, not adjusted for size" : "context only (the parcel's own kind is not in the county's sales file)"}.`);
    if (bench) areaMedianPrice = { value: g.median, sales: g.n, area: `ZIP ${z.zip}`, typeLabel: `improved residential ${g.label}`, periodFrom: g.from, periodTo: g.to, source: `${SOURCE} — terms code 03, arm's length`, sourceUrl: SOURCE_URL };
  }
  if (!parts.length) return null;
  return { source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "), lastSale, benchmark: null, governmentValue: gov, areaMedianPrice, location: null, property: null, checks: [], hasRecord: Boolean(p) };
}
