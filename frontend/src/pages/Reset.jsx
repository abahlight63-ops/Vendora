// ── frontend/src/pages/Reset.jsx ──────────────────────────────────
// WHAT: the page the reset email's link opens (?token=). New password twice,
// with a strength bar → POST /api/auth/reset → back to sign in. Public route:
// the token is the credential, so no session is needed. Styled like sign-in.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Loader from '../components/Loader.jsx';
import Logo from '../components/Logo.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';

function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return p ? Math.max(1, s) : 0;
}
const WORDS = ['', 'Weak password', 'Okay password', 'Good password', 'Strong password'];

export default function Reset() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token') || '';
  useEffect(() => {
    setPageMeta({ title: 'VeloSales Ai — Reset password', description: 'Choose a new password for your VeloSales Ai account.', canonical: APP_URL + '/reset', robots: 'noindex,follow' });
  }, []);
  async function submit() {
    if (pw1.length < 8) return setMsg('Use at least 8 characters.');
    if (pw1 !== pw2) return setMsg('The two passwords do not match. Type them again.');
    if (busy) return undefined;
    setBusy(true); setMsg('');
    try {
      const { ok, data } = await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password: pw1 }) });
      setBusy(false);
      if (ok) return setDone(true);
      return setMsg((data && data.error) || 'This link has expired. Ask for a new one from sign in.');
    } catch {
      setBusy(false);
      return setMsg("Can't reach VeloSales Ai. Check your internet connection and try again.");
    }
  }
  const s = strength(pw1);
  return (
    <div className="rs">
      <header className="rs-top"><Link to="/" className="au-brand"><Logo size={24} alt="" />VeloSales Ai</Link></header>
      <main className="rs-card">
        <span className={'au-badge ' + (done ? 'mail' : 'key')} aria-hidden="true">
          <svg width="38" height="38" viewBox="0 0 24 24"><path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={done ? 'M5 12.5l4.5 4.5L19 7.5' : 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3'} /></svg>
        </span>
        {done ? (<>
          <h1>Password changed</h1>
          <p className="rs-sub">You can sign in with your new password now.</p>
          <Link className="btn lg login-cta" to="/login">Go to sign in</Link>
        </>) : (<>
          <h1>Set a new password</h1>
          <p className="rs-sub">Use 8 or more characters. Then sign in with it.</p>
          <label htmlFor="rs1">New password</label>
          <div className="rs-pw">
            <input id="rs1" value={pw1} onChange={(e) => setPw1(e.target.value)} type={show ? 'text' : 'password'} placeholder="8+ characters" autoComplete="new-password" autoFocus />
            <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
          </div>
          {pw1 && (<>
            <div className="rs-meter" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= s ? 'on s' + s : ''} />)}</div>
            <div className={'rs-word s' + s}>{WORDS[s]}</div>
          </>)}
          <label htmlFor="rs2">Type it again</label>
          <input id="rs2" value={pw2} onChange={(e) => setPw2(e.target.value)} type={show ? 'text' : 'password'} placeholder="Same password again" autoComplete="new-password" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
          {msg && <div className="rs-err" role="alert">{msg}</div>}
          <button type="button" className="btn lg login-cta" disabled={busy} onClick={submit}>{busy ? (<><Loader size={15} />Saving</>) : 'Save new password'}</button>
          <Link className="rs-back" to="/login">Back to sign in</Link>
        </>)}
      </main>
    </div>
  );
}
