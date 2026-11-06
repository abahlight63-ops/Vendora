// ── src/services/securityLog.js ───────────────────────────────────
// WHAT: records suspicious and security-relevant events, spots attacks, and
// tells the VeloSales owner (admin console → Security, plus an email alert
// through alertService when something looks like an attack).
// Events never hold passwords, codes, tokens or message text.
//   log(kind, req, detail?, businessId?)  — fire-and-forget, never throws
// Kinds and how loud they are:
//   high:   admin_login_failed, admin_key_failed, payment_mismatch, account_locked
//   medium: login_failed, cross_site_blocked, webhook_rejected, rate_limited
//   info:   admin_login, password_reset_requested, password_changed
// An alert goes out when one IP crosses a kind's threshold inside 10 minutes,
// or at once for payment_mismatch. Same IP + kind alerts at most once an hour
// (alertService also dedupes).
const db = require('../db');

const LEVEL = {
  admin_login_failed: 'high', admin_key_failed: 'high', payment_mismatch: 'high', account_locked: 'high',
  login_failed: 'medium', cross_site_blocked: 'medium', webhook_rejected: 'medium', rate_limited: 'medium',
  admin_login: 'info', password_reset_requested: 'info', password_changed: 'info',
};
const THRESHOLD = { admin_login_failed: 3, admin_key_failed: 3, account_locked: 1, payment_mismatch: 1, login_failed: 15, cross_site_blocked: 10, webhook_rejected: 20, rate_limited: 30 };
const WINDOW_MS = 10 * 60 * 1000;
const recent = new Map(); // `${kind}|${ip}` → [timestamps]
const alerted = new Map(); // `${kind}|${ip}` → last alert time

const ipOf = (req) => String((req && (req.ip || (req.get && req.get('x-forwarded-for')))) || 'unknown').split(',')[0].trim().slice(0, 64);
const clean = (s, n) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').slice(0, n);

// Counts in memory and decides whether this event is the one that should alert. Exported for tests.
function shouldAlert(kind, ip, now = Date.now()) {
  const key = kind + '|' + ip;
  const list = (recent.get(key) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  recent.set(key, list);
  if (recent.size > 5000) recent.delete(recent.keys().next().value);
  const limit = THRESHOLD[kind];
  if (!limit || list.length < limit) return false;
  const last = alerted.get(key) || 0;
  if (now - last < 60 * 60 * 1000) return false;
  alerted.set(key, now);
  return true;
}

function log(kind, req, detail, businessId) {
  try {
    if (!LEVEL[kind]) return;
    const ip = ipOf(req);
    const path = clean(req && (req.originalUrl || req.path), 160).replace(/([?&](token|code|password|key|secret)=)[^&]*/gi, '$1***');
    const agent = clean(req && req.get && req.get('user-agent'), 160);
    const text = clean(detail, 300);
    if (process.env.NODE_ENV !== 'test') {
      db.query(
        'INSERT INTO security_events (kind, level, ip, path, agent, detail, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [kind, LEVEL[kind], ip, path, agent, text, businessId ? Number(businessId) : null]
      ).catch((e) => { if (!/does not exist/i.test(e.message)) console.error('security log error:', e.message); });
    }
    if (LEVEL[kind] !== 'info') console.warn(`SECURITY ${kind} ip=${ip} ${path} ${text}`);
    if (shouldAlert(kind, ip)) {
      const n = (recent.get(kind + '|' + ip) || []).length;
      const err = new Error(`${kind.replace(/_/g, ' ')}: ${n} in 10 minutes from ${ip}`);
      err.stack = `${err.message}\nLast: ${path} ${text}\nBrowser: ${agent}\nSee admin console → Security.`;
      require('./alertService').report('security ' + kind, err, { ip, kind });
    }
  } catch (e) { /* logging must never break a request */ }
}

// Admin console summary: counts per kind, top IPs, latest events.
async function summary(days = 7) {
  const d = Math.min(90, Math.max(1, Number(days) || 7));
  const [{ rows: kinds }, { rows: ips }, { rows: events }, { rows: [day] }] = await Promise.all([
    db.query(`SELECT kind, level, COUNT(*)::int AS n FROM security_events WHERE created_at >= now() - make_interval(days => $1) GROUP BY kind, level ORDER BY n DESC`, [d]),
    db.query(`SELECT ip, COUNT(*)::int AS n, MAX(created_at) AS last, string_agg(DISTINCT kind, ', ') AS kinds FROM security_events WHERE created_at >= now() - make_interval(days => $1) AND level <> 'info' GROUP BY ip ORDER BY n DESC LIMIT 10`, [d]),
    db.query(`SELECT e.id, e.kind, e.level, e.ip, e.path, e.detail, e.created_at, b.name AS shop FROM security_events e LEFT JOIN businesses b ON b.id = e.business_id WHERE e.created_at >= now() - make_interval(days => $1) ORDER BY e.id DESC LIMIT 200`, [d]),
    db.query(`SELECT COUNT(*) FILTER (WHERE level = 'high')::int AS high, COUNT(*) FILTER (WHERE level = 'medium')::int AS medium FROM security_events WHERE created_at >= now() - interval '24 hours'`),
  ]);
  return { days: d, kinds, ips, events, last24: day || { high: 0, medium: 0 } };
}

// Keep 90 days.
function startPrune() {
  const run = () => db.query("DELETE FROM security_events WHERE created_at < now() - interval '90 days'").catch(() => {});
  setTimeout(run, 30 * 60 * 1000);
  setInterval(run, 24 * 60 * 60 * 1000);
}

// Per-account sign-in lockout: 10 wrong passwords for one email in 15 minutes
// locks that email for 15 minutes (on top of the per-IP limit), so spreading
// guesses across many IPs does not work either.
const fails = new Map(); // email → [timestamps]
const LOCK_FAILS = 10, LOCK_MS = 15 * 60 * 1000;
function isLocked(email, now = Date.now()) {
  const list = (fails.get(String(email || '').toLowerCase()) || []).filter((t) => now - t < LOCK_MS);
  return list.length >= LOCK_FAILS;
}
function noteFailedLogin(email, now = Date.now()) {
  const key = String(email || '').toLowerCase();
  if (!key) return false;
  const list = (fails.get(key) || []).filter((t) => now - t < LOCK_MS);
  list.push(now);
  fails.set(key, list);
  if (fails.size > 20000) fails.delete(fails.keys().next().value);
  return list.length === LOCK_FAILS; // true exactly when it just locked
}
function clearFailedLogins(email) { fails.delete(String(email || '').toLowerCase()); }

module.exports = { log, summary, startPrune, shouldAlert, isLocked, noteFailedLogin, clearFailedLogins, LEVEL, _reset: () => { recent.clear(); alerted.clear(); fails.clear(); } };
