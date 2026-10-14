/* PRADIXIUM™ — referral visit counter
 * Logs one row per landing on a ?ref=CODE link, independent of whether that
 * visit ever converts to a purchase — so a partner's dashboard can show real
 * traffic (not just paid conversions), matching what their own webmaster
 * could verify by counting clicks on their own link. No PII stored: just
 * the code and a timestamp. Service-role only insert (see the
 * referral_visits RLS policy) so a partner can never call this directly to
 * inflate their own count — only this server-side endpoint can write it.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST required" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ ok: false, error: "Not configured on the server yet." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const code = String(body.code || "");
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) {
    return res.status(400).json({ ok: false, error: "Invalid code." });
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
      return res.status(502).json({ ok: false, error: "Could not record visit." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
}
