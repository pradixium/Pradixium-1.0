/* PRADIXIUM™ — JAPAN: MLIT Real Estate Price Index (residential) by area and
 * type (lib/japan/mlit.js). MLIT's per-transaction prices (Real Estate
 * Information Library API) need an API key — not yet held → no price level.
 */
import { japanTrend } from "../lib/japan/mlit.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const city = String(req.query?.city || "").trim();
  const address = String(req.query?.address || "").trim();
  const jp = japanTrend({ text: [address, city].filter(Boolean).join(", "), propertyType: req.query?.propertyType });
  return res.status(200).json({ success: true, country: "Japan", city: city || null, data: { market: "Japan Residential Market", jp } });
}
