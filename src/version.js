// ── src/version.js ───────────────────────────────────────────────
// WHAT: single source of truth for the app version + what's-new notes.
// Bump VERSION + add a note on every user-visible release — the Shell checks
// /api/version on load and toasts "VeloSales Ai updated" when it changes, and the
// admin broadcast button can push the same notes into every inbox.
const APP_VERSION = '1.13.0';
const WHATS_NEW = [
  'WhatsApp now connects on your PHONE - we fixed the popup that never worked in mobile browsers and installed apps (Meta now opens as a full page, like it should)',
  'Telegram heals itself: if Telegram drops or rejects your webhook, we detect it, repair it and tell you - no more silent dead bots',
  'Telegram owner commands now work inside group chats, and they respect who actually owns the bot',
  'Inbox shows which app each chat came from (WhatsApp or Telegram) and lets you filter by it',
  'Zero ads for everyone - sponsored videos, tags and popups all removed',
];
module.exports = { APP_VERSION, WHATS_NEW };
