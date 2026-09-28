/* PRADIXIUM™ — City & County of Honolulu (FIPS 15003) — Honolulu Land
 * Information System (DPP/HOLIS) open data:
 *  - "Address Points" (Cadastral layer 3): official address → TMK
 *  - "ASMTGIS" (CadastralTables 9): Real Property Assessment land and
 *    building values per parcel/unit (parid = TMK + 4-digit suffix) and
 *    tax year
 * Shown: land + building assessed value for the latest tax year as
 * Government Value, display only. Not shown: sales (not in these tables),
 * owner data (never read).
 * Oahu house numbers can be hyphenated ("47-490"): parsed here directly.
 */
import { splitStreet } from "./_structured.js";

const PTS = "https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services/Cadastral_2020/FeatureServer/3/query";
const ASMT = "https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services/CadastralTables/FeatureServer/9/query";
const SOURCE = "City & County of Honolulu — Real Property Assessment (HOLIS open data)";
const SOURCE_URL = "https://www.realpropertyhonolulu.com/";

export function matches(geo) {
  return String(geo?.countyFips || "") === "15003";
}

export async function evidence({ geo, address, zip, h }) {
  const line = h.s(geo?.matchedAddress).split(",")[0].toUpperCase();
  const m = line.match(/^(?:(\d+)-)?(\d+)([A-Z])?\s+(.+)$/);
  const z = h.uspsZip(zip, geo);
  if (!m) return null;
  const [, pre, num, sfx, street] = m;
  const st = splitStreet(street);
  const q = (url, p, ms = 5000) => h.json(url + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...p }), ms).then((j) => (j?.features || []).map((f) => f.attributes)).catch(() => []);
  const pts = (await q(PTS, {
    where: `housenumber=${Number(num)} AND ${pre ? `houseprfx='${pre}'` : "(houseprfx IS NULL OR houseprfx='')"} AND ${sfx ? `housesuffx='${sfx}'` : "(housesuffx IS NULL OR housesuffx='')"} AND streetname LIKE '${h.escapeSql(st.name)}%'`,
    outFields: "tmk,streetname,zip,city,suite,secondary_address_number"
  })).filter((p) => {
    const s = splitStreet(h.s(p.streetname));
    return s.name === st.name && (!st.type || !s.type || s.type === st.type) && (!z || !h.s(p.zip) || h.s(p.zip) === z.zip);
  });
  const tmks = [...new Set(pts.map((p) => h.s(p.tmk)).filter(Boolean))];
  if (tmks.length !== 1) return tmks.length > 1 ? { source: SOURCE, sourceUrl: SOURCE_URL, summary: "Honolulu Real Property Assessment: this address matches several parcels, so none is shown.", lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false } : null;
  const rows = await q(ASMT, { where: `tmk='${tmks[0]}'`, outFields: "parid,suffix,taxyr,landvalue,buildingvalue" });
  const y = rows.reduce((a, r) => Math.max(a, Number(r.taxyr) || 0), 0);
  let cur = rows.filter((r) => Number(r.taxyr) === y);
  // one TMK can hold many condominium units (suffix 0001…): a unit in the
  // address picks its own suffix; without one only a single record counts
  const unit = h.unitFromAddress(address);
  if (cur.length > 1) cur = unit ? cur.filter((r) => Number(r.suffix) === Number(unit)) : [];
  if (cur.length !== 1) return { source: SOURCE, sourceUrl: SOURCE_URL, summary: `Honolulu Real Property Assessment: TMK ${tmks[0]} holds ${rows.filter((r) => Number(r.taxyr) === y).length} units — add the unit number for the unit's own value.`, lastSale: null, benchmark: null, governmentValue: null, location: null, property: null, checks: [], hasRecord: false };
  const r = cur[0], usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const land = Number(r.landvalue) || 0, bldg = Number(r.buildingvalue) || 0, value = land + bldg > 0 ? land + bldg : null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: `Honolulu Real Property Assessment, parcel ${h.s(r.parid)}${value ? `: ${y} assessed value ${usd(value)} (land ${usd(land)} + building ${usd(bldg)})` : ""}. Sales are not in these tables.`,
    lastSale: null, benchmark: null,
    governmentValue: value ? { value, asOf: String(y), label: `Honolulu Real Property Assessment ${y} assessed value (land + building)` } : null,
    location: null, property: null, checks: [], hasRecord: true
  };
}
