// ── frontend/src/lib/api.js ──────────────────────────────────────
// WHAT: the frontend's ONLY way to talk to the backend: api() + toast() + pop().
// Every page imports from here (one shared helper = consistent auth, errors, UX).
// No npm modules — browser `fetch` + raw DOM for notifications (no toast library).

// Shared API helpers for the VeloSales Ai React frontend.
// SPLIT DEPLOY: same-origin by default (local dev + full-stack Render + Vercel
// proxy — vercel.json rewrites /api/* to the Render backend, so the session
// cookie stays FIRST-party: no CORS, no third-party-cookie blocking).
// VITE_API_URL remains as an override (e.g. testing the API directly), but
// empty is now the recommended value on Vercel (proxy handles it).
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''); // import.meta.env = Vite's env (VITE_*-prefixed vars baked in at BUILD time!); strip trailing slash so '/api' joins cleanly
export const OFFLINE_MSG = 'You look offline — reconnect and try again.'; // ONE sentence for every offline surface (cards, toasts, the Shell banner)
export async function api(url, opts = {}) { // url like '/api/me'; opts = {method, body, headers…, timeout} (timeout ms, default 30s!)
  // AIRPLANE MODE: the browser already knows there is no network, so waiting on
  // a fetch that cannot leave the device is a lie (and a spinner with no end).
  // Answer at once, in the same {ok,status,data} shape callers already handle.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, status: 0, data: { error: OFFLINE_MSG, offline: true } };
  }
  const ctrl = new AbortController(); // hanging requests must DIE (a stuck fetch = an eternally-loading page — the 12-hour skeleton bug!)
  const timer = setTimeout(() => ctrl.abort(), Number(opts.timeout) || 30000); // sleeping servers + dead networks abort into a catchable error
  try {
    const { timeout: _t, ...rest } = opts; // strip our custom key (fetch would choke on it!)
    const r = await fetch(API_BASE + url, { // prefix: '' locally (same-origin) or the Render URL on Vercel (cross-origin + cookies — needs backend CORS!)
      credentials: 'include', // CRITICAL: send the session cookie (without this, backend thinks we're logged out!)
      headers: { 'Content-Type': 'application/json', ...(rest.headers || {}) }, // JSON bodies by default; ...spread lets callers add/override headers
      signal: ctrl.signal, // abort wiring (aborted fetch THROWS — callers' .catch handles it!)
      ...rest, // spread the rest (method: 'POST', body: JSON.stringify(…)…)
    }); // NOTE: rest spread AFTER headers — so a caller-supplied method/body can't be clobbered… (headers merged above instead)
    const data = await r.json().catch(() => ({})); // parse JSON; .catch(()=>({})) = empty/204 responses become {} instead of throwing
    return { ok: r.ok, status: r.status, data }; // r.ok = status 200–299; callers branch on ok (if (ok) … else …)
  } finally {
    clearTimeout(timer); // answered (or threw) → disarm (no leaked timers!)
  }
}

export function esc(s) { // escape HTML special chars (XSS defense if we ever inject strings into HTML)
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); // ?? = null/undefined → ''; regex g = every occurrence; map char → entity
}

export function fmtDate(d) { // '2026-09-10T…' → '10 Sept 2026' (en-GB style)
  if (!d) return '—'; // guard: null dates render as an em-dash, never "Invalid Date"
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); // toLocaleDateString = browser's Intl formatter (no date library installed!)
}

export function fmtTime(d) { // '2026-09-10T14:30…' → '10 Sept, 14:30' (inbox timestamps)
  if (!d) return '—'; // same null guard
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); // date + hours:minutes
}

// Toast notification system — animated slide-in + icon pop (ok) / shake (err).
export function toast(msg, type = 'ok') { // msg = text; type = 'ok' | 'err' | 'info' (default param = 'ok')
  const wrap = document.createElement('div'); // raw DOM (no React): a positioned container…
  wrap.className = 'toast-wrap'; // …styled by .toast-wrap in styles.css (fixed top-right)
  const t = document.createElement('div'); // the toast pill itself
  t.className = 'toast toast-in ' + type; // toast-in = entrance animation; type colors it (green/red)
  const icons = { // inline SVG strings (no icon font needed for these three)
    ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path class="tick-draw" d="M8.5 12.5l2.5 2.5 4.5-5.5"/></svg>', // check draws itself via .tick-draw CSS animation
    err: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>', // X mark (two crossing lines)
    info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>', // little "i"
  };
  t.innerHTML = '<span class="toast-ic">' + (icons[type] || icons.info) + '</span><span></span>'; // icon span + empty text span (text set safely below)
  t.lastChild.textContent = msg; // textContent (NOT innerHTML) = user text can't inject HTML (XSS-safe by construction)
  wrap.appendChild(t); // nest pill inside wrapper…
  document.body.appendChild(wrap); // …and mount to the page (outside React's tree — toasts survive navigation)
  setTimeout(() => { // auto-dismiss after 3.5s…
    t.classList.add('out'); // …first fade/slide out (CSS transition)…
    setTimeout(() => wrap.remove(), 300); // …then remove from DOM after the animation (300ms matches CSS)
  }, 3500);
}

// Big result popup — animated success check-draw (with confetti burst) or
// error X-shake. Use for every completed action: pop('ok'|'err', title, msg).
export function pop(type, title, msg, opts = {}) { // type: 'ok' | 'err' | 'offline'; opts.action = { label, run } adds a second button
  document.querySelector('.pop-overlay')?.remove(); // one popup at a time
  const kind = type === 'err' ? 'err' : type === 'offline' ? 'off' : 'ok';
  const icon = kind === 'ok' ? '<path d="M15 26.5l7 7 15-15"/>' : kind === 'err' ? '<path d="M18 18l16 16M34 18L18 34"/>' : '<path d="M10 22a23 23 0 0 1 32 0M15 28a16 16 0 0 1 22 0M20.5 33.5a8 8 0 0 1 11 0M26 39h.01"/>';
  const ov = document.createElement('div');
  ov.className = 'pop-overlay';
  ov.innerHTML = '<div class="pop-card ' + kind + '" role="alertdialog" aria-modal="true">' +
    '<div class="pop-ic"><svg viewBox="0 0 52 52" aria-hidden="true">' + icon + '</svg></div>' +
    '<h3></h3><p></p><div class="pop-acts"><button class="pop-main"></button></div></div>';
  ov.querySelector('h3').textContent = title || (kind === 'ok' ? 'Done' : kind === 'err' ? "That didn't work" : "You're offline");
  ov.querySelector('p').textContent = msg || (kind === 'off' ? "Nothing was lost. We'll try again as soon as your internet is back." : '');
  const main = ov.querySelector('.pop-main');
  main.textContent = kind === 'ok' ? 'Great' : kind === 'err' ? 'Try again' : 'Retry now';
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); };
  main.onclick = () => { close(); if (kind !== 'ok' && opts.retry) opts.retry(); };
  if (kind === 'err') {
    const help = document.createElement('a');
    help.className = 'pop-alt'; help.href = '/help'; help.textContent = 'Get help';
    ov.querySelector('.pop-acts').appendChild(help);
  }
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.body.appendChild(ov);
  setTimeout(() => main.focus(), 50);
  if (kind === 'ok') setTimeout(close, 3800); // errors wait for the owner to read them
}
