// ── frontend/public/sw-app.js ────────────────────────────────────
// WHAT: OUR app service worker (the install key + phone-bar push in ONE
// worker). Vite copies public/* verbatim to dist root → serves at /sw-app.js
// (root scope: controls every page — REQUIRED for the Chrome install prompt!).
// NOT the ad tag (public/sw.js belongs to the ad network — never touch it!).
// NOT sw-push.js anymore (its push handlers moved HERE — one scope holds ONE
// worker, so the app worker owns push now; old installs auto-update to this
// script on next visit, subscriptions survive the update!).
// RULES: /api/* + /webhook/* + navigations go NETWORK-ONLY (never cache app
// data or the app shell — stale shells strand users on old bugs!). /assets/*
// (Vite-hashed, immutable) cache-first for speed. Full offline mode = later.
// No build step, no imports — plain worker script (keep it dependency-free!).
const VERSION = 'velosalesai-v1'; // bump to force-update every client (new deploys change assets anyway via hashed names!)
const ASSET_CACHE = VERSION + '-assets';

self.addEventListener('install', (e) => { // new worker downloaded (fresh visit after a deploy!)…
  e.waitUntil(self.skipWaiting()); // …activate immediately (no "close all tabs" dance!)
});

self.addEventListener('activate', (e) => { // new worker takes over…
  e.waitUntil(
    (async () => {
      await self.clients.claim(); // …control open tabs NOW (install prompt + push work without a reload!)
      const keys = await caches.keys(); // drop caches from older versions (never hoard stale assets!)
      await Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k)));
    })()
  );
});

self.addEventListener('fetch', (e) => { // EVERY request from controlled pages lands here (this handler's EXISTENCE unlocks Chrome's install prompt!)
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // non-GET + third-party (fonts, IMA, Meta…) → untouched, browser handles directly
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook/')) return; // app DATA → network-only, always fresh (caching API = showing yesterday's inbox!)
  if (url.pathname.startsWith('/assets/')) { // Vite-hashed bundles (immutable: same name = same bytes, forever!)…
    e.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit; // cache-first (instant second loads!)
        const res = await fetch(e.request);
        if (res && res.ok) cache.put(e.request, res.clone()); // populate for next time (clone: one copy serves, one stores!)
        return res;
      })
    );
    return;
  }
  // Navigations, manifest, icons, photos: network passthrough (same as no worker — zero behavior change, full installability!).
}); // NOTE: no respondWith above = browser fetches normally (pass-through still counts as "has a fetch handler" for install!)

// ── Phone-bar push (moved from sw-push.js — same handlers, new home!) ──
self.addEventListener('push', (e) => { // encrypted payload arrives (server did RFC 8291 — browser decrypted before us!)
  let d = {};
  try { d = (e.data && e.data.json()) || {}; } catch {} // unparseable → defaults below (never crash the worker!)
  e.waitUntil(
    self.registration.showNotification(d.title || 'VeloSales Ai', {
      body: d.body || '',
      icon: '/logo.png?v=4', // app icon (from dist root — same origin, always cached!)
      badge: '/logo.png?v=4', // monochrome slot (Android uses it on the status bar!)
      data: { url: d.url || '/dashboard' }, // tap target (click handler below!)
      tag: 'velosalesai-alert', // collapses repeats (10 quota bells = 1 tidy card, not a flood!)
    })
  );
});

self.addEventListener('notificationclick', (e) => { // tap the phone-bar card…
  e.notification.close(); // dismiss it (standard behavior!)
  const url = (e.notification.data && e.notification.data.url) || '/dashboard';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
      const hit = ws.find((w) => { try { return new URL(w.url).origin === self.location.origin; } catch { return false; } });
      if (hit) { hit.navigate(url); return hit.focus(); } // app open somewhere? reuse it (no duplicate tabs!)
      return self.clients.openWindow(url); // else launch fresh (cold start straight to the page!)
    })
  );
});
