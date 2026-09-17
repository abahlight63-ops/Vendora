// ── src/services/captcha.js ────────────────────────────────────────
// WHAT: Google reCAPTCHA v2 ("I'm not a robot") verification for public auth
// doors (signup, login, OTP, password reset). Bots burn IPs rotating through
// free-trial signups; a checkbox stops the cheap ones, rate limits stop the
// patient ones — layered, like everything security here.
// ENV: RECAPTCHA_SECRET_KEY (server, NEVER in the browser!) +
//   VITE_RECAPTCHA_SITE_KEY (Vercel frontend dashboard — public by design).
// Register BOTH hosts at google.com/recaptcha/admin (v2 checkbox): your
// Render backend URL + Vercel frontend URL (no custom domain needed!).
// UNSET SECRET = check skipped (old behavior — set it in production!).
// No npm modules — global fetch only.
let warned = false; // warn-once flag (logs don't need spam!)

function isCaptchaConfigured() {
  return !!(process.env.RECAPTCHA_SECRET_KEY || '').trim();
}

/** Verify a client token with Google. Returns true = human (or check off). */
async function verifyRecaptcha(token, ip) {
  if (!isCaptchaConfigured()) { // not set → old behavior (documented in .env.example!)
    if (!warned) { warned = true; console.warn('reCAPTCHA not configured — auth doors open without bot check (set RECAPTCHA_SECRET_KEY!).'); }
    return true;
  }
  if (!token || typeof token !== 'string') return false; // no token = bot or broken widget (fail closed when configured!)
  try {
    const ctrl = new AbortController(); // Google hanging must never hang signup!
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY.trim(),
        response: token,
        ...(ip ? { remoteip: ip } : {}), // bind the verdict to the claimant's IP (token theft across IPs dies!)
      }).toString(),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) return false; // Google 5xx → fail closed (bots love outage windows!)
    const data = await res.json();
    return data.success === true; // hostname check optional (keys are host-bound at registration already!)
  } catch (e) {
    console.error('reCAPTCHA verify error:', e.message);
    return false; // network/timeout → fail closed (same rule as above!)
  }
}

/**
 * Express middleware factory: require a fresh captcha token in req.body.
 * Runs BEFORE the controller (bots never reach user lookups = no
 * enumeration, no OTP emails burned, no sessions minted).
 * PHONE APP: native apps can't render the checkbox — they send header
 * X-Mobile-Key matching env MOBILE_APP_KEY instead. Honest note: a binary
 * secret is obfuscation, NOT proof (extractable!) — rate limits + OTP burn
 * still apply, so the wall holds; the checkbox just moves aside for the app.
 * Set MOBILE_APP_KEY on Render AND in the app (dart-define) or the app's
 * auth calls fail closed like any bot!
 * Usage: router.post('/signup', authLimiter, requireCaptcha(), ctrl.signup)
 */
function requireCaptcha() {
  return async function captchaGate(req, res, next) {
    if (!isCaptchaConfigured()) return next(); // off → invisible (dev convenience!)
    const mobileKey = (process.env.MOBILE_APP_KEY || '').trim();
    if (mobileKey && req.get('x-mobile-key') === mobileKey) return next(); // phone app (see note above!)
    const token = req.body && req.body.recaptchaToken; // frontend posts grecaptcha.getResponse() here
    const ok = await verifyRecaptcha(token, req.ip);
    if (!ok) return res.status(400).json({ error: 'Please confirm you are not a robot, then try again.' }); // 400 (their move — checkbox, not ours!)
    if (req.body) delete req.body.recaptchaToken; // scrub: controllers never see it (never logged, never stored!)
    next();
  };
}

module.exports = { isCaptchaConfigured, verifyRecaptcha, requireCaptcha };
