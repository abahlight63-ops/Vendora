// ── frontend/src/lib/api.js ──────────────────────────────────────
// WHAT: the frontend's ONLY way to talk to the backend: api() + toast() + pop().
// Every page imports from here (one shared helper = consistent auth, errors, UX).
// No npm modules — browser `fetch` + raw DOM for notifications (no toast library).

// Shared API helpers for the Vendora React frontend.
// SPLIT DEPLOY: same-origin by default (local dev + full-stack Render). When the
// frontend lives on Vercel apart from the API, set VITE_API_URL to the Render
// URL (e.g. https://vendora.onrender.com) and all calls are prefixed with it.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''); // import.meta.env = Vite's env (VITE_*-prefixed vars baked in at BUILD time!); strip trailing slash so '/api' joins cleanly
export async function api(url, opts = {}) { // url like '/api/me'; opts = {method, body, headers…}
  const r = await fetch(API_BASE + url, { // prefix: '' locally (same-origin) or the Render URL on Vercel (cross-origin + cookies — needs backend CORS!)
    credentials: 'include', // fetch = browser built-in HTTP (like Node's, but with cookies)
    credentials: 'include', // CRITICAL: send the session cookie (without this, backend thinks we're logged out!)
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, // JSON bodies by default; ...spread lets callers add/override headers
    ...opts, // spread the rest (method: 'POST', body: JSON.stringify(…)…)
  }); // NOTE: opts spread AFTER headers — so a caller-supplied method/body can't be clobbered… (headers merged above instead)
  const data = await r.json().catch(() => ({})); // parse JSON; .catch(()=>({})) = empty/204 responses become {} instead of throwing
  return { ok: r.ok, status: r.status, data }; // r.ok = status 200–299; callers branch on ok (if (ok) … else …)
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
export function pop(type, title, msg) { // type: 'ok' or 'err' (anything non-'err' counts as success)
  document.querySelector('.pop-overlay')?.remove(); // ?. = only one popup at a time: remove any existing first
  const ok = type !== 'err'; // boolean flag reused below
  const ov = document.createElement('div'); // fullscreen dim background…
  ov.className = 'pop-overlay'; // …styled fixed + centered in CSS
  ov.innerHTML = // big template string builds the whole card (static markup only — user text injected safely below)
    '<div class="pop-card ' + (ok ? 'ok' : 'err') + '">' + // card color theme by outcome
    (ok ? '<div class="pop-confetti"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : '') + // 6 confetti dots on success only (CSS animates them)
    '<div class="pop-ring">' + // the animated circle…
    (ok
      ? '<svg viewBox="0 0 52 52"><circle class="pop-circle" cx="26" cy="26" r="24"/><path class="pop-check" d="M14 27l8 8 16-16"/></svg>' // …check that draws itself (stroke-dashoffset animation)
      : '<svg viewBox="0 0 52 52"><circle class="pop-circle" cx="26" cy="26" r="24"/><path class="pop-x" d="M18 18l16 16M34 18L18 34"/></svg>') + // …or X that draws + shakes
    '</div>' +
    '<h3></h3><p></p>' + // empty title/message (filled via textContent below = XSS-safe)
    '<button class="btn sm">Continue</button></div>'; // reuses the app's .btn styles (consistent look, zero extra CSS)
  ov.querySelector('h3').textContent = title || (ok ? 'Successful!' : 'Failed'); // || defaults when caller omits title
  ov.querySelector('p').textContent = msg || ''; // safe text injection
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); }; // fade then remove (matches CSS timing)
  ov.querySelector('button').onclick = close; // Continue button closes…
  ov.onclick = (e) => { if (e.target === ov) close(); }; // …clicking the dim backdrop closes too (but clicks INSIDE the card don't: e.target would be the card)
  document.body.appendChild(ov); // mount to page (outside React, like toasts)
  setTimeout(close, 4200); // auto-close after 4.2s even if ignored
}
