// ── src/routes/billingRoutes.js ──────────────────────────────────
// WHAT: card-payment URLs. Mounted at /api by server.js.
// Only ONE route here — the Paystack webhook lives directly in server.js
// (it needs the raw body + its own signature check, not a session).
const express = require('express'); // Router class
const billingController = require('../controllers/billingController'); // initialize + transfer + webhook
const { requireAuth } = require('../middleware/auth'); // login guard
const { billingLimiter } = require('../middleware/security'); // checkout-session spam wall

const router = express.Router(); // the mini-app

router.post('/billing/initialize', requireAuth, billingLimiter, billingController.initialize); // start Paystack checkout (→ authorization_url)
router.post('/billing/flutterwave/initialize', requireAuth, billingLimiter, billingController.flutterwaveInit); // start Flutterwave checkout (USD/intl → payment link)
router.post('/billing/transfer', requireAuth, billingController.reportTransfer); // RETIRED (410 — kept so old apps get the message, not a 404!)

module.exports = { router, handlePaystackWebhook: billingController.handlePaystackWebhook }; // export both: the router AND the webhook fn (server.js wires the webhook itself)
