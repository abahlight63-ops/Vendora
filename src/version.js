// ── src/version.js ───────────────────────────────────────────────
// WHAT: single source of truth for the app version + what's-new notes.
// Bump VERSION + add a note on every user-visible release — the Shell checks
// /api/version on load and toasts "Vendora updated" when it changes, and the
// admin broadcast button can push the same notes into every inbox.
const APP_VERSION = '1.5.0';
const WHATS_NEW = [
  'Smarter, fuller Vendora AI answers (Gemini Flash Lite default — switch brains anytime, it sticks)',
  'No more scroll jump in Vendora AI — chat stays pinned to the bottom',
  'New notification bell: payment verifications + app updates land here',
  'Verified bank transfers: exact-amount + reference checks before activation',
];

module.exports = { APP_VERSION, WHATS_NEW };
