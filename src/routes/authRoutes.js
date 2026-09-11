// ── src/routes/authRoutes.js ─────────────────────────────────────
// WHAT: public login/signup URLs. Mounted at /api/auth by server.js, so
// '/signup' below is really POST /api/auth/signup. No requireAuth here —
// guests MUST reach these (you can't require login to log in!).
const express = require('express'); // Router class from the framework
const authController = require('../controllers/authController'); // the 5 handler functions

const router = express.Router(); // the mini-app

router.post('/signup', authController.signup); // create business + user → OTP emailed (auto-login ONLY in dev!)
router.get('/verify', authController.verify); // email link click (?token=…) — GET because it's a link (OTP FALLBACK path!)
router.post('/verify-otp', authController.verifyOtp); // { email, code } → check 6-digit OTP → session on success
router.post('/otp-resend', authController.otpResend); // { email } → fresh code (burns old, resets tries)
router.post('/otp-link', authController.otpLink); // { email } → "send a LINK instead" fallback (reuses token flow!)
router.post('/resend', authController.resendVerification); // legacy "didn't get the email" button (kept working!)
router.post('/forgot', authController.forgot); // { email } → reset link emailed (always "sent" — enumeration-safe!)
router.post('/reset', authController.reset); // { token, password } → consume link, set new password
router.post('/login', authController.login); // email + password → session
router.post('/logout', authController.logout); // destroy session
router.get('/config', authController.authConfig); // public knobs (Google client id) — no auth needed (it's PUBLIC by design!)
router.post('/google', authController.google); // { credential } → session OR { needsSignup } (FREE social login!)
router.post('/google-signup', authController.googleSignup); // { credential, name, whatsapp_number… } → full account + session

module.exports = router; // server.js does app.use('/api/auth', authRoutes)
