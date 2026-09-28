// ── frontend/src/lib/ads.js ──────────────────────────────────────
// WHAT: ALL ad logic lives here (single source of truth — no page implements
// ads itself). Two income streams, both FREE TIER ONLY (backend sends tags to
// non-Pro; Pro gets null → every function below silently no-ops for Pro):
//   per-VIEW: the Monetag MultiTag injected once per session (earnings in
//     their dashboard).
//   per-CLICK: in-house "Sponsored" interstitial, max once/day, clicks logged
//     to /api/me/ads/click for per-click sponsor billing (/api/ads/stats).
//   per-COMPLETE: gated 30s VIDEO on Connect (free tier): own sponsor mp4 >
//     HilltopAds VAST > Monetag rewarded (VAST doc or .js — both play inline).
//     Completions are the invoice unit (5-20x banner CPMs!) — logged to
//     /api/me/ads/video.
// No npm modules — fetch (api.js) + DOM + localStorage only.
import { api, toast } from './api.js'; // shared fetch helper (session cookie included) + toast (gentle upgrade pill!)

let cached = null; // module-level cache: ONE /api/me per page-load window (null = not fetched yet; note: null also means "logged out" after a failed fetch)
let seeded = false; // true once App.jsx seeds the cache from its own /api/me (avoids a duplicate fetch + race)
let cachedAt = 0; // timestamp of last fetch (stale tier/tags must EXPIRE — env changes + redeploys otherwise stay invisible until re-login: the classic "I pasted the key, still nothing"!)
const ADS_TTL_MS = 10 * 60 * 1000; // 10-minute cache (fresh enough for tier flips, cheap enough per page — /api/me is one indexed read!)

// Seed the cache from App.jsx's /api/me response (same shape: data.ads).
// Call on login-load; call resetAdsCache() on logout so the next user refetches.
export function setAdsCache(ads) { cached = ads || null; seeded = true; cachedAt = Date.now(); }
export function resetAdsCache() { cached = null; seeded = false; cachedAt = 0; }
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
  if ((cached !== null || seeded) && Date.now() - cachedAt < ADS_TTL_MS) return cached; // fresh cache → no HTTP call (fast + fewer logs)
  try {
    const { ok, data } = await api('/api/me', { timeout: 8000 }); // getMe response carries .ads alongside .business (8s cap — ads refresh must never hang)
    cached = ok ? data.ads || null : null; // ok? use it (|| null if backend sent nothing) : logged-out → null
  } catch { cached = null; } // network error → treat as "no ads" (ads must NEVER break the app)
  cachedAt = Date.now(); // stamp EVERY fetch (even failures — don't hammer a struggling server!)
  return cached;
}

// Sync peek at the cache (NO network — the gate uses this first so capped /
// Pro / empty users exit in <1ms without waiting for /api/me on slow networks!).
function peekAds() { return (cached !== null || seeded) ? cached : undefined; }

// Fast fetch with a SHORT timeout for gate decisions (slow /api/me must SKIP
// the gate, never delay the page!). Resolves null on timeout/error.
async function getAdsFast(ms = 3000) {
  const peek = peekAds();
  if (peek !== undefined) {
    if (Date.now() - cachedAt < ADS_TTL_MS) return peek; // fresh → use it now
    getAds().catch(() => {}); // stale → use stale now, refresh in background (next gate sees fresh tags!)
    return peek;
  }
  try {
    const out = await Promise.race([
      getAds(),
      new Promise((res) => setTimeout(() => res('__timeout'), ms)),
    ]);
    if (out === '__timeout') return null; // slow server → skip gate (page works exactly as today!)
    return out;
  } catch { return null; }
}

// Preconnect helper (DNS + TLS warm-up BEFORE the heavy file — shaves
// 300-1500ms off first ad load on mobile networks, zero cost when unused!).
function preconnect(origin) {
  try {
    if (!origin || typeof document === 'undefined') return;
    const u = new URL(origin, window.location.href);
    if (document.querySelector(`link[data-pc="${u.host}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'preconnect'; l.href = u.origin; l.crossOrigin = 'anonymous';
    l.dataset.pc = u.host;
    document.head.appendChild(l);
  } catch {}
}

// Warm the video layer on IDLE after login (free tier only): sponsor mp4
// preload + IMA SDK fetch happen BEFORE any gate fires, so the first gate
// opens instantly with pixels already in cache. Never blocks the app.
let _warmed = false;
export function preloadVideoAssets() {
  if (_warmed) return; _warmed = true;
  const idle = (fn) => {
    try {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 4000 });
      else setTimeout(fn, 2500);
    } catch { setTimeout(fn, 2500); }
  };
  idle(async () => {
    try {
      const ads = peekAds() !== undefined ? peekAds() : await getAdsFast(4000);
      const v = ads && ads.video;
      if (!v) return;
      if (v.sponsorVideo) { // mp4: <link preload> warms the HTTP cache (playback later is instant!)
        try {
          preconnect(v.sponsorVideo);
          if (!document.querySelector('link[data-preload="sponsor-video"]')) {
            const l = document.createElement('link');
            l.rel = 'preload'; l.as = 'video'; l.href = v.sponsorVideo;
            l.dataset.preload = 'sponsor-video';
            document.head.appendChild(l);
          }
        } catch {}
      }
      const vast = v.hilltopads && !isScriptTag(v.hilltopads) ? v.hilltopads : (v.monetag && !isScriptTag(v.monetag) ? v.monetag : null);
      if (vast) { try { preconnect(vast); } catch {} } // VAST doc host warm (XML fetch later skips DNS/TLS!)
      if (v.hilltopads || v.monetag) loadImaSdk().catch(() => {}); // IMA SDK in background (gate later resolves instantly!)
    } catch {}
  });
}

// Per-VIEW: inject each network tag once per session (15s stuck-tag guard — slow phone networks need room).
// freq 'daily' (popunder) is capped to one injection per browser per day via
// localStorage — aggressive formats must never overshow. 'session' tags rely
// on once-per-login injection + the network's own impression throttling.
function dayKey(provider) { // daily-cap storage key, e.g. 'adfreq:monetag:2026-09-16'
  return `adfreq:${provider}:` + new Date().toISOString().slice(0, 10); // UTC date (same convention as the sponsor cap)
}
function injectTag(provider, url, freq) { // NOT exported: internal helper (only loadNetworkAds uses it)
  if (!url || document.querySelector(`script[data-adnet="${provider}"]`)) return; // no URL, or tag already present → skip (idempotent = safe to call repeatedly)
  if (freq === 'daily' || /popunder/i.test(provider || '')) return; // popunder-style tags HIJACK the next click (whole tab → offer URL). Banned from auto-inject — offers open ONLY behind explicit "Visit sponsor" taps (new tab!).
  try { preconnect(url); } catch {} // DNS/TLS warm first (shaves ~0.3-1.5s on mobile networks!)
  const s = document.createElement('script'); // create <script> element programmatically…
  s.async = true; // async = never blocks page rendering (ads must never slow the app)
  try { s.fetchPriority = 'low'; } catch {} // ad tags yield to app API calls + page chunks (user content ALWAYS wins bandwidth!)
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
  const run = async () => {
    const ads = peekAds() !== undefined ? peekAds() : await getAdsFast(4000); // cache-first (never stall login on slow /api/me!)
    if (!ads) { preloadVideoAssets(); return; } // nothing to load → still warm video layer, then done (Pro sees zero ads, zero requests)
    const nets = Array.isArray(ads.networks) && ads.networks.length // prefer the networks ARRAY (multi-network)…
      ? ads.networks
      : (ads.scriptUrl ? [{ provider: ads.provider, scriptUrl: ads.scriptUrl, freq: 'session' }] : []); // …fall back to legacy single-tag shape (backward-compat with older backend)
    nets.forEach((n) => injectTag(n.provider || 'custom', n.scriptUrl, n.freq || 'session')); // forEach (not await): tags load INDEPENDENTLY, in parallel
    preloadVideoAssets(); // warm mp4 + IMA on idle (first gate opens instantly!)
  };
  try { // DEFER to idle: page data (products/chats) wins the first seconds — ads load after, never competing!
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(() => run().catch(() => {}), { timeout: 3000 });
    else setTimeout(() => run().catch(() => {}), 2000);
  } catch { run().catch(() => {}); }
}

const VIDEO_LEN = 30; // the gate: 30 FULL seconds of attention (sponsor invoice unit!)
const VIDEO_SKIP_AT = 25; // reference: skip unlocks 5s before window end (per-window rule lives in skipAt = LEN - 5!)
const VIDEO_PER_DAY = 10; // per section per day (connect × catalog × chats × insights… — volume is the revenue!)
const VIDEO_GAP_MIN = 5; // minutes between two gates on the SAME section (never back-to-back nagging!)

function videoCapKey(slot) { // per-section daily tally (UTC date!)
  return `advideo:${slot}:` + new Date().toISOString().slice(0, 10);
}
function videoTally(slot) { // { count, last } — tolerant reader (old '1' flags + corrupt JSON → fresh tally, never crash!)
  try {
    const raw = localStorage.getItem(videoCapKey(slot));
    if (!raw) return { count: 0, last: 0 };
    const p = JSON.parse(raw);
    if (p && typeof p.count === 'number' && typeof p.last === 'number') return p;
    return { count: Number(raw) || 0, last: 0 }; // legacy '1' flag → counts as shown, gap timer fresh
  } catch { return { count: 0, last: 0 }; } // storage broken → treat as fresh here (caller fail-closes below on write errors!)
}
function videoSeen(slot) {
  try {
    const { count, last } = videoTally(slot);
    if (count >= VIDEO_PER_DAY) return true; // today's 10 for this section are done
    if (last && Date.now() - last < VIDEO_GAP_MIN * 60 * 1000) return true; // cooling down (5-min breather!)
    return false;
  } catch { return true; } // storage broken → pretend seen (fewer ads, never errors!)
}
function markVideoSeen(slot) {
  try {
    const { count } = videoTally(slot);
    localStorage.setItem(videoCapKey(slot), JSON.stringify({ count: count + 1, last: Date.now() }));
  } catch {} // mark FIRST (even instant closes consume one of the 10 — no nagging!)
}
export function clearVideoSeen(slot) { try { localStorage.removeItem(videoCapKey(slot || 'connect')); } catch {} } // Admin preview bypass!

async function logVideo(slot, source, event) { // funnel event → backend (fire-and-forget: logging never blocks the gate!)
  try { await api('/api/me/ads/video', { method: 'POST', body: JSON.stringify({ slot, source, event }) }); } catch {} // network down → drop it (funnel gaps beat frozen gates!)
}

// A tag URL is a PLAYABLE script only if it looks like one (.js tag).
// Anything else on an inline-capable layer is treated as a VAST document for
// the IMA player (never executed, never navigated!). NEVER break!
function isScriptTag(url) {
  return /\.js(\?|#|$)/i.test(String(url || '')); // plain https URLs → VAST path; .js → script-inject path!
}

// Google IMA SDK (plays VAST documents like Hilltop's). Loaded ONCE per
// session, ONLY when a VAST gate actually fires — never a global tag, so
// pages carry zero third-party JS. Failure → reject (caller degrades!).
let _imaPromise = null;
function loadImaSdk() {
  if (typeof document === 'undefined') return Promise.reject(new Error('no-dom'));
  if (window.google && window.google.ima) return Promise.resolve();
  if (_imaPromise) return _imaPromise;
  _imaPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.async = true;
    s.dataset.ima = 'sdk'; // marker (never re-inject!)
    s.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
    const kill = setTimeout(() => { s.remove(); _imaPromise = null; reject(new Error('ima-timeout')); }, 6000); // 6s (preloaded on idle — usually instant; slow SDK fails over fast to next layer!)
    s.onload = () => { clearTimeout(kill); (window.google && window.google.ima) ? resolve() : (_imaPromise = null, reject(new Error('ima-bad'))); };
    s.onerror = () => { clearTimeout(kill); s.remove(); _imaPromise = null; reject(new Error('ima-fail')); };
    document.head.appendChild(s);
  });
  return _imaPromise;
}
// GATED 30s VIDEO (page entries, free tier only): sponsor mp4 >
// HilltopAds VAST (via IMA) > Monetag rewarded (VAST doc or .js — both inline).
// Layers CHAIN until 30s are actually watched (a 6s bumper + a 24s film = one
// full gate — short creatives never end the show early, every view invoices!).
// Countdown + progress bar, skip unlocks 5s before each window ends. Resolves
// when the flow ends — callers ALWAYS proceed afterwards (the gate delays,
// never blocks!). force = Admin preview (bypasses the daily cap, never marks
// it!). only = Admin per-layer test ('sponsor' | 'hilltopads' | 'monetag').
export async function maybeShowVideoAd({ slot = 'connect', force = false, only = null } = {}) {
  const done = (o) => { // EVERY exit records its reason (open devtools console → window.__lastVideoGate tells you WHY nothing showed!)
    try { window.__lastVideoGate = { slot, outcome: o, at: new Date().toISOString() }; } catch {}
    try { if (typeof console !== 'undefined' && console.debug) console.debug('[ads] video gate:', slot, '→', o); } catch {}
    return o;
  };
  try { if (typeof document !== 'undefined' && document.querySelector('.pop-card.vgate')) return done('already-open'); } catch {} // double-tap guard FIRST (zero network — second click sails straight through!)
  if (!force) { try { if (videoSeen(slot)) return done('skipped-cap'); } catch {} } // capped? exit in <1ms — NO /api/me on slow networks (the #1 "ads feel slow" cause: every page waited on HTTP before deciding "no ad"!)
  const ads = await getAdsFast(3000); // cache-first + 3s cap (slow server → skip gate, page works exactly as today — never a delayed blank wait!)
  const v = ads && ads.video;
  if (!v) return done('skipped-empty'); // Pro, logged-out, or backend without video config
  const order = only ? [only] : (Array.isArray(v.order) && v.order.length ? v.order : ['sponsor', 'hilltopads', 'monetag']);
  const has = { // what's actually playable right now? (sponsor mp4 needs video+link; network layers need their zone URL!)
    sponsor: !!(v.sponsorVideo && v.sponsorLink),
    hilltopads: !!v.hilltopads,
    monetag: !!v.monetag,
  };
  const candidates = order.filter((s) => has[s]); // available layers, waterfall order (sponsor mp4 wins ties!)
  if (!candidates.length) return done('skipped-empty'); // nothing configured → button works exactly as today (never a dead end!)
  if (!force) markVideoSeen(slot);
  let filled = 0; // seconds actually WATCHED this gate (short films chain until 30!)
  for (const pick of candidates) { // try each layer in turn (dead layer → next, never a dead timer! Every layer plays INLINE: sponsor mp4, or VAST doc / .js tag via the gated player below!)
    const remaining = VIDEO_LEN - filled;
    if (remaining < 5 && filled > 0) break; // crumbs left — call it filled (no silly 2s windows!)
    const r = await playVideoLayer({ slot, pick, v, len: remaining }); // window = what's left of the 30s (first layer gets the full 30!)
    filled += r.viewed || 0;
    if (r.outcome === 'visited') return done('visited'); // user left for the offer — respect it, stop the chain!
    if (r.outcome === 'completed') {
      if (filled >= VIDEO_LEN - 1) return done('completed'); // 30s watched — invoice it!
      continue; // short creative — NEXT layer tops up the 30s (more impressions = more income!)
    }
    if (r.outcome !== 'layer-empty') return done(r.outcome); // skipped → respect it, stop the chain!
    logVideo(slot, pick, 'tag-failed');
  }
  return done(filled > 0 ? 'completed' : (candidates.length ? 'failed-all' : 'skipped-empty')); // watched something → completed; dead layers → failed-all; nothing configured → skipped-empty!

  // ── one gated player attempt (overlay lifetime = this promise!) ──
  // len = this window's seconds (first layer: full 30; chained layers: what's left!).
  // Resolves { outcome, viewed } — viewed feeds the 30s chain above!
  function playVideoLayer({ slot, pick, v, len }) { return new Promise((resolve) => { // overlay lifetime = this promise (close paths ALL resolve it!)
    const LEN = Math.max(5, Math.min(VIDEO_LEN, Number(len) || VIDEO_LEN)); // window clamp (silly crumbs rejected!)
    let t0 = Date.now(); // gate clock (drives countdown + progress + completion — RESET on first playback by markStarted!)
    let done = false; // settled once (timers + events race — first wins!)
    let viewed = 0; // seconds actually watched in THIS window (feeds the chain!)
    let quartiles = {}; // q25/q50/q75 logged once each (completion RATE = attention quality!)
    const finish = (outcome) => { // single exit (clear timers, remove overlay, resolve caller!)
      if (done) return; done = true;
      clearInterval(tick); clearTimeout(watchdog); clearTimeout(emptyCheck);
      try { tagScript && tagScript.remove(); } catch {} // network tag yanked (no orphan players phoning home!)
      try { extraCleanup && extraCleanup(); } catch {} // IMA manager destroy (same hygiene!)
      ov.classList.add('out'); setTimeout(() => ov.remove(), 250); // fade, then gone
      resolve({ outcome, viewed });
    };
    const log = (event) => logVideo(slot, pick, event); // source pinned (closure!)
    let started = false; // playback REALLY started? (countdown stays FROZEN at 30 until first pixels move — loading time never steals viewing time!)
    const markStarted = () => { if (!started) { started = true; t0 = Date.now(); } }; // clock reset (idempotent — first signal wins!)
    // ── overlay skeleton (DOM-built + textContent = XSS-safe!) ──
    const ov = document.createElement('div');
    ov.className = 'pop-overlay vgate-ov'; // vgate-ov = FULLSCREEN theatre on every screen (brand-safe framing around any creative!)
    ov.innerHTML =
      '<div class="pop-card sponsor vgate">' +
      '<span class="sponsor-tag">Sponsored · video</span>' +
      '<h3></h3>' +
      '<div class="vgate-bar"><i></i></div>' +
      '<div class="vgate-meta"><span class="vgate-count">' + LEN + '</span><button class="vgate-skip" hidden>Skip →</button></div>' +
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
    // ── countdown + progress (one 250ms ticker drives everything — FROZEN until markStarted fires!) ──
    const skipAt = Math.max(0, LEN - 5); // skip unlocks 5s before THIS window ends (full 30 → 25s, chained windows scale!)
    const tick = setInterval(() => {
      const el = Math.min(LEN, (Date.now() - t0) / 1000); // elapsed VIEWING time, capped at window (loading doesn't count!)
      viewed = el; // feed the chain (finish() snapshots this!)
      bar.style.width = (el / LEN * 100) + '%';
      count.textContent = String(Math.max(0, Math.ceil(LEN - el)));
      if (el >= skipAt && skipBtn.hidden) skipBtn.hidden = false; // skip unlocks (5s left in window!)
      for (const [mark, ev] of [[LEN * 0.25, 'q25'], [LEN * 0.5, 'q50'], [LEN * 0.75, 'q75']]) { // quartile marks scale with the window!
        if (el >= mark && !quartiles[ev]) { quartiles[ev] = true; log(ev); }
      }
      if (el >= LEN) { log('complete'); finish('completed'); } // window fully WATCHED → invoice it (no early exits on slow loads!)
    }, 250);
    const watchdog = setTimeout(() => { log('complete'); finish('completed'); }, 90000); // absolute backstop (frozen clock + slow loads: nothing traps, ever!)
    skipBtn.onclick = () => { log('skip'); finish('skipped'); }; // skip = logged + out (no upsell on skips — politeness!)
    // ── mount FIRST (instant feedback — user never stares at the page wondering!) ──
    log('start'); // funnel opens (completions ÷ starts = the number sponsors pay for!)
    document.body.appendChild(ov); // mount BEFORE heavy loads (spinner shows while mp4/VAST/tag streams in!)
    // ── the playable: own mp4, Hilltop VAST doc, OR network tag in our frame ──
    let tagScript = null;
    let emptyCheck = null; // blank-frame watchdog (network path only!)
    let extraCleanup = null; // VAST path stashes its teardown here (manager destroy + load timer!)
    if (pick === 'sponsor') { // own mp4: full gated player (countdown meters it, completion invoices it!)
      const video = document.createElement('video');
      try { preconnect(v.sponsorVideo); } catch {} // warm once more (preload link may already have it!)
      video.src = v.sponsorVideo; video.muted = true; video.playsInline = true; video.preload = 'auto'; // muted autoplay (browser POLICY — sound needs a tap!); playsInline (no iOS takeover!)
      video.setAttribute('disablepictureinpicture', ''); // keep it in the card (no floating escape hatch!)
      try { video.poster = ''; } catch {}
      video.className = 'vgate-reel'; // 9:16 fullscreen reel frame (styled border + glow live in CSS!)
      video.style.cssText = 'background:#000;display:block;margin-top:8px;';
      const loadHint = document.createElement('p'); // instant loading state (replaced by pixels — never a black mystery box!)
      loadHint.className = 'hint'; loadHint.style.marginTop = '6px'; loadHint.textContent = 'Loading video…';
      body.appendChild(video); body.appendChild(loadHint);
      const hideHint = () => { try { loadHint.remove(); } catch {} };
      video.addEventListener('canplay', hideHint, { once: true }); // decodable frames → hint out (fast!)
      video.addEventListener('ended', () => { log('complete'); finish('completed'); }); // natural end (< 30s clips complete early — fair!)
      video.addEventListener('playing', () => { hideHint(); markStarted(); }, { once: true }); // first pixels move → clock starts (loading/buffering never billed as viewing!)
      video.addEventListener('error', () => finish('layer-empty'), { once: true }); // dead mp4 → NEXT layer fast (never a 30s black box!)
      try { video.load(); } catch {}
      video.play().catch(() => {}); // autoplay blocked (rare, muted usually passes) → watchdog still frees the user fairly
      visitBtn.hidden = false; // sponsor gets the billable button (tap = money!)
      visitBtn.onclick = async () => { // VISIT = the money event (logged BEFORE leaving, like sponsor clicks!)
        log('click');
        try { await api('/api/me/ads/click', { method: 'POST', body: JSON.stringify({ slot: 'video-' + slot, target_url: v.sponsorLink }) }); } catch {} // click ALSO lands in ad_clicks (sponsor invoices read both tables!)
        window.open(v.sponsorLink, '_blank', 'noopener');
        toast('Pro removes all ads — see Billing'); // gentle upgrade pill (toast auto-dismisses, never blocks — the polite upsell!)
        finish('visited');
      };
    } else if ((pick === 'hilltopads' || pick === 'monetag') && !isScriptTag(pick === 'hilltopads' ? v.hilltopads : v.monetag)) { // VAST *document* (XML, not a .js tag — ANY network: Hilltop, Monetag, ExoClick…): played via Google IMA inside our frame (muted inline — same house rules as the mp4 path!)
      visitBtn.hidden = true; // network layers: NO Visit button (tapping the video opens the offer — one CTA per layer, never two!)
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto'; // muted inline (browser autoplay policy + no iOS takeover!)
      video.setAttribute('disablepictureinpicture', ''); // keep it in the card!
      video.className = 'vgate-reel'; // same 9:16 reel frame (tap = offer open!)
      video.style.cssText = 'background:#000;display:block;margin-top:8px;cursor:pointer;';
      body.appendChild(video);
      const tapHint = document.createElement('p'); // click affordance (tapping the video opens the advertiser — IMA handles the landing page natively!)
      tapHint.className = 'hint'; tapHint.style.marginTop = '6px'; tapHint.textContent = 'Interested? Tap the video to open the offer.';
      body.appendChild(tapHint);
      let mgr = null; // IMA ads manager (destroyed on every exit — no orphan audio ever!)
      try { preconnect(pick === 'hilltopads' ? v.hilltopads : v.monetag); } catch {} // VAST host warm (usually already preconnected on idle!)
      let loadTimer = setTimeout(() => finish('layer-empty'), 7000); // VAST dead/hanging? → NEXT layer fast (7s — SDK preloaded, so working zones answer in 1-3s!)
      extraCleanup = () => { clearTimeout(loadTimer); try { mgr && mgr.destroy(); } catch {} };
      loadImaSdk().then(() => {
        if (done) return; // user already skipped (race lost — destroy nothing, exit took over!)
        try {
          const adDisplay = new window.google.ima.AdDisplayContainer(body, video);
          const adsLoader = new window.google.ima.AdsLoader(adDisplay);
          adsLoader.addEventListener(window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e) => {
            if (done) return;
            try {
              mgr = e.getAdsManager(video);
              let adStarted = false; // no-fill guard: fresh/pending zones serve EMPTY VAST yet IMA still fires ALL_ADS_COMPLETED (an unwatched "complete" would fake revenue + invoice a sponsor for nothing!)
              mgr.addEventListener(window.google.ima.AdEvent.Type.STARTED, () => { adStarted = true; markStarted(); }); // real creative playing → clock starts too!
              mgr.addEventListener(window.google.ima.AdEvent.Type.ALL_ADS_COMPLETED, () => { // finished…
                if (adStarted) { log('complete'); finish('completed'); } // …watched (< 30s = early complete, fair!)…
                else finish('layer-empty'); // …nothing ever played → NEXT layer (empty zone, never a fake complete!)
              });
              mgr.addEventListener(window.google.ima.AdEvent.Type.CLICK, () => { log('click'); }); // tap on the video → IMA opens the offer natively; we log the click for the funnel (never blocks, never closes!)
              mgr.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, () => finish('layer-empty')); // bad creative → NEXT layer (never embarrass us!)
              adDisplay.initialize();
              mgr.init(640, 360, window.google.ima.ViewMode.NORMAL);
              mgr.start();
            } catch { finish('layer-empty'); } // init threw (weird creative) → next layer
          });
          adsLoader.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, () => finish('layer-empty')); // VAST fetch/parse failed → next layer
          const req = new window.google.ima.AdsRequest();
          req.adTagUrl = String(pick === 'hilltopads' ? v.hilltopads : v.monetag); // this layer's VAST doc (picked above — never the wrong network's!)
          req.linearAdSlotWidth = 640; req.linearAdSlotHeight = 360;
          req.setAdWillPlayMuted(true); // muted = autoplay-legal everywhere (sound needs a tap — IMA policy!)
          adsLoader.requestAds(req);
        } catch { finish('layer-empty'); } // IMA API shape changed upstream → next layer, never a crash
      }).catch(() => finish('layer-empty')); // SDK itself unreachable (blocked/offline) → next layer
    } else { // network zone (self-rendering .js tag: Monetag rewarded, or a .js Hilltop tag): renders INSIDE our frame…
      visitBtn.hidden = true; // network layers: NO Visit button (their player carries its own CTA!)
      const holder = document.createElement('div');
      holder.className = 'vgate-reel vgate-holder'; // network tag renders INSIDE the same 9:16 reel frame!
      holder.style.cssText = 'margin-top:8px;min-height:120px;';
      holder.innerHTML = '<p class="hint" data-vgate-ph>Loading video…</p>'; // placeholder (slow networks show intent, not blank!)
      body.appendChild(holder);
      tagScript = document.createElement('script');
      tagScript.async = true;
      try { tagScript.fetchPriority = 'low'; } catch {} // tag yields to video bytes (user sees pixels first!)
      tagScript.dataset.vgate = pick; // data-vgate = our marker (cleanup finds it!)
      tagScript.src = pick === 'hilltopads' ? v.hilltopads : v.monetag;
      try { preconnect(tagScript.src); } catch {}
      const checkPainted = () => {
        try {
          return !!(holder.querySelector('video,iframe,canvas,object,embed') // real players…
            || Array.from(holder.querySelectorAll('*')).some((el) => !el.hasAttribute('data-vgate-ph') && el.getBoundingClientRect().height > 4)); // …or any visible tag output (placeholder excluded!)
        } catch { return false; }
      };
      tagScript.onload = () => { // tag code arrived → give it 1.5s to paint, then start the clock early (no waiting for the 6s guard!)
        setTimeout(() => { if (!done && checkPainted()) markStarted(); }, 1500);
      };
      tagScript.onerror = () => finish('layer-empty'); // dead tag → NEXT layer (never a dead timer!)
      document.head.appendChild(tagScript); // mount → their unit renders (their player, THEIR close buttons ignored — OUR countdown rules!)
      emptyCheck = setTimeout(() => { // 6s painted-or-dead guard: tag loaded but painted NOTHING?
        if (!checkPainted()) finish('layer-empty'); // blank → NEXT layer (a broken tag never embarrasses us!)
        else markStarted(); // painted → clock starts (slow load never steals viewing time!)
      }, 6000); // 6s (working tags paint in 1-3s; dead ones fail over fast instead of holding the user!)
    }
  });
  } // end playVideoLayer (nested — hoisted, one layer attempt per call!)
}
// NOTE: the old per-CLICK sponsor interstitial (maybeShowSponsor) was REMOVED —
// the 30s video gate is the ONLY ad surface now (Visit-sponsor clicks live
// INSIDE the gate). Backend click logging (/api/me/ads/click) stays: the gate
// calls it. No card popups anywhere, by owner order!
