/* PRADIXIUM™ — Portland metro, Oregon side: Multnomah (41051), Washington
 * (41067) and Clackamas (41005) counties — Oregon Metro RLIS "Taxlots
 * (Public)", compiled quarterly by Metro from the three county assessors.
 * Shown: the assessor's Real Market Value (RLIS: "Total Real Market Value
 * (LANDVAL + BLDGVAL)" — Government Value, display only), the Measure 50
 * assessed value that property tax is based on, year built and building
 * sq ft (RLIS: "square footage of building(s)" — not defined as living
 * area, so text only).
 * Not shown: SALEPRICE — RLIS defines it only as "price of the most recent
 * sale", with no arm's-length screening, so it is not presented as a sale.
 */
const URL = "https://services2.arcgis.com/McQ0OlIABe29rJJy/arcgis/rest/services/Taxlots_%28Public%29/FeatureServer/3/query";
const SOURCE = "Oregon Metro RLIS — county assessor tax lots (Multnomah, Washington, Clackamas)";
const SOURCE_URL = "https://rlisdiscovery.oregonmetro.gov/datasets/drcMetro::taxlots-public/about";
const COUNTY = { M: "Multnomah County", W: "Washington County", C: "Clackamas County" };
const USE = { SFR: "single-family", MFR: "multi-family", COM: "commercial", IND: "industrial", VAC: "vacant", AGR: "agricultural", FOR: "forest", RUR: "rural" };

export function matches(geo) {
  return ["41051", "41067", "41005"].includes(String(geo?.countyFips || ""));
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `SITEADDR LIKE '${h.escapeSql(`${a.number} ${a.street}`)}%' AND SITEZIP LIKE '${z.zip}%'`,
    outFields: "TLID,SITEADDR,BLDGSQFT,YEARBUILT,LANDUSE,TOTALVAL,ASSESSVAL,COUNTY",
    returnGeometry: "false", f: "json"
  }), 7000).catch(() => null);
  const line = `${a.number} ${a.street}`;
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const s = h.s(r.SITEADDR).toUpperCase(); return s === line || s.startsWith(line + " "); });
  const unit = h.unitFromAddress(address);
  const rest = (r) => h.s(r.SITEADDR).toUpperCase().slice(line.length).trim().replace(/^(UNIT|APT|#)\s*/i, "");
  if (unit) rows = rows.filter((r) => h.unitKey(rest(r)) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !rest(r));
  if (rows.length !== 1) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Oregon Metro RLIS: several tax lots at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;

  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const rmv = Number(r.TOTALVAL) > 0 ? Number(r.TOTALVAL) : null, av = Number(r.ASSESSVAL) > 0 ? Number(r.ASSESSVAL) : null;
  const yb = Number(r.YEARBUILT) > 0 ? Number(r.YEARBUILT) : null;
  const county = COUNTY[h.s(r.COUNTY)] || "County";
  const facts = [USE[h.s(r.LANDUSE)], Number(r.BLDGSQFT) > 0 && `${Number(r.BLDGSQFT).toLocaleString("en-US")} sq ft of building(s)`, yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `${county} Assessor tax lot ${h.s(r.TLID).replace(/\s+/g, "")}${facts ? ` (${facts})` : ""}${rmv ? `: real market value ${usd(rmv)}` : ""}${av ? `; assessed value for property tax ${usd(av)} (Oregon Measure 50 limits growth of assessed value to 3% a year)` : ""} — via Oregon Metro RLIS. Sales are not shown: RLIS carries only the latest recorded price, not screened for arm's-length sales.`,
    lastSale: null, benchmark: null,
    governmentValue: rmv ? { value: rmv, asOf: null, label: `${county} Assessor real market value` } : null,
    location: null,
    property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
