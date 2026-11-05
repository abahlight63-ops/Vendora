// Customer reply polish: plain text, hidden order line, human tone.
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../src/services/replyEngine');

test('cleanReply strips markdown and emoji but keeps bullets and line breaks', () => {
  const out = r.cleanReply('### Price\n**Bone straight** is ₦95,000 😍\n- Black\n- Brown');
  assert.equal(out, 'Price\nBone straight is ₦95,000\n• Black\n• Brown');
});

test('takeOrderLine pulls the hidden ORDER line out of the reply', () => {
  const { text, order } = r.takeOrderLine('That is ₦190,000 for two.\nORDER: Bone straight 20" x 2; Lace frontal x 1');
  assert.equal(text, 'That is ₦190,000 for two.');
  assert.deepEqual(order, [{ name: 'Bone straight 20"', qty: 2 }, { name: 'Lace frontal', qty: 1 }]);
});

test('takeOrderLine leaves normal replies alone', () => {
  assert.deepEqual(r.takeOrderLine('Na ₦95,000, e dey available.'), { text: 'Na ₦95,000, e dey available.', order: null });
});

test('takeOrderLine defaults quantity to 1 and accepts (2) style', () => {
  assert.deepEqual(r.takeOrderLine('ok\nORDER: Wig (2); Cap').order, [{ name: 'Wig', qty: 2 }, { name: 'Cap', qty: 1 }]);
});

test('humanize removes stock openers and office phrases', () => {
  assert.equal(r.humanize('Great question! Certainly, kindly note that it is ₦5,000. Feel free to reach out if you need anything.'), 'It is ₦5,000.');
  assert.equal(r.humanize('Absolutely! We have it in black.'), 'We have it in black.');
});

test('humanize never touches handoff flags', () => {
  assert.equal(r.humanize('NEED_HUMAN: custom order'), 'NEED_HUMAN: custom order');
  assert.equal(r.humanize('PAYMENT_PROOF'), 'PAYMENT_PROOF');
});

test('humanize keeps a reply that is only an opener', () => {
  assert.equal(r.humanize('Certainly!'), 'Certainly!');
});
