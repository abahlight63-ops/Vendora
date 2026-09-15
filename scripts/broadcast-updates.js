// ── scripts/broadcast-updates.js ───────────────────────────────────
// WHAT: pushes the CURRENT src/version.js WHATS_NEW notes into EVERY owner's
// notification bell (manual re-send — normal releases broadcast automatically
// on boot via maybeBroadcastRelease in src/server.js!).
// Run:  DATABASE_URL=... node scripts/broadcast-updates.js
// (local .env works too if Postgres runs locally). Safe to re-run? NO —
// each run adds a fresh copy per business, so run it ONCE per manual push.
// MODULES: dotenv (env), ../src/version (single source of truth!),
// ../src/services/notifyService (fan-out).
require('dotenv').config(); // must run BEFORE requiring db (pool reads DATABASE_URL at load)
const { APP_VERSION, WHATS_NEW } = require('../src/version'); // THE notes (same ones boot broadcasts!)
const notify = require('../src/services/notifyService');
const db = require('../src/db');

(async () => { // async IIFE (top-level await style used across scripts/)
  for (const note of WHATS_NEW) { // sequential fan-outs, counted separately
    const text = String((note && note.text) || note || ''); // strings AND {text, link} both work!
    const link = String((note && note.link) || '/dashboard');
    if (!text.trim()) continue;
    const sent = await notify.broadcast({ title: `New in v${APP_VERSION}: ${text.slice(0, 90)}`, body: text.slice(0, 500), link }); // one row per business (bell polls it within ~60s + NEW pill for 2 min!)
    console.log(`Broadcast "${text.slice(0, 60)}" → ${sent} inboxes`);
  }
  await db.pool.end(); // close pool so the script exits (else Node hangs!)
})().catch((e) => { // IIFE .catch = any failure above lands here
  console.error(e); // print the real error (e.g. wrong DATABASE_URL)
  process.exit(1); // exit 1 = failure (CI/scripts check this!)
});
