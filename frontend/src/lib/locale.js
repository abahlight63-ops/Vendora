// ── frontend/src/lib/locale.js ───────────────────────────────────
// WHAT: detects the visitor's country → currency WITHOUT any new packages:
//   1. IP geolocation (ipapi.co, 4s timeout) — most accurate, needs internet.
//   2. Browser timezone (Africa/Lagos → Nigeria).
//   3. Browser language (en-NG → Nigeria).
// Result is CACHED (module var + localStorage) so we never slow the page twice.
// Only two outcomes: 'NGN' (Nigeria) or 'USD' (everywhere else) — prices show
// ONE currency based on location, never "₦100,000/$65" side-by-side.
import { useEffect, useState } from 'react';

let cached = null; // module-level memory (fastest: no storage read after first call)

function fromTimezone() { // Intl API is BUILT INTO every browser (no library!): resolvedOptions().timeZone → e.g. "Africa/Lagos"
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; // e.g. "Africa/Lagos", "America/New_York"
    if (/lagos/i.test(tz)) return 'NGN'; // Nigeria's zone → Naira (covers most NG visitors even on VPNs)
  } catch {} // very old browsers → skip to next signal (empty catch = deliberate fallthrough)
  return null;
}

function fromLanguage() { // navigator.language = browser locale, e.g. "en-NG" (Nigeria) vs "en-US"
  try {
    const lang = (navigator.language || '').toLowerCase(); // lowercase once for safe matching
    if (/(^|-)ng\b/.test(lang) || lang.endsWith('-ng')) return 'NGN'; // en-NG / ig-NG / yo-NG → Naira
  } catch {}
  return null;
}

async function fromIP() { // ipapi.co/country/ returns 2-letter code as PLAIN TEXT ("NG\n") — free, no key, generous limits
  try {
    const ctrl = new AbortController(); // AbortController = cancel a fetch mid-flight…
    const t = setTimeout(() => ctrl.abort(), 4000); // …after 4s (ads/prices must NEVER hang the page on a slow geo lookup!)
    const r = await fetch('https://ipapi.co/country/', { signal: ctrl.signal }); // signal wires the timeout to THIS request
    clearTimeout(t); // arrived in time → cancel the pending abort (else it fires pointlessly later)
    if (!r.ok) return null; // non-200 → ignore (fall through to other signals)
    const code = (await r.text()).trim().toUpperCase(); // "ng" → "NG" (trim kills the trailing newline!)
    if (!code || code.length !== 2) return null; // garbage guard (rate-limit HTML pages etc.)
    return code === 'NG' ? 'NGN' : 'USD'; // Nigeria → Naira, entire rest of world → Dollars
  } catch { return null; } // offline / blocked / timeout → null (silent: other signals decide)
}

export async function detectCurrency() { // MAIN: resolves 'NGN' | 'USD', cached + persisted.
  if (cached) return cached; // memory hit (same page-load) → instant
  try { // localStorage hit (return visits skip ALL detection)…
    const saved = localStorage.getItem('vendora-currency'); // …persisted choice from last visit…
    if (saved === 'NGN' || saved === 'USD') { cached = saved; return saved; } // …whitelist before trusting (never trust raw storage blindly!)
  } catch {}
  const tz = fromTimezone(); // fast local signals FIRST (instant, offline-safe)…
  const lang = fromLanguage();
  const local = tz || lang; // || chain: timezone wins, else language, else null
  const ip = await fromIP(); // …then network signal (slower but most accurate)…
  cached = ip || local || 'USD'; // priority: IP > timezone/language > default USD (new visitors abroad see dollars immediately)
  try { localStorage.setItem('vendora-currency', cached); } catch {} // persist for next visit (guarded: private mode throws)
  return cached;
}

export function useCurrency() { // REACT HOOK for pages: const cur = useCurrency() ('NGN' default until detection lands, then re-renders with truth)
  const [cur, setCur] = useState(() => { // lazy init: check storage SYNCHRONOUSLY first (no flash of wrong currency on return visits!)…
    try { const s = localStorage.getItem('vendora-currency'); if (s === 'NGN' || s === 'USD') return s; } catch {}
    return 'NGN'; // first visit default (Nigeria-first product; corrected below if abroad)
  });
  useEffect(() => { // …then async-detect on mount (IP lookup) and update if different…
    let live = true; // mounted flag (prevents setState after unmount = React warning!)
    detectCurrency().then((c) => { if (live) setCur(c); }); // promise resolves → state update → re-render with correct prices
    return () => { live = false; }; // cleanup flips the flag (in-flight promise resolves harmlessly)
  }, []); // [] = mount-only
  return cur; // 'NGN' | 'USD'
}
