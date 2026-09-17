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

// Fill {name} with the shop's name (broadcast templates greet each owner
// personally — "{name}" anywhere in title/body becomes e.g. "Amaka").
function personalize(text, name) {
  return String(text || '').split('{name}').join(name || 'there');
}

// One owner. Fire-and-forget safe: failures only log (a notification must
// never break the payment flow that triggered it).
async function notify(businessId, { title, body, link, image_url, video_url }) {
  if (!businessId) return null;
  try {
    const { rows } = await db.query(
      `INSERT INTO notifications (business_id, title, body, link, image_url, video_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, body, link, image_url, video_url, is_read, created_at`,
      [
        Number(businessId),
        String(title || '').slice(0, 120),
        String(body || '').slice(0, 4000), // long-form bodies (templates run 400–600 chars!)
        String(link || '').slice(0, 200),
        image_url ? String(image_url).slice(0, 2000) : null,
        video_url ? String(video_url).slice(0, 2000) : null,
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
async function broadcast({ title, body, link, image_url, video_url }) {
  const { rows: biz } = await db.query('SELECT id, name FROM businesses');
  let n = 0;
  for (const b of biz) {
    const first = String(b.name || '').split(' ')[0] || 'there'; // first name only ("Amaka Beauty" → "Amaka")
    const r = await notify(b.id, {
      title: personalize(title, first),
      body: personalize(body, first),
      link,
      image_url,
      video_url,
    });
    if (r) n++;
  }
  return n;
}

async function list(businessId) {
  const { rows } = await db.query(
    `SELECT id, title, body, link, image_url, video_url, is_read, created_at FROM notifications
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

// Mark ONE notification read (detail page open). Returns the row (scoped to
// the owner's inbox — owners can never read another shop's mail!).
async function markOneRead(businessId, id) {
  const { rows } = await db.query(
    `UPDATE notifications SET is_read = true WHERE business_id = $1 AND id = $2
     RETURNING id, title, body, link, image_url, video_url, is_read, created_at`,
    [businessId, Number(id)]
  );
  return rows[0] || null;
}

module.exports = { notify, broadcast, list, markAllRead, markOneRead };
