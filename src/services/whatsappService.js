// ── src/services/whatsappService.js ─────────────────────────────────
// WHAT: shared WhatsApp helpers that are NOT channel-specific: voice-note
// transcription (Whisper Large v3 on Groq) + a generic media downloader for
// public URLs. Outbound WhatsApp sends live in services/channels/meta.js
// (Meta Cloud API, per-shop token) — there is no Twilio anywhere in this app.
// Telegram media has its own downloader (services/channels/telegram.js).

// Download a public media URL (Meta serves catalog + message media by link).
// Returns { image: {mime, base64}, mediaDataUrl, audio: {mime, base64} } or null.
async function fetchMedia(url, mime) {
  if (!url || !/^https:\/\//i.test(String(url))) return null; // https-only (never fetch local/private URLs!)
  try {
    const mRes = await fetch(String(url));
    if (mRes.ok) { // …only proceed on HTTP 200
      const buf = Buffer.from(await mRes.arrayBuffer()); // arrayBuffer() = raw bytes → Buffer (Node's byte container)
      if (buf.length > 10 * 1024 * 1024) return null; // >10MB guard (voice caps below are tighter; photos keep the 1MB inline rule!)
      let mediaDataUrl = null; // data: URL for the dashboard <img> (stays null for big files)
      // Store small images inline so the dashboard can display them without re-fetching
      if (buf.length <= 1024 * 1024) { // ≤1MB guard: the DB mustn't bloat
        mediaDataUrl = `data:${mime};base64,${buf.toString('base64')}`; // data URL = "the image IS the URL" (embeddable, permanent)
      }
      return { image: { mime, base64: buf.toString('base64') }, mediaDataUrl, audio: { mime, base64: buf.toString('base64') } }; // audio twin included (same bytes feed Whisper below — one download serves BOTH paths!)
    }
  } catch (e) {
    console.error('Media fetch failed:', e.message); // network failure → caller continues text-only
  }
  return null; // null = "no media" (caller checks `if (media)`)
}

// Transcribe voice notes with Whisper Large v3 on Groq (FREE tier: ~20 RPM).
// Input: { mime, base64 } audio bytes (ogg/opus from Telegram voice notes).
// Output: plain transcript string (or null = give up gracefully).
// WHY Groq + WHY Large v3: sub-second turnaround, no card, OpenAI-compatible
// upload (multipart/form-data — Node 18+ has global FormData/Blob built in!).
async function transcribeAudio(audio) {
  const key = process.env.GROQ_API_KEY; // same key as chat (no new secret to manage!)
  if (!key || key.includes('...') || key.includes('xxxxx')) return null; // placeholder/empty → skip silently (caller falls back to the "voice is Pro Plus" handoff!)
  if (!audio || !audio.base64) return null; // nothing to transcribe (guard clause)
  try {
    const buf = Buffer.from(audio.base64, 'base64'); // base64 → raw bytes…
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return null; // empty or >10MB (Whisper caps + cost guard — long rants get the handoff instead!)
    const ext = /mp3|mpeg/.test(audio.mime || '') ? 'mp3' : 'ogg'; // filename extension MATTERS (Whisper sniffs format from it! ogg = Telegram voice)
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

module.exports = { fetchMedia, transcribeAudio }; // voice + generic media helpers (sends live in channels/meta.js!)
