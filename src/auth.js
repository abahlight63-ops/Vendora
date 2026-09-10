// ── src/auth.js ──────────────────────────────────────────────────
// WHAT: a compatibility shortcut ("umbrella") from an older code layout.
// HISTORY LESSON: auth code used to live in this ONE file. During a refactor
// it was split into focused files (services/authService.js, middleware/auth.js,
// db/sessionStore.js). Instead of updating every `require('./auth')` call site,
// this file re-exports everything under the OLD name — the Adapter pattern.
// No npm module — just re-exports.

/**
 * ── Auth umbrella (kept for legacy top-level imports) ──────────────────
 * During the codebase refactor, auth was split into:
 *   · src/services/authService.js  → password & user functions
 *   · src/middleware/auth.js       → requireAuth middleware
 *   · src/db/sessionStore.js       → PgSessionStore
 *   · src/services/configService.js → USERS_TABLE schema
 * This module re-exposes them under the old single `require('./auth')`
 * interface so existing call sites keep working unchanged.
 */
const authService = require('./services/authService'); // {hashPassword, verifyPassword, findUserByEmail, createUser, …}
const { requireAuth } = require('./middleware/auth'); // destructure = pull one named export out
const PgSessionStore = require('./db/sessionStore'); // session store class
const { USERS_TABLE } = require('./services/configService'); // SQL for the users table

module.exports = {
  ...authService, // spread = copy ALL of authService's exports into this object
  requireAuth, // shorthand = { requireAuth: requireAuth }
  PgSessionStore,
  USERS_TABLE,
};
