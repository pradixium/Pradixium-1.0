/* PRADIXIUM™ — Stripe Checkout session creator
 * Three ways to pay for the full report (report.html):
 * - "report": one-time $29.99 unlock for a single property.
 * - "monthly": $29.99/month for individuals, capped at 3 reports per cycle
 *   (see api/consume-monthly-slot.js for how that cap is enforced) — the
 *   flexible entry point for someone who isn't ready to commit to a year.
 * - "subscription": $2,999.99/year for unlimited reports (individual investors).
 * - "business": $299.99/month for unlimited reports (companies & institutions
 *   — banks, funds, agencies; see the Business Solutions page).
 * Uses Stripe's plain REST API directly (form-encoded POST) rather than
 * the stripe npm package — this project has zero dependencies by design,
 * and Stripe's API is simple enough not to need an SDK.
 *
 * The app already requires a signed-in Supabase account before any
 * analysis (see auth-supabase.js's account gate), so every caller here
 * has a real session. This endpoint verifies that session's access
 * token directly with Supabase and stamps the resulting user id into
 * the Stripe session's metadata — verify-checkout-session.js reads that
 * metadata back from Stripe's own record (never from anything the
 * client claims) to know who to grant access to.
 *
 * Requires STRIPE_SECRET_KEY as a Vercel environment variable. Never
 * hardcode it — Stripe secret keys must never appear in client code or
 * git history.
 */
const REPORT_PRICE_USD_CENTS = 2999; // $29.99 one-time
const MONTHLY_PRICE_USD_CENTS = 2999; // $29.99 / month (individual, capped at 3 reports/cycle)
const SUBSCRIPTION_PRICE_USD_CENTS = 299999; // $2,999.99 / year (individual)
const BUSINESS_PRICE_USD_CENTS = 29999; // $299.99 / month (companies & institutions — banks, funds, agencies)

// Same public project URL/anon key already committed in supabase-config.js
// for the client — these are meant to be public (RLS is what actually
// protects the data), so hardcoding them here matches that existing
// convention rather than introducing a second, inconsistent one.
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
  if (!apiKey) {
    return res.status(500).json({ error: "Payments are not configured on the server yet." });
  }

  const userId = await getAuthenticatedUserId(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: "Please sign in before purchasing." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const plan = body?.plan === "subscription" ? "subscription" : (body?.plan === "business" ? "business" : (body?.plan === "monthly" ? "monthly" : "report"));
  const propertyTitle = String(body?.propertyTitle || "Property analysis").slice(0, 200);
  const reportSignature = String(body?.reportSignature || "").slice(0, 300);
  if (plan === "report" && !reportSignature) {
    return res.status(400).json({ error: "Missing reportSignature" });
  }
  // Affiliate/referral program: the client reads this from a ?ref= URL
  // param at first visit (see engine.js) and resends it on every checkout.
  // Restricted to a safe charset since it flows into Stripe metadata and
  // back into a Supabase column — never free text.
  const referralCodeRaw = String(body?.referralCode || "").trim().slice(0, 40);
  const referralCode = /^[A-Za-z0-9_-]+$/.test(referralCodeRaw) ? referralCodeRaw : null;

  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${req.headers.host}`;

  const params = new URLSearchParams();
  // Lets Stripe's own hosted checkout page show a "Enter promo code" field
  // — for time-limited/capped launch coupons (e.g. "first 20 free
  // REPORTS", created and managed directly in the Stripe Dashboard,
  // Coupons -> Promotion codes). Deliberately scoped to the one-time
  // "report" plan only: a real bug found live (Sept 2026) let the same
  // 100%-off launch coupon apply to the recurring $299.99/month Business
  // plan (or the annual/monthly subscriptions), giving away a full paid
  // month and burning one of the scarce 20 redemptions meant for report
  // testimonials. No code here validates or tracks redemptions; Stripe
  // enforces max_redemptions/expiry itself.
  if (plan === "report") params.set("allow_promotion_codes", "true");
  // {CHECKOUT_SESSION_ID} is a literal Stripe template placeholder.
  // URLSearchParams percent-encodes the braces as part of the form value,
  // which is correct: Stripe decodes the submitted form field first (like
  // any x-www-form-urlencoded body), getting back this exact literal
  // string, and only then substitutes the real session ID into it.
  params.set("success_url", `${origin}/index.html?unlock=1&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/index.html?checkout=cancelled`);
  // Managed Payments (on by default on newer Stripe accounts) requires a
  // tax_code on every line item unless disabled — this account isn't set
  // up with Stripe Tax, so disable it for these sessions rather than
  // guessing a tax code.
  params.set("managed_payments[enabled]", "false");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("metadata[user_id]", userId);
  params.set("metadata[plan]", plan);
  if (plan === "report") params.set("metadata[report_signature]", reportSignature);
  if (referralCode) params.set("metadata[referral_code]", referralCode);

  if (plan === "subscription" || plan === "business" || plan === "monthly") {
    params.set("mode", "subscription");
    if (plan === "business") {
      // Companies & institutions (banks, funds, agencies — see the
      // Business Solutions page) get the same unlimited-reports access as
      // the individual annual plan, priced monthly instead of yearly and
      // with no trial — an institutional buyer isn't the same sale motion
      // as an individual trying the product out.
      params.set("line_items[0][price_data][product_data][name]", "Pradixium Business — Unlimited Reports (Monthly)");
      params.set("line_items[0][price_data][unit_amount]", String(BUSINESS_PRICE_USD_CENTS));
      params.set("line_items[0][price_data][recurring][interval]", "month");
    } else if (plan === "monthly") {
      // Individual, capped at 3 reports/cycle (enforced in
      // api/consume-monthly-slot.js) — no trial, same reasoning as business:
      // this plan already costs the same as one single report, so there's
      // nothing to "try" that a trial would add.
      params.set("line_items[0][price_data][product_data][name]", "Pradixium Individual Monthly — Up to 3 Reports");
      params.set("line_items[0][price_data][unit_amount]", String(MONTHLY_PRICE_USD_CENTS));
      params.set("line_items[0][price_data][recurring][interval]", "month");
    } else {
      params.set("line_items[0][price_data][product_data][name]", "Pradixium Unlimited Reports — Annual");
      params.set("line_items[0][price_data][unit_amount]", String(SUBSCRIPTION_PRICE_USD_CENTS));
      params.set("line_items[0][price_data][recurring][interval]", "year");
      // 7-day free trial, card collected upfront — Stripe auto-charges the
      // full annual price the moment the trial ends unless the customer
      // cancels first. Aimed at repeat users (agents with a constant stream
      // of new listings to check), not the one-time $29.99 report below, which
      // has no trial since there's nothing recurring to try out.
      params.set("subscription_data[trial_period_days]", "7");
    }
    // Recurring Checkout Sessions don't carry metadata onto the
    // subscription/invoice automatically — attach it to the subscription
    // object too in case a future webhook needs it independent of this
    // one session.
    params.set("subscription_data[metadata][user_id]", userId);
    params.set("subscription_data[metadata][plan]", plan);
    if (referralCode) params.set("subscription_data[metadata][referral_code]", referralCode);
  } else {
    params.set("mode", "payment");
    params.set("line_items[0][price_data][product_data][name]", `Pradixium Full Property Report — ${propertyTitle}`);
    params.set("line_items[0][price_data][unit_amount]", String(REPORT_PRICE_USD_CENTS));
  }

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const session = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: session?.error?.message || "Stripe rejected the checkout request." });
    }
    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
