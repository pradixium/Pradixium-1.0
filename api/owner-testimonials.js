/* PRADIXIUM™ — Owner testimonial moderation
 * The only way a testimonial's `approved` flag ever changes, or a bad
 * submission is removed. Gated by the same OWNER_DASHBOARD_KEY shared
 * secret as api/owner-dashboard.js -- one owner, no separate admin-role
 * system, same "kept deliberately simple" pattern used throughout.
 *
 * GET  -> every testimonial (pending and approved), newest first.
 * POST { id, action: "approve" | "delete" } -> approve publishes it,
 *   delete removes it outright (a rejected submission has no reason to be
 *   kept around -- there's no public audit trail need for it).
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";

function checkAuth(req) {
  const dashboardKey = process.env.OWNER_DASHBOARD_KEY;
  if (!dashboardKey) return { ok: false, status: 500, error: "OWNER_DASHBOARD_KEY is not configured on the server yet." };
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!supplied || supplied !== dashboardKey) return { ok: false, status: 401, error: "Not authorized." };
  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ success: false, error: "Not configured on the server yet." });
  }

  if (req.method === "GET") {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/testimonials?select=id,display_name,country,rating,text,analysis_reference,approved,created_at&order=created_at.desc&limit=200`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      if (!r.ok) throw new Error(`testimonials query returned HTTP ${r.status}`);
      const rows = await r.json();
      return res.status(200).json({ success: true, testimonials: rows });
    } catch (e) {
      return res.status(502).json({ success: false, error: String(e?.message || e) });
    }
  }

  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const id = String(body.id || "").trim();
    const action = String(body.action || "").trim();
    if (!id || !["approve", "delete"].includes(action)) {
      return res.status(400).json({ success: false, error: "id and a valid action are required." });
    }
    try {
      if (action === "approve") {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/testimonials?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({ approved: true })
        });
        if (!r.ok) throw new Error(`approve returned HTTP ${r.status}`);
      } else {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/testimonials?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: "return=minimal" }
        });
        if (!r.ok) throw new Error(`delete returned HTTP ${r.status}`);
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(502).json({ success: false, error: String(e?.message || e) });
    }
  }

  return res.status(405).json({ success: false, error: "GET or POST required" });
}
