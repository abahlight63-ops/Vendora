// Refer & Earn plan credit at checkout: credit first, the rest charged, and
// never a leftover too small for the payment provider to charge.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let balance = 0;
const refPath = require.resolve(path.join(__dirname, '../src/services/referralService'));
require.cache[refPath] = { id: refPath, filename: refPath, loaded: true, exports: { creditBalance: async () => ({ balance, currency: 'NGN' }) } };
const dbPath = require.resolve(path.join(__dirname, '../src/db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async () => ({ rows: [] }) } };
const { _creditSplit: split } = require('../src/controllers/billingController');

test('no credit: pay the full price', async () => {
  balance = 0;
  assert.deepEqual(await split(1, 7499, 'NGN'), { creditMinor: 0, payMinor: 749900 });
});

test('some credit comes off the price', async () => {
  balance = 150000; // ₦1,500
  assert.deepEqual(await split(1, 7499, 'NGN'), { creditMinor: 150000, payMinor: 599900 });
});

test('credit covers the whole plan: nothing to charge', async () => {
  balance = 900000;
  assert.deepEqual(await split(1, 7499, 'NGN'), { creditMinor: 749900, payMinor: 0 });
});

test('a leftover under ₦100 is avoided by using less credit', async () => {
  balance = 745000; // would leave ₦49
  assert.deepEqual(await split(1, 7499, 'NGN'), { creditMinor: 739900, payMinor: 10000 });
});

test('dollars: a leftover under $1 is avoided too', async () => {
  balance = 450; // $4.50 against $5
  assert.deepEqual(await split(1, 5, 'USD'), { creditMinor: 400, payMinor: 100 });
});
