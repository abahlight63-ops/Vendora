// ── src/controllers/orderController.js ───────────────────────────
// WHAT: the owner's orders and receipts API (mounted under /api, login required).
//   GET  /me/orders                 ?status=&days=&conversation=  → { orders }
//   GET  /me/orders/summary         → this week / month: orders, money, waiting, best sellers
//   POST /me/orders                 { items:[{productId|name, qty, price?}], conversationId?, customerName?, deliveryFee?, deliveryNote?, status?, note? }
//   GET  /me/orders/:id             → { order, receipt }  (receipt = the plain text a customer gets)
//   POST /me/orders/:id/status      { status: pending|paid|delivered|cancelled }
//   POST /me/orders/:id/send        → sends the receipt in the order's chat
const db = require('../db');
const orders = require('../services/orderService');

const fail = (res, e, what) => {
  if (e && e.status) return res.status(e.status).json({ error: e.message });
  console.error(what + ' failed:', (e && e.code) || '-', e && e.message);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
const shopName = async (id) => { const { rows } = await db.query('SELECT name FROM businesses WHERE id = $1', [id]); return (rows[0] && rows[0].name) || ''; };

async function list(req, res) {
  try {
    const rows = await orders.listOrders(req.session.businessId, { status: req.query.status, days: req.query.days, conversationId: req.query.conversation, limit: req.query.limit });
    res.json({ orders: rows });
  } catch (e) { fail(res, e, 'orders list'); }
}

async function summary(req, res) {
  try {
    res.json(await orders.salesStats(req.session.businessId));
  } catch (e) { fail(res, e, 'orders summary'); }
}

async function create(req, res) {
  try {
    const b = req.body || {};
    const order = await orders.createOrder(req.session.businessId, { items: b.items, conversationId: b.conversationId, customerName: b.customerName, deliveryFee: b.deliveryFee, deliveryNote: b.deliveryNote, status: b.status, note: b.note, source: 'owner' });
    res.status(201).json({ order, receipt: orders.receiptText(order, await shopName(req.session.businessId)) });
  } catch (e) { fail(res, e, 'order create'); }
}

async function get(req, res) {
  try {
    const order = await orders.getOrder(req.session.businessId, req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json({ order, receipt: orders.receiptText(order, await shopName(req.session.businessId)) });
  } catch (e) { fail(res, e, 'order get'); }
}

async function status(req, res) {
  try {
    const order = await orders.setStatus(req.session.businessId, req.params.id, String((req.body && req.body.status) || ''));
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json({ order });
  } catch (e) { fail(res, e, 'order status'); }
}

async function send(req, res) {
  try {
    const order = await orders.getOrder(req.session.businessId, req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (!order.conversation_id) return res.status(400).json({ error: 'This order is not linked to a chat, so there is no one to send it to. Copy the receipt instead.' });
    const text = orders.receiptText(order, await shopName(req.session.businessId));
    const r = await require('../services/customerSend').sendToConversation(req.session.businessId, order.conversation_id, text);
    if (!r.sent) return res.status(r.status || 502).json({ error: r.error });
    await require('../services/conversationService').logMessage(order.conversation_id, 'out', text, null, 'system');
    await db.query('UPDATE orders SET receipt_sent_at = now(), updated_at = now() WHERE id = $1 AND business_id = $2', [order.id, req.session.businessId]);
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'receipt send'); }
}

module.exports = { list, summary, create, get, status, send };
