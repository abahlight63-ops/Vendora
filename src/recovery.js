// ── src/recovery.js ──────────────────────────────────────────────
// WHAT: "ComeBack" — win back customers who asked about buying but went quiet.
// Scheduled script (run hourly: npm run recovery:send). Finds chats where the
// customer showed BUYING intent, went silent 12h–7d ago, and sends ONE gentle
// nudge. Each chat is nudged at most ONCE (recovery_sent_at column guards it).
// MODULES: dotenv (.env), ./db (pool). Twilio via plain fetch (no SDK).
require('dotenv').config(); // load .env first
const db = require('./db'); // shared pool

/**
 * ComeBack — abandonment recovery.
 * Finds conversations where the customer showed buying intent (asked price/stock)
 * but went quiet for 12+ hours, and sends ONE gentle follow-up nudge.
 * Run hourly: npm run recovery:send
 * Each conversation is nudged at most once (recovery_sent_at guards it).
 */
async function sendRecovery() {
  // Find candidates: never nudged + quiet 12h–7d + message smells like buying intent.
  const { rows } = await db.query(
    `SELECT c.id, c.business_id, c.customer_number, c.customer_name, c.last_message,
            b.name AS business_name, b.owner_number, b.subscription_status
     FROM conversations c
     JOIN businesses b ON b.id = c.business_id -- need the shop name for the message
     WHERE c.recovery_sent_at IS NULL -- IS NULL = never nudged before (the once-only guard)
       AND c.updated_at < now() - interval '12 hours' -- quiet for at least 12h…
       AND c.updated_at > now() - interval '7 days' -- …but not older than 7 days (don't resurrect the dead)
       AND c.last_message ~* '(price|how much|cost|available|stock|deliver|order|buy|₦)' -- ~* = case-insensitive regex
     LIMIT 20` // safety cap: max 20 nudges per run (cost + spam control) -- this // is JS (outside the string), fine
  );

  if (rows.length === 0) { // nothing to do → log and quit
    console.log('No abandoned conversations to recover.');
    return;
  }

  let sent = 0; // counter for the summary log
  for (const c of rows) { // one at a time (Twilio rate limits + per-chat error isolation)
    const firstName = (c.customer_name || '').split(' ')[0] || 'there'; // "Adaeze Obi" → "Adaeze"; unknown → "there"
    const nudge = // the friendly follow-up text (personalized with their own words)
      `Hi ${firstName}! 👋 It's ${c.business_name}.\n\n` +
      `You asked us about: "${c.last_message.slice(0, 90)}"\n\n` + // .slice caps length at 90 chars
      `Just checking in — that offer is still available if you'd like to go ahead. ` +
      `Reply here and we'll sort you out right away!`;
    try {
      await sendNudge(c.owner_number && c.owner_number !== c.customer_number ? c.customer_number : c.customer_number, nudge, c.business_id);
      // (ternary above always yields customer_number — owner never nudges themselves)
      await db.query('UPDATE conversations SET recovery_sent_at = now() WHERE id = $1', [c.id]); // mark nudged AFTER success (failed sends retry next run)
      sent++; // only count actual sends
    } catch (e) {
      console.error(`Recovery send failed for conversation ${c.id}:`, e.message); // one failure ≠ abort the batch
    }
  }
  console.log(`ComeBack: sent ${sent}/${rows.length} recovery nudges.`); // run summary
}

// Low-level Twilio sender (same pattern as digest.js — fetch, Basic auth, form body).
async function sendNudge(toNumber, text, businessId) {
  const sid = process.env.TWILIO_ACCOUNT_SID; // from .env
  const token = process.env.TWILIO_AUTH_TOKEN; // from .env
  const from = process.env.TWILIO_WHATSAPP_NUMBER; // shop's WhatsApp sender
  if (!sid || !token || !from) {
    console.warn(`[dry-run] nudge for business ${businessId} to ${toNumber}:\n${text}\n`); // dev mode: print instead
    return;
  }
  const params = new URLSearchParams({ From: from, To: toNumber, Body: text }); // form-encode
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', // create a message
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), // Basic auth
      'Content-Type': 'application/x-www-form-urlencoded', // Twilio wants forms
    },
    body: params,
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`); // throw so caller can catch+log
}

// Run-as-script: `node src/recovery.js` sends; require()ing it just imports.
if (require.main === module) { // true only when this file is the entry point
  sendRecovery().catch((e) => {
    console.error(e);
    process.exit(1); // cron sees the failure via exit code
  });
}

module.exports = { sendRecovery }; // export for reuse/tests
