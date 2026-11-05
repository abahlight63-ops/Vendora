// ── src/services/privacyService.js ────────────────────────────────
// WHAT: the owner's privacy controls (NDPA):
//   unsubscribe links for marketing email (signed, one click, no login),
//   and deleting an account with everything in it.
const crypto = require('crypto');
const db = require('../db');

const secret = () => process.env.SESSION_SECRET || 'dev-secret-change-me';
const sign = (id) => crypto.createHmac('sha256', secret()).update('unsub:' + Number(id)).digest('hex').slice(0, 32);
function unsubscribeUrl(businessId) {
  const base = (process.env.PUBLIC_BASE_URL || 'https://api.velosalesai.com.ng').replace(/\/$/, '');
  return `${base}/api/auth/unsubscribe?b=${Number(businessId)}&t=${sign(businessId)}`;
}
async function unsubscribe(b, t) {
  const id = Number(b);
  const want = sign(id);
  if (!id || typeof t !== 'string' || t.length !== want.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(want))) return false;
  await db.query('UPDATE businesses SET marketing_opt_out = true WHERE id = $1', [id]);
  return true;
}

// Delete the account: the shop, its products, chats, orders and logins go
// (database cascades). Payment records keep their amounts for tax law but
// lose the link to the shop (payments.business_id is ON DELETE SET NULL).
async function deleteAccount(businessId, { password, confirmName } = {}) {
  const id = Number(businessId);
  const { rows: [b] } = await db.query('SELECT id, name FROM businesses WHERE id = $1', [id]);
  if (!b) throw Object.assign(new Error('Account not found.'), { status: 404 });
  const { rows: users } = await db.query('SELECT password_hash FROM users WHERE business_id = $1', [id]);
  const hasPassword = users.some((u) => u.password_hash);
  if (hasPassword) {
    const ok = users.some((u) => u.password_hash && require('./authService').verifyPassword(String(password || ''), u.password_hash));
    if (!ok) throw Object.assign(new Error('That password is not right.'), { status: 400 });
  } else if (String(confirmName || '').trim() !== b.name) {
    throw Object.assign(new Error('Type your shop name exactly to confirm.'), { status: 400 });
  }
  await db.query('DELETE FROM businesses WHERE id = $1', [id]);
  return { deleted: true };
}

module.exports = { unsubscribeUrl, unsubscribe, deleteAccount };
