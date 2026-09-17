// ── frontend/src/lib/captcha.js ────────────────────────────────────
// WHAT: Google reCAPTCHA v2 checkbox, lazy-loaded like GIS (NEVER a
// render-blocking <script> in index.html — speed!). Backend verifies the
// token on signup/login/OTP/forgot (src/services/captcha.js); this file only
// renders the widget + reads/resets its token.
// FLOW: CaptchaBox mounts → reads window.__RECAPTCHA_KEY__ (Login stashes it
// from /api/auth/config) → injects api.js once → renders checkbox.
// No key (bot check off) → renders nothing, submits send no token.
let scriptP = null; // one script tag ever (module-level singleton!)

export function loadRecaptcha() {
  if (window.grecaptcha) return Promise.resolve(); // already here (re-render after mode switch!)
  if (scriptP) return scriptP; // in flight (two boxes mounting at once share it!)
  scriptP = new Promise((res, rej) => {
    const s = document.createElement('script'); // create <script>…
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit'; // explicit = WE call render() (multiple boxes, no auto-scan surprises!)
    s.async = true; s.defer = true; // async+defer = never blocks our page (same habit as GIS!)
    s.onload = () => res(); // loaded…
    s.onerror = () => { scriptP = null; rej(new Error('captcha')); }; // …blocked (adblock!) → null the promise so a RETRY re-injects!
    document.head.appendChild(s); // inject → browser fetches
  });
  return scriptP;
}

export function captchaRequired() {
  return !!window.__RECAPTCHA_KEY__; // backend decides (config endpoint); no key = check off everywhere
}

export function captchaToken(boxRef) { // the token to POST ('' = unsolved/missing!)
  try {
    const id = boxRef && boxRef.current;
    if (id === null || id === undefined) return '';
    return (window.grecaptcha && window.grecaptcha.getResponse(id)) || '';
  } catch { return ''; } // blocked/expired internals → '' (submit shows the tick-it message!)
}

export function captchaReset(boxRef) { // fresh checkbox after each attempt (tokens are SINGLE-USE server-side!)
  try {
    if (window.grecaptcha && boxRef && boxRef.current !== null && boxRef.current !== undefined) window.grecaptcha.reset(boxRef.current);
  } catch {} // already-consumed widget → ignore (never crash a submit!)
}
