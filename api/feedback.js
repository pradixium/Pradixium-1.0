/* PRADIXIUM™ — Report feedback intake
 * One free-text field on the report page ("anything you expected to see
 * here and didn't?"). Deliberately private: this writes to a table only
 * the service role can read — no public list, no upvoting, no "roadmap"
 * page. The founder reviews it directly and decides what to build; this
 * is a signal channel, not a feature-request queue.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";
const MAX_LEN = 2000;

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
    return res.status(500).json({ error: "Feedback is not configured on the server yet." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const text = String(body.text || "").trim().slice(0, MAX_LEN);
  if (!text) {
    return res.status(400).json({ error: "Empty feedback." });
  }

  const userId = await getAuthenticatedUserId(req.headers.authorization);

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        report_text: text,
        analysis_reference: body.analysisReference ? String(body.analysisReference).slice(0, 100) : null,
        country: body.country ? String(body.country).slice(0, 100) : null,
        report_language: body.reportLanguage ? String(body.reportLanguage).slice(0, 10) : null,
        user_id: userId
      })
    });
    if (!resp.ok) {
      return res.status(502).json({ error: "Could not save feedback." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
