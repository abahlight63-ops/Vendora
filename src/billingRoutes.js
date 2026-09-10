// ── src/billingRoutes.js ─────────────────────────────────────────
// ⚠️ LEGACY FILE — NOT USED by the running app. Live billing is split into
// src/routes/billingRoutes.js + src/controllers/billingController.js.
// This older copy keeps everything inline AND has a real bug: `req.ownerEmail`
// is read but NO middleware ever sets it, so Paystack gets `email: undefined`
// and rejects the payment. The live version looks the email up from the DB.
// Read to learn the Paystack flow; EDIT the live files.
// MODULES: express (Router), crypto (Node built-in HMAC), ./db, ./auth (legacy umbrella).
const express = require('express'); // Router class
const crypto = require('crypto'); // Node built-in: HMAC signatures for the webhook check
const db = require('./db'); // shared pool
const auth = require('./auth'); // legacy umbrella → auth.requireAuth guard

const router = express.Router(); // the mini-app

// All billing endpoints require a signed-in owner
router.use(auth.requireAuth); // blanket guard for every route below

/** Initialize a Paystack payment for the monthly subscription. */
router.post('/billing/initialize', async (req, res) => { // frontend calls this → gets a Paystack checkout URL
  const secret = process.env.PAYSTACK_SECRET_KEY; // server-side secret (NEVER sent to the browser)
  if (!secret) return res.status(503).json({ error: 'PAYSTACK_SECRET_KEY not configured' }); // 503 = server not ready

  const amountNaira = Number(process.env.PRICE_NAIRA || 7500); // env override, default ₦7,500
  const email = req.ownerEmail; // ⚠️ BUG: nothing ever sets req.ownerEmail (fixed in live version)
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`; // where Paystack returns the payer

  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', { // ask Paystack for a checkout session
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`, // Bearer token auth (the secret key)
        'Content-Type': 'application/json', // we're sending JSON (unlike Twilio forms)
      },
      body: JSON.stringify({ // JSON.stringify turns the object into a JSON string
        email, // payer email (Paystack receipts go here)
        amount: amountNaira * 100, // kobo — Paystack's SMALLEST unit (₦7500 → 750000)
        metadata: { business_id: req.session.businessId, kind: 'subscription_30d' }, // echoed back in the webhook so we know WHO paid
        callback_url: `${baseUrl}/dashboard`, // where the payer lands after paying
      }),
    });
    const data = await r.json(); // parse Paystack's JSON reply
    if (!data.status) return res.status(502).json({ error: data.message || 'Paystack error' }); // 502 = upstream (Paystack) failed
    res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference }); // frontend redirects to authorization_url
  } catch (err) {
    console.error('billing initialize error:', err); // network down, DNS… log it
    res.status(502).json({ error: 'Could not reach Paystack' });
  }
});

/**
 * Paystack webhook: verifies x-paystack-signature (HMAC-SHA512 of the raw body
 * with the secret key), then activates/extends the subscription on success.
 * Set the webhook URL in your Paystack dashboard to https://<host>/webhook/paystack
 */
async function handlePaystackWebhook(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).end(); // .end() = empty response, no JSON

  const signature = req.get('x-paystack-signature') || ''; // Paystack's HMAC of the raw body
  const expected = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex'); // recompute with OUR secret (req.rawBody saved by server.js verify hook!)
  const a = Buffer.from(signature); // Buffers for…
  const b = Buffer.from(expected); // …timingSafeEqual (constant-time compare, anti timing-attack)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).end(); // signature mismatch = forged/faulty → reject silently
  }

  const event = req.body; // parsed by express.json because signature check needs raw body too
  if (event.event === 'charge.success') { // only successful payments matter
    const { business_id } = event.data.metadata || {}; // the metadata WE sent at initialize time
    const days = Number(process.env.SUBSCRIPTION_DAYS || 30); // how long this payment covers
    if (business_id) {
      await db.query( // activate: status=active, extend expiry (from existing expiry or now, whichever later)
        `UPDATE businesses
         SET subscription_status = 'active',
             subscription_expires = GREATEST(COALESCE(subscription_expires, now()), now()) + make_interval(days => $1),
             paystack_customer_code = $2
         WHERE id = $3`, // GREATEST picks the later date (paid early? you don't lose days). COALESCE handles NULL expiry.
        [days, event.data.customer?.customer_code || null, Number(business_id)] // ?. = optional chaining (safe if customer missing)
      );
      console.log(`Subscription activated for business ${business_id} (+${days} days)`);
    }
  }
  res.status(200).end(); // always 200 on verified webhooks (Paystack retries non-2xx)
}

module.exports = { router, handlePaystackWebhook }; // (legacy — live split is routes/billingRoutes + controllers/billingController)
