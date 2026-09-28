/* PRADIXIUM™ — Owner dashboard data
 * A private, single-owner view of real signups and purchases — not a
 * customer-facing feature. Gated by a shared secret (OWNER_DASHBOARD_KEY,
 * set in Vercel's environment settings) rather than a specific email,
 * since Supabase auth.users isn't queryable this way and there's no
 * existing "admin" role concept in this project — same "kept deliberately
 * simple" philosophy already used for the Business API key feature.
 *
 * FIX (found live): revenue was first computed as count × TODAY'S price
 * constant per plan kind. But api/create-checkout-session.js's prices
 * have changed over time (the annual plan alone went from $299.00/yr to
 * $2,999.99/yr on Sept 28, 2026) — the one real "subscription" purchase
 * in the database is dated Sept 18, so it was actually charged the OLD
 * $299.00 price, and reporting it as $2,999.99 overstated real revenue
 * by 10x. purchases has no stored amount column, so the only honest
 * source of the REAL charged amount is Stripe's own record of that
 * checkout session (stripe_session_id) — this now reads amount_total
 * directly from Stripe for every purchase instead of assuming a static
 * price, same "never guess, look it up" rule as everywhere else in this
 * project. A session Stripe can't return (network failure, or an old
 * pre-Stripe-integration test row with no session id) is reported as
 * "amount unknown," not silently priced at today's rate.
 *
 * Same honesty rule for the recurring-plan gap: there is still no Stripe
 * renewal webhook in this project (see api/consume-monthly-slot.js's own
 * comment on the same gap), so a subscription/monthly/business row here
 * is only ever the checkout session's own charge — usually the initial
 * sale (or, if a trial applied, the eventual first real charge already
 * reflected by Stripe by the time this runs). Renewals after that are
 * not tracked as separate rows and are not reflected as ongoing revenue.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const PLAN_LABEL = { report: "One-time report", monthly: "Individual monthly", subscription: "Individual annual", business: "Business" };

async function fetchAllUsers(serviceKey) {
  // GoTrue admin API — the only way to read auth.users without a direct
  // Postgres connection, which this serverless function doesn't have.
  // Simple single-page fetch (no pagination loop): fine for an early-stage
  // site with a handful of signups; revisit if this ever needs to scale
  // past a few thousand users.
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!r.ok) throw new Error(`Auth admin API returned HTTP ${r.status}`);
  const json = await r.json();
  return Array.isArray(json?.users) ? json.users : [];
}

async function fetchPurchases(serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/purchases?select=user_id,kind,created_at,referral_code,stripe_session_id&order=created_at.desc&limit=500`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!r.ok) throw new Error(`purchases query returned HTTP ${r.status}`);
  return await r.json();
}

// The real amount Stripe actually charged for this checkout session, in
// cents — null (not a guess) if the session can't be read.
async function fetchStripeAmountCents(stripeKey, sessionId) {
  if (!sessionId) return null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` }
    });
    if (!r.ok) return null;
    const json = await r.json();
    return Number.isFinite(json?.amount_total) ? json.amount_total : null;
  } catch {
    return null;
  }
}

// Bounded concurrency so this doesn't fire hundreds of parallel Stripe
// requests at once as purchases grow — same pool-of-workers pattern
// business-portfolio.html already uses for orchestrator calls.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const dashboardKey = process.env.OWNER_DASHBOARD_KEY;
  if (!dashboardKey) {
    return res.status(500).json({ success: false, error: "OWNER_DASHBOARD_KEY is not configured on the server yet." });
  }
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!supplied || supplied !== dashboardKey) {
    return res.status(401).json({ success: false, error: "Not authorized." });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!serviceKey || !stripeKey) {
    return res.status(500).json({ success: false, error: "Not configured on the server yet." });
  }

  try {
    const [users, purchases] = await Promise.all([fetchAllUsers(serviceKey), fetchPurchases(serviceKey)]);
    const emailByUserId = new Map(users.map((u) => [u.id, u.email || null]));

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newUsers30d = users.filter((u) => u.created_at && new Date(u.created_at).getTime() > thirtyDaysAgo).length;

    // monthly_usage rows are an internal quota-tracking marker (see
    // api/consume-monthly-slot.js) — never a real Stripe charge, so they're
    // excluded from both the plan breakdown and the revenue total. They
    // also have no stripe_session_id, so skipping them first avoids a
    // wasted Stripe lookup per report opened against the monthly quota.
    const realPurchases = purchases.filter((p) => p.kind !== "monthly_usage");
    const amounts = await mapWithConcurrency(realPurchases, 5, (p) => fetchStripeAmountCents(stripeKey, p.stripe_session_id));

    const byKind = {};
    let unresolvedCount = 0;
    realPurchases.forEach((p, i) => {
      const cents = amounts[i];
      if (cents == null) { unresolvedCount++; return; }
      if (!byKind[p.kind]) byKind[p.kind] = { count: 0, revenueCents: 0 };
      byKind[p.kind].count++;
      byKind[p.kind].revenueCents += cents;
    });
    const planBreakdown = Object.entries(byKind).map(([kind, v]) => ({ kind, label: PLAN_LABEL[kind] || kind, count: v.count, revenueCents: v.revenueCents }));
    const totalRevenueCents = planBreakdown.reduce((sum, p) => sum + p.revenueCents, 0);

    const recentPurchases = realPurchases.slice(0, 20).map((p, i) => ({
      email: emailByUserId.get(p.user_id) || null,
      kind: p.kind,
      label: PLAN_LABEL[p.kind] || p.kind,
      createdAt: p.created_at,
      referralCode: p.referral_code || null,
      amountCents: amounts[i]
    }));
    const recentSignups = [...users]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20)
      .map((u) => ({ email: u.email || null, createdAt: u.created_at }));

    return res.status(200).json({
      success: true,
      totalUsers: users.length,
      newUsers30d,
      totalPurchases: realPurchases.length,
      totalRevenueCents,
      unresolvedCount,
      planBreakdown,
      recentPurchases,
      recentSignups
    });
  } catch (e) {
    return res.status(502).json({ success: false, error: String(e?.message || e) });
  }
}
