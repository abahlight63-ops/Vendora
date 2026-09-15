// ── scripts/broadcast-updates.js ───────────────────────────────────
// WHAT: pushes the v1.6.0 changes into EVERY owner's notification bell.
// Run:  DATABASE_URL=... node scripts/broadcast-updates.js
// (local .env works too if Postgres runs locally). Safe to re-run? NO —
// each run adds a fresh copy per business, so run it ONCE per release.
// MODULES: dotenv (env), ../src/services/notifyService (fan-out).
require('dotenv').config(); // must run BEFORE requiring db (pool reads DATABASE_URL at load)
const notify = require('../src/services/notifyService');
const db = require('../src/db');

const NOTES = [ // title ≤120 chars, body ≤500 (notify() slices anyway — defense in depth!)
  {
    title: 'New plans: Pro + Pro Plus 💎',
    body: 'Pro ₦7,499/mo (₦69,999/yr, save 22%). Pro Plus ₦14,999/mo (₦120,000/yr, save 33%) adds voice-note transcription + 2 heavy work models. Pay-once? Contact sales. See Billing.',
    link: '/billing',
  },
  {
    title: 'Vendora now speaks YOUR hustle 🎯',
    body: 'New signups pick their niche (fashion, food, freelance…) and Vendora AI suggestions + answers adapt to it. Set yours: finish the welcome setup or update your Profile.',
    link: '/vendora-ai',
  },
  {
    title: 'Your bot now sells like a human 🛍️',
    body: 'Every customer answer now comes with up to 5 options to choose from — plus product photos inside replies for Pro shops. Add photos in Catalog.',
    link: '/catalog',
  },
];

(async () => { // async IIFE (top-level await style used across scripts/)
  for (const n of NOTES) { // sequential: three fan-outs, counted separately
    const sent = await notify.broadcast(n); // one row per business (bell polls it within ~60s!)
    console.log(`Broadcast "${n.title}" → ${sent} inboxes`);
  }
  await db.pool.end(); // close pool so the script exits (else Node hangs!)
})().catch((e) => { // IIFE .catch = any failure above lands here
  console.error(e); // print the real error (e.g. wrong DATABASE_URL)
  process.exit(1); // exit 1 = failure (CI/scripts check this!)
});
