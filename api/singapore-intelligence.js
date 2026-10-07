/* PRADIXIUM™ — SINGAPORE: URA price index (SingStat) + URA median rents per
 * condo project (data.gov.sg). URA's per-project TRANSACTION prices are
 * only in its data service, which needs a free access key (not yet held)
 * and its public search page answers 403 to servers → no price level.
 */
import { singaporeData } from "../lib/singapore/sg.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const city = String(req.query?.city || "").trim();
  const address = String(req.query?.address || "").trim();
  const data = singaporeData({ text: [address, city].filter(Boolean).join(", "), propertyType: req.query?.propertyType, size: Number(req.query?.size) || null });
  return res.status(200).json({ success: true, country: "Singapore", city: city || null, data: { market: "Singapore Private Residential Market", sg: data } });
}
