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
 *
 * FIX (Sept 2026): the quota check and the usage INSERT used to be two
 * separate round trips from this function (a SELECT to count usedThisCycle,
 * then a POST to insert) -- two requests for two DIFFERENT properties
 * arriving close together could each pass the count check before either
 * INSERT committed, letting more than MONTHLY_QUOTA reports through in one
 * cycle. Both steps now happen inside one Postgres function
 * (consume_monthly_slot, migration add_consume_monthly_slot_atomic_function)
 * that takes a per-user advisory lock before checking+inserting, so two
 * concurrent calls for the same user are serialized instead of racing.
 * Verified live: 4 concurrent calls against a quota of 3 correctly let
 * exactly 3 through and rejected the 4th, and re-consuming an
 * already-spent signature stays idempotent (no duplicate row, still
 * allowed:true) -- tested against a scratch purchases row, cleaned up
 * after. That same testing also caught a second, unrelated real bug: this
 * table's stripe_session_id column is NOT NULL, which the old INSERT never
 * set -- every monthly-plan slot consumption was silently failing in
 * production with a 502 before this fix, regardless of the race condition.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";
const MONTHLY_QUOTA = 3;
const CYCLE_DAYS = 30;

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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_monthly_slot`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_signature: signature,
        p_quota: MONTHLY_QUOTA,
        p_cycle_days: CYCLE_DAYS
      })
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).json({ allowed: false, error: `Could not check/consume monthly quota: ${text.slice(0, 200)}` });
    }
    const result = await r.json();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ allowed: false, error: String(error?.message || error) });
  }
}
