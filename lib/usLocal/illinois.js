/* PRADIXIUM™ — Illinois statewide (outside Cook, which has its own module):
 * Illinois Department of Revenue "PTAX-203, 203-A, and 203-B" — every Real
 * Estate Transfer Declaration filed since 1 Jan 2013, updated weekly
 * (illinois-edp.data.socrata.com it54-y4c6).
 * A sale counts as a market sale here only when its declaration: has the
 * deed recorded, conveys one parcel (not a split), and declares NONE of the
 * Line 10 special circumstances (installment contract, related parties,
 * partial interest, court-ordered, in lieu of foreclosure, condemnation,
 * short sale, bank REO, auction, relocation company, financial institution
 * or government agency, REIT, pension fund, adjacent owner, option, trade,
 * sale-leaseback, other). Price = Line 13 net consideration (full
 * consideration less personal property).
 * Shown: the address's last such sale; ZIP context = count and median of
 * such sales of residences (Line 8 "B": single-family, condo, townhome or
 * duplex) in the last 12 months, 10+ sales — whole-property prices,
 * context only, never the verdict. Seller/buyer names are never requested.
 */
import { canon, splitStreet } from "./_structured.js";

const URL = "https://illinois-edp.data.socrata.com/resource/it54-y4c6.json";
const SOURCE = "Illinois Department of Revenue — PTAX-203 Real Estate Transfer Declarations";
const SOURCE_URL = "https://illinois-edp.data.socrata.com/d/it54-y4c6";
const LINE10 = ["line_10b_sale_between_related", "line_10c_transfer_of_100", "line_10d_court_ordered_sale", "line_10e_sale_in_lieu_of", "line_10f_condemnation", "line_10g_short_sale", "line_10h_bank_reo", "line_10i_auction_sale", "line_10j_seller_buyer_is", "line_10k_seller_buyer_is", "line_10l_buyer_is_a_real", "line_10m_buyer_is_a_pension", "line_10n_buyer_is_an_adjacent", "line_10o_buyer_is_exercising", "line_10p_trade_of_property", "line_10q_sale_leaseback", "line_10r_other"];
// 10a (installment contract) is published as a number: 0 = not declared
const CLEAN = `status='Deed Recorded' AND line_2_total_parcels='1' AND line_1_split_parcel=false AND (line_10a_fulfillment_of IS NULL OR line_10a_fulfillment_of='0') AND ${LINE10.map((f) => `(${f}=false OR ${f} IS NULL)`).join(" AND ")} AND line_13_net_consideration > 1000`;
const isClean = (r) => r.status === "Deed Recorded" && String(r.line_2_total_parcels) === "1" && r.line_1_split_parcel !== true && (!r.line_10a_fulfillment_of || String(r.line_10a_fulfillment_of) === "0") && LINE10.every((f) => r[f] !== true) && Number(r.line_13_net_consideration) > 1000;

export function matches(geo) {
  return geo?.stateCode === "IL";
}

export async function evidence({ geo, address, zip, h }) {
  const a = h.addressParts(geo), z = h.uspsZip(zip, geo);
  if (!a || !z) return null;
  const st = splitStreet(a.street);
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const fields = ["declaration_id", "status", "date_recorded", "line_1_street", "line_1_unit", "line_1_split_parcel", "line_2_total_parcels", "line_10a_fulfillment_of", ...LINE10, "line_13_net_consideration"].join(",");
  const [decls, ctx] = await Promise.all([
    h.json(URL + "?" + new URLSearchParams({ $select: fields, $where: `starts_with(line_1_zip_code,'${z.zip}') AND starts_with(line_1_street,'${h.escapeSql(a.number)} ')`, $order: "date_recorded DESC", $limit: "200" }), 7000).catch(() => null),
    h.json(URL + "?" + new URLSearchParams({ $select: "count(*) AS n, median(line_13_net_consideration) AS med, min(date_recorded) AS d0, max(date_recorded) AS d1", $where: `starts_with(line_1_zip_code,'${z.zip}') AND line_8_current_use='B' AND date_recorded >= '${since}' AND ${CLEAN}` }), 6000).catch(() => null)
  ]);
  // same number + street (types/directions spelled out on the form); a unit must match when given
  const unit = h.unitFromAddress(address);
  const mine = (decls || []).filter((r) => {
    const m = h.s(r.line_1_street).toUpperCase().replace(/[.,]/g, " ").match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+).*)?$/);
    if (!m || m[1] !== a.number) return false;
    const s = splitStreet(m[2].split(/\s+/).map(canon).join(" "));
    if (s.name !== st.name || (st.dir && s.dir && s.dir !== st.dir) || (st.type && s.type && s.type !== st.type)) return false;
    const u = h.unitKey(m[3] || r.line_1_unit);
    return unit ? u === unit : !u;
  });
  const last = mine[0], lastClean = mine.find(isClean);
  const d = (x) => h.s(x).slice(0, 10);
  const lastSale = last && isClean(last) ? { price: Number(last.line_13_net_consideration), date: d(last.date_recorded), source: `${SOURCE} — no special circumstances declared (Line 10)` } : null;
  const parts = [];
  if (lastSale) parts.push(`Illinois Dept. of Revenue: last sale ${usd(lastSale.price)} recorded ${lastSale.date} (PTAX-203 transfer declaration, one parcel, no special circumstances declared).`);
  else if (last) parts.push(`Illinois Dept. of Revenue: the latest transfer declaration for this address (${d(last.date_recorded)}) declares special circumstances (related parties, foreclosure, auction, partial interest or similar) or several parcels, so it is not shown as a market sale${lastClean ? `; the last one without them: ${usd(Number(lastClean.line_13_net_consideration))} recorded ${d(lastClean.date_recorded)}` : ""}.`);
  const c = ctx?.[0], n = Number(c?.n);
  if (n >= 10) parts.push(`${n} such sales of residences (single-family, condo, townhome or duplex) in ZIP ${z.zip} (${d(c.d0)} to ${d(c.d1)}), median ${usd(Number(c.med))} — whole-property prices, context only; not used in the verdict.`);
  if (!parts.length) return null;
  return {
    source: SOURCE, sourceUrl: SOURCE_URL, summary: parts.join(" "),
    lastSale, benchmark: null, governmentValue: null,
    location: null, property: null, checks: [], hasRecord: Boolean(last)
  };
}
