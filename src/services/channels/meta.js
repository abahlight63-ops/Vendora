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
// Fire-and-log like the Twilio sender: failures log, never throw.
async function sendText(token, phoneId, to, message, mediaUrl) {
  if (!token || !phoneId || !to || !message) return;
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
        if (!retry.ok) console.error('Meta text retry failed:', retry.status, (await retry.text()).slice(0, 200));
      }
    }
  } catch (e) {
    console.error('Meta send error:', e.message);
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
    if (!msg || msg.type !== 'text' || !msg.text || !msg.text.body) return null; // text only for now (images/voice on Meta = future upgrade!)
    const contact = value.contacts && value.contacts[0];
    return {
      from: String(msg.from || ''), // customer digits (no whatsapp: prefix on Meta!)
      body: String(msg.text.body || ''),
      name: (contact && contact.profile && contact.profile.name) || '',
    };
  } catch {
    return null; // malformed → ignore (never crash a webhook!)
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

module.exports = { checkCredentials, sendText, parseInbound, fetchBusinessProfile, shapeOk, GRAPH };
