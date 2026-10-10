// ── src/services/conversationService.js ────────────────────────────
// WHAT: chat persistence helpers (the inbox's memory). The live webhook uses
// saveMessage + logMessage + getHistory; legacy src/webhook.js has its own
// copies. No npm modules — just our db pool.
const db = require('../db'); // shared pool

// Find-or-create a conversation row for this customer, refresh its preview.
// Returns the conversation id (callers need it for logging + history).
async function saveMessage(businessId, fromNumber, customerName, text) {
  const existing = await db.query( // one chat per (business, customer number) pair…
    'SELECT id FROM conversations WHERE business_id = $1 AND customer_number = $2',
    [businessId, fromNumber]
  );
  if (existing.rows.length > 0) { // …exists → refresh preview + bump timestamp (inbox re-sorts)
    const id = existing.rows[0].id; // grab the id first (readability)
    await db.query(
      `UPDATE conversations
       SET last_message = $1, updated_at = now() WHERE id = $2`, // now() = "just active" → ORDER BY updated_at puts it on top
      [text, id]
    );
    return id;
  }
  const inserted = await db.query( // …new customer → INSERT, RETURNING id hands back the new key
    `INSERT INTO conversations (business_id, customer_number, customer_name, last_message)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [businessId, fromNumber, customerName, text]
  );
  return inserted.rows[0].id;
}

// Append ONE inbound message, but only once per provider id (Meta retries a
// slow webhook with the SAME wamid — without this the customer gets double AI
// replies). Atomic via ON CONFLICT (unique index, NULLs never conflict).
// Returns true = first time seen (proceed), false = duplicate (stop, 200 now).
async function logInboundOnce(conversationId, body, mediaUrl, providerMsgId) {
  const r = await db.query(
    `INSERT INTO messages (conversation_id, direction, body, media_url, provider_msg_id)
     VALUES ($1, 'in', $2, $3, $4) ON CONFLICT (provider_msg_id) DO NOTHING`,
    [conversationId, body, mediaUrl || null, providerMsgId || null] // || null: undefined → SQL NULL
  );
  return r.rowCount > 0; // 1 = inserted (new), 0 = conflict (Meta retry — drop it!)
}

// Append ONE message to the thread ('in' = customer wrote it, 'out' = bot sent it).
async function logMessage(conversationId, direction, body, mediaUrl) {
  await db.query( // plain INSERT, no return needed (fire-and-remember)
    'INSERT INTO messages (conversation_id, direction, body, media_url) VALUES ($1, $2, $3, $4)',
    [conversationId, direction, body, mediaUrl || null] // || null: undefined → SQL NULL
  );
}

// Last N messages, oldest-first (AI prompts read top→bottom, so DESC + reverse).
async function getHistory(conversationId, limit = 10) { // default parameter: callers may omit limit
  const historyRows = await db.query(
    `SELECT direction, body FROM messages
     WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2`, // newest N… ($2 proves LIMIT can be parameterized too)
    [conversationId, limit]
  );
  return historyRows.rows.reverse(); // .reverse() flips in place → oldest-first for the prompt
}

module.exports = { saveMessage, logMessage, logInboundOnce, getHistory }; // the chat-memory API
