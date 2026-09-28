/* PRADIXIUM™ — individual monthly-plan quota consumer
 * The individual "monthly" plan ($29.99/mo, see api/create-checkout-session.js)
 * grants up to MONTHLY_QUOTA distinct property reports per billing cycle —
 * not unlimited access like the annual/business plans. Recording which
 * reports have already been spent from that quota has to happen here, with
 * the service-role key: the client can only ever SELECT its own purchases
 * rows (see the table's RLS policies), never INSERT one, so it can't grant
 * itself access by writing a fake usage row itself.
 *
 * Called once, right when the user actually opens a report they haven't
 * unlocked yet — never just from rendering the button label, or every
 * page view would silently burn through the cap. Once a report is spent
 * from the quota it stays unlocked for good (same model as a one-time
 * "report" purchase) — the unique index on (user_id, report_signature)
 * where kind='monthly_usage' both enforces that and stops two parallel
 * tabs opening the same property from double-counting it.
 *
 * Cycle boundaries are computed from the monthly plan's own created_at,
 * not a Stripe renewal webhook — this project has none yet, so this
 * follows the same fixed-expiry-at-checkout-time pattern already used for
 * the subscription/business plans in verify-checkout-session.js.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";
const MONTHLY_QUOTA = 3;
const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

async function getAuthenticatedUserId(authHeader) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
  });
  if (!r.ok) return null;
  const user = await r.json();
  return user?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ allowed: false, error: "POST required" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ allowed: false, error: "Not configured on the server yet." });
  }

  const userId = await getAuthenticatedUserId(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ allowed: false, error: "Please sign in first." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ allowed: false, error: "Invalid JSON body" });
  }
  const signature = String(body?.reportSignature || "").slice(0, 300);
  if (!signature) {
    return res.status(400).json({ allowed: false, error: "Missing reportSignature" });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/purchases?user_id=eq.${encodeURIComponent(userId)}&select=kind,report_signature,expires_at,created_at`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!r.ok) return res.status(502).json({ allowed: false, error: "Could not read entitlements." });
    const rows = await r.json();
    const now = Date.now();

    // Already has real access another way (one-time purchase, unlimited
    // plan, or this exact report was already spent from a previous month's
    // quota) — nothing to consume.
    const alreadyHasAccess = rows.some((row) => {
      if (row.kind === "subscription" || row.kind === "business") return row.expires_at && new Date(row.expires_at).getTime() > now;
      return (row.kind === "report" || row.kind === "monthly_usage") && row.report_signature === signature;
    });
    if (alreadyHasAccess) return res.status(200).json({ allowed: true });

    const monthlyRow = rows.find((row) => row.kind === "monthly" && row.expires_at && new Date(row.expires_at).getTime() > now);
    if (!monthlyRow) return res.status(200).json({ allowed: false, error: "No active monthly plan." });

    const anchor = new Date(monthlyRow.created_at).getTime();
    const cyclesElapsed = Math.floor((now - anchor) / CYCLE_MS);
    const cycleStart = anchor + cyclesElapsed * CYCLE_MS;
    const usedThisCycle = rows.filter((row) => row.kind === "monthly_usage" && new Date(row.created_at).getTime() >= cycleStart).length;
    if (usedThisCycle >= MONTHLY_QUOTA) {
      return res.status(200).json({ allowed: false, error: "Monthly report limit reached for this cycle." });
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ user_id: userId, kind: "monthly_usage", report_signature: signature })
    });
    if (!insertRes.ok) {
      const text = await insertRes.text().catch(() => "");
      return res.status(502).json({ allowed: false, error: `Could not record usage: ${text.slice(0, 200)}` });
    }
    return res.status(200).json({ allowed: true });
  } catch (error) {
    return res.status(500).json({ allowed: false, error: String(error?.message || error) });
  }
}
