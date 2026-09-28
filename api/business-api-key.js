/* PRADIXIUM™ — Business API key management
 * Lets a Business-plan account generate an API key so their own systems
 * can call api/orchestrator.js directly (see that file's checkEntitlement()
 * for how the key is accepted as an alternate Authorization bearer token)
 * — the "API access for companies" differentiator from CLAUDE.md's
 * Business-plan differentiation notes.
 *
 * Only the key's SHA-256 hash is ever stored (table api_keys, service-role
 * writes only — see its migration comment); the plaintext is returned to
 * the caller exactly once, right here, and never again. One active key per
 * account at a time, to keep this simple for a non-technical business
 * owner: generating a new one revokes whatever key existed before.
 */
import { createHash, randomBytes } from "node:crypto";

const SUPABASE_URL = "https://wjafpyfawtacauygzgqd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K";

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

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

async function hasActiveBusinessPlan(serviceKey, userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?user_id=eq.${encodeURIComponent(userId)}&kind=eq.business&select=expires_at`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!r.ok) return false;
  const rows = await r.json();
  const now = Date.now();
  return rows.some((row) => row.expires_at && new Date(row.expires_at).getTime() > now);
}

export default async function handler(req, res) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ success: false, error: "Not configured on the server yet." });
  }

  const userId = await getAuthenticatedUserId(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Please sign in first." });
  }

  if (!(await hasActiveBusinessPlan(serviceKey, userId))) {
    return res.status(403).json({ success: false, error: "API access requires an active Business plan." });
  }

  if (req.method === "POST") {
    // Revoke any existing key first — one active key per account.
    await fetch(`${SUPABASE_URL}/rest/v1/api_keys?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ revoked_at: new Date().toISOString() })
    });

    const rawKey = "px_live_" + randomBytes(24).toString("hex");
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/api_keys`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, key_hash: hashKey(rawKey), key_prefix: rawKey.slice(0, 16) })
    });
    if (!insertRes.ok) {
      const text = await insertRes.text().catch(() => "");
      return res.status(502).json({ success: false, error: `Could not create key: ${text.slice(0, 200)}` });
    }
    return res.status(200).json({ success: true, apiKey: rawKey });
  }

  if (req.method === "DELETE") {
    // FIX: the Supabase PATCH result used to be discarded — this always
    // reported success:true to the client even when the revoke itself
    // failed (RLS, network, Supabase outage), so the UI told the owner of
    // a leaked key that it was safely revoked while it was still live.
    const revokeRes = await fetch(`${SUPABASE_URL}/rest/v1/api_keys?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ revoked_at: new Date().toISOString() })
    });
    if (!revokeRes.ok) {
      const text = await revokeRes.text().catch(() => "");
      return res.status(502).json({ success: false, error: `Could not revoke key: ${text.slice(0, 200)}` });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "POST or DELETE required" });
}
