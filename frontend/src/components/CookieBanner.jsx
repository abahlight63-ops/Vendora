// ── frontend/src/components/CookieBanner.jsx ───────────────────────
// WHAT: the cookie choice (NDPA). Shown once until the visitor chooses.
//   Accept all     → we may remember preferences on this device (dark mode, tours)
//   Essential only → only the sign-in cookie; preferences are not stored
// The choice lives in localStorage 'vs-cookie' and can be changed from the
// Cookie Policy (openCookieChoice()).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const KEY = 'vs-cookie';
export const cookieChoice = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const prefsAllowed = () => cookieChoice() !== 'essential';
export function openCookieChoice() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } window.dispatchEvent(new Event('vs-cookie-open')); }

export default function CookieBanner() {
  const [open, setOpen] = useState(() => !cookieChoice());
  useEffect(() => { const on = () => setOpen(true); window.addEventListener('vs-cookie-open', on); return () => window.removeEventListener('vs-cookie-open', on); }, []);
  if (!open) return null;
  const choose = (v) => {
    try {
      localStorage.setItem(KEY, v);
      if (v === 'essential') ['velosales-theme', 'velo_tour_done', 'vendora-brain'].forEach((k) => localStorage.removeItem(k)); // forget stored preferences
    } catch { /* private mode: nothing is stored anyway */ }
    setOpen(false);
  };
  return (
    <div className="ck" role="dialog" aria-modal="false" aria-labelledby="ck-t">
      <div className="ck-ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 3 3 0 0 0 4 3 3 3 0 0 0 5 6z" /><path d="M8.5 13.5h.01M12 16.5h.01M15 11h.01M10 9h.01" /></svg></div>
      <div className="ck-main">
        <b id="ck-t">Cookies on VeloSales Ai</b>
        <span>We use one cookie to keep you signed in. With your OK we also remember choices like dark mode on this device. No advertising or tracking cookies. <Link to="/cookies">Cookie Policy</Link></span>
      </div>
      <div className="ck-btns">
        <button type="button" className="ck-ghost" onClick={() => choose('essential')}>Essential only</button>
        <button type="button" className="ck-go" onClick={() => choose('all')}>Accept all</button>
      </div>
    </div>
  );
}
