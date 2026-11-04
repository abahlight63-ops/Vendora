// ── src/controllers/broadcastController.js ────────────────────────
// WHAT: the owner's broadcasts API (under /api, login required).
//   GET  /me/broadcasts/preview  ?audience=&channel=   → who would get it, limits
//   GET  /me/broadcasts                                → last 50 with counts
//   POST /me/broadcasts  { message, audience, channel, waTemplate?, waLang? } → starts sending
const db = require('../db');
const broadcasts = require('../services/broadcastService');

const fail = (res, e, what) => {
  if (e && e.status) return res.status(e.status).json({ error: e.message });
  console.error(what + ' failed:', (e && e.code) || '-', e && e.message);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
const shop = async (id) => { const { rows } = await db.query('SELECT * FROM businesses WHERE id = $1', [Number(id)]); return rows[0]; };

async function preview(req, res) {
  try { res.json(await broadcasts.preview(await shop(req.session.businessId), req.query.audience, req.query.channel)); } catch (e) { fail(res, e, 'broadcast preview'); }
}
async function list(req, res) {
  try { res.json({ broadcasts: await broadcasts.list(req.session.businessId) }); } catch (e) { fail(res, e, 'broadcast list'); }
}
async function create(req, res) {
  try { res.status(201).json({ broadcast: await broadcasts.start(await shop(req.session.businessId), req.body || {}) }); } catch (e) { fail(res, e, 'broadcast start'); }
}

module.exports = { preview, list, create };
