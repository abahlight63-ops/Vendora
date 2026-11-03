// ── scripts/build-website.mjs ────────────────────────────────────
// WHAT: writes the marketing site (website/) from one place, so every page
// shares the same header, footer, styles and search setup (title,
// description, canonical, social cards and structured data for Google).
// LOOK: "A, dark premium" (owner's pick): near-black with a faint grid,
// shimmering coral-to-violet headline, floating 3D channel icons, and real
// screenshots of the app tilted in 3D with a glow.
// RUN: node scripts/build-website.mjs   (then `npm run build` refreshes the sitemaps)
// EDIT: change the text below, rerun, commit. Do not hand-edit website/*.html:
// the next run overwrites it. website/styles.css and website/site.js are hand-written.
// HONESTY: anything not built yet carries a "Coming soon" tag (SOON below).
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'website');
const SITE = 'https://velosalesai.com.ng';
const APP = 'https://app.velosalesai.com.ng';
const SIGNUP = APP + '/login?mode=signup';
const SIGNIN = APP + '/login';
const EMAIL = 'velosales63@gmail.com';
const VERIFY = 'BFuzp4Yg1ikNpWscJ6hz8A04ymD2OiGZCsjeoDPr4P8';
const UPDATED = '2026-11-03b';
const SOON = '<span class="soon">Coming soon</span>';

// ── facts (keep in step with Billing and the app's FAQ) ──
const PLANS = [
  { key: 'free', name: 'Free', price: 0, per: '', yearly: 'Free forever', desc: 'For trying Velo on your shop', cta: 'Start free', href: SIGNUP, feats: ['50 replies a day', 'WhatsApp and Telegram', 'Inbox and catalog', 'English and Pidgin'] },
  { key: 'plus', name: 'Plus', price: 7499, per: '/month', yearly: 'or ₦69,999 a year, save 22%', desc: 'For a growing shop', cta: 'Choose Plus', href: SIGNUP, feats: ['500 replies a day', 'All four apps', 'Product photos in replies', 'Catalog import'] },
  { key: 'pro', name: 'Pro', price: 14999, per: '/month', yearly: 'or ₦119,999 a year, save 33%', desc: 'For a busy shop that sells all day', cta: 'Choose Pro', href: SIGNUP, best: true, feats: ['1,500 replies a day', 'Voice notes', 'Smartest AI', 'Everything in Plus'] },
  { key: 'business', name: 'Business', price: 39999, from: true, per: '/month', yearly: 'Set up with our team', desc: 'Many branches, one inbox', cta: 'Talk to us', href: '/contact/', feats: ['5,000 replies a day', 'Many branches', 'Priority help', 'We set it up with you'] },
];
const naira = (n) => '₦' + n.toLocaleString('en-NG');
const COMPARE = [
  ['Replies a day', '50', '500', '1,500', '5,000'],
  ['WhatsApp and Telegram', 1, 1, 1, 1],
  ['Facebook Messenger and Instagram', 0, 1, 1, 1],
  ['One inbox for every chat', 1, 1, 1, 1],
  ['English and Pidgin replies', 1, 1, 1, 1],
  ['Hands chats to you when unsure', 1, 1, 1, 1],
  ['Chat with Velo about your shop', 1, 1, 1, 1],
  ['Product photos in replies', 0, 1, 1, 1],
  ['Catalog import', 0, 1, 1, 1],
  ['Voice notes', 0, 0, 1, 1],
  ['Smartest AI', 0, 0, 1, 1],
  ['Many branches', 0, 0, 0, 1],
  ['Priority help', 0, 0, 0, 1],
];
const FAQ = [
  ['Getting started', [
    ['Is there really a free plan?', 'Yes. Free gives you 50 replies a day on WhatsApp and Telegram, forever. Every new shop also gets 7 days of Pro free, and no card is needed.'],
    ['How do I connect my WhatsApp?', 'Open Channels in the app and tap Connect on WhatsApp. A Meta window opens: sign in with Facebook, pick your business number and you are done.'],
    ['How do I add my products?', 'Add them one by one in Catalog, import a list, or send a message from your own number like "LEARN: Blue gown ₦45,000". Velo saves the name and price.'],
    ['How long does setup take?', 'Most shops are live in under 30 minutes: add a few products, connect a channel, then try Velo in Test Drive.'],
  ]],
  ['Plans and billing', [
    ['How much does VeloSales Ai cost?', 'Free is ₦0. Plus is ₦7,499 a month for 500 replies a day. Pro is ₦14,999 a month for 1,500 replies a day, voice notes and the smartest AI. Business starts from ₦39,999 a month.'],
    ['How do I pay?', 'By card, bank transfer or USSD on a secure Paystack or Flutterwave checkout. We never see or store your full card number.'],
    ['What happens when I reach my daily limit?', 'Customers get a polite "we will reply shortly" message and the chat is flagged for you. Your limit resets at midnight, or you can upgrade any time.'],
    ['Can I cancel or get a refund?', 'Stop paying at any time and you keep your plan until the end of what you paid for, then move to Free. Your first payment can be refunded within 7 days if the service did not work for you.'],
  ]],
  ['How Velo answers', [
    ['Will Velo make up prices?', 'No. Velo only quotes prices and products from your catalog. If something is missing, it hands the chat to you instead of guessing.'],
    ['What happens when Velo is not sure?', 'It tells the customer you will reply shortly, flags the chat as "Needs you" in your inbox and alerts you, so you can step in.'],
    ['Does it speak Pidgin?', 'Yes. Velo answers the way each customer writes: Pidgin in, Pidgin out; formal English in, formal English out.'],
    ['Can I take over a chat myself?', 'Yes. Open the chat in your inbox and reply. Velo steps back for that chat until you hand it back.'],
    ['What is Chat with Velo?', 'Your own assistant inside the app. Ask it about your products and prices, or ask it to write a caption or a reply. Sales breakdowns and receipts are coming soon.'],
  ]],
  ['Channels and data', [
    ['Which apps does Velo work on?', 'WhatsApp, Telegram, Facebook Messenger and Instagram. One inbox shows them all.'],
    ['Is my data private?', 'Yes. Your catalog and chats are used only to answer your customers. We never sell data, show ads, or train public AI models on your content.'],
    ['How do I reach support?', 'Use the Help Center inside the app, or email ' + EMAIL + '.'],
  ]],
];
const HOME_FAQ = [FAQ[0][1][0], FAQ[2][1][0], FAQ[2][1][3], FAQ[2][1][2], FAQ[2][1][4], FAQ[1][1][1]];

// ── helpers ──
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ICONS = {
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01', check: 'M5 12.5l4.5 4.5L19 7.5',
  next: 'M5 12h14M13 6l6 6-6 6', play: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5l6 3.5-6 3.5z', down: 'M6 9l6 6 6-6', mail: 'M3 5h18v14H3zM4 7l8 6 8-6',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z', tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01', menu: 'M4 7h16M4 12h16M4 17h16', gift: 'M4 11h16v10H4zM2 7h20v4H2zM12 7v14M12 7S10 3 7.5 3 5 6 7 7M12 7s2-4 4.5-4S19 6 17 7',
  chart: 'M4 20V10M10 20V4M16 20v-6M22 20H2', receipt: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4', pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
};
const ic = (k, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>`;
let gid = 0;
const MARK = (s = 28) => { gid++; const u = 'm' + gid; return `<svg width="${s}" height="${Math.round(s * 1.156)}" viewBox="0 0 602 696" aria-hidden="true"><defs><linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB199"/><stop offset="1" stop-color="#D03C16"/></linearGradient><linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9C8FFA"/><stop offset="1" stop-color="#3B2E9E"/></linearGradient><linearGradient id="${u}c" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF8A6B"/><stop offset=".5" stop-color="#B44BA0"/><stop offset="1" stop-color="#4F3FC7"/></linearGradient></defs><path fill="url(#${u}a)" d="M301 0 L602 189 L0 189 Z"/><path fill="url(#${u}b)" d="M0 189 L0 513 L301 696 Z"/><path fill="url(#${u}c)" d="M602 189 L602 513 L301 696 Z"/></svg>`; };
const GLYPH = {
  whatsapp: '<path fill="#fff" d="M32 14a18 18 0 0 0-15.5 27.2L14 50l9-2.4A18 18 0 1 0 32 14zm0 32.6c-2.8 0-5.5-.8-7.8-2.2l-.6-.3-5.3 1.4 1.4-5.2-.4-.6A14.6 14.6 0 1 1 32 46.6zm8-10.9c-.4-.2-2.6-1.3-3-1.4-.4-.2-.7-.2-1 .2l-1.4 1.7c-.3.3-.5.3-.9.1a12 12 0 0 1-6-5.2c-.4-.8.4-.7 1.3-2.4.1-.3 0-.5 0-.7l-1.4-3.3c-.3-.8-.7-.7-1-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 4 1.7 4.2c.2.3 2.9 4.5 7.1 6.3 2.6 1.1 3.7 1.2 5 1 .8-.1 2.6-1 2.9-2.1.4-1 .4-1.9.3-2.1-.1-.2-.4-.3-.8-.5z"/>',
  telegram: '<path fill="#fff" d="M46.5 18.6 14.9 30.8c-2.2.9-2.1 2.1-.4 2.6l8.1 2.5 3.1 9.6c.4 1.1.2 1.5 1.3 1.5.9 0 1.3-.4 1.8-.9l3.9-3.8 8.1 6c1.5.8 2.6.4 3-1.4l5.4-25.5c.6-2.2-.8-3.2-2.7-2.8zM24.6 35.3l17.6-11.1c.9-.5 1.7-.2 1 .4L28.1 38.2l-.6 6.3z"/>',
  messenger: '<path fill="#fff" d="M32 15c-9.6 0-17 7-17 16.5 0 5 2 9.3 5.4 12.3V49l5-2.8c2 .6 4.2.8 6.6.8 9.6 0 17-7 17-16.5S41.6 15 32 15zm1.7 22.2-4.3-4.6-8.5 4.6 9.3-9.9 4.4 4.6 8.4-4.6z"/>',
  instagram: '<rect x="18" y="18" width="28" height="28" rx="8" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="32" cy="32" r="6.5" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="40.5" cy="23.5" r="2" fill="#fff"/>',
};
const COLOR = { whatsapp: '#25D366', telegram: '#229ED9', messenger: '#7B5CFF', instagram: '#E1306C' };
const NAME = { whatsapp: 'WhatsApp', telegram: 'Telegram', messenger: 'Messenger', instagram: 'Instagram' };
const coin = (k, s = 40) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" role="img" aria-label="${NAME[k]}"><circle cx="32" cy="32" r="32" fill="${COLOR[k]}"/>${GLYPH[k]}</svg>`;
const CH = ['whatsapp', 'telegram', 'messenger', 'instagram'];
const blob = (k, cls) => `<span class="blob3 b-${k} ${cls}" aria-hidden="true"><svg viewBox="0 0 64 64">${GLYPH[k]}</svg></span>`;
const shot = (name, alt, w = 1280, h = 800, eager = false) => `<img src="/assets/app/${name}.jpg" width="${w}" height="${h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
const phone = (name, alt) => `<div class="phone">${shot(name, alt, 390, 760)}</div>`;

// ── structured data ──
const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'VeloSales Ai', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/icon-512.png', width: 512, height: 512 }, email: EMAIL, areaServed: 'NG', description: 'AI sales assistant that answers shop customers on WhatsApp, Telegram, Facebook Messenger and Instagram, in English or Pidgin, from the shop’s own catalog.', contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: EMAIL, availableLanguage: ['en', 'pcm'] } };
const WEBSITE = { '@type': 'WebSite', '@id': SITE + '/#website', name: 'VeloSales Ai', alternateName: 'VeloSales', url: SITE + '/', publisher: { '@id': SITE + '/#org' }, inLanguage: 'en-NG' };
const APPLD = { '@type': 'SoftwareApplication', '@id': SITE + '/#app', name: 'VeloSales Ai', applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android', url: APP + '/', publisher: { '@id': SITE + '/#org' }, screenshot: SITE + '/assets/app/chats-1-d.jpg', description: 'An AI sales assistant for small shops. It answers customers on WhatsApp, Telegram, Facebook Messenger and Instagram in seconds, in English or Pidgin, using only your own prices, and hands the chat to you when it is not sure.', offers: PLANS.filter((p) => p.key !== 'business').map((p) => ({ '@type': 'Offer', name: p.name, price: String(p.price), priceCurrency: 'NGN', url: SITE + '/pricing/' })) };
const faqLd = (rows) => ({ '@type': 'FAQPage', mainEntity: rows.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const crumbs = (name, path) => ({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name, item: SITE + path }] });

// ── page frame ──
const NAV = [['/how-it-works/', 'How it works'], ['/pricing/', 'Pricing'], ['/free-plan/', 'Free plan'], ['/faq/', 'FAQ'], ['/contact/', 'Contact']];
function frame({ path, title, desc, body, ld = [], noindex = false, ogTitle }) {
  const url = SITE + path;
  const graph = { '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, ...ld] };
  return `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">
<meta name="theme-color" content="#07041F">
<meta name="color-scheme" content="dark">
<meta name="google-site-verification" content="${VERIFY}">
<meta property="og:site_name" content="VeloSales Ai">
<meta property="og:locale" content="en_NG">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/assets/og-v2.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="VeloSales Ai: your shop's AI, open 24/7">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/assets/og-v2.png">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="icon" href="/favicon.ico" sizes="48x48 32x32 16x16">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/styles.css?v=${UPDATED}">
<script>document.documentElement.className='js'</script>
<script type="application/ld+json">${JSON.stringify(graph)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="bg" aria-hidden="true"><i class="grid"></i><i class="glow g1"></i><i class="glow g2"></i></div>
<header class="nav">
  <a class="brand" href="/" aria-label="VeloSales Ai home">${MARK(28)}<span>VeloSales Ai</span></a>
  <nav class="nav-links" id="nav-links" aria-label="Main">
    ${NAV.map(([h, t]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${t}</a>`).join('\n    ')}
    <a class="pill line nav-in" href="${SIGNIN}">Sign in</a>
  </nav>
  <a class="pill coral nav-go" href="${SIGNUP}">Start free</a>
  <button class="nav-menu" type="button" aria-controls="nav-links" aria-expanded="false" aria-label="Open menu">${ic('menu', 22)}</button>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot-brand"><a class="brand" href="/">${MARK(26)}<span>VeloSales Ai</span></a><p>The AI sales assistant for shops in Nigeria. A business based in Nigeria.</p><a href="mailto:${EMAIL}">${EMAIL}</a></div>
  <div><h2>Product</h2><a href="/how-it-works/">How it works</a><a href="/pricing/">Pricing</a><a href="/free-plan/">Free plan</a><a href="/pro-trial/">7-day Pro trial</a></div>
  <div><h2>Help</h2><a href="/faq/">FAQ</a><a href="/contact/">Contact us</a><a href="${SIGNIN}">Sign in</a><a href="${SIGNUP}">Create account</a></div>
  <div><h2>Legal</h2><a href="${APP}/privacy">Privacy Policy</a><a href="${APP}/terms">Terms of Service</a></div>
  <p class="foot-fine">© 2026 VeloSales Ai. Built in Nigeria for shops everywhere.</p>
</footer>
<script src="/site.js?v=${UPDATED}" defer></script>
</body>
</html>
`;
}

// ── shared blocks ──
const go = (txt = 'Start free', href = SIGNUP, cls = '') => `<a class="go ${cls}" href="${href}">${txt}<span class="knob">${ic('next', 20)}</span></a>`;
const head = (kick, h2, lede = '', center = true) => `<div class="head${center ? ' center' : ''} rv"><p class="kick">${kick}</p><h2>${h2}</h2>${lede ? `<p class="lede">${lede}</p>` : ''}</div>`;
const frameShot = (name, alt, tilt = 'l', eager = false) => `<div class="screen tilt-${tilt}"><div class="screen-in">${shot(name, alt, 1280, 800, eager)}</div></div>`;
const planCards = () => `<div class="plans rv">${PLANS.map((p) => `
  <article class="plan${p.best ? ' best' : ''}">
    ${p.best ? '<span class="pop">★ Most popular</span>' : ''}
    <h3>${p.name}</h3><p class="pdesc">${p.desc}</p>
    <p class="price">${p.from ? '<small>From </small>' : ''}${naira(p.price)}<small>${p.per}</small></p>
    <p class="pyear">${p.yearly}</p>
    <ul>${p.feats.map((f) => `<li>${ic('check', 14)}${f}</li>`).join('')}</ul>
    <a class="pill ${p.best ? 'grad' : 'line'}" href="${p.href}">${p.cta}</a>
  </article>`).join('')}
</div>
<p class="plans-note rv">${ic('gift', 18)}<span>Every new shop gets <b>7 days of Pro free</b>. No card needed. Prices in naira.</span></p>`;
const faqList = (rows) => `<div class="faq rv">${rows.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}<span>${ic('down', 16)}</span></summary><p>${esc(a)}</p></details>`).join('')}</div>`;
const band = (h = 'Midnight customers are waiting.', p = 'Let Velo answer them while you sleep. Set up in minutes, free.') => `
<section class="band rv">
  <div><h2>${h}</h2><p>${p}</p></div>
  ${go('Start free', SIGNUP, 'white')}
</section>`;
const phero = (kick, h1, lede, extra = '') => `
<section class="phero">
  <p class="kick rv">${kick}</p>
  <h1 class="rv">${h1}</h1>
  <p class="lede rv">${lede}</p>
  ${extra}
</section>`;
const ticks = (items) => `<ul class="ticks">${items.map((t) => `<li>${ic('check', 16)}${t}</li>`).join('')}</ul>`;
const marquee = () => { const row = CH.map((k) => `<span>${coin(k, 30)}${NAME[k]}</span>`).join('') + '<span>' + ic('spark', 22) + 'English and Pidgin</span><span>' + ic('moon', 22) + 'Open 24/7</span><span>' + ic('shield', 22) + 'Your prices only</span>'; return `<div class="marquee" aria-label="Works on WhatsApp, Telegram, Messenger and Instagram"><div class="mq-track">${row}${row}</div></div>`; };

// ── Chat with Velo demo (an illustration, not a screenshot) ──
const veloChat = () => `
<div class="vchat rv">
  <div class="vchat-top">${MARK(22)}<b>Chat with Velo</b><span class="dot"></span><small>Your shop's own assistant</small></div>
  <div class="vchat-body">
    <p class="vm me">How did my shop do this week?</p>
    <div class="vm velo"><b>Here's your week</b> ${SOON}
      <div class="stats"><span><b>42</b>chats</span><span><b>34</b>answered by Velo</span><span><b>2</b>need you</span></div>
      <div class="bars" aria-hidden="true">${[30, 46, 38, 64, 52, 80, 70].map((h) => `<i style="height:${h}%"></i>`).join('')}</div>
      <small>Most asked: Bone straight wig 20". Busiest day: Saturday.</small>
    </div>
    <p class="vm me">Make a receipt for Tunde's bone straight order</p>
    <div class="vm velo receipt"><b>Receipt ready</b> ${SOON}
      <div class="rc"><div class="rc-h">${MARK(18)}<b>Amaka Beauty Studio</b><small>Receipt #0042</small></div>
        <div class="rc-l"><span>Bone straight wig 20" × 1</span><b>₦95,000</b></div>
        <div class="rc-l"><span>Delivery, Ikeja</span><b>₦3,000</b></div>
        <div class="rc-t"><span>Total</span><b>₦98,000</b></div>
        <span class="rc-btn">${coin('whatsapp', 18)}Send to Tunde on WhatsApp</span></div>
    </div>
    <p class="vm me">Write a caption for my new wigs</p>
    <p class="vm velo">New wigs just landed! Soft, full and ready to slay. Send "WIG" to see prices and sizes. Delivery across Lagos. ✨</p>
  </div>
  <div class="vchat-in"><span>Ask Velo anything about your shop</span><i>${ic('send', 16)}</i></div>
</div>`;

// ── pages ──
const pages = {};

pages[''] = frame({
  path: '/',
  title: 'VeloSales Ai: AI sales assistant for WhatsApp, Telegram and Instagram',
  ogTitle: "VeloSales Ai: your shop's AI, open 24/7",
  desc: 'Velo answers your customers on WhatsApp, Telegram, Messenger and Instagram in seconds, in English or Pidgin, from your own prices. Free: 50 replies a day.',
  ld: [APPLD, faqLd(HOME_FAQ)],
  body: `
<section class="hero">
  <p class="tag rv"><b>New</b>Now on Messenger and Instagram</p>
  <h1 class="rv">Every customer answered.<br><span class="shine">Even at 2 AM.</span></h1>
  <p class="lede rv">Velo is your shop's AI assistant. It replies on WhatsApp, Telegram, Messenger and Instagram in seconds, in English or Pidgin, using only your prices.</p>
  <div class="cta-row rv">${go()}<a class="pill line big" href="#tour">${ic('play', 18)}See the app</a></div>
  <p class="hero-note rv">Free plan · 50 replies a day · No card needed</p>
  ${blob('whatsapp', 'f1')}${blob('instagram', 'f2')}${blob('telegram', 'f3')}${blob('messenger', 'f4')}
  <p class="bub3 q" aria-hidden="true">How much be the bone straight, 20 inch?<small>Customer · 2:14 AM</small></p>
  <p class="bub3 a" aria-hidden="true">Na ₦95,000, e still dey. Make I hold one for you?<small>Velo · 3 seconds later</small></p>
  <div class="stage">${frameShot('chats-1-d', 'The VeloSales Ai home screen: chats that need you, replies used today and what Velo answered', 'up', true)}</div>
</section>
${marquee()}

<section class="sec" id="tour">
  ${head('Set up in minutes', 'Three steps. <span class="shine">No tech skills.</span>', 'If you can send a WhatsApp message, you can set up Velo.')}
  <div class="steps3">
    ${[['1', 'Add your products', 'Type a name and price, add a photo, done. Or send "LEARN: Blue gown ₦45,000" from your phone.', 'products-3-d', 'Adding a product: name, price, photo and stock'], ['2', 'Connect your apps', 'Tap Continue with Facebook for WhatsApp, Messenger and Instagram. Telegram takes two minutes.', 'connect-2-d', 'The Channels page with WhatsApp, Messenger, Instagram and Telegram'], ['3', 'Test it, then go live', 'Ask Velo questions like a customer in Test Drive. Happy with the answers? Switch it on.', 'test-2-d', 'Test Drive: asking Velo a question like a customer']].map(([n, t, d, img, alt]) => `
    <article class="step rv"><div class="step-shot">${shot(img, alt)}</div><span class="num">${n}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}
  </div>
</section>

<section class="sec">
  ${head('Inside the app', 'Everything your shop needs.<br>Nothing it doesn\'t.')}
  ${[
    ['01', 'c', 'Know who needs you, at a glance', 'Home puts the chats waiting for you first, then your replies left today and what Velo handled.', ['Chats that need you, first', 'Replies left today', 'What Velo answered for you'], 'chats-1-d', 'The home screen', 'l', '2 chats need you', false],
    ['02', 'v', 'Every chat, from every app, in one inbox', 'WhatsApp, Telegram, Messenger and Instagram land in one list. Step into any chat with one tap.', ['Filter by app or by "Needs you"', 'Take over any chat', 'Hand it back to Velo'], 'chats-2-d', 'The inbox with chats from every app', 'r', 'Needs you · 2', true],
    ['03', 'c', 'Your catalog, your prices', 'Velo only quotes what is in your catalog, so it never invents a price. Mark items out of stock in one tap.', ['Photos, prices and stock', 'Spots items missing a price', 'Teach it from your phone with LEARN:'], 'products-2-d', 'The catalog with prices and stock', 'l', 'LEARN: Blue gown ₦45,000', false],
    ['04', 'v', 'Velo sounds like your shop', 'Pick how Velo greets customers, how it hands chats to you and what discounts it can offer.', ['Greeting and personality', 'Discounts and minimum orders', 'Fast, Normal or Smart AI'], 'voice-1-d', "Settings for Velo's voice", 'r', 'Speaks Pidgin too', true],
  ].map(([n, c, t, d, items, img, alt, tilt, mini, flip]) => `
  <div class="frow${flip ? ' flip' : ''}">
    <div class="ftext rv"><span class="num ${c}">${n}</span><h3>${t}</h3><p>${d}</p>${ticks(items)}</div>
    <div class="fshot rv">${frameShot(img, alt, tilt)}<span class="mini">${mini}</span></div>
  </div>`).join('')}
</section>

<section class="sec velo-sec">
  <div class="vsplit">
    <div class="rv">
      <p class="kick">Chat with Velo</p>
      <h2>Your shop's own <span class="shine">assistant.</span></h2>
      <p class="lede">Ask Velo anything about your shop, any time, from inside the app.</p>
      <ul class="vlist">
        <li><span class="fic v">${ic('tag', 22)}</span><div><b>Knows your products and prices</b><span>Ask what is in stock, what costs what, or what to restock.</span></div></li>
        <li><span class="fic c">${ic('pen', 22)}</span><div><b>Writes for you</b><span>Captions, status updates and replies, in English or Pidgin.</span></div></li>
        <li><span class="fic v">${ic('chart', 22)}</span><div><b>Breaks down your week ${SOON}</b><span>Chats, sales, busiest days and what customers ask most.</span></div></li>
        <li><span class="fic c">${ic('receipt', 22)}</span><div><b>Makes receipts ${SOON}</b><span>Turn a sale into a neat receipt and send it to the customer.</span></div></li>
      </ul>
    </div>
    ${veloChat()}
  </div>
</section>

<section class="sec">
  ${head('On your phone', 'Run your shop <span class="shine">from your pocket.</span>', 'The web app works on any phone and installs to your home screen in one tap.')}
  <div class="phones rv">
    ${phone('chats-2-p', 'The inbox on a phone')}
    ${phone('chats-1-p', 'The home screen on a phone')}
    ${phone('test-2-p', 'Test Drive on a phone')}
  </div>
</section>

<section class="sec" id="pricing">
  ${head('Pricing', 'Start free. <span class="shine">Pay when you\'re busy.</span>')}
  ${planCards()}
  <p class="center rv"><a class="more" href="/pricing/">Compare every feature ${ic('next', 18)}</a></p>
</section>

<section class="sec split faq-split">
  <div class="rv"><p class="kick">FAQ</p><h2>Questions, answered</h2><p class="lede">Still unsure? Write to <a href="mailto:${EMAIL}">${EMAIL}</a> and we'll reply within a day.</p><a class="pill line" href="/faq/">See all questions</a></div>
  ${faqList(HOME_FAQ)}
</section>

<section class="sec getapp rv" id="getapp">
  <div>
    <p class="kick">Android app</p>
    <h2>The Android app is in testing.</h2>
    <p class="lede">Leave your email and we'll tell you the day it's ready. Until then, the web app works on any phone.</p>
  </div>
  <form class="notify" name="launch-notify" method="POST" action="https://api.velosalesai.com.ng/api/auth/waitlist">
    <p class="hidden"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
    <label class="sr" for="notify-email">Email</label>
    <input id="notify-email" type="email" name="email" placeholder="you@example.com" required autocomplete="email">
    <button class="pill coral" type="submit">Notify me</button>
  </form>
</section>
${band()}`,
});

pages['how-it-works/'] = frame({
  path: '/how-it-works/',
  title: 'How VeloSales Ai works: set up your AI shop assistant in 3 steps',
  desc: 'Add your products, connect WhatsApp, Telegram, Messenger or Instagram, test Velo, then go live. See every screen and what happens when a customer writes.',
  ld: [crumbs('How it works', '/how-it-works/')],
  body: phero('How it works', 'From first message to <span class="shine">sale</span>, in seconds.', 'Velo reads your catalog, answers each customer the way they write, and calls you in when a person is needed.', `<div class="cta-row rv">${go()}</div>`) + `
${[
    ['1', 'c', 'Add your products', 'Type them in Catalog with a photo, price and stock, import a list, or send "LEARN: Blue gown ₦45,000" from your own number.', 'products-3-d', 'Adding a product', 'l', false],
    ['2', 'v', 'Connect your apps', 'WhatsApp, Messenger and Instagram connect through one Facebook window. Telegram connects with a bot code in two minutes.', 'connect-2-d', 'Connecting apps on the Channels page', 'r', true],
    ['3', 'c', 'Test, then switch on', 'Ask Velo questions like a customer in Test Drive and see exactly what it would reply, and why.', 'test-2-d', 'Testing Velo in Test Drive', 'l', false],
    ['4', 'v', 'Watch the inbox', 'Every chat lands in one inbox. Chats Velo was unsure about are marked "Needs you" so you can step in.', 'chats-2-d', 'The inbox', 'r', true],
  ].map(([n, c, t, d, img, alt, tilt, flip]) => `
<section class="sec frow${flip ? ' flip' : ''}">
  <div class="ftext rv"><span class="num ${c}">${n}</span><h2>${t}</h2><p>${d}</p></div>
  <div class="fshot rv">${frameShot(img, alt, tilt)}</div>
</section>`).join('')}
<section class="sec">
  ${head('Every message', 'What happens when a customer writes')}
  <div class="flow">
    ${[['inbox', 'The message arrives', 'From WhatsApp, Telegram, Messenger or Instagram, into one inbox.'], ['tag', 'Velo checks your catalog', 'Your products, prices, opening hours and the last messages in the chat.'], ['spark', 'Velo replies', 'In seconds, in English or Pidgin, using only your facts.'], ['help', 'Or hands it to you', 'Not sure? The customer hears you will reply shortly, and you get an alert.']].map(([k, t, d], i) => `<article class="card rv"><span class="fic ${i % 2 ? 'v' : 'c'}">${ic(k, 24)}</span><h3>${i + 1}. ${t}</h3><p>${d}</p></article>`).join('')}
  </div>
</section>
${band('Try it on your own shop', 'Free plan, 50 replies a day. 7 days of Pro free when you sign up.')}`,
});

pages['pricing/'] = frame({
  path: '/pricing/',
  title: 'VeloSales Ai pricing: Free, Plus ₦7,499, Pro ₦14,999 and Business',
  desc: 'Start free with 50 AI replies a day. Plus is ₦7,499 a month, Pro is ₦14,999 a month, Business from ₦39,999. Pay by card, transfer or USSD. 7 days of Pro free.',
  ld: [APPLD, crumbs('Pricing', '/pricing/'), faqLd(FAQ[1][1])],
  body: phero('Pricing', 'Start free. <span class="shine">Grow when you\'re ready.</span>', 'Every plan answers in English and Pidgin and hands chats to you when Velo is unsure. Pay only for more replies and more apps.') + `
<section class="sec tight">${planCards()}</section>
<section class="sec">
  ${head('Compare', 'Every plan, side by side', '', false)}
  <div class="table-wrap rv"><table class="compare">
    <thead><tr><th scope="col">Feature</th>${PLANS.map((p) => `<th scope="col"${p.best ? ' class="hot"' : ''}>${p.name}</th>`).join('')}</tr></thead>
    <tbody>${COMPARE.map(([f, ...v]) => `<tr><th scope="row">${f}</th>${v.map((x, i) => `<td${PLANS[i].best ? ' class="hot"' : ''}>${x === 1 ? `<span class="yes" aria-label="Included">${ic('check', 14)}</span>` : x === 0 ? '<span class="no" aria-label="Not included">–</span>' : x}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
</section>
<section class="sec frow">
  <div class="ftext rv"><p class="kick">In the app</p><h2>See your plan any time</h2><p>Plan and usage shows the replies you've used today, what each plan adds, and lets you pay by card, transfer or USSD.</p></div>
  <div class="fshot rv">${frameShot('plans-2-d', 'The Plan and usage page', 'r')}</div>
</section>
<section class="sec split faq-split">
  <div class="rv"><p class="kick">Billing</p><h2>Billing questions</h2><p class="lede">Pay through Paystack or Flutterwave. We never store your full card number.</p></div>
  ${faqList(FAQ[1][1])}
</section>
${band('Not sure which plan?', 'Start free. Every new shop gets 7 days of Pro to try everything.')}`,
});

pages['free-plan/'] = frame({
  path: '/free-plan/',
  title: 'Free AI WhatsApp assistant: 50 replies a day at ₦0 | VeloSales Ai',
  desc: 'The VeloSales Ai Free plan answers your customers on WhatsApp and Telegram, 50 replies a day, forever. No card needed. Upgrade only when you need more.',
  ld: [APPLD, crumbs('Free plan', '/free-plan/')],
  body: phero('Free plan', 'Free forever. <span class="shine">Your shop never sleeps.</span>', 'Answer customers on WhatsApp and Telegram at no cost. No card, no time limit.', `<div class="cta-row rv">${go()}<a class="pill line big" href="/pricing/">See all plans</a></div>`) + `
<section class="sec frow">
  <div class="ftext rv"><h2>What you get for ₦0</h2>${ticks(['50 replies a day, shared across your apps', 'WhatsApp and Telegram', 'One inbox for every chat', 'Your catalog, with LEARN: from your phone', 'Answers in English and Pidgin', 'Chat with Velo about your shop', 'Velo hands chats to you when it is not sure'])}</div>
  <div class="fshot rv">${frameShot('chats-1-d', 'The home screen showing replies used today', 'r')}</div>
</section>
<section class="sec tight"><div class="card wide rv"><h2>When you reach 50</h2><p>Customers get a polite "we will reply shortly" message and the chat is flagged for you, so nobody is left on read. Your replies reset at midnight. Need more? <b>Plus</b> gives you 500 replies a day and all four apps for ₦7,499 a month.</p><a class="more" href="/pricing/">Compare plans ${ic('next', 18)}</a></div></section>
${band('Open your shop around the clock', 'Free forever. 7 days of Pro included when you sign up.')}`,
});

pages['pro-trial/'] = frame({
  path: '/pro-trial/',
  title: 'Try VeloSales Ai Pro free for 7 days: no card needed',
  desc: 'Every new shop gets 7 days of Pro free: more replies, all four apps, voice notes and the smartest AI. No card needed. Then keep Free or choose a plan.',
  ld: [crumbs('7-day Pro trial', '/pro-trial/')],
  body: phero('7-day Pro trial', 'Try Pro free <span class="shine">for 7 days.</span>', 'Every new shop starts on Pro. No card, nothing to cancel.', `<div class="cta-row rv">${go('Start my free week')}</div>`) + `
<section class="sec frow">
  <div class="ftext rv"><h2>What Pro adds</h2>${ticks(['1,500 replies a day', 'WhatsApp, Telegram, Messenger and Instagram', 'Voice notes', 'Product photos in replies', 'Catalog import', 'The smartest AI'])}</div>
  <div class="fshot rv">${frameShot('voice-1-d', "Choosing Velo's AI: Fast, Normal or Smart", 'r')}</div>
</section>
<section class="sec tight"><div class="card wide rv"><h2>After 7 days</h2><p>You move to Free automatically and keep everything you set up. If you want more, choose Plus or Pro in the app and pay by card, transfer or USSD.</p><a class="more" href="/pricing/">See prices ${ic('next', 18)}</a></div></section>
${band('Your free week starts today', 'Sign up in a minute. No card needed.')}`,
});

const allFaq = FAQ.flatMap(([, rows]) => rows);
pages['faq/'] = frame({
  path: '/faq/',
  title: 'VeloSales Ai FAQ: free plan, prices, WhatsApp setup and Pidgin',
  desc: 'Answers about VeloSales Ai: the free plan, prices in naira, connecting WhatsApp, Telegram, Messenger and Instagram, Pidgin replies, refunds and your data.',
  ld: [crumbs('FAQ', '/faq/'), faqLd(allFaq)],
  body: phero('FAQ', 'Questions, <span class="shine">answered.</span>', 'Everything shop owners ask in their first week.') + FAQ.map(([t, rows]) => `
<section class="sec tight faq-sec"><h2 class="rv">${t}</h2>${faqList(rows)}</section>`).join('') + band('Still have a question?', 'Email ' + EMAIL + ' or start free and ask from the Help Center.'),
});

pages['contact/'] = frame({
  path: '/contact/',
  title: 'Contact VeloSales Ai: support, billing and the Business plan',
  desc: 'Email VeloSales Ai at ' + EMAIL + ' for help, billing questions or the Business plan for shops with many branches. We reply within one working day.',
  ld: [crumbs('Contact', '/contact/'), { '@type': 'ContactPage', name: 'Contact VeloSales Ai', url: SITE + '/contact/' }],
  body: phero('Contact', 'Talk to <span class="shine">a real person.</span>', 'We reply within one working day.') + `
<section class="sec tight contact">
  <a class="card rv" href="mailto:${EMAIL}?subject=Help%20with%20VeloSales%20Ai"><span class="fic c">${ic('mail', 24)}</span><h2>Help and billing</h2><p>Questions about your account, payments or setup.</p><b>${EMAIL}</b></a>
  <a class="card hot rv" href="mailto:${EMAIL}?subject=Business%20plan"><span class="fic w">${ic('spark', 24)}</span><h2>Business plan</h2><p>Many branches or lots of chats? From ₦39,999 a month, set up with our team.</p><b>Talk to us</b></a>
  <a class="card rv" href="${SIGNIN}"><span class="fic v">${ic('help', 24)}</span><h2>Already a customer?</h2><p>Sign in and open the Help Center. Your account details come with your message.</p><b>Open the app</b></a>
</section>`,
});

pages['login/'] = frame({
  path: '/login/', title: 'Sign in to VeloSales Ai', desc: 'Sign in to the VeloSales Ai web app to see your inbox, catalog and plan.', noindex: true,
  body: phero('Welcome back', 'Sign in to <span class="shine">VeloSales Ai.</span>', 'Your inbox, catalog and plan live in the web app.', `<div class="cta-row rv">${go('Open the web app', SIGNIN)}<a class="pill line big" href="${SIGNUP}">Create an account</a></div>`),
});
pages['thanks/'] = frame({
  path: '/thanks/', title: 'Thanks: you are on the list | VeloSales Ai', desc: 'We will email you when the VeloSales Ai Android app is ready.', noindex: true,
  body: phero('You are on the list', 'Thank <span class="shine">you!</span>', 'We will email you when the Android app is ready. Until then, the web app works on any phone.', `<div class="cta-row rv">${go('Open the web app', SIGNUP)}<a class="pill line big" href="/">Back to home</a></div>`),
});
const notFound = frame({
  path: '/404.html', title: 'Page not found | VeloSales Ai', desc: 'This page does not exist. Go back to the VeloSales Ai home page.', noindex: true,
  body: phero('404', 'This page <span class="shine">isn’t here.</span>', 'The link may be old, or there may be a small typo.', `<div class="cta-row rv">${go('Go to the home page', '/')}<a class="pill line big" href="/faq/">Read the FAQ</a></div>`),
});

// ── write ──
for (const [p, html] of Object.entries(pages)) {
  const dir = join(OUT, p);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  console.log('wrote website/' + p + 'index.html');
}
writeFileSync(join(OUT, '404.html'), notFound, 'utf8');
mkdirSync(join(OUT, 'assets', 'app'), { recursive: true });
for (const n of ['chats-1-d', 'chats-2-d', 'connect-2-d', 'products-2-d', 'products-3-d', 'test-2-d', 'voice-1-d', 'plans-2-d', 'chats-1-p', 'chats-2-p', 'test-2-p']) {
  const src = join(ROOT, 'frontend', 'public', 'help', n + '.jpg');
  if (existsSync(src)) copyFileSync(src, join(OUT, 'assets', 'app', n + '.jpg'));
}
console.log('done');
