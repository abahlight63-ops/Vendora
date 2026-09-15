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
async function sendWhatsAppReply(toCustomer, message, mediaUrl) {
  const sid = process.env.TWILIO_ACCOUNT_SID; // from .env (AC… string)
  const token = process.env.TWILIO_AUTH_TOKEN; // from .env (secret)
  const from = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. whatsapp:+14155238886
  if (!sid || !token || !from) {
    console.log('Twilio credentials not set; skipping outbound send. Reply was:', message); // dev mode: print instead of sending
    return; // early return = "do nothing gracefully"
  }
  const send = (withMedia) => { // closure: builds + posts one message attempt (withMedia toggles the photo attach!)
    const params = new URLSearchParams({ From: from, To: toCustomer, Body: message }); // URLSearchParams builds form bodies + encodes special chars
    if (withMedia) params.append('MediaUrl', mediaUrl); // MediaUrl = Twilio fetches the photo server-side and delivers it as a picture bubble (MMS-style param, works on WhatsApp!)
    return fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { // Twilio REST: POST …/Accounts/{sid}/Messages.json creates a message (2010-04-01 = API version in the URL)
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), // HTTP Basic: base64("sid:token")
        'Content-Type': 'application/x-www-form-urlencoded', // Twilio speaks HTML forms, not JSON
      },
      body: params, // fetch sends URLSearchParams with the right encoding automatically
    });
  };
  const res = await send(!!mediaUrl); // first attempt: WITH photo when one was resolved (photoUrl already validated https-only at save time!)
  if (!res.ok) {
    console.error('Twilio send failed:', res.status, await res.text()); // log code + Twilio's reason (bad number? trial limit?)
    if (mediaUrl) { // photo attach failed (dead URL? blocked host?) → retry TEXT-ONLY so the customer still gets the answer (photo must never eat the reply!)
      const retry = await send(false);
      if (!retry.ok) console.error('Twilio text retry failed:', retry.status, await retry.text());
    }
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
      if (buf.length > 10 * 1024 * 1024) return null; // >10MB guard (voice caps below are tighter; photos keep the 1MB inline rule!)
      let mediaDataUrl = null; // data: URL for the dashboard <img> (stays null for big files)
      // Store small images inline so the dashboard can display them without Twilio auth
      if (buf.length <= 1024 * 1024) { // ≤1MB guard: Twilio links die, but the DB mustn't bloat
        mediaDataUrl = `data:${mime};base64,${buf.toString('base64')}`; // data URL = "the image IS the URL" (embeddable, permanent)
      }
      return { image: { mime, base64: buf.toString('base64') }, mediaDataUrl, audio: { mime, base64: buf.toString('base64') } }; // audio twin included (same bytes feed Whisper below — one download serves BOTH paths!)
    }
  } catch (e) {
    console.error('Media fetch failed:', e.message); // network/auth failure → caller continues text-only
  }
  return null; // null = "no media" (caller checks `if (media)`)
}

// Transcribe voice notes with Whisper Large v3 on Groq (FREE tier: ~20 RPM).
// Input: { mime, base64 } audio bytes (ogg/opus from WhatsApp, ogg/mp3 from
// Telegram). Output: plain transcript string (or null = give up gracefully).
// WHY Groq + WHY Large v3: sub-second turnaround, no card, OpenAI-compatible
// upload (multipart/form-data — Node 18+ has global FormData/Blob built in!).
async function transcribeAudio(audio) {
  const key = process.env.GROQ_API_KEY; // same key as chat (no new secret to manage!)
  if (!key || key.includes('...') || key.includes('xxxxx')) return null; // placeholder/empty → skip silently (caller falls back to the "voice is Pro Plus" handoff!)
  if (!audio || !audio.base64) return null; // nothing to transcribe (guard clause)
  try {
    const buf = Buffer.from(audio.base64, 'base64'); // base64 → raw bytes…
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return null; // empty or >10MB (Whisper caps + cost guard — long rants get the handoff instead!)
    const ext = /mp3|mpeg/.test(audio.mime || '') ? 'mp3' : 'ogg'; // filename extension MATTERS (Whisper sniffs format from it! ogg = WhatsApp/Telegram voice)
    const form = new FormData(); // global FormData (Node 18+ built-in — no `form-data` package needed!)
    form.append('file', new Blob([buf], { type: audio.mime || 'audio/ogg' }), `voice.${ext}`); // Blob wraps bytes with MIME; third arg = filename (required by the API!)
    form.append('model', process.env.WHISPER_MODEL || 'whisper-large-v3'); // env-overridable (rotation-proof, like chat models!)
    form.append('response_format', 'text'); // 'text' = plain transcript string back (not JSON — simpler!)
    const ctrl = new AbortController(); // hard deadline (transcription must never hang a webhook!)…
    const t = setTimeout(() => ctrl.abort(), 30000); // …30s (voice notes are short; longer = handoff!)
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key }, // NO content-type header (fetch sets multipart boundary automatically — setting it manually BREAKS uploads!)
      body: form,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t)); // finally clears the timer either way (no leaks!)
    if (!res.ok) { // 429 (quota) / 400 (bad audio) / 401 (bad key)…
      console.error(`Whisper error ${res.status}: ${(await res.text()).slice(0, 150)}`); // …log short reason (debugging gold!)
      return null; // caller degrades gracefully (never crash on transcription!)
    }
    const text = (await res.text()).trim(); // plain-text transcript…
    return text || null; // …or null if Whisper heard silence (empty → handoff, not empty reply!)
  } catch (e) {
    console.error('transcribeAudio error:', e.message); // network/timeout/abort all land here…
    return null; // …and all degrade to null (caller handles it!)
  }
}

module.exports = { sendWhatsAppReply, fetchMedia, transcribeAudio }; // the WhatsApp I/O + voice API
