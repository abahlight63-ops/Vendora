// ── src/version.js ───────────────────────────────────────────────
// WHAT: single source of truth for the app version + what's-new notes.
// Bump VERSION + add a note on every user-visible release — the Shell checks
// /api/version on load and toasts "VeloSales Ai updated" when it changes, and the
// admin broadcast button can push the same notes into every inbox.
const APP_VERSION = '1.14.0';
const WHATS_NEW = [
  'A new coral and indigo look across the app, with a new logo and a 3D opening animation',
  'Catalog redesigned: products Velo cannot quote come first, with a health score at the top',
  'Add Product now asks what fits your business: a phone seller gets storage and condition, a baker gets flavours and order notice',
  'You can now show a sale price, and edit any product from one simple sheet',
  'On the phone: swipe to mark a product sold out, plus pull to refresh with the new logo',
];
module.exports = { APP_VERSION, WHATS_NEW };
