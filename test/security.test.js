// Security tests: each one attacks a protection and checks it holds.
// Uses fake requests and a fake database — nothing real is touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---------- fake database (for auth + upload code) ----------
const fakeDb = { rows: {}, updates: [], query: async (sql, args) => {
  if (/FROM users u\s+JOIN businesses/.test(sql)) return { rows: fakeDb.rows.user ? [fakeDb.rows.user] : [] };
  if (/SELECT otp_hash, otp_expires, otp_attempts/.test(sql)) return { rows: [fakeDb.rows.otp || {}] };
  if (/^\s*UPDATE users/.test(sql) || /DELETE FROM sessions/.test(sql)) { fakeDb.updates.push(sql.trim().slice(0, 60)); return { rows: [], rowCount: 0 }; }
  return { rows: [] };
} };
const dbPath = require.resolve(path.join(__dirname, '../src/db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

const sec = require('../src/middleware/security');
const securityLog = require('../src/services/securityLog');

// tiny Express-like request/response doubles
function req({ method = 'GET', path: p = '/api/x', headers = {}, ip = '9.9.9.9', session = {}, body = {} } = {}) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method, path: p, originalUrl: p, headers: h, ip, protocol: 'http', session, body, get: (k) => h[String(k).toLowerCase()] };
}
function res() {
  const r = { statusCode: 200, headers: {}, body: null, redirectedTo: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r; r.send = () => r;
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.redirect = (c, u) => { r.statusCode = c; r.redirectedTo = u; return r; };
  return r;
}
const run = (mw, rq) => { const rs = res(); let passed = false; mw(rq, rs, () => { passed = true; }); return { passed, rs }; };

test('CSRF: a POST from another website is blocked', () => {
  const { passed, rs } = run(sec.sameSiteGuard, req({ method: 'POST', headers: { origin: 'https://evil.example' } }));
  assert.equal(passed, false); assert.equal(rs.statusCode, 403);
});
test('CSRF: no Origin but a foreign Referer is blocked', () => {
  assert.equal(run(sec.sameSiteGuard, req({ method: 'POST', headers: { referer: 'https://evil.example/page' } })).passed, false);
});
test('CSRF: browser says cross-site (no Origin/Referer) is blocked', () => {
  assert.equal(run(sec.sameSiteGuard, req({ method: 'DELETE', headers: { 'sec-fetch-site': 'cross-site' } })).passed, false);
});
test('CSRF: our own site, the phone app and GET requests pass', () => {
  assert.equal(run(sec.sameSiteGuard, req({ method: 'POST', headers: { origin: 'https://app.velosalesai.com.ng' } })).passed, true);
  assert.equal(run(sec.sameSiteGuard, req({ method: 'POST' })).passed, true); // no browser headers = not a forged browser request
  assert.equal(run(sec.sameSiteGuard, req({ method: 'GET', headers: { origin: 'https://evil.example' } })).passed, true);
});

test('HTTPS: on the live server, http pages redirect and http data is refused', () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try {
    const g = run(sec.forceHttps, req({ method: 'GET', path: '/login', headers: { host: 'app.velosalesai.com.ng', 'x-forwarded-proto': 'http' } }));
    assert.equal(g.rs.statusCode, 301); assert.equal(g.rs.redirectedTo, 'https://app.velosalesai.com.ng/login');
    const p = run(sec.forceHttps, req({ method: 'POST', path: '/api/auth/login', headers: { host: 'x', 'x-forwarded-proto': 'http' } }));
    assert.equal(p.passed, false); assert.equal(p.rs.statusCode, 403);
    assert.equal(run(sec.forceHttps, req({ path: '/api/me', headers: { host: 'x', 'x-forwarded-proto': 'https' } })).passed, true);
    assert.equal(run(sec.forceHttps, req({ path: '/health', headers: { host: 'x', 'x-forwarded-proto': 'http' } })).passed, true); // host health checks still work
  } finally { process.env.NODE_ENV = old; }
});

test('Headers: API answers can never run code; pages get the strict policy; HSTS on https', () => {
  const api = run(sec.secureHeaders, req({ path: '/api/me', headers: { 'x-forwarded-proto': 'https' } })).rs.headers;
  assert.match(api['content-security-policy'], /default-src 'none'/);
  assert.equal(api['x-content-type-options'], 'nosniff');
  assert.equal(api['x-frame-options'], 'SAMEORIGIN');
  assert.match(api['strict-transport-security'], /max-age=31536000/);
  assert.equal(api['cache-control'], 'no-store');
  const page = run(sec.secureHeaders, req({ path: '/dashboard' })).rs.headers;
  assert.match(page['content-security-policy'], /script-src 'self' https:\/\/accounts\.google\.com https:\/\/connect\.facebook\.net;/);
  assert.match(page['content-security-policy'], /object-src 'none'/);
  assert.doesNotMatch(page['content-security-policy'], /unsafe-eval|script-src[^;]*unsafe-inline/);
});

test('Rate limit: the 6th request in the window gets 429', () => {
  const lim = sec.rateLimit({ windowMs: 60000, max: 5 });
  const results = Array.from({ length: 6 }, () => run(lim, req({ ip: '7.7.7.7' })));
  assert.deepEqual(results.map((r) => r.passed), [true, true, true, true, true, false]);
  assert.equal(results[5].rs.statusCode, 429);
  assert.equal(run(lim, req({ ip: '8.8.8.8' })).passed, true); // other people are not affected
});

test('Account takeover fix: a verified account is NOT accepted without the right code', async () => {
  const auth = require('../src/services/authService');
  fakeDb.rows.user = { id: 5, email: 'owner@shop.ng', verified: true, business_id: 9 };
  fakeDb.rows.otp = { otp_hash: null, otp_expires: null, otp_attempts: 0 }; // no active code
  const r = await auth.verifyOTP('owner@shop.ng', '000000');
  assert.equal(r.ok, false, 'must not be ok without a valid code');
  assert.equal(r.user, undefined);
  fakeDb.rows.otp = { otp_hash: auth.hashPassword('123456'), otp_expires: new Date(Date.now() + 60000), otp_attempts: 0 };
  assert.equal((await auth.verifyOTP('owner@shop.ng', '999999')).ok, false, 'wrong code refused');
  assert.equal((await auth.verifyOTP('owner@shop.ng', '123456')).ok, true, 'right code accepted');
});

test('Account takeover fix: /verify-otp and /reset-otp give no session and change no password with a bad code', async () => {
  const ctl = require('../src/controllers/authController');
  securityLog._reset();
  fakeDb.rows.user = { id: 5, email: 'owner@shop.ng', verified: true, business_id: 9 };
  fakeDb.rows.otp = { otp_hash: null, otp_expires: null, otp_attempts: 0 };
  const s1 = {}; const r1 = res();
  await ctl.verifyOtp(req({ method: 'POST', body: { email: 'owner@shop.ng', code: '000000' }, session: s1 }), r1);
  assert.equal(r1.statusCode, 400); assert.equal(s1.userId, undefined, 'no sign-in');
  fakeDb.updates = [];
  const r2 = res();
  await ctl.resetOtp(req({ method: 'POST', body: { email: 'owner@shop.ng', code: '000000', password: 'hacked-password' } }), r2);
  assert.equal(r2.statusCode, 400);
  assert.equal(fakeDb.updates.some((u) => /password_hash/.test(u)), false, 'password not changed');
});

test('Lockout: 10 wrong attempts lock that account for 15 minutes, from any IP', () => {
  securityLog._reset();
  const t = 1_000_000;
  for (let i = 0; i < 9; i++) securityLog.noteFailedLogin('a@b.ng', t + i);
  assert.equal(securityLog.isLocked('a@b.ng', t + 10), false);
  assert.equal(securityLog.noteFailedLogin('A@B.NG', t + 11), true, 'locks on the 10th (case-insensitive)');
  assert.equal(securityLog.isLocked('a@b.ng', t + 12), true);
  assert.equal(securityLog.isLocked('a@b.ng', t + 15 * 60 * 1000 + 20), false, 'unlocks after 15 minutes');
  securityLog._reset();
});

test('Alerts: an attack pattern alerts once, not on every event', () => {
  securityLog._reset();
  const t = 5_000_000;
  const fired = [1, 2, 3, 4].map((i) => securityLog.shouldAlert('admin_login_failed', '6.6.6.6', t + i));
  assert.deepEqual(fired, [false, false, true, false]); // 3 wrong admin passwords → one alert
  assert.equal(securityLog.shouldAlert('payment_mismatch', '1.1.1.1', t), true); // payment problems alert at once
  securityLog._reset();
});

test('Reset links: only a fingerprint is stored, and it is not the link itself', () => {
  const { tokenHash } = require('../src/services/authService');
  const token = 'a'.repeat(64);
  assert.equal(tokenHash(token), tokenHash(token));
  assert.notEqual(tokenHash(token), token);
  assert.equal(tokenHash(token).length, 64);
});

test('Payments: short or wrong-currency payments never activate a plan', () => {
  const { _paystackAmountOk: ok } = require('../src/controllers/billingController');
  assert.equal(ok('pro_monthly', 'NGN', 749900, 0), true);
  assert.equal(ok('pro_monthly', 'NGN', 100, 0), false, 'paid ₦1');
  assert.equal(ok('pro_monthly', 'NGN', 599900, 150000), true, 'credit covers the rest');
  assert.equal(ok('pro_monthly', 'NGN', 100, 99999999), false, 'a card payment must still pay the minimum, whatever credit is claimed');
  assert.equal(ok('pro_monthly', 'GHS', 749900, 0), false, 'unknown currency');
  assert.equal(ok('made_up_plan', 'NGN', 99999999, 0), false, 'unknown plan');
});

test('Admin payment check flags a short payment', () => {
  const { judge } = require('../src/services/paymentCheck');
  const PLANS = { pro_monthly: { NGN: 7499, USD: 5 } };
  assert.equal(judge({ plan: 'pro_monthly', currency: 'NGN', amount: 749900, method: 'paystack' }, PLANS).verdict, 'ok');
  assert.equal(judge({ plan: 'pro_monthly', currency: 'NGN', amount: 5000, method: 'paystack' }, PLANS).verdict, 'short');
  assert.equal(judge({ plan: 'nope', currency: 'NGN', amount: 5000, method: 'paystack' }, PLANS).verdict, 'check');
});

test('XSS: notices can only link inside the app or to https', () => {
  const { safeLink, safeMedia } = require('../src/services/notifyService');
  assert.equal(safeLink('javascript:alert(1)'), '');
  assert.equal(safeLink('  JavaScript:alert(1)'), '');
  assert.equal(safeLink('data:text/html,<script>'), '');
  assert.equal(safeLink('//evil.example'), '');
  assert.equal(safeLink('/chats?c=4'), '/chats?c=4');
  assert.equal(safeMedia('javascript:x'), null);
});

test('Admin lock: wrong or short admin keys are refused; an idle admin session expires', () => {
  const { requireAdmin } = require('../src/controllers/adminController');
  const old = process.env.ADMIN_API_KEY;
  try {
    process.env.ADMIN_API_KEY = 'short-key';
    assert.equal(run(requireAdmin, req({ headers: { 'x-admin-key': 'short-key' } })).passed, false, 'short keys never work');
    process.env.ADMIN_API_KEY = 'k'.repeat(40);
    assert.equal(run(requireAdmin, req({ headers: { 'x-admin-key': 'k'.repeat(39) + 'x' } })).passed, false);
    assert.equal(run(requireAdmin, req({ headers: { 'x-admin-key': 'k'.repeat(40) } })).passed, true);
    const idle = { isAdmin: true, adminAt: Date.now() - 31 * 60 * 1000 };
    assert.equal(run(requireAdmin, req({ session: idle })).passed, false, '31 minutes idle → signed out');
    assert.equal(idle.isAdmin, false);
    assert.equal(run(requireAdmin, req({ session: { isAdmin: true, adminAt: Date.now() } })).passed, true);
    assert.equal(run(requireAdmin, req({ session: { userId: 1, businessId: 2 } })).passed, false, 'shop owners are not admins');
  } finally { process.env.ADMIN_API_KEY = old; }
});

test('Uploads: a renamed program and an oversized image are refused', async () => {
  const media = require('../src/services/mediaStore');
  const exe = 'data:image/png;base64,' + Buffer.from('MZ\x90\x00 this is a windows program').toString('base64');
  const refused = async (dataUrl) => { try { const r = await media.saveUpload({ dataUrl, prefix: 't', businessId: 1, allowVideo: false }); return !!(r && r.error); } catch (e) { return e.status === 400 || /image|large|send/i.test(e.message); } };
  assert.ok(await refused(exe), 'fake PNG (really a program) refused');
  const big = Buffer.alloc(3 * 1024 * 1024); big.write('\x89PNG', 0, 'binary');
  assert.ok(await refused('data:image/png;base64,' + big.toString('base64')), '3MB image refused');
  assert.ok(await refused('data:image/svg+xml;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64')), 'SVG (can carry scripts) refused');
  assert.ok(await refused('data:video/mp4;base64,AAAAIGZ0eXBpc29t'), 'video refused where only photos are allowed');
});
