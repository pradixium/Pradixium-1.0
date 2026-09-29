/* PRADIXIUM™ — PENDING MARKET PLACEHOLDER
 * These countries are listed in the dropdown so the platform's global
 * reach is honest about scope, but no verified official government (or
 * credible industry) real-estate price source has been found for them
 * yet — each was actually searched for and came up empty, not simply
 * skipped. Rather than leave them out of the dropdown entirely or
 * silently 404, this returns an explicit "not yet connected" status so
 * the UI can say so plainly instead of implying a number that isn't there.
 *
 * To connect one for real: once a verified source is found, add it to
 * api/regional-fixture-intelligence.js's FIXTURES (or give it its own
 * adapter file) and repoint its line in api/orchestrator.js's
 * COUNTRY_ENDPOINTS away from "pending-intelligence" — the dropdown
 * option and orchestrator routing already exist, so that's the only
 * change needed.
 */
const PENDING_COUNTRIES = {
  armenia: "Armenia",
  azerbaijan: "Azerbaijan",
  uzbekistan: "Uzbekistan",
  kyrgyzstan: "Kyrgyzstan",
  tajikistan: "Tajikistan",
  turkmenistan: "Turkmenistan",
  moldova: "Moldova",
  belarus: "Belarus",
  kosovo: "Kosovo",
  liechtenstein: "Liechtenstein",
  "san marino": "San Marino",
  uruguay: "Uruguay",
  ecuador: "Ecuador",
  bolivia: "Bolivia",
  paraguay: "Paraguay",
  "dominican republic": "Dominican Republic",
  bahamas: "Bahamas",
  "puerto rico": "Puerto Rico",
  "cayman islands": "Cayman Islands",
  "trinidad and tobago": "Trinidad and Tobago",
  barbados: "Barbados",
  jamaica: "Jamaica"
};

function normalizeCountry(value) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const country = normalizeCountry(req.query?.country);
  const name = PENDING_COUNTRIES[country];
  const city = String(req.query?.city || "").trim() || null;

  if (!name) {
    return res.status(404).json({ success: false, error: "Country not covered" });
  }

  // success: false here is deliberate — it makes fetchGovernmentData()
  // in api/orchestrator.js treat this exactly like "no data available"
  // (the same honest path every other country falls back to on a real
  // fetch failure), rather than needing special-case handling.
  return res.status(200).json({
    success: false,
    country: name,
    city,
    error: "No verified official real-estate price source has been found for this market yet.",
    status: "NOT_YET_CONNECTED"
  });
}
