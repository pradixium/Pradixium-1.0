/* PRADIXIUM™ — Connecticut, statewide (Hartford metro and every CT town) —
 * Office of Policy and Management "Real Estate Sales 2001-2024 GL"
 * (data.ct.gov 5mzw-sjtu): every sale of $2,000+ reported by the town
 * assessors, with the assessor's "non usable sale code" (OPM: the sale
 * price is "not reliable for use in the determination of a property value").
 * Shown: the property's latest sale only when it carries NO non-usable
 * code; town context = median price of usable single-family sales in the
 * latest grand-list year (Oct 1 – Sep 30), context only. Towns in a
 * revaluation year may not report (OPM), so a town can have no figure.
 */
const API = "https://data.ct.gov/resource/5mzw-sjtu.json";
const SOURCE = "Connecticut Office of Policy and Management — Real Estate Sales (town assessors)";
const SOURCE_URL = "https://data.ct.gov/Housing-and-Development/Real-Estate-Sales-2001-2024-GL/5mzw-sjtu";
const SUFFIX = { ST: "STREET", AVE: "AVENUE", AV: "AVENUE", RD: "ROAD", DR: "DRIVE", LN: "LANE", CT: "COURT", PL: "PLACE", BLVD: "BOULEVARD", TER: "TERRACE", CIR: "CIRCLE", WAY: "WAY", PKWY: "PARKWAY", HWY: "HIGHWAY", TPKE: "TURNPIKE", SQ: "SQUARE", TRL: "TRAIL", RDG: "RIDGE", XING: "CROSSING" };

export function matches(geo) {
  return geo?.stateCode === "CT";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const w = a.street.split(/\s+/);
  const sfx = w.length > 1 && SUFFIX[w[w.length - 1]] ? w.pop() : null;
  const base = `${a.number} ${w.join(" ")}`;
  const lines = [base, sfx ? `${base} ${sfx}` : null, sfx ? `${base} ${SUFFIX[sfx]}` : null].filter(Boolean);
  const town = h.s(geo?.matchedAddress).split(",")[1]?.trim() || "";
  const soql = (params, ms = 6000) => h.json(API + "?" + new URLSearchParams(params), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const near = (r) => { const c = r.geo_coordinates?.coordinates; if (!c || !Number.isFinite(geo?.latitude)) return false; const dx = (c[0] - geo.longitude) * 83000, dy = (c[1] - geo.latitude) * 111000; return Math.hypot(dx, dy) < 250; };

  const recs = await soql({ $where: `upper(address) in (${lines.map((l) => `'${h.escapeSql(l)}'`).join(",")})`, $order: "daterecorded DESC", $limit: "50" });
  let rows = Array.isArray(recs) ? recs : [];
  const inTown = rows.filter((r) => h.s(r.town).toUpperCase() === town.toUpperCase());
  rows = inTown.length ? inTown : rows.filter(near);
  const unit = h.unitFromAddress(address);
  if (!rows.length) return null;
  const townName = h.s(rows[0].town);
  if (rows.some((r) => h.s(r.town) !== townName)) return null;
  const latest = rows[0];
  const usable = !h.s(latest.nonusecode) && Number(latest.saleamount) > 0;
  const date = h.s(latest.daterecorded).slice(0, 10);
  const lastSale = usable && !unit ? { price: Number(latest.saleamount), date, source: `${SOURCE} — no non-usable sale code` } : null;

  const yr = await soql({ $select: "max(listyear) as y", $where: `town='${h.escapeSql(townName)}'` });
  const y = h.s(yr?.[0]?.y);
  const ctx = y ? await soql({ $select: "saleamount", $where: `town='${h.escapeSql(townName)}' AND listyear='${y}' AND residentialtype='Single Family' AND nonusecode IS NULL AND saleamount>0`, $limit: "5000" }, 7000) : null;
  const prices = (Array.isArray(ctx) ? ctx : []).map((r) => Number(r.saleamount)).filter((x) => x > 0).sort((p, q) => p - q);
  const med = prices.length ? (prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2) : null;

  const parts = [];
  parts.push(`Connecticut town assessor (${townName}): ${lastSale ? `last usable sale ${usd(lastSale.price)} recorded ${lastSale.date}` : unit ? `sales at this address are not matched to a unit, so none is shown` : `latest recorded sale (${date}) carries non-usable code "${h.s(latest.nonusecode)}", so it is not shown as a market sale`}.`);
  if (prices.length >= 10) parts.push(`${prices.length} usable single-family sales in ${townName} in grand-list year ${y} (Oct ${y} – Sep ${Number(y) + 1}), median ${usd(med)} — context only; not used in the verdict.`);
  return {
    source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "),
    lastSale, benchmark: null, governmentValue: null, location: null, property: null,
    checks: [], hasRecord: true
  };
}
