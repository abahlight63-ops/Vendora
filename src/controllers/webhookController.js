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
    await conversationService.logMessage(customerId, 'in', body, mediaDataUrl); // store inbound message
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
