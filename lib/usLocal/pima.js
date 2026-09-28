/* PRADIXIUM™ — Tucson: Pima County, AZ (FIPS 04019) — Pima County Assessor
 * parcel data as published by the City of Tucson (PublicMaps/PropertyHousing
 * "Parcels - Tucson", regional Assessor records)
 * Shown: Full Cash Value (Arizona's assessor market value) with its tax
 * year (Government Value, display only), year built, use. No sales here.
 */
const URL = "https://mapdata.tucsonaz.gov/public/rest/services/PublicMaps/PropertyHousing/MapServer/40/query";
const SOURCE = "Pima County Assessor (City of Tucson GIS)";
const SOURCE_URL = "https://www.asr.pima.gov/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "04019";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a) return null;
  // the Census geocoder abbreviates USPS-style (PLAZA → PLZ, CAMINO → CMNO), the Assessor spells words out
  const ABBR = { PLAZA: "PLZ", CAMINO: "CMNO", CAMINITO: "CMTO", AVENIDA: "AVDA", AVENUE: "AVE", STREET: "ST", ROAD: "RD", DRIVE: "DR", LANE: "LN", PLACE: "PL", COURT: "CT", CIRCLE: "CIR", BOULEVARD: "BLVD", TRAIL: "TRL", VISTA: "VIS", PASEO: "PSO", CALLE: "CLL", PARKWAY: "PKWY", HIGHWAY: "HWY", TERRACE: "TER" };
  const canon = (x) => h.s(x).toUpperCase().replace(/\s+/g, " ").split(" ").map((t) => ABBR[t] || t).join(" ");
  const line = canon(`${a.number} ${a.street}`);
  const last = a.street.split(/\s+/).filter((t) => t.length > 2 && !Object.values(ABBR).includes(t)).pop() || a.street.split(/\s+/).pop();
  const j = await h.json(URL + "?" + new URLSearchParams({
    where: `SITE_ADDRESS LIKE '${h.escapeSql(a.number)} %${h.escapeSql(last)}%' ${z ? ` AND SITE_ZIP='${z.zip}'` : ""}`,
    outFields: "PARCEL,SITE_ADDRESS,FCV,TAXYR,YearBuilt,USE_DESC",
    returnGeometry: "false", f: "json"
  }), 6000).catch(() => null);
  let rows = (j?.features || []).map((f) => f.attributes).filter((r) => { const s = canon(r.SITE_ADDRESS); return s === line || s.startsWith(line + " "); });
  rows = rows.filter((r, i) => rows.findIndex((x) => h.s(x.PARCEL) === h.s(r.PARCEL)) === i);
  const unit = h.unitFromAddress(address);
  const rest = (r) => canon(r.SITE_ADDRESS).slice(line.length).trim().replace(/^(UNIT|APT|#)\s*/i, "");
  if (unit) rows = rows.filter((r) => h.unitKey(rest(r)) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !rest(r));
  if (rows.length !== 1) return rows.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Pima County Assessor: several parcels at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const r = rows[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const value = Number(r.FCV) > 0 ? Number(r.FCV) : null, year = h.s(r.TAXYR) || null, yb = Number(r.YearBuilt) > 1700 ? Number(r.YearBuilt) : null;
  const facts = [h.s(r.USE_DESC).toLowerCase(), yb && `built ${yb}`].filter(Boolean).join(", ");
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Pima County Assessor parcel ${h.s(r.PARCEL)}${facts ? ` (${facts})` : ""}${value ? `: ${year ? year + " " : ""}full cash value ${usd(value)}` : ""}.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: year, label: `Pima County Assessor ${year ? year + " " : ""}full cash value` } : null,
    location: null, property: { livingAreaSqFt: null, yearBuilt: yb, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
