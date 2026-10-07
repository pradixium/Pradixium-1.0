/* PRADIXIUM™ — free plan grant for the first 1,000 customers
 * The user's observation: Israeli buyers in particular are scam-wary
 * (frequent Ministry of Economy fraud warnings), and even seeing Stripe's
 * hosted checkout page — a price, a card form — before a promo code is
 * typed deters people before they ever learn it's free. This bypasses
 * Stripe entirely for the first 1,000 people, across every plan (the
 * one-time report, monthly, annual and business): no checkout page, no
 * card, just a direct grant. One grant per account; the 1,000 slots are
 * one shared pool across all four plans, not 1,000 each. Stripe is left
 * untouched for everyone past that pool.
 *
 * Same service-role-only, race-free pattern as api/consume-monthly-slot.js
 * — the client can only ever SELECT its own purchases rows (RLS), never
 * INSERT one, so it can't grant itself access by calling this with a fake
 * result. The real check+insert happens atomically, under a global
 * advisory lock shared by both Postgres functions below, so concurrent
 * claims (for any plan) can't push the shared count past the cap:
 *   - plan "report" -> claim_free_report() (migration
 *     add_claim_free_report_atomic_function) — per-property, needs a
 *     reportSignature.
 *   - plan "monthly"/"subscription"/"business" -> claim_free_plan()
 *     (migration add_claim_free_plan_atomic_function) — account-level,
 *     grants the same access window api/verify-checkout-session.js would
 *     after a real Stripe payment (372 days for subscription, 35 for
 *     monthly/business).
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";
const FREE_GRANT_CAP = 1000;
const PLAN_KINDS = new Set(["monthly", "subscription", "business"]);

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

  const plan = String(body?.plan || "report").toLowerCase();
  let rpcName, rpcBody;

  if (plan === "report") {
    const signature = String(body?.reportSignature || "").slice(0, 300);
    if (!signature) {
      return res.status(400).json({ allowed: false, error: "Missing reportSignature" });
    }
    rpcName = "claim_free_report";
    rpcBody = { p_user_id: userId, p_signature: signature, p_cap: FREE_GRANT_CAP };
  } else if (PLAN_KINDS.has(plan)) {
    rpcName = "claim_free_plan";
    rpcBody = { p_user_id: userId, p_kind: plan, p_cap: FREE_GRANT_CAP };
  } else {
    return res.status(400).json({ allowed: false, error: "Unknown plan." });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(rpcBody)
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).json({ allowed: false, error: `Could not check/claim free plan: ${text.slice(0, 200)}` });
    }
    const result = await r.json();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ allowed: false, error: String(error?.message || error) });
  }
}
