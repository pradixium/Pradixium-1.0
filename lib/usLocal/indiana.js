/* PRADIXIUM™ — Indiana statewide (outside Marion County, which has its own
 * live module): each county's real property roll as submitted to the
 * Indiana Department of Local Government Finance (DLGF) and published on
 * the Indiana Gateway ("Real Property" PARCEL files), turned into
 * lib/data/indiana/<county FIPS>.json.gz by scripts/build-in-parcels.py.
 * Shown: the parcel's gross assessed value (current AV, total land and
 * improvements) for the file's assessment year, as Government Value,
 * display only — Indiana assesses at "true tax value", which for
 * residential property is market value-in-use. Not shown: sales (Indiana
 * publishes sale prices only through its sales-disclosure search tool).
 * Matching: house number + street (types/directions compared in USPS
 * form) and the parcel's ZIP or city must match the geocoded address. One county file is read and kept in memory per instance.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { canon, splitStreet } from "./_structured.js";

const cache = new Map();
function load(fips) {
  if (cache.has(fips)) return cache.get(fips);
  let data = null;
  try { data = JSON.parse(gunzipSync(readFileSync(path.join(process.cwd(), "lib", "data", "indiana", `${fips}.json.gz`))).toString("utf8")); } catch { data = null; }
  cache.set(fips, data);
  return data;
}
const norm = (street) => splitStreet(String(street || "").toUpperCase().split(/\s+/).map(canon).join(" "));

export function matches(geo) {
  return geo?.stateCode === "IN" && String(geo?.countyFips || "") !== "18097";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const data = load(String(geo.countyFips));
  if (!data) return null;
  const st = norm(a.street);
  const unit = h.unitFromAddress(address);
  const pick = (list) => list.map(([street, pin, av, cls, ci]) => {
    const m = street.match(/^(.*?)(?:\s+(?:UNIT|APT|STE|#|LOT)\s*(\S+))?$/);
    return { s: norm(m[1]), unit: m[2] || "", pin, av, cls, city: data.cities?.[ci] || "" };
  }).filter((r) => r.s.name === st.name && (!st.dir || !r.s.dir || r.s.dir === st.dir) && (!st.type || !r.s.type || r.s.type === st.type) && (!st.post || !r.s.post || r.s.post === st.post));
  // the geocoder's ZIP can differ from the assessor's: a parcel counts when its
  // ZIP matches, or — searching the whole county — when its city matches the
  // geocoded town (same rule as every other module)
  let rows = pick(data.zips?.[z.zip]?.[a.number] || []);
  if (!rows.length) {
    const town = h.s(geo?.city).toUpperCase().replace(/\s+(CITY|CDP|TOWN)$/, "");
    rows = town ? pick(Object.values(data.zips || {}).flatMap((byNo) => byNo[a.number] || [])).filter((r) => r.city === town) : [];
  }
  const found = rows.length;
  if (unit) rows = rows.filter((r) => h.unitKey(r.unit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !r.unit);
  const meta = data.meta || {};
  const src = `Indiana DLGF county real property roll (${meta.assessmentYear || ""} assessment, Indiana Gateway)`;
  if (rows.length !== 1) return rows.length > 1 || (!unit && found > 1) ? { source: src, sourceUrl: meta.sourceUrl, summary: "Indiana county assessor roll: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.av) > 0 ? Number(r.av) : null, yr = meta.assessmentYear || null;
  return {
    source: src, sourceUrl: meta.sourceUrl,
    summary: `${h.s(geo?.county) || "County"} Assessor parcel ${r.pin}${value ? `: ${yr ? yr + " " : ""}gross assessed value ${usd(value)} (land + improvements; Indiana assesses at true tax value — market value-in-use for homes)` : ""}, from the county's roll filed with the Indiana DLGF. Sales are not shown: Indiana publishes sale prices only through its sales-disclosure search.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: yr, label: `${h.s(geo?.county) || "County"} Assessor ${yr ? yr + " " : ""}gross assessed value (Indiana DLGF roll)` } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
