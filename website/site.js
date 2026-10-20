// VeloSales Ai — marketing site behaviour.
// One file, every page. Every lookup is guarded, so a subpage that only needs
// the nav and the footer never throws because a playground is missing.
//
// Nothing here is required for navigation: every link is a real <a href> to a
// real HTML file. If JavaScript never runs, the site still works and Google
// still reads it. This file only adds the demo, the tabs and the reveal.

const APP_URL = 'https://app.velosalesai.com.ng';
const $ = (id) => document.getElementById(id);
const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ── preloader + reading progress + year ── */
const loader = $('loader');
const killLoader = () => loader && loader.classList.add('done');
if (loader) {
  document.addEventListener('DOMContentLoaded', () => setTimeout(killLoader, 500));
  addEventListener('load', killLoader);
  setTimeout(killLoader, 2500); // failsafe
}
document.querySelectorAll('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });

const prog = $('scrollProgress');
if (prog) addEventListener('scroll', () => {
  const h = document.documentElement;
  prog.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
}, { passive: true });

/* ── marquees: duplicate for a seamless loop ── */
['marqueeTrack', 'modelTrack'].forEach((id) => {
  const el = $(id);
  if (el) el.innerHTML += el.innerHTML;
});

/* ── mobile nav ── */
const navToggle = $('navToggle');
const navLinks = $('navLinks');
if (navToggle && navLinks) {
  const close = () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
  };
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* ── 3D tilt (mouse only, skipped on touch / reduced motion) ── */
const fine = matchMedia('(pointer:fine)').matches && !reduce();
if (fine) {
  document.querySelectorAll('#phoneTilt, .tilt').forEach((el) => {
    const strength = el.id === 'phoneTilt' ? 10 : 6;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * strength * 2) + 'deg');
      el.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * strength * 2) + 'deg');
    });
    el.addEventListener('mouseleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

/* ── live chat simulation (home page only) ── */
const SCENARIOS = [
  { script: [
    ['in', 'Abeg, blue gown still dey?'],
    ['out', 'Yes o — blue gown ₦45,000, in stock in M and L. Make I reserve am for you?'],
    ['in', 'How much for delivery to Lekki?'],
    ['out', 'Delivery to Lekki na ₦2,500, e go reach in 2–3 days. Should I pack am with the gown?'],
  ]},
  { script: [
    ['in', 'LEARN: New stock! Bone straight 20" ₦95,000, knotless braids ₦25,000'],
    ['out', 'Locked in — 2 products updated. I go answer customers with these prices from now.'],
    ['in', 'Customer: How much be bone straight?'],
    ['out', 'Bone straight 20" na ₦95,000, available now. Want pickup or delivery?'],
  ]},
  { script: [
    ['in', 'I need 50 pieces for aso-ebi, can you do discount?'],
    ['out', 'Wow, 50 pieces! Let me bring my boss in for your best price — she go reply in a few minutes. Your name please?'],
    ['in', 'Adaeze — 0803 123 4567'],
    ['out', 'Thank you Adaeze. Flagged as HOT lead — owner notified with your exact words.'],
  ]},
];
const chat = $('liveChat');
const chips = Array.from(document.querySelectorAll('.chip[data-scenario]'));
let cancelled = false;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const bubble = (cls, text) => { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; return d; };
const typing = () => { const d = document.createElement('div'); d.className = 'msg out typing'; d.innerHTML = '<b></b><b></b><b></b>'; return d; };
async function playScenario(idx) {
  if (!chat) return;
  cancelled = true; await new Promise((r) => setTimeout(r, 80)); cancelled = false;
  chips.forEach((c, i) => c.classList.toggle('on', i === idx));
  chat.innerHTML = '';
  const stamp = document.createElement('div'); stamp.className = 'tick'; stamp.textContent = 'Today · simulated live demo';
  chat.appendChild(stamp);
  for (const [who, text] of SCENARIOS[idx].script) {
    if (cancelled) return;
    if (who === 'out') { const t = typing(); chat.appendChild(t); await wait(1100); if (cancelled) return; t.remove(); }
    else await wait(700);
    if (cancelled) return;
    chat.appendChild(bubble(who, text));
  }
  await wait(4200);
  if (!cancelled && !reduce()) playScenario((idx + 1) % SCENARIOS.length);
}
chips.forEach((c) => c.addEventListener('click', () => playScenario(Number(c.dataset.scenario))));

/* ── LEARN tabs ── */
document.querySelectorAll('.tabs[role=tablist] .tab[data-tab]').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tabs .tab[data-tab]').forEach((x) => x.classList.remove('on'));
  t.classList.add('on');
  document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('on', p.id === t.dataset.tab));
}));

/* ── Pidgin / English mirror demo ── */
const LANG = {
  pidgin: [['in', 'Abeg, bone straight still dey?'], ['out', 'Yes o — Bone straight 20" ₦95,000, e dey available. Make I keep am for you?']],
  english: [['in', 'Good morning. Do you have bone straight available?'], ['out', 'Good morning! Yes — Bone Straight 20" is ₦95,000 and currently in stock. Would you like pickup or delivery?']],
};
function renderLang(k) {
  const box = $('langDemo'); if (!box) return;
  box.innerHTML = '';
  LANG[k].forEach(([w, t]) => box.appendChild(bubble(w, t)));
}
document.querySelectorAll('.tab[data-lang]').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab[data-lang]').forEach((x) => x.classList.remove('on'));
  t.classList.add('on'); renderLang(t.dataset.lang);
}));
if ($('langDemo')) renderLang('pidgin');

/* ── LEARN playground: parse "LEARN: name price" like the real bot ── */
const learnBtn = $('learnBtn');
if (learnBtn) {
  const input = $('learnInput');
  learnBtn.addEventListener('click', () => {
    const raw = input.value.trim();
    const out = $('learnOut');
    const m = raw.match(/^learn\s*:\s*(.+?)\s*[₦$]?\s*([\d,]+(?:\.\d{1,2})?)\s*$/i);
    if (!m) {
      out.innerHTML = '<span class="hint">Hmm — try the format <code>LEARN: Product name ₦45,000</code>. Same name twice = price update.</span>';
      return;
    }
    const [, name, price] = m;
    const naira = '₦' + Number(price.replace(/,/g, '')).toLocaleString('en-NG');
    out.innerHTML = '';
    out.appendChild(bubble('in', raw));
    const t = typing(); out.appendChild(t);
    setTimeout(() => {
      t.remove();
      out.appendChild(bubble('out', `Locked in — "${name.trim()}" is now ${naira}. Customers asking for it get this price from now. (Demo — the real bot saves it to your catalog.)`));
    }, 900);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') learnBtn.click(); });
}

/* ── pricing: NGN/USD × monthly/yearly (mirrors Billing.jsx) ── */
const PRICES = {
  NGN: { pro: { m: 7499, y: 69999 }, plus: { m: 14999, y: 119999 } },
  USD: { pro: { m: 5, y: 47 }, plus: { m: 10, y: 80 } },
};
let cur = 'NGN', per = 'yearly';
const fmt = (n, c) => c === 'NGN' ? '₦' + n.toLocaleString('en-NG') : '$' + n.toLocaleString('en-US');
function renderPrices() {
  if (!$('pricePro')) return;
  const P = PRICES[cur];
  $('priceFree').innerHTML = (cur === 'NGN' ? '₦0' : '$0') + '<small>/forever</small>';
  const pro = P.pro[per === 'monthly' ? 'm' : 'y'], plus = P.plus[per === 'monthly' ? 'm' : 'y'];
  $('pricePro').innerHTML = fmt(pro, cur) + '<small>/' + (per === 'monthly' ? 'month' : 'year') + '</small>';
  $('pricePlus').innerHTML = fmt(plus, cur) + '<small>/' + (per === 'monthly' ? 'month' : 'year') + '</small>';
  $('priceProSave').textContent = per === 'yearly' ? `Save ${fmt(P.pro.m * 12 - P.pro.y, cur)} — 22% off monthly` : 'Cancel anytime · instant activation';
  $('pricePlusSave').textContent = per === 'yearly' ? `Save ${fmt(P.plus.m * 12 - P.plus.y, cur)} — 33% off monthly` : 'Cancel anytime · instant activation';
}
document.querySelectorAll('.seg-btn[data-cur]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.seg-btn[data-cur]').forEach((x) => x.classList.remove('on'));
  b.classList.add('on'); cur = b.dataset.cur; renderPrices();
}));
document.querySelectorAll('.seg-btn[data-per]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.seg-btn[data-per]').forEach((x) => x.classList.remove('on'));
  b.classList.add('on'); per = b.dataset.per; renderPrices();
}));
renderPrices();

/* ── compare table (mirrors Billing COMPARE_ROWS) ── */
const ROWS = [
  ['AI replies from your manual catalog', 1, 1, 1],
  ['Teach with LEARN: messages', 1, 1, 1],
  ['Full inbox + chat history', 1, 1, 1],
  ['Hot-order owner alerts', 1, 1, 1],
  ['Bot replies per day', '50', '500', 'Unlimited'],
  ['Profile SYNC + verified products', 0, 1, 1],
  ['Product photos inside replies', 0, 1, 1],
  ['Suggestive selling (up to 5 options)', 0, 1, 1],
  ['ComeBack follow-ups + Insights', 0, 1, 1],
  ['Voice-note transcription', 0, 0, 1],
  ['Smart-tier AI models (Fast, Normal, Smart)', 0, 0, 1],
  ['Priority support', 0, 0, 1],
];
const cmp = $('compareBody');
if (cmp) cmp.innerHTML = ROWS.map(([l, a, b, c]) => {
  const cell = (v) => v === 1 ? '<svg class="ic"><use href="#i-check"/></svg>' : v === 0 ? '<span class="dash">—</span>' : '<b>' + v + '</b>';
  return `<tr><td><b>${l}</b></td><td>${cell(a)}</td><td>${cell(b)}</td><td>${cell(c)}</td></tr>`;
}).join('');

/* ── FAQ (condensed from the app's 15) + live search ── */
const FAQS = [
  ['Is there really a free plan?', 'Yes — the manual catalog is free forever: add products on the dashboard or teach the bot with LEARN: messages and it replies at no cost. Every account starts with a 7-day Pro trial.'],
  ['How do I connect my WhatsApp?', 'Open the Connect page and tap "Connect WhatsApp" — a Meta popup opens, you log in with Facebook and pick your business number. Send the TEST message and you flip to LIVE.'],
  ['How does LEARN work?', 'From your owner number send: LEARN: Blue gown ₦45,000. The AI extracts name + price and updates the catalog. Same name again overwrites the price. Free forever — try the playground above.'],
  ['What is profile SYNC (Pro)?', 'Paste your WhatsApp Business profile text in Catalog → Sync (or send SYNC: + text from your owner number). The AI scaffolds your whole catalog and verifies answers against it.'],
  ["What if the AI doesn't know?", 'It sends a polite handoff, flags the chat gold in your inbox, and alerts your personal WhatsApp instantly. It never invents prices or delivery promises.'],
  ['Does it speak Pidgin?', 'Yes — it mirrors the customer. Pidgin in, Pidgin out. Formal English in, formal out. Voice notes are transcribed on Pro Plus.'],
  ['How does billing work?', 'Card on a secure checkout page — Pro from ₦7,499 / $5 monthly, Pro Plus from ₦14,999 / $10 monthly, yearly saves up to 33%. Dropping to free never deletes anything.'],
  ['Is there a phone app?', 'The web app works today and installs from your browser (Add to Home screen). An Android build is in testing; iPhone follows after. The same account works everywhere.'],
  ['Can I get a refund?', 'First-ever payment: yes, within 7 days if the service genuinely didn’t work for you — write from the in-app Help page. Duplicate or failed charges are always refunded.'],
  ['Is my data private?', 'Catalog and chats only reply to your customers. No data sales, no ad profiles, no training public models on your content. Export or delete anytime.'],
];
const faqList = $('faqList');
const faqSearch = $('faqSearch');
const faqClear = $('faqClear');
let openFaq = 0;
function renderFaq() {
  if (!faqList || !faqSearch) return;
  const q = faqSearch.value.trim().toLowerCase();
  if (faqClear) faqClear.hidden = !q;
  const shown = FAQS.map((f, i) => ({ f, i })).filter(({ f }) => !q || (f[0] + ' ' + f[1]).toLowerCase().includes(q));
  faqList.innerHTML = shown.length ? '' : '<div class="card glass"><div class="empty"><b>No matches</b><span class="hint">Try fewer words — or ask from the Help page after signing up.</span></div></div>';
  shown.forEach(({ f: [t, a], i }) => {
    const d = document.createElement('div');
    d.className = 'faq-item glass reveal vis' + (openFaq === i ? ' open' : '');
    d.innerHTML = `<button class="faq-q"><span class="faq-num">${String(i + 1).padStart(2, '0')}</span><span>${t}</span><span class="faq-plus">+</span></button><div class="faq-a"><div><p>${a}</p></div></div>`;
    d.querySelector('.faq-q').addEventListener('click', () => { openFaq = openFaq === i ? -1 : i; renderFaq(); });
    faqList.appendChild(d);
  });
}
if (faqSearch) faqSearch.addEventListener('input', renderFaq);
if (faqClear) faqClear.addEventListener('click', () => { faqSearch.value = ''; renderFaq(); faqSearch.focus(); });
renderFaq();

/* ── reveals + counters ── */
document.querySelectorAll('.reveal').forEach((n) => {
  if (!('IntersectionObserver' in window)) { n.classList.add('vis'); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  io.observe(n);
});
const counted = document.querySelectorAll('[data-count]');
if (counted.length && 'IntersectionObserver' in window) {
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const end = Number(e.target.dataset.count || 0);
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1300);
      e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.5 });
  counted.forEach((n) => cio.observe(n));
} else {
  counted.forEach((n) => { n.textContent = n.dataset.count; });
}

playScenario(0);
window.VELO_APP_URL = APP_URL;
