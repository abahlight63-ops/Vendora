// ── src/controllers/accountController.js ──────────────────────────
// POST /me/account/delete { password? | confirmName? } → deletes the account, signs out.
const privacy = require('../services/privacyService');
async function remove(req, res) {
  try {
    await privacy.deleteAccount(req.session.businessId, req.body || {});
    req.session.destroy(() => res.json({ ok: true }));
  } catch (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message });
    console.error('account delete failed:', e.message);
    res.status(500).json({ error: 'Something went wrong. Please try again or email velosales63@gmail.com.' });
  }
}
module.exports = { remove };
