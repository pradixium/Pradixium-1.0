/* PRADIXIUM™ — HONG KONG: Rating and Valuation Department (RVD) average
 * prices and rents per m² of saleable area by region × size class, price
 * index by class, market yields (lib/hongkong/rvd.js).
 */
import { hongKongData } from "../lib/hongkong/rvd.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const city = String(req.query?.city || "").trim();
  const address = String(req.query?.address || "").trim();
  const data = hongKongData({ text: [address, city].filter(Boolean).join(", "), size: Number(req.query?.size) || null });
  return res.status(200).json({ success: true, country: "Hong Kong", city: city || null, data: { market: "Hong Kong Private Domestic Market", hk: data } });
}
