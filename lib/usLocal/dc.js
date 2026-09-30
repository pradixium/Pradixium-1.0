/* PRADIXIUM™ — Washington, DC (Office of the Chief Financial Officer /
 * Office of Tax and Revenue open data)
 *  - Integrated Tax System Public Extract (ITSPE): address → SSL, OTR
 *    neighborhood, last sale with OTR's acceptance code ("Market Sale" vs
 *    "Buyer = Seller" etc.), assessment and the actual annual tax
 *  - CAMA Residential / Condominium: beds, baths, year built; condo
 *    "Living Gross Building Area"
 * Only sales OTR marked "Market Sale" count. The neighborhood figure is a
 * median SALE PRICE of market sales of the SAME OTR property type (exact
 * class: row / semi-detached / detached house, horizontal / vertical condo)
 * in the same OTR neighborhood, last 12 months (each property's latest
 * sale on the extract). For single-family houses and condos it is the
 * whole-home benchmark (areaMedianPrice, 10+ sales); other classes
 * (flats, conversions, garage condos) → context only.
 */
const ITSPE = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/53/query";
const CAMA = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/";
const SOURCE = "DC Office of Tax and Revenue — Integrated Tax System Public Extract";
const SOURCE_URL = "https://opendata.dc.gov/";
const MIN_SALES = 10;
// OTR classes (the layer cuts PROPTYPE at 30 characters) that are one home
const BENCHMARK_TYPES = /^Residential-(Single Family \((Row|Sem|Det)|Condominium \((Horiz|Verti))/i;
const TYPE_LABELS = [[/Single Family \(Row/i, "row houses"], [/Single Family \(Sem/i, "semi-detached houses"], [/Single Family \(Det/i, "detached houses"], [/Condominium \(Horiz/i, "horizontal (low-rise) condominiums"], [/Condominium \(Verti/i, "vertical (high-rise) condominiums"]];
const typeLabel = (t) => (TYPE_LABELS.find(([re]) => re.test(t)) || [null, `"${t.replace(/^Residential-/, "")}" properties`])[1];
// the layer returns dates as epoch milliseconds; other DC extracts as text
const isoDate = (v) => (typeof v === "number" && Number.isFinite(v) ? new Date(v).toISOString().slice(0, 10) : String(v ?? "").slice(0, 10)) || null;

export function matches(geo) {
  return String(geo?.countyFips || "") === "11001";
}

export async function evidence({ geo, address, h }) {
  const a = h.addressParts(geo);
  if (!a) return null;
  const q = (url, params, ms = 8000) => h.json(url + "?" + new URLSearchParams({ returnGeometry: "false", f: "json", ...params }), ms).catch(() => null);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const fields = "SSL,PREMISEADD,UNITNUMBER,NBHD,NBHDNAME,PROPTYPE,SALEPRICE,SALEDATE,ACCEPTCODE,ASSESSMENT,ANNUALTAX,EXTRACTDAT";
  const j = await q(ITSPE, { where: `PREMISEADD LIKE '${h.escapeSql(`${a.number} ${a.street}`)} %'`, outFields: fields });
  let rows = (j?.features || []).map((f) => f.attributes);
  const unit = h.unitFromAddress(address);
  if (unit) rows = rows.filter((r) => h.unitKey(r.UNITNUMBER) === unit);
  else if (rows.length > 1) rows = rows.filter((r) => !h.s(r.UNITNUMBER));
  const several = !unit && (j?.features || []).length > 1 && rows.length !== 1;
  const r = rows.length === 1 ? rows[0] : null;

  const parts = [];
  let lastSale = null, gov = null, property = null, nbhd = null;
  const checks = [];
  if (r) {
    const isCondo = /condominium/i.test(h.s(r.PROPTYPE));
    if (/^market sale$/i.test(h.s(r.ACCEPTCODE)) && Number(r.SALEPRICE) > 0 && r.SALEDATE) {
      lastSale = { price: Number(r.SALEPRICE), date: isoDate(r.SALEDATE), source: `${SOURCE} — recorded market sale` };
    }
    if (Number(r.ASSESSMENT) > 0) gov = { value: Number(r.ASSESSMENT), asOf: null, label: "DC Office of Tax and Revenue assessment" };
    if (Number(r.ANNUALTAX) > 0) checks.push({ id: "propertyTax", label: "Property tax (annual, actual bill)", value: `${usd(Number(r.ANNUALTAX))} — DC Office of Tax and Revenue`, level: "info", source: SOURCE, sourceUrl: SOURCE_URL, basis: "parcel" });

    // CAMA facts for the property itself (optional — may time out)
    const cama = (await q(CAMA + (isCondo ? "24" : "25") + "/query", { where: `SSL='${h.escapeSql(r.SSL)}'`, outFields: isCondo ? "BEDRM,BATHRM,AYB,LIVING_GBA" : "BEDRM,BATHRM,AYB", orderByFields: "SALEDATE DESC" }))?.features?.[0]?.attributes;
    if (cama) property = { bedrooms: Number(cama.BEDRM) || null, bathrooms: Number(cama.BATHRM) || null, yearBuilt: Number(cama.AYB) || null, livingAreaSqFt: null };

    // neighborhood: OTR market sales, same property type, last 12 months
    if (h.s(r.NBHD) && h.s(r.PROPTYPE)) {
      const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      const ptype = h.s(r.PROPTYPE);
      const ns = await q(ITSPE, { where: `NBHD='${h.escapeSql(r.NBHD)}' AND ACCEPTCODE='Market Sale' AND SALEPRICE>0 AND SALEDATE>=DATE '${since}' AND PROPTYPE='${h.escapeSql(ptype)}'`, outFields: "SALEPRICE,SALEDATE", resultRecordCount: "2000" });
      if (Array.isArray(ns?.features) && !ns.exceededTransferLimit) {
        const p = ns.features.map((f) => Number(f.attributes.SALEPRICE)).filter((x) => x > 0).sort((x, y) => x - y);
        const d = ns.features.map((f) => isoDate(f.attributes.SALEDATE)).filter(Boolean).sort();
        const m = Math.floor(p.length / 2);
        nbhd = { name: h.s(r.NBHDNAME) || h.s(r.NBHD), type: typeLabel(ptype), benchmark: BENCHMARK_TYPES.test(ptype), sales: p.length, from: d[0], to: d[d.length - 1], median: p.length >= MIN_SALES ? (p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2) : null };
      }
    }
    parts.push(`DC Office of Tax and Revenue, SSL ${h.s(r.SSL).replace(/\s+/g, " ")} (${h.s(r.NBHDNAME) || "neighborhood " + h.s(r.NBHD)}): ${lastSale ? `last market sale ${usd(lastSale.price)} on ${lastSale.date}` : "no market sale on the current record"}${gov ? `; assessment ${usd(gov.value)}` : ""}.`);
    if (nbhd?.median) parts.push(`${nbhd.sales} market sales of ${nbhd.type} in ${nbhd.name} (${nbhd.from} to ${nbhd.to}; each property's latest sale), median price ${usd(nbhd.median)} — ${nbhd.benchmark ? "the benchmark: a whole-home median, not adjusted for size" : "whole-property price, context only; not used in the verdict"}.`);
    else if (nbhd) parts.push(`Only ${nbhd.sales} market sales of ${nbhd.type} in ${nbhd.name} in the last 12 months — not enough for a local figure.`);
  } else if (several) {
    parts.push("DC Office of Tax and Revenue: several units at this address — add the unit number for the unit's own record.");
  }

  return {
    source: SOURCE, sourceUrl: SOURCE_URL,
    summary: parts.join(" ") || null,
    lastSale, benchmark: null, governmentValue: gov,
    areaMedianPrice: nbhd?.median && nbhd.benchmark ? { value: Math.round(nbhd.median), sales: nbhd.sales, area: `OTR neighborhood ${nbhd.name}`, typeLabel: nbhd.type, periodFrom: nbhd.from || null, periodTo: nbhd.to || null, source: SOURCE, sourceUrl: SOURCE_URL } : null,
    location: null, property, checks, hasRecord: Boolean(r)
  };
}
