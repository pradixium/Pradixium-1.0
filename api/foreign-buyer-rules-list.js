/* PRADIXIUM™ — Foreign Buyer Access rules, full list
 * Powers the free public checker (foreign-buyer-check.html). Same source
 * of truth as the paid report's Foreign Buyer Access™ panel — see
 * lib/data/foreignBuyerRules.js — so the free tool and the paid analysis
 * can never drift out of sync with each other.
 */
import { listForeignBuyerRules } from "../lib/data/foreignBuyerRules.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({ success: true, countries: listForeignBuyerRules() });
}
