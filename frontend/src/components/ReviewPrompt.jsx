// ── frontend/src/components/ReviewPrompt.jsx ───────────────────────
// WHAT: the review pop-up (approved design). Pages call askReview(action, title)
// after a real win; the server decides whether to ask (at most once every 14
// days, never in the first 2 days, not if they reviewed recently). Mounted once
// in Shell. Reviews go to our own database (app_reviews) and the admin console.
import { useEffect, useState } from 'react';
import { api, toast } from '../lib/api.js';

export function askReview(action, title) {
  try { window.dispatchEvent(new CustomEvent('velo-review', { detail: { action, title } })); } catch { /* old browser: no prompt */ }
}

export default function ReviewPrompt() {
  const [ask, setAsk] = useState(null); // { action, title }
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let showing = false;
    const on = async (e) => {
      if (showing) return;
      const d = (e && e.detail) || {};
      const { ok, data } = await api('/api/me/review/should?action=' + encodeURIComponent(d.action || ''), { timeout: 8000 }).catch(() => ({}));
      if (ok && data && data.ask) { showing = true; setTimeout(() => setAsk(d), 900); } // after the success message, not on top of it
    };
    window.addEventListener('velo-review', on);
    return () => window.removeEventListener('velo-review', on);
  }, []);
  if (!ask) return null;
  const close = () => { setAsk(null); setStars(0); setComment(''); };
  async function send() {
    if (!stars || busy) return;
    setBusy(true);
    const { ok } = await api('/api/me/review', { method: 'POST', body: JSON.stringify({ rating: stars, comment, action: ask.action }) });
    setBusy(false);
    close();
    toast(ok ? (stars >= 4 ? 'Thank you! That means a lot.' : 'Thank you. We read every one and will make it better.') : 'Could not send it, but thank you.');
  }
  const shown = hover || stars;
  return (
    <div className="rvp" role="dialog" aria-modal="false" aria-labelledby="rvp-t">
      <div className="rvp-top">
        <span className="rvp-ok" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24"><path fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <div><b id="rvp-t">{ask.title || 'Nice work'}</b><small>Quick one: how is VeloSales working for you?</small></div>
        <button type="button" className="rvp-x" onClick={() => { api('/api/me/review/skip', { method: 'POST' }); close(); }} aria-label="Not now">×</button>
      </div>
      <div className="rvp-stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={n + (n === 1 ? ' star' : ' stars')} className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setStars(n)}>★</button>
        ))}
      </div>
      {stars > 0 && <textarea className="rvp-in" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder={stars >= 4 ? 'What do you like most? (optional)' : 'What would make it better? (optional)'} aria-label="Comment" />}
      <div className="rvp-row">
        <button type="button" className="rvp-later" onClick={() => { api('/api/me/review/skip', { method: 'POST' }); close(); }}>Not now</button>
        <button type="button" className="rvp-send" disabled={!stars || busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
    </div>
  );
}
