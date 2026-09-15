// ── frontend/src/lib/phone.js ────────────────────────────────────
// WHAT: the BROWSER twin of src/utils/phone.js — same rules, ES-module syntax
// (export instead of module.exports) so Vite/React can import it.
// WHY DUPLICATED: backend is CommonJS (require), frontend is ESM (import) —
// one file can't serve both without a build step. Keep them in sync manually!
// No npm modules — pure string + regex JavaScript (same lesson as backend).
// Mirrors src/utils/phone.js — type naturally, we store whatsapp:+… format.
export function normalizePhone(raw) { // exported (import { normalizePhone } from '../lib/phone.js')
  if (raw === undefined || raw === null) return null; // nothing → invalid
  let s = String(raw).trim(); // accept numbers too; strip outer spaces
  if (!s) return null; // empty → invalid
  s = s.replace(/^whatsapp:/i, '').trim(); // strip optional prefix (^ = start, i = case-insensitive)
  s = s.replace(/[\s\-().]/g, ''); // delete spaces/dashes/parens/dots (g = global, all occurrences)
  if (!/^\+?\d+$/.test(s)) return null; // only optional + plus digits may remain (.test returns true/false)
  let digits = s.startsWith('+') ? s.slice(1) : s; // drop + for uniform handling (ternary: condition ? ifTrue : ifFalse)
  if (s.startsWith('0') && digits.length === 11) {
    digits = '234' + digits.slice(1); // 0803… → 234803… (Nigerian local, slice(1) drops the 0)
  } else if (!s.startsWith('+') && !s.startsWith('0') && digits.length === 10 && /^[789]/.test(digits)) {
    digits = '234' + digits; // bare 10-digit NG mobile (starts 7/8/9) → add 234
  } // international numbers (+1…, +44…) skip both branches untouched — already correct!
  if (digits.length < 7 || digits.length > 15) return null; // E.164 length sanity (too short/long = typo)
  return 'whatsapp:+' + digits; // rebuild exact whatsapp:+… format (Meta + inbox identity!)
}

export function prettyPhone(wa) { // 'whatsapp:+2348031234567' → '0803 123 4567' (human display)
  const d = String(wa || '').replace(/^whatsapp:/, ''); // wa || '' guards null; strip prefix
  if (/^\+234\d{10}$/.test(d)) return `0${d.slice(4, 7)} ${d.slice(7, 10)} ${d.slice(10)}`; // Nigerian: +234XXXXXXXXXX → 0XXX XXX XXXX (slice cuts substrings by index)
  return d || '—'; // non-Nigerian: show raw digits; empty → em-dash
}
