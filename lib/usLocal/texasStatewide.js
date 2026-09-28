/* PRADIXIUM™ — Texas statewide fallback (counties without their own entry
 * in texas.js): Texas Geographic Information Office (TxGIO) "StratMap Land
 * Parcels — most recent", which compiles each county appraisal district's
 * parcel roll (SOURCE = the district, DATE_ACQ = when TxGIO received it,
 * TAX_YEAR) — market value, land/improvement value, year built.
 * The service answers "identify" (not attribute queries), so the parcels
 * within ~45 m of the geocoded point are listed and ONLY the one whose situs
 * number and street name match the address is used.
 * Shown: the district's market value (Government Value, display only), with
 * the district, tax year and acquisition date. Texas is a non-disclosure
 * state: no sale prices exist in public records. Owner fields are ignored.
 */
import { canon, splitStreet } from "./_structured.js";

const URL = "https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer/identify";
const SOURCE = "TxGIO StratMap Land Parcels (compiled from the county appraisal district)";
const SOURCE_URL = "https://geographic.texas.gov/";

export function matches(geo) {
  return geo?.stateCode === "TX";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  const x = Number(geo?.longitude), y = Number(geo?.latitude);
  if (!a || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const st = splitStreet(a.street);
  const d = 0.002;
  const j = await h.json(URL + "?" + new URLSearchParams({
    geometry: `${x},${y}`, geometryType: "esriGeometryPoint", sr: "4326", layers: "all:0", tolerance: "40",
    mapExtent: `${x - d},${y - d},${x + d},${y + d}`, imageDisplay: "400,400,96", returnGeometry: "false", f: "json"
  }), 7000).catch(() => null);
  const unit = h.unitFromAddress(address);
  let rows = (j?.results || []).map((r) => r.attributes).filter((r) => {
    const m = h.s(r.SITUS_ADDR).toUpperCase().split(",")[0].replace(/[.]/g, " ").match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#|BLDG)\s*(\S+))?$/);
    if (!m || m[1] !== a.number) return false;
    const s = splitStreet(m[2].split(/\s+/).map(canon).join(" "));
    r._unit = m[3] || "";
    return s.name === st.name && (!st.dir || !s.dir || s.dir === st.dir) && (!st.type || !s.type || s.type === st.type) && (!st.post || !s.post || s.post === st.post);
  });
  // identify can list the same account twice (multi-part polygons)
  rows = rows.filter((r, i) => rows.findIndex((q) => q.PROP_ID === r.PROP_ID) === i);
  const found = rows.length;
  if (unit) rows = rows.filter((r) => h.unitKey(r._unit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !r._unit);
  const district = (r) => h.s(r?.SOURCE).replace(/\b(\w)(\w*)/g, (_, f, rest) => f + rest.toLowerCase()) || "County appraisal district";
  if (rows.length !== 1) return rows.length > 1 || (!unit && found > 1) ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Texas does not make sale prices public (non-disclosure state). The appraisal district lists several accounts at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (v) => "$" + Math.round(v).toLocaleString("en-US");
  const value = Number(r.MKT_VALUE) > 0 ? Number(r.MKT_VALUE) : null, year = h.s(r.TAX_YEAR) || null;
  const acq = /^\d{8}$/.test(h.s(r.DATE_ACQ)) ? `${r.DATE_ACQ.slice(0, 4)}-${r.DATE_ACQ.slice(4, 6)}-${r.DATE_ACQ.slice(6)}` : null;
  const built = Number(r.YEAR_BUILT) > 1800 ? Number(r.YEAR_BUILT) : null;
  return {
    source: `${district(r)} via ${SOURCE.split(" (")[0]}`, sourceUrl: SOURCE_URL,
    summary: `Texas does not make sale prices public (non-disclosure state), so no official sale-price benchmark exists for this address. ${district(r)} account ${h.s(r.PROP_ID)}${value ? `: ${year ? year + " " : ""}market value ${usd(value)}` : ""}${built ? `, built ${built}` : ""}${value ? " — the appraisal district's valuation, not a sale price; not used in the verdict" : ": the district's roll as published in StratMap carries no market value for this account"} (compiled by TxGIO StratMap${acq ? `, received ${acq}` : ""}).`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `${district(r)} ${year ? year + " " : ""}market value` } : null,
    location: null, property: { livingAreaSqFt: null, yearBuilt: built, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
