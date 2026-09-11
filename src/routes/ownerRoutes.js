// ── src/routes/ownerRoutes.js ────────────────────────────────────
// WHAT: the logged-in owner's private API (dashboard data). Mounted at /api.
// router.use(requireAuth) = EVERY route below needs login — one line guards all.
const express = require('express'); // Router class
const ownerController = require('../controllers/ownerController'); // all the handler functions
const { requireAuth } = require('../middleware/auth'); // the login guard (req.session.userId?)

const router = express.Router(); // the mini-app

router.use(requireAuth); // blanket guard: guests get 401 on everything below

router.get('/me', ownerController.getMe); // business profile + tier + ads config
router.put('/me/business', ownerController.updateBusiness); // PUT = update profile (name, hours, FAQs…)
router.get('/me/products', ownerController.getProducts); // list catalog
router.post('/me/products', ownerController.upsertProduct); // POST = add/update one product
router.delete('/me/products/:id', ownerController.deleteProduct); // :id = URL param (req.params.id)
router.get('/me/conversations', ownerController.getConversations); // inbox list (latest 100)
router.get('/me/conversations/:id/messages', ownerController.getMessages); // full thread (ownership-checked!)
router.get('/me/billing', ownerController.getBilling); // status + per-currency plans + transfer details
router.post('/me/playground', ownerController.playground); // test-bot endpoint (no WhatsApp needed)
router.put('/me/settings', ownerController.updateSettings); // SmartDeal discount guardrails
router.get('/me/profile-sync', ownerController.getProfileSync); // has the owner synced? when?
router.post('/me/profile-sync', ownerController.profileSync); // Pro: scaffold catalog from profile text
router.post('/me/ask', ownerController.ask); // Vendora AI chat (tier + caps enforced)
router.get('/me/ai-models', ownerController.aiModels); // dropdown list with locked flags
router.post('/me/ads/click', ownerController.adClick);
router.post('/me/bot', ownerController.botToggle);
router.post('/me/conversations/:id/takeover', ownerController.chatTakeover);
router.get('/me/complaints', ownerController.complaintMine);
router.post('/me/complaints', ownerController.complaintCreate); // log a sponsor click (per-click billing)

module.exports = router; // server.js does app.use('/api', ownerRoutes)
