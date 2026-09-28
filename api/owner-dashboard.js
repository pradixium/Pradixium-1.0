/* PRADIXIUM™ — Owner dashboard data
 * A private, single-owner view of real signups and purchases — not a
 * customer-facing feature. Gated by a shared secret (OWNER_DASHBOARD_KEY,
 * set in Vercel's environment settings) rather than a specific email,
 * since Supabase auth.users isn't queryable this way and there's no
 * existing "admin" role concept in this project — same "kept deliberately
 * simple" philosophy already used for the Business API key feature.
 *
 * Same honesty rule as the rest of this project: this reports what the
 * purchases table actually contains, not an inferred/projected revenue
 * number. There is still no Stripe renewal webhook in this project (see
 * api/consume-monthly-slot.js's own comment on the same gap), so a
 * subscription/monthly/business row here is only ever the INITIAL sale —
 * recurring renewals are not tracked as separate rows and are not double
 * counted, but they are also not reflected as ongoing revenue. The
 * dashboard says this plainly rather than presenting a number that looks
 * like real recurring revenue.
 */
const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";

// Same constants as api/create-checkout-session.js — the price actually
// charged for each plan's initial sale.
const PRICE_USD_CENTS = { report: 2999, monthly: 2999, subscription: 299999, business: 29999 };
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
  const r = await fetch(`${SUPABASE_URL}/rest/v1/purchases?select=user_id,kind,created_at,referral_code&order=created_at.desc&limit=500`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!r.ok) throw new Error(`purchases query returned HTTP ${r.status}`);
  return await r.json();
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
  if (!serviceKey) {
    return res.status(500).json({ success: false, error: "Not configured on the server yet." });
  }

  try {
    const [users, purchases] = await Promise.all([fetchAllUsers(serviceKey), fetchPurchases(serviceKey)]);
    const emailByUserId = new Map(users.map((u) => [u.id, u.email || null]));

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newUsers30d = users.filter((u) => u.created_at && new Date(u.created_at).getTime() > thirtyDaysAgo).length;

    // monthly_usage rows are an internal quota-tracking marker (see
    // api/consume-monthly-slot.js) — never a real Stripe charge, so they're
    // excluded from both the plan breakdown and the revenue total.
    const realPurchases = purchases.filter((p) => p.kind !== "monthly_usage");
    const byKind = {};
    for (const p of realPurchases) {
      byKind[p.kind] = (byKind[p.kind] || 0) + 1;
    }
    const planBreakdown = Object.entries(byKind).map(([kind, count]) => ({
      kind,
      label: PLAN_LABEL[kind] || kind,
      count,
      revenueCents: count * (PRICE_USD_CENTS[kind] || 0)
    }));
    const totalRevenueCents = planBreakdown.reduce((sum, p) => sum + p.revenueCents, 0);

    const recentPurchases = realPurchases.slice(0, 20).map((p) => ({
      email: emailByUserId.get(p.user_id) || null,
      kind: p.kind,
      label: PLAN_LABEL[p.kind] || p.kind,
      createdAt: p.created_at,
      referralCode: p.referral_code || null
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
      planBreakdown,
      recentPurchases,
      recentSignups
    });
  } catch (e) {
    return res.status(502).json({ success: false, error: String(e?.message || e) });
  }
}
