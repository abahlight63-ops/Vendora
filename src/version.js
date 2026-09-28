// ── src/version.js ───────────────────────────────────────────────
// WHAT: single source of truth for the app version + what's-new notes.
// Bump VERSION + add a note on every user-visible release — the Shell checks
// /api/version on load and toasts "VeloSales Ai updated" when it changes, and the
// admin broadcast button can push the same notes into every inbox.
const APP_VERSION = '1.10.0';
const WHATS_NEW = [
  'Fullscreen video ads: 9:16 reels, full 30 seconds, skip at 25s — update for the new player!',
  'Inbox replies: answer customers right inside the app (both channels), gold flag clears itself',
  'Catalog delivery info: delivery time, pickup location and how-to-buy per product — the AI quotes them',
  'Install as app: Help page walks you through home-screen install, full-screen, no app store',
  'Network toughness: every page now retries itself with one tap when the internet drops',
];

module.exports = { APP_VERSION, WHATS_NEW };
