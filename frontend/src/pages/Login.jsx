// ── frontend/src/pages/Login.jsx ─────────────────────────────────
// WHAT: the front door — sign-in + signup forms, animated brand panel with
// LIVE demo chat, password eye + strength meter, verification resend.
// FLOW: login → /api/auth/login → setMe(business) → /dashboard. signup →
// /api/auth/signup → /onboarding. afterAuth() refetches /api/me (single truth!).
// React patterns: controlled form object, mode toggle, busy lock, live demo loop.
import { useEffect, useState } from 'react'; // useState ×8 slices; useEffect = title + demo timers
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
        <div key={i} className={'bubble' + (m.from === 'ai' ? ' ai' : '')}>{m.text}</div> {/* ' ai' class = green reply style (string concat toggle) */}
      ))}
      {typing && n < DEMO.length && <div className="bubble ai typing"><span /><span /><span /></div>} {/* && conditional: dots only while typing AND script unfinished (3 spans = CSS bounce stagger) */}
    </div>
  );
}

export default function Login({ setMe }) { // setMe prop = App's state setter (login updates GLOBAL login state directly — no reload!)
  useEffect(() => { document.title = 'Vendora — Sign in'; }, []); // tab title (mount-only side-effect)
  const nav = useNavigate(); // code navigation (afterAuth below)
  const [mode, setMode] = useState('login'); // 'login' | 'signup' (one form, two modes — toggled by link below!)
  const [msg, setMsg] = useState(''); // status line text ("Welcome back…" / errors)
  const [msgErr, setMsgErr] = useState(false); // status line red? (drives .err + shake animation!)
  const [busy, setBusy] = useState(false); // request in flight (button spinner + lock — double-submit protection!)
  const [showPw, setShowPw] = useState(false); // password visible? (eye toggle)
  const [needsVerify, setNeedsVerify] = useState(false); // backend said "verify first" → show resend button
  const [f, setF] = useState({ email: '', password: '', name: '', wa: '', hours: '' }); // ONE form object (5 controlled fields)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); // curried setter (same factory as Profile!): set('email') → onChange writing f.email
  const pwScore = f.password.length >= 12 ? 3 : f.password.length >= 8 ? 2 : f.password.length >= 4 ? 1 : 0; // chained ternary: length → 0-3 bars (derived during render — NOT state, since it's computable!)

  function fail(m) { setMsg(m); setMsgErr(true); } // helper: red status line (two setStates = one re-render, batched!)
  async function afterAuth(path) { // shared post-auth: refresh login state THEN navigate (order matters: Guard reads `me`!)
    const me = await api('/api/me'); // refetch (single source of truth — never trust the login response alone!)
    if (me.ok) setMe(me.data.business); // lift business into App state (whole app re-renders as logged-in!)
    nav(path); // go to dashboard/onboarding (fires even if refetch failed — Guard will bounce to login if truly broken)
  }
  async function login() { // SIGN IN flow…
    if (busy) return; setBusy(true); setMsg(''); setMsgErr(false); setNeedsVerify(false); // lock + reset ALL status (clean slate per attempt!)
    const { ok, data } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: f.email.trim(), password: f.password }) }); // trim email (trailing spaces break login!); password NOT trimmed (spaces can be intentional!)
    setBusy(false); // unlock (ALWAYS — both paths!)
    if (ok) { setMsg('Welcome back…'); setMsgErr(false); afterAuth('/dashboard'); return; } // success → message + dashboard (return stops here)
    if (data.needsVerification) setNeedsVerify(true); // backend flag → reveal resend button below
    fail(data.error || 'Sign in failed'); // failure → red message (|| fallback)
  }
  async function signup() { // SIGN UP flow (same shape, more fields)…
    if (busy) return; setBusy(true); setMsg(''); setMsgErr(false);
    const { ok, data } = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: f.name.trim(), whatsapp_number: f.wa.trim(), owner_number: f.wa.trim(), hours: f.hours.trim(), email: f.email.trim(), password: f.password }) }); // owner_number = same as business number initially (editable later in Profile!); password raw
    setBusy(false);
    if (ok) { setMsg('Account created — setting up your assistant…'); setMsgErr(false); afterAuth('/onboarding'); return; } // new accounts tour FIRST (onboarding, not dashboard!)
    fail((data.errors || [data.error || 'Signup failed']).join('; ')); // backend sends errors ARRAY (validation!) or single error — handle both, join with '; '
  }
  async function resend() { // "didn't get the email" button…
    const { ok, data } = await api('/api/auth/resend', { method: 'POST', body: JSON.stringify({ email: f.email.trim() }) });
    setMsg(data.message || data.error || (ok ? 'Check your inbox.' : 'Could not resend')); // backend message wins (it knows Resend state!); || chain of fallbacks
    setMsgErr(!ok); // red iff failed (!ok flips boolean)
  }
  function switchMode(m) { setMode(m); setMsg(''); setMsgErr(false); setNeedsVerify(false); setShowPw(false); } // mode switch RESETS all transient state (no leaking signup errors into login view!)

  return (
    <div className="auth-wrap"> {/* fullscreen gradient stage (CSS radial background) */}
      <div className="auth-glow" /> {/* drifting light blob (self-closing div, pure CSS animation!) */}
      <div className="auth-card glass"> {/* glassmorphism card: brand panel + form (backdrop-blur + entrance animation) */}
        <div className="auth-side"> {/* LEFT: brand storytelling (hidden on mobile via CSS!) */}
          <div className="brand-chip"><img src="/logo.png" alt="Vendora" /><span>VENDORA — AI SALES ASSISTANT</span></div> {/* pill badge */}
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
          <div className="trial-banner"> {/* pulsing 14-days banner (CSS bannerPulse) */}
            <span className="trial-badge">14 DAYS FREE</span>
            <div><b>{mode === 'login' ? 'Your trial is waiting.' : 'Start selling tonight.'}</b><span>No card required · Cancel anytime</span></div> {/* headline flips with mode */}
          </div>
          <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1> {/* ternaries everywhere = one form, two personalities */}
          <p className="switch-note">{mode === 'login' ? 'Your assistant has been holding the fort.' : 'Join shops answering customers 24/7.'}</p>
          {mode === 'signup' && (<> {/* && conditional BLOCK: signup-only fields (fragment groups 3 field sets without wrapper div!) */}
            <label>Business name</label><input value={f.name} onChange={set('name')} placeholder="Amaka Beauty Studio" autoComplete="organization" /> {/* autoComplete hints = browser autofill + password managers work (UX + a11y!) */}
            <label>Business WhatsApp</label><input value={f.wa} onChange={set('wa')} onBlur={() => { const n = normalizePhone(f.wa); if (n) setF({ ...f, wa: prettyPhone(n) }); }} placeholder="0803 123 4567" spellCheck="false" inputMode="tel" /> {/* onBlur pretty-prints ("0803…" → "0803 123 4567"); inputMode="tel" = phone keyboard on mobile! */}
            {f.wa.trim() !== '' && (normalizePhone(f.wa) ? <span className="hint ok-line"><Ic n="check" s={13} /> Saved as {normalizePhone(f.wa)}</span> : <span className="hint err-line">That number doesn't look right — try 0803 123 4567</span>)} {/* live validation line: non-empty only; green normalized form vs red hint */}
            <label>Opening hours</label><input value={f.hours} onChange={set('hours')} placeholder="Mon–Sat, 9am–7pm" />
          </>)}
          <label>Email</label><input value={f.email} onChange={set('email')} type="email" placeholder="you@business.com" autoComplete="email" /> {/* type="email" = email keyboard + browser validation assist */}
          <label>Password {mode === 'signup' && <span className="hint">· 8+ characters</span>}</label> {/* && inline hint (signup only) */}
          <div className="pw-wrap"> {/* relative container for the eye button (absolute inside) */}
            <input value={f.password} onChange={set('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onKeyDown={(e) => { if (e.key === 'Enter') mode === 'login' ? login() : signup(); }} /> {/* type flips text/password (the "eye" trick!); Enter submits (nested ternary picks the action); autoComplete values tell password managers what's happening */}
            <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} title={showPw ? 'Hide password' : 'Show password'} aria-label={showPw ? 'Hide password' : 'Show password'}><Ic n={showPw ? 'eyeOff' : 'eye'} s={18} /></button> {/* type="button" (not submit!), icon flips eye/eyeOff, title + aria-label (hover + screen reader) */}
          </div>
          {mode === 'signup' && f.password.length > 0 && ( // strength meter: signup + non-empty only…
            <div className="pw-meter"><i className={pwScore >= 1 ? 'on' : ''} /><i className={pwScore >= 2 ? 'on' : ''} /><i className={pwScore >= 3 ? 'on' : ''} /><span>{pwScore >= 2 ? 'Strong enough' : 'Keep typing…'}</span></div> {/* 3 bars light up by pwScore (className ternary each); label flips at 2+ */}
          )}
          <button className="btn login-cta" disabled={busy} onClick={mode === 'login' ? login : signup}>{busy ? <span className="spinner" /> : null}{busy ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Start my free trial →'}</button> {/* disabled while busy (double-submit lock); spinner span OR null; label ternary ×2 (busy? then mode?) */}
          {needsVerify && <button className="resend-btn" onClick={resend}><Ic n="mail" s={15} /> Resend verification email</button>} {/* unverified-login only (backend needsVerification flag drives this!) */}
          <div className={'auth-message' + (msgErr ? ' err shake' : '')}>{msg}</div> {/* status line: .err red + .shake animation on errors (re-triggers per message? shake replays when class re-added — msg change re-renders, animation restarts if key/msg differs… good enough visually) */}
          <p className="auth-toggle">{mode === 'login' ? (<>New here? <a onClick={() => switchMode('signup')}>Create an account</a></>) : (<>Have an account? <a onClick={() => switchMode('login')}>Sign in</a></>)}</p> {/* mode toggle links (<a> without href + onClick = action links) */}
          <div className="demo-mobile">
            <p className="hint" style={{ textAlign: 'center', marginBottom: 8 }}>Watch it sell — live demo</p>
            <DemoChat /> {/* mobile ALSO gets the demo (auth-side hidden on phones, so duplicate here for small screens!) */}
          </div>
          <p className="auth-hint">Cards · Transfer · USSD via Paystack — only after your free days<br /><a href="/faq">FAQ</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p> {/* trust footer + legal links (plain <a href> = full navigation, fine for public pages) */}
        </div>
      </div>
    </div>
  );
}
