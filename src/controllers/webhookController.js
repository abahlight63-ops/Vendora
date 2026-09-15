// ── src/controllers/webhookController.js ───────────────────────────
// WHAT: the LIVE WhatsApp brain — every customer message flows through
// handleInbound(): LEARN: (free teaching) → SYNC: (Pro profile sync) →
// normal AI reply (free manual catalog for all, +verified profile for Pro).
// RULE: free tier NEVER pauses — only Pro extras are gated.
// MODULES: local services only (config, products, AI, WhatsApp sender,
// conversations, plans) + db.
const configService = require('../services/configService'); // look up shop by WhatsApp number
const productService = require('../services/productService'); // save taught/synced products
const replyEngine = require('../services/replyEngine'); // AI: extractProducts + generateReply
const conversationService = require('../services/conversationService'); // save/log/history helpers
const planService = require('../services/planService'); // isPro() — the paywall check
const db = require('../db'); // shared pool (flag updates)

const LEARN_PREFIX = 'LEARN:'; // free teaching command (everyone, forever)
const SYNC_PREFIX = 'SYNC:'; // Pro sync command (profile → catalog scaffold)

async function handleInbound(req, res) {
  try { // webhook must never crash (Meta retries 500s aggressively — 500s double-reply customers!)
    const { From, To, Body, ProfileName } = req.body || {}; // controller shape: sender, recipient(shop), text, sender name (Meta route builds this!)

    if (!From || !To || typeof Body !== 'string') { // validate before anything else
      console.error('Malformed webhook payload:', JSON.stringify(req.body)); // log for debugging spoofed/broken posts
      return res.status(400).json({ error: 'Malformed payload' }); // 400 = sender's fault
    }

    const tgCtx = req.telegram || null; // Telegram door? (route pre-resolved business + sender — see routes/telegramRoutes.js!)
    const metaCtx = req.meta || null; // Meta door? (route pre-resolved business + sender — see routes/webhookRoutes.js!)
    const business = (tgCtx && tgCtx.business) || (metaCtx && metaCtx.business)
      ? (tgCtx && tgCtx.business) || metaCtx.business
      : await configService.getBusinessByWhatsAppNumber(To); // fallback door: identity = recipient shop number
    if (!business) {
      console.error(`No business configured for number ${To}`); // onboarding gap — log it
      return res.status(200).send(''); // 200 anyway: config issues must NOT trigger Meta retries
    }
    if (!tgCtx) { // WhatsApp-class doors stamp last-inbound (Connect LIVE pill + TEST-verify read this!)
      try { await db.query('UPDATE businesses SET whatsapp_last_inbound_at = now() WHERE id = $1', [business.id]); } catch (e) { console.error('inbound stamp error:', e.message); } // guarded: a stamp must never break a reply
    }
    const telegram = require('../services/channels/telegram'); // hoisted here: the photo branch below reuses sendPhoto (lazy require above stays for sendText parity!)
    const meta = require('../services/channels/meta'); // Meta Cloud API sender (shop token — never logged!)
    const reply = tgCtx // ONE sender for every reply below (Telegram bot OR WhatsApp — call sites stay identical!)…
      ? async (to, msg, mediaUrl) => { // …Telegram door: photo+caption when a catalog photo matched, plain text otherwise…
          if (mediaUrl && await telegram.sendPhoto(tgCtx.botToken, tgCtx.chatId, mediaUrl, msg)) return; // sendPhoto true = delivered (caption IS the reply — nothing more to send!)
          return telegram.sendText(tgCtx.botToken, tgCtx.chatId, msg); // false/no-photo → plain text fallback (photo must never eat the reply!)
        }
      : (business.meta_token && business.meta_phone_number_id) // …Meta door: shop token + number id…
        ? (to, msg, mediaUrl) => meta.sendText(business.meta_token, business.meta_phone_number_id, (metaCtx && metaCtx.chatId) || String(to || '').replace(/\D/g, ''), msg, mediaUrl) // …photo-by-link + caption, text-only retry inside!
        : async (to, msg) => { console.error(`No WhatsApp sender for business ${business.id} — Meta not connected`); }; // …no sender (Meta never connected) → log, never crash!

    // ---- LEARN mode ----
    if ( // three guards: LEARN: prefix + owner number exists + sender IS the owner
      Body.trim().toUpperCase().startsWith(LEARN_PREFIX) && // .trim().toUpperCase() = "  learn: x" still works
      business.owner_number &&
      From === business.owner_number // customers can't teach — prevents catalog poisoning
    ) {
      const adText = Body.trim().slice(LEARN_PREFIX.length).trim(); // strip the 6-char prefix → raw ad text
      if (!adText) { // bare "LEARN:" with nothing after → teach the format
        await reply(From, 'Send your products like this:\nLEARN: Bone straight wig ₦95,000\nLEARN: Silk press ₦15,000');
        return res.status(200).send(''); // return = stop here (don't fall through to AI reply)
      }
      const { products, ok } = await replyEngine.extractProducts(adText, business); // AI: ad text → [{name, price, description}]
      if (!ok || products.length === 0) { // AI found nothing sellable → coach, don't save junk
        await reply(From, "Couldn't find any products in that message. Try:\nLEARN: Bone straight wig ₦95,000 available");
        return res.status(200).send('');
      }
      const saved = await productService.upsertProducts(business.id, products); // insert-or-update (same name = price update)
      const list = saved.map((p) => `• ${p.name}${p.price ? ' — ' + p.price : ''}`).join('\n'); // "• name — price" per line
      await reply(From, `Catalog updated (${saved.length} product${saved.length > 1 ? 's' : ''}):\n${list}\n\nI'll now use these to answer customers.`); // ternary pluralizes correctly
      return res.status(200).send('');
    }

    // ---- SYNC mode (PRO): scaffold catalog from the WhatsApp Business profile ----
    // Owner pastes their business profile / catalog text after SYNC: and the AI
    // builds the catalog from it. Manual LEARN: stays free for everyone.
    if (Body.trim().toUpperCase().startsWith(SYNC_PREFIX) && business.owner_number && From === business.owner_number) { // same owner-only guards as LEARN
      if (!planService.isPro(business)) { // PAYWALL: free users get the pitch, not the feature
        await reply(From, 'Profile sync is a Pro feature — it checks products against your WhatsApp Business profile automatically.\n\nManual teaching is always free: just send LEARN: followed by your products.\n\nUpgrade to Pro in your Vendora dashboard to unlock sync.');
        return res.status(200).send('');
      }
      const profileText = Body.trim().slice(SYNC_PREFIX.length).trim(); // strip "SYNC:" (5 chars) → profile text
      if (!profileText) { // bare "SYNC:" → usage coaching with example
        await reply(From, 'Paste your WhatsApp Business profile text after SYNC: and I will build your catalog from it.\n\nExample:\nSYNC: Amaka Beauty — Bone straight wig ₦95,000, silk press ₦15,000, open Mon–Sat 9am–7pm');
        return res.status(200).send('');
      }
      const { products, ok } = await replyEngine.extractProducts(profileText, business); // same extractor as LEARN (ads ≈ profiles)
      if (!ok || products.length === 0) {
        await reply(From, "I couldn't find any products in that profile text. Paste the part of your business profile that lists what you sell.");
        return res.status(200).send('');
      }
      const saved = await productService.upsertProducts(business.id, products); // scaffold the catalog…
      await db.query('UPDATE businesses SET profile_snapshot = $1, profile_synced_at = now() WHERE id = $2', [profileText.slice(0, 4000), business.id]); // …AND store the snapshot (generateReply grounds Pro answers in it; slice caps at 4000 chars)
      const list = saved.map((p) => `• ${p.name}${p.price ? ' — ' + p.price : ''}`).join('\n');
      await reply(From, `Done — profile synced: ${saved.length} verified product${saved.length > 1 ? 's' : ''}:\n${list}\n\nI'll now verify customer questions against your business profile.`);
      return res.status(200).send('');
    }

    // ---- PAUSE / RESUME commands (owner only, anytime) ----
    // Lets the owner silence the bot from WhatsApp itself: PAUSE stops all
    // replies, RESUME restarts, PAUSE <number> silences one chat (takeover).
    // WHY: the shop number doubles as a personal line — friends chatting must
    // never get product pitches fighting the owner's own conversation.
  const upperBody = Body.trim().toUpperCase(); // normalize once: case + padding proof
  const isOwner = (business.owner_number && From === business.owner_number) // WhatsApp door: sender IS the owner number…
    || (tgCtx && business.owner_telegram_id && String(business.owner_telegram_id) === String(tgCtx.chatId)); // …Telegram door: linked owner chat id (bound via /start link_CODE — owner commands work here too!)
    if (isOwner && (upperBody === 'PAUSE' || upperBody === 'RESUME' || upperBody.startsWith('PAUSE '))) {
      if (upperBody === 'RESUME') { // resume everything…
        await db.query('UPDATE businesses SET bot_enabled = true WHERE id = $1', [business.id]); // …global switch on…
        await db.query('UPDATE conversations SET bot_paused = false WHERE business_id = $1', [business.id]); // …plus every taken-over chat released
        await reply(From, 'Bot resumed — I reply to customers again. Send PAUSE anytime to silence me.');
        return res.status(200).send('');
      }
      const target = Body.trim().slice(5).trim(); // "PAUSE <digits>" → the digits (slice(5) strips "PAUSE")
      if (target) { // per-chat takeover: find the chat by number fragment…
        const { rows: found } = await db.query( // LIKE match: owner types last digits, we find the chat (avoids full-number typing!)
          "SELECT id, customer_number FROM conversations WHERE business_id = $1 AND customer_number LIKE '%' || $2 || '%' ORDER BY updated_at DESC LIMIT 1",
          [business.id, target.replace(/\D/g, '')] // replace(/\D/g,'') strips non-digits (spaces/dashes/+ tolerated)
        );
        if (found.length === 0) { // no chat matches → say so (don't silently fail!)
          await reply(From, `No recent chat matches "${target}". Check the number and try PAUSE <digits> again, or send PAUSE alone to silence everything.`);
          return res.status(200).send('');
        }
        await db.query('UPDATE conversations SET bot_paused = true WHERE id = $1', [found[0].id]); // silence THIS chat (inbox "Take over" does the same visually!)
        await reply(From, `🔇 Bot paused for ${found[0].customer_number}. Chat freely — send RESUME to hand back.`);
        return res.status(200).send('');
      }
      await db.query('UPDATE businesses SET bot_enabled = false WHERE id = $1', [business.id]); // bare PAUSE → global kill-switch
      await reply(From, '🔇 Bot paused everywhere. Customers are logged but get no replies. Send RESUME to restart, or PAUSE <digits> for one chat.');
      return res.status(200).send('');
    }

    // ---- UNDO: reverse the latest stock change (owner only) ----
    // Reads the audit log, writes back the old value, logs the reversal.
    // Audit is append-only: original + reversal BOTH stay visible (honest books!).
    if (isOwner && upperBody === 'UNDO:') {
      const { undoLast } = require('../services/actions/updateInventory'); // lazy require (actions dir loads on demand!)
      const undone = await undoLast(business.id); // latest entry → reversed (or structured error below!)
      if (!undone.ok) { // empty history / product deleted since…
        await reply(From, undone.error === 'gone' ? 'That product no longer exists in your catalog — re-add it with LEARN: first.' : 'Nothing to undo yet — no stock changes recorded.');
        return res.status(200).send('');
      }
      await reply(From, `↩️ Undone: ${undone.item} ${undone.before} → ${undone.after}.`); // before = value at undo time, after = restored value (mirrors update format!)
      return res.status(200).send('');
    }

    // ---- INVENTORY intents: "sold 3 bags of rice" → real stock edits ----
    // Owner-only, Pro-gated (registry tier!). Flow: parse intent → gate →
    // execute-or-clarify → confirm with before/after. Free tier gets the pitch.
    // Positioned AFTER LEARN:/SYNC:/PAUSE:/UNDO: (explicit prefixes win over
    // fuzzy intent — "LEARN: sold out poster" must NOT become a stock removal!).
    if (isOwner && replyEngine.INVENTORY_HINT.test(Body || '')) { // regex gate FIRST (no hint words → zero AI cost, straight to normal flow!)
      const catalog = await productService.getProducts(business.id); // parser needs names to ground matching…
      const intent = await replyEngine.parseInventoryAction(Body, catalog); // …strict-JSON intent (validated inside!)
      if (intent.action === 'clarify') { // ambiguous → ASK (never guess — your rule #3!)
        await reply(From, `🤔 ${intent.question}`);
        return res.status(200).send('');
      }
      if (intent.action === 'update_inventory') { // confident parse → GATE, then execute…
        const registry = require('../services/actions/registry'); // lazy require (registry loads handlers on demand!)
        const gate = registry.canRun(business, 'update_inventory'); // Pro check (trial counts — planService decides!)
        if (!gate.ok) { // free tier → pitch (one line + LEARN reminder — never silent!)
          await reply(From, 'Stock updates are a Pro feature — I can edit inventory from your messages automatically.\n\nManual catalog stays free: use LEARN: any time.\n\nUpgrade to Pro in your Vendora dashboard to unlock it.');
          return res.status(200).send('');
        }
        const done = await gate.action.run(business.id, intent.item, intent.quantity, intent.operation, Body); // THE TOOL CALL (transactional + audited inside!)
        if (!done.ok) { // resolution/execution failures → specific coaching (never raw errors!)…
          if (done.error === 'empty') {
            await reply(From, 'Your catalog is empty — add products first (dashboard, or send LEARN: Blue gown ₦45,000), then tell me stock changes.');
          } else if (done.error === 'notfound') {
            await reply(From, `I don't have "${intent.item}" in your catalog. Add it first with LEARN: — then tell me the stock change.`);
          } else if (done.error === 'ambiguous') {
            await reply(From, `Which one? ${(done.candidates || []).join(', ')} — reply with the exact name and quantity.`);
          } else {
            await reply(From, 'Stock update failed — try again in a moment.');
          }
          return res.status(200).send('');
        }
        const arrow = `${done.before} → ${done.after}`; // the before/after core (your rule #4 — always shown!)
        if (done.operation === 'add') {
          await reply(From, `Stock updated: ${done.item} ${arrow} (+${intent.quantity} received).`);
        } else if (done.operation === 'remove') { // remove splits: clean sale vs oversell-clamp (different copy — owner must SEE the difference!)…
          if (done.clamped) {
            await reply(From, `⚠️ Only ${done.before} in stock — recorded the sale, stock now 0 (was short by ${intent.quantity - done.before}). Check this one!`); // oversell math shown (shortfall = asked − had!)
          } else {
            await reply(From, `Sale recorded: ${done.item} ${arrow} (−${intent.quantity}).`);
          }
        } else { // 'set' (count corrections)…
          await reply(From, `Stock count set: ${done.item} ${arrow}.`);
        }
        return res.status(200).send('');
      }
      // intent.action === 'none' → fall THROUGH to normal flow below (owner chit-chat still gets Q&A/handoff!)
    }

    // ---- Personal contacts: NEVER reply (friends/family chatting personally) ----
    // Owner lists these numbers in Business profile. Messages are ignored
    // entirely (not even logged as chats — personal chats aren't business data).
    // This is THE anti-fighting mechanism: explicit list beats AI guessing.
    try { // try/catch: a malformed list must never break the webhook (parse defensively!)
      const personal = JSON.parse(business.personal_contacts || '[]'); // JSONB may arrive as string or array…
      const list = Array.isArray(personal) ? personal : []; // …normalize to array (anything else → empty = no silencing)
      const digits = (s) => String(s || '').replace(/\D/g, ''); // digits-only compare (ignores +, spaces, whatsapp: prefix!)
      if (!isOwner && !tgCtx && list.some((p) => p && digits(p) && digits(From).endsWith(digits(p).slice(-7)))) { // !tgCtx: list holds WHATSAPP numbers — Telegram ids must never match it (different namespace, coincidence-proofing!)
        return res.status(200).send(''); // silent 200: Meta happy, human conversation untouched
      }
    } catch {} // JSON.parse failed → ignore list this once (empty catch intentional: availability over strictness)

    // ---- Normal customer conversation ----
    let body = Body; // let: photo case appends "[the customer sent a photo]"
    let image = null; // {mime, base64} for AI vision (null = text only)
    let mediaDataUrl = null; // data: URL for the dashboard <img> (Telegram files expire)
    if (tgCtx && tgCtx.media && tgCtx.media.kind === 'image') { // Telegram door: photo pre-downloaded by the route (auth + bytes already handled!)…
      image = { mime: tgCtx.media.mime, base64: tgCtx.media.base64 }; // …straight into vision input!
      body = (Body ? Body + ' ' : '') + '[the customer sent a photo]'; // caption (if any) + photo note
    }
    // NOTE: Meta image/voice payloads arrive as media IDs (not text) and are
    // skipped by parseInbound for now — text road only. Voice notes on
    // Telegram are transcribed in routes/telegramRoutes.js (same Whisper engine!).

    const customerId = await conversationService.saveMessage(business.id, From, ProfileName || null, body); // find-or-create chat row → id
    await conversationService.logMessage(customerId, 'in', body, mediaDataUrl); // store inbound message (ALWAYS logged — even when silent below!)
    // ---- Takeover silence: global off OR this chat taken over → log only ----
    // Covers: dashboard toggle, inbox Take-over button, PAUSE commands above.
    // WHY log-then-return (not ignore): the owner still SEES what customers
    // said while away — silence is about REPLIES, never about records.
    const { rows: gate } = await db.query('SELECT bot_enabled FROM businesses WHERE id = $1', [business.id]); // fresh read (owner may have toggled seconds ago!)
    const { rows: chat } = await db.query('SELECT bot_paused FROM conversations WHERE id = $1', [customerId]);
    if (gate[0] && gate[0].bot_enabled === false) return res.status(200).send(''); // global kill-switch engaged → silent (Meta 200, no retry)
    if (chat[0] && chat[0].bot_paused) return res.status(200).send(''); // owner took over this chat → silent (chat freely!)
    // ---- Per-customer throttle: one chatty stranger can't eat the shop's quota ----
    // Counts TODAY's inbound messages on THIS chat (30/day default). Over the line?
    // Bot rests, message still logged (records never stop — replies do, briefly!).
    const CUSTOMER_DAILY_CAP = Number(process.env.CUSTOMER_DAILY_CAP || 30); // env-tunable (30 strangers'-worth of patience!)
    const { rows: usage } = await db.query(
      `SELECT COUNT(*)::int AS c FROM messages WHERE conversation_id = $1 AND direction = 'in' AND created_at >= CURRENT_DATE`, // direction='in' only (our own replies don't count against THEM!)
      [customerId]
    );
    if (usage[0].c > CUSTOMER_DAILY_CAP) return res.status(200).send(''); // silent rest (no reply-bomb, no error — owner sees it all in the inbox!)
    // ---- Per-shop tier limit: Free 50 / Pro 500 / Plus 1000 bot replies/day ----
    // Counts TODAY's outbound bot messages for THIS shop (all chats). Over the
    // line? One polite limit notice per chat per day, then silent (records keep
    // flowing — replies pause till midnight). Customers never see a paywall.
    const WA_LIMIT = planService.whatsappDailyLimit(business); // tier-gated (env-overridable!)
    try {
      const { rows: shopUsage } = await db.query(
        `SELECT COUNT(*)::int AS c FROM messages m JOIN conversations c2 ON c2.id = m.conversation_id
         WHERE c2.business_id = $1 AND m.direction = 'out' AND m.created_at >= CURRENT_DATE`,
        [business.id]
      );
      if (shopUsage[0] && shopUsage[0].c >= WA_LIMIT) {
        await db.query(
          `UPDATE conversations SET needs_human = true, flag_reason = $1, updated_at = now() WHERE id = $2`,
          [`Daily reply limit reached (${WA_LIMIT}/day on your plan)`, customerId]
        );
        const { rows: already } = await db.query(
          `SELECT 1 FROM messages WHERE conversation_id = $1 AND direction = 'out'
           AND created_at >= CURRENT_DATE AND body LIKE '%reply limit%' LIMIT 1`,
          [customerId]
        );
        if (!already.length) { // one kind notice per chat per day (never a reply-bomb!)
          const tierName = planService.effectiveTier(business);
          const limitMsg = tierName === 'free'
            ? `Sorry! ${business.name} has hit today's free reply limit (${WA_LIMIT}/day). A teammate will follow up with you shortly — or tap to upgrade for more replies!`
            : `Sorry! We've hit today's reply limit (${WA_LIMIT}/day). A teammate will follow up with you shortly.`;
          await reply(From, limitMsg);
          await conversationService.logMessage(customerId, 'out', limitMsg);
        }
        return res.status(200).send('');
      }
    } catch (e) { console.error('tier-limit check error:', e.message); } // guarded: caps must never eat logging
    const history = await conversationService.getHistory(customerId); // last 10, oldest-first (pronoun context: "how much is IT?")

    // Free tier keeps working from the manual catalog — only Pro unlocks
    // profile verification. Nothing is ever paused for non-payment.
    // Paid-model guard: a shop that picked Kimi/Claude/GPT for WhatsApp spends
    // API money per reply — cap it DAILY (same 50 as the VendoraAI page). Over
    // the cap? The reply still goes out, just answered by the free default
    // (customers NEVER see paywalls — the shop sees the cap in Insights!).
    const PAID_WA_PER_DAY = Number(process.env.PAID_AI_PER_DAY || 50); // shared paid-model budget (one number for page + WhatsApp!)
    try {
      const aiModels = require('../services/aiModels');
      const pick = aiModels.resolveChoice(business.whatsapp_model || 'gemini-flash-full', planService.effectiveTier(business));
      if (!pick.error && pick.entry.tier === 'paid') {
        const { rows: cap } = await db.query(
          `INSERT INTO ai_usage (business_id, day) VALUES ($1, CURRENT_DATE)
           ON CONFLICT (business_id, day) DO UPDATE SET business_id = EXCLUDED.business_id
           RETURNING paid_count`,
          [business.id]
        );
        if (cap[0] && cap[0].paid_count >= PAID_WA_PER_DAY) {
          business = { ...business, whatsapp_model: 'gemini-flash-full' }; // downgrade THIS reply only (spread = no DB write, no mutation of the cached row!)
          console.log(`WhatsApp paid cap hit for biz ${business.id} — free default answers this one`);
        }
      }
    } catch (e) { console.error('paid-cap check error:', e.message); } // guarded: caps must never eat a reply
    const result = await replyEngine.generateReply(body, business, image, history); // THE AI CALL (model + tier resolved inside!)

    if (result.reply) { // confident answer → deliver + clear any old flag
      let photoUrl = null; // catalog photo to attach (null = text-only, the default!)
      if (planService.isPro(business)) { // PRO-ONLY: photos are a premium selling point (free tier gets the same WORDS, just no picture!)
        try { // try/catch: a catalog read failure must never eat the reply (text still goes out!)
          const catalog = await productService.getProducts(business.id); // fresh catalog (photos editable from the dashboard anytime!)
          photoUrl = pickProductPhoto(catalog, body, result.reply); // name-match against what was asked + answered (first photo wins!)
        } catch (e) { console.error('photo resolve error:', e.message); }
      }
      await reply(From, result.reply, photoUrl); // send to customer (From = customer number here)
      await conversationService.logMessage(customerId, 'out', result.reply, photoUrl); // store our reply (+ photo URL so the inbox shows what was sent!)
      if (result.paidModel) { // paid brain answered → count it (same daily budget as the VendoraAI page!)
        try {
          await db.query(
            `INSERT INTO ai_usage (business_id, day, paid_count) VALUES ($1, CURRENT_DATE, 1)
             ON CONFLICT (business_id, day) DO UPDATE SET paid_count = ai_usage.paid_count + 1`,
            [business.id]
          );
        } catch (e) { console.error('paid-count error:', e.message); } // guarded: counting must never break logging
      }
      await db.query( // update chat preview + unflag (it might have been flagged before)
        'UPDATE conversations SET last_reply = $1, needs_human = false, flag_reason = NULL, updated_at = now() WHERE id = $2',
        [result.reply, customerId]
      );
    } else if (result.needsHuman) { // unsure → flag + polite handoff + owner alert (the trust engine)
      await db.query(
        `UPDATE conversations
         SET needs_human = true, flag_reason = $1, updated_at = now()
         WHERE id = $2`, // gold flag + reason (Insights aggregates these reasons)
        [result.reason || 'AI could not answer confidently', customerId]
      );
      const handoffMsg = (business.handoff_msg && String(business.handoff_msg).trim()) // owner's own handoff words (AI settings page!)…
        || 'Thanks for your message! A member of our team will get back to you shortly.'; // …or the built-in polite fallback (customer never left hanging!)
      await reply(From, handoffMsg);
      await conversationService.logMessage(customerId, 'out', handoffMsg);
      await alertOwner(business, From, ProfileName, Body, result.reason); // …and the owner is paged instantly
    }

    res.status(200).send(''); // Meta happy (empty 200 = "received, don't retry")
  } catch (err) {
    console.error('Webhook error:', err); // log the crash…
    res.status(200).send(''); // …but STILL 200 (a 500 would make Meta retry + double-reply the customer!)
  }
}

// Pick ONE catalog photo to attach to a bot reply (Pro shops only — caller gates!).
// Matches product names (3+ chars) against the customer message + the reply text;
// first product WITH an image_url wins. Returns the URL or null (text-only).
// WHY both texts: the customer may ask vaguely ("how much is the gown?") while the
// reply names it ("Blue gown is ₦45,000") — matching both catches either side.
function pickProductPhoto(catalog, customerText, replyText) {
  if (!Array.isArray(catalog) || catalog.length === 0) return null; // empty shelf → nothing to attach
  const hay = `${customerText || ''}\n${replyText || ''}`.toLowerCase(); // one lowercase blob (includes() matching below!)
  for (const p of catalog) { // catalog order = oldest first (stable, predictable: first photo wins!)
    const name = String(p && p.name || '').trim().toLowerCase();
    if (name.length < 3) continue; // tiny names ("oil", "it") would match EVERYTHING — skip (precision over recall!)
    if (!p.image_url) continue; // no photo on this product (text-only, as before!)
    if (hay.includes(name)) return p.image_url; // named in the conversation → attach its photo
  }
  return null; // no named photo product → text-only (unchanged behavior!)
}

async function alertOwner(business, customerNumber, customerName, message, reason) {
  const summary = // the page: who, what, why, how to reach them (plain text — no emoji icons!)
    `NEW ORDER / INQUIRY — ${business.name}\n\n` +
    `Customer: ${customerName || 'Unknown'} (${customerNumber})\n` +
    `Message: "${message}"\n` +
    `Why you are needed: ${reason || 'AI could not answer'}\n\n` +
    `Reply to them directly on WhatsApp: ${customerNumber}`;
  const jobs = []; // fan-out list (both doors alerted in PARALLEL — owner gets paged wherever they live!)
  if (business.owner_number && business.meta_token && business.meta_phone_number_id) { // WhatsApp door: owner's number via the SHOP's Meta sender…
    const waMeta = require('../services/channels/meta'); // lazy require (consistent file style!)
    jobs.push(waMeta.sendText(business.meta_token, business.meta_phone_number_id, String(business.owner_number).replace(/\D/g, ''), summary)); // …same summary, WhatsApp flavor!
  }
  if (business.owner_telegram_id && business.telegram_bot_token) { // Telegram door: linked owner + connected bot…
    const tg = require('../services/channels/telegram'); // lazy require (consistent file style!)
    jobs.push(tg.sendText(business.telegram_bot_token, business.owner_telegram_id, summary)); // …same summary, Telegram flavor!
  }
  if (jobs.length === 0) return; // no door configured (guard clause — was owner_number-only before!)
  await Promise.all(jobs); // Promise.all = parallel (one slow door never delays the other!)
}

module.exports = { handleInbound, _pickProductPhoto: pickProductPhoto }; // routes/webhookRoutes.js wires handleInbound to POST /webhook/whatsapp (_pick exported for smoke tests!)
