// ── src/controllers/ownerController.js ─────────────────────────────
// WHAT: the logged-in owner's entire private API (everything under /api/me).
// Every function is session-scoped: req.session.businessId decides WHAT you
// see — owners can never touch another shop's data (no client-sent ids).
// MODULES: ../db (pool), local services (required lazily INSIDE functions to
// dodge circular-import issues), ../utils/phone (normalizePhone).
const db = require('../db'); // shared pool
const productService = require('../services/productService'); // catalog reads/writes (top-level: no cycle here)
const { normalizePhone } = require('../utils/phone'); // destructure one helper out of the module

async function getMe(req, res) {
  const planService = require('../services/planService'); // lazy require (consistent style in this file)
  const { rows } = await db.query( // the owner's own business row + everything the dashboard needs…
    `SELECT b.id, b.name, b.whatsapp_number, b.owner_number, b.hours, b.faq, b.tone,
            b.max_discount_pct, b.min_order_naira, b.currency, b.timezone,
            b.bot_enabled, b.personal_contacts, b.plan_tier,
            b.business_niche, b.heard_from, b.catalog_size, b.channels, b.daily_volume,
            b.referral_code, b.bonus_pro_until,
            b.greeting_msg, b.handoff_msg,
            b.subscription_status, b.subscription_expires, b.trial_started_at,
            b.trial_warned, b.trial_expiry_notified
     FROM businesses b WHERE b.id = $1`, // b = alias; WHERE session id (never a client id!)
    [req.session.businessId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Business not found' }); // session points at deleted business
  const b = rows[0]; // shorthand for the tier/ads logic below
  await checkTrialLifecycle(req.session.businessId, b); // 7-day trial watchdog (warn → expire → bell; once each, no cron needed!)
  if (b.trialJustEnded) { // watchdog flipped us to free THIS load (flags below already saved)…
    b.subscription_status = 'expired'; // …mirror it in THIS response (UI honest on the very first expired load, no refresh needed!)
  }
  // Ads: free tier only — Pro never sees ads.
  // provider: any network that gives you a script tag (Adsterra, PropellerAds,
  // Monetag...). sponsor: YOUR OWN direct deal with a local business (best rates).
  // Free tier ALWAYS gets an object (even when nothing is configured) so the
  // app can show its own house notice — Pro gets null (zero ad pixels).
  const tier = planService.tier(b); // 'pro' | 'free' from subscription + trial clock
  let ads = null; // default: no ads (Pro, or logged-out edge, or ads opted OUT)
  // ADS MODES (owner's call — see ads-future.md for the full playbook):
  //   ADS_ENABLED=1    → full menu (networks + sponsor + video waterfall).
  //   ADS_VIDEO_ONLY=1 → Hilltop gated video ONLY (no tags, no interstitials,
  //                      no popunders, no Smartlinks — the careful path!).
  // Frontend treats null as "no ads" and empty networks/sponsor as "video
  // gates only" — every combination degrades to working buttons, never traps.
  const videoOnly = process.env.ADS_VIDEO_ONLY === '1';
  if ((process.env.ADS_ENABLED === '1' || videoOnly) && tier !== 'pro') { // free users only past this point…
    // Video-only mode strips everything but the Hilltop gated player (careful
    // integration: a video gate with countdown + skip can never hijack a click
    // the way tags and offer links can — worst case it shows nothing and the
    // button works exactly as today!).
    const sponsor = !videoOnly && process.env.SPONSOR_TITLE && process.env.SPONSOR_LINK
      ? { title: process.env.SPONSOR_TITLE, text: process.env.SPONSOR_TEXT || '', // && = both must exist; || '' = optional fields default empty
          link: process.env.SPONSOR_LINK, image: process.env.SPONSOR_IMAGE || '',
          video: (process.env.SPONSOR_VIDEO_URL || '').trim() || null } // optional mp4: plays inside the interstitial (video ads without any network!)
      : null; // no sponsor configured (or video-only mode) → null (frontend shows its house notice)
    // One entry per network (Monetag primary, Adsterra Social Bar secondary…).
    // Banners/social bars ONLY — popunders are banned from auto-inject (they
    // hijack the user's next click and drag the whole tab to the offer URL —
    // the /drm/… lesson!). Offer links open ONLY behind explicit "Visit
    // sponsor" taps (new tab, user gesture). freq 'session' = inject once per
    // login; the network itself throttles impressions.
    // Video-only mode sends ZERO networks (no third-party JS on the page!).
    const networks = videoOnly ? [] : [
      { provider: process.env.ADS_PROVIDER || 'custom', scriptUrl: process.env.ADS_SCRIPT_URL || null, freq: 'session' },
      { provider: process.env.ADS_PROVIDER_2 || 'custom', scriptUrl: process.env.ADS_SCRIPT_URL_2 || null, freq: 'session' },
    ].filter((n) => n.scriptUrl); // .filter keeps only configured networks (unconfigured = no tag = no crash)
    const videoOrder = String(process.env.ADS_VIDEO_ORDER || 'sponsor,hilltopads,monetag,adsterra') // waterfall order (reorder without a deploy!)
      .split(',').map((s) => s.trim().toLowerCase()).filter((s) => ['sponsor', 'hilltopads', 'monetag', 'adsterra'].includes(s));
    const hillTag = (process.env.ADS_VIDEO_HILLTOPADS || '').trim() || null;
    // Video-only mode passes the configured URL straight through (the owner
    // pastes it deliberately from their own Hilltop zone panel — zone #7458485
    // serves VAST *documents*, not .js). Safety lives in the PLAYER, not the
    // URL: .js tags script-inject, everything else is FETCHED as VAST XML by
    // the on-demand IMA player (never executed, never navigated — the /drm/…
    // danger was auto-injected tags + same-tab exits, neither applies here!).
    // Any failure at any step degrades to a working button (never a trap!).
    const hillPlayable = hillTag;
    const video = videoOnly // video-only: Hilltop tag or nothing (monetag/adsterra/sponsor layers forcibly off!)
      ? { order: ['hilltopads'], sponsorVideo: null, sponsorLink: null, sponsorTitle: null, hilltopads: hillPlayable, monetag: null, adsterra: null }
      : { // 30s gated player on Connect (free tier): sponsor mp4 > HilltopAds VAST > Monetag rewarded > Adsterra Smartlink
        order: videoOrder.length ? videoOrder : ['sponsor', 'hilltopads', 'monetag', 'adsterra'], // empty env = full waterfall (safe default!)
        sponsorVideo: (sponsor && sponsor.video) || null, // own mp4 (first priority, billed per COMPLETE!)
        sponsorLink: (sponsor && sponsor.link) || null,
        sponsorTitle: (sponsor && sponsor.title) || null,
        hilltopads: (process.env.ADS_VIDEO_HILLTOPADS || '').trim() || null, // VAST/video zone tag URL
        monetag: (process.env.ADS_VIDEO_MONETAG || '').trim() || null, // rewarded/interstitial zone tag URL
        adsterra: (process.env.ADS_VIDEO_FALLBACK || '').trim() || null, // Smartlink URL (never-empty exit traffic!)
      };
    ads = { networks, sponsor, scriptUrl: networks[0]?.scriptUrl || null, provider: networks[0]?.provider || 'custom', video }; // scriptUrl/provider kept for backward-compat with older frontend
  }
  res.json({ business: { ...b, tier }, ads }); // spread ...b copies all columns + adds tier; ads rides along so App.jsx knows whether to load tags
}

async function updateBusiness(req, res) {
  const planService = require('../services/planService');
  const { name, owner_number: ownerRaw, hours, faq, tone, currency: curRaw, timezone: tzRaw } = req.body || {}; // pull editable fields (whatsapp_number is LOCKED — identity mustn't change)
  const owner = ownerRaw ? normalizePhone(ownerRaw) : null; // normalize only if provided (ternary guards empty)
  const errors = []; // collect-all-errors validation
  if (!name || typeof name !== 'string') errors.push('Business name required');
  if (ownerRaw && !owner) errors.push('Enter a valid WhatsApp number (e.g. 0803 123 4567)');
  if (faq !== undefined && !Array.isArray(faq)) errors.push('faq must be an array');
  if (curRaw !== undefined && !['NGN', 'USD'].includes(curRaw)) errors.push('currency must be NGN or USD'); // whitelist (only two real options)
  const { personal_contacts: pcRaw } = req.body || {}; // friends/family numbers the bot must NEVER reply to (array of strings)
  let personal = null; // null = "don't touch what's stored" (vs [] = "clear the list" — different meanings!)
  if (pcRaw !== undefined) { // provided? validate strictly…
    if (!Array.isArray(pcRaw)) errors.push('personal_contacts must be an array of phone numbers');
    else { // normalize each entry (accept "0803…", "+234…", "whatsapp:+234…")…
      const { normalizePhone: norm } = require('../utils/phone'); // inline require (same module, style-consistent)
      personal = [];
      for (const raw of pcRaw) { // for...of (clearer than map+filter for validate-and-collect)…
        if (typeof raw !== 'string' || !raw.trim()) continue; // skip blanks/non-strings silently (forgiving input!)
        const n = norm(raw); // → 'whatsapp:+234…' or null…
        if (!n) { errors.push(`Invalid personal number: ${raw}`); break; } // …one bad number fails the batch (explicit > silently dropping!)
        personal.push(n);
      }
    }
  }
  const { business_niche: nicheRaw } = req.body || {}; // lane switch (Profile page — catalog shelves + AI suggestions follow it!)
  let niche = null; // null = "don't touch" (absent key → keep stored lane!)
  if (nicheRaw !== undefined) { // provided? validate strictly…
    if (typeof nicheRaw !== 'string' || !nicheRaw.trim()) errors.push('Pick what you sell');
    else niche = nicheRaw.trim().slice(0, 80); // free text ≤80 (custom lanes never need a deploy!)
  }
  if (errors.length) return res.status(400).json({ errors });

  const { rows: cur } = await db.query('SELECT whatsapp_number, owner_number, currency, timezone FROM businesses WHERE id = $1', [req.session.businessId]); // read CURRENT values first (needed for smart defaults below)
  const old = cur[0] || {}; // || {} guards deleted-business edge
  // Currency: explicit choice wins; otherwise re-resolve when numbers change.
  const currency = curRaw || ((ownerRaw && owner !== old.owner_number) // nested ternary: explicit? → use it. Else: owner number CHANGED? → re-resolve from numbers…
    ? planService.resolveCurrency(old.whatsapp_number, owner)
    : (old.currency || 'NGN')); // …else keep what's stored (or NGN default)
  const timezone = (typeof tzRaw === 'string' && tzRaw.trim()) || old.timezone || 'Africa/Lagos'; // trim blanks; chain of fallbacks

  const { rows } = await db.query( // write it all + hand back the fresh row
    `UPDATE businesses SET name = $1, owner_number = $2, hours = $3, faq = $4, tone = $5, currency = $6, timezone = $7
     ${personal !== null ? ', personal_contacts = $9' : ''} -- dynamic SET clause: only touch the list when provided (else keep stored!)
     WHERE id = $8
     RETURNING id, name, whatsapp_number, owner_number, hours, faq, tone, currency, timezone, personal_contacts, bot_enabled`,
    personal !== null // params array must MATCH the $ placeholders above (conditional 9th param!)
      ? [name, owner || null, req.body.hours || '', JSON.stringify(faq || []), req.body.tone || 'friendly and helpful', currency, timezone, req.session.businessId, JSON.stringify(personal)]
      : [name, owner || null, req.body.hours || '', JSON.stringify(faq || []), req.body.tone || 'friendly and helpful', currency, timezone, req.session.businessId]
  ); // JSON.stringify: faq ARRAY + personal ARRAY → JSONB columns need JSON strings
  if (niche !== null) await db.query('UPDATE businesses SET business_niche = $1 WHERE id = $2', [niche, req.session.businessId]); // lane switch (separate write — keeps the placeholder juggling above untouched!)
  res.json({ ...rows[0], ...(niche !== null ? { business_niche: niche } : {}) }); // frontend Profile page uses the returned row (no refetch needed)
}

// 7-day trial watchdog — runs on every getMe (every app load polls /api/me,
// so expiry is caught within a day with ZERO cron and ZERO extra API keys).
// - trialing + ≤2 days left + never warned → "2 days left" bell (once!).
// - trialing + clock over + never notified → flip status to expired (Pro
//   features drop instantly — every gate reads status!) + "trial ended" bell.
// Paid buyers skip everything (activateSubscription pre-sets both flags!).
async function checkTrialLifecycle(businessId, b) {
  try { // everything guarded: a watchdog must NEVER break getMe (availability over strictness!)
    if (!b || b.subscription_status !== 'trialing') return; // only trials (active/expired/pending untouched!)
    const planService = require('../services/planService');
    const notify = require('../services/notifyService');
    const left = planService.trialDaysLeft(b); // whole days left (≤0 = over!)
    if (left <= 0 && !b.trial_expiry_notified) { // trial OVER → cut Pro + tell them (once!)
      await db.query(
        "UPDATE businesses SET subscription_status = 'expired', trial_expiry_notified = true WHERE id = $1",
        [businessId]
      ); // status flip = Pro gates close THIS instant (photos, sync, premium AIs — all read status!)
      b.trialJustEnded = true; // in-memory flag (getMe mirrors it into this response!)
      await notify.notify(businessId, { // bell: ended (fire-and-forget inside notify!)
        title: 'Your Pro trial ended — free plan on',
        body: 'Your 7-day Pro trial is over. Your bot keeps replying from your manual catalog, free forever. Upgrade on Billing to switch Pro back on.',
        link: '/billing',
      });
      require('../services/emailTemplates').ownerContact(businessId).then((c) => { // trial-ended email (best-effort: bell already sent — mail failing changes nothing!)
        if (!c) return null;
        return require('../services/emailTemplates').sendTrialEnded(c.email, c.name);
      }).catch((e) => console.error('trial-ended email error:', e.message));
    } else if (left <= 2 && left > 0 && !b.trial_warned) { // last 2 days → warn (once!)
      await db.query('UPDATE businesses SET trial_warned = true WHERE id = $1', [businessId]);
      await notify.notify(businessId, {
        title: `Pro trial: ${left} day${left === 1 ? '' : 's'} left`,
        body: 'Your Pro trial ends soon. Pick Pro or Pro Plus on Billing to keep profile sync, photos + premium AIs — or stay free, your catalog stays yours.',
        link: '/billing',
      });
      require('../services/emailTemplates').ownerContact(businessId).then((c) => { // trial-ending email (best-effort!)
        if (!c) return null;
        return require('../services/emailTemplates').sendTrialEnding(c.email, c.name, left);
      }).catch((e) => console.error('trial-warn email error:', e.message));
    }
  } catch (e) { console.error('trial watchdog error:', e.message); } // log only (getMe continues — degraded watchdog beats dead dashboard!)
}

// Welcome setup: the 5-question quiz (/welcome web + mobile setup screen).
// Q1 niche (required — drives catalog shelves + AI suggestions), Q2 catalog
// size, Q3 channels, Q4 chat volume (all optional — skippable!), Q5 heard-from.
// Answers personalize the dashboard checklist + Connect/Billing hints.
const QUIZ_SIZES = ['starting', 'under-20', '20-100', '100-plus']; // Q2 whitelist (unknown strings → stored as '' = skipped!)
const QUIZ_CHANNELS = ['whatsapp', 'telegram', 'instagram', 'walkin']; // Q3 whitelist (multi-pick → comma list!)
const QUIZ_VOLUMES = ['few', '10-50', '50-plus']; // Q4 whitelist
async function saveSetup(req, res) {
  const { business_niche: nicheRaw, heard_from: heardRaw, catalog_size: sizeRaw, channels: channelsRaw, daily_volume: volumeRaw } = req.body || {};
  const niche = typeof nicheRaw === 'string' ? nicheRaw.trim().slice(0, 80) : '';
  const heard = typeof heardRaw === 'string' ? heardRaw.trim().slice(0, 40) : '';
  const size = QUIZ_SIZES.includes(sizeRaw) ? sizeRaw : ''; // whitelist-or-blank (never trust the client!)
  const channels = Array.isArray(channelsRaw) // array from the app → comma list of KNOWN channels only…
    ? channelsRaw.filter((c) => QUIZ_CHANNELS.includes(c)).slice(0, 4).join(',')
    : (typeof channelsRaw === 'string' ? channelsRaw.split(',').map((c) => c.trim()).filter((c) => QUIZ_CHANNELS.includes(c)).slice(0, 4).join(',') : ''); // …or comma string (same rule — mobile sends either!)
  const volume = QUIZ_VOLUMES.includes(volumeRaw) ? volumeRaw : ''; // whitelist-or-blank
  if (!niche) return res.status(400).json({ error: 'Pick what your business sells first.' }); // niche is the hard requirement (everything else skippable!)
  const before = await db.query('SELECT business_niche FROM businesses WHERE id = $1', [req.session.businessId]); // quiz-complete detection needs the BEFORE value!
  const wasNiche = before.rows[0] && before.rows[0].business_niche;
  const { rows } = await db.query( // session-scoped write (owners set ONLY their own answers!)
    `UPDATE businesses SET business_niche = $1, heard_from = $2, catalog_size = $3, channels = $4, daily_volume = $5 WHERE id = $6
     RETURNING business_niche, heard_from, catalog_size, channels, daily_volume`, // RETURNING echoes truth (UI shows what stuck, no refetch!)
    [niche, heard, size || null, channels || null, volume || null, req.session.businessId]
  );
  if (!wasNiche && niche) { // FIRST-EVER niche = quiz finished → CHECK the referral reward (pays only if already ACTIVE: connected or chatted!)
    require('../services/referralService').onFirstActive(req.session.businessId).catch((e) => console.error('referral reward error:', e.message));
  }
  res.json(rows[0]);
}

// Refer & Earn page data: payout history + public leaderboard (first names!).
// Never 500 for garnish — partial data beats a dead page (frontend renders what it gets!).
async function referralExtra(req, res) {
  try {
    const ref = require('../services/referralService');
    const [h, l] = await Promise.allSettled([ref.myHistory(req.session.businessId), ref.publicLeaders(5)]);
    res.json({
      history: (h && h.status === 'fulfilled' && Array.isArray(h.value)) ? h.value : [],
      leaders: (l && l.status === 'fulfilled' && Array.isArray(l.value)) ? l.value : [],
    });
  } catch (e) {
    console.error('referral extra error:', e.message);
    res.json({ history: [], leaders: [] });
  }
}

// Refer & Earn card data: my code, funnel counts, earnings, next milestone.
// myStats() self-heals + returns degraded defaults — this stays 200 so the
// card NEVER shows "Couldn't load rewards" on a stale DB. True offline/DB-down
// still bubbles as a retryable error below.
async function referralStats(req, res) {
  try {
    const ref = require('../services/referralService');
    const stats = await ref.myStats(req.session.businessId);
    res.json(stats);
  } catch (e) {
    console.error('referral stats error:', e.message);
    res.status(503).json({ error: 'Rewards are waking up — retry in a few seconds.', retryable: true });
  }
}

async function getProducts(req, res) {
  const products = await productService.getProducts(req.session.businessId); // service hides the SQL; session-scoped
  res.json(products); // array (frontend Catalog renders it)
}

// Catalog meta: the shop's lane + its shelves + lane-language hints. The phone
// app reads this so mobile + web show the SAME niche categories (one source!).
async function catalogMeta(req, res) {
  const nicheMeta = require('../services/nicheMeta');
  const { rows } = await db.query('SELECT business_niche FROM businesses WHERE id = $1', [req.session.businessId]);
  const niche = (rows[0] && rows[0].business_niche) || '';
  res.json({
    niche, // exact welcome-picker label ('' = not picked yet → defaults below!)
    categories: nicheMeta.categoriesFor(niche), // THIS hustle's shelves (electronics → Phones…)
    detailHint: nicheMeta.detailHintFor(niche), // details-field placeholder in the lane's words
    learnExample: nicheMeta.learnExampleFor(niche), // LEARN: tip example for the lane
  });
}

async function upsertProduct(req, res, next) {
  const { name, price, description, available, quantity, category } = req.body || {}; // single-product add/edit from the dashboard form (+ stock count + shelf category)
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Product name required' }); // the one hard requirement
  const draft = { name, price: price || null, description: description || null, available: available ?? true }; // ?? keeps explicit false (|| would turn false→true!)
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'quantity')) draft.quantity = quantity; // stock key PRESENT → validate/write inside the service; ABSENT → preserve (toggles never zero stock!)
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'category')) draft.category = category; // same absent-rule (LEARN:/toggles omit it → preserved!)
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'image_url')) draft.image_url = req.body.image_url; // photo key PRESENT → validate/set/clear inside the service; ABSENT → preserve existing (stock toggles omit it!)
  try {
    const saved = await productService.upsertProducts(req.session.businessId, [draft]); // wrap single object in [array] — service takes arrays
    res.status(201).json(saved[0]); // 201 + the saved row (frontend clears the form + reloads)
  } catch (e) {
    if (e && e.status === 400) return res.status(400).json({ error: e.message }); // bad photo URL → 400 with the validator's message (not a 500!)
    if (typeof next === 'function') return next(e); // anything else → central error handler (never swallow, never crash on unhandled rejection!)
    console.error('upsertProduct error:', e);
    return res.status(500).json({ error: 'Could not save product' });
  }
}

// Upload media: host an owner-picked product photo (Catalog "Upload media"
// button). Body: { filename, dataUrl } where dataUrl is a
// "data:image/…;base64,…" string (no new deps — JSON, not multipart!).
// Cloudinary when configured (survives redeploys!), else local public/uploads.
// Hands back an absolute URL the bot can attach on WhatsApp/Telegram.
async function uploadProductPhoto(req, res) {
  const { dataUrl } = req.body || {};
  try {
    const media = require('../services/mediaStore');
    const saved = await media.saveUpload({ dataUrl, prefix: 'biz', businessId: req.session.businessId, allowVideo: false });
    if (saved.url) return res.json({ url: saved.url }); // cloud (permanent!)
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') // explicit public host wins (set it on Railway/Render!)…
      || `${req.protocol}://${req.get('host')}`; // …else build from this request (right in local dev!)
    return res.json({ url: `${base}/uploads/${saved.localFile}` }); // absolute URL: Meta/Telegram fetch it server-side!
  } catch (e) {
    if (e && e.status === 400) return res.status(400).json({ error: e.message });
    console.error('product-photo upload error:', e.message);
    return res.status(500).json({ error: 'Could not save photo — try again.' });
  }
}

async function deleteProduct(req, res) {
  const { rowCount } = await db.query( // rowCount = rows actually deleted
    'DELETE FROM products WHERE id = $1 AND business_id = $2', // AND business_id = you can only delete YOUR OWN products
    [req.params.id, req.session.businessId] // :id from the URL (/me/products/42)
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' }); // nothing deleted = bad id or чужой product
  res.status(204).send(); // 204 = success, empty body (frontend just reloads the list)
}

async function getConversations(req, res) {
  const { rows } = await db.query( // inbox list: previews + flags, newest first, cap 100
    `SELECT id, customer_number, customer_name, last_message, last_reply,
            needs_human, flag_reason, bot_paused, updated_at
     FROM conversations WHERE business_id = $1
     ORDER BY updated_at DESC LIMIT 100`, // DESC = newest first (inbox order); LIMIT = don't dump the whole history; bot_paused drives Take-over badges
    [req.session.businessId]
  );
  res.json(rows);
}

async function getMessages(req, res) {
  const owned = await db.query( // STEP 1 — OWNERSHIP CHECK: does chat :id belong to this business?
    'SELECT id FROM conversations WHERE id = $1 AND business_id = $2',
    [req.params.id, req.session.businessId]
  ); // without this, changing the URL id would leak OTHER shops' chats (IDOR attack)
  if (owned.rows.length === 0) return res.status(404).json({ error: 'Not found' }); // 404 (not 403) hides whether the chat exists at all
  const { rows } = await db.query( // STEP 2 — the thread, oldest first, cap 500
    `SELECT direction, body, media_url, created_at FROM messages
     WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500`, // ASC = chronological reading order
    [req.params.id]
  );
  res.json(rows);
}

async function playground(req, res) {
  try { // try/catch: AI failures become JSON errors, never HTML crash pages
    const { message } = req.body || {}; // the test message typed in Test-bot
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message required' }); // guard clause
    const { rows } = await require('../db').query('SELECT * FROM businesses WHERE id = $1 LIMIT 1', [req.session.businessId]); // require INLINE (same db, just style) — full row: generateReply needs catalog-adjacent fields
    const business = rows[0];
    if (!business) return res.status(404).json({ error: 'Business not found' });
    const replyEngine = require('../services/replyEngine'); // lazy require (consistent file style)
    const result = await replyEngine.generateReply(message, business, null, []); // null image, [] history = "what would the bot say?"
    if (result.reply) return res.json({ reply: result.reply }); // confident → show the reply
    return res.json({ reply: null, reason: result.reason || 'I would hand this to a human.' }); // unsure → show the handoff reason (teaches owners what to fix!)
  } catch (e) {
    console.error('playground error:', e.message);
    res.status(500).json({ error: 'Test failed' });
  }
}

async function updateSettings(req, res) {
  const { max_discount_pct, min_order_naira, greeting_msg, handoff_msg } = req.body || {}; // SmartDeal guardrails + AI voice (greeting + handoff in the owner's own words)
  const disc = Math.max(0, Math.min(50, Number(max_discount_pct) || 0)); // clamp 0–50 (Math.max lower-bounds, Math.min upper-bounds; || 0 handles NaN)
  const minOrder = Math.max(0, Number(min_order_naira) || 0); // clamp ≥0 (no negative order floors)
  const greet = typeof greeting_msg === 'string' ? greeting_msg.trim().slice(0, 300) : null; // null = "don't touch" (300 chars: greetings stay short!)
  const hand = typeof handoff_msg === 'string' ? handoff_msg.trim().slice(0, 500) : null; // 500 chars: handoffs stay textable
  await require('../db').query( // inline require again (same pool)
    'UPDATE businesses SET max_discount_pct = $1, min_order_naira = $2'
    + (greet !== null ? ', greeting_msg = $4' : '') // dynamic SET: only overwrite voice fields when the form sent them…
    + (hand !== null ? (greet !== null ? ', handoff_msg = $5' : ', handoff_msg = $4') : '')
    + ' WHERE id = $3',
    greet !== null && hand !== null
      ? [disc, minOrder, req.session.businessId, greet, hand]
      : greet !== null
        ? [disc, minOrder, req.session.businessId, greet]
        : hand !== null
          ? [disc, minOrder, req.session.businessId, hand]
          : [disc, minOrder, req.session.businessId]
  );
  res.json({ max_discount_pct: disc, min_order_naira: minOrder, greeting_msg: greet, handoff_msg: hand }); // echo SAVED (clamped) values so UI shows truth
}

async function getBilling(req, res) {
  const billingController = require('./billingController'); // reuse planFor() — ONE price table for the whole app
  const { rows } = await db.query( // subscription state + purchased tier + currency (prices depend on it!)
    `SELECT subscription_status, subscription_expires, trial_started_at, plan_tier, currency
     FROM businesses WHERE id = $1`,
    [req.session.businessId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const b = rows[0];
  const trialDays = Number(process.env.TRIAL_DAYS || 7);
  const trialEnd = b.trial_started_at
    ? new Date(new Date(b.trial_started_at).getTime() + trialDays * 86400000) // trial start + N days (ms math)
    : null; // no trial column (very old row) → null (frontend hides countdown)
  const planService = require('../services/planService'); // single require (trialLeft + badges below share it!)
  const trialLeft = b.subscription_status === 'trialing' ? planService.trialDaysLeft(b) : null; // days-left countdown (null when not trialing — frontend shows it only then!)
  const currency = b.currency === 'USD' ? 'USD' : 'NGN'; // whitelist (DB could hold anything)
  const plans = billingController.planFor(currency); // {pro:{monthly, yearly{+save}}, plus:{…}, sales_email, +legacy aliases}
  res.json({
    status: b.subscription_status, // trialing | active | pending | expired
    expires: b.subscription_expires, // paid-until (null for trial/free)
    trial_ends: trialEnd, // countdown target (null when irrelevant)
    trial_days_left: trialLeft, // whole days left (frontend countdown pill reads this!)
    pro: planService.isPro({ subscription_status: b.subscription_status, subscription_expires: b.subscription_expires, trial_started_at: b.trial_started_at }), // boolean for badges…
    tier: planService.tier({ subscription_status: b.subscription_status, subscription_expires: b.subscription_expires, trial_started_at: b.trial_started_at }), // …and 'pro'|'free' string for logic
    currency, // 'NGN' | 'USD' (frontend money() formats with this)
    plan_tier: String(b.plan_tier || 'pro').toLowerCase(), // purchased tier: 'pro' | 'plus' (trial buyers show 'pro' until they buy Plus!)
    price_naira: plans.pro.monthly.amount, // legacy name, current meaning: "Pro monthly in shop currency" (kept so old frontend doesn't break)
    sales_email: plans.sales_email, // pay-once / enterprise → contact sales (top-level AND inside plans for old clients)
    plans: { // naira keys kept for backward-compat; amount/save keys are the new canonical ones
      currency: plans.currency,
      pro: plans.pro, // { monthly:{amount…}, yearly:{amount…, save, save_pct} }
      plus: plans.plus, // { monthly:{amount…}, yearly:{amount…, save, save_pct} }
      sales_email: plans.sales_email,
      monthly: { naira: plans.monthly.amount, amount: plans.monthly.amount }, // legacy: Pro monthly (old apps read this!)
      yearly: { naira: plans.yearly.amount, amount: plans.yearly.amount, save_naira: plans.yearly.save, save: plans.yearly.save, save_pct: plans.yearly.save_pct }, // legacy: Pro yearly
    },
    paystack_live: !!(process.env.PAYSTACK_SECRET_KEY && !String(process.env.PAYSTACK_SECRET_KEY).includes('xxxxx')), // !! forces boolean: real key present AND not the placeholder? (NGN cards)
    flw_live: !!(process.env.FLW_SECRET_KEY && !String(process.env.FLW_SECRET_KEY).includes('xxxxx')), // same check for Flutterwave (USD/intl cards)
  });
}

async function profileSync(req, res) {
  const planService = require('../services/planService');
  const replyEngine = require('../services/replyEngine');
  const productService = require('../services/productService');
  const { profile_text } = req.body || {}; // pasted WhatsApp Business profile text
  if (!profile_text || typeof profile_text !== 'string' || !profile_text.trim()) { // three guards: exists + string + non-blank
    return res.status(400).json({ error: 'Paste your WhatsApp Business profile text first.' });
  }
  const { rows } = await db.query('SELECT * FROM businesses WHERE id = $1 LIMIT 1', [req.session.businessId]); // full row (isPro needs subscription fields)
  const business = rows[0];
  if (!business) return res.status(404).json({ error: 'Business not found' });
  if (!planService.isPro(business)) return res.status(402).json({ error: 'Profile sync is a Pro feature. Upgrade to unlock it — manual teaching stays free.' }); // 402 = Payment Required (the CORRECT code for paywalls!)
  const { products, ok } = await replyEngine.extractProducts(profile_text.trim(), business); // AI: profile → products (same extractor as LEARN)
  if (!ok || products.length === 0) { // nothing sellable found → 422 Unprocessable (input understood, but useless)
    return res.status(422).json({ error: 'No products found in that text. Paste the part of your profile that lists what you sell.' });
  }
  const { saved, added, updated, unmentioned } = await productService.syncWithReport(business.id, products); // scaffold + DIFF (report-only: stale items listed, never auto-touched!)
  const truncated = profile_text.trim().length > 4000; // honesty flag (see below!)
  await db.query('UPDATE businesses SET profile_snapshot = $1, profile_synced_at = now() WHERE id = $2', [profile_text.trim().slice(0, 4000), business.id]); // …AND store the trusted snapshot (slice caps at 4000 chars so prompts stay cheap)
  res.json({ products: saved, added, updated, unmentioned, truncated, synced_at: new Date().toISOString() }); // toISOString = standard UTC string for the "Last synced" label
}

async function getProfileSync(req, res) {
  const { rows } = await db.query('SELECT profile_snapshot, profile_synced_at FROM businesses WHERE id = $1', [req.session.businessId]); // only the two sync columns (snapshot text stays server-side — never sent to browser)
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ synced: !!rows[0].profile_snapshot, synced_at: rows[0].profile_synced_at }); // !! string → boolean ("ever synced?")
}

// Bot kill-switch: { enabled: true/false }. Instant global silence/resume.
async function botToggle(req, res) {
  const { enabled } = req.body || {}; // strict boolean required (no truthy games: "false" string must NOT enable!)
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Send { enabled: true } or { enabled: false }.' });
  await db.query('UPDATE businesses SET bot_enabled = $1 WHERE id = $2', [enabled, req.session.businessId]);
  res.json({ bot_enabled: enabled }); // echo back (toggle UI syncs to truth)
}

// Per-chat takeover: { paused: true } silences the bot on ONE conversation
// (owner chats personally from their phone); false hands back to the AI.
async function chatTakeover(req, res) {
  const { paused } = req.body || {};
  if (typeof paused !== 'boolean') return res.status(400).json({ error: 'Send { paused: true } or { paused: false }.' });
  const owned = await db.query( // ownership check FIRST (IDOR: no pausing others' chats!)
    'SELECT id FROM conversations WHERE id = $1 AND business_id = $2',
    [req.params.id, req.session.businessId]
  );
  if (owned.rows.length === 0) return res.status(404).json({ error: 'Not found' }); // 404 hides existence (same pattern as getMessages)
  await db.query('UPDATE conversations SET bot_paused = $1, updated_at = now() WHERE id = $2', [paused, req.params.id]); // updated_at bump re-sorts inbox (taken-over chat rises to top = visible!)
  res.json({ bot_paused: paused });
}

// File feedback (Help form → admin queue + StaticForms email copy).
// Categories keep the inbox triageable: feedback | complaint | feature | bug.
// The ticket is ALWAYS stored locally (admin console + user history work with
// or without StaticForms). When STATICFORMS_KEY is set, the same message is
// ALSO forwarded to StaticForms (staticforms.xyz → forwards to your inbox),
// so nothing is missed even if the console isn't checked daily. The key stays
// server-side — the browser never sees it.
const FEEDBACK_CATEGORIES = ['feedback', 'complaint', 'feature', 'bug']; // whitelist (anything else → 'feedback')
async function feedbackCreate(req, res) {
  const { category: catRaw, subject, body } = req.body || {};
  if (!body || typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'Write your message first.' });
  if (body.trim().length > 2000) return res.status(400).json({ error: 'Keep it under 2000 characters.' });
  const category = FEEDBACK_CATEGORIES.includes(String(catRaw || '').toLowerCase()) ? String(catRaw).toLowerCase() : 'feedback';
  const label = { feedback: 'Feedback', complaint: 'Complaint', feature: 'Feature request', bug: 'Bug report' }[category];
  const { rows } = await db.query( // store FIRST (local record never depends on the email service!)
    `INSERT INTO complaints (business_id, subject, body) VALUES ($1, $2, $3)
     RETURNING id, subject, body, status, reply, created_at`,
    [req.session.businessId, `[${label}] ${String(subject || 'Message from owner').slice(0, 100)}`, body.trim().slice(0, 2000)]
  );
  const ticket = rows[0];
  { // acknowledgement email (best-effort: ticket already stored — mail failing changes nothing!)
    const mail = require('../services/emailTemplates');
    mail.ownerContact(req.session.businessId).then((c) => {
      if (!c) return null;
      return mail.sendSupportReceived(c.email, c.name, ticket.subject);
    }).catch((e) => console.error('ticket ack email error:', e.message));
  }
  const key = (process.env.STATICFORMS_KEY || '').trim(); // staticforms.xyz → Forms → API key (server-side only!)
  if (key) { // forward a copy to your inbox (fire-and-log: a mail hiccup must never fail the ticket!)
    try {
      let email = null, bizName = '';
      try {
        const u = await db.query('SELECT email FROM users WHERE business_id = $1 ORDER BY id ASC LIMIT 1', [req.session.businessId]);
        email = u.rows[0]?.email || null;
        const b = await db.query('SELECT name FROM businesses WHERE id = $1', [req.session.businessId]);
        bizName = b.rows[0]?.name || '';
      } catch {}
      await fetch('https://api.staticforms.xyz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: key,
          subject: `[VeloSales Ai ${label}] ${bizName}`,
          name: bizName || 'VeloSales Ai owner',
          email: email || 'noreply@velosalesai',
          message: `Business: ${bizName} (id ${req.session.businessId})\nCategory: ${label}\nSubject: ${String(subject || '').slice(0, 120)}\n\n${body.trim().slice(0, 2000)}`,
        }),
      });
    } catch (e) { console.error('staticforms forward error:', e.message); }
  }
  res.status(201).json(ticket); // 201 + ticket (history updates without reload!)
}

// File a support complaint (Help form → admin queue). Owners see history below.
async function complaintCreate(req, res) {
  const { subject, body } = req.body || {}; // subject line + message (both required)…
  if (!body || typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'Describe the problem first.' }); // …body is the hard requirement (subject defaults below)
  if (body.trim().length > 2000) return res.status(400).json({ error: 'Keep it under 2000 characters.' }); // same anti-abuse cap as chat inputs
  const { rows } = await db.query( // INSERT, RETURNING the ticket (frontend appends it instantly — optimistic-ish, but server-confirmed!)
    `INSERT INTO complaints (business_id, subject, body) VALUES ($1, $2, $3)
     RETURNING id, subject, body, status, reply, created_at`,
    [req.session.businessId, String(subject || 'Support request').slice(0, 120), body.trim()] // String()+slice caps subject (DB hygiene, same habit as adClick!)
  );
  { // acknowledgement email (best-effort!)
    const mail = require('../services/emailTemplates');
    mail.ownerContact(req.session.businessId).then((c) => {
      if (!c) return null;
      return mail.sendSupportReceived(c.email, c.name, rows[0].subject);
    }).catch((e) => console.error('complaint ack email error:', e.message));
  }
  res.status(201).json(rows[0]); // 201 + ticket (Help history updates without reload!)
}

// Owner's own ticket history (open + answered + resolved, newest first).
async function complaintMine(req, res) {
  const { rows } = await db.query( // session-scoped (owners see ONLY their tickets — same privacy rule as chats!)…
    'SELECT id, subject, body, status, reply, created_at, updated_at FROM complaints WHERE business_id = $1 ORDER BY updated_at DESC LIMIT 50',
    [req.session.businessId]
  );
  res.json(rows);
}

// Set/clear the shop's Telegram bot token (paste from BotFather; empty = off).
// Validated live against Telegram's Bot API (getMe) — bad/expired tokens are
// rejected with a friendly error instead of silently storing a dead token.
async function telegramToken(req, res) {
  const { token } = req.body || {}; // BotFather token string (or '' to disconnect!)
  // Sanitize FIRST: phone copy-paste sneaks in spaces, newlines, zero-width
  // and RTL marks that make a REAL token fail validation ("rejected" for a
  // perfect token — the #1 support ticket!). Telegram tokens are digits,
  // colon, letters, digits, dashes and underscores — nothing else survives.
  const raw = String(token === undefined ? '' : token).replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '').trim();
  if (raw !== '' && !/^[\w:-]{20,}$/.test(raw)) return res.status(400).json({ error: 'That does not look like a Telegram bot token (BotFather gives like 123456:ABC-DEF…). Copy it again with /token — no spaces before or after.' }); // shape check (Bot tokens are long alnum+colon+dash — catches pasted usernames/links!)
  const clean = raw || ''; // '' = disconnect (normalized once!)
  if (clean) { // live check: ask Telegram whose bot this is (2 attempts × 15s — cold networks deserve a second chance, never a false "rejected"!)
    let d = null, ok = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(`https://api.telegram.org/bot${clean}/getMe`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
        d = await r.json().catch(() => ({}));
        if (r.ok && d && d.ok === true) { ok = true; break; } // accepted (username captured below for the success proof!)
        if (r.status === 401 || r.status === 404) break; // Telegram says NO SUCH BOT (revoked/deleted/typo) — retrying won't help, stop fast!
      } catch (e) {
        if (attempt === 2) return res.status(502).json({ error: 'Could not reach Telegram — check your connection and try again.' });
      }
    }
    if (!ok) {
      const why = d && d.description ? String(d.description).slice(0, 120) : '';
      return res.status(400).json({ error: `Telegram rejected that token — re-copy it from @BotFather with /token and try again.${why ? ` (Telegram says: ${why})` : ''}` });
    }
    var botUsername = (d.result && d.result.username) ? '@' + d.result.username : '';
  }
  let prev, rows;
  try {
    prev = await db.query('SELECT telegram_bot_token FROM businesses WHERE id = $1', [req.session.businessId]); // pre-read (disconnect needs the OLD token to unhook!)
    const upd = await db.query(
      'UPDATE businesses SET telegram_bot_token = $1, owner_telegram_id = CASE WHEN $1 = $2 THEN owner_telegram_id ELSE $3 END WHERE id = $4 RETURNING telegram_bot_token <> $2 AS connected',
      [clean, '', null, req.session.businessId]
    ); // CASE: empty token keeps the owner link; a NEW token wipes it (stale owner id on a different bot = wrong human with owner powers — security!)
    rows = upd.rows;
  } catch (e) {
    console.error('telegram token save failed:', e.message); // DB hiccup → JSON 500, NEVER an unhandled rejection (those crash the whole Render service!)
    return res.status(500).json({ error: 'Something went wrong — try again.' });
  }
  const oldToken = (prev.rows[0] && prev.rows[0].telegram_bot_token) || '';
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`; // explicit host wins (prod!); else this request's host (local dev!)
  if (rows[0] && rows[0].connected) { // bot just linked → referral reward check (first real use!)
    require('../services/referralService').onFirstActive(req.session.businessId)
      .catch((e) => console.error('referral reward error:', e.message));
  }
  if (clean) { // token saved → AUTO-register the webhook (previously a manual step shops never found — bots stayed silent!).
    const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    fetch(`https://api.telegram.org/bot${clean}/setWebhook`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `${base}/webhook/telegram/${req.session.businessId}`, ...(secret ? { secret_token: secret } : {}), drop_pending_updates: true }),
    }).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || d.ok !== true) console.error('telegram setWebhook failed:', JSON.stringify(d).slice(0, 150)); })
      .catch((e) => console.error('telegram setWebhook error:', e.message)); // fire-and-forget (connect succeeds even if Telegram hiccups — retry by re-saving!)
  } else if (oldToken) { // disconnected → best-effort unhook (stale hooks 200-ignore anyway — this just stops the knocking!)
    fetch(`https://api.telegram.org/bot${oldToken}/deleteWebhook`, { method: 'POST' }).catch(() => {});
  }
  res.json({ connected: rows[0] ? rows[0].connected : false, botUsername: (typeof botUsername === 'string' && botUsername) || null }); // boolean for the UI toggle + @username proof (users SEE which bot linked — wrong-bot pastes get caught by eye!)
}

// Generate a fresh Telegram link code (Profile "Link Telegram" button).
// Returns the code + deep link; owner taps it → bot binds owner_telegram_id.
async function telegramLink(req, res) {
  try {
    const code = 'BIZ' + require('crypto').randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars (unguessable-ish, typable — same generator as the route file!)
    await db.query('UPDATE businesses SET telegram_link_code = $1 WHERE id = $2', [code, req.session.businessId]); // overwrite (each tap INVALIDATES the old code — leaked links die!)
    const { rows } = await db.query('SELECT telegram_bot_token FROM businesses WHERE id = $1', [req.session.businessId]);
    const botName = (rows[0] && rows[0].telegram_bot_token) ? null : (process.env.TELEGRAM_SHARED_BOT_NAME || null); // per-shop bot: owner opens THEIR bot; shared: needs the shared username (env!)
    res.json({ code, botName, note: botName ? `Open t.me/${botName}?start=link_${code} from your Telegram` : 'Open your shop bot and send: /start link_' + code });
  } catch (e) {
    console.error('telegram link failed:', e.message); // JSON 500, never a process crash (see telegramToken note!)
    res.status(500).json({ error: 'Something went wrong — try again.' });
  }
}

// Telegram connection status (Profile status line + Help docs).
async function telegramStatus(req, res) {
  try {
    const { rows } = await db.query('SELECT telegram_bot_token <> $1 AS connected, owner_telegram_id <> $1 AS owner_linked, telegram_link_code FROM businesses WHERE id = $2', ['', req.session.businessId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ connected: rows[0].connected, ownerLinked: rows[0].owner_linked, hasCode: !!(rows[0].telegram_link_code) }); // hasCode (not the code — codes only travel on explicit generate!)
  } catch (e) {
    console.error('telegram status failed:', e.message); // JSON 500, never a process crash (see telegramToken note!)
    res.status(500).json({ error: 'Something went wrong — try again.' });
  }
}

// ---- Channel connections (Connect page) ----
// One status call drives BOTH channel cards (WhatsApp LIVE/OFF + Telegram).
// Secrets (tokens/SIDs) are NEVER returned — only masked proofs + booleans.
function webhookUrl(req) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '')
    || `${req.protocol}://${req.get('host')}`; // explicit host wins (prod!); else this request's host (local dev!)
  return `${base}/webhook/whatsapp`; // ONE Meta webhook (verify-token handshake inside!)
}

async function channelsStatus(req, res) {
  const { rows } = await db.query(
    `SELECT whatsapp_number, wa_channel, whatsapp_model, whatsapp_last_inbound_at,
            meta_waba_id, telegram_bot_token <> '' AS telegram_on,
            meta_phone_number_id <> '' AS meta_on,
            subscription_status, subscription_expires, trial_started_at, plan_tier
     FROM businesses WHERE id = $1`,
    [req.session.businessId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const b = rows[0];
  const planService = require('../services/planService');
  let waUsed = 0; // today's bot replies (best-effort — never break status!)
  try {
    const { rows: u } = await db.query(
      `SELECT COUNT(*)::int AS c FROM messages m JOIN conversations c2 ON c2.id = m.conversation_id
       WHERE c2.business_id = $1 AND m.direction = 'out' AND m.created_at >= CURRENT_DATE`,
      [req.session.businessId]
    );
    waUsed = (u[0] && u[0].c) || 0;
  } catch (e) { console.error('wa usage error:', e.message); }
  const fullBiz = { subscription_status: b.subscription_status, subscription_expires: b.subscription_expires, trial_started_at: b.trial_started_at, plan_tier: b.plan_tier };
  const waLimit = planService.whatsappDailyLimit(fullBiz); // 50 / 500 / Infinity (Plus uncapped — Infinity can't cross JSON!)
  const waUnlimited = !Number.isFinite(waLimit);
  res.json({
    whatsapp: {
      number: b.whatsapp_number, // shop's number (locked identity!)
      channel: 'meta', // Meta Cloud API only (Embedded Signup road!)
      model: b.whatsapp_model || 'gemini-flash-full', // per-shop brain pick!
      live: !!b.whatsapp_last_inbound_at, // inbound EVER seen (TEST-verify flips this!)
      lastInbound: b.whatsapp_last_inbound_at, // timestamp for "last seen" text
      metaConnected: !!b.meta_on, // WABA credentials stored!
      wabaId: b.meta_waba_id || '', // WhatsApp Business Account id (Embedded Signup!)
      tier: planService.effectiveTier(fullBiz), // 'free' | 'pro' | 'plus' (drives limit display!)
      dailyLimit: waUnlimited ? null : waLimit, // null = uncapped (frontend shows "Unlimited")
      dailyUnlimited: waUnlimited, // explicit flag (null dailyLimit alone is ambiguous!)
      dailyUsed: waUsed, // replies sent today (resets midnight!)
    },
    telegram: { connected: !!b.telegram_on }, // full Telegram detail lives on GET /api/me/telegram!
    webhookUrl: webhookUrl(req), // exact URL to paste into Meta (verify step copies it!)
    metaAppId: (process.env.META_APP_ID || '').trim(), // PUBLIC (Meta design — safe for browsers!)
    metaConfigId: (process.env.META_CONFIGURATION_ID || '').trim(), // PUBLIC (Embedded Signup flow id!)
    metaEmbeddedReady: !!((process.env.META_APP_ID || '').trim() && (process.env.META_CONFIGURATION_ID || '').trim()),
  });
}

// Per-shop WhatsApp brain pick (Connect page dropdown). Tier-gated EXACTLY like
// the VeloSalesAI dropdown (locked → 402, frontend opens the upgrade card!).
async function whatsappModel(req, res) {
  const planService = require('../services/planService');
  const aiModels = require('../services/aiModels');
  const { model } = req.body || {};
  const { rows } = await db.query(
    'SELECT subscription_status, subscription_expires, trial_started_at, plan_tier, bonus_pro_until FROM businesses WHERE id = $1',
    [req.session.businessId]
  );
  const resolved = aiModels.resolveChoice(model, planService.effectiveTier(rows[0] || {})); // exists? below-floor? ('' → free default!)
  if (resolved.error) return res.status(402).json({ error: resolved.error }); // 402 = paywall (locked premium pick!)
  await db.query('UPDATE businesses SET whatsapp_model = $1 WHERE id = $2', [resolved.entry.id, req.session.businessId]); // store the CATALOG id (stable key, not provider name!)
  res.json({ model: resolved.entry.id, label: resolved.entry.label }); // echo truth (UI shows what stuck!)
}

// Meta step 1+2 in one: validate ID + token, store, arm the channel.
// Accepts manual paste OR Embedded Signup results (waba_id included).
async function metaConnect(req, res) {
  const meta = require('../services/channels/meta');
  const { phone_number_id, token, waba_id } = req.body || {};
  const checked = await meta.checkCredentials(phone_number_id, token); // asks Meta whose number this is (invalid → friendly error!)
  if (checked.error) return res.status(400).json({ error: checked.error });
  const crypto = require('crypto');
  const verify = 'VND' + crypto.randomBytes(8).toString('hex').toUpperCase(); // per-shop verify token (Meta echoes it on subscribe — proves ownership!)
  await db.query(
    `UPDATE businesses SET meta_token = $1, meta_phone_number_id = $2, meta_waba_id = $3,
      meta_verify_token = COALESCE(NULLIF(meta_verify_token, ''), $4), wa_channel = 'meta'
     WHERE id = $5`, // keep an existing verify token (Meta already subscribed? don't break it!)
    [String(token).trim(), String(phone_number_id).trim(), String(waba_id || '').trim(), verify, req.session.businessId]
  );
  const { rows } = await db.query('SELECT meta_verify_token FROM businesses WHERE id = $1', [req.session.businessId]);
  require('../services/referralService').onFirstActive(req.session.businessId) // channel just went live → referral reward check (referred shops pay out on FIRST REAL USE!)
    .catch((e) => console.error('referral reward error:', e.message)); // rewards never break connects!
  res.json({ ok: true, phone: checked.phone, verifyToken: rows[0].meta_verify_token, webhookUrl: webhookUrl(req) });
}

// Meta Embedded Signup callback: the popup hands us a WABA id, a phone number
// id and either an access token (direct) or an auth code (server exchanges it
// with META_APP_SECRET). Credentials are validated against the Graph API then
// stored against the shop — never shown back to the browser.
async function metaEmbedded(req, res) {
  const meta = require('../services/channels/meta');
  let { waba_id, phone_number_id, token, code } = req.body || {};
  waba_id = String(waba_id || '').trim();
  phone_number_id = String(phone_number_id || '').trim();
  token = String(token || '').trim();
  code = String(code || '').trim();
  if (code && !token) { // code road: exchange server-side, then discover the number on the WABA…
    const ex = await meta.exchangeCode(code);
    if (ex.error) return res.status(400).json({ error: ex.error });
    token = ex.token;
    if (waba_id && !phone_number_id) {
      const listed = await meta.listWabaNumbers(waba_id, token);
      if (listed.error) return res.status(400).json({ error: listed.error });
      if (!listed.numbers.length) return res.status(400).json({ error: 'That WhatsApp Business Account has no phone numbers yet — add one in WhatsApp Manager first.' });
      phone_number_id = listed.numbers[0].id; // first number wins (owner can swap via manual reconnect!)
    }
  }
  if (!phone_number_id || !token) return res.status(400).json({ error: 'Signup did not return a number — try again or paste your details manually.' });
  req.body = { phone_number_id, token, waba_id }; // reuse the validated manual path (one storage road!)
  return metaConnect(req, res);
}

// Meta disconnect: forget creds (channel stays 'meta' — OFF until reconnected!).
async function metaDisconnect(req, res) {
  await db.query("UPDATE businesses SET meta_token = '', meta_phone_number_id = '', meta_waba_id = '', wa_channel = 'meta' WHERE id = $1", [req.session.businessId]);
  res.json({ ok: true });
}

// Meta auto-sync: pull the WhatsApp business profile → scaffold catalog.
// (Pro-gated like SYNC: — same premium, new one-tap road!)
async function metaPullProfile(req, res) {
  const planService = require('../services/planService');
  const replyEngine = require('../services/replyEngine');
  const productService = require('../services/productService');
  const meta = require('../services/channels/meta');
  const { rows } = await db.query('SELECT * FROM businesses WHERE id = $1', [req.session.businessId]);
  const business = rows[0];
  if (!business) return res.status(404).json({ error: 'Not found' });
  if (!planService.isPro(business)) return res.status(402).json({ error: 'Auto-sync is a premium feature. Manual teaching stays free.' });
  if (!business.meta_token || !business.meta_phone_number_id) return res.status(400).json({ error: 'Connect Meta first.' });
  const pulled = await meta.fetchBusinessProfile(business.meta_token, business.meta_phone_number_id);
  if (pulled.error) return res.status(400).json({ error: pulled.error });
  const { products, ok } = await replyEngine.extractProducts(pulled.profileText, business); // same extractor as LEARN/SYNC!
  if (!ok || !products.length) return res.status(422).json({ error: 'Your Meta profile has no products listed — add them in WhatsApp Manager, or paste the text manually.' });
  const { saved, added, updated, unmentioned } = await productService.syncWithReport(business.id, products); // scaffold + DIFF (same report as dashboard sync!)
  await db.query('UPDATE businesses SET profile_snapshot = $1, profile_synced_at = now() WHERE id = $2', [pulled.profileText.slice(0, 4000), business.id]);
  res.json({ ok: true, count: saved.length, added, updated, unmentioned, products: saved.map((p) => ({ name: p.name, price: p.price })) });
}

// Log a sponsor/ad click (per-click billing for direct sponsors).
async function adClick(req, res) {
  const { slot, target_url } = req.body || {}; // which placement + where they went
  try {
    await db.query( // plain audit INSERT (admin adStats aggregates these into Naira)
      'INSERT INTO ad_clicks (business_id, slot, target_url) VALUES ($1, $2, $3)',
      [req.session.businessId, String(slot || 'sponsor').slice(0, 40), String(target_url || '').slice(0, 500)] // String() + slice() = length-cap untrusted input (DB hygiene)
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('adClick error:', e.message);
    res.status(500).json({ error: 'Could not record click' });
  }
}

// Gated video event: { slot, source, event } → video_views row (starts,
// quartiles, completes, clicks, skips — completions are the invoice unit!).
// Whitelisted values only (junk events die with 400, never touch the DB!).
async function adVideoEvent(req, res) {
  const SOURCES = ['sponsor', 'hilltopads', 'monetag', 'adsterra'];
  const EVENTS = ['start', 'q25', 'q50', 'q75', 'complete', 'click', 'skip'];
  const { slot, source, event } = req.body || {};
  if (!SOURCES.includes(source) || !EVENTS.includes(event)) {
    return res.status(400).json({ error: 'Bad video event.' }); // tampered payloads stop here
  }
  try {
    await db.query(
      'INSERT INTO video_views (business_id, slot, source, event) VALUES ($1, $2, $3, $4)',
      [req.session.businessId, String(slot || 'connect').slice(0, 40), source, event] // slice caps untrusted input (same habit as adClick!)
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('adVideo error:', e.message);
    res.status(500).json({ error: 'Could not record video event' });
  }
}

// VeloSales Ai model list for the dropdown (locked flags depend on tier).
async function aiModels(req, res) {
  const planService = require('../services/planService');
  const aiModels = require('../services/aiModels');
  const { rows } = await db.query( // subscription + purchased tier + referral bonus (effectiveTier needs all three!)
    'SELECT subscription_status, subscription_expires, trial_started_at, plan_tier, bonus_pro_until FROM businesses WHERE id = $1',
    [req.session.businessId]
  );
  const b = rows[0] || {}; // || {} : deleted business → effectiveTier('{}') = free (safe default)
  res.json({ models: aiModels.listForTier(planService.effectiveTier(b)) }); // [{id, label, tier, minTier, locked}…] — model IDs never leak
}

// AI health check — pings each configured provider with a tiny "OK" so the
// owner can SEE which key is broken (bad key? retired model? quota?) instead
// of guessing from fallbacks. Session-guarded (owner only), never returns key
// values — only ok/ms/short-error per provider. Each ping is ~5 tokens.
async function aiStatus(req, res) {
  const client = require('../services/ai/client');
  res.json({ status: await client.pingAll() });
}

const FREE_AI_PER_DAY = Number(process.env.FREE_AI_PER_DAY || 50); // free-tier VeloSales Ai chats/day, 50 for everything (env-tunable)
const PAID_AI_PER_DAY = Number(process.env.PAID_AI_PER_DAY || 50); // Pro premium-model chats/day, 50 too (cost guard!)
const MODEL_DAILY_CAP = Number(process.env.MODEL_DAILY_CAP || 50); // per-MODEL daily cap per business (one hammered model can't eat the shared key!)

// VeloSales Ai — general chat. Free tier: 50 chats/day total AND 50/model/day.
// Pro: unlimited free models (model caps still apply to shared keys!) + 50 paid chats/day.
async function ask(req, res) {
  try { // everything inside try: AI + DB failures become JSON, never crashes
    const { message, history, model } = req.body || {}; // message required; history optional; model = dropdown id
    if (!message || typeof message !== 'string' || !message.trim()) { // blank/whitespace/non-string rejected…
      return res.status(400).json({ error: 'Type a question first.' });
    }
    if (message.length > 2000) return res.status(400).json({ error: 'Keep it under 2000 characters.' }); // length cap = cost/abuse control (long prompts = expensive)
    const planService = require('../services/planService');
    const aiModels = require('../services/aiModels');
    const replyEngine = require('../services/replyEngine');
    const { rows } = await db.query( // tier first (gates EVERYTHING below — bonus column included for referral Pro!)
      'SELECT subscription_status, subscription_expires, trial_started_at, plan_tier, bonus_pro_until, name, business_niche, hours, tone, faq FROM businesses WHERE id = $1',
      [req.session.businessId]
    );
    const tier = planService.effectiveTier(rows[0] || {}); // 'plus' | 'pro' | 'free' (Plus-only heavy models enforced inside resolveChoice!)
    const bizName = rows[0]?.name || '';
    const bizNiche = rows[0]?.business_niche || ''; // niche-aware suggestions (empty = generic chips)
    // SHOP GROUNDING: VeloSales Ai answers about the OWNER'S shop from real data,
    // not training memory (a model can't know your prices unless we SEND them!).
    // Same query the dashboard already runs — one extra SELECT per ask, cheap.
    let shopCtx = null;
    try {
      const productService = require('../services/productService');
      const products = await productService.getProducts(req.session.businessId);
      const full = productService.formatCatalog(products);
      shopCtx = {
        name: bizName,
        hours: rows[0]?.hours || '',
        tone: rows[0]?.tone || '',
        faq: Array.isArray(rows[0]?.faq) ? rows[0].faq.slice(0, 10) : [], // first 10 FAQs (prompt budget!)
        catalog: full.length > 2500 ? full.slice(0, 2500) + '\n…(catalog continues — ask about the rest!)' : full, // cap ~2500 chars (big catalogs stay cheap!)
      };
    } catch (e) { console.error('ask grounding error:', e.message); } // grounding failed → askGeneral runs ungrounded (never block a chat over context!)
    const resolved = aiModels.resolveChoice(model, tier); // validate dropdown id: exists? below-floor? → {entry, model} or {error}
    if (resolved.error) return res.status(402).json({ error: resolved.error }); // 402 = paywall (locked premium model)
    const paid = resolved.entry.tier === 'paid'; // which counter to check/increment?
    // Daily caps — one row per business per day.
    const { rows: urows } = await db.query( // INSERT today's row if missing, else touch it — RETURNING gives current counts either way…
      `INSERT INTO ai_usage (business_id, day) VALUES ($1, CURRENT_DATE)
       ON CONFLICT (business_id, day) DO UPDATE SET business_id = EXCLUDED.business_id -- fake update (changes nothing) just to allow RETURNING
       RETURNING free_count, paid_count`, // …so one query handles "first chat today" AND "50th chat today" (this // is JS: outside the string)
      [req.session.businessId]
    );
    const usage = urows[0]; // today's counters
    if (!paid && tier === 'free' && usage.free_count >= FREE_AI_PER_DAY) { // free user, free model, quota spent?… (=== 'free': Plus/Pro users never hit the free cap!)
      return res.status(429).json({ error: `Free daily limit reached (${FREE_AI_PER_DAY} chats). Upgrade to Pro for unlimited chats + premium AIs.` }); // 429 = Too Many Requests (correct code for rate limits!)
    }
    if (paid && usage.paid_count >= PAID_AI_PER_DAY) { // anyone (even Pro) hammering premium models?…
      return res.status(429).json({ error: `Premium AI limit reached for today (${PAID_AI_PER_DAY}). Free AIs still work.` }); // free models still open (only paid capped)
    }
    const { rows: mrows } = await db.query( // per-MODEL counter (upsert-then-read, same pattern as ai_usage)…
      `INSERT INTO model_usage (business_id, day, model_id) VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (business_id, day, model_id) DO UPDATE SET model_id = EXCLUDED.model_id
       RETURNING count`,
      [req.session.businessId, resolved.entry.id]
    );
    if (mrows[0].count >= MODEL_DAILY_CAP) { // this business maxed THIS model today (quota justice: others' share untouched!)…
      return res.status(429).json({ error: `You've used ${resolved.entry.label} 50 times today — try another AI below, fresh quota!` }); // …redirect, don't dead-end (dropdown has 7 more!)
    }
    const result = await replyEngine.askGeneral(message.trim(), Array.isArray(history) ? history.slice(-12) : [], resolved.entry.id, tier, bizName, bizNiche, shopCtx); // Array.isArray guards tampered history; slice(-12) caps context cost; niche tailors examples + follow-ups; shopCtx grounds shop questions in REAL data!
    if (result.reply) { // SUCCESS → count it (only successful chats consume quota — failures are free retries!)
      await db.query( // dynamic column via ${} — SAFE here: `paid` is a boolean WE computed, not user input (never interpolate raw user text into SQL!)
        `UPDATE ai_usage SET ${paid ? 'paid_count = paid_count + 1' : 'free_count = free_count + 1'}
         WHERE business_id = $1 AND day = CURRENT_DATE`,
        [req.session.businessId]
      );
      await db.query('UPDATE model_usage SET count = count + 1 WHERE business_id = $1 AND day = CURRENT_DATE AND model_id = $2', [req.session.businessId, resolved.entry.id]); // model counter (plain values — no dynamic SQL needed here!)
      return res.json({ reply: result.reply, via: result.via, model: resolved.entry.id, fallback: !!result.fallback, requested: result.requested || null }); // via = ACTUAL answerer; model = chosen id; fallback tells UI "your pick was down, X answered instead"
    }
    return res.status(502).json({ error: result.reason || 'VeloSales Ai is resting — try again in a moment.' }); // 502 = our upstream failed — reason names the cause (key missing? quota? all down?) so the owner can act instead of guessing
  } catch (e) {
    console.error('ask error:', e.message);
    res.status(500).json({ error: 'Something went wrong — try again.' });
  }
}

// ---- Notifications: bell inbox (payment events land here automatically,
// app updates arrive via admin broadcast). Newest first, unread counted. ----
async function getNotifications(req, res) {
  try {
    const notify = require('../services/notifyService');
    res.json(await notify.list(req.session.businessId));
  } catch (e) {
    console.error('notifications error:', e.message);
    res.status(500).json({ error: 'Could not load notifications' });
  }
}

async function readNotifications(req, res) {
  try {
    const notify = require('../services/notifyService');
    await notify.markAllRead(req.session.businessId);
    res.json({ ok: true });
  } catch (e) {
    console.error('notifications read error:', e.message);
    res.status(500).json({ error: 'Could not mark as read' });
  }
}

// Phone-bar alerts: store this browser's push subscription (Profile toggle).
// Body: { endpoint, keys: { p256dh, auth } } straight from PushManager.
async function pushSubscribe(req, res) {
  try {
    const push = require('../services/pushService');
    const { endpoint, keys } = req.body || {};
    await push.saveSubscription(req.session.businessId, { endpoint, p256dh: keys && keys.p256dh, auth: keys && keys.auth });
    res.json({ ok: true });
  } catch (e) {
    const code = (e && e.status === 400) ? 400 : 500;
    res.status(code).json({ error: (e && e.message) || 'Could not enable alerts' });
  }
}

// Phone-bar alerts off for this browser (toggle off — other browsers keep theirs!).
async function pushUnsubscribe(req, res) {
  try {
    const push = require('../services/pushService');
    const { endpoint } = req.body || {};
    await push.removeSubscription(req.session.businessId, endpoint);
    res.json({ ok: true });
  } catch (e) {
    console.error('push unsubscribe error:', e.message);
    res.status(500).json({ error: 'Could not disable alerts' });
  }
}

// One notification, fully read (detail page open). Scoped to the owner's own
// inbox — returns 404 for anyone else's id (never leak across shops!).
async function readNotification(req, res) {
  try {
    const notify = require('../services/notifyService');
    const row = await notify.markOneRead(req.session.businessId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Notification not found.' });
    res.json(row);
  } catch (e) {
    console.error('notification read error:', e.message);
    res.status(500).json({ error: 'Could not open notification' });
  }
}

module.exports = { // every handler the routes file wires up (miss one here = route crashes on boot!)
  getMe,
  updateBusiness,
  saveSetup,
  getProducts,
  catalogMeta,
  referralStats,
  referralExtra,
  upsertProduct,
  uploadProductPhoto,
  deleteProduct,
  getConversations,
  getMessages,
  getBilling,
  playground,
  updateSettings,
  profileSync,
  getProfileSync,
  ask,
  aiModels,
  aiStatus,
  adClick,
  adVideoEvent,
  botToggle,
  chatTakeover,
  complaintCreate,
  complaintMine,
  feedbackCreate,
  telegramToken,
  telegramLink,
  telegramStatus,
  channelsStatus,
  whatsappModel,
  metaConnect,
  metaEmbedded,
  metaDisconnect,
  metaPullProfile,
  getNotifications,
  readNotifications,
  readNotification,
  pushSubscribe,
  pushUnsubscribe,
};
