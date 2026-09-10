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

module.exports = {
  listBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  listBusinessProducts,
  deleteBusiness,
  adStats,
}; // routes/adminRoutes.js wires all seven (behind x-admin-key in server.js)
