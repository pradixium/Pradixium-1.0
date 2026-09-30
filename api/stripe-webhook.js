/* PRADIXIUM™ — Stripe subscription-renewal webhook
 * FIX (Sept 30 2026, found by the recurring oversight routine): the only
 * place any subscription/business/monthly plan's `purchases.expires_at`
 * was ever set was verify-checkout-session.js, run ONCE right after the
 * initial checkout. That endpoint is never called again on renewal --
 * Stripe renews a Subscription in place, with no new Checkout Session --
 * so a real subscriber's expires_at (35 days for business/monthly, 372
 * for the annual plan's trial+year) would lapse on schedule even though
 * Stripe kept charging them successfully every cycle. api/orchestrator.js's
 * checkEntitlement() checks that same expires_at on every single report
 * request, so the practical effect is: a paying customer loses all access
 * partway through their first still-active subscription. Hadn't fired yet
 * (0 real subscription/business/monthly rows existed when found) but was
 * certain to the moment anyone actually stayed subscribed past ~35 days.
 *
 * This endpoint listens for Stripe's `invoice.payment_succeeded` event,
 * which fires on every successful charge including renewals, and rolls
 * expires_at forward from the payment moment using the exact same
 * duration rule verify-checkout-session.js already uses. Zero dependencies
 * by design (same convention as the rest of this project's api/*.js) --
 * the Stripe signature check is a plain HMAC-SHA256 over the raw body via
 * Node's built-in crypto, not the stripe npm package.
 *
 * Requires STRIPE_SECRET_KEY (already set) and a new
 * STRIPE_WEBHOOK_SECRET Vercel env var -- the signing secret Stripe hands
 * back when the webhook endpoint is registered (Dashboard, or the
 * PostWebhookEndpoints API call that created it). Without that env var
 * set, every event is rejected rather than trusted unverified.
 */
export const config = { api: { bodyParser: false } };

const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SIGNATURE_TOLERANCE_SECONDS = 300; // matches Stripe's own SDK default

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function verifyStripeSignature(rawBody, header, secret) {
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const parts = String(header || "").split(",");
  let timestamp = null;
  const v1Signatures = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "t") timestamp = value;
    else if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || !v1Signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  return v1Signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "hex");
    return sigBuf.length === expectedBuf.length && timingSafeEqual(expectedBuf, sigBuf);
  });
}

// Same rule verify-checkout-session.js uses at initial checkout: the
// annual plan's trial+year, business/monthly's month-plus-grace.
function expiresAtFor(plan) {
  const days = plan === "subscription" ? 372 : 35;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function extendEntitlement({ userId, plan, expiresAt, stripeSessionId }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");

  // Update the existing row from the original checkout (the normal case).
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?user_id=eq.${encodeURIComponent(userId)}&kind=eq.${encodeURIComponent(plan)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ expires_at: expiresAt })
    }
  );
  if (!patchRes.ok) {
    const text = await patchRes.text().catch(() => "");
    throw new Error(`Supabase patch failed: HTTP ${patchRes.status} ${text.slice(0, 300)}`);
  }
  const updatedRows = await patchRes.json().catch(() => []);
  if (Array.isArray(updatedRows) && updatedRows.length > 0) return;

  // No existing row (shouldn't normally happen -- the initial checkout
  // always creates one) -- insert one so this renewal isn't lost.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify({ user_id: userId, kind: plan, expires_at: expiresAt, stripe_session_id: stripeSessionId })
  });
  if (!insertRes.ok) {
    const text = await insertRes.text().catch(() => "");
    throw new Error(`Supabase insert failed: HTTP ${insertRes.status} ${text.slice(0, 300)}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required" });
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) {
    return res.status(500).json({ error: "Stripe webhook is not configured on the server yet." });
  }

  const rawBody = await readRawBody(req);
  const signatureHeader = req.headers["stripe-signature"];
  const verified = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret).catch(() => false);
  if (!verified) {
    return res.status(400).json({ error: "Invalid signature." });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  // Acknowledge everything else -- Stripe retries on non-2xx, and this
  // webhook is only registered for invoice.payment_succeeded anyway.
  if (event?.type !== "invoice.payment_succeeded") {
    return res.status(200).json({ received: true, ignored: event?.type || null });
  }

  try {
    const invoice = event.data?.object || {};
    const subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription || null;
    if (!subscriptionId) {
      return res.status(200).json({ received: true, ignored: "no subscription on this invoice" });
    }

    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const subscription = await subRes.json();
    if (!subRes.ok) {
      return res.status(502).json({ error: subscription?.error?.message || "Stripe rejected the subscription lookup." });
    }

    const userId = subscription.metadata?.user_id;
    const metaPlan = subscription.metadata?.plan;
    const plan = metaPlan === "subscription" ? "subscription" : (metaPlan === "business" ? "business" : (metaPlan === "monthly" ? "monthly" : null));
    if (!userId || !plan) {
      // Older subscriptions created before subscription_data[metadata] was
      // added won't carry this -- nothing safe to do without knowing who.
      return res.status(200).json({ received: true, ignored: "subscription has no user_id/plan metadata" });
    }

    await extendEntitlement({ userId, plan, expiresAt: expiresAtFor(plan), stripeSessionId: `renewal_${invoice.id || subscriptionId}_${Date.now()}` });
    return res.status(200).json({ received: true, extended: true, plan });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
