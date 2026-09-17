// ── src/controllers/adminController.js ─────────────────────────────
// WHAT: super-admin handlers (manage ANY business + ad revenue stats).
// Mounted by server.js behind the x-admin-key check — these NEVER run for
// ordinary owners. Same validate→query→respond shape as owner handlers, but
// WITHOUT session scoping (admin acts on :id from the URL).
// MODULES: ../db (pool), ../services/productService, ../utils/phone.
const db = require('../db'); // shared pool
const productService = require('../services/productService'); // catalog reads

const { normalizePhone } = require('../utils/phone'); // phone helper (destructured import)

// Validate an admin-supplied business payload. Returns string[] (empty = valid).
// Same collect-ALL-errors philosophy as everywhere else in this codebase.
function validateBusiness(body) {
  const errors = []; // start clean, push one message per problem
  const { name } = body || {}; // only name is pulled here; numbers below use body.* directly
  if (!name || typeof name !== 'string') errors.push('name is required'); // must exist + be text
  return errors;
}

async function listBusinesses(req, res) {
  const { rows } = await db.query( // every shop, oldest first (support overview)…
    'SELECT id, name, whatsapp_number, owner_number, hours, faq, tone FROM businesses ORDER BY id'
  );
  res.json(rows); // array (empty array if brand-new database — still valid JSON)
}

async function getBusiness(req, res) {
  const { rows } = await db.query( // …one shop by URL id…
    'SELECT id, name, whatsapp_number, owner_number, hours, faq, tone FROM businesses WHERE id = $1',
    [req.params.id] // :id from /businesses/:id (admin may pass ANY id — that's the point of admin)
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' }); // unknown id
  res.json(rows[0]); // single object
}

async function createBusiness(req, res) {
  const errors = validateBusiness(req.body); // validate BEFORE touching the DB
  if (errors.length) return res.status(400).json({ errors }); // 400 = fix input

  const { name, whatsapp_number: number, owner_number: owner, hours, faq, tone } = req.body; // pull fields (rename for short SQL lines)
  try {
    const { rows } = await db.query( // INSERT + hand back the row…
      `INSERT INTO businesses (name, whatsapp_number, owner_number, hours, faq, tone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, whatsapp_number, owner_number, hours, faq, tone`,
      [name, number, owner || null, hours || '', JSON.stringify(faq || []), tone || 'friendly and helpful'] // || defaults; faq array → JSONB string
    );
    res.status(201).json(rows[0]); // 201 = Created
  } catch (err) {
    if (err.code === '23505') { // Postgres UNIQUE violation (duplicate whatsapp_number)
      return res.status(409).json({ error: 'A business with that WhatsApp number already exists' }); // 409 = Conflict
    }
    throw err; // unknown → Express 500 (don't swallow real bugs)
  }
}

async function updateBusiness(req, res) {
  const errors = validateBusiness(req.body); // same validation as create (consistent rules)
  if (errors.length) return res.status(400).json({ errors });

  const { name, whatsapp_number: number, owner_number: owner, hours, faq, tone } = req.body;
  const { rows } = await db.query( // UPDATE any shop by :id (admin privilege)…
    `UPDATE businesses
     SET name = $1, whatsapp_number = $2, owner_number = $3, hours = $4, faq = $5, tone = $6
     WHERE id = $7
     RETURNING id, name, whatsapp_number, owner_number, hours, faq, tone`,
    [name, number, owner || null, hours || '', JSON.stringify(faq || []), tone || 'friendly and helpful', req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' }); // UPDATE matched nothing = bad id
  res.json(rows[0]);
}

async function listBusinessProducts(req, res) {
  const products = await productService.getProducts(Number(req.params.id)); // Number(): URL params are STRINGS, service wants int
  res.json(products);
}

async function deleteBusiness(req, res) {
  const { rowCount } = await db.query('DELETE FROM businesses WHERE id = $1', [req.params.id]); // rowCount = rows removed (CASCADE also wipes users/products/chats — know what you're doing!)
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send(); // 204 = success, empty body
}

// ---- Admin session auth (separate from owner login!) ----
// The ONLY gate for /admin UI + these endpoints (besides x-admin-key header).
// Password lives in env ADMIN_PASSWORD — never in code, never in git.
async function adminLogin(req, res) {
  const expected = process.env.ADMIN_PASSWORD; // set this in .env / Render env (long random string!)
  if (!expected) return res.status(503).json({ error: 'Admin login is not configured (set ADMIN_PASSWORD).' }); // 503 = server not ready (honest, not "wrong password"!)
  const { password } = req.body || {}; // JSON body { password }
  if (typeof password !== 'string' || password.length === 0) return res.status(400).json({ error: 'Password required.' }); // guard clause
  const a = Buffer.from(password); // Buffers for timing-safe compare (same anti-timing-attack habit as webhooks!)
  const b = Buffer.from(expected);
  if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) { // WRONG password → same shape every time (no "user exists" leaks — there's only YOU anyway!)
    return res.status(401).json({ error: 'Wrong password.' }); // 401 (generic message — don't hint at config state!)
  }
  req.session.isAdmin = true; // stamp the SESSION (PgSessionStore persists it — survives restarts, works multi-server!)
  res.json({ ok: true }); // frontend hides the gate, shows the dashboard
}

function adminLogout(req, res) {
  req.session.isAdmin = false; // flip the flag (keep the session itself — owner login underneath is untouched!)
  res.json({ ok: true });
}

// Middleware: pass if admin session flag OR legacy x-admin-key header.
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next(); // UI path (password login)…
  const expected = process.env.ADMIN_API_KEY; // …or API path (scripts/integrations)…
  if (expected && req.get('x-admin-key') === expected) return next();
  return res.status(401).json({ error: 'Admin only.' }); // everyone else (including logged-in OWNERS) → 401
}

// ---- Overview stats: users, tiers, money, activity ----
async function adminStats(req, res) {
  const users = await db.query('SELECT COUNT(*)::int c FROM users'); // total accounts
  const biz = await db.query( // businesses by tier + trial/active splits (planService logic mirrored in SQL for speed)…
    `SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE subscription_status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE subscription_status = 'trialing')::int AS trialing,
      COUNT(*) FILTER (WHERE subscription_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE currency = 'USD')::int AS usd
     FROM businesses`
  );
  const money = await db.query( // revenue ledger: collected (active) vs awaiting (pending), split by currency…
    `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'active' AND currency = 'NGN'), 0)::bigint AS ngn_kobo,
            COALESCE(SUM(amount) FILTER (WHERE status = 'active' AND currency = 'USD'), 0)::bigint AS usd_cents,
            COALESCE(SUM(amount) FILTER (WHERE status = 'active' AND created_at >= date_trunc('month', now())), 0)::bigint AS month_all
     FROM payments`
  ); // COALESCE(SUM…),0) = NULL (no rows) → 0 (JSON-friendly!); minor units preserved (divide by 100 in UI!)
  const chats = await db.query( // today's chat volume + flags (support load at a glance)…
    `SELECT COUNT(*)::int AS today,
      COUNT(*) FILTER (WHERE needs_human)::int AS flagged
     FROM conversations WHERE updated_at >= CURRENT_DATE`
  );
  const complaints = await db.query( // open support tickets (badge count for the tab!)…
    `SELECT COUNT(*)::int AS open FROM complaints WHERE status = 'open'`
  );
  res.json({ users: users.rows[0].c, ...biz.rows[0], ...money.rows[0], ...chats.rows[0], complaints: complaints.rows[0].open }); // spread-merge five single-row results into ONE object (frontend reads it flat!)
}

// ---- Users: every account + business, newest first ----
async function adminUsers(req, res) {
  const { rows } = await db.query( // JOIN users→businesses (one row per account WITH shop context)…
    `SELECT u.id, u.email, u.verified, u.created_at,
            b.id AS business_id, b.name AS business_name, b.whatsapp_number,
            b.subscription_status, b.subscription_expires, b.currency
     FROM users u LEFT JOIN businesses b ON b.id = u.business_id
     ORDER BY u.id DESC LIMIT 200`, // LEFT JOIN (not INNER): orphaned users still show (data hygiene visibility!); 200 cap
  );
  res.json(rows);
}

// ---- Manually verify a user's email (support action) ----
async function adminVerifyUser(req, res) {
  const { rowCount } = await db.query( // flip verified + burn any token (same end-state as clicking the email link!)…
    'UPDATE users SET verified = true, verify_token = NULL WHERE id = $1',
    [req.params.id] // :id from URL (admin acts on ANY id — that's the point!)
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

// ---- Transfer approval queue: pending bank transfers awaiting human eyes ----
async function transferQueue(req, res) {
  const { rows } = await db.query( // pending payments + WHO (join business for context)…
    `SELECT p.id, p.business_id, p.plan, p.currency, p.amount, p.reference, p.created_at,
            p.sender_name, p.sender_bank, p.sender_ref,
            b.name AS business_name, b.whatsapp_number, b.owner_number, u.email
     FROM payments p
     LEFT JOIN businesses b ON b.id = p.business_id
     LEFT JOIN users u ON u.business_id = p.business_id
     WHERE p.method = 'transfer' AND p.status = 'pending'
     ORDER BY p.created_at ASC`, // ASC = oldest first (FIFO: first reporter, first served — fairness!)
  );
  res.json(rows);
}

// ---- Approve a transfer: mark ledger active + extend subscription like Paystack ----
async function transferApprove(req, res) {
  const billingController = require('./billingController'); // reuse PLANS table (single price/day truth — never duplicate!)
  const { rows } = await db.query('SELECT * FROM payments WHERE id = $1', [req.params.id]); // load the payment…
  const pay = rows[0];
  if (!pay) return res.status(404).json({ error: 'Not found' });
  if (pay.status !== 'pending') return res.status(400).json({ error: `Already ${pay.status} — refusing double-activation.` }); // idempotency guard (double-clicking Approve can't grant 2× days!)
  const days = billingController.PLANS[pay.plan] ? billingController.PLANS[pay.plan].days : 30; // plan → days (same table the webhook uses!)
  const boughtTier = (billingController.PLANS[pay.plan] && billingController.PLANS[pay.plan].tier) || 'pro'; // pro_* → pro, plus_* → plus (same rule as the webhook!)
  await db.query( // same activation SQL shape as the Paystack webhook (consistent semantics!)…
    `UPDATE businesses
     SET subscription_status = 'active',
         subscription_expires = GREATEST(COALESCE(subscription_expires, now()), now()) + make_interval(days => $1),
         plan_tier = $3,
         trial_warned = true, trial_expiry_notified = true
     WHERE id = $2`, // trial flags → true (buyers skip trial warnings — same rule as card activation!)
    [days, pay.business_id, boughtTier]
  );
  await db.query("UPDATE payments SET status = 'active' WHERE id = $1", [req.params.id]); // ledger flips pending → active (revenue counts it now!)
  require('../services/notifyService').notify(pay.business_id, { // bell: verified (fire-and-forget — never breaks approval)
    title: 'Payment verified — your upgrade is active!',
    body: `Your ${pay.plan} payment was confirmed. Enjoy ${days} days of Pro — nothing else to do.`,
    link: '/billing',
  });
  res.json({ ok: true, days }); // days echoed (UI confirms "+30 days")
}

// ---- Reject a transfer: mark rejected (business falls back to free — never deleted!) ----
async function transferReject(req, res) {
  const { rows } = await db.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
  const pay = rows[0];
  if (!pay) return res.status(404).json({ error: 'Not found' });
  if (pay.status !== 'pending') return res.status(400).json({ error: `Already ${pay.status}.` }); // same idempotency guard
  await db.query("UPDATE payments SET status = 'rejected' WHERE id = $1", [req.params.id]); // ledger only (business row untouched — subscription_status stays pending → owner sees "activation in progress"?? NO — flip it back so UI is honest!)
  await db.query("UPDATE businesses SET subscription_status = 'expired' WHERE id = $1 AND subscription_status = 'pending'", [pay.business_id]); // pending → expired (free tier keeps working — nothing deleted, nothing paused!)
  require('../services/notifyService').notify(pay.business_id, { // bell: rejected with next step (fire-and-forget)
    title: 'Transfer not confirmed',
    body: `We couldn't match your ${pay.plan} transfer (ref ${pay.sender_ref || pay.reference || '—'}) in the statement. Check the reference and try again, or contact support.`,
    link: '/billing',
  });
  res.json({ ok: true });
}

// ---- Complaints: list all tickets (newest first) ----
async function complaintList(req, res) {
  const { rows } = await db.query( // join business for WHO (name + number at a glance)…
    `SELECT c.*, b.name AS business_name, b.whatsapp_number
     FROM complaints c LEFT JOIN businesses b ON b.id = c.business_id
     ORDER BY CASE WHEN c.status = 'open' THEN 0 ELSE 1 END, c.updated_at DESC`, // CASE in ORDER BY: open tickets FIRST, then newest (support triage order!)
  );
  res.json(rows);
}

// ---- Reply to a complaint (email + store reply + mark answered) ----
async function complaintReply(req, res) {
  const { reply } = req.body || {}; // admin's answer text (required)…
  if (!reply || typeof reply !== 'string' || !reply.trim()) return res.status(400).json({ error: 'Reply text required.' }); // guard clause
  const { rows } = await db.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]); // load ticket…
  const ticket = rows[0];
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  await db.query("UPDATE complaints SET reply = $1, status = 'answered', updated_at = now() WHERE id = $2", [reply.trim(), req.params.id]); // store reply + flip status + bump timestamp (owner sees it in Help history!)
  try { // email the owner (best-effort: ticket is STORED regardless — email failing must not lose the reply!)…
    const u = await db.query('SELECT email FROM users WHERE business_id = $1 ORDER BY id ASC LIMIT 1', [ticket.business_id]); // oldest account = owner email…
    const key = process.env.RESEND_API_KEY; // …via Resend (same provider as verification — no new dependency!)…
    if (key && u.rows[0]?.email) { // …only if configured AND address known…
      const from = process.env.EMAIL_FROM || 'Vendora <onboarding@resend.dev>';
      await fetch('https://api.resend.com/emails', { // POST email (same shape as authService — consistency!)
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [u.rows[0].email], subject: `Re: ${ticket.subject || 'your support request'} — Vendora`, html: `<div style="font-family:Segoe UI,sans-serif;max-width:520px;margin:auto;padding:24px;"><p style="color:#333;">${reply.trim().replace(/</g, '&lt;')}</p></div>` }), // .replace(/</g) escapes HTML (admin typing <script> can't break the email!)
      });
    }
  } catch (e) { console.error('complaint email error:', e.message); } // email failed → log only (reply already saved = support continuity preserved!)
  res.json({ ok: true });
}

// ---- Resolve a complaint (no reply needed / done) ----
async function complaintResolve(req, res) {
  const { rowCount } = await db.query("UPDATE complaints SET status = 'resolved', updated_at = now() WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

// Ad earnings overview: per-click totals from our own tracking.
// Per-VIEW earnings live in the network dashboard (Monetag etc.).
async function adStats(req, res) {
  const rate = Number(process.env.SPONSOR_RATE_PER_CLICK || 50); // ₦ per sponsor click (your deal rate, env-tunable)
  const { rows } = await db.query( // three counts in ONE query via FILTER (conditional aggregation)…
    `SELECT COUNT(*)::int AS total, -- ::int casts bigint to int (clean JSON numbers)
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS month, -- date_trunc('month') = midnight of the 1st (this month's clicks)
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today -- CURRENT_DATE = midnight today
     FROM ad_clicks`
  );
  const s = rows[0]; // single summary row
  res.json({ ...s, rate_naira: rate, estimate_month_naira: s.month * rate, estimate_total_naira: s.total * rate }); // spread counts + computed Naira estimates (bill sponsors from these!)
}

// ---- Broadcast an app update to EVERY owner's bell (new features, fixes).
// Long bodies welcome (up to 4000 chars) + optional photo/video. {name} in
// title/body becomes each shop's first name at send time. ----
async function broadcast(req, res) {
  const { title, body, link, image_url, video_url } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title required.' });
  }
  try {
    const notify = require('../services/notifyService');
    const n = await notify.broadcast({
      title: title.trim(),
      body: (body || '').trim(),
      link: (link || '/dashboard').trim(),
      image_url: (image_url || '').trim() || null,
      video_url: (video_url || '').trim() || null,
    });
    res.json({ ok: true, sent: n });
  } catch (e) {
    console.error('broadcast error:', e.message);
    res.status(500).json({ error: 'Could not broadcast' });
  }
}

// ---- Notice templates: 12 long built-ins (code) + your customs (DB).
// GET lists both (customs first, flagged builtin:false). ----
async function templateList(req, res) {
  const { BUILT_INS } = require('../services/notificationTemplates');
  const { rows } = await db.query(
    'SELECT id, title, body, link, image_url, video_url, created_at, updated_at FROM notification_templates ORDER BY id DESC'
  );
  const customs = rows.map((r) => ({ ...r, builtin: false }));
  const builtins = BUILT_INS.map((b) => ({ ...b, image_url: null, video_url: null, builtin: true }));
  res.json({ templates: [...customs, ...builtins] });
}

// ---- Save your own template (builder form). Title required, rest optional. ----
async function templateCreate(req, res) {
  const { title, body, link, image_url, video_url } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title required.' });
  }
  const { rows } = await db.query(
    `INSERT INTO notification_templates (title, body, link, image_url, video_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, body, link, image_url, video_url, created_at, updated_at`,
    [
      title.trim().slice(0, 120),
      String(body || '').slice(0, 4000),
      String(link || '').slice(0, 200) || '/dashboard',
      (image_url || '').trim().slice(0, 2000) || null,
      (video_url || '').trim().slice(0, 2000) || null,
    ]
  );
  res.status(201).json({ ...rows[0], builtin: false });
}

// ---- Edit your template (built-ins are read-only — copy one into the builder instead). ----
async function templateUpdate(req, res) {
  const { title, body, link, image_url, video_url } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title required.' });
  }
  const { rows } = await db.query(
    `UPDATE notification_templates SET title = $1, body = $2, link = $3, image_url = $4, video_url = $5, updated_at = now()
     WHERE id = $6
     RETURNING id, title, body, link, image_url, video_url, created_at, updated_at`,
    [
      title.trim().slice(0, 120),
      String(body || '').slice(0, 4000),
      String(link || '').slice(0, 200) || '/dashboard',
      (image_url || '').trim().slice(0, 2000) || null,
      (video_url || '').trim().slice(0, 2000) || null,
      Number(req.params.id),
    ]
  );
  if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
  res.json({ ...rows[0], builtin: false });
}

// ---- Delete your template (built-ins can't be deleted). ----
async function templateDelete(req, res) {
  const { rowCount } = await db.query('DELETE FROM notification_templates WHERE id = $1', [Number(req.params.id)]);
  if (!rowCount) return res.status(404).json({ error: 'Template not found.' });
  res.json({ ok: true });
}

// ---- Host a notice photo/video for broadcasts. Body: { filename, dataUrl }.
// Images: jpg/png/webp/gif ≤2.5MB. Video: mp4 ≤10MB. Files land in
// public/uploads/ (served statically) — same pattern as product photos. ----
async function uploadMedia(req, res) {
  const fs = require('fs');
  const path = require('path');
  const { dataUrl } = req.body || {};
  if (typeof dataUrl !== 'string') return res.status(400).json({ error: 'Send an image or video file.' });
  const img = dataUrl.match(/^data:(image\/(jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  const vid = !img && dataUrl.match(/^data:(video\/mp4);base64,([A-Za-z0-9+/=\s]+)$/);
  const m = img || vid;
  if (!m) return res.status(400).json({ error: 'Send an image (jpg, png, webp, gif) or mp4 video.' });
  let buf;
  try {
    buf = Buffer.from(m[img ? 3 : 2].replace(/\s/g, ''), 'base64');
  } catch {
    return res.status(400).json({ error: 'Could not read that file.' });
  }
  const cap = img ? 2.5 * 1024 * 1024 : 10 * 1024 * 1024; // photos 2.5MB, video 10MB (disk guard!)
  if (buf.length === 0 || buf.length > cap) {
    return res.status(400).json({ error: img ? 'Image too large — max 2.5MB.' : 'Video too large — max 10MB.' });
  }
  let ext;
  if (img) {
    const kind = m[2];
    const magicOk =
      (kind === 'jpeg' && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
      (kind === 'png' && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
      (kind === 'gif' && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) ||
      (kind === 'webp' && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP');
    if (!magicOk) return res.status(400).json({ error: 'That file is not a real image.' });
    ext = kind === 'jpeg' ? 'jpg' : kind;
  } else {
    if (buf.toString('ascii', 4, 8) !== 'ftyp') return res.status(400).json({ error: 'That file is not a real mp4.' }); // mp4 magic: "ftyp" at byte 4
    ext = 'mp4';
  }
  const dir = path.join(__dirname, '..', '..', 'public', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const safe = `notice-${Date.now()}.${ext}`; // server-built name (user filenames NEVER touch disk!)
  try {
    fs.writeFileSync(path.join(dir, safe), buf);
  } catch (e) {
    console.error('notice media write error:', e.message);
    return res.status(500).json({ error: 'Could not save that file.' });
  }
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''); // absolute URL (Meta + apps fetch server-side!)
  const host = base || `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${host}/uploads/${safe}` });
}

// ---- Warn ONE user: drop a notification into a single owner's bell.
// Find the shop three ways (whatever the admin has at hand): business_id,
// account email, or WhatsApp number. Same inbox the bell + mobile app poll,
// so the warning lands within ~60s on web AND phone. ----
async function notifyUser(req, res) {
  const { business_id, email, whatsapp_number, title, body, link, image_url, video_url } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title required.' });
  }
  try {
    let biz = null;
    if (business_id) { // direct id (from the Users tab row)…
      const { rows } = await db.query('SELECT id, name FROM businesses WHERE id = $1', [Number(business_id)]);
      biz = rows[0] || null;
    } else if (email && typeof email === 'string') { // account email → their shop…
      const { rows } = await db.query(
        `SELECT b.id, b.name FROM businesses b
         JOIN users u ON u.business_id = b.id
         WHERE LOWER(u.email) = LOWER($1) ORDER BY u.id ASC LIMIT 1`,
        [email.trim()]
      );
      biz = rows[0] || null;
    } else if (whatsapp_number && typeof whatsapp_number === 'string') { // shop number (exact or normalized digits)…
      const raw = whatsapp_number.trim();
      let norm = raw;
      try { norm = normalizePhone(raw); } catch {}
      const { rows } = await db.query(
        'SELECT id, name FROM businesses WHERE whatsapp_number = $1 OR whatsapp_number = $2 LIMIT 1',
        [raw, norm]
      );
      biz = rows[0] || null;
    } else {
      return res.status(400).json({ error: 'Give a business ID, account email, or WhatsApp number.' });
    }
    if (!biz) return res.status(404).json({ error: 'No shop found for that user.' });
    const notify = require('../services/notifyService');
    await notify.notify(biz.id, {
      title: title.trim(),
      body: (body || '').trim(),
      link: (link || '/dashboard').trim(),
      image_url: (image_url || '').trim() || null,
      video_url: (video_url || '').trim() || null,
    });
    res.json({ ok: true, business_id: biz.id, business_name: biz.name });
  } catch (e) {
    console.error('notify user error:', e.message);
    res.status(500).json({ error: 'Could not send warning' });
  }
}

// ---- Ads status: are the Render ad keys live? (booleans only — key VALUES
// never leave the server!) The #1 "ads don't show" cause is keys added in the
// Render dashboard but the service never redeployed (Node reads env at boot).
// #2 is testing on a Pro/trial account (backend sends ads to FREE tier only).
// #3 is an ad-blocker in the test browser. ----
async function adsStatus(req, res) {
  res.json({
    network1: !!(process.env.ADS_SCRIPT_URL || '').trim(),
    provider1: process.env.ADS_PROVIDER || 'custom',
    network2: !!(process.env.ADS_SCRIPT_URL_2 || '').trim(),
    provider2: process.env.ADS_PROVIDER_2 || 'custom',
    sponsor: !!(process.env.SPONSOR_TITLE || '').trim() && !!(process.env.SPONSOR_LINK || '').trim(),
    sponsorTitle: (process.env.SPONSOR_TITLE || '').slice(0, 60),
    sponsorVideo: !!(process.env.SPONSOR_VIDEO_URL || '').trim(), // video file set? (plays inside the interstitial — no network needed)
    rateNaira: Number(process.env.SPONSOR_RATE_PER_CLICK || 50),
    note: 'Ads serve to FREE-tier owners only — Pro and trial accounts get ads:null by design. Test with a free account and no ad-blocker.',
  });
}

// ---- AI health: same ping-all as the owner diagnosis, but behind the admin
// gate (booleans + short errors only — key VALUES never leave the server!) ----
async function aiStatus(req, res) {
  const client = require('../services/ai/client');
  res.json({ status: await client.pingAll() });
}

module.exports = {
  listBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  listBusinessProducts,
  deleteBusiness,
  adStats,
  adsStatus,
  aiStatus,
  adminLogin,
  adminLogout,
  requireAdmin,
  adminStats,
  adminUsers,
  adminVerifyUser,
  transferQueue,
  transferApprove,
  transferReject,
  broadcast,
  notifyUser,
  complaintList,
  complaintReply,
  complaintResolve,
  templateList,
  templateCreate,
  templateUpdate,
  templateDelete,
  uploadMedia,
}; // routes/adminRoutes.js wires these (behind x-admin-key in server.js)
