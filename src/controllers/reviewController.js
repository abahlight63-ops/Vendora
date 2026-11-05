// ── src/controllers/reviewController.js ───────────────────────────
//   GET  /me/review/should?action=  → { ask }   (and records that we asked)
//   POST /me/review { rating, comment?, action? }
//   POST /me/review/skip
//   GET  /me/export                 → my data as a JSON file (NDPA)
const reviews = require('../services/reviewService');
const fail = (res, e, what) => { if (e && e.status) return res.status(e.status).json({ error: e.message }); console.error(what + ' failed:', e && e.message); res.status(500).json({ error: 'Something went wrong. Please try again.' }); };
module.exports = {
  should: async (req, res) => { try { const ask = await reviews.shouldAsk(req.session.businessId, String(req.query.action || '')); if (ask) await reviews.markAsked(req.session.businessId); res.json({ ask }); } catch (e) { fail(res, e, 'review should'); } },
  save: async (req, res) => { try { await reviews.save(req.session.businessId, req.body || {}); res.json({ ok: true }); } catch (e) { fail(res, e, 'review save'); } },
  skip: async (req, res) => { try { await reviews.markAsked(req.session.businessId); res.json({ ok: true }); } catch (e) { fail(res, e, 'review skip'); } },
  exportData: async (req, res) => {
    try {
      const data = await reviews.exportData(req.session.businessId);
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="velosales-my-data-' + new Date().toISOString().slice(0, 10) + '.json"');
      res.send(JSON.stringify(data, null, 2));
    } catch (e) { fail(res, e, 'export'); }
  },
};
