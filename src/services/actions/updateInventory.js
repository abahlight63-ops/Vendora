// ── src/services/actions/updateInventory.js ──────────────────────────
// WHAT: update_inventory(item, quantity, operation) — the tool the AI calls.
// operation: 'add' (restock received) | 'remove' (sold/used/spoiled) |
// 'set' (count correction) | 'undo' (internal — reversal entries only).
// RULES (per your decisions): owner-only callers (webhook enforces!), clamp at
// 0 + warn on oversell (never negative, never refuse — both truths preserved),
// EVERY change logged (append-only audit: item, old, new, source message).
// Transactions: BEGIN/COMMIT wraps read→write→log (concurrent messages can't
// interleave half-updates — atomicity!). No npm modules — db pool only.
const db = require('../../db'); // ../../ = up from services/actions/ to src/ (deeper file, longer relative path!)

// Resolve a name to a product row: exact → case-insensitive → substring.
// Returns { product } or { error: 'notfound' | 'ambiguous', candidates? }.
async function resolveItem(client, businessId, item) {
  const want = String(item || '').trim(); // normalize input once (empty → notfound below, no crash!)
  if (!want) return { error: 'notfound' };
  const { rows } = await client.query('SELECT id, name, price, quantity FROM products WHERE business_id = $1', [businessId]); // full catalog (small per vendor — fine in memory!)
  if (rows.length === 0) return { error: 'empty' }; // no catalog at all (distinct from "not found" — different coaching!)
  const lower = want.toLowerCase(); // lowercase once (compare cheaply in the loop!)
  const exact = rows.find((p) => p.name.toLowerCase() === lower); // 1. exact (case-insensitive): "Rice" = "rice" ✓
  if (exact) return { product: exact };
  const subs = rows.filter((p) => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())); // 2. substring EITHER way ("rice"↔"Rice 20kg"; "bag of rice"↔"Rice")
  if (subs.length === 1) return { product: subs[0] }; // unique substring = confident (no need to bother the owner!)
  if (subs.length > 1) return { error: 'ambiguous', candidates: subs.slice(0, 5).map((p) => p.name) }; // several match → owner picks (cap 5 names — readable WhatsApp!)
  return { error: 'notfound' }; // nothing resembles it (bot suggests adding it via LEARN!)
}

// update_inventory(businessId, item, quantity, operation, sourceMessage)
// Returns { ok, item, before, after, operation, clamped } or { ok:false, error, ... }.
async function updateInventory(businessId, item, quantity, operation, sourceMessage) {
  const op = String(operation || '').toLowerCase().trim(); // normalize operation (AI may send "Add"/" REMOVE " — tolerate!)
  const qty = Math.floor(Number(quantity)); // Math.floor: stock is WHOLE units (2.7 bags → 2 — never fractional!); Number() coerces strings
  if (!['add', 'remove', 'set', 'undo'].includes(op)) return { ok: false, error: 'badop' }; // whitelist operations (unknown verbs rejected — typo-safe!)
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, error: 'badqty' }; // quantity must be a real non-negative number (NaN/Infinity/negatives rejected!)
  if (op === 'undo') return { ok: false, error: 'badop' }; // 'undo' is RESERVED for the reversal path below (AI must never emit it directly!)

  const client = await db.pool.connect(); // dedicated client = transaction owner (pool.query can't transact across calls!)
  try {
    await client.query('BEGIN'); // START transaction (everything until COMMIT is atomic — all-or-nothing!)
    const resolved = await resolveItem(client, businessId, item); // resolve INSIDE the txn (consistent snapshot!)
    if (resolved.error) { // notfound | ambiguous | empty → ROLLBACK (nothing touched!) + structured error…
      await client.query('ROLLBACK'); // …undo the (empty) transaction explicitly (cleanliness: never leave txns hanging!)
      return { ok: false, error: resolved.error, candidates: resolved.candidates };
    }
    const p = resolved.product; // the matched row (id, name, price, quantity)
    const before = Number(p.quantity) || 0; // || 0 guards NULL legacy rows (pre-migration products!)
    let after = before; // computed per operation below…
    let clamped = false; // did we hit the 0 floor? (drives the warning copy!)
    if (op === 'add') after = before + qty; // restock: always safe (no upper bound — warehouses overflow, databases don't care!)
    else if (op === 'remove') { // sale/usage/spoilage…
      after = before - qty; // …subtract…
      if (after < 0) { after = 0; clamped = true; } // …CLAMP at 0 + flag (per your decision: oversell recorded, stock truth preserved, owner warned!)
    } else after = qty; // 'set': absolute correction (stock-take counts, typo fixes)
    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [after, p.id]); // the actual write…
    await client.query( // …AND the audit entry (same txn = write + log succeed/fail TOGETHER — never one without the other!)
      'INSERT INTO inventory_logs (business_id, product_id, item, old_value, new_value, operation, source_message) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [businessId, p.id, p.name, before, after, op, String(sourceMessage || '').slice(0, 500)] // slice caps message length (DB hygiene — 500 chars of proof is plenty!)
    );
    await client.query('COMMIT'); // persist BOTH (atomic!)
    return { ok: true, item: p.name, before, after, operation: op, clamped }; // everything the confirmation copy needs (before/after for "20 → 17"!)
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {} // rollback-best-effort (empty catch: we're already handling a failure — don't mask it!)
    console.error('updateInventory error:', e.message); // log the real cause (DB down? constraint?)
    return { ok: false, error: 'dberror' }; // structured failure (webhook turns it into a human message, never a crash!)
  } finally {
    client.release(); // FINALLY always runs: return the client to the pool (leaked clients = pool exhaustion = dead app — this line is sacred!)
  }
}

// undoLast(businessId): reverse the most recent inventory change (UNDO: command).
// Reads the latest log, writes the OLD value back, logs the reversal as its own
// 'undo' entry (audit NEVER edited — history stays complete and honest!).
async function undoLast(businessId) {
  const { rows } = await db.query( // latest entry for this vendor (ORDER BY id DESC = insertion order — timestamps can tie!)
    'SELECT * FROM inventory_logs WHERE business_id = $1 ORDER BY id DESC LIMIT 1',
    [businessId]
  );
  const last = rows[0]; // may be undefined (nothing to undo — handled below!)
  if (!last) return { ok: false, error: 'empty' }; // no history yet (fresh shop — say so plainly!)
  if (last.operation === 'undo') { // last entry was ITSELF an undo → reversing it would ping-pong forever (only ONE level supported — say so!)
    const prev = await db.query( // look one deeper: undo the ORIGINAL change instead? NO — keep it simple + predictable: refuse with guidance…
      'SELECT * FROM inventory_logs WHERE business_id = $1 AND operation != $2 ORDER BY id DESC LIMIT 1',
      [businessId, 'undo']
    );
    if (!prev.rows[0]) return { ok: false, error: 'empty' };
    return undoEntry(businessId, prev.rows[0]); // …actually YES: skip the undo-marker, reverse the last REAL change (feels right, stays honest!)
  }
  return undoEntry(businessId, last);
}

async function undoEntry(businessId, entry) { // shared reversal worker (transactional, like updateInventory!)…
  const client = await db.pool.connect(); // dedicated client again (same atomicity reasoning!)
  try {
    await client.query('BEGIN'); // atomic: restore + log together…
    const cur = await client.query('SELECT quantity FROM products WHERE id = $1', [entry.product_id]); // current value (for the confirmation copy: "17 → 20"!)
    const current = cur.rows.length ? Number(cur.rows[0].quantity) || 0 : null; // null = product deleted since (restore impossible — report it!)
    if (current === null) {
      await client.query('ROLLBACK'); // nothing to restore into (product gone)…
      return { ok: false, error: 'gone' }; // …say plainly (suggest re-adding via LEARN!)
    }
    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [entry.old_value, entry.product_id]); // write back the LOGGED old value (source of truth = the audit entry itself!)
    await client.query( // log the reversal as its own 'undo' entry (append-only history: original + reversal BOTH visible!)
      "INSERT INTO inventory_logs (business_id, product_id, item, old_value, new_value, operation, source_message) VALUES ($1, $2, $3, $4, $5, 'undo', $6)",
      [businessId, entry.product_id, entry.item, current, entry.old_value, 'Undid change from audit log']
    );
    await client.query('COMMIT'); // persist both…
    return { ok: true, item: entry.item, before: current, after: entry.old_value }; // confirmation copy needs (matches update shape!)
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('undoEntry error:', e.message);
    return { ok: false, error: 'dberror' };
  } finally {
    client.release(); // sacred line (see above!)
  }
}

module.exports = { updateInventory, undoLast, resolveItem }; // resolveItem exported for tests/introspection (webhook uses updateInventory + undoLast)
