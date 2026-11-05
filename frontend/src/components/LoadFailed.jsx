// ── frontend/src/components/LoadFailed.jsx ─────────────────────────
// WHAT: the "couldn't load" card (approved design, Nov 2026). Three honest states:
//   offline  → violet, waits and retries by itself the moment you are back online
//   waking   → gold, the server is starting (sleeping host, 502/503/504, timeout):
//              counts down and retries by itself, up to 4 times
//   error    → coral, our fault: Try again + Get help, with a reference code
// Same props as before, so every page keeps working.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const ICON = {
  offline: 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01M3 3l18 18',
  waking: 'M12 3v3M12 18v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M3 12h3M18 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  error: 'M12 9v4M12 17h.01M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
};
const COPY = {
  offline: ['No internet', 'You look offline', 'Nothing is lost. Your shop keeps answering customers. Reconnect and this page loads by itself.'],
  waking: ['Waking up', 'Your shop is starting up', 'The server was resting and takes about a minute to wake. Your customers are still being answered.'],
  error: ['Something went wrong', null, 'This one is on us. Try again, and if it keeps happening, tap Get help and we will fix it.'],
};

export default function LoadFailed({ title, status, detail, tries = 0, onRetry, backTo = '/help' }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const kind = !online ? 'offline' : (!status || status === 0 || status === 502 || status === 503 || status === 504 || /wak|timed? ?out|sleep/i.test(String(detail || ''))) && tries < 4 ? 'waking' : 'error';
  const [left, setLeft] = useState(8);
  const ref = useMemo(() => (Date.now().toString(36).slice(-4) + (status || 0).toString(36)).toUpperCase(), [status, tries]);

  useEffect(() => { // back online → load again by itself
    const up = () => { setOnline(true); if (onRetry) onRetry(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [onRetry]);
  useEffect(() => { // waking: count down and try again
    if (kind !== 'waking') return undefined;
    setLeft(8);
    const t = setInterval(() => setLeft((n) => { if (n <= 1) { clearInterval(t); if (onRetry) onRetry(); return 0; } return n - 1; }), 1000);
    return () => clearInterval(t);
  }, [kind, tries]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tag, head, body] = COPY[kind];
  const heading = head || (title ? title.replace(/^Couldn.t/, 'We couldn’t') : 'We couldn’t load this');
  return (
    <div className={'lf lf-' + kind} role="alert">
      <div className="lf-art" aria-hidden="true"><span className="lf-ring" /><span className="lf-tile"><svg className="lf-ic" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[kind]} /></svg></span></div>
      <span className="lf-tag">{tag}</span>
      <h2>{heading}</h2>
      <p>{kind === 'error' && detail && !/connection failed/i.test(detail) ? detail : body}</p>
      <div className="lf-btns">
        <button type="button" className="btn lf-go" onClick={onRetry}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" /></svg>Try again</button>
        <Link className="btn ghost" to={backTo === '/dashboard' ? '/help' : backTo}>Get help</Link>
      </div>
      {kind === 'offline' && <div className="lf-auto"><i />Waiting for your connection…</div>}
      {kind === 'waking' && <div className="lf-auto"><i />Trying again in {left} second{left === 1 ? '' : 's'}…</div>}
      {kind === 'error' && <div className="lf-ref">Reference: {ref} · share it with support</div>}
    </div>
  );
}
