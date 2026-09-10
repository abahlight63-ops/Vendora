// ── src/utils/phone.js ───────────────────────────────────────────
// WHAT: turns messy human-typed phone numbers into strict Twilio format.
// Twilio only accepts `whatsapp:+2348031234567`, but owners type
// `0803 123 4567`, `8031234567`, `+234...`, with spaces/dashes.
// No npm module here — pure JavaScript string + regex work.

/**
 * Phone normalization — users type whatever feels natural, we store Twilio format.
 * Accepts: 08031234567, 8031234567, +2348031234567, 2348031234567,
 *          with spaces/dashes, with or without the "whatsapp:" prefix.
 * Returns "whatsapp:+234..." or null if it can't be salvaged.
 * Defaults to Nigeria (+234) for local-looking numbers.
 */
function normalizePhone(raw) {
  if (raw === undefined || raw === null) return null; // nothing given → invalid
  let s = String(raw).trim(); // accept numbers too: String(0803) → "803"; trim spaces
  if (!s) return null; // empty string → invalid
  s = s.replace(/^whatsapp:/i, '').trim(); // strip optional "whatsapp:" prefix (case-insensitive ^ = start)
  s = s.replace(/[\s\-().]/g, ''); // delete spaces, dashes, parens, dots (g = all of them)
  if (!/^\+?\d+$/.test(s)) return null; // after cleanup only optional + and digits may remain
  let digits = s.startsWith('+') ? s.slice(1) : s; // drop the + for uniform handling
  if (s.startsWith('0') && digits.length === 11) {
    digits = '234' + digits.slice(1); // 0803... -> 234803... (Nigerian local format)
  } else if (!s.startsWith('+') && !s.startsWith('0') && digits.length === 10 && /^[789]/.test(digits)) {
    digits = '234' + digits; // 803... -> 234803... (10-digit Nigerian mobile starting 7/8/9)
  } else if (!s.startsWith('+') && digits.length > 11 && digits.startsWith('234')) {
    // already has country code, missing plus — handled below
  }
  if (digits.length < 7 || digits.length > 15) return null; // E.164 length sanity check
  return 'whatsapp:+' + digits; // rebuild in exact Twilio format
}

module.exports = { normalizePhone }; // used by signup, profile update, LEARN/SYNC checks
