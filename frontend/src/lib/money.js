// ── frontend/src/lib/money.js ────────────────────────────────────
// WHAT: one money formatter for the whole app: NGN (₦ + thousands) vs USD
// ($ whole dollars). Billing passes the shop's currency; this picks the shape.
// No npm modules — Intl.NumberFormat built into every browser (no currency lib).
// Money formatting: NGN (₦, thousands) vs USD ($, whole dollars).
export function money(n, currency) { // n = amount, currency = 'NGN' | 'USD' (anything else → NGN)
  const v = Number(n || 0); // Number() coerces strings/null → number (null → 0, never NaN display)
  if (currency === 'USD') return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }); // $5, $33 — whole dollars (prices are round)
  return '₦' + v.toLocaleString('en-GB', { maximumFractionDigits: 0 }); // ₦7,500 — thousands separators via locale
} // toLocaleString = Intl formatting (the browser knows every locale's grouping)
