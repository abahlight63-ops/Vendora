// ── src/digest.js ────────────────────────────────────────────────
// WHAT: a scheduled script (NOT a web route). Once a day it WhatsApps every
// owner a summary of chats the AI flagged for humans. Run manually or by cron:
//   npm run digest:send          → daily flagged-chat summary
//   npm run digest:weekly        → weekly stats report (see bottom of file)
// HOW cron works: the HOST (Railway cron / GitHub Actions / Task Scheduler)
// runs the command on a schedule — Node just does the job and exits.
// MODULES: dotenv (.env), ./db (pool). Twilio via plain fetch (no SDK installed).
require('dotenv').config(); // load .env FIRST (db + Twilio creds live there)
const db = require('./db'); // shared Postgres pool

/**
 * Daily digest: send the business owner a summary of conversations
 * flagged for human follow-up, via WhatsApp.
 * Run with: npm run digest:send  (schedule with cron / Railway cron)
 */
async function sendDigest() {
  // Step 1: every business that CAN receive WhatsApp (has an owner number).
  const { rows: businesses } = await db.query(
    `SELECT id, name, owner_number FROM businesses
     WHERE owner_number IS NOT NULL AND owner_number <> ''` // IS NOT NULL + not empty
  );

  if (businesses.length === 0) { // nobody to notify → quit early (guard clause)
    console.log('No businesses with owner numbers configured.');
    return;
  }

  for (const biz of businesses) { // for...of + await = one business at a time (polite, avoids rate limits)
    // Step 2: this business's flagged chats from the last 24 hours.
    const { rows } = await db.query(
      `SELECT customer_name, customer_number, last_message, flag_reason
       FROM conversations
       WHERE business_id = $1 AND needs_human = true
          AND updated_at >= now() - interval '24 hours' -- Postgres date math: now minus 1 day
       ORDER BY updated_at DESC`, // newest first
      [biz.id] // $1 = safe parameter (never glue values into SQL — injection!)
    );

    if (rows.length === 0) continue; // nothing flagged → skip this business, no spam

    // Step 3: format "1. Name (number) — asked: "…" [reason]" lines.
    const lines = rows.map(
      (r, i) => // .map transforms each row; i = 0,1,2… for numbering
        `${i + 1}. ${r.customer_name || 'Unknown'} (${r.customer_number}) — asked: "${r.last_message}" [${r.flag_reason || 'flagged'}]`
    ); // backticks = template literal (embed ${variables} inside strings)
    const digest =
      `📋 Daily follow-up digest for ${biz.name}:\n\n${lines.join('\n')}\n\nPlease respond to these customers.`;
    await sendToOwner(biz.owner_number, digest); // Step 4: WhatsApp it to the owner
  }
  console.log('Daily digests sent to all business owners.');
}

/** Weekly analytics digest: per-business owner report. */
async function sendWeeklyDigest() {
  // Same owner list as daily.
  const { rows: businesses } = await db.query(
    `SELECT id, name, owner_number FROM businesses
     WHERE owner_number IS NOT NULL AND owner_number <> ''`
  );
  if (businesses.length === 0) {
    console.log('No businesses with owner numbers configured.');
    return;
  }

  for (const biz of businesses) {
    // Stat 1: conversations + how many needed a human (FILTER = conditional count).
    const totals = await db.query(
      `SELECT COUNT(*)::int AS convos,
              COUNT(*) FILTER (WHERE needs_human)::int AS flagged
       FROM conversations
       WHERE business_id = $1 AND updated_at >= now() - interval '7 days'`,
      [biz.id]
    ); // ::int casts Postgres bigint → regular int for clean JSON
    // Stat 2: inbound vs outbound message counts (JOIN links messages→conversations→business).
    const msgs = await db.query(
      `SELECT COUNT(*) FILTER (WHERE direction = 'in')::int AS inbound,
              COUNT(*) FILTER (WHERE direction = 'out')::int AS outbound
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id -- match each message to its chat
       WHERE c.business_id = $1 AND m.created_at >= now() - interval '7 days'`,
      [biz.id]
    );
    // Stat 3: what customers asked about (~* = case-insensitive regex match).
    const types = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE last_message ~* '(price|how much|cost|naira|₦| NGN)')::int AS price_q,
         COUNT(*) FILTER (WHERE last_message ~* '(available|stock|have|deliver)')::int AS stock_q,
         COUNT(*)::int AS total
       FROM conversations
       WHERE business_id = $1 AND updated_at >= now() - interval '7 days'`,
      [biz.id]
    );

    const t = totals.rows[0], m = msgs.rows[0], ty = types.rows[0]; // unpack the three results
    if (ty.total === 0) continue; // quiet week, nothing to report — don't spam

    // Build the pretty report with + string concatenation across lines.
    const digest =
      `WEEKLY REPORT — ${biz.name} (last 7 days)\n\n` +
      `Customer messages received: ${m.inbound}\n` +
      `AI replies sent: ${m.outbound}\n` +
      `Conversations: ${t.convos}\n\n` +
      `Message types:\n` +
      `   • Price questions: ${ty.price_q}\n` +
      `   • Stock/delivery questions: ${ty.stock_q}\n` +
      `   • Other: ${Math.max(0, ty.total - ty.price_q - ty.stock_q)}\n\n` + // Math.max avoids negative on overlaps
      `Flagged for you: ${t.flagged}\n\n` +
      (t.flagged > 0 ? 'Check flagged chats in your dashboard to close those sales!' : 'Great week — the AI handled everything confidently.'); // ternary = inline if/else

    await sendToOwner(biz.owner_number, digest); // send it
  }
  console.log('Weekly digests sent to all business owners.');
}

// Shared sender: Twilio REST API via fetch (we never installed the Twilio SDK).
async function sendToOwner(ownerNumber, text) {
  const sid = process.env.TWILIO_ACCOUNT_SID; // from .env
  const token = process.env.TWILIO_AUTH_TOKEN; // from .env
  const from = process.env.TWILIO_WHATSAPP_NUMBER; // your WhatsApp sender
  if (!sid || !token || !from) {
    console.warn('Twilio credentials not set; message printed instead:\n\n' + text); // dev mode: print, don't crash
    return;
  }
  const params = new URLSearchParams({ From: from, To: ownerNumber, Body: text }); // form-encode the fields
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', // Twilio creates a message = POST
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), // HTTP Basic auth: base64(sid:token)
      'Content-Type': 'application/x-www-form-urlencoded', // Twilio expects form data, not JSON
    },
    body: params, // the form fields
  });
  if (res.ok) console.log('Sent to', ownerNumber); // 2xx = delivered to Twilio
  else console.error('Failed to send:', res.status, await res.text()); // log the real Twilio error
}

// Run-as-script support: `node src/digest.js` executes; require()ing it doesn't.
// require.main === module is TRUE only when this file is the entry point.
if (require.main === module) {
  const weekly = process.argv.includes('--weekly'); // check CLI flags: did user pass --weekly?
  (weekly ? sendWeeklyDigest() : sendDigest()).catch((e) => { // pick which job, run it
    console.error(e); // print failure
    process.exit(1); // exit code 1 = cron sees the failure
  });
}

module.exports = { sendDigest, sendWeeklyDigest }; // export for tests/other code
