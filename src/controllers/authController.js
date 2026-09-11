// ── src/controllers/authController.js ──────────────────────────────
// WHAT: signup/login/logout/verify handlers (the LIVE versions — the same
// logic exists inline in legacy src/authRoutes.js; THESE are what server.js
// actually mounts via src/routes/authRoutes.js). Thin by design: validate →
// call authService → touch session → respond.
// MODULES: ../db (pool), ../services/authService (users), ../utils/phone.
const db = require('../db'); // shared pool
const authService = require('../services/authService'); // findUserByEmail, createUser, verifyPassword…
const { normalizePhone } = require('../utils/phone'); // destructure the phone helper

async function signup(req, res) {
  const { email, password, name, whatsapp_number: numberRaw, owner_number: ownerRaw, hours, tone } = req.body || {}; // pull + rename raw inputs (Raw = unvalidated, un-normalized)
  const number = normalizePhone(numberRaw); // → 'whatsapp:+234…' or null (accepts 0803…, spaces…)
  const owner = normalizePhone(ownerRaw); // owner's personal number (LEARN rights + alerts)
  const errors = []; // collect ALL input problems (better forms than one-at-a-time)
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Valid email required'); // simple email shape check
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters'); // length gate (scrypt hashing happens in the service)
  if (!name || typeof name !== 'string') errors.push('Business name required');
  if (!number) errors.push('Enter a valid WhatsApp number (e.g. 0803 123 4567)'); // normalizePhone already validated — null = bad
  if (ownerRaw && !owner) errors.push('Enter a valid personal WhatsApp number (e.g. 0803 123 4567)'); // owner optional, but IF given must parse
  if (errors.length) return res.status(400).json({ errors }); // 400 = client, fix your input

  try {
    const existing = await authService.findUserByEmail(email); // email taken?
    if (existing) return res.status(409).json({ error: 'An account with that email already exists' }); // 409 = Conflict

    const planService = require('../services/planService'); // lazy require (file style)
    const { rows: bRows } = await db.query( // INSERT the shop… (bRows = business rows)
      `INSERT INTO businesses (name, whatsapp_number, owner_number, hours, faq, tone, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, whatsapp_number, owner_number, hours, tone, currency`, // RETURNING hands back the new row
      [name, number, owner || number, hours || '', '[]', tone || 'friendly and helpful', planService.resolveCurrency(number, owner)] // owner falls back to shop number; faq starts '[]'; currency auto: +234→NGN else USD
    );
    const business = bRows[0]; // the new shop

    const user = await authService.createUser(business.id, email, password); // hash password + users row (+ verification email or auto-verify)
    const otp = await authService.issueOTP(email); // OTP-first registration: 6-digit code emailed (link is the FALLBACK, not the default!)…
    if (otp.auto) { // …UNLESS dev mode (no Resend key): skip the dance, log straight in (old behavior, local convenience!)
      req.session.userId = user.id; // LOGIN = write ids into the session (store persists them)…
      req.session.businessId = business.id; // …every later request reads these (that's the whole auth system!)
      return res.status(201).json({ user: { id: user.id, email: user.email }, business, auto: true }); // auto flag tells frontend: no OTP screen needed!
    }
    res.status(201).json({ needsOTP: true, email: user.email }); // NO session yet (unverified users get nothing!) — frontend shows the OTP screen (only safe fields — NEVER password_hash!)
  } catch (err) {
    if (err.code === '23505') { // Postgres UNIQUE violation (two signups racing the same number)
      return res.status(409).json({ error: 'That WhatsApp number is already registered' });
    }
    console.error('Signup error:', err); // unknown → log…
    res.status(500).json({ error: 'Internal server error' }); // …generic 500 (never leak internals)
  }
}

async function verify(req, res) {
  const user = await auth.verifyByToken(req.query.token || ''); // req.query = ?token=… from the email link; || '' guards missing
  if (user) {
    res.send(`<body style="font-family:Segoe UI,sans-serif;background:#050807;color:#ecfff6;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><img src="/logo.png" alt="" style="width:60px;border-radius:14px;background:#fff;padding:4px"/><h1 style="color:#7ef0c0;">✓ Email verified!</h1><p style="color:#8fb8ac;">Your AI sales assistant is activated. You can sign in now.</p><a href="/login" style="display:inline-block;margin-top:14px;background:#25D366;color:#04120c;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:700;">Go to sign in</a></div></body>`); // inline success page (emails link here; styles inline because it's a standalone page)
  } else {
    res.status(400).send(`<body style="font-family:Segoe UI,sans-serif;background:#050807;color:#ecfff6;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#ff9d8a;">Link invalid or expired</h1><p style="color:#8fb8ac;">Request a new verification email from the sign-in page.</p><a href="/login" style="color:#25D366;">Back to sign in</a></div></body>`); // bad/used/expired token
  }
}

async function resendVerification(req, res) {
  const { email } = req.body || {}; // which account needs another email?
  if (!email) return res.status(400).json({ error: 'Email required' }); // guard clause
  const result = await authService.resendVerification(email); // null = unknown | {already} | {sent}
  if (!result) return res.status(404).json({ error: 'No account with that email' });
  if (result.already) return res.json({ ok: true, message: 'Already verified — you can sign in.' }); // idempotent: retrying is harmless
  res.json({ ok: true, message: result.sent ? 'Verification email sent — check your inbox.' : 'Email service not configured yet; your account was auto-verified. Try signing in.' }); // ternary picks message by Resend outcome
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' }); // missing fields first…

  const user = await authService.findUserByEmail(email); // …then lookup (JOIN gives business_name too)…
  if (!user || !authService.verifyPassword(password, user.password_hash)) { // !user short-circuits (never call verifyPassword on null); SAME error for bad-email AND bad-password (don't leak which one — user enumeration defense!)
    return res.status(401).json({ error: 'Invalid email or password' }); // 401 = bad credentials
  }
  if (!user.verified) { // correct password but email unconfirmed → block with a resend hint…
    return res.status(403).json({ error: 'Please verify your email first — check your inbox for the Vendora link.', needsVerification: true, email: user.email }); // frontend shows "Resend email" on needsVerification
  }
  req.session.userId = user.id; // LOGIN: stamp the session…
  req.session.businessId = user.business_id; // …business id rides along from the JOIN
  res.json({ user: { id: user.id, email: user.email, business_name: user.business_name } }); // safe fields only
}

function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true })); // destroy = delete DB row → cookie becomes useless; reply in the callback (after deletion completes)
}

// POST /api/auth/verify-otp { email, code } — check the 6-digit code, log in on success.
async function verifyOtp(req, res) {
  const { email, code } = req.body || {}; // both required (guarded below)…
  if (!email || !code) return res.status(400).json({ error: 'Email and code required.' });
  const result = await authService.verifyOTP(email, String(code)); // service: expiry, attempts, hash compare, burn-on-success…
  if (result.already) { // already verified (double-submit / back-button) → just log them in (idempotent!)
    const user = await authService.findUserByEmail(email);
    req.session.userId = user.id;
    req.session.businessId = user.business_id;
    return res.json({ user: { id: user.id, email: user.email } });
  }
  if (!result.ok) { // wrong/expired/locked → specific message + attempts left (frontend shows resend/fallback options!)…
    if (result.expired) return res.status(400).json({ error: 'Code expired — request a new one.', expired: true });
    if (result.locked) return res.status(400).json({ error: 'Too many wrong tries — request a new code.', locked: true });
    if (typeof result.left === 'number') return res.status(400).json({ error: `Wrong code — ${result.left} ${result.left === 1 ? 'try' : 'tries'} left.`, left: result.left });
    return res.status(400).json({ error: 'Wrong code — try again.' });
  }
  const user = result.user; // verified user object (returned by the service — no second lookup!)
  req.session.userId = user.id; // LOGIN on successful verification (same session stamp as login/signup!)…
  req.session.businessId = user.business_id;
  res.json({ user: { id: user.id, email: user.email } });
}

// POST /api/auth/otp-resend { email } — fresh OTP code (burns the old one, resets attempts).
async function otpResend(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required.' });
  const result = await authService.issueOTP(email); // same issuer as signup (new code, new 10-min window!)
  if (result.reason === 'nouser') return res.status(404).json({ error: 'No account with that email.' });
  if (result.already) return res.json({ ok: true, message: 'Already verified — you can sign in.' });
  if (result.auto) return res.json({ ok: true, auto: true, message: 'Email service off (dev) — signing you in.' }); // dev: skip the code entirely
  if (!result.sent) return res.status(502).json({ error: 'Email service is down — use "send a link instead" below.' }); // honest Resend failure (points at the fallback!)
  res.json({ ok: true, message: 'New code sent — check your inbox.' });
}

// POST /api/auth/otp-link { email } — OTP fallback: "email didn't arrive? send a LINK instead" (existing token flow!).
async function otpLink(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required.' });
  const result = await authService.resendVerification(email); // reuse the LINK machinery (new token, Resend email)…
  if (!result) return res.status(404).json({ error: 'No account with that email.' });
  if (result.already) return res.json({ ok: true, message: 'Already verified — you can sign in.' });
  res.json({ ok: true, message: result.sent ? 'Link sent — check your inbox.' : 'Email service is down right now — try the code again or contact support.' }); // honest failure message (no fake "sent" when Resend is down!)
}

// POST /api/auth/forgot { email } — always { sent: true } (enumeration defense lives in the service!).
async function forgot(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required.' });
  const result = await authService.issueReset(email); // unknown emails ALSO get {sent:true} (don't leak the user list!)
  res.json({ sent: true, ...(result.devToken ? { devToken: result.devToken } : {}) }); // spread devToken ONLY in dev (real users just see "sent"!)
}

// POST /api/auth/reset { token, password } — consume reset link, set new password.
async function reset(req, res) {
  const { token, password } = req.body || {};
  const result = await authService.resetPassword(token, password); // bad/expired/weak → {ok:false} (all identical — no enumeration!)
  if (!result.ok) return res.status(400).json({ error: 'Link invalid, expired, or password too short (8+ characters).' }); // one message covers all three (deliberately vague = secure!)
  res.json({ ok: true }); // frontend routes to /login ("password set — sign in!")
}

module.exports = { signup, verify, resendVerification, login, logout, verifyOtp, otpResend, otpLink, forgot, reset }; // routes/authRoutes.js wires these five
