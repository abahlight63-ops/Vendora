// ── src/authRoutes.js ────────────────────────────────────────────
// ⚠️ LEGACY FILE — NOT USED by the running app. Live auth is split into
// src/routes/authRoutes.js + src/controllers/authController.js (mounted by
// server.js at /api/auth). This older copy defines everything inline —
// including owner /me routes that now live in ownerRoutes.js. Read to learn
// auth patterns; EDIT the live files.
// MODULES: express (Router), ./db (pool), ./auth (legacy umbrella),
// ./services/productService (catalog reads).
const express = require('express'); // Router class
const db = require('./db'); // shared pool
const auth = require('./auth'); // legacy umbrella: findUserByEmail, createUser, verifyPassword, requireAuth…
const productService = require('./services/productService'); // catalog helper

const router = express.Router(); // the mini-app

const WA_RE = /^whatsapp:\+\d{6,20}$/; // regex reused below: strict whatsapp:+… number format

// ---- Signup: creates business + owner account, starts session ----
router.post('/signup', async (req, res) => {
  const { email, password, name, whatsapp_number: number, owner_number: owner, hours, tone } = req.body || {}; // pull fields; rename numbers for clarity
  const errors = []; // collect ALL problems (better UX than one-at-a-time)
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Valid email required'); // simple email regex: something@something.something
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters'); // length rule (hashing happens later)
  if (!name || typeof name !== 'string') errors.push('Business name required');
  if (!number || !WA_RE.test(number)) errors.push('whatsapp_number must be in the format whatsapp:+2348012345678');
  if (owner && !WA_RE.test(owner)) errors.push('owner_number must be in the format whatsapp:+2348012345678'); // owner optional
  if (errors.length) return res.status(400).json({ errors }); // 400 = fix your input

  try {
    const existing = await auth.findUserByEmail(email); // is this email taken?
    if (existing) return res.status(409).json({ error: 'An account with that email already exists' }); // 409 = Conflict

    const { rows: bRows } = await db.query( // INSERT business… (bRows = "business rows")
      `INSERT INTO businesses (name, whatsapp_number, owner_number, hours, faq, tone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, whatsapp_number, owner_number, hours, tone`, // RETURNING hands back the new row
      [name, number, owner || number, hours || '', '[]', tone || 'friendly and helpful'] // owner defaults to the business number; faq starts as empty JSON array
    );
    const business = bRows[0]; // the newly created business

    const user = await auth.createUser(business.id, email, password); // hash password + row in users (+ verification email)
    req.session.userId = user.id; // writing to req.session SAVES into the session store…
    req.session.businessId = business.id; // …so the next request knows who's logged in (THIS is "login")
    res.status(201).json({ user: { id: user.id, email: user.email }, business }); // 201 = Created
  } catch (err) {
    if (err.code === '23505') { // Postgres UNIQUE violation (two signups racing same number)
      return res.status(409).json({ error: 'That WhatsApp number is already registered' });
    }
    throw err; // unknown → Express 500 handler
  }
});

// ---- Verify email (clicked from Resend email) ----
router.get('/verify', async (req, res) => { // GET because it comes from an email LINK (?token=…)
  const user = await auth.verifyByToken(req.query.token || ''); // req.query = ?key=value params; || '' guards missing
  if (user) {
    // inline HTML success page (backtick template string = multi-line HTML in JS):
    res.send(`<body style="font-family:Segoe UI,sans-serif;background:#050807;color:#ecfff6;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><img src="/logo.png?v=2" alt="" style="width:60px;border-radius:14px;background:#fff;padding:4px"/><h1 style="color:#7ef0c0;">✓ Email verified!</h1><p style="color:#8fb8ac;">Your AI sales assistant is activated. You can sign in now.</p><a href="/login" style="display:inline-block;margin-top:14px;background:#25D366;color:#04120c;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:700;">Go to sign in</a></div></body>`);
  } else {
    // same idea, red error variant for bad/used tokens:
    res.status(400).send(`<body style="font-family:Segoe UI,sans-serif;background:#050807;color:#ecfff6;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#ff9d8a;">Link invalid or expired</h1><p style="color:#8fb8ac;">Request a new verification email from the sign-in page.</p><a href="/login" style="color:#25D366;">Back to sign in</a></div></body>`);
  }
}); // close the router.get('/verify', …) handler

// ---- Resend verification email ----
router.post('/resend', async (req, res) => {
  const { email } = req.body || {}; // destructure one field
  if (!email) return res.status(400).json({ error: 'Email required' }); // guard clause
  const result = await auth.resendVerification(email); // null = unknown email
  if (!result) return res.status(404).json({ error: 'No account with that email' });
  if (result.already) return res.json({ ok: true, message: 'Already verified — you can sign in.' }); // idempotent: safe to retry
  res.json({ ok: true, message: result.sent ? 'Verification email sent — check your inbox.' : 'Email service not configured yet; your account was auto-verified. Try signing in.' }); // ternary picks message by whether Resend worked
});

// ---- Sign in ----
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await auth.findUserByEmail(email); // look up by email (case-insensitive in the service)
  if (!user || !auth.verifyPassword(password, user.password_hash)) { // !user short-circuits: unknown email AND wrong password give the SAME error (don't leak which!)
    return res.status(401).json({ error: 'Invalid email or password' }); // 401 = bad credentials
  }
  if (!user.verified) { // email not confirmed yet → block with a helpful flag
    return res.status(403).json({ error: 'Please verify your email first — check your inbox for the VeloSales Ai link.', needsVerification: true, email: user.email }); // frontend shows "resend" button on needsVerification
  }
  req.session.userId = user.id; // login = write ids into the session…
  req.session.businessId = user.business_id; // …business comes from the JOIN in findUserByEmail
  res.json({ user: { id: user.id, email: user.email, business_name: user.business_name } });
});

// ---- Logout ----
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true })); // destroy deletes the DB row; callback replies after
});

// ---- Current user ----
router.get('/me', auth.requireAuth, async (req, res) => { // requireAuth inline: guests get 401
  const { rows } = await db.query(
    `SELECT b.id, b.name, b.whatsapp_number, b.owner_number, b.hours, b.faq, b.tone
     FROM businesses b WHERE b.id = $1`, // b = table alias (shorter SQL)
    [req.session.businessId] // owners can ONLY see their own business (session-scoped = secure)
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Business not found' });
  res.json({ business: rows[0] });
});

// ---- Owner-scoped: update own business config ----
router.put('/me/business', auth.requireAuth, async (req, res) => { // PUT = update
  const { name, owner_number: owner, hours, faq, tone } = req.body || {};
  const errors = []; // same collect-all-errors pattern
  if (!name || typeof name !== 'string') errors.push('Business name required');
  if (owner && !WA_RE.test(owner)) errors.push('owner_number must be in the format whatsapp:+2348012345678');
  if (faq !== undefined && !Array.isArray(faq)) errors.push('faq must be an array');
  if (errors.length) return res.status(400).json({ errors });

  const { rows } = await db.query(
    `UPDATE businesses SET name = $1, owner_number = $2, hours = $3, faq = $4, tone = $5
     WHERE id = $6
     RETURNING id, name, whatsapp_number, owner_number, hours, faq, tone`, // WHERE session id (never trust client-sent ids!)
    [name, owner || null, req.body.hours || '', JSON.stringify(faq || []), req.body.tone || 'friendly and helpful', req.session.businessId]
  );
  res.json(rows[0]);
});

// ---- Owner-scoped: product catalog (view + manual edit) ----
router.get('/me/products', auth.requireAuth, async (req, res) => {
  const products = await productService.getProducts(req.session.businessId); // service hides the SQL
  res.json(products);
});

router.post('/me/products', auth.requireAuth, async (req, res, next) => { // POST = add (or update same-name)
  const { name, price, description, available } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Product name required' });
  const draft = { name, price: price || null, description: description || null, available: available ?? true }; // ?? = nullish coalescing (null/undefined → true, but false stays false)
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'image_url')) draft.image_url = req.body.image_url; // legacy mirror of ownerController: present → set/clear, absent → preserve
  try {
    const saved = await productService.upsertProducts(req.session.businessId, [draft]);
    res.status(201).json(saved[0]); // 201 + the saved product
  } catch (e) {
    if (e && e.status === 400) return res.status(400).json({ error: e.message });
    if (typeof next === 'function') return next(e);
    console.error('legacy upsertProduct error:', e);
    return res.status(500).json({ error: 'Could not save product' });
  }
});

router.delete('/me/products/:id', auth.requireAuth, async (req, res) => {
  const { rowCount } = await db.query( // rowCount = how many rows DELETE removed
    'DELETE FROM products WHERE id = $1 AND business_id = $2', // AND business_id = owners can only delete THEIR products
    [req.params.id, req.session.businessId]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' }); // nothing deleted = wrong id or чужой product
  res.status(204).send(); // 204 = success, empty body
});

// ---- Owner-scoped: conversations (all + flagged) ----
router.get('/me/conversations', auth.requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, customer_number, customer_name, last_message, last_reply,
            needs_human, flag_reason, updated_at
     FROM conversations WHERE business_id = $1
     ORDER BY updated_at DESC LIMIT 100`, // newest first, cap 100 (pagination would come later)
    [req.session.businessId]
  );
  res.json(rows);
});

// ---- Owner-scoped: full chat thread for one conversation ----
router.get('/me/conversations/:id/messages', auth.requireAuth, async (req, res) => {
  const owned = await db.query( // STEP 1: prove this chat belongs to this business (IDOR protection!)
    'SELECT id FROM conversations WHERE id = $1 AND business_id = $2',
    [req.params.id, req.session.businessId]
  ); // IDOR = Insecure Direct Object Reference: without this, changing :id reads others' chats
  if (owned.rows.length === 0) return res.status(404).json({ error: 'Not found' }); // 404 (not 403) hides existence
  const { rows } = await db.query( // STEP 2: the actual messages, oldest first, cap 500
    `SELECT direction, body, media_url, created_at FROM messages
     WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500`,
    [req.params.id]
  );
  res.json(rows);
});

// ---- Owner-scoped: subscription status ----
router.get('/me/billing', auth.requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT subscription_status, subscription_expires, trial_started_at
     FROM businesses WHERE id = $1`,
    [req.session.businessId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const b = rows[0];
  const trialDays = Number(process.env.TRIAL_DAYS || 14); // env override, default 14
  const trialEnd = b.trial_started_at
    ? new Date(new Date(b.trial_started_at).getTime() + trialDays * 86400000) // trial start + N days in ms
    : null;
  res.json({ // frontend Billing page reads exactly these four fields
    status: b.subscription_status,
    expires: b.subscription_expires,
    trial_ends: trialEnd,
    price_naira: Number(process.env.PRICE_NAIRA || 7500),
  });
});

module.exports = router; // (legacy — live auth split is routes/authRoutes + controllers/authController)
