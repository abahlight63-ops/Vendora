// ── src/routes/authRoutes.js ─────────────────────────────────────
// WHAT: public login/signup URLs. Mounted at /api/auth by server.js, so
// '/signup' below is really POST /api/auth/signup. No requireAuth here —
// guests MUST reach these (you can't require login to log in!).
const express = require('express'); // Router class from the framework
const authController = require('../controllers/authController'); // the 5 handler functions
const { authLimiter } = require('../middleware/security'); // brute-force wall (every mutating auth route sits behind it!)

const router = express.Router(); // the mini-app

router.post('/signup', authLimiter, authController.signup); // create business + user → OTP emailed (auto-login ONLY in dev!)
router.get('/verify', authController.verify); // email link click (?token=…) — GET because it's a link (OTP FALLBACK path!)
router.post('/verify-otp', authLimiter, authController.verifyOtp); // { email, code } → check 6-digit OTP → session on success
router.post('/otp-resend', authLimiter, authController.otpResend); // { email } → fresh code (burns old, resets tries)
router.post('/otp-link', authLimiter, authController.otpLink); // { email } → "send a LINK instead" fallback (reuses token flow!)
router.post('/resend', authLimiter, authController.resendVerification); // legacy "didn't get the email" button (kept working!)
router.post('/forgot', authLimiter, authController.forgot); // { email } → reset link emailed (always "sent" — enumeration-safe!)
router.post('/forgot-otp', authLimiter, authController.forgotOtp); // { email } → 6-digit reset CODE emailed (option 2 — no link-clicking!)
router.post('/reset', authLimiter, authController.reset); // { token, password } → consume link, set new password
router.post('/reset-otp', authLimiter, authController.resetOtp); // { email, code, password } → consume code, set new password
router.post('/login', authLimiter, authController.login); // email + password → session
router.post('/logout', authController.logout); // destroy session
router.get('/config', authController.authConfig); // public knobs (Google client id) — no auth needed (it's PUBLIC by design!)
router.post('/google', authLimiter, authController.google); // { credential } → session OR { needsSignup } (FREE social login — Google IS the bot check, no checkbox needed!)
router.post('/google-signup', authLimiter, authController.googleSignup); // { credential, name, whatsapp_number… } → full account + session (same: Google credential proves humanity!)
router.get('/check-referral', authLimiter, authController.checkReferral); // ?code= → live reward preview on the signup form (rate-limited like auth!)

// Marketing site "Notify me" form (velosalesai.com.ng). A plain HTML form post,
// so it answers with a redirect to the site's thanks page, not JSON. Saving the
// same email twice is fine (ON CONFLICT DO NOTHING).
// One-click unsubscribe from marketing email (signed link, no login). Account
// emails (codes, receipts, security) still arrive: the law treats them separately.
router.get('/unsubscribe', authLimiter, async (req, res) => {
  const ok = await require('../services/privacyService').unsubscribe(req.query.b, req.query.t).catch(() => false);
  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>VeloSales Ai</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0630;color:#fff;font-family:system-ui,sans-serif;padding:24px"><div style="max-width:420px;text-align:center"><h1 style="font-size:24px">${ok ? 'You are unsubscribed' : 'This link did not work'}</h1><p style="color:#cfc8f5;line-height:1.6">${ok ? 'You will not get tips or reminder emails from VeloSales Ai any more. You will still get sign-in codes, receipts and security notices.' : 'It may be incomplete. Copy the whole link from the email, or write to velosales63@gmail.com and we will remove you.'}</p></div></body>`);
});
router.post('/waitlist', authLimiter, async (req, res) => {
  const site = 'https://velosalesai.com.ng';
  const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
  const bot = String((req.body && req.body['bot-field']) || '');
  const wantsJson = String(req.headers.accept || '').includes('application/json');
  if (bot) return wantsJson ? res.json({ ok: true }) : res.redirect(303, site + '/thanks/');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return wantsJson ? res.status(400).json({ error: 'Enter a valid email.' }) : res.redirect(303, site + '/#getapp');
  try {
    await require('../db').query('INSERT INTO launch_waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
  } catch (e) {
    console.error('waitlist save failed:', e.message);
    return wantsJson ? res.status(500).json({ error: 'Could not save. Try again.' }) : res.redirect(303, site + '/#getapp');
  }
  return wantsJson ? res.json({ ok: true }) : res.redirect(303, site + '/thanks/');
});

module.exports = router; // server.js does app.use('/api/auth', authRoutes)
