// ── src/services/reviewService.js ─────────────────────────────────
// WHAT: in-app reviews from shop owners, and their data export.
// Reviews: asked only after a meaningful win (receipt sent, broadcast sent, order
// saved), at most once every 14 days, never in the first 2 days. Stored in
// app_reviews (our own database), read in the admin console. Never published.
const db = require('../db');

const ACTIONS = { receipt_sent: 'Receipt sent', broadcast_sent: 'Broadcast sent', order_saved: 'Order saved', shop_profile_done: 'Shop profile complete' };
const GAP_DAYS = 14;

async function shouldAsk(businessId, action) {
  if (!ACTIONS[action]) return false;
  const { rows: [b] } = await db.query(
    `SELECT created_at, review_asked_at,
            (SELECT COUNT(*) FROM app_reviews r WHERE r.business_id = b.id AND r.created_at > now() - interval '60 days')::int AS recent
       FROM businesses b WHERE id = $1`, [Number(businessId)]);
  if (!b) return false;
  if (new Date(b.created_at) > new Date(Date.now() - 2 * 864e5)) return false; // let them settle in first
  if (b.review_asked_at && new Date(b.review_asked_at) > new Date(Date.now() - GAP_DAYS * 864e5)) return false;
  if (b.recent > 0) return false; // reviewed in the last 60 days: leave them alone
  return true;
}
async function markAsked(businessId) { await db.query('UPDATE businesses SET review_asked_at = now() WHERE id = $1', [Number(businessId)]); }
async function save(businessId, { rating, comment, action }) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) throw Object.assign(new Error('Pick from 1 to 5 stars.'), { status: 400 });
  await db.query('INSERT INTO app_reviews (business_id, rating, comment, action) VALUES ($1, $2, $3, $4)',
    [Number(businessId), r, String(comment || '').trim().slice(0, 1000) || null, ACTIONS[action] ? action : null]);
  await markAsked(businessId);
}
async function adminList() {
  const [{ rows }, { rows: [s] }] = await Promise.all([
    db.query(`SELECT r.id, r.rating, r.comment, r.action, r.created_at, b.name AS shop, b.id AS business_id
                FROM app_reviews r LEFT JOIN businesses b ON b.id = r.business_id ORDER BY r.created_at DESC LIMIT 200`),
    db.query(`SELECT COUNT(*)::int AS n, ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) FILTER (WHERE rating <= 2)::int AS low FROM app_reviews`),
  ]);
  return { rows: rows.map((r) => ({ ...r, action: ACTIONS[r.action] || r.action })), count: s.n, average: s.avg ? Number(s.avg) : null, low: s.low };
}

// "Download my data" (NDPA right of access and portability): one JSON file with
// everything the shop put in or Velo recorded. Secrets (access keys, PINs) are never included.
async function exportData(businessId) {
  const id = Number(businessId);
  const q = (sql) => db.query(sql, [id]).then((r) => r.rows);
  const [biz, users, products, orders, conversations, messages, broadcasts, payments, reviews] = await Promise.all([
    q(`SELECT id, name, business_niche, whatsapp_number, owner_number, hours, faq, tone, currency, timezone, shop_profile, greeting_msg, handoff_msg,
              plan_tier, subscription_status, subscription_expires, created_at FROM businesses WHERE id = $1`),
    q('SELECT email, verified, created_at, terms_accepted_at FROM users WHERE business_id = $1'),
    q('SELECT name, price, description, category, available, image_url, created_at FROM products WHERE business_id = $1 ORDER BY id'),
    q('SELECT receipt_no, customer_name, customer_number, channel, items, delivery_fee, delivery_note, total, currency, status, created_at, paid_at FROM orders WHERE business_id = $1 ORDER BY created_at'),
    q('SELECT id, customer_name, customer_number, channel, contact_type, created_at, updated_at FROM conversations WHERE business_id = $1 ORDER BY id'),
    q(`SELECT m.conversation_id, m.direction, m.sender, m.body, m.created_at FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE c.business_id = $1 ORDER BY m.created_at LIMIT 50000`),
    q('SELECT message, audience, channel, recipients, sent, skipped, created_at FROM broadcasts WHERE business_id = $1 ORDER BY created_at'),
    q('SELECT plan, currency, amount, method, status, created_at FROM payments WHERE business_id = $1 ORDER BY created_at'),
    q('SELECT rating, comment, created_at FROM app_reviews WHERE business_id = $1'),
  ]);
  return { exported_at: new Date().toISOString(), note: 'Your VeloSales Ai data. Payment amounts are in kobo/cents (divide by 100).', shop: biz[0] || null, logins: users, products, orders, chats: conversations, messages, broadcasts, payments, reviews };
}

module.exports = { ACTIONS, shouldAsk, markAsked, save, adminList, exportData };
