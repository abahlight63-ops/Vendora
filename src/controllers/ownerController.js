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
            b.subscription_status, b.subscription_expires, b.trial_started_at
     FROM businesses b WHERE b.id = $1`, // b = alias; WHERE session id (never a client id!)
    [req.session.businessId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Business not found' }); // session points at deleted business
  const b = rows[0]; // shorthand for the tier/ads logic below
  // Ads: free tier only — Pro never sees ads.
  // provider: any network that gives you a script tag (Adsterra, PropellerAds,
  // Monetag...). sponsor: YOUR OWN direct deal with a local business (best rates).
  const tier = planService.tier(b); // 'pro' | 'free' from subscription + trial clock
  let ads = null; // default: no ads (Pro, or nothing configured)
  if (tier !== 'pro') { // free users only past this point…
    const sponsor = process.env.SPONSOR_TITLE && process.env.SPONSOR_LINK
      ? { title: process.env.SPONSOR_TITLE, text: process.env.SPONSOR_TEXT || '', // && = both must exist; || '' = optional fields default empty
          link: process.env.SPONSOR_LINK, image: process.env.SPONSOR_IMAGE || '' }
      : null; // no sponsor configured → null (frontend hides the interstitial logic)
    // One entry per network (Monetag primary, Adsterra Social Bar secondary…).
    // Different formats per network — never two popunder codes at once.
    const networks = [
      { provider: process.env.ADS_PROVIDER || 'custom', scriptUrl: process.env.ADS_SCRIPT_URL || null },
      { provider: process.env.ADS_PROVIDER_2 || 'custom', scriptUrl: process.env.ADS_SCRIPT_URL_2 || null },
    ].filter((n) => n.scriptUrl); // .filter keeps only configured networks (unconfigured = no tag = no crash)
    if (networks.length || sponsor) { // something to show? then build the ads object…
      ads = { networks, sponsor, scriptUrl: networks[0]?.scriptUrl || null, provider: networks[0]?.provider || 'custom' }; // scriptUrl/provider kept for backward-compat with older frontend
    }
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
     WHERE id = $8
     RETURNING id, name, whatsapp_number, owner_number, hours, faq, tone, currency, timezone`,
    [name, owner || null, req.body.hours || '', JSON.stringify(faq || []), req.body.tone || 'friendly and helpful', currency, timezone, req.session.businessId]
  ); // JSON.stringify: faq ARRAY → JSONB column needs a JSON string
  res.json(rows[0]); // frontend Profile page uses the returned row (no refetch needed)
}

async function getProducts(req, res) {
  const products = await productService.getProducts(req.session.businessId); // service hides the SQL; session-scoped
  res.json(products); // array (frontend Catalog renders it)
}

async function upsertProduct(req, res) {
  const { name, price, description, available } = req.body || {}; // single-product add/edit from the dashboard form
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Product name required' }); // the one hard requirement
  const saved = await productService.upsertProducts(req.session.businessId, [ // wrap single object in [array] — service takes arrays
    { name, price: price || null, description: description || null, available: available ?? true }, // ?? keeps explicit false (|| would turn false→true!)
  ]);
  res.status(201).json(saved[0]); // 201 + the saved row (frontend clears the form + reloads)
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
            needs_human, flag_reason, updated_at
     FROM conversations WHERE business_id = $1
     ORDER BY updated_at DESC LIMIT 100`, // DESC = newest first (inbox order); LIMIT = don't dump the whole history
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
  const { max_discount_pct, min_order_naira } = req.body || {}; // SmartDeal guardrails from AI settings page
  const disc = Math.max(0, Math.min(50, Number(max_discount_pct) || 0)); // clamp 0–50 (Math.max lower-bounds, Math.min upper-bounds; || 0 handles NaN)
  const minOrder = Math.max(0, Number(min_order_naira) || 0); // clamp ≥0 (no negative order floors)
  await require('../db').query( // inline require again (same pool)
    'UPDATE businesses SET max_discount_pct = $1, min_order_naira = $2 WHERE id = $3',
    [disc, minOrder, req.session.businessId]
  );
  res.json({ max_discount_pct: disc, min_order_naira: minOrder }); // echo SAVED (clamped) values so UI shows truth
}

async function getBilling(req, res) {
  const billingController = require('./billingController'); // reuse planFor() — ONE price table for the whole app
  const { rows } = await db.query( // subscription state + currency (prices depend on it!)
    `SELECT subscription_status, subscription_expires, trial_started_at, currency
     FROM businesses WHERE id = $1`,
    [req.session.businessId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const b = rows[0];
  const trialDays = Number(process.env.TRIAL_DAYS || 14);
  const trialEnd = b.trial_started_at
    ? new Date(new Date(b.trial_started_at).getTime() + trialDays * 86400000) // trial start + N days (ms math)
    : null; // no trial column (very old row) → null (frontend hides countdown)
  const currency = b.currency === 'USD' ? 'USD' : 'NGN'; // whitelist (DB could hold anything)
  const plans = billingController.planFor(currency); // {monthly:{amount…}, yearly:{…, save, save_pct}, lifetime:…}
  const planService = require('../services/planService');
  res.json({
    status: b.subscription_status, // trialing | active | pending | expired
    expires: b.subscription_expires, // paid-until (null for trial/free)
    trial_ends: trialEnd, // countdown target (null when irrelevant)
    pro: planService.isPro({ subscription_status: b.subscription_status, subscription_expires: b.subscription_expires, trial_started_at: b.trial_started_at }), // boolean for badges…
    tier: planService.tier({ subscription_status: b.subscription_status, subscription_expires: b.subscription_expires, trial_started_at: b.trial_started_at }), // …and 'pro'|'free' string for logic
    currency, // 'NGN' | 'USD' (frontend money() formats with this)
    price_naira: plans.monthly.amount, // legacy name, current meaning: "monthly price in shop currency" (kept so old frontend doesn't break)
    plans: { // naira keys kept for backward-compat; amount/save keys are the new canonical ones
      monthly: { naira: plans.monthly.amount, amount: plans.monthly.amount },
      yearly: { naira: plans.yearly.amount, amount: plans.yearly.amount, save_naira: plans.yearly.save, save: plans.yearly.save, save_pct: plans.yearly.save_pct },
      lifetime: { naira: plans.lifetime.amount, amount: plans.lifetime.amount },
    },
    transfer: { // bank-transfer details (empty strings = hidden in UI — no dev-talk shown)
      bank: process.env.BANK_NAME || '',
      account_number: process.env.BANK_ACCOUNT_NUMBER || '',
      account_name: process.env.BANK_ACCOUNT_NAME || '',
    },
    paystack_live: !!(process.env.PAYSTACK_SECRET_KEY && !String(process.env.PAYSTACK_SECRET_KEY).includes('xxxxx')), // !! forces boolean: real key present AND not the placeholder?
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
  const saved = await productService.upsertProducts(business.id, products); // scaffold the catalog…
  await db.query('UPDATE businesses SET profile_snapshot = $1, profile_synced_at = now() WHERE id = $2', [profile_text.trim().slice(0, 4000), business.id]); // …AND store the trusted snapshot (slice caps at 4000 chars so prompts stay cheap)
  res.json({ products: saved, synced_at: new Date().toISOString() }); // toISOString = standard UTC string for the "Last synced" label
}

async function getProfileSync(req, res) {
  const { rows } = await db.query('SELECT profile_snapshot, profile_synced_at FROM businesses WHERE id = $1', [req.session.businessId]); // only the two sync columns (snapshot text stays server-side — never sent to browser)
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ synced: !!rows[0].profile_snapshot, synced_at: rows[0].profile_synced_at }); // !! string → boolean ("ever synced?")
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

// Vendora AI model list for the dropdown (locked flags depend on tier).
async function aiModels(req, res) {
  const planService = require('../services/planService');
  const aiModels = require('../services/aiModels');
  const { rows } = await db.query( // only subscription fields needed for tier()
    'SELECT subscription_status, subscription_expires, trial_started_at FROM businesses WHERE id = $1',
    [req.session.businessId]
  );
  const b = rows[0] || {}; // || {} : deleted business → tier('{}') = free (safe default)
  res.json({ models: aiModels.listForTier(planService.tier(b)) }); // [{id, label, tier, locked}…] — model IDs never leak
}

const FREE_AI_PER_DAY = Number(process.env.FREE_AI_PER_DAY || 20); // free-tier Vendora AI chats/day (env-tunable)
const PAID_AI_PER_DAY = Number(process.env.PAID_AI_PER_DAY || 50); // Pro premium-model chats/day (cost guard!)

// Vendora AI — general chat. Free tier: free models up to FREE_AI_PER_DAY/day.
// Pro: unlimited free models + paid models up to PAID_AI_PER_DAY/day.
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
    const { rows } = await db.query( // tier first (gates EVERYTHING below)
      'SELECT subscription_status, subscription_expires, trial_started_at FROM businesses WHERE id = $1',
      [req.session.businessId]
    );
    const tier = planService.tier(rows[0] || {}); // 'pro' | 'free'
    const resolved = aiModels.resolveChoice(model, tier); // validate dropdown id: exists? paid-but-free? → {entry, model} or {error}
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
    if (!paid && tier !== 'pro' && usage.free_count >= FREE_AI_PER_DAY) { // free user, free model, quota spent?…
      return res.status(429).json({ error: `Free daily limit reached (${FREE_AI_PER_DAY} chats). Upgrade to Pro for unlimited chats + premium AIs.` }); // 429 = Too Many Requests (correct code for rate limits!)
    }
    if (paid && usage.paid_count >= PAID_AI_PER_DAY) { // anyone (even Pro) hammering premium models?…
      return res.status(429).json({ error: `Premium AI limit reached for today (${PAID_AI_PER_DAY}). Free AIs still work.` }); // free models still open (only paid capped)
    }
    const result = await replyEngine.askGeneral(message.trim(), Array.isArray(history) ? history.slice(-12) : [], resolved.entry.id, tier); // Array.isArray guards tampered history; slice(-12) caps context cost
    if (result.reply) { // SUCCESS → count it (only successful chats consume quota — failures are free retries!)
      await db.query( // dynamic column via ${} — SAFE here: `paid` is a boolean WE computed, not user input (never interpolate raw user text into SQL!)
        `UPDATE ai_usage SET ${paid ? 'paid_count = paid_count + 1' : 'free_count = free_count + 1'}
         WHERE business_id = $1 AND day = CURRENT_DATE`,
        [req.session.businessId]
      );
      return res.json({ reply: result.reply, via: result.via }); // via = "answered by Llama 3.3" caption
    }
    return res.status(502).json({ error: 'Vendora AI is resting — try again in a moment.' }); // 502 = our upstream (the AI) failed
  } catch (e) {
    console.error('ask error:', e.message);
    res.status(500).json({ error: 'Something went wrong — try again.' });
  }
}

module.exports = { // every handler the routes file wires up (miss one here = route crashes on boot!)
  getMe,
  updateBusiness,
  getProducts,
  upsertProduct,
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
  adClick,
};
