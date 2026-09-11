// ── frontend/src/pages/Reset.jsx ──────────────────────────────────
// WHAT: forgot-password landing (?token= from the reset email): new password
// twice → POST /api/auth/reset → back to login. Public route (token IS the
// credential — no session needed, and must NOT need one!).
// React patterns: URLSearchParams (read ?token=), matching-password check,
// show/hide eyes omitted (two fields cross-check instead).
import { useEffect, useState } from 'react'; // useState = passwords + status; useEffect = title
import { Link } from 'react-router-dom'; // back-to-login link
import { api } from '../lib/api.js'; // reset POST

export default function Reset() {
  const [pw1, setPw1] = useState(''); // new password draft
  const [pw2, setPw2] = useState(''); // confirmation draft (must MATCH — typo protection!)
  const [msg, setMsg] = useState(''); // status line
  const [err, setErr] = useState(false); // red? (drives .err class like Login!)
  const [busy, setBusy] = useState(false); // submit lock (double-submit protection!)
  const [done, setDone] = useState(false); // success → swap form for "go sign in" (no dead form lingering!)
  const token = new URLSearchParams(window.location.search).get('token') || ''; // URLSearchParams parses ?token=… (?token missing → '' → backend 400s with the vague message!)
  useEffect(() => { document.title = 'Vendora — Reset password'; }, []); // tab title
  async function submit() { // validate locally, then consume the token…
    if (pw1.length < 8) { setMsg('Password must be at least 8 characters.'); setErr(true); return; } // client mirror of server rule (fail fast!)
    if (pw1 !== pw2) { setMsg('Passwords do not match — retype both.'); setErr(true); return; } // match check BEFORE any request (typo'd passwords lock users out!)
    if (busy) return; setBusy(true); setMsg(''); setErr(false);
    try {
      const { ok, data } = await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password: pw1 }) });
      setBusy(false);
      if (ok) { setDone(true); setMsg(''); setErr(false); return; } // token burned server-side → show success panel (form hidden below!)
      setMsg(data.error || 'Reset failed — request a fresh link.'); setErr(true); // vague backend message covers bad/expired/weak (secure AND human!)
    } catch { setBusy(false); setMsg("Can't reach the Vendora server. Check your internet connection and try again."); setErr(true); } // unreachable guard (same habit as Login!)
  }
  return (
    <div className="auth-wrap"> {/* same stage as Login (visual continuity — users trust familiar screens!) */}
      <div className="auth-glow" />
      <div className="auth-card glass" style={{ maxWidth: 460 }}> {/* narrower card (single-purpose page!) */}
        <div className="auth-pane">
          <h1>Set a new password</h1>
          {done ? ( // success panel (form REPLACED — no resubmitting a burned token!)…
            <>
              <div className="auth-message">Password updated — welcome back!</div> {/* .auth-message green variant (no .err!) */}
              <Link className="btn login-cta" to="/login">Go to sign in</Link> {/* Link styled as button (client-side nav!) */}
            </>
          ) : ( // …else the form (password twice + submit)…
            <>
              <p className="switch-note">Choose something strong — 8+ characters.</p>
              <label>New password</label>
              <input value={pw1} onChange={(e) => setPw1(e.target.value)} type="password" placeholder="••••••••" autoComplete="new-password" /> {/* autoComplete=new-password (password managers OFFER to generate!) */}
              <label>Type it again</label>
              <input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" placeholder="••••••••" autoComplete="new-password" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} /> {/* Enter submits from either field */}
              <button className="btn login-cta" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save new password'}</button>
              <div className={'auth-message' + (err ? ' err' : '')}>{msg}</div> {/* status (err class only on failure — no shake here, calmer page) */}
              <p className="auth-toggle"><Link to="/login">Back to sign in</Link></p> {/* Router Link (client-side — no reload!) */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
