// ── src/routes/telegramRoutes.js ───────────────────────────────────
// WHAT: Telegram entry points (Bot API webhooks). TWO modes, one file:
//   per-shop: POST /webhook/telegram/:bizId — shop's own BotFather bot.
//     Customers just message (bot IS the shop — no code needed!). Owner binds
//     once via /start link_<CODE> (CODE from Profile → owner_telegram_id).
//   shared:   POST /webhook/telegram/shared — ONE @VeloSalesBot for Pro shops.
//     Customers bind via /start <CODE>; owner commands OFF here (dashboard!).
// Routing into the brain: normalize to controller-shape req.body + req.telegram
// context, then reuse webhookController.handleInbound (ONE brain, two doors!).
// No npm modules — express + local services only.
const express = require('express'); // Router class
const crypto = require('crypto'); // Node built-in: random link codes
const db = require('../db'); // pool (business lookup, link binds)
const tg = require('../services/channels/telegram'); // parseInbound, sendText, downloadFile, verifySecret
const whatsappService = require('../services/whatsappService'); // transcribeAudio (Whisper on Groq!)
const planService = require('../services/planService'); // isPro (voice = Pro!)

const router = express.Router(); // the mini-app

function makeCode() {
  return 'BIZ' + crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. BIZ7X2K9Q (short, typable, unguessable-ish!)
}

// Resolve a per-shop business (token must match what's stored — token IS auth!).
async function shopById(bizId) {
  const { rows } = await db.query('SELECT * FROM businesses WHERE id = $1 LIMIT 1', [Number(bizId) || 0]); // Number() guards junk ids (NaN → 0 → no row!)
  const b = rows[0];
  if (!b || !b.telegram_bot_token) return null; // unknown shop OR Telegram never connected (token empty!)
  return b;
}

// Normalize a parsed Telegram message into controller-shape body + telegram ctx,
// then hand to the shared brain. Returns nothing (always 200s inside!).
async function handleParsed(business, botToken, parsed, req, res) {
  const handleInbound = require('../controllers/webhookController').handleInbound; // lazy require (route↔controller cycle safety!)
  const fromTag = `telegram:${parsed.chatId}`; // customer identity (channel-prefixed — never collides with whatsapp:+… numbers!)
  // Media pre-download (Telegram file API — the brain takes pre-fetched bytes!):
  let media = null; // { kind:'image'|'audio', mime, base64 } or null
  if ((parsed.kind === 'photo' || parsed.kind === 'voice') && parsed.fileId) {
    const dl = await tg.downloadFile(botToken, parsed.fileId, parsed.mime); // bytes via getFile (≤10MB guard inside!)
    if (dl) media = { kind: parsed.kind, mime: parsed.mime, base64: dl.base64 };
  }
  // Voice → transcript HERE (Plus-gated: business known at route level!)…
  let body = parsed.text || ''; // typed text and/or caption (may be empty for pure voice/photo!)
  if (parsed.kind === 'voice' && media) {
    if (!planService.isProPlus(business)) { // non-Plus: note it (brain hands off gracefully — premium selling point, not silence!)
      body = (body ? body + '\n' : '') + '[a voice note was sent — voice notes are a Pro Plus feature]';
    } else { // Plus: Whisper Large v3 (sub-second, free tier!)…
      const said = await whatsappService.transcribeAudio({ mime: parsed.mime, base64: media.base64 }); // same transcriber as WhatsApp path (one voice engine!)
      body = said // transcript wins, caption preserved below (both signals!)…
        ? `Voice note: "${said}"${body ? `\n${body}` : ''}`
        : (body ? body + '\n' : '') + '[a voice note was sent that could not be transcribed]'; // …null → handoff cue (never silence, never invention!)
      media = null; // consumed into text (don't ALSO run vision on audio bytes!)
    }
  }
  req.body = { // controller shape (the brain's From/To/Body/ProfileName contract — adapter pattern!)…
    From: fromTag, // telegram:chatId (routing + identity in one string!)
    To: `telegram:${business.id}`, // shop identity (brain looks up business BY NUMBER normally — overridden below!)
    Body: body, // text (+ transcript/caption/notes above!)
    ProfileName: parsed.name, // Telegram first+last name (inbox display!)
  };
  req.telegram = { // context the brain reads (see webhookController edits!)…
    business, // looked-up shop row (skips number lookup!)
    botToken, // reply sender (routes OUT through this bot!)
    chatId: parsed.chatId, // reply recipient (Telegram chat id!)
    ownerTid: business.owner_telegram_id || null, // linked owner id (owner commands from here!)
    media, // pre-downloaded {kind,mime,base64} (vision input for photos!)
  };
  tg.sendAction(botToken, parsed.chatId, 'typing').catch(() => {}); // instant presence (customer sees "typing…" while the AI thinks!)
  const keepTyping = setInterval(() => { tg.sendAction(botToken, parsed.chatId, 'typing').catch(() => {}); }, 4000); // Telegram clears presence after ~5s — re-fire until the reply lands!
  try {
    await handleInbound(req, res); // ONE brain (all LEARN/SYNC/PAUSE/AI/takeover logic reused — zero duplication!)
  } finally {
    clearInterval(keepTyping); // reply sent (or errored) → stop presence (no orphan timers, ever!)
  }
}

// ---- Per-shop bot: POST /webhook/telegram/:bizId ----
router.post('/telegram/:bizId', async (req, res) => {
  if (!tg.verifySecret(req)) return res.status(403).end(); // wrong/missing secret (anyone can POST — prove you're Telegram!)
  const business = await shopById(req.params.bizId); // shop + token check…
  if (!business) return res.status(200).send(''); // unknown/unconnected (200 anyway — don't feed retry loops!)
  const parsed = tg.parseInbound(req.body); // normalize (null = edits/bots/stickers-noise → ignore!)
  if (!parsed) return res.status(200).send('');
  const token = business.telegram_bot_token; // reply sender = this shop's bot…
  // Owner link: /start link_<CODE> (CODE from Profile "Link Telegram" — regenerated per tap!)…
  const startMatch = /\/start\s+link_([A-Za-z0-9]+)/i.exec(parsed.text || ''); // regex: /start link_CODE (case-insensitive /start!)
  if (startMatch) {
    const { rows } = await db.query('SELECT id FROM businesses WHERE telegram_link_code = $1 LIMIT 1', [startMatch[1].toUpperCase()]); // code lookup (uppercased — typable!)
    if (rows.length && Number(rows[0].id) === Number(business.id)) { // code belongs to THIS shop (cross-shop codes rejected!)
      await db.query('UPDATE businesses SET owner_telegram_id = $1 WHERE id = $2', [parsed.fromId, business.id]); // bind owner (owner commands now work from here!)
      await tg.sendText(token, parsed.chatId, `Telegram linked — owner commands work here now (LEARN:, SYNC:, PAUSE, UNDO:). Customers just message normally.`);
    } else {
      await tg.sendText(token, parsed.chatId, 'That link code is not for this shop — tap Link Telegram in your dashboard for a fresh one.');
    }
    return res.status(200).send('');
  }
  await handleParsed(business, token, parsed, req, res); // normal flow (customers need NO code on per-shop bots!)
});

// ---- Shared bot: POST /webhook/telegram/shared ----
router.post('/telegram/shared', async (req, res) => {
  if (!tg.verifySecret(req)) return res.status(403).end(); // same secret gate (one secret, all bots!)
  const sharedToken = process.env.TELEGRAM_SHARED_BOT_TOKEN; // the ONE @VeloSalesBot token (empty = shared mode off!)
  if (!sharedToken) return res.status(200).send(''); // unconfigured (200, no retries!)
  const parsed = tg.parseInbound(req.body);
  if (!parsed) return res.status(200).send(''); // noise ignored
  const startMatch = /\/start\s+(\S+)/i.exec(parsed.text || ''); // /start <something> (the routing key!)…
  if (startMatch) {
    const code = startMatch[1].replace(/^link_/i, ''); // strip optional link_ prefix (owner-style links work for binding too — harmless!)
    const { rows } = await db.query('SELECT * FROM businesses WHERE UPPER(telegram_link_code) = UPPER($1) LIMIT 1', [code]); // code → shop (case-insensitive!)
    if (rows.length) { // valid code → bind FOREVER (upsert: re-tapping refreshes, never duplicates!)…
      await db.query(
        `INSERT INTO telegram_links (telegram_id, business_id) VALUES ($1, $2)
         ON CONFLICT (telegram_id) DO UPDATE SET business_id = EXCLUDED.business_id`, // re-linking SWITCHES shops (one user, one shop — simple mental model!)
        [parsed.fromId, rows[0].id]
      );
      await tg.sendText(sharedToken, parsed.chatId, `Connected to ${rows[0].name} — send your questions! (Pro shops: smarter models + voice included.)`);
      return res.status(200).send('');
    }
    await tg.sendText(sharedToken, parsed.chatId, 'Welcome to VeloSales Ai! Ask your shop for their link code — it looks like BIZ7X2K. (Shops: find yours in Profile → Telegram.)');
    return res.status(200).send('');
  }
  const { rows } = await db.query('SELECT b.* FROM telegram_links l JOIN businesses b ON b.id = l.business_id WHERE l.telegram_id = $1 LIMIT 1', [parsed.fromId]); // route by binding (no code needed after first tap!)
  if (!rows.length) { // never linked → teach (not silence — onboarding moment!)…
    await tg.sendText(sharedToken, parsed.chatId, 'Hi! Tap your shop\u2019s link first (looks like BIZ7X2K) — then chat away.');
    return res.status(200).send('');
  }
  await handleParsed(rows[0], sharedToken, parsed, req, res); // bound → normal flow (owner commands OFF on shared bot — dashboard covers it!)
});

module.exports = router; // server.js mounts at /webhook (→ /webhook/telegram/:bizId + /shared!)
