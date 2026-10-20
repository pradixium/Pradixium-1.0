/* PRADIXIUM™ — Referral visit tracking
 * The `referral_visits` table existed in the database with no application
 * code anywhere writing to it -- a half-built feature (schema created,
 * never wired up). engine.js's captureReferralCode() already captures
 * ?ref=CODE into localStorage for checkout-time attribution (purchases.
 * referral_code); this endpoint adds the other half, a lightweight log of
 * the arrival itself, so a partner's funnel (visits vs. actual paid
 * conversions) can be measured, not just the conversions alone.
 *
 * Deliberately minimal and best-effort: a dropped visit log is not worth
 * blocking or slowing down the page for, and this never gates anything --
 * checkout-time attribution (the part that actually matters for paying
 * commissions) does not depend on this table at all.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: "Referral tracking is not configured on the server yet." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const code = String(body.code || "").trim();
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: "Invalid or missing referral code." });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/referral_visits`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ code })
    });
    if (!resp.ok) {
      return res.status(502).json({ error: "Could not log the visit." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
