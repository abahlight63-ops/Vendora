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

module.exports = router;
