/* PRADIXIUM™ — Stark County, OH (FIPS 39151; Canton) — Stark County
 * Auditor GIS:
 *  - "Stark County Parcels": appraised (market) total value with its tax
 *    year, land use, situs address
 *  - "Stark County Sales and Transfers": every transfer with the Auditor's
 *    SALE_VALIDITY code
 * Shown: appraised value as Government Value (display only); the last sale
 * ONLY when the parcel's latest transfer is coded "0-QUALIFIED -
 * ARMSLENGTH" and conveyed this parcel alone. Any other latest transfer
 * (pending, questionable, relatives, auction, bank-owned …) is named, not
 * shown as a market sale.
 * BENCHMARK (Oct 2026): median price of the Auditor's qualified arm's-length
 * single-parcel sales of the parcel's own land use (1-family / condo unit /
 * 2-family) in its ZIP, 12 months, 10+ sales — prebuilt in
 * lib/data/starkSales.js (scripts/build-stark-sales.mjs). 1-family and
 * condo → the whole-home benchmark; 2-family → context.
 */
import { arcQuery, splitStreet } from "./_structured.js";
import { STARK_SALES, STARK_SALES_META } from "../data/starkSales.js";

const TYPE = { "R - 1-FAMILY DWELLING": "1F", "C - CONDOMINIUM RESIDENTIAL UNIT": "CN", "R - 2-FAMILY DWELLING": "2F" };

const B = "https://scgisa.starkcountyohio.gov/arcgis/rest/services/Auditor/";
const SOURCE = "Stark County Auditor (Stark County GIS)";
const SOURCE_URL = "https://www.starkcountyohio.gov/government/offices/auditor/index.php";

export function matches(geo) {
  return String(geo?.countyFips || "") === "39151";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a) return null;
  const st = splitStreet(a.street);
  const ps = await arcQuery(h, B + "StarkCountyParcels/FeatureServer/0", `SITE_ADDRESS1 LIKE '${h.escapeSql(a.number)} %${h.escapeSql(st.name)}%'`, "PIN,TAXYR,SITE_ADDRESS1,SITE_ADDRESS3,LAND_USE_DESCRIPTION,APPRAISED_TOTAL_VALUE", 6000);
  const town = h.s(geo?.city).toUpperCase();
  let rows = ps.filter((p) => {
    const m = h.s(p.SITE_ADDRESS1).toUpperCase().match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
    if (!m || m[1] !== a.number) return false;
    const s = splitStreet(m[2]);
    p._unit = m[3] || "";
    const where = h.s(p.SITE_ADDRESS3).toUpperCase(), pz = where.match(/(\d{5})/)?.[1];
    return s.name === st.name && (!st.dir || !s.dir || s.dir === st.dir) && (!st.type || !s.type || s.type === st.type) && (!st.post || !s.post || s.post === st.post) && ((z && pz === z.zip) || (town && where.startsWith(town + ",")));
  });
  const unit = h.unitFromAddress(address), found = rows.length;
  if (unit) rows = rows.filter((p) => h.unitKey(p._unit) === unit);
  else if (rows.length > 1) rows = rows.filter((p) => !p._unit);
  if (rows.length !== 1) return rows.length > 1 || (!unit && found > 1) ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Stark County Auditor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const p = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const sales = await arcQuery(h, B + "StarkCountySales/MapServer/0", `PARID='${h.escapeSql(h.s(p.PIN))}'`, "TRANSFER_DATE,SALE_PRICE,NUMBER_OF_PARCELS,SALE_VALIDITY", 5000);
  const last = sales.filter((s) => Number.isFinite(s.TRANSFER_DATE)).sort((x, y) => y.TRANSFER_DATE - x.TRANSFER_DATE)[0];
  const date = last ? new Date(last.TRANSFER_DATE).toISOString().slice(0, 10) : null;
  const ok = last && h.s(last.SALE_VALIDITY).startsWith("0-QUALIFIED") && Number(last.NUMBER_OF_PARCELS) === 1 && Number(last.SALE_PRICE) > 0;
  const lastSale = ok ? { price: Number(last.SALE_PRICE), date, source: `${SOURCE} — sale coded qualified, arm's length` } : null;
  const value = Number(p.APPRAISED_TOTAL_VALUE) > 0 ? Number(p.APPRAISED_TOTAL_VALUE) : null, year = p.TAXYR ? String(p.TAXYR) : null;
  const saleText = lastSale ? `last sale ${usd(lastSale.price)} on ${date}, coded qualified arm's-length by the Auditor`
    : last ? `latest transfer (${date}) is coded "${h.s(last.SALE_VALIDITY).replace(/^\w-/, "").toLowerCase() || "not validated"}", so it is not shown as a market sale`
    : "no transfer on record";
  const t = TYPE[h.s(p.LAND_USE_DESCRIPTION)], pzip = h.s(p.SITE_ADDRESS3).match(/(\d{5})/)?.[1];
  const g = t && pzip ? STARK_SALES[`${pzip}|${t}`] : null, label = t ? STARK_SALES_META.types[t] : null;
  const areaText = g ? ` ZIP ${pzip}: ${g.n} qualified arm's-length single-parcel sales of ${label} (${g.from} to ${g.to}), median ${usd(g.median)} — ${t === "2F" ? "context only" : "the benchmark: a whole-home median, not adjusted for size"}.` : "";
  const areaMedianPrice = g && t !== "2F" ? { value: g.median, sales: g.n, area: `ZIP ${pzip}`, typeLabel: label, periodFrom: g.from, periodTo: g.to, source: `${SOURCE} — sales coded 0-QUALIFIED ARMSLENGTH`, sourceUrl: SOURCE_URL } : null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Stark County Auditor parcel ${h.s(p.PIN)} (${h.s(p.LAND_USE_DESCRIPTION).replace(/^\w+ - /, "").toLowerCase()}): ${saleText}${value ? `; tax year ${year} appraised value ${usd(value)}` : ""}.${areaText}`,
    lastSale, benchmark: null, areaMedianPrice,
    governmentValue: value ? { value, asOf: year, label: `Stark County Auditor appraised value (tax year ${year})` } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
