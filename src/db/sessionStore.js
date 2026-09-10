// ── src/db/sessionStore.js ─────────────────────────────────────────
// WHAT: stores login sessions in Postgres instead of server memory.
// WHY: express-session's default MemoryStore forgets everyone on restart
// and leaks memory — DB sessions survive deploys and work with 2+ servers.
// MODULE: `express-session` — installed via `npm i express-session`. We
// import its base `Store` class and extend it (object-oriented inheritance).
const { Store } = require('express-session'); // base class we must subclass
const db = require('./index'); // our shared Postgres pool from db/index.js

/**
 * Minimal Postgres-backed session store for express-session.
 * Sessions survive server restarts (unlike the default MemoryStore).
 */
class PgSessionStore extends Store { // `extends` = inherit get/set/destroy contract
  constructor() {
    super(); // must call parent constructor first (JS rule for subclasses)
    this._ok = false; // becomes true once the sessions table exists
    // cleanup expired sessions every hour
    setInterval(() => {
      // fire-and-forget delete; .catch(()=>{}) swallows errors (best-effort janitor)
      db.query("DELETE FROM sessions WHERE expires < now()").catch(() => {});
    }, 60 * 60 * 1000).unref(); // .unref() = don't keep the process alive just for this timer
  }
  // Self-healing init: a boot-time network blip must not break sessions forever.
  // init is retried on every call until it succeeds once.
  async _ready() {
    if (this._ok) return; // table already confirmed — skip the work
    try {
      // CREATE TABLE IF NOT EXISTS = safe to run on every boot (a migration in code)
      await db.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY, // session id = the random string in the cookie
          sess JSONB NOT NULL, // the session object (userId, businessId…) as JSON
          expires TIMESTAMPTZ NOT NULL // when the cookie/session dies
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
      `);
      this._ok = true; // mark ready so future calls skip table creation
    } catch (e) {
      console.error('Session table init failed (will retry):', e.message);
      throw e; // re-throw so get/set/destroy know init failed
    }
  }
  // Called by express-session on every request with a session cookie.
  async get(sid, cb) {
    try { await this._ready(); } catch (e) { return cb(e); } // init failed → report error via callback
    try {
      // fetch session JSON, but only if it hasn't expired yet
      const { rows } = await db.query('SELECT sess FROM sessions WHERE sid = $1 AND expires > now()', [sid]);
      cb(null, rows[0] ? rows[0].sess : null); // cb(error, session) — null = "no session, treat as guest"
    } catch (e) { cb(e); }
  }
  // Called when session data changes (login writes userId here).
  async set(sid, sess, cb) {
    try { await this._ready(); } catch (e) { if (cb) cb(e); return; }
    // cookie.maxAge tells us how long "remember me" lasts; default 7 days
    const maxAge = (sess.cookie && sess.cookie.maxAge) || 7 * 24 * 60 * 60 * 1000;
    try {
      await db.query(
        // UPSERT: insert new row, or overwrite if this sid already exists
        `INSERT INTO sessions (sid, sess, expires) VALUES ($1, $2, now() + make_interval(secs => $3))
         ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expires = EXCLUDED.expires`,
        [sid, JSON.stringify(sess), maxAge / 1000] // EXCLUDED = the row we tried to insert
      );
      cb && cb(null); // `cb &&` guards: callback is optional in express-session
    } catch (e) { cb && cb(e); }
  }
  // Called on logout — delete the row so the cookie becomes useless.
  async destroy(sid, cb) {
    try { await this._ready(); } catch (e) { if (cb) cb(e); return; }
    try {
      await db.query('DELETE FROM sessions WHERE sid = $1', [sid]);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
}

module.exports = PgSessionStore; // server.js does `new PgSessionStore()` for session({store})
