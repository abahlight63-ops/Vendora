// Orders: server-side pricing, product matching, receipts, and Velo's draft
// orders (with a fake database, so nothing real is touched).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const PRODUCTS = [
  { id: 1, name: 'Bone straight 20"', price: '₦95,000' },
  { id: 2, name: 'Lace frontal', price: '40,000' },
  { id: 3, name: 'Lace closure', price: '30000' },
  { id: 4, name: 'Mystery box', price: '' },
];

// Fake db module: records what was written, answers the reads drafts need.
const state = { openDraft: null, inserts: 0, updates: 0 };
const fakeDb = {
  query: async (sql, args) => {
    if (/FROM products/.test(sql)) return { rows: PRODUCTS };
    if (/FROM conversations/.test(sql)) return { rows: [{ id: 5, customer_name: 'Tunde', customer_number: 'telegram:42', channel: 'telegram' }] };
    if (/source = 'auto_draft'/.test(sql)) return { rows: state.openDraft ? [{ id: state.openDraft }] : [] };
    if (/^\s*UPDATE orders SET items/.test(sql)) { state.updates++; return { rows: [{ id: state.openDraft, items: JSON.parse(args[0]), total: args[1], currency: 'NGN' }] }; }
    return { rows: [] };
  },
  pool: {
    connect: async () => ({
      query: async (sql, args) => {
        if (/FOR UPDATE/.test(sql)) return { rows: [{ currency: 'NGN' }] };
        if (/MAX\(receipt_no\)/.test(sql)) return { rows: [{ next: 7 }] };
        if (/INSERT INTO orders/.test(sql)) { state.inserts++; return { rows: [{ id: 10, receipt_no: 7, items: JSON.parse(args[6]), total: args[10], status: args[12], source: args[13], currency: 'NGN' }] }; }
        return { rows: [] };
      },
      release() {},
    }),
  },
};
const dbPath = require.resolve(path.join(__dirname, '../src/db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
const o = require('../src/services/orderService');

test('priceLines prices catalog items on the server, not from the browser', () => {
  const lines = o.priceLines([{ productId: 1, qty: 2 }], PRODUCTS);
  assert.deepEqual(lines, [{ productId: 1, name: 'Bone straight 20"', qty: 2, unitPrice: 95000, lineTotal: 190000 }]);
});

test('priceLines rejects bad quantities and unknown products', () => {
  assert.throws(() => o.priceLines([{ productId: 1, qty: 0 }], PRODUCTS), /between 1 and 999/);
  assert.throws(() => o.priceLines([{ productId: 99, qty: 1 }], PRODUCTS), /no longer in your catalog/);
  assert.throws(() => o.priceLines([], PRODUCTS), /at least one item/);
});

test('matchProduct: exact, unique partial, and refuses to guess', () => {
  assert.equal(o.matchProduct('bone straight 20"', PRODUCTS).id, 1);
  assert.equal(o.matchProduct('frontal', PRODUCTS).id, 2);
  assert.equal(o.matchProduct('lace', PRODUCTS), null); // frontal or closure? not sure → no match
  assert.equal(o.matchProduct('iPhone', PRODUCTS), null);
});

test('receiptText is plain text with total and status', () => {
  const t = o.receiptText({ receipt_no: 7, created_at: '2026-11-05T10:00:00Z', customer_name: 'Tunde', items: [{ name: 'Wig', qty: 2, lineTotal: 190000 }], delivery_fee: 3000, total: 193000, status: 'pending', currency: 'NGN' }, 'Amaka Hair');
  assert.match(t, /^Amaka Hair\nReceipt #0007/);
  assert.match(t, /Wig × 2: ₦190,000/);
  assert.match(t, /Delivery: ₦3,000/);
  assert.match(t, /Total: ₦193,000\nStatus: Payment pending$/);
});

test('draftFromChat makes a pending auto_draft order priced from the catalog', async () => {
  state.openDraft = null;
  const d = await o.draftFromChat(1, 5, [{ name: 'Bone straight 20"', qty: 2 }]);
  assert.equal(d.updated, false);
  assert.equal(d.order.source, 'auto_draft');
  assert.equal(d.order.status, 'pending');
  assert.equal(d.order.total, 190000);
});

test('draftFromChat updates the open draft instead of making a second one', async () => {
  state.openDraft = 10;
  const before = state.inserts;
  const d = await o.draftFromChat(1, 5, [{ name: 'Lace frontal', qty: 3 }]);
  assert.equal(d.updated, true);
  assert.equal(d.order.total, 120000);
  assert.equal(state.inserts, before);
});

test('draftFromChat skips unknown or unpriced items', async () => {
  assert.equal(await o.draftFromChat(1, 5, [{ name: 'iPhone 15', qty: 1 }]), null);
  assert.equal(await o.draftFromChat(1, 5, [{ name: 'Mystery box', qty: 1 }]), null);
  assert.equal(await o.draftFromChat(1, null, [{ name: 'Lace frontal', qty: 1 }]), null);
});
