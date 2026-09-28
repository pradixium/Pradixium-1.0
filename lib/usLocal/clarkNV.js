/* PRADIXIUM™ — Las Vegas: Clark County, NV (FIPS 32003) — Clark County
 * Assessor data on the county GIS (maps.clarkcountynv.gov, GISMO):
 *  - AOEXT_V (Assessor roll extract): parcel, land use, construction year,
 *    the latest recorded sale price, month and document number
 *  - Sales_view (Assessor's sales view, last 18 months): the sale code
 * A sale is shown only when the Assessor coded it "R" — "Recorded Value …
 * normally an 'R' code indicates the best type of arms-length
 * transactions" (Clark County Assessor, Sales Codes). Every other code
 * (foreclosure resale F, trustee's deed T, multi-parcel M, declared or
 * Assessor's value A/D, miscellaneous B, and the undefined "UR") is left
 * out. The GIS extract carries no valuation, so there is no Government Value.
 */
const B = "https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/";
const ROLL = B + "Address/MapServer/2/query";
const SALES = B + "Sales_view/MapServer/0/query";
const SOURCE = "Clark County Assessor (Clark County GIS)";
const SOURCE_URL = "https://www.clarkcountynv.gov/government/assessor/";
const DIRS = new Set(["N", "S", "E", "W"]);
const TYPES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "LOOP", "TER", "HWY", "SQ", "PT", "RUN", "PATH", "ROW", "CV", "PLZ", "RDG", "XING", "PASS"]);

export function matches(geo) {
  return String(geo?.countyFips || "") === "32003";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const w = a.street.split(/\s+/);
  const dir = DIRS.has(w[0]) && w.length > 1 ? w.shift() : "";
  const type = w.length > 1 && TYPES.has(w[w.length - 1]) ? w.pop() : "";
  const name = w.join(" ");
  const q = (url, params) => h.json(url + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), 6000).catch(() => null);
  const j = await q(ROLL, { where: `strno=${Number(a.number)} AND strname='${h.escapeSql(name)}'`, outFields: "APN,strdir,strtype,strunit,City,landuse,CONSTYR,SALEPRICE,SALEDATE,DOCNO" });
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => (!dir || !h.s(r.strdir) || h.s(r.strdir) === dir) && (!type || !h.s(r.strtype) || h.s(r.strtype) === type || h.s(r.strtype) === type.replace(/^AVE$/, "AV")));
  // the same number + street can exist in several towns (Las Vegas, Henderson …):
  // keep the parcel at the geocoded point
  if (rows.length > 1 && Number.isFinite(geo?.latitude) && Number.isFinite(geo?.longitude)) {
    const near = await q(ROLL, { where: `strno=${Number(a.number)} AND strname='${h.escapeSql(name)}'`, outFields: "APN", geometry: `${geo.longitude},${geo.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: "60", units: "esriSRUnit_Meter" });
    const apns = new Set((near?.features || []).map((f) => h.s(f.attributes.APN)));
    if (apns.size) rows = rows.filter((r) => apns.has(h.s(r.APN)));
  }
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.strunit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.strunit));
  if (rows.length !== 1) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: unit || !rows.length || rows.every((x) => !h.s(x.strunit)) ? "Clark County Assessor: more than one parcel carries this address, so none is shown." : "Clark County Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;

  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const s = await q(SALES, { where: `PARCEL='${h.escapeSql(r.APN)}'`, outFields: "saletype,dateGroup" });
  const code = h.s(s?.features?.[0]?.attributes?.saletype).toUpperCase();
  const ym = h.s(r.SALEDATE).match(/^(\d{4})(\d{2})$/);
  const lastSale = code === "R" && Number(r.SALEPRICE) > 0 && ym ? { price: Number(r.SALEPRICE), date: `${ym[1]}-${ym[2]}`, source: `${SOURCE} — recorded sale, Assessor code R (normally arm's length)` } : null;
  const yb = Number(r.CONSTYR) > 0 ? Number(r.CONSTYR) : null;
  const saleText = lastSale ? `last sale ${usd(lastSale.price)} in ${lastSale.date} (Assessor code R — normally arm's length)`
    : code ? `its latest sale carries Assessor code ${code}, not R, so it is not shown as a market sale`
    : "no sale in the Assessor's last-18-months sales view";
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Clark County Assessor parcel ${h.s(r.APN)}${yb ? ` (built ${yb})` : ""}: ${saleText}.`,
    lastSale, benchmark: null, governmentValue: null, location: null,
    property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
