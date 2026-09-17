// ── src/routes/authRoutes.js ─────────────────────────────────────
// WHAT: public login/signup URLs. Mounted at /api/auth by server.js, so
// '/signup' below is really POST /api/auth/signup. No requireAuth here —
// guests MUST reach these (you can't require login to log in!).
const express = require('express'); // Router class from the framework
const authController = require('../controllers/authController'); // the 5 handler functions
const { authLimiter } = require('../middleware/security'); // brute-force wall (every mutating auth route sits behind it!)
const { requireCaptcha } = require('../services/captcha'); // bot wall (grecaptcha token verified BEFORE controllers run!)

const router = express.Router(); // the mini-app

router.post('/signup', authLimiter, requireCaptcha(), authController.signup); // create business + user → OTP emailed (auto-login ONLY in dev!)
router.get('/verify', authController.verify); // email link click (?token=…) — GET because it's a link (OTP FALLBACK path!)
router.post('/verify-otp', authLimiter, requireCaptcha(), authController.verifyOtp); // { email, code } → check 6-digit OTP → session on success
router.post('/otp-resend', authLimiter, requireCaptcha(), authController.otpResend); // { email } → fresh code (burns old, resets tries)
router.post('/otp-link', authLimiter, requireCaptcha(), authController.otpLink); // { email } → "send a LINK instead" fallback (reuses token flow!)
router.post('/resend', authLimiter, requireCaptcha(), authController.resendVerification); // legacy "didn't get the email" button (kept working!)
router.post('/forgot', authLimiter, requireCaptcha(), authController.forgot); // { email } → reset link emailed (always "sent" — enumeration-safe!)
router.post('/reset', authLimiter, authController.reset); // { token, password } → consume link, set new password (link IS the proof — no checkbox on links!)
router.post('/login', authLimiter, requireCaptcha(), authController.login); // email + password → session
router.post('/logout', authController.logout); // destroy session
router.get('/config', authController.authConfig); // public knobs (Google client id + recaptcha site key) — no auth needed (it's PUBLIC by design!)
router.post('/google', authLimiter, authController.google); // { credential } → session OR { needsSignup } (FREE social login — Google IS the bot check, no checkbox needed!)
router.post('/google-signup', authLimiter, authController.googleSignup); // { credential, name, whatsapp_number… } → full account + session (same: Google credential proves humanity!)

module.exports = router; // server.js does app.use('/api/auth', authRoutes)
