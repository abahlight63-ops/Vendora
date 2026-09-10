// ── src/middleware/twilioVerify.js ─────────────────────────────────
// WHAT: proves incoming webhooks really came from Twilio, not an attacker.
// HOW: Twilio signs every request with HMAC-SHA1 (a keyed hash) using your
// Auth Token over the full URL + sorted POST params. We recompute the hash
// and compare — only someone holding the token can produce a match.
// MODULE: `crypto` — BUILT INTO Node.js (no npm install needed). It provides
// createHmac for keyed hashing and timingSafeEqual for safe comparison.
const crypto = require('crypto'); // Node built-in: hashing, random bytes, encryption

/**
 * Twilio webhook signature verification.
 * Twilio signs each request with HMAC-SHA1 using your Auth Token over
 * the full URL + alphabetically sorted POST params.
 * Enable by setting TWILIO_AUTH_TOKEN in .env (skipped if token missing,
 * disabled entirely with TWILIO_VALIDATE=off for local testing).
 */
function validateTwilioSignature(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN; // the shared secret only you + Twilio know
  if (!authToken || process.env.TWILIO_VALIDATE === 'off') return next(); // dev mode: skip check

  const signature = req.get('X-Twilio-Signature'); // Twilio's hash, sent as a header
  if (!signature) {
    return res.status(403).json({ error: 'Missing Twilio signature' }); // 403 = Forbidden
  }

  // Full public URL (behind ngrok/proxy, x-forwarded-proto holds the real scheme)
  const proto = req.get('x-forwarded-proto') || req.protocol; // https on Railway, http locally
  const host = req.get('x-forwarded-host') || req.get('host'); // public hostname, not localhost
  const url = `${proto}://${host}${req.originalUrl}`; // must EXACTLY match what Twilio signed

  // Twilio's recipe: sort param names A→Z, glue "name+value" together with no separators
  const params = Object.keys(req.body || {}) // Object.keys = array of field names
    .sort() // alphabetical sort (required by Twilio's spec)
    .map((k) => k + (req.body[k] || '')) // "From" + "whatsapp:+234..." etc.
    .join(''); // one long string

  // HMAC-SHA1(secret, url+params) then base64-encode — the expected signature
  const expected = crypto
    .createHmac('sha1', authToken) // keyed hash with your Auth Token
    .update(Buffer.from(url + params, 'utf-8')) // feed the exact signed bytes
    .digest('base64'); // output as base64 text (Twilio's format)

  const a = Buffer.from(signature); // turn both strings into byte buffers…
  const b = Buffer.from(expected); // …because timingSafeEqual needs Buffers
  // timingSafeEqual compares in CONSTANT time so attackers can't guess the hash
  // byte-by-byte from response speed (a "timing attack"). Length check first
  // because timingSafeEqual throws if lengths differ.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error('Invalid Twilio signature — possible spoofed request');
    return res.status(403).json({ error: 'Invalid signature' });
  }
  next(); // signature matches — this really is Twilio, continue to the handler
}

module.exports = { validateTwilioSignature }; // used in routes/webhookRoutes.js
