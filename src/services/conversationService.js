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

// Append ONE message to the thread ('in' = customer wrote it, 'out' = we sent it).
// sender (for 'out'): 'bot' = Velo replied (counts toward the daily limit),
// 'owner' = the owner typed it in the Inbox, 'system' = a limit notice.
async function logMessage(conversationId, direction, body, mediaUrl, sender = 'bot') {
  await db.query( // plain INSERT, no return needed (fire-and-remember)
    'INSERT INTO messages (conversation_id, direction, body, media_url, sender) VALUES ($1, $2, $3, $4, $5)',
    [conversationId, direction, body, mediaUrl || null, direction === 'in' ? 'customer' : sender] // || null: undefined → SQL NULL
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

// Coexistence echoes: the owner typed a reply in the WhatsApp Business app on
// their phone. Log it in that chat as the owner's message and pause Velo there,
// so Velo never talks over the owner (the Inbox shows "You are answering" and
// "Velo answers" hands it back).
async function ownerEcho(phoneId, echoes) {
  const { rows } = await db.query('SELECT id FROM businesses WHERE meta_phone_number_id = $1 LIMIT 1', [String(phoneId)]);
  if (!rows.length) return;
  const businessId = rows[0].id;
  for (const e of echoes.slice(0, 50)) {
    const to = String((e && e.to) || '').replace(/\D/g, '');
    if (!to) continue;
    const text = e.type === 'text' && e.text ? String(e.text.body || '') : `[you sent ${e.type === 'image' ? 'a photo' : 'a message'} from your phone]`;
    const number = 'whatsapp:+' + to;
    const found = await db.query('SELECT id FROM conversations WHERE business_id = $1 AND customer_number = $2', [businessId, number]);
    const id = found.rows.length ? found.rows[0].id
      : (await db.query('INSERT INTO conversations (business_id, customer_number, last_message) VALUES ($1, $2, $3) RETURNING id', [businessId, number, text])).rows[0].id;
    await db.query('UPDATE conversations SET last_reply = $1, bot_paused = true, updated_at = now() WHERE id = $2', [text, id]);
    await logMessage(id, 'out', text, null, 'owner');
  }
}

module.exports = { saveMessage, logMessage, logInboundOnce, getHistory, ownerEcho }; // the chat-memory API
