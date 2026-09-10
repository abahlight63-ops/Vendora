// ── src/adminRoutes.js ───────────────────────────────────────────
// ⚠️ LEGACY FILE — NOT USED by the running app. The live admin routes are
// src/routes/adminRoutes.js + src/controllers/adminController.js (mounted in
// server.js behind the x-admin-key check). This older copy defines everything
// inline in one file. Read to learn Express patterns; EDIT the live files.
// MODULES: express (Router), ./db (pool).
const express = require('express'); // Router class from the framework
const db = require('./db'); // shared Postgres pool

const router = express.Router(); // the mini-app
// NOTE: authentication is enforced in server.js (admin key OR signed-in session).
// /me routes live in authRoutes.js and are always owner-scoped.


// Validate a business payload; returns an ARRAY of error strings (empty = valid).
// Collecting ALL errors (not just the first) gives better forms.
function validateBusiness(body) {
  const errors = []; // start empty; push one message per problem
  const { name, whatsapp_number: number, owner_number: owner, hours, faq, tone } = body || {}; // destructure + rename; || {} guards undefined body
  if (!name || typeof name !== 'string') errors.push('name is required'); // must exist + be text
  if (!number || !/^whatsapp:\+\d{6,20}$/.test(number)) { // regex: literal "whatsapp:+" then 6–20 digits
    errors.push('whatsapp_number must be in the format whatsapp:+2348012345678');
  }
  if (owner && !/^whatsapp:\+\d{6,20}$/.test(owner)) { // owner optional — validate only if given
    errors.push('owner_number must be in the format whatsapp:+2348012345678 (enables LEARN: catalog updates)');
  }
  if (faq !== undefined) { // faq optional too…
    if (!Array.isArray(faq)) {
      errors.push('faq must be an array of {question, answer}');
    } else {
      faq.forEach((f, i) => { // check EVERY item, reporting its index
        if (!f || typeof f.question !== 'string' || typeof f.answer !== 'string') {
          errors.push(`faq[${i}] must have string question and answer`); // e.g. "faq[2] must have…"
        }
      });
    }
  }
  return errors; // caller does: if (errors.length) return 400
}

// List all businesses
router.get('/businesses', async (req, res) => { // async handler: await works inside
  const { rows } = await db.query( // destructure rows out of the pg result object
    'SELECT id, name, whatsapp_number, owner_number, hours, faq, tone FROM businesses ORDER BY id'
  );
  res.json(rows); // res.json serializes array → JSON + sets Content-Type
});

// Get one business (by id)
router.get('/businesses/:id', async (req, res) => { // :id = URL param → req.params.id
  const { rows } = await db.query(
    'SELECT id, name, whatsapp_number, owner_number, hours, faq, tone FROM businesses WHERE id = $1',
    [req.params.id] // $1 = safe parameter (prevents SQL injection)
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' }); // 404 = no such row
  res.json(rows[0]); // single object, not array
});

// Create a business config
router.post('/businesses', async (req, res) => { // POST = create
  const errors = validateBusiness(req.body); // validate FIRST, before touching the DB
  if (errors.length) return res.status(400).json({ errors }); // 400 = bad input

  const { name, whatsapp_number: number, owner_number: owner, hours, faq, tone } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO businesses (name, whatsapp_number, owner_number, hours, faq, tone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, whatsapp_number, owner_number, hours, faq, tone`, // RETURNING = give back the row
      [name, number, owner || null, hours || '', JSON.stringify(faq || []), tone || 'friendly and helpful'] // || defaults for missing fields; faq stored as JSONB string
    );
    res.status(201).json(rows[0]); // 201 = Created (correct code for POST-create)
  } catch (err) {
    if (err.code === '23505') { // Postgres code 23505 = UNIQUE violation (duplicate number)
      return res.status(409).json({ error: 'A business with that WhatsApp number already exists' }); // 409 = Conflict
    }
    throw err; // unknown error → Express error handler (500)
  }
});

// Update a business config
router.put('/businesses/:id', async (req, res) => { // PUT = full update of :id
  const errors = validateBusiness(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { name, whatsapp_number: number, owner_number: owner, hours, faq, tone } = req.body;
  const { rows } = await db.query(
    `UPDATE businesses
     SET name = $1, whatsapp_number = $2, owner_number = $3, hours = $4, faq = $5, tone = $6
     WHERE id = $7
     RETURNING id, name, whatsapp_number, owner_number, hours, faq, tone`,
    [name, number, owner || null, hours || '', JSON.stringify(faq || []), tone || 'friendly and helpful', req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' }); // UPDATE matched nothing
  res.json(rows[0]);
});

// List products for a business
router.get('/businesses/:id/products', async (req, res) => {
  const productService = require('./services/productService'); // require INSIDE handler = lazy load (avoids circular imports)
  const products = await productService.getProducts(Number(req.params.id)); // Number() because URL params are strings
  res.json(products);
});

// Delete a business config
router.delete('/businesses/:id', async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM businesses WHERE id = $1', [req.params.id]); // rowCount = rows deleted
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send(); // 204 = success, no body to return
});

module.exports = router; // (legacy — live admin router is src/routes/adminRoutes.js)
