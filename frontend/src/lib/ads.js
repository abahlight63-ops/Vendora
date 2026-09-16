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
let seeded = false; // true once App.jsx seeds the cache from its own /api/me (avoids a duplicate fetch + race)

// Seed the cache from App.jsx's /api/me response (same shape: data.ads).
// Call on login-load; call resetAdsCache() on logout so the next user refetches.
export function setAdsCache(ads) { cached = ads || null; seeded = true; }
export function resetAdsCache() { cached = null; seeded = false; }
export function adsSeeded() { return seeded; }

// Fetch (once) what ads this user should see. Backend decides by tier:
// free → { networks, sponsor } (always an object — possibly empty); Pro → null.
export async function adsStatus() {
  // Debug snapshot for Admin preview + AdSlot: { state: 'pro'|'free-empty'|'free-live'|'guest', networks, sponsor }
  const ads = await getAds();
  if (cached === null && !seeded) return { state: 'guest', networks: [], sponsor: null };
  if (!ads) return { state: 'pro', networks: [], sponsor: null };
  const nets = Array.isArray(ads.networks) ? ads.networks : [];
  if (!nets.length && !ads.sponsor) return { state: 'free-empty', networks: nets, sponsor: null };
  return { state: 'free-live', networks: nets, sponsor: ads.sponsor || null };
}

export async function getAds() {
  if (cached !== null || seeded) return cached; // cache hit → no second HTTP call (fast + fewer logs)
  try {
    const { ok, data } = await api('/api/me'); // getMe response carries .ads alongside .business
    cached = ok ? data.ads || null : null; // ok? use it (|| null if backend sent nothing) : logged-out → null
  } catch { cached = null; } // network error → treat as "no ads" (ads must NEVER break the app)
  return cached;
}

// Per-VIEW: inject each network tag once per session (15s stuck-tag guard — slow phone networks need room).
// freq 'daily' (popunder) is capped to one injection per browser per day via
// localStorage — aggressive formats must never overshow. 'session' tags rely
// on once-per-login injection + the network's own impression throttling.
function dayKey(provider) { // daily-cap storage key, e.g. 'adfreq:adsterra-popunder:2026-09-16'
  return `adfreq:${provider}:` + new Date().toISOString().slice(0, 10); // UTC date (same convention as the sponsor cap)
}
function injectTag(provider, url, freq) { // NOT exported: internal helper (only loadNetworkAds uses it)
  if (!url || document.querySelector(`script[data-adnet="${provider}"]`)) return; // no URL, or tag already present → skip (idempotent = safe to call repeatedly)
  if (freq === 'daily') { // popunder-style: one showing per browser per day…
    try { if (localStorage.getItem(dayKey(provider))) return; } catch { return; } // already shown today (or storage broken → fail CLOSED: fewer ads, never errors)
  }
  const s = document.createElement('script'); // create <script> element programmatically…
  s.async = true; // async = never blocks page rendering (ads must never slow the app)
  s.dataset.adnet = provider; // data-adnet="monetag" → the dedupe hook above finds it next time
  s.dataset.adfreq = freq || 'session'; // data-adfreq lets the AdSlot ad-block probe ignore daily-capped tags
  s.src = url; // setting .src STARTS the download (browser fetches the ad network's code)
  const kill = setTimeout(() => s.remove(), 15000); // SAFETY: yank the tag if it hangs >15s (dead server can't freeze us; 15s — not 5 — so slow phone networks still load fine)
  s.onload = () => clearTimeout(kill); // loaded fine → cancel the yank timer…
  s.onerror = () => s.remove(); // …failed → remove immediately (broken tag leaves no trace)
  document.head.appendChild(s); // mount into <head> → browser executes it
  if (freq === 'daily') { // mark SHOWN only after mounting (a skipped inject never consumes the day's cap)…
    try { localStorage.setItem(dayKey(provider), '1'); } catch {} // …silently ignore storage failures
  }
}
export async function loadNetworkAds() { // called ONCE by App.jsx after login (exported for that single use)
  const ads = await getAds(); // tier-resolved config (null for Pro/logged-out)
  if (!ads) return; // nothing to load → done (Pro sees zero ads, zero requests)
  const nets = Array.isArray(ads.networks) && ads.networks.length // prefer the networks ARRAY (multi-network)…
    ? ads.networks
    : (ads.scriptUrl ? [{ provider: ads.provider, scriptUrl: ads.scriptUrl, freq: 'session' }] : []); // …fall back to legacy single-tag shape (backward-compat with older backend)
  nets.forEach((n) => injectTag(n.provider || 'custom', n.scriptUrl, n.freq || 'session')); // forEach (not await): tags load INDEPENDENTLY, in parallel
}

function seenToday() { // has the sponsor interstitial shown today? (daily cap lives HERE, client-side)
  try { return localStorage.getItem('sponsor_seen') === new Date().toISOString().slice(0, 10); } // compare stored 'YYYY-MM-DD' with today (toISOString is UTC — fine for a daily cap)
  catch { return true; } // storage broken (private mode) → pretend seen (fail CLOSED: fewer ads, never errors)
}
function markSeen() { // record today's showing…
  try { localStorage.setItem('sponsor_seen', new Date().toISOString().slice(0, 10)); } catch {} // …silently ignore storage failures
}

// Clears today's sponsor cap (Admin "Preview" button uses this, then calls maybeShowSponsor).
export function clearSponsorSeen() { try { localStorage.removeItem('sponsor_seen'); } catch {} }

// Per-CLICK: sponsored interstitial, max once/day, clearly labeled, one-tap close.
// Call after high-attention free-tier moments (product add, AI limit hit).
export async function maybeShowSponsor() { // called by Catalog + VendoraAI + Dashboard (exported for those)
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
  if (sp.video) { // VIDEO AD: 15–30s mp4 from SPONSOR_VIDEO_URL (no network needed)…
    const v = document.createElement('video'); // createElement (not innerHTML): the URL can never inject markup…
    v.src = sp.video; // …mp4 file (Cloudinary free hosting works)…
    v.controls = true; // play/pause/seek/volume (user-driven: never autoplay with sound — browser policy + politeness!)…
    v.playsInline = true; // iOS: play inside the card, not fullscreen-takeover…
    v.preload = 'metadata'; // load duration + first frame only (no data eaten until they press play)…
    v.style.cssText = 'width:100%;border-radius:12px;margin:8px 0;background:#000;max-height:230px;'; // card-shaped player (black bars like real video ads)
    ov.querySelector('.pop-card').insertBefore(v, ov.querySelector('.btn')); // …above the Visit button (see → tap = the billable click!)
  }
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
