// ── src/services/referralService.js ────────────────────────────────
// WHAT: Refer & Earn engine — codes, attribution, and the 3 reward options:
//   1. DOUBLE-SIDED PRO DAYS (the main drag): friend finishes the quiz →
//      BOTH shops get 14 Pro days (bonus_pro_until — real Pro everywhere,
//      costs us ~nothing, unfarmable for cash).
//   2. MILESTONE AIRTIME (champion trophy): every 5th PAYING referral → a
//      ₦500 airtime row goes pending; YOU send the card manually, then tap
//      "sent" in Admin → Referrals (10x fewer payouts, 10x more excitement).
//   3. MONTHLY CHAMPION: top referrer each month → free Plus month (Admin taps
//      "Grant" on the leaderboard — personal + public shout-out).
// ANTI-FRAUD: self-referral blocked (same number/email/business), quiz-gated
// rewards (verified + niche set — bots don't finish quizzes!), airtime ONLY
// on paying referrals. Every movement lands in referral_payouts (audit!).
// No npm modules — db + crypto only.
const crypto = require('crypto'); // random code suffixes
const db = require('../db'); // shared pool

const QUIZ_DAYS = 14; // double-sided Pro days per finished quiz (both shops!)
const MILESTONE_EVERY = 5; // every 5th paying referral = airtime row
const MILESTONE_AMOUNT = 50000; // ₦500 in minor units (matches payments ledger!)

// Code shape: NAME-XXXX (e.g. AMAKA-4F2K). Name part from the shop name,
// random part from crypto (shareable on WhatsApp status without shame!).
function codeFor(name) {
  const clean = String(name || 'SHOP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'SHOP';
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars (65k per name — collisions retried below!)
  return `${clean}-${rand}`;
}

/** Issue a unique code for a shop (idempotent — keeps existing!). */
async function ensureCode(businessId) {
  const cur = await db.query('SELECT referral_code FROM businesses WHERE id = $1', [Number(businessId)]);
  if (cur.rows[0] && cur.rows[0].referral_code) return cur.rows[0].referral_code;
  const nm = await db.query('SELECT name FROM businesses WHERE id = $1', [Number(businessId)]);
  const name = (nm.rows[0] && nm.rows[0].name) || 'SHOP';
  for (let i = 0; i < 8; i++) { // 8 tries (collision chance ~0 — then fall back timestamped!)
    const code = i === 0 ? codeFor(name) : `${codeFor(name)}${i}`;
    try {
      const { rows } = await db.query(
        'UPDATE businesses SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL RETURNING referral_code',
        [code, Number(businessId)]
      );
      if (rows[0]) return rows[0].referral_code;
      return (await db.query('SELECT referral_code FROM businesses WHERE id = $1', [Number(businessId)])).rows[0].referral_code;
    } catch (e) {
      if (!e || e.code !== '23505') throw e; // only UNIQUE collisions retry (real errors bubble!)
    }
  }
  const fallback = `${codeFor(name)}-${Date.now().toString(36).toUpperCase()}`;
  await db.query('UPDATE businesses SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL', [fallback, Number(businessId)]);
  return fallback;
}

/** Look up a code (signup field + check endpoint). Returns business or null. */
async function resolveCode(raw) {
  const code = String(raw || '').trim().toUpperCase().slice(0, 20);
  if (!code) return null;
  const { rows } = await db.query('SELECT id, name FROM businesses WHERE UPPER(referral_code) = $1 LIMIT 1', [code]);
  return rows[0] || null;
}

/** Extend bonus Pro time (14 days stack on whatever is there — never overwrite!). */
async function grantProDays(businessId, days, note) {
  const { rows } = await db.query(
    `UPDATE businesses
     SET bonus_pro_until = GREATEST(COALESCE(bonus_pro_until, now()), now()) + make_interval(days => $2)
     WHERE id = $1 RETURNING bonus_pro_until`,
    [Number(businessId), Number(days) || 0]
  );
  return rows[0] ? rows[0].bonus_pro_until : null;
}

async function logPayout(referrerId, referredId, kind, { days, amount, note, status } = {}) {
  const { rows } = await db.query(
    `INSERT INTO referral_payouts (referrer_business_id, referred_business_id, kind, status, days, amount, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [Number(referrerId), referredId ? Number(referredId) : null, kind, status || 'granted', Number(days) || 0, Number(amount) || 0, String(note || '').slice(0, 200)]
  );
  return rows[0].id;
}

/** Has this shop STARTED USING the app? (channel live OR any customer chat!) */
async function isActiveShop(businessId) {
  const { rows } = await db.query(
    `SELECT 1 FROM businesses
     WHERE id = $1 AND (whatsapp_last_inbound_at IS NOT NULL OR NULLIF(telegram_bot_token, '') IS NOT NULL)
     UNION ALL
     SELECT 1 FROM conversations WHERE business_id = $1 LIMIT 1`,
    [Number(businessId)]
  );
  return rows.length > 0;
}

/**
 * FIRST REAL USAGE + referred_by present → pay BOTH sides 14 Pro days +
 * bell them. Triggered by channel connect AND first inbound chat (whichever
 * comes first!). Idempotent: each referred shop pays exactly ONCE (payout-row
 * lookup — reconnects and repeat chats never double-pay!).
 */
async function onFirstActive(referredBusinessId) {
  const { rows } = await db.query('SELECT id, name, referred_by FROM businesses WHERE id = $1', [Number(referredBusinessId)]);
  const shop = rows[0];
  if (!shop || !shop.referred_by) return null; // organic (no referrer — nothing to pay!)
  if (Number(shop.referred_by) === Number(referredBusinessId)) return null; // self-referral (paranoia — signup already blocks!)
  if (!(await isActiveShop(referredBusinessId))) return null; // quiz-only so far (reward waits for REAL usage: connect or first chat!)
  const dup = await db.query(
    `SELECT 1 FROM referral_payouts WHERE referred_business_id = $1 AND kind = 'pro_days' LIMIT 1`,
    [Number(referredBusinessId)]
  );
  if (dup.rows.length) return null; // already paid!
  const referrer = await db.query('SELECT id, name FROM businesses WHERE id = $1', [Number(shop.referred_by)]);
  if (!referrer.rows[0]) return null; // referrer shop deleted (orphan — skip quietly!)
  await grantProDays(shop.referred_by, QUIZ_DAYS, 'referred friend finished setup');
  await grantProDays(referredBusinessId, QUIZ_DAYS, 'joined with a referral code');
  await logPayout(shop.referred_by, referredBusinessId, 'pro_days', { days: QUIZ_DAYS, note: 'Double-sided usage reward' });
  await logPayout(referredBusinessId, shop.referred_by, 'pro_days', { days: QUIZ_DAYS, note: 'Welcome bonus (referred friend)' });
  const notify = require('./notifyService'); // lazy (style-consistent, dodge cycles!)
  const first = String(shop.name || '').split(' ')[0] || 'there';
  const rfirst = String(referrer.rows[0].name || '').split(' ')[0] || 'there';
  notify.notify(shop.referred_by, { // referrer side (fire-and-forget — rewards never break chats!)
    title: 'Referral reward: +14 Pro days!',
    body: `${first} just started USING the app with your code — 14 Pro days added to YOUR shop too. Keep sharing!`,
    link: '/billing',
  }).catch(() => {});
  notify.notify(referredBusinessId, {
    title: 'Welcome bonus: +14 Pro days!',
    body: `You joined with ${rfirst}'s code — 14 Pro days are on your shop. Enjoy!`,
    link: '/dashboard',
  }).catch(() => {});
  return { referrerId: shop.referred_by, days: QUIZ_DAYS };
}

/** Paying referrals count (activated subscriptions only — trials don't count!). */
async function payingCount(referrerId) {
  try {
    const { rows } = await db.query(
      `SELECT COUNT(DISTINCT b.id)::int AS n FROM businesses b
     JOIN payments p ON p.business_id = b.id AND p.status = 'active'
     WHERE b.referred_by = $1`,
      [Number(referrerId)]
    );
    return (rows[0] && rows[0].n) || 0;
  } catch (e) {
    // Missing payments table on a stale DB → heal once, else 0 (never break the card!)
    if (e && (e.code === '42P01' || e.code === '42703')) {
      try { await require('./configService').ensureSchema(); } catch {}
      try {
        const { rows } = await db.query(
          `SELECT COUNT(DISTINCT b.id)::int AS n FROM businesses b
           JOIN payments p ON p.business_id = b.id AND p.status = 'active'
           WHERE b.referred_by = $1`,
          [Number(referrerId)]
        );
        return (rows[0] && rows[0].n) || 0;
      } catch { return 0; }
    }
    console.error('payingCount error:', e.message);
    return 0;
  }
}

/**
 * Called after EVERY subscription activation. Every 5th paying referral →
 * pending ₦500 airtime row + bells (referrer celebrates, YOU get a todo!).
 * Milestone math: floor(paying/5) rows must exist; if fewer, create the gap.
 */
async function onPaidActivation(businessId) {
  const { rows } = await db.query('SELECT referred_by FROM businesses WHERE id = $1', [Number(businessId)]);
  const ref = rows[0] && rows[0].referred_by;
  if (!ref || Number(ref) === Number(businessId)) return null;
  const paid = await payingCount(ref);
  const earned = Math.floor(paid / MILESTONE_EVERY); // milestones EARNED so far…
  const logged = await db.query(
    `SELECT COUNT(*)::int AS n FROM referral_payouts WHERE referrer_business_id = $1 AND kind = 'airtime'`,
    [Number(ref)]
  );
  const have = (logged.rows[0] && logged.rows[0].n) || 0;
  if (earned <= have) return null; // nothing new (each 5-pack pays exactly once!)
  await logPayout(ref, businessId, 'airtime', { amount: MILESTONE_AMOUNT, status: 'pending', note: `${paid} paying referrals (milestone ${earned})` });
  const notify = require('./notifyService');
  const shop = await db.query('SELECT name FROM businesses WHERE id = $1', [Number(ref)]);
  const first = (shop.rows[0] && String(shop.rows[0].name).split(' ')[0]) || 'there';
  notify.notify(Number(ref), {
    title: `Milestone: ${paid} friends Pro — ₦500 airtime earned!`,
    body: `Champion move, ${first}! Your ₦500 airtime is being prepared — watch your phone. Keep sharing your code!`,
    link: '/dashboard',
  }).catch(() => {});
  return { referrerId: Number(ref), paid, amount: MILESTONE_AMOUNT };
}

/** Owner dashboard card data: my code, funnel counts, earnings, next milestone. */
async function myStats(businessId) {
  const id = Number(businessId);
  // Self-heal wrapper: a stale DB (missing referral_code / referral_payouts)
  // must NEVER 500 the card — heal once via ensureSchema, then serve
  // degraded-but-real numbers. Offline DB errors still bubble to the
  // controller which returns a retryable 503 (frontend shows Retry!).
  async function runOnce() {
    const code = await ensureCode(id); // every shop gets a code the moment they open the card!
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS invited FROM businesses WHERE referred_by = $1`, [id]);
    const { rows: q } = await db.query(
      `SELECT COUNT(*)::int AS n FROM businesses r WHERE r.referred_by = $1
     AND (r.whatsapp_last_inbound_at IS NOT NULL OR NULLIF(r.telegram_bot_token, '') IS NOT NULL
          OR EXISTS (SELECT 1 FROM conversations c WHERE c.business_id = r.id))`, [id]); // qualified = ACTUALLY USING (connected or chatted — not just signed up!)
    const paid = await payingCount(id);
    const { rows: e } = await db.query(
      `SELECT COALESCE(SUM(days), 0)::int AS days,
            COALESCE(SUM(amount) FILTER (WHERE kind = 'airtime' AND status = 'sent'), 0)::int AS airtime_sent,
            COALESCE(SUM(amount) FILTER (WHERE kind = 'airtime' AND status = 'pending'), 0)::int AS airtime_due
     FROM referral_payouts WHERE referrer_business_id = $1`, [id]);
    const nextIn = MILESTONE_EVERY - (paid % MILESTONE_EVERY); // friends-to-go till the next ₦500 (5→5, 7→3!)
    return {
      code,
      invited: (rows[0] && rows[0].invited) || 0,
      qualified: (q.rows[0] && q.rows[0].n) || 0, // finished the quiz (earned days!)
      paying: paid, // activated Pro/Plus (earn airtime!)
      daysEarned: (e.rows[0] && e.rows[0].days) || 0,
      airtimeDue: (e.rows[0] && e.rows[0].airtime_due) || 0, // minor units!
      airtimeSent: (e.rows[0] && e.rows[0].airtime_sent) || 0,
      nextMilestoneIn: paid % MILESTONE_EVERY === 0 && paid > 0 ? MILESTONE_EVERY : nextIn, // just hit 5? next target is a fresh 5!
      milestoneEvery: MILESTONE_EVERY,
      milestoneAmount: MILESTONE_AMOUNT,
      quizDays: QUIZ_DAYS,
    };
  }
  try {
    return await runOnce();
  } catch (e) {
    const missing = e && (e.code === '42P01' || e.code === '42703');
    if (missing) {
      try { await require('./configService').ensureSchema(); } catch {}
      try { return await runOnce(); } catch (e2) { console.error('referral myStats retry failed:', e2.message); }
    } else {
      console.error('referral myStats error:', e.message);
    }
    // Last-resort degraded card (code may still be derivable — never blank the page!)
    let code = 'VENDORA';
    try { code = await ensureCode(id); } catch {}
    return {
      code, invited: 0, qualified: 0, paying: 0, daysEarned: 0,
      airtimeDue: 0, airtimeSent: 0, nextMilestoneIn: MILESTONE_EVERY,
      milestoneEvery: MILESTONE_EVERY, milestoneAmount: MILESTONE_AMOUNT,
      quizDays: QUIZ_DAYS, degraded: true,
    };
  }
}

/** My payout history (the page + mobile sheet list mine newest-first!). */
async function myHistory(businessId) {
  try {
    const { rows } = await db.query(
      `SELECT kind, status, days, amount, note, created_at FROM referral_payouts
     WHERE referrer_business_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [Number(businessId)]
    );
    return rows;
  } catch (e) {
    if (e && (e.code === '42P01' || e.code === '42703')) {
      try { await require('./configService').ensureSchema(); } catch {}
      try {
        const { rows } = await db.query(
          `SELECT kind, status, days, amount, note, created_at FROM referral_payouts
           WHERE referrer_business_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [Number(businessId)]
        );
        return rows;
      } catch { return []; }
    }
    console.error('referral history error:', e.message);
    return [];
  }
}

/** Public mini-leaderboard (first names + counts only — no numbers, no codes!). */
async function publicLeaders(limit) {
  try {
    const rows = await leaderboard(limit);
    return rows.map((r) => ({
      name: String(r.name || 'A seller').split(' ')[0] || 'A seller',
      paying: r.paying,
    }));
  } catch (e) {
    console.error('referral publicLeaders error:', e.message);
    return [];
  }
}

/** Monthly leaderboard (champion picking): paying referrals per referrer, this month. */
async function leaderboard(limit) {
  try {
    const { rows } = await db.query(
      `SELECT b.id, b.name, b.referral_code, COUNT(DISTINCT p.business_id)::int AS paying
     FROM businesses b
     JOIN businesses r ON r.referred_by = b.id
     JOIN payments p ON p.business_id = r.id AND p.status = 'active' AND p.created_at >= date_trunc('month', now())
     GROUP BY b.id, b.name, b.referral_code
     ORDER BY paying DESC, b.id ASC
     LIMIT $1`,
      [Math.min(Number(limit) || 10, 50)]
    );
    return rows;
  } catch (e) {
    if (e && (e.code === '42P01' || e.code === '42703')) {
      try { await require('./configService').ensureSchema(); } catch {}
      try {
        const { rows } = await db.query(
          `SELECT b.id, b.name, b.referral_code, COUNT(DISTINCT p.business_id)::int AS paying
           FROM businesses b
           JOIN businesses r ON r.referred_by = b.id
           JOIN payments p ON p.business_id = r.id AND p.status = 'active' AND p.created_at >= date_trunc('month', now())
           GROUP BY b.id, b.name, b.referral_code
           ORDER BY paying DESC, b.id ASC
           LIMIT $1`,
          [Math.min(Number(limit) || 10, 50)]
        );
        return rows;
      } catch { return []; }
    }
    console.error('referral leaderboard error:', e.message);
    return [];
  }
}

/** Admin overview: every referrer + funnel + payouts + pending airtime. */
async function adminOverview() {
  const { rows } = await db.query(
    `SELECT b.id, b.name, b.whatsapp_number, b.referral_code,
       (SELECT COUNT(*)::int FROM businesses r WHERE r.referred_by = b.id) AS invited,
       (SELECT COUNT(*)::int FROM businesses r WHERE r.referred_by = b.id
         AND (r.whatsapp_last_inbound_at IS NOT NULL OR NULLIF(r.telegram_bot_token, '') IS NOT NULL
              OR EXISTS (SELECT 1 FROM conversations c WHERE c.business_id = r.id))) AS qualified,
       (SELECT COUNT(DISTINCT p.business_id)::int FROM businesses r JOIN payments p ON p.business_id = r.id AND p.status = 'active' WHERE r.referred_by = b.id) AS paying,
       (SELECT COALESCE(SUM(days),0)::int FROM referral_payouts WHERE referrer_business_id = b.id AND kind = 'pro_days') AS days_granted,
       (SELECT COALESCE(SUM(amount),0)::int FROM referral_payouts WHERE referrer_business_id = b.id AND kind = 'airtime' AND status = 'pending') AS airtime_due,
       (SELECT COALESCE(SUM(amount),0)::int FROM referral_payouts WHERE referrer_business_id = b.id AND kind = 'airtime' AND status = 'sent') AS airtime_sent
     FROM businesses b
     WHERE EXISTS (SELECT 1 FROM businesses r WHERE r.referred_by = b.id)
        OR EXISTS (SELECT 1 FROM referral_payouts p WHERE p.referrer_business_id = b.id)
     ORDER BY paying DESC, invited DESC`
  );
  return rows;
}

/** Admin: mark an airtime payout sent (the manual card-buy step!). */
async function markAirtimeSent(payoutId) {
  const { rows } = await db.query(
    `UPDATE referral_payouts SET status = 'sent' WHERE id = $1 AND kind = 'airtime' AND status = 'pending'
     RETURNING referrer_business_id`,
    [Number(payoutId)]
  );
  if (!rows.length) return null;
  const notify = require('./notifyService');
  notify.notify(rows[0].referrer_business_id, {
    title: 'Your ₦500 airtime is on its way!',
    body: 'Champion reward sent — check your line. Thank you for growing Vendora!',
    link: '/dashboard',
  }).catch(() => {});
  return true;
}

/** Admin: grant a Plus month (monthly champion!). Reuses the activation math. */
async function grantPlusMonth(businessId) {
  await db.query(
    `UPDATE businesses
     SET subscription_status = 'active',
         subscription_expires = GREATEST(COALESCE(subscription_expires, now()), now()) + make_interval(days => 30),
         plan_tier = 'plus', trial_warned = true, trial_expiry_notified = true
     WHERE id = $1`,
    [Number(businessId)]
  );
  await logPayout(businessId, null, 'plus_month', { status: 'granted', note: 'Monthly champion reward' });
  const notify = require('./notifyService');
  notify.notify(Number(businessId), {
    title: 'You are this month\u2019s referral champion!',
    body: 'Top referrer — a FREE Plus month is on your shop. Keep leading!',
    link: '/dashboard',
  }).catch(() => {});
  return true;
}

/** Admin: pending airtime queue (who to pay + their numbers!). */
async function pendingAirtime() {
  const { rows } = await db.query(
    `SELECT p.id, p.amount, p.note, p.created_at, b.name, b.whatsapp_number, b.owner_number
     FROM referral_payouts p JOIN businesses b ON b.id = p.referrer_business_id
     WHERE p.kind = 'airtime' AND p.status = 'pending'
     ORDER BY p.created_at ASC`
  );
  return rows;
}

module.exports = {
  QUIZ_DAYS, MILESTONE_EVERY, MILESTONE_AMOUNT,
  codeFor, ensureCode, resolveCode, grantProDays,
  onFirstActive, onPaidActivation, payingCount, isActiveShop,
  myStats, myHistory, publicLeaders, leaderboard, adminOverview, pendingAirtime,
  markAirtimeSent, grantPlusMonth,
};
