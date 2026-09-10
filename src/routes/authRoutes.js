// ── src/routes/authRoutes.js ─────────────────────────────────────
// WHAT: public login/signup URLs. Mounted at /api/auth by server.js, so
// '/signup' below is really POST /api/auth/signup. No requireAuth here —
// guests MUST reach these (you can't require login to log in!).
const express = require('express'); // Router class from the framework
const authController = require('../controllers/authController'); // the 5 handler functions

const router = express.Router(); // the mini-app

router.post('/signup', authController.signup); // create business + user + session
router.get('/verify', authController.verify); // email link click (?token=…) — GET because it's a link
router.post('/resend', authController.resendVerification); // "didn't get the email" button
router.post('/login', authController.login); // email + password → session
router.post('/logout', authController.logout); // destroy session

module.exports = router; // server.js does app.use('/api/auth', authRoutes)
