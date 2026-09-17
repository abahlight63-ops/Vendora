// ── src/routes/adminRoutes.js ────────────────────────────────────
// WHAT: super-admin URLs (manage ANY business). Mounted at /api by server.js,
// but server.js ALSO wraps them in an admin-key check — so these routes only
// run with header `x-admin-key: <ADMIN_API_KEY>` (or owner session for /me).
const express = require('express'); // Router class
const adminController = require('../controllers/adminController'); // CRUD + ad stats handlers

const router = express.Router(); // the mini-app

router.get('/businesses', adminController.listBusinesses); // list every business (support view)
router.get('/businesses/:id', adminController.getBusiness); // inspect one business
router.post('/businesses', adminController.createBusiness); // create manually (no signup flow)
router.put('/businesses/:id', adminController.updateBusiness); // edit any business
router.get('/businesses/:id/products', adminController.listBusinessProducts); // inspect a catalog
router.delete('/businesses/:id', adminController.deleteBusiness); // remove a business
router.get('/ads/stats', adminController.adStats); // per-click earnings totals (your revenue!)
router.get('/ads/status', adminController.requireAdmin, adminController.adsStatus); // env-key diagnostics (booleans only — key VALUES never leave the server!)
router.get('/ai-status', adminController.requireAdmin, adminController.aiStatus); // AI health ping per provider (admin diagnosis!)
// Admin console (session-password OR x-admin-key — requireAdmin decides per route)
router.get('/stats', adminController.requireAdmin, adminController.adminStats); // overview cards (users, tiers, money, chats, complaints)
router.get('/users', adminController.requireAdmin, adminController.adminUsers); // every account + shop (newest first)
router.post('/users/:id/verify', adminController.requireAdmin, adminController.adminVerifyUser); // manual email verify (support action)
router.get('/transfers', adminController.requireAdmin, adminController.transferQueue); // pending bank transfers (FIFO)
router.post('/transfers/:id/approve', adminController.requireAdmin, adminController.transferApprove); // confirm credit → activate (+days)
router.post('/transfers/:id/reject', adminController.requireAdmin, adminController.transferReject); // no credit → rejected (shop falls back to free)
router.get('/complaints', adminController.requireAdmin, adminController.complaintList); // support tickets (open first)
router.post('/complaints/:id/reply', adminController.requireAdmin, adminController.complaintReply); // answer (stored + emailed)
router.post('/complaints/:id/resolve', adminController.requireAdmin, adminController.complaintResolve); // close without reply
router.post('/broadcast', adminController.requireAdmin, adminController.broadcast); // app-update notice → every owner's bell
router.post('/notify', adminController.requireAdmin, adminController.notifyUser); // warning/notice → ONE owner's bell (business id, email, or WhatsApp number)
router.get('/templates', adminController.requireAdmin, adminController.templateList); // 12 built-ins + your customs
router.post('/templates', adminController.requireAdmin, adminController.templateCreate); // save your own template
router.put('/templates/:id', adminController.requireAdmin, adminController.templateUpdate); // edit your template
router.delete('/templates/:id', adminController.requireAdmin, adminController.templateDelete); // delete your template
router.post('/media', adminController.requireAdmin, adminController.uploadMedia); // host a notice photo/mp4

module.exports = router;
