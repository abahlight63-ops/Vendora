// ── src/controllers/adminConsoleController.js ─────────────────────
// WHAT: the new admin console API (all behind requireAdmin, see adminRoutes.js).
const consoleService = require('../services/adminConsole');
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message });
    console.error('admin console error:', (e && e.code) || '-', e && e.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
module.exports = {
  overview: wrap(async (req, res) => res.json(await consoleService.overview(req.query.days))),
  shops: wrap(async (req, res) => res.json(await consoleService.shops({ filter: req.query.filter, q: req.query.q }))),
  shop: wrap(async (req, res) => { const s = await consoleService.shop(req.params.id); if (!s) return res.status(404).json({ error: 'Shop not found.' }); res.json(s); }),
  action: wrap(async (req, res) => res.json({ ok: true, message: await consoleService.action(req.params.id, req.body || {}) })),
  waitlist: wrap(async (req, res) => res.json({ rows: await consoleService.waitlist() })),
  aiUsage: wrap(async (req, res) => res.json(await consoleService.aiUsage(req.query.days))),
  activity: wrap(async (req, res) => res.json({ rows: await consoleService.activity() })),
};
