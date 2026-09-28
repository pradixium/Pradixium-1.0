/* PRADIXIUM™ — Pittsburgh core: Allegheny County, PA (FIPS 42003) — Allegheny
 * County Office of Property Assessments open data (WPRDC datastore, SQL API)
 *  - Property Sale Transactions: every deed with the county's own sale
 *    validation code; only SALECODE "0" = "VALID SALE" counts (not love &
 *    affection, multi-parcel, sheriff, time-on-market, corporation …)
 *  - Property Assessments: use, year built, beds, baths and
 *    FINISHEDLIVINGAREA ("total square feet of living area")
 * Benchmark (feeds the verdict): median price per sq ft of finished living
 * area of the county's VALID sales in the same ZIP, same use, last 24
 * months, 10+ sales. The county's fair market value is a 2012 base-year
 * value, so it is mentioned in the text with that label — never shown as
 * a current Government Value.
 */
const API = "https://data.wprdc.org/api/3/action/datastore_search_sql";
const SALES = "5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1";
const ASSESS = "65855e14-549e-4992-b5be-d629afc676fa";
const SOURCE = "Allegheny County Office of Property Assessments (WPRDC open data)";
const SOURCE_URL = "https://data.wprdc.org/dataset/real-estate-sales";
const MIN_SALES = 10;
// WPRDC's firewall answers 403 to SQL sent in a GET URL, as JSON, or without
// a User-Agent — a form-encoded POST with a User-Agent is what it accepts
const GROUPS = {
  house: { uses: ["SINGLE FAMILY"], label: "single-family homes" },
  attached: { uses: ["TOWNHOUSE", "ROWHOUSE"], label: "townhouses and rowhouses" },
  condo: { uses: ["CONDOMINIUM"], label: "condominiums" }
};

export function matches(geo) {
  return String(geo?.countyFips || "") === "42003";
}

export async function evidence({ geo, address, zip, propertyType, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const lit = (v) => `'${h.escapeSql(v)}'`;
  const sql = (q, ms = 6000) => h.json(API, ms, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Pradixium/1.0 (+https://pradixium.com)" }, body: new URLSearchParams({ sql: q }).toString() }).then((j) => (j?.success ? j.result.records : null)).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");

  const recs = await sql(`SELECT "PARID","PROPERTYUNIT","USEDESC","YEARBLT","BEDROOMS","FULLBATHS","HALFBATHS","FINISHEDLIVINGAREA","FAIRMARKETTOTAL" FROM "${ASSESS}" WHERE "PROPERTYHOUSENUM"=${lit(a.number)} AND "PROPERTYADDRESS"=${lit(a.street)} AND "PROPERTYZIP"=${lit(z.zip)} LIMIT 50`);
  let rows = recs || [];
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(h.s(r.PROPERTYUNIT).replace(/^(UNIT|APT|#)\s*/i, "")) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.PROPERTYUNIT));
  const r = rows.length === 1 ? rows[0] : null;

  const use = h.s(r?.USEDESC).toUpperCase();
  const t = h.s(propertyType).toLowerCase();
  const group = r ? Object.keys(GROUPS).find((k) => GROUPS[k].uses.includes(use)) || null
    : /apartment|condo/.test(t) ? "condo" : /town|row/.test(t) ? "attached" : /house|villa/.test(t) ? "house" : null;

  const today = new Date(), from = new Date(today); from.setMonth(from.getMonth() - 24);
  const d = (x) => x.toISOString().slice(0, 10);
  const [last, bench] = await Promise.all([
    r ? sql(`SELECT "PRICE","SALEDATE" FROM "${SALES}" WHERE "PARID"=${lit(r.PARID)} AND "SALECODE"='0' AND "PRICE">0 ORDER BY "SALEDATE" DESC LIMIT 1`) : null,
    group ? sql(`SELECT count(*) n, percentile_cont(0.5) WITHIN GROUP (ORDER BY s."PRICE"/a."FINISHEDLIVINGAREA") psf, percentile_cont(0.5) WITHIN GROUP (ORDER BY s."PRICE") med, min(s."SALEDATE") f, max(s."SALEDATE") t FROM "${SALES}" s JOIN "${ASSESS}" a ON a."PARID"=s."PARID" WHERE s."SALECODE"='0' AND s."PRICE">0 AND s."SALEDATE">=${lit(d(from))} AND s."SALEDATE"<=${lit(d(today))} AND s."PROPERTYZIP"=${Number(z.zip)} AND a."USEDESC" IN (${GROUPS[group].uses.map(lit).join(",")}) AND a."FINISHEDLIVINGAREA">0`, 7000) : null
  ]);

  const s0 = last?.[0];
  const lastSale = s0 && /^\d{4}-\d{2}-\d{2}/.test(h.s(s0.SALEDATE)) ? { price: Number(s0.PRICE), date: h.s(s0.SALEDATE).slice(0, 10), source: `${SOURCE} — sale coded "valid" by the county` } : null;
  const b = bench?.[0];
  const benchmark = b && Number(b.n) >= MIN_SALES && Number(b.psf) > 0 ? {
    valuePerSqFt: Math.round(Number(b.psf)), sales: Number(b.n), area: `ZIP ${z.zip}`, typeLabel: GROUPS[group].label,
    periodFrom: h.s(b.f).slice(0, 10), periodTo: h.s(b.t).slice(0, 10), source: SOURCE, sourceUrl: SOURCE_URL,
    basis: "median sale price per sq ft of finished living area, sales the county coded \"valid\""
  } : null;

  const property = r ? {
    livingAreaSqFt: Number(r.FINISHEDLIVINGAREA) > 0 ? Number(r.FINISHEDLIVINGAREA) : null,
    yearBuilt: Number(r.YEARBLT) > 0 ? Number(r.YEARBLT) : null,
    bedrooms: Number(r.BEDROOMS) > 0 ? Number(r.BEDROOMS) : null,
    bathrooms: Number(r.FULLBATHS) > 0 ? Number(r.FULLBATHS) + (Number(r.HALFBATHS) > 0 ? 0.5 * Number(r.HALFBATHS) : 0) : null
  } : null;
  const parts = [];
  if (r) {
    const facts = [use.toLowerCase(), property.livingAreaSqFt && `${property.livingAreaSqFt.toLocaleString("en-US")} sq ft living`, property.bedrooms && `${property.bedrooms} bd`, property.bathrooms && `${property.bathrooms} ba`, property.yearBuilt && `built ${property.yearBuilt}`].filter(Boolean).join(", ");
    parts.push(`Allegheny County parcel ${h.s(r.PARID)}${facts ? ` (${facts})` : ""}: ${lastSale ? `last valid sale ${usd(lastSale.price)} on ${lastSale.date}` : "no sale coded valid on record"}${Number(r.FAIRMARKETTOTAL) > 0 ? `; county fair market value ${usd(r.FAIRMARKETTOTAL)} is a 2012 base-year value, not today's market` : ""}.`);
  } else if (rows.length > 1 || (recs || []).length > 1) {
    parts.push("Allegheny County: several parcels at this address — add the unit number.");
  }
  if (benchmark) parts.push(`Allegheny County: ${benchmark.sales} valid sales of ${benchmark.typeLabel} in ZIP ${z.zip} (${benchmark.periodFrom} to ${benchmark.periodTo}), median ${usd(benchmark.valuePerSqFt)} per sq ft of finished living area${Number(b.med) > 0 ? `, median price ${usd(b.med)}` : ""}.`);
  else if (group && b) parts.push(`Allegheny County: fewer than ${MIN_SALES} valid sales of ${GROUPS[group].label} with living area in ZIP ${z.zip} in the last 24 months — no local benchmark.`);
  if (!parts.length) return null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "),
    lastSale, benchmark, governmentValue: null, location: null, property,
    checks: [], hasRecord: Boolean(r)
  };
}
