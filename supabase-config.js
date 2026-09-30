/* PRADIXIUM SUPABASE CONFIG
 * Fill these two values in from your Supabase project:
 * Supabase Dashboard -> Project Settings -> API
 *   - "Project URL"      -> PRADIXIUM_SUPABASE_URL
 *   - "anon public" key  -> PRADIXIUM_SUPABASE_ANON_KEY
 *
 * These are PUBLIC values (safe to expose in frontend code).
 * Supabase's Row Level Security (RLS) is what actually protects your data,
 * not secrecy of this key. Do NOT put your "service_role" key here — ever.
 */
window.PRADIXIUM_SUPABASE_URL = 'https://wjafpyfawtacauygzgqd.supabase.co';
window.PRADIXIUM_SUPABASE_ANON_KEY = 'sb_publishable_v1qAMQNVqT7WAsfaGyGK_g_8p_zFD8K';

/* Cloudflare Turnstile CAPTCHA (bot protection on sign up / sign in /
 * password reset). This is the PUBLIC "Site Key" from your Turnstile
 * dashboard -- safe to expose in frontend code. The matching SECRET key
 * goes only into Supabase Dashboard -> Authentication -> Sign In / Providers
 * -> Bot and Abuse Protection, never here.
 *
 * Leave empty to keep CAPTCHA off (auth-supabase.js skips rendering the
 * widget entirely when this is blank) -- fill it in once you have a real
 * Turnstile site key, then enable "Enable CAPTCHA protection" in the
 * Supabase Dashboard.
 */
window.PRADIXIUM_TURNSTILE_SITE_KEY = '0x4AAAAAAFJdThPtpkEHD45';
