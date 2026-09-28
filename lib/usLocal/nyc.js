/* PRADIXIUM™ — New York City (5 boroughs) — NYC Department of Finance open
 * data (data.cityofnewyork.us), official and free:
 *  - "Property Valuation and Assessment Data" (8y4t-faws): DOF market value
 *    per tax lot, latest fiscal year (final roll = period 3, else tentative)
 *  - PLUTO (64uk-42ks, Dept. of City Planning from DOF records): year built,
 *    floors, residential units, building / lot area
 *  - "Rolling Sales" (usep-8jbt): recorded sales of the last 12 months
 *  - "Digital Tax Map: Condominium Units" (eguu-7ie3): apartment number →
 *    the unit's own tax lot
 * What is shown, and how:
 *  - 1–3 family homes (tax class 1): DOF market value, sales-based by law →
 *    Government Value (display only).
 *  - Condos, co-ops and rental buildings (tax class 2): NY RPTL §581 makes
 *    DOF value them AS IF they were rental buildings (income approach), so
 *    their "market value" is usually far below sale prices → TEXT ONLY,
 *    never Government Value, never the verdict.
 *  - Sales: DOF does not mark arm's-length sales, so no single sale price is
 *    shown; for the building, the count and median of recorded sales of
 *    $10,000+ in the last 12 months are given as context, labelled so.
 * Owner names are never requested.
 */
import { canon } from "./_structured.js";

const BORO = { "36061": ["1", "MN", "Manhattan"], "36005": ["2", "BX", "the Bronx"], "36047": ["3", "BK", "Brooklyn"], "36081": ["4", "QN", "Queens"], "36085": ["5", "SI", "Staten Island"] };
const DS = "https://data.cityofnewyork.us/resource/";
const SOURCE = "NYC Department of Finance — Property Valuation and Assessment Data, PLUTO (Dept. of City Planning), Rolling Sales";
const SOURCE_URL = "https://data.cityofnewyork.us/d/8y4t-faws";
const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
// "WEST 57 STREET" and "W 57TH ST" → "W 57 ST"
export const nycStreet = (x) => String(x || "").toUpperCase().replace(/[.,]/g, " ").trim().split(/\s+/).map((w) => canon(w.replace(/^(\d+)(ST|ND|RD|TH)$/, "$1"))).join(" ");
const soql = (h, ds, params, ms = 5000) => h.json(DS + ds + ".json?" + new URLSearchParams(params), ms).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
// the city's Socrata server answers in 1–8 s for the same query: hedge with a
// second request after `hedgeMs`, first non-empty answer wins
const soqlHedged = (h, ds, params, ms = 7000, hedgeMs = 3000) => {
  const once = () => h.json(DS + ds + ".json?" + new URLSearchParams(params), ms).then((r) => { if (!Array.isArray(r)) throw new Error("bad"); return r; });
  return Promise.any([once(), new Promise((r) => setTimeout(r, hedgeMs)).then(once)]).catch(() => []);
};

export function matches(geo) {
  return Boolean(BORO[String(geo?.countyFips || "")]);
}

export async function evidence({ geo, address, h }) {
  const [boro, plutoBoro, boroName] = BORO[String(geo.countyFips)];
  const m = h.s(geo?.matchedAddress).split(",")[0].toUpperCase().match(/^(\d+(?:-\d+)?[A-Z]?)\s+(.+)$/);
  if (!m) return null;
  const num = m[1], street = nycStreet(m[2]);
  const core = street.split(" ").filter((w) => !/^(N|S|E|W|ST|AVE|RD|PL|DR|BLVD|TER|CT|LN|PKWY)$/.test(w)).sort((a, b) => b.length - a.length)[0] || street;
  const minYear = String(new Date().getFullYear() - 1);
  const like = `'${h.escapeSql(num)} %${h.escapeSql(core)}%'`;
  // the three datasets are queried in parallel (DOF alone can take ~3 s)
  const SEL = "parid,block,lot,year,period,housenum_lo,housenum_hi,street_name,zip_code,bldg_class,curtaxclass,curmkttot,finmkttot,gross_sqft";
  const zip = (h.s(geo?.matchedAddress).match(/(\d{5})\s*$/) || [])[1] || "";
  const [dofExact, dofRange, pluto, sales] = await Promise.all([
    soqlHedged(h, "8y4t-faws", { $select: SEL, $where: `boro='${boro}' AND housenum_lo='${h.escapeSql(num)}' AND street_name like '%${h.escapeSql(core)}%' AND year>='${minYear}'`, $limit: "5000" }),
    // a lot can carry a house-number range ("115-155 PROSPECT PARK WEST"); the
    // ZIP keeps this query fast
    zip ? soqlHedged(h, "8y4t-faws", { $select: SEL, $where: `boro='${boro}' AND zip_code='${zip}' AND street_name like '%${h.escapeSql(core)}%' AND year>='${minYear}' AND housenum_lo<>housenum_hi`, $limit: "5000" }) : Promise.resolve([]),
    soql(h, "64uk-42ks", { $select: "bbl,address,bldgclass,yearbuilt,numfloors,unitsres,bldgarea,lotarea", $where: `borough='${plutoBoro}' AND address like ${like}`, $limit: "50" }, 4000),
    soql(h, "usep-8jbt", { $select: "address,sale_price,sale_date", $where: `borough='${boro}' AND address like ${like} AND sale_price>=10000`, $limit: "2000" }, 4000)
  ]);
  // exact number, or inside the lot's range on the same side of the street
  const inRange = (r) => {
    if (r.housenum_lo === num || r.housenum_hi === num) return true;
    if (!/^\d+$/.test(num) || !/^\d+$/.test(h.s(r.housenum_lo)) || !/^\d+$/.test(h.s(r.housenum_hi))) return false;
    const n = Number(num), lo = Number(r.housenum_lo), hi = Number(r.housenum_hi);
    return n >= lo && n <= hi && (lo % 2 !== hi % 2 || n % 2 === lo % 2);
  };
  const rows = [...dofExact, ...dofRange].filter((r) => nycStreet(r.street_name) === street && inRange(r));
  if (!rows.length) return null;
  const year = rows.reduce((a, r) => (r.year > a ? r.year : a), "");
  const inYear = rows.filter((r) => r.year === year);
  const final = inYear.some((r) => r.period === "3");
  const lots = new Map();
  for (const r of inYear.filter((r) => r.period === (final ? "3" : "1"))) lots.set(r.parid, r);
  const list = [...lots.values()];
  const val = (r) => Number(final ? r.finmkttot || r.curmkttot : r.curmkttot) || 0;
  const fy = `FY${year} ${final ? "final" : "tentative"} roll`;
  const sameAddr = (a) => { const t = h.s(a).toUpperCase().split(",")[0].trim(); return t.split(" ")[0] === num && nycStreet(t.replace(/^\S+\s+/, "")) === street; };
  const lotSet = new Set(list.map((r) => String(r.parid)));
  const pl = pluto.find((p) => lotSet.has(String(p.bbl).split(".")[0])) || pluto.find((p) => sameAddr(p.address));
  // one deed covering several units repeats the whole price on each unit →
  // a price + date seen more than once is a multi-unit deed and is dropped
  const own = sales.filter((sx) => sameAddr(sx.address) && Number(sx.sale_price) >= 10000);
  const key = (sx) => `${Number(sx.sale_price)}|${h.s(sx.sale_date).slice(0, 10)}`, seen = {};
  for (const sx of own) seen[key(sx)] = (seen[key(sx)] || 0) + 1;
  const multi = own.filter((sx) => seen[key(sx)] > 1).length;
  const bSales = own.filter((sx) => seen[key(sx)] === 1).map((sx) => Number(sx.sale_price)).sort((a, b) => a - b);
  const median = bSales.length ? (bSales.length % 2 ? bSales[(bSales.length - 1) / 2] : (bSales[bSales.length / 2 - 1] + bSales[bSales.length / 2]) / 2) : null;

  const facts = pl ? [Number(pl.yearbuilt) > 0 && `built ${pl.yearbuilt}`, Number(pl.numfloors) > 0 && `${Math.round(pl.numfloors)} floors`, Number(pl.unitsres) > 0 && `${pl.unitsres} residential unit${Number(pl.unitsres) === 1 ? "" : "s"}`, Number(pl.bldgarea) > 0 && `${Number(pl.bldgarea).toLocaleString("en-US")} sq ft gross building area`].filter(Boolean).join(", ") : "";
  const salesText = (bSales.length ? ` Recorded sales in this building, last 12 months (DOF Rolling Sales, $10,000+): ${bSales.length}${bSales.length >= 3 ? `, median ${usd(median)}` : ""} — DOF does not flag arm's-length sales, so this is context, not a valuation.` : " No single-unit recorded sale of $10,000+ in this building in the last 12 months (DOF Rolling Sales).") + (multi ? ` ${multi} unit records sharing one deed price were left out.` : "");
  const base = { source: SOURCE, sourceUrl: SOURCE_URL, lastSale: null, benchmark: null, location: null, checks: [], hasRecord: true,
    property: { livingAreaSqFt: null, yearBuilt: pl && Number(pl.yearbuilt) > 0 ? Number(pl.yearbuilt) : null, bedrooms: null, bathrooms: null } };

  const cls1 = list.filter((r) => r.curtaxclass === "1" || r.curtaxclass === "1A" || r.curtaxclass === "1B" || r.curtaxclass === "1C" || r.curtaxclass === "1D");
  if (list.length === 1 && cls1.length === 1) {
    const r = list[0], v = val(r);
    return { ...base,
      summary: `NYC Department of Finance, ${boroName} tax lot ${r.parid} (building class ${r.bldg_class}${facts ? `, ${facts}` : ""}): ${fy} market value ${usd(v)} (1–3 family homes are valued from sales).${salesText}`,
      governmentValue: v ? { value: v, asOf: `FY${year}`, label: `NYC Dept. of Finance ${fy} market value` } : null };
  }
  const condoUnits = list.filter((r) => /^R[1-9]/.test(r.bldg_class || "") && r.bldg_class !== "RG" && r.bldg_class !== "RP");
  const note = "For condos, co-ops and rental buildings New York law (RPTL §581) has DOF value the property as if it were rented, so this figure is usually far below sale prices and is not a market price.";
  if (condoUnits.length > 1) {
    const vs = condoUnits.map(val).filter((v) => v > 0).sort((a, b) => a - b);
    // apartment number → the unit's own tax lot: DOF Digital Tax Map
    // "Condominium Units" (eguu-7ie3) — only a lot of THIS building counts
    const apt = h.unitFromAddress ? h.unitFromAddress(address) : null;
    let unit = null;
    if (apt) {
      const blocks = [...new Set(condoUnits.map((r) => String(Number(r.block))))];
      const map = await soqlHedged(h, "eguu-7ie3", { $select: "unit_block,unit_lot,unit_designation", $where: `unit_boro='${boro}' AND unit_block in(${blocks.map((b) => `'${b}'`).join(",")})`, $limit: "5000" }, 4000, 2000);
      const hits = map.filter((u) => h.unitKey(u.unit_designation) === apt).map((u) => condoUnits.find((r) => Number(r.block) === Number(u.unit_block) && Number(r.lot) === Number(u.unit_lot))).filter(Boolean);
      if (hits.length === 1) unit = hits[0];
    }
    const building = `condominium at this address with ${condoUnits.length} residential unit lots${facts ? ` (${facts})` : ""}. ${fy} DOF values of those units range ${usd(vs[0])}–${usd(vs[vs.length - 1])}.`;
    if (unit) {
      const area = Number(unit.gross_sqft) || 0;
      return { ...base, governmentValue: null, nycUnit: area > 0 ? { lot: unit.parid, grossSqFt: area } : null,
        summary: `NYC Department of Finance, ${boroName}: apartment ${apt} is tax lot ${unit.parid} (DOF Digital Tax Map, condominium units) in a ${building} This unit: ${fy} DOF value ${usd(val(unit))}${area > 0 ? `, ${area.toLocaleString("en-US")} sq ft as its share of the building's gross floor area (DOF roll; includes a share of common areas, not interior area)` : ""}. ${note}${salesText}` };
    }
    return { ...base, governmentValue: null,
      summary: `NYC Department of Finance, ${boroName}: ${building} ${note} ${apt ? `Apartment "${apt}" was not found among this building's unit lots (DOF Digital Tax Map).` : "Add the apartment number to the address to see the unit's own lot."}${salesText}` };
  }
  const r = list.sort((a, b) => val(b) - val(a))[0], v = val(r);
  const why = r.curtaxclass === "4" ? "This is a commercial property (tax class 4): DOF values it on an income basis, so the figure is not a sale-price estimate." : note;
  return { ...base, governmentValue: null,
    summary: `NYC Department of Finance, ${boroName} tax lot ${r.parid} (building class ${r.bldg_class}${facts ? `, ${facts}` : ""}): ${fy} DOF value ${usd(v)}${list.length > 1 ? ` (largest of ${list.length} lots at this address)` : ""}. ${why}${/^D|^C/.test(r.bldg_class || "") ? " For a co-op apartment, DOF values the whole building, not the unit." : ""}${salesText}` };
}
