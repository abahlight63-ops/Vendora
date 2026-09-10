// ── src/middleware/auth.js ─────────────────────────────────────────
// WHAT: a guard that blocks not-logged-in users from private API routes.
// HOW Express middleware works: functions with (req, res, next). Call next()
// to continue to the route, or send a response to STOP the request here.
// No npm module — plain Express pattern.

/**
 * Middleware to require authentication for routes.
 */
function requireAuth(req, res, next) {
  // req.session exists because express-session ran earlier (see server.js order).
  // We wrote userId there at login/signup — its presence = "logged in".
  if (req.session && req.session.userId) return next(); // logged in → continue to route handler
  res.status(401).json({ error: 'Not signed in' }); // guest → stop with 401 Unauthorized
}

module.exports = { requireAuth }; // used as router.use(requireAuth) in ownerRoutes/billingRoutes
