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
    `SELECT id, name, price, description, available, quantity, category, image_url
     FROM products WHERE business_id = $1 ORDER BY id`, // quantity included (AI answers "how many left?" + parser grounds names!); category drives niche shelves; image_url drives Pro photo sends
    [businessId] // $1 = safe parameter (SQL injection impossible)
  );
  return rows; // array (possibly empty) — caller decides what "empty" means
}

/** Whole-units stock count from any input. Returns int, or null = "not provided" (preserve existing). */
function cleanQuantity(raw) {
  if (raw === undefined || raw === null || raw === '') return null; // absent → preserve (toggles/LEARN/photo ops never wipe stock!)
  const n = Math.floor(Number(raw)); // floats floor down (2.7 → 2 — stock is whole units!)
  if (!Number.isFinite(n) || n < 0 || n > 1000000) return { error: 'Stock must be a whole number from 0 to 1,000,000.' };
  return n;
}

/** Shelf category from any input. Returns trimmed string, null = clear/absent. Never throws. */
function cleanCategory(raw) {
  if (raw === undefined || raw === null) return null; // absent → caller preserves existing (same rule as photos!)
  const s = String(raw).trim().slice(0, 60); // 60 chars max (dropdown values are short; free text tolerated for custom niches!)
  return s || null; // empty → clear the category
}

/** Validate a product photo URL. Returns clean https URL, null (clear/leave), or { error }. */
function cleanImageUrl(raw) {
  if (raw === undefined || raw === null) return null; // not provided → caller preserves existing (upsert checks 'in' operator, not this!)
  const s = String(raw).trim();
  if (!s) return null; // empty = clear the photo (dashboard "remove photo" path)
  if (s.length > 2000) return { error: 'Photo URL is too long (max 2000 characters).' };
  const isHttps = /^https:\/\/\S+\.\S+/.test(s); // public links (Meta/Telegram fetch server-side)
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(s); // our own /uploads/ URLs in local dev (Meta can't reach these, but the dashboard preview can!)
  if (!isHttps && !isLocal) return { error: 'Photo must be a public https:// URL (paste an image link).' }; // http + data: + javascript: rejected — SSRF/XSS guard!
  return s;
}

async function upsertProducts(businessId, products) {
  // UPSERT = UPdate or inSERT: same product name twice UPDATES the price (that's
  // why re-sending "LEARN: Blue gown ₦50,000" changes the price instead of duplicating).
  // PHOTO RULE: image_url key ABSENT → preserve existing photo (LEARN:/toggles must
  // never wipe it!); key PRESENT (url / null / '') → validate then set/clear.
  const saved = []; // collect results to return
  for (const p of products) { // for...of + await = sequential (safe: later writes see earlier ones)
    const qty = cleanQuantity(p.quantity); // int | null (preserve) | { error }
    if (qty && typeof qty === 'object') throw Object.assign(new Error(qty.error), { status: 400 }); // bad stock number → 400 (same pattern as bad photo URLs!)
    const qtyTouched = qty !== null; // explicit number → write it; absent → leave the count alone (toggles must never zero stock!)
    const catTouched = p && Object.prototype.hasOwnProperty.call(p, 'category'); // same absent-vs-null rule as photos (toggle omits it → preserved!)
    const cat = catTouched ? cleanCategory(p.category) : undefined; // clean string or null (clear)
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
      const sets = ['price = $1', 'description = $2', 'available = COALESCE($3, true)']; // base columns (always written)
      const vals = [p.price || null, p.description || null, p.available ?? true]; // ?? = nullish: undefined/null → true, but false STAYS false (|| would break that!)
      if (photoTouched) { sets.push(`image_url = $${sets.length + 1}`); vals.push(photo); } // explicit set/clear only (absent = preserved!)
      if (qtyTouched) { sets.push(`quantity = $${sets.length + 1}`); vals.push(qty); } // explicit stock number only (toggles/LEARN never touch it!)
      if (catTouched) { sets.push(`category = $${sets.length + 1}`); vals.push(cat); } // explicit category only (absent = preserved!)
      vals.push(existing.rows[0].id); // id always last ($N)
      const { rows } = await db.query(
        `UPDATE products SET ${sets.join(', ')}, updated_at = now()
         WHERE id = $${vals.length} RETURNING id, name, price, description, available, quantity, category, image_url`,
        vals
      );
      saved.push(rows[0]); // push the updated row
    } else { // NOT FOUND → INSERT fresh
      const { rows } = await db.query(
        `INSERT INTO products (business_id, name, price, description, available, quantity, category, image_url)
         VALUES ($1, $2, $3, $4, COALESCE($5, true), COALESCE($6, 0), $7, $8)
         RETURNING id, name, price, description, available, quantity, category, image_url`,
        [businessId, p.name, p.price || null, p.description || null, p.available ?? true, qtyTouched ? qty : 0, catTouched ? cat : null, photoTouched ? photo : null] // new row: stock 0 unless given; no photo key → NULL (text-only until owner adds one)
      );
      saved.push(rows[0]); // push the new row
    }
  }
  return saved; // array of saved rows (webhook formats these into the "Catalog updated" message)
}

/** Format the catalog for the AI prompt. Polite-empty marker when no products. */
function formatCatalog(products) {
  if (!products || products.length === 0) return '(catalog is currently empty — no products have been added yet)'; // guard: AI must see SOMETHING (prompt rules force a polite + handoff reply, never a blunt "no X in catalog")
  return products
    .map((p) => { // each product → multi-line block…
      const status = p.available === false ? 'OUT OF STOCK' : 'available'; // === false (not !p.available): NULL/undefined still count as available
      const bits = [`- ${p.name} [${status}]`]; // "- Blue gown [available]" (backticks interpolate)
      if (p.category) bits.push(`  Category: ${p.category}`); // shelf section (AI recommends within the asked lane first!)
      if (p.price) bits.push(`  Price: ${p.price}`);
      if (p.description) bits.push(`  Details: ${p.description}`);
      if (Number(p.quantity) > 0) bits.push(`  In stock: ${p.quantity}`); // count line ONLY when above 0 (synced-but-uncounted rows default to 0 — printing "In stock: 0" made the AI tell customers "finished" for shelf-full items! availability flag still governs!)
      return bits.join('\n'); // block lines → one string
    })
    .join('\n'); // blocks → whole catalog text for the system prompt
}

/**
 * Sync with a REPORT (never silent!): snapshots existing names, upserts, then
 * diffs. Returns { saved, added, updated, unmentioned } — name lists the
 * owner can ACT on. Unmentioned items are NEVER auto-deleted or auto-flagged
 * (one careless SYNC: must not darken the shop — report-only by design!).
 */
async function syncWithReport(businessId, products) {
  const before = await getProducts(businessId); // snapshot BEFORE (names lowercased for matching!)
  const beforeNames = new Map(before.map((p) => [String(p.name).toLowerCase(), p.name]));
  const incoming = new Set((products || []).map((p) => String(p.name || '').toLowerCase()));
  const saved = await upsertProducts(businessId, products);
  const added = [];
  const updated = [];
  for (const p of saved) {
    if (beforeNames.has(String(p.name).toLowerCase())) updated.push(p.name);
    else added.push(p.name);
  }
  const unmentioned = [...beforeNames.values()].filter((n) => !incoming.has(n.toLowerCase())); // in catalog but NOT in this sync (stale? discontinued? owner decides!)
  return { saved, added, updated, unmentioned };
}

module.exports = { getProducts, upsertProducts, syncWithReport, formatCatalog, cleanImageUrl, cleanQuantity, cleanCategory }; // the catalog API (+ validators for controllers)
