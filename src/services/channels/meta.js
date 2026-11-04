// ── src/services/channels/meta.js ──────────────────────────────────
// WHAT: Meta WhatsApp Cloud API channel (the free-to-start road). A shop pastes
// TWO values from developers.facebook.com (Phone Number ID + access token) and
// our webhook URL into Meta once — then inbound arrives here and replies go out
// through Meta's Graph API. No Twilio needed, no per-message middleman fee.
// DOCS SHAPE (v22.0): send = POST /{phone-number-id}/messages {messaging_product,
// to, type, text|image}; inbound = {object:'whatsapp_business_account',
// entry:[{changes:[{value:{messages, contacts}}]}]}; verify = GET
// ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… (echo challenge when
// the token matches a shop's stored verify token). No npm modules — fetch only.
const GRAPH = 'https://graph.facebook.com/v22.0';

function shapeOk(phoneId, token) {
  return typeof phoneId === 'string' && /^\d{5,}$/.test(phoneId.trim()) // numeric id, 5+ digits (real IDs are long numbers!)
    && typeof token === 'string' && token.trim().length >= 20; // tokens are long (short = pasted wrong field!)
}

// Validate credentials by asking Meta whose number this is.
// Returns { phone } (display number) or { error }.
async function checkCredentials(phoneIdRaw, tokenRaw) {
  const phoneId = String(phoneIdRaw || '').trim();
  const token = String(tokenRaw || '').trim();
  if (!shapeOk(phoneId, token)) return { error: 'That does not look like a Phone Number ID + token (ID is all digits).' };
  let res;
  try {
    res = await fetch(`${GRAPH}/${phoneId}?fields=display_phone_number`, {
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch (e) {
    return { error: 'Could not reach Meta — check your connection and try again.' };
  }
  if (res.status === 401 || res.status === 403) return { error: 'Meta rejected that token — copy a fresh one and try again.' };
  if (!res.ok) return { error: `Meta said no (${res.status}) — try again in a moment.` };
  const data = await res.json().catch(() => ({}));
  if (data.error) return { error: 'Meta rejected those details — ' + String(data.error.message || 'check them and retry.').slice(0, 120) };
  return { phone: data.display_phone_number || '' };
}

// Send a WhatsApp reply through Meta (text, or photo-by-public-link + caption).
// Fire-and-log sender: failures log, never throw (a failed send must not crash the webhook around it).
// Returns true = delivered, false = failed (callers that need proof check it;
// fire-and-forget callers ignore it — same as before!).
async function sendText(token, phoneId, to, message, mediaUrl) {
  if (!token || !phoneId || !to || !message) return false;
  const body = mediaUrl // photo variant: Meta sends images BY LINK (our /uploads/ URLs are public in prod!)
    ? { messaging_product: 'whatsapp', to, type: 'image', image: { link: mediaUrl, caption: String(message).slice(0, 1000) } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: String(message) } };
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Meta send failed:', res.status, (await res.text()).slice(0, 200));
      if (mediaUrl) { // photo failed (private link? expired?) → retry TEXT-ONLY (photo must never eat the reply!)
        const retry = await fetch(`${GRAPH}/${phoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: String(message) } }),
        });
        if (!retry.ok) { console.error('Meta text retry failed:', retry.status, (await retry.text()).slice(0, 200)); return false; }
        return true;
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error('Meta send error:', e.message);
    return false;
  }
}

// Normalize a Meta webhook POST into { from, body, name } or null (status
// pings, reactions, unknown shapes → null = ignore quietly, still 200!).
function parseInbound(payload) {
  try {
    const entry = payload && payload.object === 'whatsapp_business_account' && payload.entry && payload.entry[0];
    const change = entry && entry.changes && entry.changes[0];
    const value = change && change.value;
    const msg = value && value.messages && value.messages[0];
    if (!msg || !msg.from) return null; // status pings (sent/read receipts) carry no message
    const contact = value.contacts && value.contacts[0];
    const base = {
      id: String(msg.id || ''), // Meta message id (wamid…) — used for retry dedupe (never logged, never sent!)
      from: String(msg.from || ''), // customer digits (no whatsapp: prefix on Meta!)
      name: (contact && contact.profile && contact.profile.name) || '',
      kind: 'text', mediaId: null, mime: null,
    };
    if (msg.type === 'reaction' || msg.type === 'system') return null; // a thumbs-up on a message is not a question
    if (msg.type === 'text') return msg.text && msg.text.body ? { ...base, body: String(msg.text.body) } : null;
    // Photos and voice notes arrive as media ids: the route downloads them.
    if (msg.type === 'image' && msg.image) return { ...base, kind: 'image', mediaId: msg.image.id, mime: msg.image.mime_type || 'image/jpeg', body: String(msg.image.caption || '') };
    if (msg.type === 'audio' && msg.audio) return { ...base, kind: 'audio', mediaId: msg.audio.id, mime: msg.audio.mime_type || 'audio/ogg', body: '' };
    // Everything else still reaches the Inbox as a short note, so nothing is lost.
    const NOTE = { video: 'a video', document: 'a document', sticker: 'a sticker', location: 'a location', contacts: 'a contact card' };
    if (msg.type === 'button' && msg.button) return { ...base, body: String(msg.button.text || '') || '[the customer tapped a button]' };
    if (msg.type === 'interactive' && msg.interactive) { const r = msg.interactive.button_reply || msg.interactive.list_reply; return { ...base, body: (r && r.title) || '[the customer tapped a button]' }; }
    const cap = msg[msg.type] && msg[msg.type].caption ? ' ' + String(msg[msg.type].caption) : '';
    return { ...base, kind: 'other', body: `[the customer sent ${NOTE[msg.type] || 'a message Velo cannot read yet'}]${cap}` };
  } catch {
    return null; // malformed → ignore (never crash a webhook!)
  }
}

// Send an approved WhatsApp template (needed for anyone who has not written in
// 24 hours). The template must have one {{1}} in its body for the message.
// Meta bills template messages to the shop's own WhatsApp account.
async function sendTemplate(token, phoneId, to, name, lang, text) {
  if (!token || !phoneId || !to || !name) return false;
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name, language: { code: lang || 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: String(text).slice(0, 1000) }] }] } }),
    });
    if (!res.ok) { console.error('Meta template send failed:', res.status, (await res.text()).slice(0, 200)); return false; }
    return true;
  } catch (e) { console.error('Meta template error:', e.message); return false; }
}

// Download a WhatsApp media file (photo or voice note) by its id.
// Two steps: ask Graph for a short-lived URL, then fetch the bytes with the
// same token. Returns { mime, base64 } or null (too big, expired, no token).
async function downloadMedia(tokenRaw, mediaId) {
  const token = String(tokenRaw || '').trim();
  if (!token || !mediaId) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const meta = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, { headers: { Authorization: 'Bearer ' + token }, signal: ctrl.signal });
    if (!meta.ok) { clearTimeout(t); console.error('meta media lookup', meta.status); return null; }
    const info = await meta.json();
    if (!info || !info.url || Number(info.file_size) > 10 * 1024 * 1024) { clearTimeout(t); return null; } // 10 MB cap
    const file = await fetch(info.url, { headers: { Authorization: 'Bearer ' + token }, signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (!file.ok) { console.error('meta media download', file.status); return null; }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!buf.length || buf.length > 10 * 1024 * 1024) return null;
    return { mime: info.mime_type || file.headers.get('content-type') || 'application/octet-stream', base64: buf.toString('base64') };
  } catch (e) {
    console.error('meta media error:', e.message);
    return null;
  }
}

// Pull the shop's WhatsApp business profile for one-tap auto-sync.
// Returns { profileText } (fed to extractProducts) or { error }.
async function fetchBusinessProfile(tokenRaw, phoneIdRaw) {
  const token = String(tokenRaw || '').trim();
  const phoneId = String(phoneIdRaw || '').trim();
  if (!shapeOk(phoneId, token)) return { error: 'Reconnect Meta first (missing details).' };
  let res;
  try {
    res = await fetch(`${GRAPH}/${phoneId}/business_profile?fields=about,address,description,email,websites`, {
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch (e) {
    return { error: 'Could not reach Meta — try again.' };
  }
  if (!res.ok) return { error: 'Meta would not share the profile — fill it in WhatsApp Manager first, or paste it manually.' };
  const d = await res.json().catch(() => ({}));
  const p = (d && d.data && d.data[0]) || d || {};
  const bits = [p.about, p.description, p.address, p.email, Array.isArray(p.websites) ? p.websites.join(' ') : p.websites]
    .filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  if (!bits.length) return { error: 'Your Meta business profile is empty — fill it in WhatsApp Manager, or paste it manually.' };
  return { profileText: bits.join('\n') };
}

// Exchange an Embedded Signup authorization code for a user access token.
// Needs META_APP_SECRET server-side (never shipped to browsers!). Returns
// { token } or { error }.
async function exchangeCode(codeRaw) {
  const code = String(codeRaw || '').trim();
  const appId = (process.env.META_APP_ID || '').trim();
  const secret = (process.env.META_APP_SECRET || '').trim();
  if (!code) return { error: 'Missing signup code — try connecting again.' };
  if (!appId || !secret) return { error: 'Server is missing META_APP_ID / META_APP_SECRET — paste your token manually instead.' };
  let res;
  try {
    const url = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}`
      + `&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(code)}`;
    res = await fetch(url, { method: 'GET' });
  } catch (e) {
    return { error: 'Could not reach Meta — check your connection and try again.' };
  }
  if (!res.ok) return { error: 'Meta rejected the signup code — reconnect and try again.' };
  const data = await res.json().catch(() => ({}));
  if (data.error || !data.access_token) return { error: 'Meta rejected the signup code — reconnect and try again.' };
  return { token: String(data.access_token) };
}

// List phone numbers on a WABA (used after code exchange to discover the
// phone_number_id the user picked). Returns { numbers: [{id, display}] }.
async function listWabaNumbers(wabaIdRaw, tokenRaw) {
  const wabaId = String(wabaIdRaw || '').trim();
  const token = String(tokenRaw || '').trim();
  if (!/^\d{5,}$/.test(wabaId) || token.length < 20) return { error: 'Missing business account details — try connecting again.' };
  let res;
  try {
    res = await fetch(`${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number`, {
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch (e) {
    return { error: 'Could not reach Meta — try again.' };
  }
  if (!res.ok) return { error: 'Meta would not share your numbers — try again.' };
  const data = await res.json().catch(() => ({}));
  const numbers = ((data && data.data) || []).map((n) => ({ id: String(n.id || ''), display: n.display_phone_number || '' })).filter((n) => n.id);
  return { numbers };
}

module.exports = { sendTemplate, downloadMedia, checkCredentials, sendText, parseInbound, fetchBusinessProfile, shapeOk, exchangeCode, listWabaNumbers, GRAPH };
