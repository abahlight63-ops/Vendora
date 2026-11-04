// ── src/services/customerSend.js ─────────────────────────────────
// WHAT: send one text to the customer of a chat, through that chat's own channel
// (WhatsApp via Meta, Telegram via the shop's bot or the shared house bot).
// Returns { sent: true } or { sent: false, status, error } with a message the
// owner can act on. Ownership is checked: a chat from another shop is "not found".
const db = require('../db');

async function sendToConversation(businessId, conversationId, text) {
  const { rows: c } = await db.query('SELECT id, customer_number FROM conversations WHERE id = $1 AND business_id = $2', [Number(conversationId), Number(businessId)]);
  if (!c.length) return { sent: false, status: 404, error: 'That chat was not found.' };
  const { rows: b } = await db.query('SELECT meta_token, meta_phone_number_id, telegram_bot_token, telegram_shared_on FROM businesses WHERE id = $1', [Number(businessId)]);
  if (!b.length) return { sent: false, status: 404, error: 'Not found' };
  const biz = b[0];
  const dest = String(c[0].customer_number || '');
  if (dest.startsWith('telegram:')) {
    const token = (biz.telegram_bot_token || '').trim() || (biz.telegram_shared_on ? (process.env.TELEGRAM_SHARED_BOT_TOKEN || '').trim() : '');
    if (!token) return { sent: false, status: 400, error: 'Telegram is not connected. Connect it on the Channels page first.' };
    const ok = await require('./channels/telegram').sendText(token, dest.slice('telegram:'.length), text);
    return ok ? { sent: true } : { sent: false, status: 502, error: 'Telegram refused the message (blocked bot or deleted chat?). Try again.' };
  }
  const to = dest.replace(/\D/g, '');
  if (!biz.meta_token || !biz.meta_phone_number_id || !to) return { sent: false, status: 400, error: 'WhatsApp is not connected. Connect it on the Channels page first.' };
  const ok = await require('./channels/meta').sendText(biz.meta_token, biz.meta_phone_number_id, to, text);
  return ok ? { sent: true } : { sent: false, status: 502, error: 'WhatsApp refused the message. If it has been more than 24 hours since the customer last wrote, WhatsApp only allows approved templates.' };
}

module.exports = { sendToConversation };
