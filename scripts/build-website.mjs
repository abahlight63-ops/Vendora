// ── scripts/build-website.mjs ────────────────────────────────────
// WHAT: writes the marketing site (website/) from one place, so every page
// shares the same header, footer, styles and search setup (title,
// description, canonical, social cards and structured data for Google).
// RUN: node scripts/build-website.mjs   (then `npm run build` refreshes the sitemaps)
// EDIT: change the text below, rerun, commit. Do not hand-edit website/*.html:
// the next run overwrites it. website/styles.css and website/site.js are hand-written.
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
const UPDATED = '2026-11-03';

// ── facts (keep in step with Billing and the app's FAQ) ──
const PLANS = [
  { key: 'free', name: 'Free', price: 0, per: '', yearly: '', tag: 'Free forever', cta: 'Start free', href: SIGNUP, feats: ['50 replies a day', 'WhatsApp and Telegram', 'Inbox and catalog', 'Answers in English and Pidgin'] },
  { key: 'plus', name: 'Plus', price: 7499, per: '/ month', yearly: 'or ₦69,999 a year (save 22%)', tag: '', cta: 'Choose Plus', href: SIGNUP, feats: ['500 replies a day', 'All four channels', 'Product photos in replies', 'Catalog import'] },
  { key: 'pro', name: 'Pro', price: 14999, per: '/ month', yearly: 'or ₦119,999 a year (save 33%)', tag: 'Best value', cta: 'Choose Pro', href: SIGNUP, best: true, feats: ['1,500 replies a day', 'Voice notes', 'Smartest AI', 'Everything in Plus'] },
  { key: 'business', name: 'Business', price: 39999, from: true, per: '/ month', yearly: 'Set up with our team', tag: 'From', cta: 'Talk to us', href: '/contact/', feats: ['5,000 replies a day', 'Many branches', 'Priority help', 'We set it up with you'] },
];
const naira = (n) => '₦' + n.toLocaleString('en-NG');
const COMPARE = [
  ['Replies a day', '50', '500', '1,500', '5,000'],
  ['WhatsApp and Telegram', 1, 1, 1, 1],
  ['Facebook Messenger and Instagram', 0, 1, 1, 1],
  ['One inbox for every chat', 1, 1, 1, 1],
  ['English and Pidgin replies', 1, 1, 1, 1],
  ['Hands chats to you when unsure', 1, 1, 1, 1],
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
  ]],
  ['Channels and data', [
    ['Which apps does Velo work on?', 'WhatsApp, Telegram, Facebook Messenger and Instagram. One inbox shows them all.'],
    ['Is my data private?', 'Yes. Your catalog and chats are used only to answer your customers. We never sell data, show ads, or train public AI models on your content.'],
    ['How do I reach support?', 'Use the Help Center inside the app, or email ' + EMAIL + '.'],
  ]],
];
const HOME_FAQ = [FAQ[0][1][0], FAQ[2][1][0], FAQ[2][1][3], FAQ[2][1][2], FAQ[1][1][1]];

// ── small helpers ──
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ICONS = {
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01', check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M7 7l10 10M17 7L7 17',
  next: 'M5 12h14M13 6l6 6-6 6', play: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5l6 3.5-6 3.5z', down: 'M6 9l6 6 6-6', mail: 'M3 5h18v14H3zM4 7l8 6 8-6',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z', tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01', moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  menu: 'M4 7h16M4 12h16M4 17h16', phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2', gift: 'M4 11h16v10H4zM2 7h20v4H2zM12 7v14M12 7S10 3 7.5 3 5 6 7 7M12 7s2-4 4.5-4S19 6 17 7',
};
const ic = (k, s = 20, cls = '') => `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>`;
let gid = 0;
const MARK = (s = 28) => { gid++; const u = 'm' + gid; return `<svg width="${s}" height="${Math.round(s * 1.156)}" viewBox="0 0 602 696" aria-hidden="true"><defs><linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB199"/><stop offset="1" stop-color="#D03C16"/></linearGradient><linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9C8FFA"/><stop offset="1" stop-color="#3B2E9E"/></linearGradient><linearGradient id="${u}c" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF8A6B"/><stop offset=".5" stop-color="#B44BA0"/><stop offset="1" stop-color="#4F3FC7"/></linearGradient></defs><path fill="url(#${u}a)" d="M301 0 L602 189 L0 189 Z"/><path fill="url(#${u}b)" d="M0 189 L0 513 L301 696 Z"/><path fill="url(#${u}c)" d="M602 189 L602 513 L301 696 Z"/></svg>`; };
const COIN = {
  whatsapp: '<circle cx="32" cy="32" r="32" fill="#25D366"/><path fill="#fff" d="M32 14a18 18 0 0 0-15.5 27.2L14 50l9-2.4A18 18 0 1 0 32 14zm0 32.6c-2.8 0-5.5-.8-7.8-2.2l-.6-.3-5.3 1.4 1.4-5.2-.4-.6A14.6 14.6 0 1 1 32 46.6zm8-10.9c-.4-.2-2.6-1.3-3-1.4-.4-.2-.7-.2-1 .2l-1.4 1.7c-.3.3-.5.3-.9.1a12 12 0 0 1-6-5.2c-.4-.8.4-.7 1.3-2.4.1-.3 0-.5 0-.7l-1.4-3.3c-.3-.8-.7-.7-1-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 4 1.7 4.2c.2.3 2.9 4.5 7.1 6.3 2.6 1.1 3.7 1.2 5 1 .8-.1 2.6-1 2.9-2.1.4-1 .4-1.9.3-2.1-.1-.2-.4-.3-.8-.5z"/>',
  telegram: '<circle cx="32" cy="32" r="32" fill="#229ED9"/><path fill="#fff" d="M46.5 18.6 14.9 30.8c-2.2.9-2.1 2.1-.4 2.6l8.1 2.5 3.1 9.6c.4 1.1.2 1.5 1.3 1.5.9 0 1.3-.4 1.8-.9l3.9-3.8 8.1 6c1.5.8 2.6.4 3-1.4l5.4-25.5c.6-2.2-.8-3.2-2.7-2.8zM24.6 35.3l17.6-11.1c.9-.5 1.7-.2 1 .4L28.1 38.2l-.6 6.3z"/>',
  messenger: '<circle cx="32" cy="32" r="32" fill="#7B5CFF"/><path fill="#fff" d="M32 15c-9.6 0-17 7-17 16.5 0 5 2 9.3 5.4 12.3V49l5-2.8c2 .6 4.2.8 6.6.8 9.6 0 17-7 17-16.5S41.6 15 32 15zm1.7 22.2-4.3-4.6-8.5 4.6 9.3-9.9 4.4 4.6 8.4-4.6z"/>',
  instagram: '<circle cx="32" cy="32" r="32" fill="#E1306C"/><rect x="18" y="18" width="28" height="28" rx="8" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="32" cy="32" r="6.5" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="40.5" cy="23.5" r="2" fill="#fff"/>',
};
const coin = (k, s = 40) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" role="img" aria-label="${k[0].toUpperCase() + k.slice(1)}">${COIN[k]}</svg>`;
const coins = (s = 40) => `<span class="coins">${['whatsapp', 'telegram', 'messenger', 'instagram'].map((k) => coin(k, s)).join('')}</span>`;
const photo = (n, alt, eager = false) => `<img src="/assets/photos/s${n}-900.jpg" srcset="/assets/photos/s${n}-900.jpg 900w, /assets/photos/s${n}-1800.jpg 1800w" sizes="(max-width: 900px) 100vw, 640px" width="900" height="1125" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;

// ── structured data ──
const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'VeloSales Ai', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/icon-512.png', width: 512, height: 512 }, email: EMAIL, areaServed: 'NG', description: 'AI sales assistant that answers shop customers on WhatsApp, Telegram, Facebook Messenger and Instagram, in English or Pidgin, from the shop’s own catalog.', contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: EMAIL, availableLanguage: ['en', 'pcm'] } };
const WEBSITE = { '@type': 'WebSite', '@id': SITE + '/#website', name: 'VeloSales Ai', alternateName: 'VeloSales', url: SITE + '/', publisher: { '@id': SITE + '/#org' }, inLanguage: 'en-NG' };
const APPLD = { '@type': 'SoftwareApplication', '@id': SITE + '/#app', name: 'VeloSales Ai', applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android', url: APP + '/', publisher: { '@id': SITE + '/#org' }, description: 'An AI sales assistant for small shops. It answers customers on WhatsApp, Telegram, Facebook Messenger and Instagram in seconds, in English or Pidgin, using only your own prices, and hands the chat to you when it is not sure.', offers: PLANS.filter((p) => p.key !== 'business').map((p) => ({ '@type': 'Offer', name: p.name, price: String(p.price), priceCurrency: 'NGN', url: SITE + '/pricing/' })) };
const faqLd = (rows) => ({ '@type': 'FAQPage', mainEntity: rows.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const crumbs = (name, path) => ({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name, item: SITE + path }] });

// ── page frame ──
const NAV = [['/how-it-works/', 'How it works'], ['/pricing/', 'Pricing'], ['/free-plan/', 'Free plan'], ['/faq/', 'FAQ'], ['/contact/', 'Contact']];
function frame({ path, title, desc, h1Html, body, ld = [], noindex = false, ogTitle }) {
  const url = SITE + path;
  const graph = { '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, ...ld] };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">
<meta name="theme-color" content="#4F3FC7">
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
<script type="application/ld+json">${JSON.stringify(graph)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
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
${h1Html || ''}${body}
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
const goBtn = (txt = 'Start free', href = SIGNUP, cls = '') => `<a class="go ${cls}" href="${href}">${txt}<span class="knob">${ic('next', 20)}</span></a>`;
const planCards = () => `<div class="plans">${PLANS.map((p) => `
  <article class="plan${p.best ? ' best' : ''}">
    <div class="plan-top"><h3>${p.name}</h3>${p.tag && !p.from ? `<span class="chip${p.best ? ' white' : ' good'}">${p.tag}</span>` : ''}</div>
    <p class="price">${p.from ? '<small>From </small>' : ''}${naira(p.price)}<small> ${p.per}</small></p>
    <p class="plan-year">${p.yearly || '&nbsp;'}</p>
    <ul>${p.feats.map((f) => `<li>${ic('check', 14)}${f}</li>`).join('')}</ul>
    <a class="pill ${p.best ? 'coral' : p.key === 'free' ? 'ink' : 'line'}" href="${p.href}">${p.cta}</a>
  </article>`).join('')}
</div>
<p class="plans-note">${ic('gift', 18)}<span>Every new shop gets <b>7 days of Pro free</b>. No card needed. Prices in naira.</span></p>`;
const faqList = (rows) => `<div class="faq">${rows.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}<span>${ic('down', 16)}</span></summary><p>${esc(a)}</p></details>`).join('')}</div>`;
const band = (h = 'Midnight customers are waiting.', p = 'Let Velo answer them while you sleep. Set up in minutes, free.') => `
<section class="band">
  <div><h2>${h}</h2><p>${p}</p></div>
  ${goBtn('Start free', SIGNUP, 'white')}
</section>`;
const hero = (kick, h1, lede, extra = '') => `
<section class="phero">
  <p class="kick">${kick}</p>
  <h1>${h1}</h1>
  <p class="lede">${lede}</p>
  ${extra}
</section>`;
const steps = (rows) => `<ol class="steps">${rows.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol>`;
const features = [
  ['c', 'bolt', 'Answers in seconds', 'Prices, stock, delivery and opening hours, any time of day or night.'],
  ['v', 'spark', 'Speaks like your customers', 'Clear English or Pidgin, matched to how each customer writes.'],
  ['c', 'shield', 'Never invents a price', 'Velo only quotes what is in your catalog. Nothing made up.'],
  ['v', 'help', 'Calls you when unsure', "If Velo isn't sure, it hands the chat to you and alerts you."],
];
const featCards = () => `<div class="feats">${features.map(([c, k, t, d]) => `<article class="feat"><span class="fic ${c}">${ic(k, 26)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>`;
const chatPhoto = (n = 1) => `
  <figure class="photo">
    ${photo(n, 'A shop owner holding a phone', true)}
    <p class="bub in">How much be the bone straight, 20 inch?<small>2:14 AM</small></p>
    <p class="bub me">Na ₦95,000, e still dey. You want make I hold one for you?<small>Velo · just now</small></p>
    <figcaption class="photo-bar">${coin('whatsapp', 36)}<span><b>Replied in seconds</b><small>While the owner was asleep</small></span><span class="chip good">Example chat</span></figcaption>
  </figure>`;

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
  <div class="hero-copy">
    <p class="eyebrow"><i></i>Free to start · No card needed</p>
    <h1>Your shop's AI,<br><em>open 24/7.</em></h1>
    <p class="lede">Velo answers your customers on WhatsApp, Telegram, Messenger and Instagram in seconds, in English or Pidgin, straight from your own prices.</p>
    <div class="cta-row">${goBtn()}<a class="pill line big" href="/how-it-works/">${ic('play', 18)}See how it works</a></div>
    <p class="trust">${coins(38)}<span>One assistant for every channel your customers use</span></p>
  </div>
  ${chatPhoto(1)}
</section>

<section class="sec">
  <p class="kick">What Velo does</p>
  <h2>A sales assistant that never sleeps</h2>
  ${featCards()}
</section>

<section class="sec split">
  <figure class="photo tall">${photo(3, 'Someone sitting with a phone, replying to customers')}</figure>
  <div>
    <p class="kick">How it works</p>
    <h2>Live in an afternoon</h2>
    ${steps([['Add your products', 'Type them in, import a list, or send prices with LEARN: from your phone.'], ['Connect your channels', 'WhatsApp, Telegram, Messenger and Instagram, one tap each.'], ['Test, then switch on', 'Ask Velo like a customer in Test Drive. When you like the answers, go live.']])}
    <a class="more" href="/how-it-works/">Read how it works ${ic('next', 18)}</a>
  </div>
</section>

<section class="sec" id="pricing">
  <div class="center"><p class="kick">Pricing</p><h2>Start free. Grow when you're ready.</h2></div>
  ${planCards()}
  <p class="center"><a class="more" href="/pricing/">Compare every feature ${ic('next', 18)}</a></p>
</section>

<section class="sec split faq-split">
  <div><p class="kick">FAQ</p><h2>Questions, answered</h2><p class="lede">Still unsure? Write to <a href="mailto:${EMAIL}">${EMAIL}</a> and we'll reply within a day.</p><a class="pill line" href="/faq/">See all questions</a></div>
  ${faqList(HOME_FAQ)}
</section>

<section class="sec getapp">
  <div>
    <p class="kick">On your phone</p>
    <h2>Use it in your browser today. Android is in testing.</h2>
    <p class="lede">The web app installs to your home screen in one tap. Leave your email and we'll tell you when the Android app is ready.</p>
  </div>
  <form class="notify" name="launch-notify" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thanks/">
    <input type="hidden" name="form-name" value="launch-notify">
    <p class="hidden"><label>Leave this empty <input name="bot-field"></label></p>
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
  desc: 'Add your products, connect WhatsApp, Telegram, Messenger or Instagram, test Velo, then go live. See what happens when a customer messages your shop.',
  ld: [crumbs('How it works', '/how-it-works/')],
  body: hero('How it works', 'From first message<br>to <em>sale</em>, in seconds', 'Velo reads your catalog, answers the customer the way they write, and calls you in when a person is needed.', `<div class="cta-row">${goBtn()}</div>`) + `
<section class="sec split">
  <div>
    <p class="kick">Set up</p>
    <h2>Three steps, one afternoon</h2>
    ${steps([['Add your products', 'Type them in Catalog, import a list, or send "LEARN: Blue gown ₦45,000" from your own number. Velo saves the name and price.'], ['Connect your channels', 'WhatsApp through a Meta window, Telegram with a bot code, Messenger and Instagram through your Facebook page.'], ['Test, then switch on', 'Ask Velo questions like a customer in Test Drive. When you are happy with the answers, go live.']])}
  </div>
  <figure class="photo tall">${photo(2, 'Hands packing an order next to a phone')}</figure>
</section>
<section class="sec">
  <p class="kick">Every message</p>
  <h2>What happens when a customer writes</h2>
  <div class="flow">
    ${[['inbox', 'The message arrives', 'From WhatsApp, Telegram, Messenger or Instagram, into one inbox.'], ['tag', 'Velo checks your catalog', 'Your products, prices, opening hours and the last messages in the chat.'], ['spark', 'Velo replies', 'In seconds, in English or Pidgin, using only your facts.'], ['help', 'Or hands it to you', 'Not sure? The customer hears you will reply shortly, and you get an alert.']].map(([k, t, d], i) => `<article class="feat"><span class="fic ${i % 2 ? 'v' : 'c'}">${ic(k, 26)}</span><h3>${i + 1}. ${t}</h3><p>${d}</p></article>`).join('')}
  </div>
</section>
<section class="sec">
  <p class="kick">Channels</p>
  <h2>One assistant, four apps</h2>
  <div class="chan">${[['whatsapp', 'WhatsApp', 'Free and all paid plans'], ['telegram', 'Telegram', 'Free and all paid plans'], ['messenger', 'Facebook Messenger', 'Plus and above'], ['instagram', 'Instagram', 'Plus and above']].map(([k, n, d]) => `<article>${coin(k, 52)}<b>${n}</b><span>${d}</span></article>`).join('')}</div>
</section>
${band('Try it on your own shop', 'Free plan, 50 replies a day. 7 days of Pro free when you sign up.')}`,
});

pages['pricing/'] = frame({
  path: '/pricing/',
  title: 'VeloSales Ai pricing: Free, Plus ₦7,499, Pro ₦14,999 and Business',
  desc: 'Start free with 50 AI replies a day. Plus is ₦7,499 a month, Pro is ₦14,999 a month, Business from ₦39,999. Pay by card, transfer or USSD. 7 days of Pro free.',
  ld: [APPLD, crumbs('Pricing', '/pricing/'), faqLd(FAQ[1][1])],
  body: hero('Pricing', 'Start free.<br><em>Grow when you are ready.</em>', 'Every plan answers in English and Pidgin and hands chats to you when Velo is unsure. Pay only for more replies and more channels.') + `
<section class="sec tight">${planCards()}</section>
<section class="sec">
  <h2>Compare every plan</h2>
  <div class="table-wrap"><table class="compare">
    <thead><tr><th scope="col">Feature</th>${PLANS.map((p) => `<th scope="col">${p.name}</th>`).join('')}</tr></thead>
    <tbody>${COMPARE.map(([f, ...v]) => `<tr><th scope="row">${f}</th>${v.map((x) => `<td>${x === 1 ? `<span class="yes" aria-label="Included">${ic('check', 14)}</span>` : x === 0 ? '<span class="no" aria-label="Not included">–</span>' : x}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
</section>
<section class="sec split faq-split">
  <div><p class="kick">Billing</p><h2>Billing questions</h2><p class="lede">Pay by card, bank transfer or USSD through Paystack or Flutterwave.</p></div>
  ${faqList(FAQ[1][1])}
</section>
${band('Not sure which plan?', 'Start free. Every new shop gets 7 days of Pro to try everything.')}`,
});

pages['free-plan/'] = frame({
  path: '/free-plan/',
  title: 'Free AI WhatsApp assistant: 50 replies a day at ₦0 | VeloSales Ai',
  desc: 'The VeloSales Ai Free plan answers your customers on WhatsApp and Telegram, 50 replies a day, forever. No card needed. Upgrade only when you need more.',
  ld: [APPLD, crumbs('Free plan', '/free-plan/')],
  body: hero('Free plan', 'Free forever.<br><em>Your shop never sleeps.</em>', 'Answer customers on WhatsApp and Telegram at no cost. No card, no time limit.', `<div class="cta-row">${goBtn()}<a class="pill line big" href="/pricing/">See all plans</a></div>`) + `
<section class="sec split">
  <div>
    <h2>What you get for ₦0</h2>
    <ul class="ticks">${['50 replies a day, shared across your channels', 'WhatsApp and Telegram', 'One inbox for every chat', 'Your catalog, with LEARN: from your phone', 'Answers in English and Pidgin', 'Velo hands chats to you when it is not sure'].map((t) => `<li>${ic('check', 16)}${t}</li>`).join('')}</ul>
  </div>
  <div class="card">
    <h2>When you reach 50</h2>
    <p>Customers get a polite "we will reply shortly" message and the chat is flagged for you, so nobody is left on read. Your replies reset at midnight.</p>
    <p>Need more? <b>Plus</b> gives you 500 replies a day and all four channels for ₦7,499 a month.</p>
    <a class="more" href="/pricing/">Compare plans ${ic('next', 18)}</a>
  </div>
</section>
${band('Open your shop around the clock', 'Free forever. 7 days of Pro included when you sign up.')}`,
});

pages['pro-trial/'] = frame({
  path: '/pro-trial/',
  title: 'Try VeloSales Ai Pro free for 7 days: no card needed',
  desc: 'Every new shop gets 7 days of Pro free: more replies, all four channels, voice notes and the smartest AI. No card needed. Then keep Free or choose a plan.',
  ld: [crumbs('7-day Pro trial', '/pro-trial/')],
  body: hero('7-day Pro trial', 'Try Pro free<br><em>for 7 days.</em>', 'Every new shop starts on Pro. No card, nothing to cancel.', `<div class="cta-row">${goBtn('Start my free week')}</div>`) + `
<section class="sec split">
  <div>
    <h2>What Pro adds</h2>
    <ul class="ticks">${['1,500 replies a day', 'WhatsApp, Telegram, Messenger and Instagram', 'Voice notes', 'Product photos in replies', 'Catalog import', 'The smartest AI'].map((t) => `<li>${ic('check', 16)}${t}</li>`).join('')}</ul>
  </div>
  <div class="card">
    <h2>After 7 days</h2>
    <p>You move to Free automatically and keep everything you set up. If you want more, choose Plus or Pro in the app and pay by card, transfer or USSD.</p>
    <a class="more" href="/pricing/">See prices ${ic('next', 18)}</a>
  </div>
</section>
${band('Your free week starts today', 'Sign up in a minute. No card needed.')}`,
});

const allFaq = FAQ.flatMap(([, rows]) => rows);
pages['faq/'] = frame({
  path: '/faq/',
  title: 'VeloSales Ai FAQ: free plan, prices, WhatsApp setup and Pidgin',
  desc: 'Answers about VeloSales Ai: the free plan, prices in naira, connecting WhatsApp, Telegram, Messenger and Instagram, Pidgin replies, refunds and your data.',
  ld: [crumbs('FAQ', '/faq/'), faqLd(allFaq)],
  body: hero('FAQ', 'Questions, <em>answered</em>', 'Everything shop owners ask in their first week.') + FAQ.map(([t, rows]) => `
<section class="sec tight faq-sec"><h2>${t}</h2>${faqList(rows)}</section>`).join('') + band('Still have a question?', 'Email ' + EMAIL + ' or start free and ask from the Help Center.'),
});

pages['contact/'] = frame({
  path: '/contact/',
  title: 'Contact VeloSales Ai: support, billing and the Business plan',
  desc: 'Email VeloSales Ai at ' + EMAIL + ' for help, billing questions or the Business plan for shops with many branches. We reply within one working day.',
  ld: [crumbs('Contact', '/contact/'), { '@type': 'ContactPage', name: 'Contact VeloSales Ai', url: SITE + '/contact/' }],
  body: hero('Contact', 'Talk to <em>a real person</em>', 'We reply within one working day.') + `
<section class="sec tight contact">
  <a class="card" href="mailto:${EMAIL}?subject=Help%20with%20VeloSales%20Ai"><span class="fic c">${ic('mail', 26)}</span><h2>Help and billing</h2><p>Questions about your account, payments or setup.</p><b>${EMAIL}</b></a>
  <a class="card dark" href="mailto:${EMAIL}?subject=Business%20plan"><span class="fic v">${ic('spark', 26)}</span><h2>Business plan</h2><p>Many branches or lots of chats? From ₦39,999 a month, set up with our team.</p><b>Talk to us</b></a>
  <a class="card" href="${SIGNIN}"><span class="fic v">${ic('help', 26)}</span><h2>Already a customer?</h2><p>Sign in and open the Help Center. Your account details come with your message.</p><b>Open the app</b></a>
</section>`,
});

pages['login/'] = frame({
  path: '/login/',
  title: 'Sign in to VeloSales Ai',
  desc: 'Sign in to the VeloSales Ai web app to see your inbox, catalog and plan.',
  noindex: true,
  body: hero('Welcome back', 'Sign in to <em>VeloSales Ai</em>', 'Your inbox, catalog and plan live in the web app.', `<div class="cta-row">${goBtn('Open the web app', SIGNIN)}<a class="pill line big" href="${SIGNUP}">Create an account</a></div>`),
});

pages['thanks/'] = frame({
  path: '/thanks/',
  title: 'Thanks: you are on the list | VeloSales Ai',
  desc: 'We will email you when the VeloSales Ai Android app is ready.',
  noindex: true,
  body: hero('You are on the list', 'Thank <em>you!</em>', 'We will email you when the Android app is ready. Until then, the web app works on any phone.', `<div class="cta-row">${goBtn('Open the web app', SIGNUP)}<a class="pill line big" href="/">Back to home</a></div>`),
});

const notFound = frame({
  path: '/404.html',
  title: 'Page not found | VeloSales Ai',
  desc: 'This page does not exist. Go back to the VeloSales Ai home page.',
  noindex: true,
  body: hero('404', 'This page <em>isn’t here</em>', 'The link may be old, or there may be a small typo.', `<div class="cta-row">${goBtn('Go to the home page', '/')}<a class="pill line big" href="/faq/">Read the FAQ</a></div>`),
});

// ── write ──
for (const [p, html] of Object.entries(pages)) {
  const dir = join(OUT, p);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  console.log('wrote website/' + p + 'index.html');
}
writeFileSync(join(OUT, '404.html'), notFound, 'utf8');
mkdirSync(join(OUT, 'assets', 'photos'), { recursive: true });
for (const n of [1, 2, 3]) for (const w of [900, 1800]) {
  const src = join(ROOT, 'frontend', 'public', 'welcome', `s${n}-${w}.jpg`);
  if (existsSync(src)) copyFileSync(src, join(OUT, 'assets', 'photos', `s${n}-${w}.jpg`));
}
console.log('done');
