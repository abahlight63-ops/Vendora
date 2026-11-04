// ── src/services/broadcastService.js ──────────────────────────────
// WHAT: broadcasts. One message from the owner to many past customers
// ("New stock just landed!"), each sent in that customer's own chat.
//
// RULES (customer trust and channel rules first):
// - Customers who replied STOP never get broadcasts (conversations.promo_opt_out).
// - Every broadcast ends with "Reply STOP to stop these messages."
// - Telegram: any past customer, free.
// - WhatsApp: free text only to customers who wrote in the last 24 hours (Meta's
//   rule). Everyone older needs an approved WhatsApp template, which Meta bills
//   to the shop's own WhatsApp account; without one they are skipped and counted.
// - Plan limits: Free 1 a week (up to 100 people), Plus 1 a day (1,000),
//   Pro and Business 3 a day (5,000).
// Sending runs in the background, one message at a time, and fills in counts.
const db = require('../db');
const planService = require('./planService');
const conversationService = require('./conversationService');
const { TODAY_START } = require('../utils/lagosDay');

const AUDIENCES = {
  all: 'Everyone who has messaged you',
  recent: 'Messaged in the last 30 days',
  bought: 'Customers who bought (paid or delivered orders)',
  not_bought: 'Asked in the last 30 days but did not buy',
};
const CHANNELS = ['all', 'whatsapp', 'telegram'];
const FOOTER = '\n\nReply STOP to stop these messages.';
const LIMITS = { free: { count: 1, per: 'week', max: 100 }, pro: { count: 1, per: 'day', max: 1000 }, plus: { count: 3, per: 'day', max: 5000 }, business: { count: 3, per: 'day', max: 5000 } };
const err = (status, message) => Object.assign(new Error(message), { status });

function limitFor(business) {
  const tier = planService.effectiveTier(business);
  return { tier, ...(LIMITS[tier] || LIMITS.free) };
}

// Who would receive it. Returns rows: { id, customer_name, customer_number, channel, fresh } (fresh = wrote in the last 24h).
async function audience(businessId, aud, channel) {
  const where = ['c.business_id = $1', 'COALESCE(c.promo_opt_out, false) = false', "COALESCE(c.customer_number, '') <> ''"];
  if (channel === 'telegram') where.push("c.customer_number LIKE 'telegram:%'");
  if (channel === 'whatsapp') where.push("c.customer_number NOT LIKE 'telegram:%'");
  if (aud === 'recent') where.push("last_in.at >= now() - interval '30 days'");
  if (aud === 'bought') where.push("EXISTS (SELECT 1 FROM orders o WHERE o.conversation_id = c.id AND o.status IN ('paid', 'delivered'))");
  if (aud === 'not_bought') where.push("last_in.at >= now() - interval '30 days'", "NOT EXISTS (SELECT 1 FROM orders o WHERE o.conversation_id = c.id AND o.status <> 'cancelled')");
  const { rows } = await db.query(
    `SELECT c.id, c.customer_name, c.customer_number,
            CASE WHEN c.customer_number LIKE 'telegram:%' THEN 'telegram' ELSE 'whatsapp' END AS channel,
            (last_in.at >= now() - interval '24 hours') AS fresh
       FROM conversations c
       LEFT JOIN LATERAL (SELECT MAX(m.created_at) AS at FROM messages m WHERE m.conversation_id = c.id AND m.direction = 'in') last_in ON true
      WHERE ${where.join(' AND ')} AND last_in.at IS NOT NULL
      ORDER BY last_in.at DESC
      LIMIT 5000`,
    [Number(businessId)]
  );
  return rows;
}

async function usedInWindow(businessId, per) {
  const since = per === 'week' ? "now() - interval '7 days'" : TODAY_START;
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM broadcasts WHERE business_id = $1 AND created_at >= ${since}`, [Number(businessId)]);
  return rows[0].n;
}

// Counts for the screen before sending.
async function preview(business, aud, channel) {
  aud = AUDIENCES[aud] ? aud : 'all';
  channel = CHANNELS.includes(channel) ? channel : 'all';
  const rows = await audience(business.id, aud, channel);
  const lim = limitFor(business);
  const used = await usedInWindow(business.id, lim.per);
  const tg = rows.filter((r) => r.channel === 'telegram').length;
  const waFresh = rows.filter((r) => r.channel === 'whatsapp' && r.fresh).length;
  const waOld = rows.filter((r) => r.channel === 'whatsapp' && !r.fresh).length;
  return {
    audience: aud, channel, total: rows.length,
    telegram: tg, whatsappFree: waFresh, whatsappNeedsTemplate: waOld,
    capped: rows.length > lim.max, max: lim.max,
    limit: { tier: lim.tier, count: lim.count, per: lim.per, used, left: Math.max(0, lim.count - used) },
    audiences: AUDIENCES,
  };
}

const firstName = (r) => String(r.customer_name || '').trim().split(/\s+/)[0] || '';
const personalise = (msg, r) => msg.replace(/\{name\}/gi, firstName(r) || 'there');

async function start(business, { message, audience: aud, channel, waTemplate, waLang }) {
  const text = String(message || '').trim();
  if (text.length < 2) throw err(400, 'Write the message first.');
  if (text.length > 1000) throw err(400, 'Keep it under 1,000 characters.');
  aud = AUDIENCES[aud] ? aud : 'all';
  channel = CHANNELS.includes(channel) ? channel : 'all';
  const tpl = String(waTemplate || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 512) || null;
  const lang = String(waLang || 'en').trim().slice(0, 10) || 'en';
  const lim = limitFor(business);
  if ((await usedInWindow(business.id, lim.per)) >= lim.count) {
    throw err(429, lim.per === 'week'
      ? 'The free plan includes one broadcast a week. Upgrade to Plus to send one every day.'
      : `You have sent ${lim.count === 1 ? 'today\'s broadcast' : `all ${lim.count} broadcasts for today`}. Try again tomorrow.`);
  }
  const rows = (await audience(business.id, aud, channel)).slice(0, lim.max);
  if (!rows.length) throw err(400, 'Nobody to send to yet. Customers appear here after they message you.');
  const { rows: [b] } = await db.query(
    `INSERT INTO broadcasts (business_id, message, audience, channel, wa_template, wa_lang, recipients, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'sending') RETURNING *`,
    [business.id, text, aud, channel, tpl, lang, rows.length]
  );
  run(business, b, rows, text, tpl, lang).catch((e) => console.error('broadcast run failed:', b.id, e.message));
  return b;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(business, b, rows, text, tpl, lang) {
  const send = require('./customerSend');
  const meta = require('./channels/meta');
  let sent = 0, failed = 0, skipped = 0;
  for (const r of rows) {
    const body = personalise(text, r) + FOOTER;
    let ok = false;
    try {
      if (r.channel === 'whatsapp' && !r.fresh) {
        if (!tpl) { skipped++; continue; } // older than 24h and no template: WhatsApp would refuse it
        ok = await meta.sendTemplate(business.meta_token, business.meta_phone_number_id, String(r.customer_number).replace(/\D/g, ''), tpl, lang, body);
      } else {
        ok = (await send.sendToConversation(business.id, r.id, body)).sent;
      }
    } catch (e) { ok = false; }
    if (ok) { sent++; await conversationService.logMessage(r.id, 'out', body, null, 'owner').catch(() => {}); } else failed++;
    if ((sent + failed) % 10 === 0) await db.query('UPDATE broadcasts SET sent = $1, failed = $2, skipped = $3 WHERE id = $4', [sent, failed, skipped, b.id]).catch(() => {});
    await wait(r.channel === 'telegram' ? 80 : 250); // gentle pace: stays inside both channels' rate limits
  }
  await db.query("UPDATE broadcasts SET sent = $1, failed = $2, skipped = $3, status = 'done', finished_at = now() WHERE id = $4", [sent, failed, skipped, b.id]);
}

async function list(businessId) {
  const { rows } = await db.query('SELECT id, message, audience, channel, wa_template, recipients, sent, failed, skipped, status, created_at, finished_at FROM broadcasts WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50', [Number(businessId)]);
  return rows;
}

// "STOP" from a customer: no more broadcasts to this chat.
const STOP_RE = /^\s*(stop|unsubscribe|stop promo|stop promos|stop broadcast)\s*[.!]*\s*$/i;
async function optOut(conversationId) {
  await db.query('UPDATE conversations SET promo_opt_out = true WHERE id = $1', [Number(conversationId)]);
}

module.exports = { AUDIENCES, LIMITS, FOOTER, STOP_RE, preview, start, list, optOut, audience, limitFor };
