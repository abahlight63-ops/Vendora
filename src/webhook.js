// ── src/webhook.js ───────────────────────────────────────────────
// ⚠️ LEGACY FILE — NOT USED by the running app. The live webhook handler is
// src/controllers/webhookController.js (wired via src/routes/webhookRoutes.js).
// This older copy is kept for reference. Differences from the live version:
//  · no SYNC: mode, no free-vs-Pro tiers (it PAUSES the bot when expired)
//  · sendWhatsAppReply() takes a different argument order
//  · media fetching is inline instead of in whatsappService
// Read it to learn the flow, but EDIT webhookController.js instead.
// MODULES: local services only (configService, productService, replyEngine, db).
const configService = require('./services/configService'); // look up business by WhatsApp number
const productService = require('./services/productService'); // save catalog products
const replyEngine = require('./services/replyEngine'); // AI: extractProducts + generateReply
const db = require('./db'); // shared Postgres pool

const LEARN_PREFIX = 'LEARN:'; // owner teaching command: "LEARN: Blue gown ₦45,000"

/**
 * Twilio WhatsApp inbound webhook handler. (LEGACY — see note at top.)
 */
async function handleInbound(req, res) {
  try { // try/catch around everything: webhook must NEVER crash the server
    const { From, To, Body, ProfileName } = req.body || {}; // destructure Twilio's form fields (|| {} guards empty body)

    if (!From || !To || typeof Body !== 'string') { // validate: sender + recipient + text required
      console.error('Malformed webhook payload:', JSON.stringify(req.body)); // log the bad payload for debugging
      return res.status(400).json({ error: 'Malformed payload' }); // 400 = client sent garbage
    }

    const business = await configService.getBusinessByWhatsAppNumber(To); // which shop owns the number messaged?
    if (!business) {
      console.error(`No business configured for number ${To}`); // log unconfigured numbers
      return res.status(200).send(''); // 200 anyway! (Twilio retries on non-2xx — don't retry a config issue)
    }

    // ---- LEARN mode: the owner teaches the bot their catalog ----
    if ( // three guards: starts with LEARN: AND owner number exists AND sender IS the owner
      Body.trim().toUpperCase().startsWith(LEARN_PREFIX) && // .trim() ignores spaces; UPPER = case-insensitive
      business.owner_number &&
      From === business.owner_number // customers can't teach — only the owner number
    ) {
      const adText = Body.trim().slice(LEARN_PREFIX.length).trim(); // strip "LEARN:" → just the ad text
      if (!adText) {
        await sendWhatsAppReply(To, From, 'Send your products like this:\nLEARN: Bone straight wig ₦95,000\nLEARN: Silk press ₦15,000');
        return res.status(200).send(''); // usage hint, then done (return stops the function)
      }
      const { products, ok } = await replyEngine.extractProducts(adText, business); // AI parses ad → [{name, price}]
      if (!ok || products.length === 0) {
        await sendWhatsAppReply(To, From, "Couldn't find any products in that message. Try:\nLEARN: Bone straight wig ₦95,000 available");
        return res.status(200).send('');
      }
      const saved = await productService.upsertProducts(business.id, products); // insert-or-update each product
      const list = saved.map((p) => `• ${p.name}${p.price ? ' — ' + p.price : ''}`).join('\n'); // pretty "• name — price" lines
      await sendWhatsAppReply(To, From, `Catalog updated (${saved.length} product${saved.length > 1 ? 's' : ''}):\n${list}\n\nI'll now use these to answer customers.`);
      return res.status(200).send('');
    }

    // ---- Normal customer conversation ----
    let body = Body; // let (not const) — photo case appends a note below
    let image = null; // {mime, base64} for the AI, if a photo arrived
    let mediaDataUrl = null; // data: URL so the DASHBOARD can show the photo later
    const numMedia = parseInt(req.body.NumMedia || '0', 10); // Twilio: how many attachments? (string → int, base 10)
    if (numMedia > 0 && req.body.MediaUrl0) { // MediaUrl0 = first attachment URL
      const url = req.body.MediaUrl0;
      const mime = req.body.MediaContentType0 || 'image/jpeg'; // content type, default JPEG
      if (String(mime).startsWith('image/')) { // only images — ignore audio/docs for now
        try {
          const mRes = await fetch(url, { // download from Twilio (needs Basic auth with our creds)
            headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64') },
          });
          if (mRes.ok) {
            const buf = Buffer.from(await mRes.arrayBuffer()); // raw bytes → Node Buffer
            // Store small images inline so the dashboard can display them without Twilio auth
            if (buf.length <= 1024 * 1024) { // only ≤1MB (Twilio URLs expire; big files would bloat the DB)
              mediaDataUrl = `data:${mime};base64,${buf.toString('base64')}`; // embeddable <img src>
            }
            image = { mime, base64: buf.toString('base64') }; // AI vision input
            body = (Body || '') + ' [the customer sent a photo]'; // tell the AI a photo came with the text
          }
        } catch (e) {
          console.error('Media fetch failed:', e.message); // photo failed ≠ fail the whole message
        }
      }
    }

    const customerId = await saveMessage(business.id, From, ProfileName || null, body); // find-or-create the chat row
    await logMessage(customerId, 'in', body, mediaDataUrl); // store the inbound message

    // Conversation memory: recent history so follow-ups make sense
    const historyRows = await db.query(
      `SELECT direction, body FROM messages
       WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10`, // newest 10…
      [customerId]
    );
    const history = historyRows.rows.reverse(); // …reversed to oldest-first for the AI prompt

    // Subscription gate: paused if trial expired and not active
    if (isSubscriptionExpired(business)) { // (live version replaced this with free-tier replies)
      await sendWhatsAppReply(To, From,
        'This business is not accepting messages right now. Please check back soon!');
      return res.status(200).send('');
    }

    const result = await replyEngine.generateReply(body, business, image, history); // THE AI CALL

    if (result.reply) { // confident answer → send + clear any flag
      await sendWhatsAppReply(To, From, result.reply);
      await logMessage(customerId, 'out', result.reply); // store the outbound reply too
      await db.query(
        'UPDATE conversations SET last_reply = $1, needs_human = false, flag_reason = NULL, updated_at = now() WHERE id = $2',
        [result.reply, customerId]
      );
    } else if (result.needsHuman) { // unsure → flag for the owner + polite handoff
      await db.query(
        `UPDATE conversations
         SET needs_human = true, flag_reason = $1, updated_at = now()
         WHERE id = $2`,
        [result.reason || 'AI could not answer confidently', customerId]
      );
      const handoffMsg = 'Thanks for your message! A member of our team will get back to you shortly.';
      await sendWhatsAppReply(To, From, handoffMsg); // customer never left hanging
      await logMessage(customerId, 'out', handoffMsg);
      // Instant owner alert: clean summary of this order/inquiry
      await alertOwner(business, From, ProfileName, Body, result.reason);
    }

    res.status(200).send(''); // Twilio wants 200 + empty body (TwiML would also work)
  } catch (err) {
    console.error('Webhook error:', err); // log the crash…
    res.status(500).send(''); // …but still answer (500 makes Twilio retry later)
  }
}

/** 14-day trial then paid. Bot pauses when expired. (LEGACY logic.) */
function isSubscriptionExpired(business) {
  if (business.subscription_status === 'active') {
    return business.subscription_expires && new Date(business.subscription_expires) < new Date(); // expired timestamp?
  }
  if (business.subscription_status === 'trialing') {
    const started = new Date(business.trial_started_at || business.created_at); // trial clock start
    const trialDays = Number(process.env.TRIAL_DAYS || 14); // env override, default 14
    return (Date.now() - started.getTime()) > trialDays * 24 * 60 * 60 * 1000; // elapsed > trial window?
  }
  return true; // 'expired' / 'canceled'
}

async function logMessage(conversationId, direction, body, mediaUrl) {
  await db.query( // one row per message: 'in' (customer) or 'out' (bot)
    'INSERT INTO messages (conversation_id, direction, body, media_url) VALUES ($1, $2, $3, $4)',
    [conversationId, direction, body, mediaUrl || null]
  );
}

/** Push an instant order/inquiry summary to the owner's WhatsApp. */
async function alertOwner(business, customerNumber, customerName, message, reason) {
  if (!business.owner_number) return; // no owner number configured → can't alert
  const summary = // multi-line WhatsApp message built with + concatenation
    `NEW ORDER / INQUIRY — ${business.name}\n\n` +
    `Customer: ${customerName || 'Unknown'} (${customerNumber})\n` +
    `Message: "${message}"\n` +
    `Why you're needed: ${reason || 'AI could not answer'}\n\n` +
    `Reply to them directly on WhatsApp: ${customerNumber}`;
  await sendWhatsAppReply(process.env.TWILIO_WHATSAPP_NUMBER, business.owner_number, summary);
}

async function saveMessage(businessId, fromNumber, customerName, text) {
  const existing = await db.query( // find this customer's open chat row…
    'SELECT id FROM conversations WHERE business_id = $1 AND customer_number = $2',
    [businessId, fromNumber]
  );
  if (existing.rows.length > 0) { // …found → just refresh last message + timestamp
    const id = existing.rows[0].id;
    await db.query(
      `UPDATE conversations
       SET last_message = $1, updated_at = now() WHERE id = $2`,
      [text, id]
    );
    return id; // return the chat id for logging/history below
  }
  const inserted = await db.query( // …not found → create the chat row, RETURNING id gives it back
    `INSERT INTO conversations (business_id, customer_number, customer_name, last_message)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [businessId, fromNumber, customerName, text]
  );
  return inserted.rows[0].id;
}

async function sendWhatsAppReply(toBusinessNumber, toCustomer, message) {
  // MVP: send via Twilio REST API using fetch (no SDK dependency)
  const sid = process.env.TWILIO_ACCOUNT_SID; // from .env
  const token = process.env.TWILIO_AUTH_TOKEN; // from .env
  const from = process.env.TWILIO_WHATSAPP_NUMBER; // NOTE: legacy fn ignores toBusinessNumber, uses env sender
  if (!sid || !token || !from) {
    console.log('Twilio credentials not set; skipping outbound send. Reply was:', message); // dev mode: print
    return;
  }
  const params = new URLSearchParams({ From: from, To: toCustomer, Body: message }); // form-encode
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', // Twilio creates messages via POST
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), // Basic auth
      'Content-Type': 'application/x-www-form-urlencoded', // Twilio expects forms, not JSON
    },
    body: params,
  });
  if (!res.ok) {
    console.error('Twilio send failed:', res.status, await res.text()); // log Twilio's error text
  }
}

module.exports = { handleInbound }; // export for whoever requires this legacy file
