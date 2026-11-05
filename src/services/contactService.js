// ── src/services/contactService.js ────────────────────────────────
// WHAT: telling customers apart from friends and family, without making the
// owner open the app.
//   conversations.contact_type: null (not decided) | 'customer' | 'personal' | 'unsure'
// HOW:
// 1. Velo learns by itself: product/price/order words → customer; "it's me",
//    "na me" early in a chat → personal (Velo goes quiet for good).
// 2. A first message that sounds personal ("Mummy I don reach house") gets a
//    gentle introduction instead of a sales reply, and the chat is marked unsure.
// 3. At most once a day the owner gets ONE message (Telegram if linked, else
//    WhatsApp) listing the unsure chats: reply "1 F" (friend) or "1 C" (customer).
//    Ignoring it is fine: unsure people are still answered politely.
// 4. The owner can also tap Friend / Customer on the chat in the Inbox.
const db = require('../db');

const SHOP_RE = /\b(price|prices|how much|hw much|cost|available|availability|in stock|stock|order|buy|sell|deliver|delivery|size|colour|color|catalog|pay|payment|account number|discount|wholesale|naira|k\b|₦|shop|open|location|address)|₦|\d{3,}/i;
const PERSONAL_RE = /\b(mummy|mommy|mum|mom|mama|daddy|dad|papa|bros|broda|bro|sis|sister|brother|aunty|auntie|uncle|babe|baby|my love|dear|darling|honey|i don reach|i've reached|i have reached|call me|pick my call|send me money|abeg send|how far your side|how body|how una dey|wetin dey happen|good morning ma|happy birthday)\b/i;
const ITS_ME_RE = /^\s*(it'?s me|its me|na me|this is me|me o|na your (brother|sister|bro|sis|friend|mum|mom|dad|aunty|uncle)|i be your (brother|sister|friend))\b/i;

// What to do with an inbound message. type = current contact_type, n = inbound count (incl. this one).
function classify(type, n, body) {
  const text = String(body || '');
  if (type === 'personal' || type === 'customer') return type === 'personal' ? 'personal' : null;
  if (ITS_ME_RE.test(text) && text.length < 80 && !SHOP_RE.test(text) && (type === 'unsure' || n <= 3)) return 'personal';
  if (SHOP_RE.test(text)) return 'customer';
  if (!type && n <= 1 && PERSONAL_RE.test(text)) return 'intro';
  return null;
}

const introText = (shopName) => `Hello! This is ${shopName || 'the shop'}'s assistant. How can I help you today?`;

async function setType(conversationId, type, businessId) {
  if (!['customer', 'personal', 'unsure', null].includes(type)) throw Object.assign(new Error('Unknown type.'), { status: 400 });
  const args = [type, Number(conversationId)];
  let where = 'id = $2';
  if (businessId) { args.push(Number(businessId)); where += ' AND business_id = $3'; }
  const { rows } = await db.query(`UPDATE conversations SET contact_type = $1, bot_paused = CASE WHEN $1 = 'personal' THEN true WHEN $1 = 'customer' AND contact_type = 'personal' THEN false ELSE bot_paused END WHERE ${where} RETURNING id, contact_type, bot_paused`, args);
  return rows[0] || null;
}

// ---- Owner's daily question (at most one message a day) ----
async function sendToOwner(b, text) {
  if (b.owner_telegram_id) {
    const token = (b.telegram_bot_token || '').trim() || (b.telegram_shared_on ? (process.env.TELEGRAM_SHARED_BOT_TOKEN || '').trim() : '');
    if (token && await require('./channels/telegram').sendText(token, String(b.owner_telegram_id), text)) return true;
  }
  const to = String(b.owner_number || '').replace(/\D/g, '');
  if (to && b.meta_token && b.meta_phone_number_id) return require('./channels/meta').sendText(b.meta_token, b.meta_phone_number_id, to, text); // works when the owner wrote in the last 24h
  return false;
}

async function digestRound() {
  const { rows: shops } = await db.query(
    `SELECT b.* FROM businesses b
      WHERE (b.contact_digest_at IS NULL OR b.contact_digest_at < now() - interval '20 hours')
        AND EXISTS (SELECT 1 FROM conversations c WHERE c.business_id = b.id AND c.contact_type = 'unsure')`
  );
  for (const b of shops) {
    try {
      const { rows: list } = await db.query(
        `SELECT id, customer_name, customer_number, last_message FROM conversations
          WHERE business_id = $1 AND contact_type = 'unsure' ORDER BY updated_at DESC LIMIT 5`, [b.id]);
      if (!list.length) continue;
      const who = (c) => (c.customer_name || '').trim() || String(c.customer_number || '').replace(/^telegram:/, 'Telegram ');
      const lines = list.map((c, i) => `${i + 1}) ${who(c)}: "${String(c.last_message || '').slice(0, 50)}"`);
      const text = `VeloSales: ${list.length === 1 ? 'one chat' : list.length + ' chats'} might be personal, so Velo only said hello:\n${lines.join('\n')}\n\nReply "1 F" if it's a friend (Velo stays quiet) or "1 C" if it's a customer. You can skip this.`;
      await db.query('UPDATE businesses SET contact_digest = $1::jsonb, contact_digest_at = now() WHERE id = $2', [JSON.stringify(list.map((c) => c.id)), b.id]);
      await sendToOwner(b, text);
    } catch (e) { console.error('contact digest shop error:', b.id, e.message); }
  }
}

// Owner replies "1 F", "2 c", "1F 2C" → apply. Returns the confirmation text, or null if not a digest answer.
const ANSWER_RE = /^\s*(\d\s*[fc]\b[\s,]*)+$/i;
async function applyOwnerAnswer(business, body) {
  if (!ANSWER_RE.test(body || '')) return null;
  let ids = business.contact_digest;
  if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
  if (!Array.isArray(ids) || !ids.length) return null;
  const done = [];
  for (const m of String(body).matchAll(/(\d)\s*([fc])/gi)) {
    const id = ids[Number(m[1]) - 1];
    if (!id) continue;
    const type = m[2].toLowerCase() === 'f' ? 'personal' : 'customer';
    if (await setType(id, type, business.id)) done.push(`${m[1]} ${type === 'personal' ? 'friend' : 'customer'}`);
  }
  return done.length ? `Got it: ${done.join(', ')}. Velo will remember.` : null;
}

function startDigest() {
  const tick = () => digestRound().catch((e) => console.error('contact digest error:', e.message));
  setTimeout(tick, 10 * 60 * 1000); // first round 10 minutes after boot
  setInterval(tick, 60 * 60 * 1000); // hourly check; each shop hears at most once in 20 hours
}

module.exports = { classify, introText, setType, digestRound, applyOwnerAnswer, startDigest, SHOP_RE, PERSONAL_RE, ITS_ME_RE };
