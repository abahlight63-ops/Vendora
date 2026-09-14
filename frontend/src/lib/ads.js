// ── frontend/src/lib/ads.js ──────────────────────────────────────
// WHAT: ALL ad logic lives here (single source of truth — no page implements
// ads itself). Two income streams, both FREE TIER ONLY (backend sends tags to
// non-Pro; Pro gets null → every function below silently no-ops for Pro):
//   per-VIEW: network tags (Monetag MultiTag, Adsterra Social Bar) injected once
//   per-CLICK: in-house "Sponsored" interstitial, max once/day, clicks logged
//     to /api/me/ads/click for per-click sponsor billing (/api/ads/stats).
// No npm modules — fetch (api.js) + DOM + localStorage only.
import { api } from './api.js'; // shared fetch helper (session cookie included)

let cached = null; // module-level cache: ONE /api/me call per page-load (null = not fetched yet; note: null also means "logged out" after a failed fetch)

// Fetch (once) what ads this user should see. Backend decides by tier:
// free → { networks: [{provider, scriptUrl}…], sponsor: {…} | null } | null.
export async function getAds() {
  if (cached !== null) return cached; // cache hit → no second HTTP call (fast + fewer logs)
  try {
    const { ok, data } = await api('/api/me'); // getMe response carries .ads alongside .business
    cached = ok ? data.ads || null : null; // ok? use it (|| null if backend sent nothing) : logged-out → null
  } catch { cached = null; } // network error → treat as "no ads" (ads must NEVER break the app)
  return cached;
}

// Per-VIEW: inject each network tag once per session (15s stuck-tag guard — slow phone networks need room).
function injectTag(provider, url) { // NOT exported: internal helper (only loadNetworkAds uses it)
  if (!url || document.querySelector(`script[data-adnet="${provider}"]`)) return; // no URL, or tag already present → skip (idempotent = safe to call repeatedly)
  const s = document.createElement('script'); // create <script> element programmatically…
  s.async = true; // async = never blocks page rendering (ads must never slow the app)
  s.dataset.adnet = provider; // data-adnet="monetag" → the dedupe hook above finds it next time
  s.src = url; // setting .src STARTS the download (browser fetches the ad network's code)
  const kill = setTimeout(() => s.remove(), 15000); // SAFETY: yank the tag if it hangs >15s (dead server can't freeze us; 15s — not 5 — so slow phone networks still load fine)
  s.onload = () => clearTimeout(kill); // loaded fine → cancel the yank timer…
  s.onerror = () => s.remove(); // …failed → remove immediately (broken tag leaves no trace)
  document.head.appendChild(s); // mount into <head> → browser executes it
}
export async function loadNetworkAds() { // called ONCE by App.jsx after login (exported for that single use)
  const ads = await getAds(); // tier-resolved config (null for Pro/logged-out)
  if (!ads) return; // nothing to load → done (Pro sees zero ads, zero requests)
  const nets = Array.isArray(ads.networks) && ads.networks.length // prefer the networks ARRAY (multi-network)…
    ? ads.networks
    : (ads.scriptUrl ? [{ provider: ads.provider, scriptUrl: ads.scriptUrl }] : []); // …fall back to legacy single-tag shape (backward-compat with older backend)
  nets.forEach((n) => injectTag(n.provider || 'custom', n.scriptUrl)); // forEach (not await): tags load INDEPENDENTLY, in parallel
}

function seenToday() { // has the sponsor interstitial shown today? (daily cap lives HERE, client-side)
  try { return localStorage.getItem('sponsor_seen') === new Date().toISOString().slice(0, 10); } // compare stored 'YYYY-MM-DD' with today (toISOString is UTC — fine for a daily cap)
  catch { return true; } // storage broken (private mode) → pretend seen (fail CLOSED: fewer ads, never errors)
}
function markSeen() { // record today's showing…
  try { localStorage.setItem('sponsor_seen', new Date().toISOString().slice(0, 10)); } catch {} // …silently ignore storage failures
}

// Per-CLICK: sponsored interstitial, max once/day, clearly labeled, one-tap close.
// Call after high-attention free-tier moments (product add, AI limit hit).
export async function maybeShowSponsor() { // called by Catalog + VendoraAI (exported for those two)
  const ads = await getAds(); // tier-resolved config…
  const sp = ads?.sponsor; // ?. = null-safe (ads null → sp undefined, no crash)
  if (!sp || seenToday()) return false; // no sponsor configured OR already shown today → skip (return value tells caller)
  markSeen(); // mark FIRST (even if they close instantly, it counted as shown — daily cap holds)
  const ov = document.createElement('div'); // fullscreen dim layer (reuses .pop-overlay styles = consistent look)
  ov.className = 'pop-overlay';
  ov.innerHTML = // static markup only (title/text set via textContent below = XSS-safe)…
    '<div class="pop-card sponsor">' +
    '<span class="sponsor-tag">Sponsored</span>' + // ALWAYS labeled (hiding sponsorship = illegal in most countries!)
    '<h3></h3><p></p>' + // filled safely below
    '<button class="btn sm">Visit sponsor</button>' + // primary: visit (this click = billable!)
    '<button class="sponsor-skip">Continue without visiting</button>' + // secondary: free dismiss (forced views without exit = policy violation)
    '<p class="hint sponsor-pro">Pro removes sponsors — see Billing</p></div>'; // upsell line (free→paid conversion!)
  ov.querySelector('h3').textContent = sp.title; // textContent = HTML-injection-proof
  ov.querySelector('p').textContent = sp.text || ''; // || '' guards missing text
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); }; // fade (CSS) then remove from DOM
  ov.querySelector('.btn').onclick = async () => { // VISIT = the money event…
    try { await api('/api/me/ads/click', { method: 'POST', body: JSON.stringify({ slot: 'sponsor', target_url: sp.link }) }); } catch {} // …log it for sponsor invoicing FIRST (await = counted before they leave; try/catch = logging never blocks)
    window.open(sp.link, '_blank', 'noopener'); // open sponsor in new tab (noopener = the sponsor page can't touch OUR window — security!)
    close(); // dismiss after
  };
  ov.querySelector('.sponsor-skip').onclick = close; // skip = just close (no logging — only visits bill)
  document.body.appendChild(ov); // mount (outside React, like toasts/pops)
  return true; // shown (caller may ignore)
}
