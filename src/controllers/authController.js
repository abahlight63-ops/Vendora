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
    req.session.userId = user.id; // LOGIN = write ids into the session (store persists them)…
    req.session.businessId = business.id; // …every later request reads these (that's the whole auth system!)
    res.status(201).json({ user: { id: user.id, email: user.email }, business }); // 201 = Created (only safe fields — NEVER password_hash!)
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

module.exports = { signup, verify, resendVerification, login, logout }; // routes/authRoutes.js wires these five
