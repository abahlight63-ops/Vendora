// ── src/services/whatsappService.js ─────────────────────────────────
// WHAT: the two Twilio operations the app needs: send a WhatsApp text and
// download a customer photo. The LIVE webhookController uses these; the LEGACY
// src/webhook.js has its own inline copies. Twilio via plain fetch — NO twilio
// SDK installed (one less dependency to learn/update/pay attention to).

/**
 * Service for interacting with WhatsApp (via Twilio).
 * Sends a plain-text WhatsApp message. Fire-and-log: failures are logged,
 * never thrown (a failed send must not crash the webhook around it).
 */
async function sendWhatsAppReply(toCustomer, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID; // from .env (AC… string)
  const token = process.env.TWILIO_AUTH_TOKEN; // from .env (secret)
  const from = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. whatsapp:+14155238886
  if (!sid || !token || !from) {
    console.log('Twilio credentials not set; skipping outbound send. Reply was:', message); // dev mode: print instead of sending
    return; // early return = "do nothing gracefully"
  }
  const params = new URLSearchParams({ From: from, To: toCustomer, Body: message }); // URLSearchParams builds form bodies + encodes special chars
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { // Twilio REST: POST …/Accounts/{sid}/Messages.json creates a message (2010-04-01 = API version in the URL)
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), // HTTP Basic: base64("sid:token")
      'Content-Type': 'application/x-www-form-urlencoded', // Twilio speaks HTML forms, not JSON
    },
    body: params, // fetch sends URLSearchParams with the right encoding automatically
  });
  if (!res.ok) {
    console.error('Twilio send failed:', res.status, await res.text()); // log code + Twilio's reason (bad number? trial limit?)
  }
}

// Download a customer photo from Twilio (their media URLs need OUR auth + expire
// in hours, so we fetch immediately and keep a copy for the AI + dashboard).
async function fetchMedia(url, mime) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  try {
    const mRes = await fetch(url, { // GET the media file with Basic auth…
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
    });
    if (mRes.ok) { // …only proceed on HTTP 200
      const buf = Buffer.from(await mRes.arrayBuffer()); // arrayBuffer() = raw bytes → Buffer (Node's byte container)
      let mediaDataUrl = null; // data: URL for the dashboard <img> (stays null for big files)
      // Store small images inline so the dashboard can display them without Twilio auth
      if (buf.length <= 1024 * 1024) { // ≤1MB guard: Twilio links die, but the DB mustn't bloat
        mediaDataUrl = `data:${mime};base64,${buf.toString('base64')}`; // data URL = "the image IS the URL" (embeddable, permanent)
      }
      return { image: { mime, base64: buf.toString('base64') }, mediaDataUrl }; // image → AI vision input; mediaDataUrl → DB media_url column
    }
  } catch (e) {
    console.error('Media fetch failed:', e.message); // network/auth failure → caller continues text-only
  }
  return null; // null = "no photo" (caller checks `if (media)`)
}

module.exports = { sendWhatsAppReply, fetchMedia }; // the WhatsApp I/O API
