// ── frontend/src/lib/ads.js ──────────────────────────────────────
// WHAT: ALL ad logic lives here (single source of truth — no page implements
// ads itself). Two income streams, both FREE TIER ONLY (backend sends tags to
// non-Pro; Pro gets null → every function below silently no-ops for Pro):
//   per-VIEW: network tags (Monetag MultiTag, Adsterra Social Bar) injected once
//   per-CLICK: in-house "Sponsored" interstitial, max once/day, clicks logged
//     to /api/me/ads/click for per-click sponsor billing (/api/ads/stats).
//   per-COMPLETE: gated 30s VIDEO on Connect (free tier): own sponsor mp4 >
//     HilltopAds VAST > Monetag rewarded > Adsterra Smartlink. Completions are
//     the invoice unit (5-20x banner CPMs!) — logged to /api/me/ads/video.
// No npm modules — fetch (api.js) + DOM + localStorage only.
import { api, toast } from './api.js'; // shared fetch helper (session cookie included) + toast (gentle upgrade pill!)

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
  if (freq === 'daily' || /popunder/i.test(provider || '')) return; // popunder-style tags HIJACK the next click (whole tab → offer URL). Banned from auto-inject — offers open ONLY behind explicit "Visit sponsor" taps (new tab!).
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

const VIDEO_LEN = 30; // the gate: 30 seconds of attention (sponsor invoice unit!)
const VIDEO_SKIP_AT = 5; // skip unlocks at 5s (polite but paid — completions still track!)

function videoCapKey(slot) { // once per action per day (never stack videos back-to-back!)
  return `advideo:${slot}:` + new Date().toISOString().slice(0, 10); // UTC date (same convention as sponsor_seen!)
}
function videoSeen(slot) {
  try { return !!localStorage.getItem(videoCapKey(slot)); } catch { return true; } // storage broken → pretend seen (fewer ads, never errors!)
}
function markVideoSeen(slot) {
  try { localStorage.setItem(videoCapKey(slot), '1'); } catch {} // mark FIRST (even instant closes consume the day — no nagging!)
}
export function clearVideoSeen(slot) { try { localStorage.removeItem(videoCapKey(slot || 'connect')); } catch {} } // Admin preview bypass!

async function logVideo(slot, source, event) { // funnel event → backend (fire-and-forget: logging never blocks the gate!)
  try { await api('/api/me/ads/video', { method: 'POST', body: JSON.stringify({ slot, source, event }) }); } catch {} // network down → drop it (funnel gaps beat frozen gates!)
}

// A tag URL is a PLAYABLE script only if it looks like one (.js tag).
// Offer/direct links (no .js — e.g. a /drm/… URL) are EXIT traffic: opening
// them as <script> renders nothing (the infamous dead-timer page!). Such URLs
// auto-degrade to the Smartlink path instead of a blank player. NEVER break!
function isScriptTag(url) {
  return /\.js(\?|#|$)/i.test(String(url || '')); // offer/direct links (no .js) are NOT players!
}

// GATED 30s VIDEO (page entries, free tier only): sponsor mp4 >
// HilltopAds > Monetag > Adsterra Smartlink fallback.
// Countdown + progress bar + skip-at-5s. Resolves when the flow ends —
// callers ALWAYS proceed afterwards (the gate delays, never blocks!).
// force = Admin preview (bypasses the daily cap, never marks it!).
// only = Admin per-layer test ('sponsor' | 'hilltopads' | 'monetag' | 'adsterra').
export async function maybeShowVideoAd({ slot = 'connect', force = false, only = null } = {}) {
  const ads = await getAds(); // tier-resolved config (Pro = null → straight through!)
  const v = ads && ads.video;
  if (!v) return 'skipped-empty'; // Pro, logged-out, or backend without video config
  if (!force && videoSeen(slot)) return 'skipped-cap'; // already gated this action today
  const order = only ? [only] : (Array.isArray(v.order) && v.order.length ? v.order : ['sponsor', 'hilltopads', 'monetag', 'adsterra']);
  const tagUrlOf = { sponsor: null, hilltopads: v.hilltopads, monetag: v.monetag, adsterra: v.adsterra }; // sponsor plays mp4 (never a tag!)
  const has = { // what's actually playable right now?
    sponsor: !!(v.sponsorVideo && v.sponsorLink),
    hilltopads: !!v.hilltopads,
    monetag: !!v.monetag,
    adsterra: !!v.adsterra,
  };
  const candidates = order.filter((s) => has[s]); // available layers, waterfall order (sponsor mp4 wins ties!)
  if (!candidates.length) return 'skipped-empty'; // nothing configured → button works exactly as today (never a dead end!)
  if (typeof document !== 'undefined' && document.querySelector('.pop-card.vgate')) return 'already-open'; // double-tap guard (one gate at a time — second click sails straight through!)
  if (!force) markVideoSeen(slot);
  for (const pick of candidates) { // try each layer in turn (dead layer → next, never a dead timer!)
    const tagUrl = tagUrlOf[pick];
    if (pick === 'adsterra' || (tagUrl && !isScriptTag(tagUrl))) { // exit traffic (Smartlink OR offer-style URL with no .js — the /drm/… lesson!)
      const url = pick === 'adsterra' ? v.adsterra : tagUrl;
      const direct = window.open(url, '_blank', 'noopener'); // click-gesture flows open instantly (button gates!)
      if (direct) { logVideo(slot, pick, 'click'); return pick + '-click'; }
      const seen = await playLinkLayer({ slot, pick, url }); // popup blocked (page-entry gates have no gesture!) → VISIBLE mini-card instead (never silent!)
      if (seen !== 'layer-empty') return seen; // visited/skipped → done (skip advances past Smartlink — one layer per gate!)
      continue;
    }
    const outcome = await playVideoLayer({ slot, pick, v }); // gated player (resolves completed/skipped/layer-empty!)
    if (outcome !== 'layer-empty') return outcome; // empty frame → NEXT layer (a broken tag never embarrasses us!)
    logVideo(slot, pick, 'tag-failed');
  }
  return 'skipped-empty'; // every layer dead → straight through (buttons always work!)

  // ── exit-traffic mini-card (page-entry gates): visible offer card with
  // Visit (user tap = real gesture, popup opens!) + instant Skip. NEVER silent —
  // this is what page visitors see when only link-layers are configured.
  function playLinkLayer({ slot, pick, url }) { return new Promise((resolve) => {
    let done = false;
    const finish = (outcome) => {
      if (done) return; done = true;
      ov.classList.add('out'); setTimeout(() => ov.remove(), 250);
      resolve(outcome);
    };
    const ov = document.createElement('div');
    ov.className = 'pop-overlay';
    ov.innerHTML =
      '<div class="pop-card sponsor vgate">' +
      '<span class="sponsor-tag">Sponsored · offer</span>' +
      '<h3></h3>' +
      '<p class="hint">Tap Visit to open the offer — it keeps VeloSales AI free.</p>' +
      '<button class="btn sm vgate-visit">Visit sponsor</button>' +
      '<button class="sponsor-skip">Skip →</button>' +
      '</div>';
    ov.querySelector('h3').textContent = pick === 'adsterra' ? 'Sponsored offer' : 'Sponsored video';
    ov.querySelector('.vgate-visit').onclick = async () => { // VISIT = the money event (tap = gesture, opens!)
      logVideo(slot, pick, 'click');
      try { await api('/api/me/ads/click', { method: 'POST', body: JSON.stringify({ slot: 'video-' + slot, target_url: url }) }); } catch {} // click ALSO in ad_clicks (sponsor invoices read both!)
      window.open(url, '_blank', 'noopener');
      toast('Pro removes all ads — see Billing'); // gentle pill (auto-dismisses, never blocks!)
      finish('visited');
    };
    ov.querySelector('.sponsor-skip').onclick = () => { logVideo(slot, pick, 'skip'); finish('skipped'); }; // skip = logged + out
    setTimeout(() => finish('layer-empty'), 60000); // absolute backstop (60s — nothing traps, ever!)
    logVideo(slot, pick, 'start'); // funnel opens (visible card, counted!)
    document.body.appendChild(ov);
  }); }

  // ── one gated player attempt (overlay lifetime = this promise!) ──
  function playVideoLayer({ slot, pick, v }) { return new Promise((resolve) => { // overlay lifetime = this promise (close paths ALL resolve it!)
    const t0 = Date.now(); // gate clock (drives countdown + progress + completion!)
    let done = false; // settled once (timers + events race — first wins!)
    let quartiles = {}; // q25/q50/q75 logged once each (completion RATE = attention quality!)
    const finish = (outcome) => { // single exit (clear timers, remove overlay, resolve caller!)
      if (done) return; done = true;
      clearInterval(tick); clearTimeout(watchdog); clearTimeout(emptyCheck);
      try { tagScript && tagScript.remove(); } catch {} // network tag yanked (no orphan players phoning home!)
      ov.classList.add('out'); setTimeout(() => ov.remove(), 250); // fade, then gone
      resolve(outcome);
    };
    const log = (event) => logVideo(slot, pick, event); // source pinned (closure!)
    // ── overlay skeleton (DOM-built + textContent = XSS-safe!) ──
    const ov = document.createElement('div');
    ov.className = 'pop-overlay';
    ov.innerHTML =
      '<div class="pop-card sponsor vgate">' +
      '<span class="sponsor-tag">Sponsored · video</span>' +
      '<h3></h3>' +
      '<div class="vgate-bar"><i></i></div>' +
      '<div class="vgate-meta"><span class="vgate-count">30</span><button class="vgate-skip" hidden>Skip →</button></div>' +
      '<div class="vgate-body"></div>' +
      '<button class="btn sm vgate-visit" hidden>Visit sponsor</button>' +
      '</div>';
    const title = pick === 'sponsor' ? (v.sponsorTitle || 'Sponsored') : pick === 'hilltopads' ? 'Sponsored video' : 'Rewarded video';
    ov.querySelector('h3').textContent = title; // textContent (never innerHTML with config strings!)
    const bar = ov.querySelector('.vgate-bar i');
    const count = ov.querySelector('.vgate-count');
    const skipBtn = ov.querySelector('.vgate-skip');
    const body = ov.querySelector('.vgate-body');
    const visitBtn = ov.querySelector('.vgate-visit');
    // ── countdown + progress (one 250ms ticker drives everything!) ──
    const tick = setInterval(() => {
      const el = Math.min(VIDEO_LEN, (Date.now() - t0) / 1000); // elapsed, capped at 30
      bar.style.width = (el / VIDEO_LEN * 100) + '%';
      count.textContent = String(Math.max(0, Math.ceil(VIDEO_LEN - el)));
      if (el >= VIDEO_SKIP_AT && skipBtn.hidden) skipBtn.hidden = false; // skip unlocks at 5s (polite!)
      for (const [mark, ev] of [[7.5, 'q25'], [15, 'q50'], [22.5, 'q75']]) { // quartile marks (7.5/15/22.5s of 30!)
        if (el >= mark && !quartiles[ev]) { quartiles[ev] = true; log(ev); }
      }
    }, 250);
    const watchdog = setTimeout(() => { log('complete'); finish('completed'); }, VIDEO_LEN * 1000 + 1500); // 30s + grace (hung players can't trap users!)
    skipBtn.onclick = () => { log('skip'); finish('skipped'); }; // skip = logged + out (no upsell on skips — politeness!)
    // ── the playable: own mp4 OR network tag in our frame ──
    let tagScript = null;
    let emptyCheck = null; // 5s blank-frame watchdog (network path only!)
    if (pick === 'sponsor') { // own mp4: full gated player (countdown meters it, completion invoices it!)
      const video = document.createElement('video');
      video.src = v.sponsorVideo; video.muted = true; video.playsInline = true; video.preload = 'auto'; // muted autoplay (browser POLICY — sound needs a tap!); playsInline (no iOS takeover!)
      video.setAttribute('disablepictureinpicture', ''); // keep it in the card (no floating escape hatch!)
      video.style.cssText = 'width:100%;border-radius:12px;background:#000;max-height:300px;display:block;margin-top:8px;';
      body.appendChild(video);
      video.addEventListener('ended', () => { log('complete'); finish('completed'); }); // natural end (< 30s clips complete early — fair!)
      video.play().catch(() => {}); // autoplay blocked (rare, muted usually passes) → countdown still completes fairly
      visitBtn.hidden = false; // sponsor gets the billable button (tap = money!)
      visitBtn.onclick = async () => { // VISIT = the money event (logged BEFORE leaving, like sponsor clicks!)
        log('click');
        try { await api('/api/me/ads/click', { method: 'POST', body: JSON.stringify({ slot: 'video-' + slot, target_url: v.sponsorLink }) }); } catch {} // click ALSO lands in ad_clicks (sponsor invoices read both tables!)
        window.open(v.sponsorLink, '_blank', 'noopener');
        toast('Pro removes all ads — see Billing'); // gentle upgrade pill (toast auto-dismisses, never blocks — the polite upsell!)
        finish('visited');
      };
    } else { // network zone (HilltopAds / Monetag self-rendering .js tag): renders INSIDE our frame…
      const holder = document.createElement('div');
      holder.style.cssText = 'margin-top:8px;min-height:120px;';
      holder.innerHTML = '<p class="hint" data-vgate-ph>Loading video…</p>'; // placeholder (slow networks show intent, not blank!)
      body.appendChild(holder);
      tagScript = document.createElement('script');
      tagScript.async = true;
      tagScript.dataset.vgate = pick; // data-vgate = our marker (cleanup finds it!)
      tagScript.src = pick === 'hilltopads' ? v.hilltopads : v.monetag;
      tagScript.onerror = () => finish('layer-empty'); // dead tag → NEXT layer (never a dead timer!)
      document.head.appendChild(tagScript); // mount → their unit renders (their player, THEIR close buttons ignored — OUR countdown rules!)
      emptyCheck = setTimeout(() => { // 5s empty-frame guard: tag loaded but painted NOTHING? (the /drm/… lesson!)
        const painted = holder.querySelector('video,iframe,canvas,object,embed') // real players…
          || Array.from(holder.querySelectorAll('*')).some((el) => !el.hasAttribute('data-vgate-ph') && el.getBoundingClientRect().height > 4); // …or any visible tag output (placeholder excluded!)
        if (!painted) finish('layer-empty'); // blank → NEXT layer (a broken tag never embarrasses us!)
      }, 5000);
    }
    log('start'); // funnel opens (completions ÷ starts = the number sponsors pay for!)
    document.body.appendChild(ov); // mount (outside React, like toasts/pops!)
  });
  } // end playVideoLayer (nested — hoisted, one layer attempt per call!)
}

// Per-CLICK: sponsored interstitial, max once/day, clearly labeled, one-tap close.
// Call after high-attention free-tier moments (product add, AI limit hit).
export async function maybeShowSponsor() { // called by Catalog + VeloSalesAI + Dashboard (exported for those)
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
