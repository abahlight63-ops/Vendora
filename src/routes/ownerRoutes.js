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
router.post('/me/setup', ownerController.saveSetup); // POST = welcome niche + heard-from (no name required!)
router.get('/me/products', ownerController.getProducts); // list catalog
router.post('/me/products', ownerController.upsertProduct); // POST = add/update one product
router.post('/me/product-photo', ownerController.uploadProductPhoto); // Upload media: host a file-picker image, get back a URL
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
router.get('/me/telegram', ownerController.telegramStatus);
router.post('/me/telegram/token', ownerController.telegramToken);
router.post('/me/telegram/link', ownerController.telegramLink);
router.get('/me/channels', ownerController.channelsStatus); // Connect page: WhatsApp LIVE/OFF + channel + model (secrets never returned!)
router.put('/me/whatsapp-model', ownerController.whatsappModel); // per-shop WhatsApp brain pick (tier-gated!)
router.post('/me/channels/twilio', ownerController.twilioConnect); // step 1: validate SID/token → number picker
router.post('/me/channels/twilio/select', ownerController.twilioSelect); // step 2: adopt number + auto-set webhook
router.post('/me/channels/twilio/disconnect', ownerController.twilioDisconnect); // forget creds
router.post('/me/channels/meta', ownerController.metaConnect); // validate ID/token → arm Meta door
router.post('/me/channels/meta/disconnect', ownerController.metaDisconnect); // forget creds → Twilio door
router.post('/me/channels/meta/pull-profile', ownerController.metaPullProfile); // one-tap auto-sync (Pro!)
router.get('/me/complaints', ownerController.complaintMine);
router.post('/me/complaints', ownerController.complaintCreate); // file a support ticket (shows in Admin → Complaints)
router.get('/me/notifications', ownerController.getNotifications); // bell inbox (newest first + unread count)
router.post('/me/notifications/read', ownerController.readNotifications); // mark all read on open

module.exports = router; // server.js does app.use('/api', ownerRoutes)
