// ── src/routes/webhookRoutes.js ──────────────────────────────────
// WHAT: the URL map for incoming WhatsApp messages.
// Express Router = a mini-app: we define routes here, server.js mounts the
// whole thing at /webhook. So this file's '/whatsapp' becomes POST /webhook/whatsapp.
// MODULE: express (Router class). Local: webhookController (the logic),
// twilioVerify (the security guard).
const express = require('express'); // need Router from the framework
const webhookController = require('../controllers/webhookController'); // the handler function
const { validateTwilioSignature } = require('../middleware/twilioVerify'); // HMAC guard
const { webhookLimiter } = require('../middleware/security'); // flood wall (forgery stopped by signatures, floods by this!)

const router = express.Router(); // create the mini-app

// One route: Twilio POSTs here on every customer message.
// Chain = limiter → guard → handler (floods die first, forgeries second).
router.post('/whatsapp', webhookLimiter, validateTwilioSignature, webhookController.handleInbound);

module.exports = router; // server.js does app.use('/webhook', webhookRoutes)
