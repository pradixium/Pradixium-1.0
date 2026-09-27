/* PRADIXIUM™ — Maryland, statewide (DC metro's Montgomery / Prince George's /
 * Frederick / Charles, plus Baltimore). Maryland Department of Planning
 * "MD_PropertyData" parcel points, built from the State Department of
 * Assessments and Taxation (SDAT) roll.
 * CONVEY1 ("How Conveyed Ind.") labels, from Maryland's own open-data
 * assessment file: 1 = private arm's-length transfer, improved; 2 = arm's
 * length, vacant; 3 = arm's length, multiple parcel; 4 = private
 * non-arm's-length (foreclosure, gift, auction). Only code 1 counts here.
 *  - the property's last code-1 sale (Transaction rows)
 *  - SDAT "New Appraised Full Value" (Government Value, display only),
 *    structure sq ft, year built
 *  - no ZIP median: that query is too slow on the statewide service
 */
const URL = "https://mdgeodata.md.gov/imap/rest/services/PlanningCadastre/MD_PropertyData/MapServer/0/query";
const SOURCE = "Maryland SDAT assessment roll (Maryland Department of Planning — MdProperty View)";
const SOURCE_URL = "https://dat.maryland.gov/realproperty";
const TYPES = { SF: "single-family homes", TH: "townhouses", CN: "condominiums", AP: "apartments" };
const ymd = (v) => { const m = String(v ?? "").match(/^(\d{4})(\d{2})(\d{2})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

export function matches(geo) {
  return geo?.stateCode === "MD";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const q = (params, ms = 7000) => h.json(URL + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const j = await q({ where: `ADDRESS='${h.escapeSql(`${a.number} ${a.street}`)}' AND ZIPCODE LIKE '${z.zip}%'`, outFields: "ACCTID,JURSCODE,ADDRESS,STRTUNT,CITY,RESITYP,TRADATE,CONSIDR1,CONVEY1,NFMTTLVL,SQFTSTRC,YEARBLT,SDATDATE" });
  let rows = (j?.features || []).map((f) => f.attributes);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.STRTUNT) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.STRTUNT));
  const r = rows.length === 1 ? rows[0] : null;
  if (!r) return (j?.features || []).length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Maryland SDAT: several accounts at this address — add the unit number.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const lastSale = Number(r.CONVEY1) === 1 && Number(r.CONSIDR1) > 0 && ymd(r.TRADATE) && h.s(r.TRADATE) <= today ? { price: Number(r.CONSIDR1), date: ymd(r.TRADATE), source: `${SOURCE} — private arm's-length transfer` } : null;
  const value = Number(r.NFMTTLVL) > 0 ? Number(r.NFMTTLVL) : null;
  const parts = [`Maryland SDAT account ${h.s(r.ACCTID)} (${h.s(r.CITY)}${TYPES[h.s(r.RESITYP)] ? `, ${TYPES[h.s(r.RESITYP)].replace(/s$/, "")}` : ""}): ${lastSale ? `last arm's-length sale ${usd(lastSale.price)} on ${lastSale.date}` : "no arm's-length sale on the current record"}${value ? `; SDAT appraised full value ${usd(value)}` : ""}${Number(r.SQFTSTRC) > 0 ? `; structure area ${Number(r.SQFTSTRC).toLocaleString("en-US")} sq ft (SDAT)` : ""}${Number(r.YEARBLT) > 0 ? `; built ${r.YEARBLT}` : ""}.`];

  // No ZIP median: the statewide service takes ~13 s for that query (tested
  // Sept 2026), past this endpoint's time budget, so it would never finish.
  return {
    source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "), lastSale, benchmark: null,
    governmentValue: value ? { value, asOf: null, label: "Maryland SDAT appraised full value" } : null,
    location: null,
    // SDAT "Structure Square Footage" is not defined as living area, so it stays in the text only
    property: { livingAreaSqFt: null, yearBuilt: Number(r.YEARBLT) > 0 ? Number(r.YEARBLT) : null, bedrooms: null, bathrooms: null },
    checks: [], hasRecord: true
  };
}
