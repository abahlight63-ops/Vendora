// ── src/services/channels/metaSignature.js ───────────────────────
// WHAT: proves a WhatsApp webhook really came from Meta. Meta signs every
// webhook POST with HMAC-SHA256 of the raw body, keyed by the app secret of the
// Meta app that owns the subscription, and sends it as X-Hub-Signature-256.
// Two kinds of shop:
//   via 'app'    : connected with the one-tap window → signed by OUR app (META_APP_SECRET)
//   via 'manual' : pasted keys from THEIR OWN Meta app → signed by their app secret
//                  (stored in meta_app_secret when the owner adds it)
// verdict(): 'ok' (signature matches the secret this shop needs), 'bad' (a
// secret is known and the signature does not match → drop it), or 'unchecked'
// (no secret known for this shop yet → accepted, logged once a day per shop).
const crypto = require('crypto');

function sign(secret, raw) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw || Buffer.alloc(0)).digest('hex');
}
function matches(secret, raw, header) {
  if (!secret || !header) return false;
  const want = Buffer.from(sign(secret, raw));
  const got = Buffer.from(String(header));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
function verdict(business, raw, header) {
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  const own = String((business && business.meta_app_secret) || '').trim();
  const via = (business && business.meta_connect_via) || '';
  const needed = via === 'app' ? appSecret : own; // manual or not-yet-known: only the shop's own secret can prove it (older shops keep working until they add one)
  if (matches(appSecret, raw, header) || matches(own, raw, header)) return 'ok';
  return needed ? 'bad' : 'unchecked';
}
const warned = new Map();
function warnUnchecked(businessId) {
  const day = new Date().toISOString().slice(0, 10);
  if (warned.get(businessId) === day) return;
  warned.set(businessId, day);
  console.warn(`meta webhook: shop ${businessId} has no app secret on file, so its WhatsApp messages are not signature-checked. Add the App secret on the Channels page (own Meta app) or set META_APP_SECRET.`);
}
module.exports = { sign, matches, verdict, warnUnchecked };
