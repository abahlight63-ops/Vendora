// ── src/services/shopStats.js ────────────────────────────────────
// WHAT: real shop numbers for Chat with Velo ("how did my shop do this week?").
// Everything comes from rows the app already stores: chats, messages, flagged
// chats, products and the stock log the owner writes from WhatsApp.
// HONEST GAPS: there are no order records yet, so exact sales and revenue are
// NOT known. The closest real figure is stock the owner logged as taken out
// (sold, used or spoiled). The prompt text says so, and Velo must say so too.
// Times are Africa/Lagos. "Replies sent" counts Velo's and the owner's replies.
const db = require('../db');

const TZ = 'Africa/Lagos';
const num = (v) => Number(v) || 0;
const priceOf = (p) => { const m = String(p || '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
const money = (n, cur) => (cur === 'USD' ? '$' : '₦') + Math.round(n).toLocaleString('en-NG');
const change = (now, before) => {
  if (!before && !now) return 'no change';
  if (!before) return 'new this period';
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? 'same as the 7 days before' : `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% on the 7 days before (${before})`;
};

// Product names customers are likely to type: the full name, or its first two words.
function keysFor(name) {
  const n = String(name || '').toLowerCase().replace(/["'”“]/g, '').trim();
  const words = n.split(/\s+/).filter((w) => w.length >= 3);
  const keys = new Set([n]);
  if (words.length >= 2) keys.add(words.slice(0, 2).join(' '));
  else if (words[0] && words[0].length >= 5) keys.add(words[0]);
  return [...keys].filter(Boolean);
}

async function getShopStats(businessId) {
  const id = Number(businessId);
  const [{ rows: [m] }, { rows: [n] }, { rows: ch }, { rows: flags }, { rows: [open] }, { rows: [day] }, { rows: [hour] }, { rows: bodies }, { rows: products }, { rows: stock }, { rows: [biz] }] = await Promise.all([
    db.query(`SELECT
        COUNT(DISTINCT c.id) FILTER (WHERE m.direction='in' AND m.created_at >= now() - interval '7 days') AS chats7,
        COUNT(DISTINCT c.id) FILTER (WHERE m.direction='in' AND m.created_at >= now() - interval '14 days' AND m.created_at < now() - interval '7 days') AS chats_prev7,
        COUNT(DISTINCT c.id) FILTER (WHERE m.direction='in' AND m.created_at >= now() - interval '30 days') AS chats30,
        COUNT(DISTINCT c.id) FILTER (WHERE m.direction='in' AND (m.created_at AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date) AS chats_today,
        COUNT(*) FILTER (WHERE m.direction='in' AND m.created_at >= now() - interval '7 days') AS in7,
        COUNT(*) FILTER (WHERE m.direction='out' AND m.created_at >= now() - interval '7 days') AS out7,
        COUNT(DISTINCT c.id) FILTER (WHERE m.direction='out' AND m.created_at >= now() - interval '7 days') AS answered7
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.business_id = $1 AND m.created_at >= now() - interval '30 days'`, [id]),
    db.query(`SELECT
        COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS new7,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days') AS new_prev7,
        COUNT(*) AS new30
      FROM conversations WHERE business_id = $1 AND created_at >= now() - interval '30 days'`, [id]),
    db.query(`SELECT c.channel, COUNT(DISTINCT c.id) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.business_id = $1 AND m.direction = 'in' AND m.created_at >= now() - interval '7 days' GROUP BY c.channel ORDER BY n DESC`, [id]),
    db.query(`SELECT COALESCE(NULLIF(flag_reason, ''), 'not given') AS reason, COUNT(*) AS n FROM conversations
      WHERE business_id = $1 AND needs_human AND updated_at >= now() - interval '30 days' GROUP BY 1 ORDER BY n DESC LIMIT 3`, [id]),
    db.query('SELECT COUNT(*) AS n FROM conversations WHERE business_id = $1 AND needs_human', [id]),
    db.query(`SELECT to_char(m.created_at AT TIME ZONE '${TZ}', 'FMDay') AS d, COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.business_id = $1 AND m.direction = 'in' AND m.created_at >= now() - interval '30 days' GROUP BY 1 ORDER BY n DESC LIMIT 1`, [id]),
    db.query(`SELECT EXTRACT(HOUR FROM m.created_at AT TIME ZONE '${TZ}')::int AS h, COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.business_id = $1 AND m.direction = 'in' AND m.created_at >= now() - interval '30 days' GROUP BY 1 ORDER BY n DESC LIMIT 1`, [id]),
    db.query(`SELECT lower(m.body) AS b FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.business_id = $1 AND m.direction = 'in' AND m.created_at >= now() - interval '30 days' ORDER BY m.created_at DESC LIMIT 3000`, [id]),
    db.query('SELECT id, name, price FROM products WHERE business_id = $1', [id]),
    db.query(`SELECT product_id, item, SUM(old_value - new_value) AS units,
        SUM(old_value - new_value) FILTER (WHERE created_at >= now() - interval '7 days') AS units7
      FROM inventory_logs WHERE business_id = $1 AND operation = 'remove' AND created_at >= now() - interval '30 days'
      GROUP BY product_id, item ORDER BY units DESC`, [id]),
    db.query('SELECT currency FROM businesses WHERE id = $1', [id]),
  ]);
  const cur = (biz && biz.currency) || 'NGN';

  // most-asked products (30 days): a message counts once per product it names
  const asked = products.map((p) => {
    const keys = keysFor(p.name);
    const count = bodies.reduce((s, r) => s + (keys.some((k) => r.b && r.b.includes(k)) ? 1 : 0), 0);
    return { name: p.name, count };
  }).filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  const priceById = new Map(products.map((p) => [p.id, priceOf(p.price)]));
  const stockRows = stock.map((s) => ({ item: s.item, units: num(s.units), units7: num(s.units7), value: num(s.units) * (priceById.get(s.product_id) || 0), value7: num(s.units7) * (priceById.get(s.product_id) || 0) }));
  const units7 = stockRows.reduce((s, r) => s + r.units7, 0), units30 = stockRows.reduce((s, r) => s + r.units, 0);
  const value7 = stockRows.reduce((s, r) => s + r.value7, 0), value30 = stockRows.reduce((s, r) => s + r.value, 0);

  return {
    chats: { today: num(m.chats_today), d7: num(m.chats7), prev7: num(m.chats_prev7), d30: num(m.chats30) },
    newCustomers: { d7: num(n.new7), prev7: num(n.new_prev7), d30: num(n.new30) },
    messages7: { in: num(m.in7), out: num(m.out7) },
    answered7: num(m.answered7),
    channels7: ch.map((r) => ({ channel: r.channel || 'whatsapp', chats: num(r.n) })),
    needsYouNow: num(open && open.n),
    flagReasons30: flags.map((r) => ({ reason: r.reason, count: num(r.n) })),
    busiestDay30: day ? day.d : null,
    busiestHour30: hour ? hour.h : null,
    mostAsked30: asked,
    stockOut: { units7, units30, value7, value30, top: stockRows.slice(0, 3) },
    currency: cur,
  };
}

// Plain text for the prompt. Every line is a fact; the closing note says what is NOT known.
function formatStats(s) {
  const clock = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
  const hourTxt = (h) => (h == null ? 'not enough data' : `${clock(h)} to ${clock((h + 1) % 24)}`);
  const lines = [
    `Chats today: ${s.chats.today}`,
    `Chats in the last 7 days: ${s.chats.d7} (${change(s.chats.d7, s.chats.prev7)})`,
    `Chats in the last 30 days: ${s.chats.d30}`,
    `New customers: ${s.newCustomers.d7} in the last 7 days (${change(s.newCustomers.d7, s.newCustomers.prev7)}), ${s.newCustomers.d30} in 30 days`,
    `Messages in the last 7 days: ${s.messages7.in} from customers, ${s.messages7.out} replies sent (by Velo and by the owner together)`,
    `Chats that got a reply in the last 7 days: ${s.answered7} of ${s.chats.d7}`,
    `Chats per app, last 7 days: ${s.channels7.length ? s.channels7.map((c) => `${c.channel} ${c.chats}`).join(', ') : 'none'}`,
    `Chats waiting for the owner right now: ${s.needsYouNow}`,
    `Why chats were handed to the owner (30 days): ${s.flagReasons30.length ? s.flagReasons30.map((f) => `${f.reason} (${f.count})`).join('; ') : 'none'}`,
    `Busiest day (30 days): ${s.busiestDay30 || 'not enough data'}. Busiest hour: ${hourTxt(s.busiestHour30)} (Lagos time)`,
    `Most-asked products (30 days, by chats mentioning them): ${s.mostAsked30.length ? s.mostAsked30.map((a) => `${a.name} (${a.count})`).join(', ') : 'none found'}`,
    `Stock the owner logged as taken out (sold, used or spoiled): ${s.stockOut.units7} items in 7 days${s.stockOut.value7 ? ` worth about ${money(s.stockOut.value7, s.currency)} at catalog prices` : ''}; ${s.stockOut.units30} items in 30 days${s.stockOut.value30 ? ` worth about ${money(s.stockOut.value30, s.currency)}` : ''}${s.stockOut.top.length ? `. Top: ${s.stockOut.top.map((t) => `${t.item} ${t.units}`).join(', ')}` : ''}`,
  ];
  return lines.join('\n');
}

module.exports = { getShopStats, formatStats, keysFor, priceOf };
