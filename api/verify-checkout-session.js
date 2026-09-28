/* PRADIXIUM™ — Stripe Checkout session verifier
 * Called by the client after Stripe redirects back with a session_id.
 * Confirms payment_status directly with Stripe's own API — never trusts
 * anything in the URL or request body — then grants access by writing a
 * row to Supabase's purchases table using the service role key (the only
 * writer to that table; see the migration comment on the table's RLS
 * policy). who/what is granted comes entirely from session.metadata,
 * which Stripe stores immutably from when create-checkout-session.js
 * created the session — never from anything the client re-supplies here.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";

async function grantEntitlement({ userId, plan, reportSignature, stripeSessionId, subscriptionExpiresAt, referralCode }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");

  const row = {
    user_id: userId,
    kind: plan,
    report_signature: plan === "report" ? reportSignature : null,
    stripe_session_id: stripeSessionId,
    expires_at: (plan === "subscription" || plan === "business" || plan === "monthly") ? subscriptionExpiresAt : null,
    referral_code: referralCode || null
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      // Idempotent: verifying the same session twice (e.g. a page reload
      // on the success URL) must not insert a duplicate row — rely on
      // the unique constraint on stripe_session_id and ignore conflicts.
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify(row)
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Supabase insert failed: HTTP ${r.status} ${text.slice(0, 300)}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "GET required" });
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: "Payments are not configured on the server yet." });
  }

  const sessionId = String(req.query?.session_id || "").trim();
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "Missing session_id" });
  }

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const session = await r.json();
    if (!r.ok) {
      return res.status(502).json({ success: false, error: session?.error?.message || "Stripe rejected the lookup." });
    }

    // A subscription checkout with a trial charges $0 today, so Stripe
    // reports "no_payment_required" rather than "paid" — still a fully
    // valid signup (card is on file; Stripe auto-charges when the trial
    // ends), so it must grant access the same as an immediate payment.
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (!paid) {
      return res.status(200).json({ success: true, paid: false });
    }

    const userId = session.metadata?.user_id;
    const metaPlan = session.metadata?.plan;
    const plan = metaPlan === "subscription" ? "subscription" : (metaPlan === "business" ? "business" : (metaPlan === "monthly" ? "monthly" : "report"));
    const reportSignature = session.metadata?.report_signature || null;
    const referralCode = session.metadata?.referral_code || null;
    if (!userId) {
      return res.status(200).json({ success: true, paid: true, granted: false, error: "Payment succeeded but no user was attached to this session." });
    }

    // The annual plan grants unlimited-reports access for a full year from
    // when Stripe actually starts billing (not 365 days from today, which
    // would cut access 7 days before the real first-year billing
    // anniversary, since it includes the 7-day trial). Business and monthly
    // are both billed monthly with no trial, so a month plus a few days'
    // grace for the next renewal to land before access lapses; monthly's
    // access is further capped per-cycle by api/consume-monthly-slot.js,
    // this expiry only bounds how long the plan itself is considered active.
    const subscriptionExpiresAt = plan === "subscription"
      ? new Date(Date.now() + 372 * 24 * 60 * 60 * 1000).toISOString()
      : (plan === "business" || plan === "monthly")
        ? new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    await grantEntitlement({ userId, plan, reportSignature, stripeSessionId: session.id, subscriptionExpiresAt, referralCode });

    return res.status(200).json({ success: true, paid: true, granted: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error?.message || error) });
  }
}
