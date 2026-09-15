// ── src/services/channels/twilio.js ─────────────────────────────────
// WHAT: per-shop Twilio REST helpers (auto-connect engine). The PLATFORM's own
// Twilio keys live in .env (outbound default); THESE functions take a SHOP's
// pasted SID + token (Connect page) so the app can: list their numbers, pick
// one, and point its inbound webhook at us — no Twilio console needed.
// Twilio REST speaks form bodies + Basic auth. No npm modules — global fetch.
const API = 'https://api.twilio.com/2010-04-01';

function auth(sid, token) {
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'); // HTTP Basic: base64("sid:token")
}

function shapeOk(sid, token) {
  return typeof sid === 'string' && /^AC[a-f0-9]{32}$/i.test(sid.trim()) // AC + 32 hex (real SIDs look exactly like this!)
    && typeof token === 'string' && token.trim().length >= 20; // tokens are long secrets (short = pasted wrong field!)
}

// List the shop's Twilio numbers (proves the credentials + gives the picker).
// Returns { numbers: [{ sid, phone, smsUrl }] } or { error }.
async function listNumbers(sidRaw, tokenRaw) {
  const sid = String(sidRaw || '').trim();
  const token = String(tokenRaw || '').trim();
  if (!shapeOk(sid, token)) return { error: 'That does not look like a Twilio SID + token (SID starts with AC…).' };
  let res;
  try {
    res = await fetch(`${API}/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=50`, {
      headers: { Authorization: auth(sid, token) },
    });
  } catch (e) {
    return { error: 'Could not reach Twilio — check your connection and try again.' };
  }
  if (res.status === 401) return { error: 'Twilio rejected those credentials — re-copy the Auth Token and try again.' };
  if (!res.ok) return { error: `Twilio said no (${res.status}) — try again in a moment.` };
  const data = await res.json().catch(() => ({}));
  const numbers = (data.incoming_phone_numbers || []).map((n) => ({
    sid: n.sid, // PN… sid (needed to set the webhook below!)
    phone: n.phone_number, // +234… (the picker label!)
    smsUrl: n.sms_url || '', // current inbound target ('' = never configured!)
  }));
  return { numbers };
}

// Point ONE Twilio number at our webhook (the actual auto-connect).
// Returns { ok } or { error }.
async function setWebhook(sidRaw, tokenRaw, numberSid, webhookUrl) {
  const sid = String(sidRaw || '').trim();
  const token = String(tokenRaw || '').trim();
  if (!shapeOk(sid, token)) return { error: 'Lost your Twilio credentials — reconnect them first.' };
  if (!/^PN[a-f0-9]{32}$/i.test(String(numberSid || '').trim())) return { error: 'Pick one of your Twilio numbers first.' };
  let res;
  try {
    res = await fetch(`${API}/Accounts/${sid}/IncomingPhoneNumbers/${String(numberSid).trim()}.json`, {
      method: 'POST', // Twilio updates via POSTed form fields (not PUT!)
      headers: { Authorization: auth(sid, token), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ SmsUrl: webhookUrl, SmsMethod: 'POST' }), // WhatsApp inbound arrives on the number's SmsUrl (Twilio routes WhatsApp → SMS webhook!)
    });
  } catch (e) {
    return { error: 'Could not reach Twilio — check your connection and try again.' };
  }
  if (res.status === 401) return { error: 'Twilio rejected those credentials — reconnect them first.' };
  if (!res.ok) return { error: `Twilio refused the webhook change (${res.status}).` };
  return { ok: true };
}

function maskSid(sid) {
  const s = String(sid || '');
  return s.length > 6 ? s.slice(0, 2) + '…' + s.slice(-4) : 'set'; // AC…1234 (proof without exposure — full SID never leaves the server!)
}

module.exports = { listNumbers, setWebhook, shapeOk, maskSid };
