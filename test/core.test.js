// Small building blocks everything else leans on: phone numbers, plans,
// encrypted keys, Telegram message parsing, and error alerts.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

test('normalizePhone turns Nigerian formats into whatsapp:+234…', () => {
  const { normalizePhone } = require('../src/utils/phone');
  assert.equal(normalizePhone('0803 123 4567'), 'whatsapp:+2348031234567');
  assert.equal(normalizePhone('8031234567'), 'whatsapp:+2348031234567');
  assert.equal(normalizePhone('+234-803-123-4567'), 'whatsapp:+2348031234567');
  assert.equal(normalizePhone('whatsapp:+447700900123'), 'whatsapp:+447700900123');
  assert.equal(normalizePhone('hello'), null);
  assert.equal(normalizePhone(''), null);
});

test('plans: trial counts as Pro, expired paid plan does not', () => {
  const plan = require('../src/services/planService');
  const day = 86400000;
  assert.equal(plan.isPro({ subscription_status: 'trialing', trial_started_at: new Date(Date.now() - day) }), true);
  assert.equal(plan.isPro({ subscription_status: 'trialing', trial_started_at: new Date(Date.now() - 30 * day) }), false);
  assert.equal(plan.isPro({ bonus_pro_until: new Date(Date.now() + day) }), true); // referral-earned Pro days
  assert.equal(plan.isPro({ trial_started_at: new Date(Date.now() - 30 * day), subscription_status: 'active', subscription_expires: new Date(Date.now() + day) }), true);
  assert.equal(plan.isPro({ trial_started_at: new Date(Date.now() - 30 * day), subscription_status: 'active', subscription_expires: new Date(Date.now() - day) }), false);
  assert.equal(plan.isPro(null), false);
});

test('secret: seal/open round trip, plain values pass through', () => {
  const old = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  try {
    const s = require('../src/utils/secret');
    const sealed = s.seal('123456:ABC-def');
    assert.ok(sealed.startsWith(s.PREFIX));
    assert.notEqual(sealed, s.seal('123456:ABC-def')); // fresh IV every time
    assert.equal(s.open(sealed), '123456:ABC-def');
    assert.equal(s.open('plain-old-token'), 'plain-old-token');
    assert.equal(s.seal(''), '');
    assert.equal(s.seal(sealed), sealed); // never double-encrypts
  } finally {
    if (old === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = old;
  }
});

test('telegram parseInbound: text, photo, voice, and ignores bots', () => {
  const tg = require('../src/services/channels/telegram');
  const base = { chat: { id: 42 }, from: { id: 7, first_name: 'Ada', last_name: 'Obi' } };
  assert.deepEqual(tg.parseInbound({ message: { ...base, text: 'How much?' } }), { chatId: '42', fromId: '7', name: 'Ada Obi', kind: 'text', text: 'How much?', fileId: null, mime: null });
  assert.equal(tg.parseInbound({ message: { ...base, photo: [{ file_id: 'small' }, { file_id: 'big' }], caption: 'this one' } }).fileId, 'big');
  assert.equal(tg.parseInbound({ message: { ...base, voice: { file_id: 'v1' } } }).kind, 'voice');
  assert.equal(tg.parseInbound({ message: { ...base, from: { id: 9, is_bot: true }, text: 'hi' } }), null);
  assert.equal(tg.parseInbound({}), null);
});

test('alerts: same problem alerts once an hour, with an hourly cap', () => {
  const a = require('../src/services/alertService');
  a._reset();
  const t0 = 1_000_000;
  assert.equal(a.shouldSend('x', t0), true);
  assert.equal(a.shouldSend('x', t0 + 1000), false);
  assert.equal(a.shouldSend('x', t0 + 61 * 60 * 1000), true);
  a._reset();
  let sent = 0;
  for (let i = 0; i < 50; i++) if (a.shouldSend('sig' + i, t0)) sent++;
  assert.equal(sent, 12);
  a._reset();
});

test('alerts: secrets are scrubbed before anything is sent', () => {
  const { scrub } = require('../src/services/alertService');
  const out = scrub('GET https://api.telegram.org/bot123456:ABC-xyz/sendMessage Bearer abc.def sk_live_9999 password=hunter2');
  assert.doesNotMatch(out, /ABC-xyz|abc\.def|sk_live_9999|hunter2/);
});
