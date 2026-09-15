// ── src/routes/webhookRoutes.js ──────────────────────────────────
// WHAT: the URL map for incoming WhatsApp messages — TWO doors, one URL.
// Classic door: Twilio POSTs form fields (signature-verified).
// Meta door: Meta Cloud API POSTs JSON {object:'whatsapp_business_account'…}
// (verified per-message by phone_number_id → stored business; subscribe-time
// handshake on GET ?hub.mode=subscribe…). Both normalize into
// webhookController.handleInbound (ONE brain!). Meta verify tokens are
// per-shop (Connect page generates one) — the handshake accepts ANY stored
// token, so many shops share this one URL safely.
// MODULE: express (Router class). Local: webhookController (the logic),
// twilioVerify (the classic-door guard), meta (inbound parser).
const express = require('express'); // need Router from the framework
const db = require('../db'); // pool (Meta business lookup + verify-token match)
const webhookController = require('../controllers/webhookController'); // the handler function
const { validateTwilioSignature } = require('../middleware/twilioVerify'); // HMAC guard
const { webhookLimiter } = require('../middleware/security'); // flood wall (forgery stopped by signatures, floods by this!)

const router = express.Router(); // create the mini-app

// Classic door: Twilio POSTs here on every customer message.
// Chain = limiter → guard → handler (floods die first, forgeries second).
// (Meta JSON never reaches this chain — the splitter below routes it first!)
function isMetaPost(req) {
  const b = req.body; // express.json already parsed (server.js middleware!)
  return b && typeof b === 'object' && b.object === 'whatsapp_business_account'; // Meta's envelope marker (Twilio posts are flat forms — never have .object!)
}
router.post('/whatsapp', webhookLimiter, (req, res, next) => {
  if (!isMetaPost(req)) return validateTwilioSignature(req, res, next); // classic door: prove you're Twilio…
  return metaInbound(req, res); // …Meta door: skip Twilio's guard (Meta proves itself by phone_number_id below!)
});

// Meta subscribe handshake: GET ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y
// → echo Y when X matches ANY shop's stored token (else 403 — strangers get nothing!).
router.get('/whatsapp', webhookLimiter, async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query || {};
  if (mode !== 'subscribe' || !token || !challenge) return res.status(400).send(''); // not a handshake (browsers/probes → 400!)
  try {
    const { rows } = await db.query('SELECT id FROM businesses WHERE meta_verify_token = $1 LIMIT 1', [String(token)]);
    if (!rows.length) return res.status(403).send(''); // unknown token (never reveal which shops exist!)
    return res.status(200).send(String(challenge)); // Meta expects the RAW challenge string (not JSON!)
  } catch (e) {
    console.error('meta verify error:', e.message);
    return res.status(500).send('');
  }
});

// Meta inbound: loop every entry/change/message (Meta batches!), normalize each
// text message to Twilio-shape + req.meta ctx, run the shared brain per message.
async function metaInbound(req, res) {
  const meta = require('../services/channels/meta'); // lazy require (route↔service style!)
  try {
    const entries = (req.body && req.body.entry) || []; // array (Meta batches many updates per POST!)
    for (const entry of entries) { // for...of (each entry independent!)
      for (const change of (entry && entry.changes) || []) { // …each change…
        const value = change && change.value; // …holds metadata + messages…
        const phoneId = value && value.metadata && value.metadata.phone_number_id; // which shop number received this?
        const parsed = meta.parseInbound({ object: 'whatsapp_business_account', entry: [{ changes: [change] }] }); // normalize ONE change (null = status ping/non-text → skip!)
        if (!parsed || !phoneId) continue; // nothing to answer (still 200 below — Meta must never retry noise!)
        const { rows } = await db.query('SELECT * FROM businesses WHERE meta_phone_number_id = $1 LIMIT 1', [String(phoneId)]); // phone id → shop (unmapped number = not ours!)
        const business = rows[0];
        if (!business) continue; // someone else's number hitting our URL (200, no log spam!)
        const sub = { body: { From: 'whatsapp:+' + parsed.from.replace(/\D/g, ''), To: business.whatsapp_number, Body: parsed.body, ProfileName: parsed.name || null }, meta: { business, chatId: parsed.from.replace(/\D/g, '') } }; // Twilio-shape disguise (brain speaks Twilio!) + Meta ctx (sender picks Meta outbound!)
        await webhookController.handleInbound(sub, { status: () => ({ send: () => {}, json: () => {} }), send: () => {} }); // sub-response swallows (one outer 200 below covers the batch!)
      }
    }
  } catch (e) {
    console.error('meta inbound error:', e.message); // log…
  }
  return res.status(200).send(''); // …but ALWAYS 200 (Meta retries failures aggressively — retries double-reply customers!)
}

module.exports = router; // server.js does app.use('/webhook', webhookRoutes)
