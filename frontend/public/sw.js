// ── retired ad-network worker ──────────────────────────────────────
// Ads are gone: this file used to boot the Monetag service worker. It now
// unregisters itself (and any copy a browser installed earlier) on next
// visit, then stays dormant. Kept (not deleted) so past installs clean up
// instead of lingering when the file 404s.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    self.registration.unregister().then(() => self.clients.claim()).catch(() => {})
  );
});
