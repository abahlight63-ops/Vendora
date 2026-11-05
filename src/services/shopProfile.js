// ── src/services/shopProfile.js ───────────────────────────────────
// WHAT: the Shop profile (Settings → Your shop): everything Velo needs to know
// about a shop beyond the catalog. Stored in businesses.shop_profile (JSONB):
//   about, languages[], address, pickup, delivery[{area, fee, time}],
//   payment{methods[], bank, account, accountName}, returns,
//   niche{<question key>: answer}, facts[{text, at}] (owner corrections)
// Name, type of business, hours and FAQs keep their own columns.
// Used by: customer replies (replyEngine), Chat with Velo, the "Velo knows X%"
// meter, and "Fill it in for me".
const db = require('../db');

const clean = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const cleanBlock = (v, max = 1200) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const LANGS = ['English', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa', 'French'];
const PAY = ['Bank transfer', 'Pay on delivery', 'Paystack link', 'POS', 'USSD', 'Cash'];

// Questions for each type of business (labels match lib/niches.js on the web).
const Q = {
  fashion: [['sizes', 'Sizes you carry', 'S to XXL, UK 8 to 18'], ['custom', 'Do you sew or alter to fit?', 'Yes, alterations in 2 days'], ['restock', 'How often new stock arrives', 'Every Friday']],
  beauty: [['bookings', 'Do you take bookings?', 'By appointment and walk-ins'], ['home', 'Home service', 'Yes, from ₦10,000 within Lagos'], ['duration', 'How long a service takes', 'Installs take 2 to 3 hours']],
  food: [['menu_days', 'Days and times you cook or deliver', 'Mon to Sat, orders by 10am'], ['preorder', 'How far ahead to order', '24 hours for trays and cakes'], ['allergens', 'Ingredients people ask about', 'Contains nuts, no pork']],
  electronics: [['warranty', 'Warranty', '6 months on new phones'], ['condition', 'New or used', 'New and UK-used, clearly marked'], ['swap', 'Do you swap or buy old devices?', 'Yes, we swap']],
  services: [['booking', 'How to book you', 'Send a date and the type of job'], ['deposit', 'Deposit', '50% to confirm'], ['area', 'Where you work', 'Anywhere in Lagos']],
  goods: [['wholesale', 'Wholesale or bulk prices', 'From 10 pieces'], ['restock', 'How often new stock arrives', 'Weekly'], ['custom', 'Custom orders', 'Yes, 5 working days']],
};
function nicheGroup(niche) {
  const n = String(niche || '').toLowerCase();
  if (/hair|salon|barber|makeup|beauty|cosmetic|nail/.test(n)) return 'beauty';
  if (/cloth|fashion|sneaker|footwear|thrift|vintage/.test(n)) return 'fashion';
  if (/food|bak|cater|cake|grocer|fruit|produce/.test(n)) return 'food';
  if (/electronic|gadget|phone/.test(n)) return 'electronics';
  if (/freelance|tutor|coach|event|photo|video|real estate|logistic|delivery|errand|fitness/.test(n)) return 'services';
  return 'goods';
}
const questionsFor = (niche) => Q[nicheGroup(niche)].map(([key, label, placeholder]) => ({ key, label, placeholder }));

function read(raw) {
  let p = raw;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = {}; } }
  return p && typeof p === 'object' ? p : {};
}

// Keep only known fields, in safe sizes.
function normalize(input, prev = {}) {
  const p = { ...read(prev) };
  const i = read(input);
  if ('about' in i) p.about = cleanBlock(i.about, 1000);
  if ('languages' in i) p.languages = (Array.isArray(i.languages) ? i.languages : []).filter((l) => LANGS.includes(l));
  if ('address' in i) p.address = clean(i.address, 200);
  if ('pickup' in i) p.pickup = clean(i.pickup, 160);
  if ('delivery' in i) p.delivery = (Array.isArray(i.delivery) ? i.delivery : []).slice(0, 15).map((d) => ({ area: clean(d && d.area, 80), fee: clean(d && d.fee, 30), time: clean(d && d.time, 40) })).filter((d) => d.area || d.fee);
  if ('payment' in i) {
    const pay = read(i.payment);
    p.payment = { methods: (Array.isArray(pay.methods) ? pay.methods : []).filter((m) => PAY.includes(m)), bank: clean(pay.bank, 60), account: clean(pay.account, 20).replace(/[^\d]/g, ''), accountName: clean(pay.accountName, 80), link: clean(pay.link, 200) };
  }
  if ('returns' in i) p.returns = cleanBlock(i.returns, 600);
  if ('niche' in i) { const n = read(i.niche); p.niche = {}; for (const k of Object.keys(n).slice(0, 10)) p.niche[clean(k, 30)] = clean(n[k], 200); }
  if ('facts' in i) p.facts = (Array.isArray(i.facts) ? i.facts : []).slice(-30).map((f) => ({ text: clean(f && f.text, 240), at: (f && f.at) || new Date().toISOString() })).filter((f) => f.text);
  return p;
}

// "Velo knows X% of your shop": weighted sections, with what is missing.
function completeness(b) {
  const p = read(b.shop_profile);
  const niche = p.niche || {};
  const parts = [
    ['about', 'About your shop', 20, !!(p.about && p.about.length > 20 && b.business_niche)],
    ['location', 'Location and hours', 15, !!((p.address || p.pickup) && b.hours)],
    ['delivery', 'Delivery fees', 20, Array.isArray(p.delivery) && p.delivery.some((d) => d.fee)],
    ['payment', 'Payment details', 20, !!(p.payment && p.payment.methods && p.payment.methods.length && (p.payment.account || p.payment.link || p.payment.methods.every((m) => m === 'Pay on delivery' || m === 'Cash')))],
    ['returns', 'Returns', 10, !!(p.returns && p.returns.length > 5)],
    ['niche', 'Questions for your type of business', 15, Object.values(niche).filter(Boolean).length >= 2],
  ];
  const pct = parts.reduce((s, x) => s + (x[3] ? x[2] : 0), 0);
  return { pct, missing: parts.filter((x) => !x[3]).map(([key, label]) => ({ key, label })), done: parts.filter((x) => x[3]).map(([key]) => key) };
}

// The text Velo reads (customer replies and Chat with Velo). forOwner adds facts the owner taught.
function format(b) {
  const p = read(b.shop_profile);
  const lines = [];
  if (p.about) lines.push(`About the shop: ${p.about}`);
  if (p.languages && p.languages.length) lines.push(`Customers write in: ${p.languages.join(', ')}`);
  if (p.address) lines.push(`Address: ${p.address}`);
  if (p.pickup) lines.push(`Pickup: ${p.pickup}`);
  if (p.delivery && p.delivery.length) lines.push('Delivery (area: fee, time):\n' + p.delivery.map((d) => `- ${d.area || 'Other areas'}: ${d.fee || 'fee not set'}${d.time ? ', ' + d.time : ''}`).join('\n'));
  if (p.payment && p.payment.methods && p.payment.methods.length) {
    let pay = `Payment methods: ${p.payment.methods.join(', ')}`;
    if (p.payment.account) pay += `\nBank details (share ONLY when the customer is ready to pay or asks how to pay): ${p.payment.bank || 'Bank'} ${p.payment.account}${p.payment.accountName ? ', ' + p.payment.accountName : ''}`;
    if (p.payment.link) pay += `\nPayment link (share only when they are ready to pay): ${p.payment.link}`;
    lines.push(pay);
  }
  if (p.returns) lines.push(`Returns and guarantees: ${p.returns}`);
  const qs = questionsFor(b.business_niche);
  const nicheLines = qs.map((q) => (p.niche && p.niche[q.key] ? `- ${q.label}: ${p.niche[q.key]}` : null)).filter(Boolean);
  if (nicheLines.length) lines.push('More about how the shop works:\n' + nicheLines.join('\n'));
  if (p.facts && p.facts.length) lines.push('Facts the owner confirmed (these override anything else):\n' + p.facts.map((f) => `- ${f.text}`).join('\n'));
  return lines.join('\n');
}

async function load(businessId) {
  const { rows } = await db.query('SELECT id, name, business_niche, hours, faq, shop_profile, profile_snapshot, owner_number, currency, timezone, personal_contacts FROM businesses WHERE id = $1', [Number(businessId)]);
  return rows[0] || null;
}
async function save(businessId, body = {}) {
  const b = await load(businessId);
  if (!b) throw Object.assign(new Error('Shop not found.'), { status: 404 });
  const next = normalize(body.profile || {}, b.shop_profile);
  const sets = ['shop_profile = $2']; const args = [b.id, JSON.stringify(next)];
  if (typeof body.name === 'string' && body.name.trim()) { args.push(clean(body.name, 80)); sets.push(`name = $${args.length}`); }
  if (typeof body.niche === 'string' && body.niche.trim()) { args.push(clean(body.niche, 80)); sets.push(`business_niche = $${args.length}`); }
  if (typeof body.hours === 'string') { args.push(clean(body.hours, 120)); sets.push(`hours = $${args.length}`); }
  if (Array.isArray(body.faq)) { args.push(JSON.stringify(body.faq.slice(0, 40).map((f) => ({ question: clean(f && f.question, 200), answer: clean(f && f.answer, 600) })).filter((f) => f.question && f.answer))); sets.push(`faq = $${args.length}::jsonb`); }
  await db.query(`UPDATE businesses SET ${sets.join(', ')} WHERE id = $1`, args);
  return view(await load(businessId));
}
function view(b) {
  return { name: b.name, niche: b.business_niche, hours: b.hours, faq: Array.isArray(b.faq) ? b.faq : read(b.faq) || [], profile: read(b.shop_profile), questions: questionsFor(b.business_niche), meter: completeness(b), languages: LANGS, payMethods: PAY };
}

// "Fill it in for me": drafts from the WhatsApp business profile, the catalog
// and the owner's own recent replies. Every suggestion says where it came from;
// guesses are marked unsure so the owner checks them first. Nothing is saved here.
async function fill(businessId) {
  const b = await load(businessId);
  if (!b) throw Object.assign(new Error('Shop not found.'), { status: 404 });
  const [{ rows: products }, { rows: said }, { rows: inbound }] = await Promise.all([
    db.query('SELECT name, price, category, delivery_info, location, how_to_buy FROM products WHERE business_id = $1 ORDER BY id DESC LIMIT 40', [b.id]),
    db.query(`SELECT m.body FROM messages m JOIN conversations c ON c.id = m.conversation_id
               WHERE c.business_id = $1 AND m.direction = 'out' AND m.sender IN ('owner', 'bot')
                 AND m.body ~* '(deliver|delivery|transfer|account|pay|return|exchange|pickup|address|open)' ORDER BY m.created_at DESC LIMIT 25`, [b.id]),
    db.query(`SELECT m.body FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.business_id = $1 AND m.direction = 'in' ORDER BY m.created_at DESC LIMIT 60`, [b.id]),
  ]);
  const out = [];
  const pidgin = inbound.filter((r) => /\b(abeg|wetin|dey|una|how far|na im|oya|wahala|abi)\b/i.test(r.body || '')).length;
  if (inbound.length >= 5) out.push({ field: 'languages', label: 'Languages', value: pidgin >= 3 ? ['English', 'Pidgin'] : ['English'], text: pidgin >= 3 ? 'English and Pidgin' : 'English', from: "From your customers' chats", sure: true });
  const facts = [
    b.profile_snapshot ? `WHATSAPP BUSINESS PROFILE:\n${String(b.profile_snapshot).slice(0, 2000)}` : '',
    products.length ? `CATALOG:\n${products.map((p) => `${p.name} | ${p.price || ''} | ${p.category || ''} | delivery: ${p.delivery_info || ''} | location: ${p.location || ''} | how to buy: ${p.how_to_buy || ''}`).join('\n').slice(0, 2500)}` : '',
    said.length ? `THE SHOP'S OWN REPLIES TO CUSTOMERS:\n${said.map((r) => '- ' + String(r.body || '').slice(0, 220)).join('\n').slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n\n');
  if (facts) {
    const system = `You fill in a Nigerian shop's profile from its own text. Use ONLY facts written below; never invent. Return ONLY JSON:
{"about":{"value":string,"from":"profile"|"catalog"|"replies"}|null,"address":{...}|null,"hours":{...}|null,"delivery":[{"area":string,"fee":string,"time":string,"from":"profile"|"catalog"|"replies"}],"payment_methods":{"value":[string],"from":...}|null,"returns":{...}|null}
"about": 1-2 plain sentences on what they sell and to whom. Fees keep the ₦ sign. payment_methods only from: ${PAY.join(', ')}. Leave anything not clearly stated as null or [].`;
    try {
      const client = require('./ai/client');
      const text = await client.callAI(system, facts.slice(0, 7000), null);
      const m = String(text || '').match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : {};
      const FROM = { profile: 'From your WhatsApp profile', catalog: 'From your catalog', replies: 'From your replies to customers' };
      const add = (field, label, v, shown) => { if (v && v.value && (!Array.isArray(v.value) || v.value.length)) out.push({ field, label, value: v.value, text: shown || (Array.isArray(v.value) ? v.value.join(', ') : String(v.value)), from: FROM[v.from] || 'From your shop', sure: v.from === 'profile' || v.from === 'catalog' }); };
      add('about', 'About the shop', j.about);
      add('address', 'Address', j.address);
      add('hours', 'Opening hours', j.hours);
      add('payment_methods', 'Payment methods', j.payment_methods && { ...j.payment_methods, value: (j.payment_methods.value || []).filter((x) => PAY.includes(x)) });
      add('returns', 'Returns', j.returns);
      for (const d of (Array.isArray(j.delivery) ? j.delivery : []).slice(0, 6)) {
        if (!d || !d.area || !d.fee) continue;
        out.push({ field: 'delivery', label: `Delivery to ${clean(d.area, 60)}`, value: { area: clean(d.area, 80), fee: clean(d.fee, 30), time: clean(d.time, 40) }, text: `${clean(d.fee, 30)}${d.time ? ', ' + clean(d.time, 40) : ''}`, from: FROM[d.from] || 'From your shop', sure: d.from === 'profile' || d.from === 'catalog' });
      }
    } catch (e) { console.error('shop profile fill failed:', e.message); }
  }
  return { suggestions: out, hadSources: { whatsappProfile: !!b.profile_snapshot, products: products.length, replies: said.length } };
}

// Owner corrections in Chat with Velo ("No, the 20 inch is ₦90,000 now") become saved facts.
const CORRECTION_RE = /^\s*(no[,.!\s]|nope|that'?s (wrong|not right|not true|incorrect)|wrong[,.!\s]|actually[,\s]|correction[:,\s]|not true|e no be so|na lie|remember (that|this))/i;
async function learnFact(businessId, message) {
  if (!CORRECTION_RE.test(message || '')) return null;
  const client = require('./ai/client');
  const system = 'The shop owner is correcting their shop assistant. Rewrite the correction as ONE short, standalone fact about the shop (no "you said", no names of the assistant), e.g. "Bone straight wig 20 inch costs ₦90,000." If it is not a fact about the shop (just "no" or a complaint), return exactly NONE.';
  try {
    const text = clean(await client.callAI(system, String(message).slice(0, 600), null), 240);
    if (!text || /^none\b/i.test(text)) return null;
    const b = await load(businessId);
    const p = read(b.shop_profile);
    const facts = [...(p.facts || []), { text, at: new Date().toISOString() }].slice(-30);
    await db.query('UPDATE businesses SET shop_profile = $2 WHERE id = $1', [b.id, JSON.stringify({ ...p, facts })]);
    return text;
  } catch (e) { console.error('learn fact failed:', e.message); return null; }
}

module.exports = { questionsFor, nicheGroup, normalize, completeness, format, load, save, view, fill, learnFact, CORRECTION_RE, LANGS, PAY };
