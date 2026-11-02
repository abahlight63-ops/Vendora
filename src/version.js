// ── src/version.js ───────────────────────────────────────────────
// WHAT: single source of truth for the app version + what's-new notes.
// Bump VERSION + add a note on every user-visible release — the Shell checks
// /api/version on load and toasts "VeloSales Ai updated" when it changes, and the
// admin broadcast button can push the same notes into every inbox.
const APP_VERSION = '1.15.0';
const WHATS_NEW = [
  'A new welcome: six slides with real sellers showing what Velo does on WhatsApp',
  'See every channel Velo works on, and how WhatsApp connects in one tap',
  'New premium buttons across the app: a long pill with a white arrow circle, and cleaner filters',
  'A new sign-in and sign-up screen in the same premium style',
];
module.exports = { APP_VERSION, WHATS_NEW };
