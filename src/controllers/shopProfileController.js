// ── src/controllers/shopProfileController.js ──────────────────────
// WHAT: Settings → Your shop (the Shop profile).
//   GET  /me/shop-profile        → { name, niche, hours, faq, profile, questions, meter, … }
//   PUT  /me/shop-profile        { name?, niche?, hours?, faq?, profile? } → same shape, saved
//   POST /me/shop-profile/fill   → { suggestions[] } drafted from WhatsApp profile, catalog, replies (nothing saved)
const shopProfile = require('../services/shopProfile');
const fail = (res, e, what) => {
  if (e && e.status) return res.status(e.status).json({ error: e.message });
  console.error(what + ' failed:', (e && e.code) || '-', e && e.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
module.exports = {
  get: async (req, res) => { try { const b = await shopProfile.load(req.session.businessId); if (!b) return res.status(404).json({ error: 'Shop not found.' }); res.json(shopProfile.view(b)); } catch (e) { fail(res, e, 'shop profile get'); } },
  save: async (req, res) => { try { res.json(await shopProfile.save(req.session.businessId, req.body || {})); } catch (e) { fail(res, e, 'shop profile save'); } },
  fill: async (req, res) => { try { res.json(await shopProfile.fill(req.session.businessId)); } catch (e) { fail(res, e, 'shop profile fill'); } },
};
