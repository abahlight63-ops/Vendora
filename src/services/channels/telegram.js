// ── src/services/channels/telegram.js ──────────────────────────────
// WHAT: Telegram Bot API adapter (BotFather token, zero docs, 2-minute setup).
// Speaks Telegram's JSON webhook format BOTH ways: parseInbound (update JSON →
// normalized message) + sendText (POST sendMessage) + downloadFile (file_id →
// bytes for photos/voice). No npm modules — fetch only (Bot API is plain HTTPS!).
// SECURITY: BotFather secret_token → X-Telegram-Bot-Api-Secret-Token header on
// every webhook call. Wrong/missing secret = 403 (anyone can POST otherwise!).
// WEBHOOK URLS (set via BotFather / setWebhook, secret identical everywhere):
//   per-shop: POST /webhook/telegram/:bizId (opaque id + secret header = auth!)
//   shared:   POST /webhook/telegram/shared (TELEGRAM_SHARED_BOT_TOKEN handles!)

const api = (token) => `https://api.telegram.org/bot${token}`; // base URL builder (token IN the path — Telegram's design, not ours!)

// Verify the secret header BotFather attaches (set it in setWebhook!).
function verifySecret(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET; // ONE secret for all bots (set once, reuse everywhere — rotation = one env edit!)
  if (!expected) return true; // unset = dev mode (no check — same convention as TWILIO_VALIDATE!)
  return req.get('X-Telegram-Bot-Api-Secret-Token') === expected; // exact match (timing attacks irrelevant here — low-value secret, but still exact!)
}

// Send a plain-text message (Markdown-free: Telegram parses *bold* by default
// in some modes — we send WITHOUT parse_mode so catalog prices with _underscores_
// and *stars* arrive VERBATIM, never mangled!).
async function sendText(token, chatId, text) {
  if (!token || !chatId || !text) return; // guards (empty token = shop never connected Telegram!)
  try {
    const res = await fetch(`${api(token)}/sendMessage`, { // Bot API sendMessage (POST JSON!)
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4000) }), // slice 4096-limit guard (Telegram caps ~4096 chars — truncate, never fail!)
    });
    if (!res.ok) console.error(`Telegram send failed: ${res.status} ${(await res.text()).slice(0, 150)}`); // log short reason (blocked bot? deleted chat? — common + harmless!)
  } catch (e) {
    console.error('Telegram send error:', e.message); // network down → log only (webhook must never crash!)
  }
}

// Send a product photo with the reply as its caption (Pro catalog photos).
// Returns true when Telegram accepted it, false = caller falls back to text.
async function sendPhoto(token, chatId, photoUrl, caption) {
  if (!token || !chatId || !photoUrl) return false; // guards (empty token = shop never connected Telegram!)
  try {
    const res = await fetch(`${api(token)}/sendPhoto`, { // Bot API sendPhoto (POST JSON: photo URL + caption ride together!)
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: String(caption || '').slice(0, 1000) }), // slice 1024-limit guard (captions cap lower than messages — truncate, never fail!)
    });
    if (!res.ok) { // dead URL? blocked host?…
      console.error(`Telegram photo send failed: ${res.status} ${(await res.text()).slice(0, 150)}`); // …log short reason…
      return false; // …caller falls back to plain text (photo must never eat the reply!)
    }
    return true;
  } catch (e) {
    console.error('Telegram photo send error:', e.message); // network down → log only (webhook must never crash!)
    return false;
  }
}

// Download a file by file_id: getFile → file_path → download bytes.
// Returns { mime, base64 } (same shape as Twilio fetchMedia audio/image twins!).
async function downloadFile(token, fileId, mime) {
  try {
    const info = await fetch(`${api(token)}/getFile?file_id=${encodeURIComponent(fileId)}`, { method: 'GET' }); // step 1: resolve file_id → server path…
    if (!info.ok) return null; // expired/unknown file_id (Telegram purges un-downloaded files!)
    const { result } = await info.json(); // { file_path: "voice/file_1.oga" }…
    if (!result?.file_path) return null; // ?. guards malformed replies (defensive!)
    const dl = await fetch(`https://api.telegram.org/file/bot${token}/${result.file_path}`, { method: 'GET' }); // step 2: download via the FILE endpoint (different host path — same token!)
    if (!dl.ok) return null;
    const buf = Buffer.from(await dl.arrayBuffer()); // bytes → Buffer…
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return null; // empty/huge guard (same 10MB rule as Twilio path!)
    return { mime: mime || 'audio/ogg', base64: buf.toString('base64') }; // twin shape (feeds Whisper OR vision callers!)
  } catch (e) {
    console.error('Telegram download error:', e.message);
    return null; // null = caller degrades (text-only / handoff — never crash!)
  }
}

// Parse a Telegram update into NORMALIZED shape (or null = ignore: edits,
// callbacks, service messages — only fresh inbound messages matter!).
// Returns { chatId, fromId, name, kind: 'text'|'photo'|'voice'|'other', text,
//           fileId, mime } — kind drives the webhook (text/photo/voice paths!).
function parseInbound(update) {
  const msg = update && (update.message || update.edited_message); // edited_message included (re-read edits — better than ignoring!)
  if (!msg || !msg.chat || !msg.from) return null; // no chat/sender = unroutable (service pings, channel posts…)
  if (msg.from.is_bot) return null; // ignore OTHER bots (echo loops = infinite money fire — always guard this!)
  const chatId = String(msg.chat.id); // numeric id AS STRING (DB columns are TEXT — consistent!)
  const fromId = String(msg.from.id); // sender id (owner-link + shared-bind keys!)
  const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || null; // "Adaeze Obi" (filter(Boolean) drops missing halves!)
  if (msg.voice) return { chatId, fromId, name, kind: 'voice', text: msg.caption || '', fileId: msg.voice.file_id, mime: msg.voice.mime_type || 'audio/ogg' }; // voice note (+ optional typed caption BELOW it!)
  if (msg.audio) return { chatId, fromId, name, kind: 'voice', text: msg.caption || '', fileId: msg.audio.file_id, mime: msg.audio.mime_type || 'audio/mpeg' }; // audio FILE (music/mp3 — same Whisper path!)
  if (msg.photo && msg.photo.length) { // photo = ARRAY of sizes (Telegram sends thumbnails → full — take the LAST = biggest!)
    const best = msg.photo[msg.photo.length - 1];
    return { chatId, fromId, name, kind: 'photo', text: msg.caption || '', fileId: best.file_id, mime: 'image/jpeg' }; // caption rides along (same as WhatsApp pattern!)
  }
  if (msg.document) { // documents: photos-as-files + PDFs land here (try vision for images, note otherwise!)…
    const mime = msg.document.mime_type || '';
    if (mime.startsWith('image/')) return { chatId, fromId, name, kind: 'photo', text: msg.caption || '', fileId: msg.document.file_id, mime };
    return { chatId, fromId, name, kind: 'other', text: msg.caption || '' }; // non-image docs noted, not processed (scope control!)
  }
  if (typeof msg.text === 'string' && msg.text.trim()) return { chatId, fromId, name, kind: 'text', text: msg.text, fileId: null, mime: null }; // plain text (trim guard kills whitespace-only!)
  if (msg.sticker) return { chatId, fromId, name, kind: 'other', text: '[sticker]' }; // stickers noted (AI would hallucinate on them — handoff cue instead!)
  return null; // anything else (polls, locations, contacts…) ignored for v1 (scope!)
}

module.exports = { verifySecret, sendText, sendPhoto, downloadFile, parseInbound }; // route + webhook import these five
