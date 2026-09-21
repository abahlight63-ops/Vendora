// ── frontend/public/sw-push.js ───────────────────────────────────
// WHAT: OUR push service worker (phone-bar alerts even with the tab closed).
// NOT the ad tag (public/sw.js belongs to the ad network — never touch it!).
// Vite copies public/* verbatim to dist root, so this serves at /sw-push.js
// (root scope REQUIRED — a nested path could never control all pages!).
// No build step, no imports — plain worker script (keep it dependency-free!).

self.addEventListener('push', (e) => { // encrypted payload arrives (server did RFC 8291 — browser decrypted before us!)
  let d = {};
  try { d = (e.data && e.data.json()) || {}; } catch {} // unparseable → defaults below (never crash the worker!)
  e.waitUntil(
    self.registration.showNotification(d.title || 'VeloSales Ai', {
      body: d.body || '',
      icon: '/logo.png?v=3', // app icon (from dist root — same origin, always cached!)
      badge: '/logo.png?v=3', // monochrome slot (Android uses it on the status bar!)
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
