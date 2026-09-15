// ── src/version.js ───────────────────────────────────────────────
// WHAT: single source of truth for the app version + what's-new notes.
// Bump VERSION + add a note on every user-visible release — the Shell checks
// /api/version on load and toasts "Vendora updated" when it changes, and the
// admin broadcast button can push the same notes into every inbox.
const APP_VERSION = '1.6.0';
const WHATS_NEW = [
  'New tiers: Pro ₦7,499/mo + Pro Plus ₦14,999/mo (voice notes + heavy work models), yearly saves up to 33%',
  'New setup: pick your hustle after signup — Vendora AI suggestions now fit YOUR business',
  'Human salesperson brain: every answer now comes with up to 5 options to choose from',
  'Product photos: Pro shops send catalog pictures inside WhatsApp + Telegram replies',
];

module.exports = { APP_VERSION, WHATS_NEW };
