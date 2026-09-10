// ── src/routes/billingRoutes.js ──────────────────────────────────
// WHAT: card-payment URLs. Mounted at /api by server.js.
// Only ONE route here — the Paystack webhook lives directly in server.js
// (it needs the raw body + its own signature check, not a session).
const express = require('express'); // Router class
const billingController = require('../controllers/billingController'); // initialize + transfer + webhook
const { requireAuth } = require('../middleware/auth'); // login guard

const router = express.Router(); // the mini-app

router.post('/billing/initialize', requireAuth, billingController.initialize); // start Paystack checkout (→ authorization_url)
router.post('/billing/transfer', requireAuth, billingController.reportTransfer); // "I sent the money" button

module.exports = { router, handlePaystackWebhook: billingController.handlePaystackWebhook }; // export both: the router AND the webhook fn (server.js wires the webhook itself)
