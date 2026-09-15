// ── src/services/productService.js ─────────────────────────────────
// WHAT: the catalog's data-access layer. Controllers NEVER write product SQL —
// they call these three functions (separation of concerns: routes → controllers
// → services → db). No npm modules — just our db pool + SQL.

/**
 * Product catalog service — the knowledge base the AI answers from.
 * Products belong to a business and are updated by the owner
 * (via admin API, seed script, or LEARN: messages).
 */
const db = require('../db'); // shared pool (../ = up one folder from services/ to src/)

async function getProducts(businessId) {
  const { rows } = await db.query( // simple filtered list, oldest first (stable order for the AI prompt)
    `SELECT id, name, price, description, available, quantity, image_url
     FROM products WHERE business_id = $1 ORDER BY id`, // quantity included (AI answers "how many left?" + parser grounds names!); image_url drives Pro photo sends
    [businessId] // $1 = safe parameter (SQL injection impossible)
  );
  return rows; // array (possibly empty) — caller decides what "empty" means
}

/** Validate a product photo URL. Returns clean https URL, null (clear/leave), or { error }. */
function cleanImageUrl(raw) {
  if (raw === undefined || raw === null) return null; // not provided → caller preserves existing (upsert checks 'in' operator, not this!)
  const s = String(raw).trim();
  if (!s) return null; // empty = clear the photo (dashboard "remove photo" path)
  if (s.length > 2000) return { error: 'Photo URL is too long (max 2000 characters).' };
  if (!/^https:\/\/\S+\.\S+/.test(s)) return { error: 'Photo must be a public https:// URL (paste an image link).' }; // https-only: Twilio/Telegram fetch server-side (http + data: + javascript: rejected — SSRF/XSS guard!)
  return s;
}

async function upsertProducts(businessId, products) {
  // UPSERT = UPdate or inSERT: same product name twice UPDATES the price (that's
  // why re-sending "LEARN: Blue gown ₦50,000" changes the price instead of duplicating).
  // PHOTO RULE: image_url key ABSENT → preserve existing photo (LEARN:/toggles must
  // never wipe it!); key PRESENT (url / null / '') → validate then set/clear.
  const saved = []; // collect results to return
  for (const p of products) { // for...of + await = sequential (safe: later writes see earlier ones)
    let photo = undefined; // undefined = preserve (default when caller omits the key)
    const photoTouched = p && Object.prototype.hasOwnProperty.call(p, 'image_url'); // 'in'-check: explicit null/'' MUST clear, missing MUST preserve (cleanImageUrl alone can't tell them apart!)
    if (photoTouched) {
      const cleaned = cleanImageUrl(p.image_url);
      if (cleaned && typeof cleaned === 'object') throw Object.assign(new Error(cleaned.error), { status: 400 }); // { error } → throw 400 (controllers turn this into res.status(400) — no silent junk URLs!)
      photo = cleaned; // clean https URL or null (clear)
    }
    const existing = await db.query( // look for same name, case-insensitive (LOWER both sides)
      `SELECT id FROM products
       WHERE business_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [businessId, p.name]
    );
    if (existing.rows.length > 0) { // FOUND → UPDATE in place (keeps the same id/history)
      const { rows } = await db.query(
        photoTouched
          ? `UPDATE products
             SET price = $1, description = $2, available = COALESCE($3, true), image_url = $4, updated_at = now()
             WHERE id = $5 RETURNING id, name, price, description, available, quantity, image_url` // photo path: explicit set/clear (4 params before id!)
          : `UPDATE products
             SET price = $1, description = $2, available = COALESCE($3, true), updated_at = now()
             WHERE id = $4 RETURNING id, name, price, description, available, quantity, image_url`, // preserve path: image_url untouched (LEARN:/toggle safe!)
        photoTouched
          ? [p.price || null, p.description || null, p.available ?? true, photo, existing.rows[0].id] // ?? = nullish: undefined/null → true, but false STAYS false (|| would break that!)
          : [p.price || null, p.description || null, p.available ?? true, existing.rows[0].id]
      );
      saved.push(rows[0]); // push the updated row
    } else { // NOT FOUND → INSERT fresh
      const { rows } = await db.query(
        `INSERT INTO products (business_id, name, price, description, available, image_url)
         VALUES ($1, $2, $3, $4, COALESCE($5, true), $6)
         RETURNING id, name, price, description, available, quantity, image_url`,
        [businessId, p.name, p.price || null, p.description || null, p.available ?? true, photoTouched ? photo : null] // new row + no photo key → NULL (text-only until owner adds one)
      );
      saved.push(rows[0]); // push the new row
    }
  }
  return saved; // array of saved rows (webhook formats these into the "✅ Catalog updated" message)
}

/** Format the catalog for the AI prompt. Empty string if no products. */
function formatCatalog(products) {
  if (!products || products.length === 0) return '(no products listed yet)'; // guard: AI must see SOMETHING (it then says it has nothing / hands off)
  return products
    .map((p) => { // each product → multi-line block…
      const status = p.available === false ? 'OUT OF STOCK' : 'available'; // === false (not !p.available): NULL/undefined still count as available
      const bits = [`- ${p.name} [${status}]`]; // "- Blue gown [available]" (backticks interpolate)
      if (p.price) bits.push(`  Price: ${p.price}`);
      if (p.description) bits.push(`  Details: ${p.description}`);
      if (p.quantity !== undefined && p.quantity !== null) bits.push(`  In stock: ${p.quantity}`); // quantity line (AI answers "how many left?" truthfully; absent on legacy rows → no line, no crash!)
      return bits.join('\n'); // block lines → one string
    })
    .join('\n'); // blocks → whole catalog text for the system prompt
}

module.exports = { getProducts, upsertProducts, formatCatalog, cleanImageUrl }; // the catalog API (+ photo validator for controllers)
