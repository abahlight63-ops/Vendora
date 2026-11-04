// ── src/services/orderService.js ─────────────────────────────────
// WHAT: orders and receipts. An order is what a customer bought: items (with
// the price taken from the shop's catalog at the time), delivery, total and a
// status (pending → paid → delivered, or cancelled). Each shop numbers its own
// receipts (#0001, #0002…). Orders are the source of truth for "how much did
// we sell", receipts, follow-ups and sales insights.
// SAFETY: prices are worked out here, on the server, from the catalog; the
// browser only sends product ids and quantities (an owner may type a price for
// an item that is not in the catalog). Every query is scoped to the shop.
const db = require('../db');

const STATUSES = ['pending', 'paid', 'delivered', 'cancelled'];
const priceOf = (p) => { const m = String(p == null ? '' : p).replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
const money = (n, cur) => (cur === 'USD' ? '$' : '₦') + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Turn requested lines into priced lines. Throws a friendly Error on bad input.
function priceLines(items, products) {
  if (!Array.isArray(items) || !items.length) throw Object.assign(new Error('Add at least one item.'), { status: 400 });
  if (items.length > 40) throw Object.assign(new Error('That is a lot of items: keep it under 40 per order.'), { status: 400 });
  const byId = new Map(products.map((p) => [Number(p.id), p]));
  const byName = new Map(products.map((p) => [String(p.name).toLowerCase(), p]));
  return items.map((it) => {
    const rawQty = it.qty != null ? it.qty : it.quantity != null ? it.quantity : 1; // 0 must stay 0 (and be rejected), not become 1
    const qty = Math.round(Number(rawQty));
    if (!(qty >= 1 && qty <= 999)) throw Object.assign(new Error('Quantities must be between 1 and 999.'), { status: 400 });
    let p = it.productId != null ? byId.get(Number(it.productId)) : null;
    if (it.productId != null && !p) throw Object.assign(new Error('One of those products is no longer in your catalog.'), { status: 400 });
    if (!p && it.name) p = byName.get(String(it.name).toLowerCase()) || null;
    const typed = it.price != null && it.price !== '' ? priceOf(it.price) : null;
    const unit = typed != null ? typed : p ? priceOf(p.price) : null;
    if (unit == null || !(unit >= 0)) throw Object.assign(new Error(`Add a price for "${clean(it.name, 60) || 'this item'}" (it is not in your catalog).`), { status: 400 });
    const name = p ? p.name : clean(it.name, 120);
    if (!name) throw Object.assign(new Error('Every item needs a name.'), { status: 400 });
    return { productId: p ? Number(p.id) : null, name, qty, unitPrice: unit, lineTotal: Math.round(unit * qty * 100) / 100 };
  });
}

async function createOrder(businessId, data = {}) {
  const bid = Number(businessId);
  const { rows: products } = await db.query('SELECT id, name, price FROM products WHERE business_id = $1', [bid]);
  const lines = priceLines(data.items, products);
  const deliveryFee = data.deliveryFee != null && data.deliveryFee !== '' ? priceOf(data.deliveryFee) : 0;
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const status = STATUSES.includes(data.status) ? data.status : 'pending';
  let conversation = null;
  if (data.conversationId) {
    const { rows } = await db.query('SELECT id, customer_name, customer_number, channel FROM conversations WHERE id = $1 AND business_id = $2', [Number(data.conversationId), bid]);
    if (!rows.length) throw Object.assign(new Error('That chat was not found.'), { status: 404 });
    conversation = rows[0];
  }
  const client = await db.pool.connect(); // dedicated client: the whole order is one transaction
  try {
    await client.query('BEGIN');
    const { rows: [biz] } = await client.query('SELECT currency FROM businesses WHERE id = $1 FOR UPDATE', [bid]); // lock: receipt numbers never collide
    const { rows: [n] } = await client.query('SELECT COALESCE(MAX(receipt_no), 0) + 1 AS next FROM orders WHERE business_id = $1', [bid]);
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (business_id, conversation_id, receipt_no, customer_name, customer_number, channel, items, delivery_fee, delivery_note, subtotal, total, currency, status, source, note, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, CASE WHEN $13 IN ('paid', 'delivered') THEN now() END)
       RETURNING *`,
      [bid, conversation ? conversation.id : null, n.next,
        clean(data.customerName || (conversation && conversation.customer_name), 120) || null,
        clean(data.customerNumber || (conversation && conversation.customer_number), 80) || null,
        conversation ? conversation.channel : clean(data.channel, 20) || null,
        JSON.stringify(lines), deliveryFee, clean(data.deliveryNote, 120) || null, subtotal, subtotal + deliveryFee,
        (biz && biz.currency) || 'NGN', status, ['owner', 'velo_chat', 'auto_draft'].includes(data.source) ? data.source : 'owner', clean(data.note, 500) || null]
    );
    await client.query('COMMIT');
    return order;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function listOrders(businessId, { status, days, conversationId, limit } = {}) {
  const where = ['business_id = $1'];
  const args = [Number(businessId)];
  if (STATUSES.includes(status)) { args.push(status); where.push(`status = $${args.length}`); }
  if (Number(days) > 0) { args.push(Math.min(366, Number(days))); where.push(`created_at >= now() - ($${args.length} || ' days')::interval`); }
  if (conversationId) { args.push(Number(conversationId)); where.push(`conversation_id = $${args.length}`); }
  args.push(Math.min(200, Number(limit) || 100));
  const { rows } = await db.query(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${args.length}`, args);
  return rows;
}

async function getOrder(businessId, id) {
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 AND business_id = $2', [Number(id), Number(businessId)]);
  return rows[0] || null;
}

async function setStatus(businessId, id, status) {
  if (!STATUSES.includes(status)) throw Object.assign(new Error('Unknown status.'), { status: 400 });
  const { rows } = await db.query(
    `UPDATE orders SET status = $1, updated_at = now(), paid_at = CASE WHEN $1 IN ('paid', 'delivered') THEN COALESCE(paid_at, now()) ELSE paid_at END
     WHERE id = $2 AND business_id = $3 RETURNING *`,
    [status, Number(id), Number(businessId)]
  );
  return rows[0] || null;
}

// Plain-text receipt for WhatsApp/Telegram (no markdown: chats show raw characters).
function receiptText(order, shopName) {
  const cur = order.currency || 'NGN';
  const items = Array.isArray(order.items) ? order.items : [];
  const date = new Date(order.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
  const no = String(order.receipt_no || 0).padStart(4, '0');
  const lines = [
    `${shopName || 'Receipt'}`,
    `Receipt #${no} · ${date}`,
    order.customer_name ? `For: ${order.customer_name}` : null,
    '',
    ...items.map((l) => `${l.name} × ${l.qty}: ${money(l.lineTotal, cur)}`),
    Number(order.delivery_fee) > 0 ? `Delivery${order.delivery_note ? ` (${order.delivery_note})` : ''}: ${money(order.delivery_fee, cur)}` : null,
    '',
    `Total: ${money(order.total, cur)}`,
    `Status: ${{ pending: 'Payment pending', paid: 'Paid. Thank you!', delivered: 'Delivered. Thank you!', cancelled: 'Cancelled' }[order.status] || order.status}`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

// Numbers for Chat with Velo and Insights. Money counts paid + delivered orders only.
async function salesStats(businessId) {
  const id = Number(businessId);
  const [{ rows: [s] }, { rows: top }] = await Promise.all([
    db.query(`SELECT
        COUNT(*) FILTER (WHERE status <> 'cancelled' AND created_at >= now() - interval '7 days') AS orders7,
        COUNT(*) FILTER (WHERE status <> 'cancelled' AND created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days') AS orders_prev7,
        COUNT(*) FILTER (WHERE status <> 'cancelled' AND created_at >= now() - interval '30 days') AS orders30,
        COALESCE(SUM(total) FILTER (WHERE status IN ('paid', 'delivered') AND created_at >= now() - interval '7 days'), 0) AS revenue7,
        COALESCE(SUM(total) FILTER (WHERE status IN ('paid', 'delivered') AND created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days'), 0) AS revenue_prev7,
        COALESCE(SUM(total) FILTER (WHERE status IN ('paid', 'delivered') AND created_at >= now() - interval '30 days'), 0) AS revenue30,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_now,
        COALESCE(SUM(total) FILTER (WHERE status = 'pending'), 0) AS pending_value,
        COUNT(*) AS all_time,
        MAX(currency) AS currency
      FROM orders WHERE business_id = $1`, [id]),
    db.query(`SELECT l->>'name' AS name, SUM((l->>'qty')::int) AS qty, SUM((l->>'lineTotal')::numeric) AS value
      FROM orders o, jsonb_array_elements(o.items) AS l
      WHERE o.business_id = $1 AND o.status IN ('paid', 'delivered') AND o.created_at >= now() - interval '30 days'
      GROUP BY 1 ORDER BY qty DESC LIMIT 5`, [id]),
  ]);
  const n = (v) => Number(v) || 0;
  return {
    orders: { d7: n(s.orders7), prev7: n(s.orders_prev7), d30: n(s.orders30), allTime: n(s.all_time) },
    revenue: { d7: n(s.revenue7), prev7: n(s.revenue_prev7), d30: n(s.revenue30) },
    pending: { count: n(s.pending_now), value: n(s.pending_value) },
    topSold30: top.map((t) => ({ name: t.name, qty: n(t.qty), value: n(t.value) })),
    currency: s.currency || 'NGN',
  };
}

// Plain lines for Chat with Velo's prompt.
function formatSales(s) {
  const cur = s.currency;
  const pct = (a, b) => (!b ? (a ? 'new this period' : 'no change') : `${a >= b ? 'up' : 'down'} ${Math.abs(Math.round(((a - b) / b) * 100))}% on the 7 days before`);
  if (!s.orders.allTime) return 'Recorded orders: none yet. The owner has not recorded any orders in VeloSales, so exact sales are not known.';
  return [
    `Orders recorded in the last 7 days: ${s.orders.d7} (${pct(s.orders.d7, s.orders.prev7)}); last 30 days: ${s.orders.d30}`,
    `Money from paid and delivered orders: ${money(s.revenue.d7, cur)} in the last 7 days (${pct(s.revenue.d7, s.revenue.prev7)}); ${money(s.revenue.d30, cur)} in the last 30 days`,
    `Orders waiting for payment right now: ${s.pending.count}${s.pending.count ? ` worth ${money(s.pending.value, cur)}` : ''}`,
    `Best sellers by quantity (30 days, paid and delivered): ${s.topSold30.length ? s.topSold30.map((t) => `${t.name} ${t.qty} (${money(t.value, cur)})`).join(', ') : 'none yet'}`,
    'Note: these count only orders the owner recorded in VeloSales. Sales made elsewhere and never recorded are not included.',
  ].join('\n');
}

module.exports = { formatSales, STATUSES, priceLines, createOrder, listOrders, getOrder, setStatus, receiptText, salesStats, money, priceOf };
