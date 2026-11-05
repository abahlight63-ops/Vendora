// ── src/controllers/friendsController.js ──────────────────────────
// WHAT: the owner's friends and family list (AI settings → Friends and family).
// Velo never sends a sales reply to these WhatsApp numbers.
//   GET    /me/friends            → { friends: [{ id, phone, name }], max }
//   POST   /me/friends            { contacts: [{ name, phone }] } → { added, already, skipped, chatsMarked, total }
//   DELETE /me/friends/:id        → { ok }
//   POST   /me/friends/clear      → { removed }
const contacts = require('../services/contactService');

const fail = (res, e, what) => {
  if (e && e.status) return res.status(e.status).json({ error: e.message });
  console.error(what + ' failed:', (e && e.code) || '-', e && e.message);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

async function list(req, res) {
  try { res.json({ friends: await contacts.listFriends(req.session.businessId), max: contacts.MAX_FRIENDS }); }
  catch (e) { fail(res, e, 'friends list'); }
}

async function add(req, res) {
  try {
    const out = await contacts.importFriends(req.session.businessId, req.body && req.body.contacts);
    const total = (await contacts.listFriends(req.session.businessId)).length;
    res.json({ ...out, total });
  } catch (e) { fail(res, e, 'friends import'); }
}

async function remove(req, res) {
  try {
    if (!(await contacts.removeFriend(req.session.businessId, req.params.id))) return res.status(404).json({ error: 'That person is not on your list.' });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'friend remove'); }
}

async function clear(req, res) {
  try { res.json({ removed: await contacts.clearFriends(req.session.businessId) }); }
  catch (e) { fail(res, e, 'friends clear'); }
}

module.exports = { list, add, remove, clear };
