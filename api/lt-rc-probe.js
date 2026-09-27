/* PRADIXIUM™ — temporary reachability probe (not linked anywhere).
 * Checks whether Vercel can load Registrų centras' public "average market
 * value" search page and reports only the page status and its form
 * structure (form action, method, field names) — no property data.
 * Delete once the Lithuanian mass-valuation integration is decided.
 */
export default async function handler(req, res) {
  const url = "https://www.registrucentras.lt/masvert/paieska-un";
  try {
    const r = await fetch(url, { headers: { "user-agent": "Pradixium/1.0 (+https://pradixium.com)", accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    const html = await r.text();
    const forms = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((m) => ({
      action: (m[1].match(/action="([^"]*)"/i) || [])[1] || null,
      method: (m[1].match(/method="([^"]*)"/i) || [])[1] || null,
      fields: [...m[2].matchAll(/<(input|select|textarea)\b[^>]*name="([^"]*)"[^>]*>/gi)].map((f) => ({ tag: f[1], name: f[2], type: (f[0].match(/type="([^"]*)"/i) || [])[1] || null, value: /type="hidden"/i.test(f[0]) ? ((f[0].match(/value="([^"]*)"/i) || [])[1] || "").slice(0, 40) : undefined }))
    }));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ status: r.status, title: (html.match(/<title>([^<]*)/i) || [])[1] || null, challenge: /Just a moment|cf-chl|challenge-platform/i.test(html), forms, options: [...html.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/gi)].slice(0, 20).map((o) => [o[1], o[2].trim()]) });
  } catch (e) {
    return res.status(200).json({ error: e.message });
  }
}
