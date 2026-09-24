// ── frontend/src/pages/Login.jsx ─────────────────────────────────
// WHAT: the front door — sign-in + signup forms, animated brand panel with
// LIVE demo chat, password eye + strength meter, verification resend.
// FLOW: login → /api/auth/login → setMe(business) → /dashboard. signup →
// /api/auth/signup → /onboarding. afterAuth() refetches /api/me (single truth!).
// React patterns: controlled form object, mode toggle, busy lock, live demo loop.
import { useEffect, useState } from 'react'; // useState ×8 slices; useEffect = title + demo timers
import Logo from '../components/Logo.jsx'; // theme-aware brand mark (blue dark / green light!)
import { useNavigate } from 'react-router-dom'; // useNavigate = go somewhere in code (after auth)
import { api } from '../lib/api.js'; // api() auth calls
import { normalizePhone, prettyPhone } from '../lib/phone.js'; // WhatsApp input help (validate + pretty-print on blur)
import Ic from '../components/icons.jsx'; // bolt/spark/hand/check/mail/eye icons

const DEMO = [ // scripted demo conversation (loops forever in the brand panel!)
  { from: 'you', text: 'Abeg, do you have blue gown?' }, // from: 'you' = customer bubble (right)…
  { from: 'ai', text: 'Yes — blue gown ₦45,000, in stock. Want me to reserve it for you?' }, // …'ai' = green reply bubble (sells the dream in 4 lines!)
  { from: 'you', text: 'How much for delivery to Lekki?' },
  { from: 'ai', text: 'Delivery to Lekki is ₦2,500, arrives in 2–3 days. Should I pack it?' },
];

function DemoChat() { // self-playing chat preview (NOT a component with props — pure presentational loop)
  const [n, setN] = useState(1); // how many script lines shown (starts at 1 = first bubble)
  const [typing, setTyping] = useState(true); // typing-dots visible? (alternates with message reveals)
  useEffect(() => { // tiny STATE MACHINE driven by timers (n + typing steer each other):
    if (n >= DEMO.length) { // all lines shown → pause 4.2s, then RESTART loop (n=1, typing on)…
      const t = setTimeout(() => { setN(1); setTyping(true); }, 4200); // setTimeout returns id for cleanup…
      return () => clearTimeout(t); // …cleanup cancels stale timers (effect re-runs on every n/typing change — without cleanup, timers pile up!)
    }
    if (typing) { // typing dots showing → after 1.1s hide them (message "arrives")…
      const t = setTimeout(() => setTyping(false), 1100);
      return () => clearTimeout(t);
    } // (fall-through, no else needed: the two ifs cover all states)
    const t = setTimeout(() => { setN(n + 1); setTyping(true); }, 900); // message visible → after 0.9s show next + typing dots…
    return () => clearTimeout(t);
  }, [n, typing]); // deps [n, typing] = re-run the machine on every state change (this IS the animation loop!)
  return (
    <div className="mock live">
      <div className="mock-head"><i />Amaka Beauty Studio <span>online</span></div> {/* <i> = green dot (CSS); shop name + online sells "alive" */}
      {DEMO.slice(0, n).map((m, i) => ( // slice(0,n) = first n lines (progressive reveal!); key={i} fine (static script order)
        <div key={i} className={'bubble' + (m.from === 'ai' ? ' ai' : '')}>{m.text}</div>
      ))}
      {typing && n < DEMO.length && <div className="bubble ai typing"><span /><span /><span /></div>} {/* && conditional: dots only while typing AND script unfinished (3 spans = CSS bounce stagger) */}
    </div>
  );
}

function GoogleButton({ busy, setBusy, fail, afterAuth, setMe, setOtpEmail, switchMode, setMsg, setMsgErr }) { // "Continue with Google" (GIS button + full flow: session OR one-tap business form OR OTP screen). Props drilled from Login (shared busy/fail/afterAuth = consistent UX!).
  const [gBusy, setGBusy] = useState(false); // google in-flight (separate from form busy — both lock!)
  const [needBiz, setNeedBiz] = useState(null); // null = no form; {email, name, credential} = Google user WITHOUT VeloSales Ai account (one-tap creation form!)
  const [g, setG] = useState({ name: '', wa: '', hours: '', ref: '' }); // mini business form (name + number + hours + optional referral code — email comes from Google!)
  function loadGIS() { // lazy-load Google's script ONCE (no render-blocking <script> in index.html — speed!)
    return new Promise((resolve, reject) => { // Promise wrapper around script injection (async/await-friendly!)
      if (window.google?.accounts?.id) return resolve(); // ?. chain: already loaded → resolve instantly (no double-inject!)
      const s = document.createElement('script'); // create <script>…
      s.src = 'https://accounts.google.com/gsi/client'; // …Google Identity Services (GIS = the modern button/popup lib, NOT the dead gapi!)
      s.async = true; s.defer = true; // async+defer = never blocks our page (speed pass approved!)
      s.onload = () => resolve(); // loaded → resolve…
      s.onerror = () => reject(new Error('google')); // …blocked (adblock!) → reject (we show a message, not silence!)
      document.head.appendChild(s); // inject → browser fetches
    });
  }
  async function start() { // the whole flow: script → button-less prompt → credential → backend…
    if (busy || gBusy) return; // locked either way (double-tap protection!)
    setGBusy(true);
    try {
      await loadGIS(); // 1. GIS library ready (or throw → catch shows message!)
      const clientId = window.__GOOGLE_CLIENT_ID__; // injected below (see bottom: read from backend /api/auth/config — never hardcode secrets… client_id is PUBLIC, but env-driven keeps deploys clean!)
      if (!clientId) { setGBusy(false); return fail('Google sign-in is not switched on yet.'); } // backend has no GOOGLE_CLIENT_ID (honest message, not a dead button!)
      const credential = await Promise.race([ // 2. One Tap / popup prompt (Promise-wrapped callback API!)…
        new Promise((resolve, reject) => {
          window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => resolve(r.credential), auto_select: false }); // initialize once per click (idempotent); callback receives {credential: JWT}
          window.google.accounts.id.prompt((n) => { if (n.isNotDisplayed() || n.isSkippedMoment()) reject(new Error('closed')); }); // prompt() shows the account chooser; closed/skipped → reject (user walked away!)
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 90000)), // ignored-but-open prompt never settles (mobile suppression!) — 90s cap turns the hang into a message, never a stuck button!
      ]);
      const { ok, data } = await api('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }); // 3. backend verifies with Google + session OR needsSignup OR needsOTP…
      setGBusy(false);
      if (ok && data.needsOTP) { setOtpEmail(data.email || ''); setMsg('Code sent — check your inbox to finish signing in.'); setMsgErr(false); setNeedBiz(null); switchMode('otp'); return; } // unverified Google account → OTP screen (same gate as password signup — NO session yet!)
      if (ok) {
        const me = await api('/api/me'); // confirm the session cookie stuck before leaving (split-deploy CORS/cookie can drop it!)
        if (me.ok && me.data && me.data.business) { setMe(me.data.business); window.location.href = '/dashboard'; return; } // full reload: guarantees fresh App state + cookie
        return fail('Google signed in, but your session did not stick. Check the API URL / connection and try again.'); // stay here with a reason — never bounce to login silently
      }
      if (data.needsSignup) { setNeedBiz({ email: data.email, name: data.name || '', credential }); setG({ name: data.name || '', wa: '', hours: '' }); return; } // 404 needsSignup → open the ONE-TAP business form (credential KEPT for the signup call!)
      fail(data.error || 'Google sign-in failed — try again.'); // other failures (expired token, Google down…)
    } catch { setGBusy(false); fail('Google sign-in was closed or blocked — try again (disable adblock for accounts.google.com).'); } // script blocked / popup closed / network (ONE message for all — all three feel identical to users!)
  }
  async function finishSignup() { // one-tap business creation for Google users (name + number + hours, email from Google!)…
    const number = normalizePhone(g.wa); // same normalizer as password signup (one rule everywhere!)
    if (!g.name.trim()) return fail('Business name required.');
    if (!number) return fail('Enter a valid WhatsApp number (e.g. 0803 123 4567).');
    setGBusy(true);
    try {
      const { ok, data } = await api('/api/auth/google-signup', { method: 'POST', body: JSON.stringify({ credential: needBiz.credential, name: g.name.trim(), whatsapp_number: g.wa.trim(), owner_number: g.wa.trim(), hours: g.hours.trim(), ...(g.ref && g.ref.trim() ? { referral_code: g.ref.trim() } : {}) }) }); // credential RE-VERIFIED server-side (never trust the frontend's claim!); referral code rides along when pasted!
      setGBusy(false);
      if (ok && data.needsOTP) { setOtpEmail(data.email || ''); setMsg('Code sent — check your inbox to finish creating your shop.'); setMsgErr(false); setNeedBiz(null); switchMode('otp'); return; } // brand-new Google shop → OTP proves the inbox (business already saved — verify screen next, then tour!)
      if (ok && data.user) {
        const me = await api('/api/me'); // confirm session stuck before leaving the page
        if (me.ok && me.data && me.data.business) { setMe(me.data.business); window.location.href = '/onboarding'; return; } // new account → tour (same as password signup!)
        return fail('Account created, but your session did not stick. Please sign in.');
      }
      fail((data.errors || [data.error || 'Signup failed']).join('; ')); // validation/409 shapes handled like password flow
    } catch { setGBusy(false); fail("Can't reach the VeloSales Ai server. Check your internet connection and try again."); }
  }
  if (needBiz) { // BUSINESS FORM replaces the button (Google verified email, just needs shop details!)…
    return (
      <div style={{ marginTop: 12 }}>
        <p className="switch-note">Google verified <b>{needBiz.email}</b> — add your shop to finish (one step!).</p> {/* email shown (proof it worked!) */}
        <label>Business name</label><input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Amaka Beauty Studio" autoComplete="organization" />
        <label>Business WhatsApp</label><input value={g.wa} onChange={(e) => setG({ ...g, wa: e.target.value })} placeholder="0803 123 4567" inputMode="tel" />
        <label>Opening hours</label><input value={g.hours} onChange={(e) => setG({ ...g, hours: e.target.value })} placeholder="Mon–Sat, 9am–7pm" />
        <label>Referral code <span className="hint">(optional — bonus for you both)</span></label><input value={g.ref} onChange={(e) => setG({ ...g, ref: e.target.value })} placeholder="e.g. AMAKA-4F2K" spellCheck="false" autoComplete="off" style={{ textTransform: 'uppercase' }} />
        <button className="btn login-cta" disabled={gBusy} onClick={finishSignup}>{gBusy ? 'Creating…' : 'Create my shop →'}</button>
        <p className="auth-toggle"><a onClick={() => setNeedBiz(null)}>Back</a></p> {/* Back drops the form (credential discarded — re-click to restart!) */}
      </div>
    );
  }
  return ( // THE BUTTON (white Google style: G logo + text, full-width like our CTA)…
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}><span style={{ flex: 1, height: 1, background: 'var(--line)' }} /><span className="hint">or</span><span style={{ flex: 1, height: 1, background: 'var(--line)' }} /></div> {/* divider with lines (flex:1 rules grow to fill!) */}
      <button className="btn ghost login-cta" disabled={busy || gBusy} onClick={start} style={{ background: '#fff' }}><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.5 7.5 24 12 24z" /><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.5-2.7-.1.1C.5 8.9 0 10.4 0 12s.5 3.1 1.5 4.5l3.7-2.1z" /><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.5 1.5 6.9l3.7 2.8c1-2.9 3.7-5 6.8-5z" /></svg>{gBusy ? 'Waiting for Google…' : 'Continue with Google'}</button> {/* inline G logo paths (brand colors — Google's own mark, no library!); label flips while popup open */}
    </div>
  );
}

async function fetchGoogleClientId() { // module-level fetch (called once below): backend exposes ONLY the public client id (never secrets!)…
  try {
    const { ok, data } = await api('/api/auth/config');
    if (ok && data.googleClientId) window.__GOOGLE_CLIENT_ID__ = data.googleClientId; // stash on window (GoogleButton reads it at click time!)
  } catch {} // backend down/unconfigured → button shows "not switched on" (graceful!)
}
fetchGoogleClientId(); // fire on module load (once per page-load — cached on window!)

export default function Login({ setMe }) { // setMe prop = App's state setter (login updates GLOBAL login state directly — no reload!)
  useEffect(() => { document.title = 'VeloSales Ai — Sign in'; }, []); // tab title (mount-only side-effect)
  const nav = useNavigate(); // code navigation (afterAuth below)
  const [mode, setMode] = useState('login'); // 'login' | 'signup' (one form, two modes — toggled by link below!)
  const [msg, setMsg] = useState(''); // status line text ("Welcome back…" / errors)
  const [msgErr, setMsgErr] = useState(false); // status line red? (drives .err + shake animation!)
  const [busy, setBusy] = useState(false); // request in flight (button spinner + lock — double-submit protection!)
  const [showPw, setShowPw] = useState(false); // password visible? (eye toggle)
  const [needsVerify, setNeedsVerify] = useState(false); // backend said "verify first" → show resend button
  const [f, setF] = useState({ email: '', password: '', name: '', wa: '', hours: '', ref: '' }); // ONE form object (6 controlled fields — ref = referral/promo code, optional!)
  const [refState, setRefState] = useState(null); // null = unchecked; {ok, text} = live reward preview (green = attached!)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); // curried setter (same factory as Profile!): set('email') → onChange writing f.email
  async function checkRef(code) { // live code check (debounced below — no request per keystroke!)
    const c = (code || '').trim();
    if (!c) { setRefState(null); return; } // empty → clear preview (no call!)
    try {
      const { ok, data } = await api('/api/auth/check-referral?code=' + encodeURIComponent(c)); // encode: codes have dashes (URL-safe anyway — belt + braces!)
      if (ok && data.valid) setRefState({ ok: true, text: data.reward }); // "Reward attached — you both get 14 Pro days free"
      else setRefState({ ok: false, text: 'That code is not recognised — signup still works, just no bonus.' }); // invalid ≠ blocked (typos must never kill signups!)
    } catch { setRefState(null); } // offline → silent (signup proceeds — reward retries server-side anyway!)
  }
  useEffect(() => { // ?ref=CODE links (share kit!) → signup mode + prefilled + checked…
    try {
      const q = new URLSearchParams(window.location.search).get('ref');
      if (q && q.trim()) {
        setMode('signup'); // land straight on signup (guests with a code came to JOIN!)
        setF((prev) => ({ ...prev, ref: q.trim().toUpperCase().slice(0, 20) })); // uppercase + cap (matches server normalization!)
        checkRef(q);
      }
    } catch {} // URL API never throws in practice (paranoia guard!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // [] = mount-only (?ref read once!)
  useEffect(() => { // debounce the TYPED code (600ms after last keystroke — no per-letter requests!)
    if (!f.ref.trim()) { setRefState(null); return; }
    const t = setTimeout(() => checkRef(f.ref), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.ref]); // [f.ref] = re-arm per keystroke
  const pwScore = f.password.length >= 12 ? 3 : f.password.length >= 8 ? 2 : f.password.length >= 4 ? 1 : 0; // chained ternary: length → 0-3 bars (derived during render — NOT state, since it's computable!)

  function fail(m) { setMsg(m); setMsgErr(true); } // helper: red status line (two setStates = one re-render, batched!)
  async function afterAuth(path) { // shared post-auth: refresh login state THEN navigate (order matters: Guard reads `me`!)
    try {
      const me = await api('/api/me'); // refetch (single source of truth — never trust the login response alone!)
      if (me.ok && me.data && me.data.business) {
        setMe(me.data.business); // lift business into App state (whole app re-renders as logged-in!)
        nav(path); // ONLY navigate when the session actually stuck (prevents login → dashboard → login bounce!)
        return true;
      }
      if (me.status === 401) fail('Signed in, but the session cookie was blocked (browser rejected it). Allow cookies for this site, or open the app at its backend URL, then try again.'); // 401 = login saved but /me arrived cookieless (third-party-cookie blocking / CORS mismatch) — stay here with the real reason
      else fail(`Signed in, but loading your shop failed (server said ${me.status || 'nothing'}). Check your connection and try again.`); // non-401 = backend hiccup, not a cookie problem
      return false;
    } catch {
      fail("Can't reach the VeloSales Ai server. Check your internet connection and try again."); // network-down: fetch threw — explain, don't navigate
      return false;
    }
  }
  async function login() { // SIGN IN flow…
    if (busy) return; setBusy(true); setMsg(''); setMsgErr(false); setNeedsVerify(false); // lock + reset ALL status (clean slate per attempt!)
    try { // try/catch: if the SERVER can't be reached at all, fetch THROWS (no response to read!)…
      const { ok, data } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: f.email.trim(), password: f.password }) }); // trim email (trailing spaces break login!); password NOT trimmed (spaces can be intentional!)
      setBusy(false); // unlock (ALWAYS — both paths!)
      if (ok && data.user) { setMsg('Welcome back…'); setMsgErr(false); afterAuth('/dashboard'); return; } // success = ok AND a user object (guards empty-200 responses from misconfigured hosting!)
      if (data.needsVerification) setNeedsVerify(true); // backend flag → reveal resend button below
      fail(data.error || (data.errors || []).join('; ') || 'Sign in failed — check your details and try again.'); // server answered with an error (validation/credentials) → show its message, never a bare fallback
    } catch { // …network/server unreachable (backend down, offline, wrong URL) lands HERE with a human message, never silence!
      setBusy(false);
      fail("Can't reach the VeloSales Ai server. Check your internet connection and try again.");
    }
  }
  async function signup() { // SIGN UP flow (same shape, more fields)…
    if (busy) return; setBusy(true); setMsg(''); setMsgErr(false);
    try { // try/catch: unreachable server throws — must show why, never hang on "Please wait…"!
      const { ok, data } = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: f.name.trim(), whatsapp_number: f.wa.trim(), owner_number: f.wa.trim(), hours: f.hours.trim(), email: f.email.trim(), password: f.password, ...(f.ref.trim() ? { referral_code: f.ref.trim() } : {}) }) }); // owner_number = same as business number initially (editable later in Profile!); password raw; referral code only when typed (absent = organic!)
      setBusy(false);
      if (ok && data.user) { setMsg('Account created — setting up your assistant…'); setMsgErr(false); afterAuth('/onboarding'); return; } // dev auto-login path (no Resend key): user object present → straight in!
      if (ok && data.needsOTP) { setOtpEmail(data.email || f.email.trim()); setOtp(''); setMsg(''); setMsgErr(false); switchMode('otp'); return; } // OTP path: stash the email, clear code draft, flip to the code screen (NO session yet — unverified gets nothing!)
      fail((data.errors || [data.error || 'Signup failed — check your details and try again.']).join('; ')); // backend sends errors ARRAY (validation!) or single error — handle both, join with '; '
    } catch { // server unreachable (no backend deployed, offline…) → plain-language message, button unlocked!
      setBusy(false);
      fail("Can't reach the VeloSales Ai server. Check your internet connection and try again.");
    }
  }
  async function resend() { // "didn't get the email" button…
    try { // same unreachable-server guard as login/signup (consistency: every auth call explains failures!)
      const { ok, data } = await api('/api/auth/resend', { method: 'POST', body: JSON.stringify({ email: f.email.trim() }) });
      setMsg(data.message || data.error || (ok ? 'Check your inbox.' : 'Could not resend — try again.')); // backend message wins (it knows Resend state!); || chain of fallbacks
      setMsgErr(!ok); // red iff failed (!ok flips boolean)
    } catch { // server unreachable → plain message, red (never silent!)
      setMsg("Can't reach the VeloSales Ai server. Check your internet connection and try again.");
      setMsgErr(true);
    }
  }
  function switchMode(m) { setMode(m); setMsg(''); setMsgErr(false); setNeedsVerify(false); setShowPw(false); } // mode switch RESETS all transient state (no leaking signup errors into login view!)
  const [otpEmail, setOtpEmail] = useState(''); // address the code went to (stashed at signup — OTP screen posts with it!)
  const [otp, setOtp] = useState(''); // 6-digit draft (controlled; digits enforced below, not just trusted!)
  const [cool, setCool] = useState(0); // resend cooldown seconds (anti-spam + anti-cost: every resend = a Resend email!)
  useEffect(() => { // countdown ticker: decrements while >0 (effect re-arms per second — setTimeout chain, cleaned up each run!)…
    if (cool <= 0) return; // …0 = no timer needed (early return BEFORE creating anything!)
    const t = setTimeout(() => setCool(cool - 1), 1000); // tick…
    return () => clearTimeout(t); // …cleanup (unmount/mode-switch cancels mid-countdown!)
  }, [cool]); // [cool] dep = re-arm every second while counting
  async function verifyOtp() { // submit the code…
    const code = otp.replace(/\D/g, '').slice(0, 6); // strip non-digits (paste "12 34 56" still works!) + cap 6
    if (code.length !== 6) return fail('Enter the 6-digit code from your email.'); // client guard (fail() paints red — no wasted request!)
    if (busy) return; setBusy(true); setMsg(''); setMsgErr(false);
    try {
      const { ok, data } = await api('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail, code }) });
      setBusy(false);
      if (ok) { setMsg('Verified — setting up your assistant…'); setMsgErr(false); await afterAuth('/onboarding'); return; } // verified = logged in (session stamped!) → tour! (await: afterAuth overwrites msg on failure so the user sees WHY, never a silent bounce)
      fail(data.error || 'Wrong code — try again.'); // expired/locked/left-count messages arrive HERE (backend crafts each one!)
    } catch { setBusy(false); fail("Can't reach the VeloSales Ai server. Check your internet connection and try again."); } // unreachable → plain message (same guard as login/signup!)
  }
  async function resendCode() { // fresh code (burns the old one server-side!)…
    if (busy || cool > 0) return; // locked while busy OR cooling down (double-tap protection + cost control!)
    setBusy(true); setMsg(''); setMsgErr(false);
    try {
      const { ok, data } = await api('/api/auth/otp-resend', { method: 'POST', body: JSON.stringify({ email: otpEmail }) });
      setBusy(false);
      if (ok && data.auto) { setMsg('Email service is off (dev) — verified! Please sign in.'); setMsgErr(false); return; } // dev auto-path (no Resend key → nothing to type!)
      if (ok) { setMsg(data.message || 'New code sent — check your inbox.'); setMsgErr(false); setCool(60); setOtp(''); return; } // success → 60s cooldown + clear draft (old code is DEAD server-side!)
      fail(data.error || 'Could not resend — try again.');
    } catch { setBusy(false); fail("Can't reach the VeloSales Ai server. Check your internet connection and try again."); }
  }
  async function sendLink() { // FALLBACK: "email didn't arrive? send a LINK instead" (token flow — works even when OTP emails land in spam!)…
    if (busy) return; setBusy(true); setMsg(''); setMsgErr(false);
    try {
      const { ok, data } = await api('/api/auth/otp-link', { method: 'POST', body: JSON.stringify({ email: otpEmail }) });
      setBusy(false);
      setMsg(data.message || data.error || (ok ? 'Link sent — check your inbox.' : 'Could not send — try again.')); // backend message wins (knows Resend state!)
      setMsgErr(!ok);
    } catch { setBusy(false); fail("Can't reach the VeloSales Ai server. Check your internet connection and try again."); }
  }
  async function forgotSend() { // FORGOT path: email → reset link (always "sent" — enumeration-safe by design!)…
    if (busy) return; setBusy(true); setMsg(''); setMsgErr(false);
    try {
      const { data } = await api('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email: f.email.trim() }) }); // uses the LOGIN email field (no extra input needed!)
      setBusy(false);
      setMsg((data && data.devToken ? `Dev mode — your reset token: ${data.devToken}. ` : '') + 'Reset link sent — check your inbox (and spam folder). It expires in 1 hour.'); // backend always answers "sent" (never reveals who has an account), so we can promise the link confidently
      setMsgErr(false);
    } catch { setBusy(false); fail("Can't reach the VeloSales Ai server. Check your internet connection and try again."); }
  }

  return (
    <div className="auth-wrap"> {/* fullscreen gradient stage (CSS radial background) */}
      <div className="auth-glow" /> {/* drifting light blob (self-closing div, pure CSS animation!) */}
      <div className="auth-card glass"> {/* glassmorphism card: brand panel + form (backdrop-blur + entrance animation) */}
        <div className="auth-side"> {/* LEFT: brand storytelling (hidden on mobile via CSS!) */}
          <div className="brand-chip"><Logo alt="VeloSales Ai" /><span>VELOSALES AI · SALES ASSISTANT</span></div> {/* pill badge */}
          <h2>Your WhatsApp shop.<br /><span className="grad">Open even while you sleep.</span></h2> {/* <br/> line break; .grad = gradient text span */}
          <p className="tagline">An AI that answers like you — prices, stock, hours — so no customer is ever ignored.</p>
          <ul className="feat"> {/* feature list with STAGGERED entrance (--d custom property = per-item delay!) */}
            <li style={{ '--d': '0.05s' }}><b className="feat-ic"><Ic n="bolt" /></b><span>Replies in seconds, in English or Pidgin</span></li> {/* style={{'--d'}} sets a CSS VARIABLE from JS (React allows custom props in style objects!) */}
            <li style={{ '--d': '0.15s' }}><b className="feat-ic"><Ic n="spark" /></b><span>Learns your catalog from one LEARN: message</span></li>
            <li style={{ '--d': '0.25s' }}><b className="feat-ic"><Ic n="hand" /></b><span>Hands off to you the moment a human is needed</span></li>
          </ul>
          <DemoChat /> {/* the self-playing demo above! */}
        </div>
        <div className="auth-pane" key={mode}> {/* RIGHT: the form. key={mode} = React REMOUNTS on mode switch (fresh animations + no stale input focus — key change = new element!) */}
          <div className="trial-banner"> {/* pulsing 7-days banner (CSS bannerPulse) */}
            <span className="trial-badge">7 DAYS FREE</span>
            <div><b>{mode === 'login' ? 'Your trial is waiting.' : 'Start selling tonight.'}</b><span>No card required · Cancel anytime</span></div> {/* headline flips with mode */}
          </div>
          {mode === 'otp' ? (<> {/* OTP screen: shown after signup (no session yet — code IS the key!) */}
            <h1>Check your email</h1>
            <p className="switch-note">We sent a 6-digit code to <b>{otpEmail}</b>. It expires in 10 minutes.</p>
            <div className="otp-help">
              <b>📧 Code not in your inbox?</b>
              <span>Our sending domain is new, so the mail can land in <b>Spam</b> or <b>Promotions</b> — please check there first, then wait ~2 minutes.</span>
            </div>
            <label>6-digit code</label>
            <input className="otp-input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" autoComplete="one-time-code" maxLength={6} onKeyDown={(e) => { if (e.key === 'Enter') verifyOtp(); }} /> {/* replace(/\D/g) strips non-digits AS YOU TYPE (paste-friendly!); autoComplete="one-time-code" = phones offer SMS-style autofill! */}
            <button className="btn login-cta" disabled={busy} onClick={verifyOtp}>{busy ? <span className="spinner" /> : null}{busy ? 'Checking…' : 'Verify →'}</button>
            <div className="otp-fallback">
              <button type="button" className="btn ghost" disabled={busy || cool > 0} onClick={resendCode}>{cool > 0 ? `Resend code in ${cool}s` : 'Resend code'}</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={sendLink}>Send a verification link instead</button>
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>The link does the same job as the code — pick whichever arrives first. Both expire; the newest one wins.</p>
            <p className="auth-toggle"><a onClick={() => switchMode('login')}>Back to sign in</a></p>
          </>) : mode === 'forgot' ? (<> {/* FORGOT screen: email → reset link (always "sent" — enumeration-safe!) */}
            <h1>Reset password</h1>
            <p className="switch-note">Enter your account email — if it exists, a 1-hour reset link is on its way.</p>
            <label>Email</label>
            <input value={f.email} onChange={set('email')} type="email" placeholder="you@business.com" autoComplete="email" onKeyDown={(e) => { if (e.key === 'Enter') forgotSend(); }} />
            <button className="btn login-cta" disabled={busy} onClick={forgotSend}>{busy ? <span className="spinner" /> : null}{busy ? 'Sending…' : 'Send reset link'}</button>
            <p className="auth-toggle"><a onClick={() => switchMode('login')}>Back to sign in</a></p>
          </>) : (<> {/* login/signup form (existing — wrapped so otp/forgot replace it!) */}
          <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1> {/* ternaries everywhere = one form, two personalities */}
          <p className="switch-note">{mode === 'login' ? 'Your assistant has been holding the fort.' : 'Join shops answering customers 24/7.'}</p>
          {mode === 'signup' && (<> {/* && conditional BLOCK: signup-only fields (fragment groups 3 field sets without wrapper div!) */}
            <label>Business name</label><input value={f.name} onChange={set('name')} placeholder="Amaka Beauty Studio" autoComplete="organization" /> {/* autoComplete hints = browser autofill + password managers work (UX + a11y!) */}
            <label>Business WhatsApp</label><input value={f.wa} onChange={set('wa')} onBlur={() => { const n = normalizePhone(f.wa); if (n) setF({ ...f, wa: prettyPhone(n) }); }} placeholder="0803 123 4567" spellCheck="false" inputMode="tel" /> {/* onBlur pretty-prints ("0803…" → "0803 123 4567"); inputMode="tel" = phone keyboard on mobile! */}
            {f.wa.trim() !== '' && (normalizePhone(f.wa) ? <span className="hint ok-line"><Ic n="check" s={13} /> Saved as {normalizePhone(f.wa)}</span> : <span className="hint err-line">That number doesn't look right — try 0803 123 4567</span>)} {/* live validation line: non-empty only; green normalized form vs red hint */}
            <label>Opening hours</label><input value={f.hours} onChange={set('hours')} placeholder="Mon–Sat, 9am–7pm" />
            <label>Referral or promo code <span className="hint">(optional)</span></label>
            <input value={f.ref} onChange={set('ref')} placeholder="e.g. AMAKA-4F2K" spellCheck="false" autoComplete="off" style={{ textTransform: 'uppercase' }} />
            {refState && <span className={'hint ' + (refState.ok ? 'ok-line' : 'err-line')}>{refState.ok ? <><Ic n="check" s={13} /> {refState.text}</> : refState.text}</span>} {/* live reward preview (green = bonus attached!) */}
          </>)}
          <label>Email</label><input value={f.email} onChange={set('email')} type="email" placeholder="you@business.com" autoComplete="email" /> {/* type="email" = email keyboard + browser validation assist */}
          <label>Password {mode === 'signup' && <span className="hint">· 8+ characters</span>}</label> {/* && inline hint (signup only) */}
          <div className="pw-wrap"> {/* relative container for the eye button (absolute inside) */}
            <input value={f.password} onChange={set('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onKeyDown={(e) => { if (e.key === 'Enter') mode === 'login' ? login() : signup(); }} /> {/* type flips text/password (the "eye" trick!); Enter submits (nested ternary picks the action); autoComplete values tell password managers what's happening */}
            <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} title={showPw ? 'Hide password' : 'Show password'} aria-label={showPw ? 'Hide password' : 'Show password'}><Ic n={showPw ? 'eyeOff' : 'eye'} s={18} /></button> {/* type="button" (not submit!), icon flips eye/eyeOff, title + aria-label (hover + screen reader) */}
          </div>
          {mode === 'signup' && f.password.length > 0 && ( // strength meter: signup + non-empty only…
            <div className="pw-meter"><i className={pwScore >= 1 ? 'on' : ''} /><i className={pwScore >= 2 ? 'on' : ''} /><i className={pwScore >= 3 ? 'on' : ''} /><span>{pwScore >= 2 ? 'Strong enough' : 'Keep typing…'}</span></div>
          )}
          <button className="btn login-cta" disabled={busy} onClick={mode === 'login' ? login : signup}>{busy ? <span className="spinner" /> : null}{busy ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Start my free trial →'}</button> {/* disabled while busy (double-submit lock); spinner span OR null; label ternary ×2 (busy? then mode?) */}
          {(mode === 'login' || mode === 'signup') && <GoogleButton busy={busy} setBusy={setBusy} fail={fail} afterAuth={afterAuth} setMe={setMe} setOtpEmail={setOtpEmail} switchMode={switchMode} setMsg={setMsg} setMsgErr={setMsgErr} />} {/* social login under BOTH forms (one component, both modes!) */}
          {needsVerify && (
            <div className="otp-help" style={{ marginTop: 12 }}>
              <b>📧 No verification mail?</b>
              <span>Check <b>Spam / Promotions</b> — our domain is new so mail can hide there. Then resend below.</span>
              <button className="resend-btn" onClick={resend}><Ic n="mail" s={15} /> Resend verification email</button>
            </div>
          )} {/* unverified-login only (backend needsVerification flag drives this!) */}
          <div className={'auth-message' + (msgErr ? ' err shake' : '')}>{msg}</div> {/* status line: .err red + .shake animation on errors (re-triggers per message? shake replays when class re-added — msg change re-renders, animation restarts if key/msg differs… good enough visually) */}
          <p className="auth-toggle">{mode === 'login' ? (<>New here? <a onClick={() => switchMode('signup')}>Create an account</a></>) : (<>Have an account? <a onClick={() => switchMode('login')}>Sign in</a></>)}</p> {/* mode toggle links (<a> without href + onClick = action links) */}
          <div className="demo-mobile">
            <p className="hint" style={{ textAlign: 'center', marginBottom: 8 }}>Watch it sell — live demo</p>
            <DemoChat /> {/* mobile ALSO gets the demo (auth-side hidden on phones, so duplicate here for small screens!) */}
          </div>
          <p className="auth-hint">Secure card checkout — only after your free days<br /><a href="/faq">FAQ</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p> {/* trust footer + legal links (plain <a href> = full navigation, fine for public pages) */}
          </>)} {/* close the login/signup wrapper (otp/forgot branches above replace it!) */}
          {mode === 'login' && <p className="auth-toggle"><a onClick={() => switchMode('forgot')}>Forgot password?</a></p>} {/* && conditional: forgot link ONLY on login (signup users don't have passwords to forget yet!) */}
        </div>
      </div>
    </div>
  );
}
