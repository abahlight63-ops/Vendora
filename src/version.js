// ── src/version.js ───────────────────────────────────────────────
// WHAT: single source of truth for the app version + what's-new notes.
// Bump VERSION + add a note on every user-visible release — the Shell checks
// /api/version on load and toasts "Vendora updated" when it changes, and the
// admin broadcast button can push the same notes into every inbox.
const APP_VERSION = '1.8.0';
const WHATS_NEW = [
  'New Connect page: plug in WhatsApp (Meta or your own Twilio number) + Telegram with TEST-to-LIVE verify',
  'You pick the brain: choose which AI answers your WhatsApp customers, right on the Connect page',
  'Smarter answers: WhatsApp replies now use your picked model with fuller, better-checked responses',
  'Billing cleanup: no more payment-brand names — plus a new Enterprise card for chains and big shops',
];

module.exports = { APP_VERSION, WHATS_NEW };
