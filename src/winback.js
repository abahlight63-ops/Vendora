// ── src/winback.js ───────────────────────────────────────────────
// WHAT: inactivity nudge — emails quiet shops ("your customers are still
// messaging…") so they come back. Run on a schedule (Railway cron, GitHub
// Actions, or Task Scheduler): `npm run winback`.
// WHO: verified owners whose shop saw no chat activity for INACTIVITY_DAYS
// (default 14) and got no nudge in the last 30 days. Paying (active) shops
// are skipped — they get attention through support, not nudges.
// SAFETY: RESEND_API_KEY missing → dry-run (lists who WOULD be emailed).
// Run: npm run winback
require('dotenv').config(); // dotenv FIRST (all env below comes from .env!)
const db = require('./db'); // shared pool
const mail = require('./services/emailTemplates'); // branded inactive template

async function main() {
  const days = Number(process.env.INACTIVITY_DAYS || 14); // quiet threshold (env-tunable!)
  const { rows } = await db.query( // one row per quiet shop (oldest VERIFIED owner email each)…
    `SELECT b.id, b.name,
       (SELECT u.email FROM users u WHERE u.business_id = b.id AND u.verified = true ORDER BY u.id ASC LIMIT 1) AS email
     FROM businesses b
     WHERE (b.subscription_status IS DISTINCT FROM 'active') -- payers skipped (they hear from support, not nudges!)
       AND (b.winback_sent_at IS NULL OR b.winback_sent_at < now() - make_interval(days => 30)) -- max one nudge per 30 days
       AND COALESCE((SELECT MAX(c.updated_at) FROM conversations c WHERE c.business_id = b.id), b.created_at)
           < now() - make_interval(days => $1) -- last chat (or signup, if never) older than the threshold
     LIMIT 200`, // cap per run (Resend free tier = 100/day — never blow the quota in one go!)
    [days]
  );
  if (!process.env.RESEND_API_KEY) { // no key → dry-run (safe to schedule before email is set up!)
    console.log(`[winback dry-run] ${rows.length} quiet shop(s) (no RESEND_API_KEY, nothing sent):`);
    rows.forEach((r) => console.log(` - ${r.name} <${r.email || 'no verified email'}>`));
    process.exit(0);
  }
  let sent = 0;
  for (const r of rows) { // for...of (sequential sends — Resend rate-limits bursts!)
    if (!r.email) continue; // no verified inbox → skip (can't nudge what we can't reach!)
    try {
      const ok = await mail.sendInactiveEmail(r.email, r.name);
      if (ok) {
        await db.query('UPDATE businesses SET winback_sent_at = now() WHERE id = $1', [r.id]); // stamp AFTER success (failures retry next run!)
        sent++;
      }
    } catch (e) { console.error(`winback ${r.email} error:`, e.message); } // one bad row never stops the run
  }
  console.log(`[winback] sent ${sent}/${rows.length} nudge(s).`);
  process.exit(0);
}

main().catch((e) => { console.error('winback fatal:', e.message); process.exit(1); }); // non-zero exit = scheduler shows red (visible failure!)
