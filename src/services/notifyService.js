// ── src/services/notifyService.js ────────────────────────────────
// WHAT: in-app notifications — the bell in the topbar. Two producers:
//   1. Payment events (auto): transfer reported / verified / rejected,
//      Paystack charge success → the affected owner gets told, no polling
//      WhatsApp needed.
//   2. App updates (manual): admin posts ONE broadcast → every business gets
//      a copy ("New: smarter Vendora AI answers — see what's new").
// Shape: one row per business (fan-out on broadcast). Frontend polls
// GET /api/me/notifications (cheap indexed query, 60s interval).
const db = require('../db');

const MAX_PER_BIZ = 50; // inbox cap — oldest pruned (keeps the bell fast forever)

async function prune(businessId) {
  await db.query(
    `DELETE FROM notifications WHERE business_id = $1 AND id NOT IN
     (SELECT id FROM notifications WHERE business_id = $1 ORDER BY id DESC LIMIT ${MAX_PER_BIZ})`,
    [businessId]
  );
}

// One owner. Fire-and-forget safe: failures only log (a notification must
// never break the payment flow that triggered it).
async function notify(businessId, { title, body, link }) {
  if (!businessId) return null;
  try {
    const { rows } = await db.query(
      `INSERT INTO notifications (business_id, title, body, link)
       VALUES ($1, $2, $3, $4) RETURNING id, title, body, link, is_read, created_at`,
      [
        Number(businessId),
        String(title || '').slice(0, 120),
        String(body || '').slice(0, 500),
        String(link || '').slice(0, 200),
      ]
    );
    prune(Number(businessId)).catch(() => {});
    return rows[0];
  } catch (e) {
    console.error('notify error:', e.message);
    return null;
  }
}

// Every business gets a copy. Returns how many inboxes were filled.
async function broadcast({ title, body, link }) {
  const { rows: biz } = await db.query('SELECT id FROM businesses');
  let n = 0;
  for (const b of biz) {
    const r = await notify(b.id, { title, body, link });
    if (r) n++;
  }
  return n;
}

async function list(businessId) {
  const { rows } = await db.query(
    `SELECT id, title, body, link, is_read, created_at FROM notifications
     WHERE business_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [businessId]
  );
  const { rows: c } = await db.query(
    'SELECT COUNT(*)::int AS n FROM notifications WHERE business_id = $1 AND is_read = false',
    [businessId]
  );
  return { items: rows, unread: c[0] ? c[0].n : 0 };
}

async function markAllRead(businessId) {
  await db.query(
    'UPDATE notifications SET is_read = true WHERE business_id = $1 AND is_read = false',
    [businessId]
  );
  return true;
}

module.exports = { notify, broadcast, list, markAllRead };
