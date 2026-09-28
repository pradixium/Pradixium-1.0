/* PRADIXIUM™ — North Carolina, statewide fallback (all 100 counties) — NC
 * OneMap statewide parcels (NC Center for Geographic Information & Analysis,
 * compiled from each county's parcel/tax data)
 * Shown: the parcel value exactly as the county reports it, WITH the
 * county's own value type ("Assessed", "Appraised", "Market", "Taxable") —
 * NC counties revalue on different cycles, so this is a display-only
 * Government Value, never the verdict. Year built when reported.
 * Wake and Mecklenburg have their own county modules, tried first.
 * Some counties publish no site address to NC OneMap (e.g. Guilford) —
 * those addresses simply get no record.
 */
const URL = "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query";
const SOURCE = "NC OneMap statewide parcels (county tax data)";
const SOURCE_URL = "https://www.nconemap.gov/";
const TYPES = new Set(["ST", "AVE", "AV", "RD", "DR", "LN", "BLVD", "CT", "PL", "WAY", "PKWY", "CIR", "TRL", "TER", "HWY", "SQ", "PT", "RUN", "ROW", "CV", "PLZ", "RDG", "XING", "PASS", "LOOP", "CRK", "HOLW", "GLN", "VW", "EXT"]);

export function matches(geo) {
  return geo?.stateCode === "NC";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  const county = h.s(geo?.county).replace(/ County$/i, "");
  if (!a || !county) return null;
  const w = a.street.split(/\s+/);
  if (w.length > 1 && TYPES.has(w[w.length - 1])) w.pop();
  const pre = `${a.number} ${w.join(" ")}`;
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `cntyname='${h.escapeSql(county)}' AND UPPER(siteadd) LIKE '${h.escapeSql(a.number)} %${h.escapeSql(w[w.length - 1])}%'`,
    outFields: "parno,siteadd,sunit,parval,parvaltype,structyear,parusedesc",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  const norm = (x) => h.s(x).toUpperCase().replace(/\s+/g, " ");
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const s = norm(r.siteadd); return s === pre || s.startsWith(pre + " "); });
  rows = rows.filter((r, i) => rows.findIndex((x) => h.s(x.parno) === h.s(r.parno)) === i);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.sunit) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.sunit));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: `${county} County (NC OneMap): more than one parcel matches this address, so none is shown.`, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.parval) > 0 ? Number(r.parval) : null, type = h.s(r.parvaltype).toLowerCase() || "parcel";
  const yb = Number(r.structyear) > 1700 ? Number(r.structyear) : null;
  const facts = [h.s(r.parusedesc).toLowerCase(), yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `${county} County parcel ${h.s(r.parno)}${facts ? ` (${facts})` : ""}${value ? `: ${type} value ${usd(value)} as the county reports it to NC OneMap (NC counties revalue on different cycles)` : ""}.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: `${county} County ${type} value (NC OneMap)` } : null,
    location: null, property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
