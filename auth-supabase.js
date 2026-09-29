/* PRADIXIUM AUTH CONTROLLER — Supabase Edition
 * Single owner for Register / Login / Logout / Password Reset / Profile UI.
 * Replaces the old localStorage-only auth.js and the duplicate inline
 * auth handlers that used to live inside index.html.
 *
 * Requires (loaded before this file, in this order):
 *   1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
 *   2. /supabase-config.js  (defines window.PRADIXIUM_SUPABASE_URL / _ANON_KEY)
 */
(function () {
  'use strict';

  if (window.__pradixiumAuthController) return;
  window.__pradixiumAuthController = true;

  const $ = id => document.getElementById(id);

  // ---- Guard: make sure Supabase + config actually loaded ----
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Pradixium Auth] Supabase library failed to load. Check your network/CDN and script order.');
    const err = $('authError');
    if (err) err.textContent = 'Unable to load the sign-in system. Please refresh the page or try again shortly.';
    const submitBtn = $('authSubmit');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }
  const SUPABASE_URL = window.PRADIXIUM_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.PRADIXIUM_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || SUPABASE_URL.indexOf('YOUR-PROJECT-REF') !== -1) {
    console.error('[Pradixium Auth] supabase-config.js is not filled in yet. Auth will not work until you add your Project URL and anon key.');
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.pradixiumSupabase = client; // exposed for other scripts (e.g. saved properties, reports)

  // ---- DOM refs ----
  const gate = $('accountGate');
  const form = $('authForm');
  const signUpTab = $('signUpTab');
  const signInTab = $('signInTab');
  const nameWrap = $('nameFieldWrap');
  const title = $('authTitle');
  const subtitle = $('authSubtitle');
  const submit = $('authSubmit');
  const errorEl = $('authError');
  const nameInput = $('authName');
  const emailInput = $('authEmail');
  const passwordInput = $('authPassword');
  const accountBtn = $('accountBtn');
  const accountMenu = $('accountMenu');
  const accountName = $('accountName');
  const accountProfileBtn = $('accountProfileBtn');
  const accountLogoutBtn = $('accountLogoutBtn');

  let mode = 'signup';
  let currentUser = null;

  function setError(message) { if (errorEl) errorEl.textContent = message || ''; }

  function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    submit.style.opacity = busy ? '0.6' : '';
    if (busy) {
      submit.dataset.originalText = submit.textContent;
      submit.textContent = 'Please wait…';
    } else if (submit.dataset.originalText) {
      submit.textContent = submit.dataset.originalText;
    }
  }

  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    if (signUpTab) signUpTab.classList.toggle('active', signup);
    if (signInTab) signInTab.classList.toggle('active', !signup);
    if (nameWrap) nameWrap.style.display = signup ? '' : 'none';
    if (nameInput) nameInput.required = signup;
    if (passwordInput) passwordInput.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
    if (title) title.textContent = signup ? 'Create your Pradixium account' : 'Welcome back';
    if (subtitle) subtitle.textContent = signup
      ? 'Create a free account to unlock your full report and save your analyses.'
      : 'Sign in to continue to your Pradixium workspace.';
    if (submit) submit.textContent = signup ? 'Create Account' : 'Sign In';
    setError('');
  }

  // FIX (Sept 2026, explicit product decision): this used to force the
  // sign-up/sign-in modal open for EVERY visitor on page load, before they
  // could see anything — including the free preview. api/orchestrator.js
  // already tolerates an anonymous request (no Authorization header) and
  // simply returns the redacted/free-preview shape; startCheckout() below
  // already has its own explicit "please sign in" gate at the one point
  // that actually needs an account (paying). So this blanket up-front wall
  // was stricter than the backend itself requires, and was costing casual
  // visitors who'd otherwise have tried the free analysis first. The gate
  // now only opens on demand (showAuthGate(), called from startCheckout()
  // and anywhere else that hits a real "must be signed in" requirement),
  // never automatically just because no one is logged in yet.
  function showAuthGate(message) {
    if (!gate) return;
    gate.classList.remove('hidden');
    if (message) setError(message);
  }
  window.pradixiumShowAuthGate = showAuthGate;

  function refresh() {
    if (gate && currentUser) gate.classList.add('hidden');
    if (accountName) {
      accountName.textContent = authenticated
        ? (currentUser.user_metadata && currentUser.user_metadata.full_name) || currentUser.email
        : 'Account';
    }
  }

  // ---- Submit: sign up or sign in ----
  async function onSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setError('');

    const name = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = passwordInput?.value || '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Please enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (mode === 'signup' && !name) return setError('Please enter your full name.');

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if (error) return setError(error.message);
        if (data.user && !data.session) {
          // Email confirmation is required by the Supabase project settings.
          setMode('signin');
          setError('Account created. Check your email to confirm before signing in.');
          return;
        }
        // Session came back immediately (email confirmation disabled in project settings).
        form?.reset();
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return setError(error.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please check your details.'
          : error.message);
        form?.reset();
      }
    } catch (err) {
      console.error('[Pradixium Auth] Unexpected error during submit:', err);
      setError('Unexpected error: ' + (err && err.message ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  // ---- Forgot password (real email-based reset via Supabase) ----
  function closeModal() { const m = $('pradixiumAuthModal'); if (m) m.remove(); }
  function openModal(titleText, bodyHtml) {
    closeModal();
    const m = document.createElement('div');
    m.id = 'pradixiumAuthModal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(15,24,38,.58);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:10001;padding:20px;';
    m.innerHTML = '<div style="width:min(420px,100%);background:#fff;border:1px solid #e5e9ef;border-radius:16px;box-shadow:0 24px 70px rgba(18,31,52,.24);padding:26px">' +
      '<div style="font-size:20px;font-weight:750;color:#182232;margin-bottom:8px">' + titleText + '</div>' +
      '<div id="pradixiumModalBody">' + bodyHtml + '</div>' +
      '<button type="button" id="pradixiumModalClose" style="margin-top:16px;width:100%;height:42px;border:1px solid #d8dee7;border-radius:8px;background:#fff;color:#455160;font-weight:700;cursor:pointer">Close</button></div>';
    document.body.appendChild(m);
    $('pradixiumModalClose').onclick = closeModal;
    m.addEventListener('click', e => { if (e.target === m) closeModal(); });
    return m;
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function ensureForgotPasswordButton() {
    if (!form || !submit || $('forgotPasswordBtn')) return;
    const forgot = document.createElement('button');
    forgot.id = 'forgotPasswordBtn';
    forgot.type = 'button';
    forgot.textContent = 'Forgot Password?';
    forgot.style.cssText = 'border:0;background:transparent;color:#2463d6;font-size:11px;font-weight:700;cursor:pointer;padding:2px 0;text-align:right;margin-top:-4px;';
    form.insertBefore(forgot, submit);
    forgot.onclick = function () {
      openModal('Reset your password',
        '<p style="font-size:13px;color:#687383;line-height:1.5;margin:0 0 15px">Enter the email for your Pradixium account. We will send you a reset link.</p>' +
        '<input id="resetEmail" type="email" placeholder="you@example.com" style="width:100%;height:43px;border:1px solid #d8dee7;border-radius:8px;padding:0 12px;font-size:14px;box-sizing:border-box">' +
        '<div id="resetMsg" style="min-height:18px;color:#5f6b7b;font-size:11px;font-weight:600;margin-top:8px"></div>' +
        '<button type="button" id="resetSend" style="width:100%;height:44px;border:0;border-radius:8px;background:#2463d6;color:#fff;font-weight:750;cursor:pointer;margin-top:4px">Send Reset Link</button>');
      $('resetSend').onclick = async function () {
        const email = ($('resetEmail').value || '').trim().toLowerCase();
        const msg = $('resetMsg');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.style.color = '#c64747'; msg.textContent = 'Enter a valid email address.'; return; }
        msg.style.color = '#5f6b7b'; msg.textContent = 'Sending…';
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
        if (error) { msg.style.color = '#c64747'; msg.textContent = error.message; return; }
        msg.style.color = '#1a8f5c'; msg.textContent = 'Check your email for a reset link.';
      };
    };
  }

  // Handles the case where the user clicked the emailed reset link and landed
  // back here with a Supabase "recovery" session.
  async function handlePasswordRecovery() {
    openModal('Create a new password',
      '<p style="font-size:13px;color:#687383;line-height:1.5;margin:0 0 15px">Choose a new password of at least 6 characters.</p>' +
      '<input id="newPassword" type="password" minlength="6" placeholder="New password" style="width:100%;height:43px;border:1px solid #d8dee7;border-radius:8px;padding:0 12px;font-size:14px;box-sizing:border-box">' +
      '<div id="newPasswordMsg" style="min-height:18px;color:#c64747;font-size:11px;font-weight:600;margin-top:8px"></div>' +
      '<button type="button" id="savePassword" style="width:100%;height:44px;border:0;border-radius:8px;background:#2463d6;color:#fff;font-weight:750;cursor:pointer;margin-top:4px">Save New Password</button>');
    $('savePassword').onclick = async function () {
      const pass = $('newPassword').value;
      const msg = $('newPasswordMsg');
      if (pass.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
      const { error } = await client.auth.updateUser({ password: pass });
      if (error) { msg.textContent = error.message; return; }
      closeModal();
      setMode('signin');
      setError('Password updated. You can now sign in.');
    };
  }

  // ---- Profile modal ----
  function ensureProfileHandler() {
    if (!accountProfileBtn) return;
    accountProfileBtn.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!currentUser) return;
      if (accountMenu) accountMenu.classList.remove('open');
      const name = (currentUser.user_metadata && currentUser.user_metadata.full_name) || '';
      openModal('Your Profile',
        '<div style="display:grid;gap:12px">' +
        '<div><div style="font-size:10px;color:#8a94a2;text-transform:uppercase;font-weight:700;margin-bottom:4px">Full Name</div><div style="font-size:14px;font-weight:700;color:#263243">' + escapeHtml(name) + '</div></div>' +
        '<div><div style="font-size:10px;color:#8a94a2;text-transform:uppercase;font-weight:700;margin-bottom:4px">Email</div><div style="font-size:14px;font-weight:700;color:#263243">' + escapeHtml(currentUser.email) + '</div></div>' +
        '<button type="button" id="manageSubscriptionBtn" style="width:100%;height:42px;border:1px solid #d8dee7;border-radius:8px;background:#fff;color:#2463d6;font-weight:700;cursor:pointer;margin-top:4px">Manage / Cancel Subscription</button>' +
        '<div id="manageSubscriptionMsg" style="font-size:12px;color:#c0392b;min-height:14px"></div>' +
        '</div>');
      const btn = $('manageSubscriptionBtn');
      if (btn) btn.onclick = async function () {
        const msg = $('manageSubscriptionMsg');
        btn.disabled = true;
        btn.textContent = 'Please wait…';
        if (msg) msg.textContent = '';
        try {
          const { data } = await client.auth.getSession();
          const token = data?.session?.access_token;
          if (!token) throw new Error('Please sign in again.');
          const r = await fetch('/api/create-portal-session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          const json = await r.json().catch(() => null);
          if (!json?.url) throw new Error(json?.error || 'Could not open subscription management.');
          window.location.href = json.url;
        } catch (e) {
          if (msg) msg.textContent = e.message || 'Something went wrong.';
          btn.disabled = false;
          btn.textContent = 'Manage / Cancel Subscription';
        }
      };
    };
  }

  // ---- Account menu open/close ----
  function handleClick(event) {
    const raw = event.target;
    const target = raw && raw.closest ? raw.closest('#signUpTab,#signInTab,#accountBtn,#accountLogoutBtn') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (target.id === 'signUpTab') return setMode('signup');
    if (target.id === 'signInTab') return setMode('signin');
    if (target.id === 'accountBtn') {
      if (accountMenu) {
        accountMenu.classList.toggle('open');
        accountMenu.setAttribute('aria-hidden', accountMenu.classList.contains('open') ? 'false' : 'true');
      }
      return;
    }
    if (target.id === 'accountLogoutBtn') {
      client.auth.signOut();
      if (accountMenu) { accountMenu.classList.remove('open'); accountMenu.setAttribute('aria-hidden', 'true'); }
      form?.reset();
      setMode('signin');
    }
  }

  function outside(event) {
    if (!accountMenu || !accountMenu.classList.contains('open')) return;
    if (accountMenu.contains(event.target)) return;
    if (accountBtn && accountBtn.contains(event.target)) return;
    accountMenu.classList.remove('open');
    accountMenu.setAttribute('aria-hidden', 'true');
  }

  function installMobileMenuFix() {
    const style = document.createElement('style');
    style.id = 'pradixiumAuthMenuFix';
    style.textContent = '.topbar{overflow:visible!important}.top-actions{overflow:visible!important}.account-menu{pointer-events:auto!important}.account-menu.open{display:block!important;visibility:visible!important;opacity:1!important}';
    document.head.appendChild(style);
  }

  // ---- Boot ----
  function init() {
    installMobileMenuFix();
    document.addEventListener('click', handleClick, true);
    document.addEventListener('click', outside, false);
    document.addEventListener('submit', onSubmit, true);
    ensureForgotPasswordButton();
    ensureProfileHandler();
    setMode('signup');

    client.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      if (event === 'PASSWORD_RECOVERY') { handlePasswordRecovery(); return; }
      refresh();
    });

    client.auth.getSession().then(({ data }) => {
      currentUser = data?.session?.user || null;
      refresh();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
