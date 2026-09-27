/* PRADIXIUM™ — Stripe Billing Portal session creator
 * Self-service subscription management (cancel, update payment method) for
 * signed-in subscribers. Required so cancellation is at least as easy as
 * signing up, not "email us to cancel" — see terms.html section 3.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";

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
    return res.status(405).json({ error: "POST required" });
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !serviceKey) {
    return res.status(500).json({ error: "Payments are not configured on the server yet." });
  }

  const userId = await getAuthenticatedUserId(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: "Please sign in first." });
  }

  try {
    // Most recent recurring purchase for this user, to find its Stripe
    // Checkout Session and, from that, the Stripe customer to open a
    // portal session for.
    const purchasesResp = await fetch(
      `${SUPABASE_URL}/rest/v1/purchases?user_id=eq.${encodeURIComponent(userId)}&kind=in.(subscription,business)&order=created_at.desc&limit=1&select=stripe_session_id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const rows = await purchasesResp.json().catch(() => null);
    const stripeSessionId = rows?.[0]?.stripe_session_id;
    if (!stripeSessionId) {
      return res.status(404).json({ error: "No active subscription found for this account." });
    }

    const sessionResp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(stripeSessionId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const session = await sessionResp.json();
    if (!sessionResp.ok || !session?.customer) {
      return res.status(502).json({ error: "Could not find your billing account with Stripe." });
    }

    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = `${proto}://${req.headers.host}`;
    const params = new URLSearchParams();
    params.set("customer", session.customer);
    params.set("return_url", `${origin}/index.html`);

    const portalResp = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    const portal = await portalResp.json();
    if (!portalResp.ok) {
      return res.status(502).json({ error: portal?.error?.message || "Stripe rejected the portal request." });
    }
    return res.status(200).json({ url: portal.url });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
