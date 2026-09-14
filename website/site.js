// Vendora marketing site — live chat simulation + reveals + counters.
// APP_URL: the main web app. Every converting CTA points here.
const APP_URL = 'https://vendorabot.vercel.app';

const SCENARIOS = [
  { // 0 — price ask (Pidgin in, catalog answer out)
    name: 'Price ask',
    script: [
      ['in', 'Abeg, blue gown still dey?'],
      ['out', 'Yes o — blue gown ₦45,000, in stock in M and L. Make I reserve am for you?'],
      ['in', 'How much for delivery to Lekki?'],
      ['out', 'Delivery to Lekki na ₦2,500, e go reach in 2–3 days. Should I pack am with the gown?'],
    ],
  },
  { // 1 — owner teaches stock via LEARN
    name: 'LEARN stock',
    script: [
      ['in', 'LEARN: New stock! Bone straight 20" ₦95,000, knotless braids ₦25,000'],
      ['out', 'Locked in ✅ — 2 products updated. I go answer customers with these prices from now.'],
      ['in', 'Customer: How much be bone straight?'],
      ['out', 'Bone straight 20" na ₦95,000, available now. Want pickup or delivery?'],
    ],
  },
  { // 2 — hot handoff to human
    name: 'Hot handoff',
    script: [
      ['in', 'I need 50 pieces for aso-ebi, can you do discount?'],
      ['out', 'Wow, 50 pieces! 🎉 Let me bring my boss in for your best price — she go reply in a few minutes. Your name please?'],
      ['in', 'Adaeze — 0803 123 4567'],
      ['out', 'Thank you Adaeze ✅ Flagged as HOT lead — owner notified with your exact words.'],
    ],
  },
];

const chat = document.getElementById('liveChat');
const chips = Array.from(document.querySelectorAll('.chip'));
let current = 0, timer = null, cancelled = false;

function el(cls, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  return d;
}
function typingBubble() {
  const d = document.createElement('div');
  d.className = 'msg out typing';
  d.innerHTML = '<b></b><b></b><b></b>';
  return d;
}
const wait = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });

async function playScenario(idx) {
  cancelled = true; // stop any running loop
  await new Promise((r) => setTimeout(r, 60));
  cancelled = false;
  current = idx;
  chips.forEach((c, i) => c.classList.toggle('on', i === idx));
  const run = SCENARIOS[idx].script;
  chat.innerHTML = '';
  const stamp = document.createElement('div');
  stamp.className = 'tick';
  stamp.textContent = 'Today · simulated live demo';
  chat.appendChild(stamp);
  for (const [who, text] of run) {
    if (cancelled) return;
    if (who === 'out') {
      const t = typingBubble();
      chat.appendChild(t);
      await wait(1100);
      if (cancelled) return;
      t.remove();
    } else {
      await wait(700);
      if (cancelled) return;
    }
    chat.appendChild(el(who, text));
  }
  await wait(4200);
  if (!cancelled) playScenario((idx + 1) % SCENARIOS.length); // auto-rotate
}

chips.forEach((c) => c.addEventListener('click', () => playScenario(Number(c.dataset.scenario))));

// Scroll reveals (same IntersectionObserver pattern as the app — no libs)
const io = new IntersectionObserver(
  (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach((n) => io.observe(n));

// Animated counters
const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const end = Number(e.target.dataset.count || 0);
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 1200);
    e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach((n) => cio.observe(n));

document.getElementById('year').textContent = new Date().getFullYear();
playScenario(0);
