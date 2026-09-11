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
const whatsappService = require('../services/whatsappService'); // Twilio send + photo download
const conversationService = require('../services/conversationService'); // save/log/history helpers
const planService = require('../services/planService'); // isPro() — the paywall check
const db = require('../db'); // shared pool (flag updates)

const LEARN_PREFIX = 'LEARN:'; // free teaching command (everyone, forever)
const SYNC_PREFIX = 'SYNC:'; // Pro sync command (profile → catalog scaffold)

async function handleInbound(req, res) {
  try { // webhook must never crash (Twilio retries 500s aggressively)
    const { From, To, Body, ProfileName } = req.body || {}; // Twilio form fields: sender, recipient(shop), text, sender name

    if (!From || !To || typeof Body !== 'string') { // validate before anything else
      console.error('Malformed webhook payload:', JSON.stringify(req.body)); // log for debugging spoofed/broken posts
      return res.status(400).json({ error: 'Malformed payload' }); // 400 = sender's fault
    }

    const business = await configService.getBusinessByWhatsAppNumber(To); // which shop was messaged?
    if (!business) {
      console.error(`No business configured for number ${To}`); // onboarding gap — log it
      return res.status(200).send(''); // 200 anyway: config issues must NOT trigger Twilio retries
    }

    // ---- LEARN mode ----
    if ( // three guards: LEARN: prefix + owner number exists + sender IS the owner
      Body.trim().toUpperCase().startsWith(LEARN_PREFIX) && // .trim().toUpperCase() = "  learn: x" still works
      business.owner_number &&
      From === business.owner_number // customers can't teach — prevents catalog poisoning
    ) {
      const adText = Body.trim().slice(LEARN_PREFIX.length).trim(); // strip the 6-char prefix → raw ad text
      if (!adText) { // bare "LEARN:" with nothing after → teach the format
        await whatsappService.sendWhatsAppReply(From, 'Send your products like this:\nLEARN: Bone straight wig ₦95,000\nLEARN: Silk press ₦15,000');
        return res.status(200).send(''); // return = stop here (don't fall through to AI reply)
      }
      const { products, ok } = await replyEngine.extractProducts(adText, business); // AI: ad text → [{name, price, description}]
      if (!ok || products.length === 0) { // AI found nothing sellable → coach, don't save junk
        await whatsappService.sendWhatsAppReply(From, "Couldn't find any products in that message. Try:\nLEARN: Bone straight wig ₦95,000 available");
        return res.status(200).send('');
      }
      const saved = await productService.upsertProducts(business.id, products); // insert-or-update (same name = price update)
      const list = saved.map((p) => `• ${p.name}${p.price ? ' — ' + p.price : ''}`).join('\n'); // "• name — price" per line
      await whatsappService.sendWhatsAppReply(From, `✅ Catalog updated (${saved.length} product${saved.length > 1 ? 's' : ''}):\n${list}\n\nI'll now use these to answer customers.`); // ternary pluralizes correctly
      return res.status(200).send('');
    }

    // ---- SYNC mode (PRO): scaffold catalog from the WhatsApp Business profile ----
    // Owner pastes their business profile / catalog text after SYNC: and the AI
    // builds the catalog from it. Manual LEARN: stays free for everyone.
    if (Body.trim().toUpperCase().startsWith(SYNC_PREFIX) && business.owner_number && From === business.owner_number) { // same owner-only guards as LEARN
      if (!planService.isPro(business)) { // PAYWALL: free users get the pitch, not the feature
        await whatsappService.sendWhatsAppReply(From, 'Profile sync is a Pro feature — it checks products against your WhatsApp Business profile automatically.\n\nManual teaching is always free: just send LEARN: followed by your products.\n\nUpgrade to Pro in your Vendora dashboard to unlock sync.');
        return res.status(200).send('');
      }
      const profileText = Body.trim().slice(SYNC_PREFIX.length).trim(); // strip "SYNC:" (5 chars) → profile text
      if (!profileText) { // bare "SYNC:" → usage coaching with example
        await whatsappService.sendWhatsAppReply(From, 'Paste your WhatsApp Business profile text after SYNC: and I will build your catalog from it.\n\nExample:\nSYNC: Amaka Beauty — Bone straight wig ₦95,000, silk press ₦15,000, open Mon–Sat 9am–7pm');
        return res.status(200).send('');
      }
      const { products, ok } = await replyEngine.extractProducts(profileText, business); // same extractor as LEARN (ads ≈ profiles)
      if (!ok || products.length === 0) {
        await whatsappService.sendWhatsAppReply(From, "I couldn't find any products in that profile text. Paste the part of your business profile that lists what you sell.");
        return res.status(200).send('');
      }
      const saved = await productService.upsertProducts(business.id, products); // scaffold the catalog…
      await db.query('UPDATE businesses SET profile_snapshot = $1, profile_synced_at = now() WHERE id = $2', [profileText.slice(0, 4000), business.id]); // …AND store the snapshot (generateReply grounds Pro answers in it; slice caps at 4000 chars)
      const list = saved.map((p) => `• ${p.name}${p.price ? ' — ' + p.price : ''}`).join('\n');
      await whatsappService.sendWhatsAppReply(From, `✅ Profile synced — ${saved.length} verified product${saved.length > 1 ? 's' : ''}:\n${list}\n\nI'll now verify customer questions against your business profile.`);
      return res.status(200).send('');
    }

    // ---- PAUSE / RESUME commands (owner only, anytime) ----
    // Lets the owner silence the bot from WhatsApp itself: PAUSE stops all
    // replies, RESUME restarts, PAUSE <number> silences one chat (takeover).
    // WHY: the shop number doubles as a personal line — friends chatting must
    // never get product pitches fighting the owner's own conversation.
    const upperBody = Body.trim().toUpperCase(); // normalize once: case + padding proof
    const isOwner = business.owner_number && From === business.owner_number; // owner-only gate (customers can't pause YOUR bot!)
    if (isOwner && (upperBody === 'PAUSE' || upperBody === 'RESUME' || upperBody.startsWith('PAUSE '))) {
      if (upperBody === 'RESUME') { // resume everything…
        await db.query('UPDATE businesses SET bot_enabled = true WHERE id = $1', [business.id]); // …global switch on…
        await db.query('UPDATE conversations SET bot_paused = false WHERE business_id = $1', [business.id]); // …plus every taken-over chat released
        await whatsappService.sendWhatsAppReply(From, '✅ Bot resumed — I reply to customers again. Send PAUSE anytime to silence me.');
        return res.status(200).send('');
      }
      const target = Body.trim().slice(5).trim(); // "PAUSE <digits>" → the digits (slice(5) strips "PAUSE")
      if (target) { // per-chat takeover: find the chat by number fragment…
        const { rows: found } = await db.query( // LIKE match: owner types last digits, we find the chat (avoids full-number typing!)
          "SELECT id, customer_number FROM conversations WHERE business_id = $1 AND customer_number LIKE '%' || $2 || '%' ORDER BY updated_at DESC LIMIT 1",
          [business.id, target.replace(/\D/g, '')] // replace(/\D/g,'') strips non-digits (spaces/dashes/+ tolerated)
        );
        if (found.length === 0) { // no chat matches → say so (don't silently fail!)
          await whatsappService.sendWhatsAppReply(From, `No recent chat matches "${target}". Check the number and try PAUSE <digits> again, or send PAUSE alone to silence everything.`);
          return res.status(200).send('');
        }
        await db.query('UPDATE conversations SET bot_paused = true WHERE id = $1', [found[0].id]); // silence THIS chat (inbox "Take over" does the same visually!)
        await whatsappService.sendWhatsAppReply(From, `🔇 Bot paused for ${found[0].customer_number}. Chat freely — send RESUME to hand back.`);
        return res.status(200).send('');
      }
      await db.query('UPDATE businesses SET bot_enabled = false WHERE id = $1', [business.id]); // bare PAUSE → global kill-switch
      await whatsappService.sendWhatsAppReply(From, '🔇 Bot paused everywhere. Customers are logged but get no replies. Send RESUME to restart, or PAUSE <digits> for one chat.');
      return res.status(200).send('');
    }

    // ---- Personal contacts: NEVER reply (friends/family chatting personally) ----
    // Owner lists these numbers in Business profile. Messages are ignored
    // entirely (not even logged as chats — personal chats aren't business data).
    // This is THE anti-fighting mechanism: explicit list beats AI guessing.
    try { // try/catch: a malformed list must never break the webhook (parse defensively!)
      const personal = JSON.parse(business.personal_contacts || '[]'); // JSONB may arrive as string or array…
      const list = Array.isArray(personal) ? personal : []; // …normalize to array (anything else → empty = no silencing)
      const digits = (s) => String(s || '').replace(/\D/g, ''); // digits-only compare (ignores +, spaces, whatsapp: prefix!)
      if (!isOwner && list.some((p) => p && digits(p) && digits(From).endsWith(digits(p).slice(-7)))) { // endsWith(last 7 digits) = tolerant match (country-code/format-proof!)
        return res.status(200).send(''); // silent 200: Twilio happy, human conversation untouched
      }
    } catch {} // JSON.parse failed → ignore list this once (empty catch intentional: availability over strictness)

    // ---- Normal customer conversation ----
    let body = Body; // let: photo case appends "[the customer sent a photo]"
    let image = null; // {mime, base64} for AI vision (null = text only)
    let mediaDataUrl = null; // data: URL for the dashboard <img> (Twilio links expire)
    const numMedia = parseInt(req.body.NumMedia || '0', 10); // Twilio attachment count (string → int)
    if (numMedia > 0 && req.body.MediaUrl0) { // MediaUrl0 = first attachment URL
      const mime = req.body.MediaContentType0 || 'image/jpeg'; // content type, JPEG default
      if (String(mime).startsWith('image/')) { // images only — voice notes/docs skipped for now
        const media = await whatsappService.fetchMedia(req.body.MediaUrl0, mime); // download (auth + ≤1MB inline rule inside)
        if (media) { // null = download failed → continue text-only (graceful)
          image = media.image; // → AI vision
          mediaDataUrl = media.mediaDataUrl; // → DB media_url column
          body = (Body || '') + ' [the customer sent a photo]'; // tell the AI a photo came along
        }
      }
    }

    const customerId = await conversationService.saveMessage(business.id, From, ProfileName || null, body); // find-or-create chat row → id
    await conversationService.logMessage(customerId, 'in', body, mediaDataUrl); // store inbound message (ALWAYS logged — even when silent below!)
    // ---- Takeover silence: global off OR this chat taken over → log only ----
    // Covers: dashboard toggle, inbox Take-over button, PAUSE commands above.
    // WHY log-then-return (not ignore): the owner still SEES what customers
    // said while away — silence is about REPLIES, never about records.
    const { rows: gate } = await db.query('SELECT bot_enabled FROM businesses WHERE id = $1', [business.id]); // fresh read (owner may have toggled seconds ago!)
    const { rows: chat } = await db.query('SELECT bot_paused FROM conversations WHERE id = $1', [customerId]);
    if (gate[0] && gate[0].bot_enabled === false) return res.status(200).send(''); // global kill-switch engaged → silent (Twilio 200, no retry)
    if (chat[0] && chat[0].bot_paused) return res.status(200).send(''); // owner took over this chat → silent (chat freely!)
    const history = await conversationService.getHistory(customerId); // last 10, oldest-first (pronoun context: "how much is IT?")

    // Free tier keeps working from the manual catalog — only Pro unlocks
    // profile verification. Nothing is ever paused for non-payment.
    const result = await replyEngine.generateReply(body, business, image, history); // THE AI CALL (Pro flag resolved inside via planService)

    if (result.reply) { // confident answer → deliver + clear any old flag
      await whatsappService.sendWhatsAppReply(From, result.reply); // send to customer (From = customer number here)
      await conversationService.logMessage(customerId, 'out', result.reply); // store our reply
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
      const handoffMsg = 'Thanks for your message! A member of our team will get back to you shortly.'; // customer never left hanging…
      await whatsappService.sendWhatsAppReply(From, handoffMsg);
      await conversationService.logMessage(customerId, 'out', handoffMsg);
      await alertOwner(business, From, ProfileName, Body, result.reason); // …and the owner is paged instantly
    }

    res.status(200).send(''); // Twilio happy (empty 200 = "received, don't retry")
  } catch (err) {
    console.error('Webhook error:', err); // log the crash…
    res.status(500).send(''); // …500 tells Twilio to retry later (message isn't lost)
  }
}

async function alertOwner(business, customerNumber, customerName, message, reason) {
  if (!business.owner_number) return; // no owner number → nothing to alert (guard clause)
  const summary = // the page: who, what, why, how to reach them
    `🔔 NEW ORDER / INQUIRY — ${business.name}\n\n` +
    `👤 Customer: ${customerName || 'Unknown'} (${customerNumber})\n` +
    `💬 Message: "${message}"\n` +
    `❓ Why you're needed: ${reason || 'AI could not answer'}\n\n` +
    `Reply to them directly on WhatsApp: ${customerNumber}`;
  await whatsappService.sendWhatsAppReply(business.owner_number, summary); // owner_number is the RECIPIENT here
}

module.exports = { handleInbound }; // routes/webhookRoutes.js wires this to POST /webhook/whatsapp
