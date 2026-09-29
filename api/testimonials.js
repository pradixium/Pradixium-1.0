/* PRADIXIUM™ — Testimonial submission
 * A customer's own short review, submitted from report.html after they've
 * received a real report. Unlike api/feedback.js (a private one-way signal
 * only the founder reads), a testimonial is meant to eventually be shown
 * publicly on index.html -- but ONLY once the owner has manually approved
 * it (approved defaults to false; there is no public insert/update policy
 * on the table, so this service-role write is the only way a row is ever
 * created). Same "no Roman senate" discipline as feedback: no public
 * voting, no auto-publish, the founder is the only moderator.
 *
 * displayName is whatever the customer chooses to show publicly (e.g.
 * "D.K., Tel Aviv" or "Anonymous investor") -- never their real account
 * email, which stays private.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";
const MAX_TEXT_LEN = 800;
const MAX_NAME_LEN = 80;

async function getAuthenticatedUserId(authHeader) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const user = await r.json().catch(() => null);
  return user?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: "Testimonials are not configured on the server yet." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const text = String(body.text || "").trim().slice(0, MAX_TEXT_LEN);
  const rating = Number(body.rating);
  if (!text) {
    return res.status(400).json({ error: "Empty testimonial." });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be 1-5." });
  }

  const userId = await getAuthenticatedUserId(req.headers.authorization);

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/testimonials`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        display_name: body.displayName ? String(body.displayName).trim().slice(0, MAX_NAME_LEN) : null,
        country: body.country ? String(body.country).slice(0, 100) : null,
        rating,
        text,
        analysis_reference: body.analysisReference ? String(body.analysisReference).slice(0, 100) : null,
        approved: false,
        user_id: userId
      })
    });
    if (!resp.ok) {
      return res.status(502).json({ error: "Could not save testimonial." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
