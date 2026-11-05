// ── src/services/adminConsole.js ──────────────────────────────────
// WHAT: the numbers and actions behind the new admin console (Overview, Shops,
// Growth, AI and costs, Activity log). Real data only; anything estimated says so.
const db = require('../db');
const planService = require('./planService');
const { TODAY_START } = require('../utils/lagosDay');

const n = (v) => Number(v) || 0;
const COST_PER_REPLY_USD = Number(process.env.EST_COST_PER_REPLY_USD || 0.0004); // from the Nov 2026 model test
const NAIRA_PER_USD = Number(process.env.EST_NAIRA_PER_USD || 1600);

async function overview(days = 7) {
  const d = Math.min(90, Math.max(1, Number(days) || 7));
  const since = `now() - interval '${d} days'`;
  const [shops, active, money, replies, todo, plans, funnel, signups, channels, orders, voice] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at >= ${since})::int AS new FROM businesses`),
    db.query(`SELECT COUNT(DISTINCT c.business_id)::int AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.created_at >= ${since} AND m.direction = 'in'`),
    db.query(`SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'active' AND currency = 'NGN' AND created_at >= date_trunc('month', now())), 0)::bigint AS month,
                     COALESCE(SUM(amount) FILTER (WHERE status = 'active' AND currency = 'NGN' AND created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now())), 0)::bigint AS last_month
                FROM payments`),
    db.query(`SELECT COUNT(*) FILTER (WHERE m.sender = 'bot')::int AS bot, COUNT(*) FILTER (WHERE m.sender = 'owner')::int AS owner
                FROM messages m WHERE m.created_at >= ${TODAY_START} AND m.direction = 'out'`),
    db.query(`SELECT (SELECT COUNT(*) FROM payments WHERE status = 'pending')::int AS transfers,
                     (SELECT COUNT(*) FROM complaints WHERE status = 'open')::int AS complaints,
                     (SELECT COUNT(*) FROM referral_payouts WHERE kind = 'airtime' AND status = 'pending')::int AS airtime,
                     (SELECT COUNT(*) FROM conversations WHERE needs_human)::int AS needs_owner,
                     (SELECT COUNT(DISTINCT business_id) FROM conversations WHERE needs_human)::int AS needs_owner_shops`),
    db.query('SELECT plan_tier, subscription_status, subscription_expires, trial_started_at, created_at, bonus_pro_until FROM businesses'),
    db.query(`SELECT COUNT(*)::int AS signed_up,
                     COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM products p WHERE p.business_id = b.id))::int AS products,
                     COUNT(*) FILTER (WHERE b.meta_phone_number_id <> '' OR b.telegram_bot_token <> '' OR b.telegram_shared_on)::int AS connected,
                     COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM payments p WHERE p.business_id = b.id AND p.status = 'active'))::int AS paid
                FROM businesses b WHERE b.created_at >= date_trunc('month', now())`),
    db.query(`SELECT to_char((created_at AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
                FROM businesses WHERE created_at >= now() - interval '14 days' GROUP BY 1 ORDER BY 1`),
    db.query(`SELECT COUNT(*) FILTER (WHERE meta_phone_number_id <> '')::int AS whatsapp,
                     COUNT(*) FILTER (WHERE telegram_bot_token <> '' OR telegram_shared_on)::int AS telegram FROM businesses`),
    db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total) FILTER (WHERE status IN ('paid', 'delivered')), 0) AS value FROM orders WHERE created_at >= ${since}`),
    db.query(`SELECT COUNT(*)::int AS n FROM messages WHERE created_at >= ${TODAY_START} AND direction = 'in' AND body LIKE 'Voice note:%'`),
  ]);
  const tally = { free: 0, pro: 0, plus: 0, trial: 0 };
  for (const b of plans.rows) {
    if (planService.trialActive && planService.trialActive(b) && b.subscription_status !== 'active') tally.trial++;
    else tally[planService.effectiveTier(b)] = (tally[planService.effectiveTier(b)] || 0) + 1;
  }
  const trialsEnded = plans.rows.filter((b) => b.subscription_status !== 'trialing' || !planService.trialActive || !planService.trialActive(b)).length;
  const bot = n(replies.rows[0].bot);
  const days14 = [];
  const byDay = Object.fromEntries(signups.rows.map((r) => [r.day, r.n]));
  for (let i = 13; i >= 0; i--) { const x = new Date(Date.now() - i * 864e5); const k = x.toISOString().slice(0, 10); days14.push({ day: k, n: byDay[k] || 0 }); }
  return {
    days: d,
    shops: { total: shops.rows[0].total, new: shops.rows[0].new, active: active.rows[0].n },
    paying: { total: tally.pro + tally.plus, plus: tally.pro, pro: tally.plus },
    plans: { free: tally.free, plus: tally.pro, pro: tally.plus, trial: tally.trial },
    trialToPaid: { paid: funnel.rows[0].paid, ended: trialsEnded },
    money: { month: n(money.rows[0].month) / 100, lastMonth: n(money.rows[0].last_month) / 100 },
    replies: { bot, owner: n(replies.rows[0].owner) },
    aiCost: { usd: Math.round(bot * COST_PER_REPLY_USD * 100) / 100, naira: Math.round(bot * COST_PER_REPLY_USD * NAIRA_PER_USD), perReplyUsd: COST_PER_REPLY_USD, estimated: true },
    voiceToday: voice.rows[0].n,
    orders: { n: orders.rows[0].n, value: n(orders.rows[0].value) },
    todo: todo.rows[0],
    funnel: funnel.rows[0],
    signups: days14,
    channels: channels.rows[0],
  };
}

const LIMIT = (b) => planService.whatsappDailyLimit(b);
async function shops({ filter = 'all', q = '' } = {}) {
  const { rows } = await db.query(
    `SELECT b.id, b.name, b.plan_tier, b.subscription_status, b.subscription_expires, b.trial_started_at, b.created_at, b.bonus_pro_until,
            b.meta_phone_number_id <> '' AS wa, (b.telegram_bot_token <> '' OR b.telegram_shared_on) AS tg, b.bot_enabled,
            (SELECT email FROM users u WHERE u.business_id = b.id ORDER BY u.id LIMIT 1) AS email,
            (SELECT MAX(m.created_at) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.business_id = b.id AND m.direction = 'in') AS last_in,
            (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.business_id = b.id AND m.sender = 'bot' AND m.created_at >= ${TODAY_START})::int AS bot_today
       FROM businesses b ORDER BY b.created_at DESC LIMIT 1000`
  );
  const needle = String(q || '').trim().toLowerCase();
  const out = rows.map((b) => {
    const tier = planService.effectiveTier(b);
    const trial = planService.trialActive ? planService.trialActive(b) && b.subscription_status !== 'active' : false;
    const limit = LIMIT(b);
    const quietDays = b.last_in ? Math.floor((Date.now() - new Date(b.last_in)) / 864e5) : null;
    let status = 'ok';
    if (!b.wa && !b.tg) status = 'no_channel';
    else if (Number.isFinite(limit) && b.bot_today >= limit * 0.8) status = 'near';
    else if (quietDays == null || quietDays >= 7) status = 'quiet';
    return { id: b.id, name: b.name, email: b.email, plan: trial ? 'trial' : tier, wa: b.wa, tg: b.tg, botOn: b.bot_enabled !== false, lastIn: b.last_in, botToday: b.bot_today, limit: Number.isFinite(limit) ? limit : null, status, quietDays, createdAt: b.created_at };
  }).filter((s) => !needle || [s.name, s.email, String(s.id)].join(' ').toLowerCase().includes(needle));
  const counts = { all: out.length, paying: out.filter((s) => s.plan === 'pro' || s.plan === 'plus').length, trial: out.filter((s) => s.plan === 'trial').length, no_channel: out.filter((s) => s.status === 'no_channel').length, near: out.filter((s) => s.status === 'near').length, quiet: out.filter((s) => s.status === 'quiet').length };
  const pick = { paying: (s) => s.plan === 'pro' || s.plan === 'plus', trial: (s) => s.plan === 'trial', no_channel: (s) => s.status === 'no_channel', near: (s) => s.status === 'near', quiet: (s) => s.status === 'quiet' }[filter];
  return { counts, shops: (pick ? out.filter(pick) : out).slice(0, 300) };
}

async function shop(id) {
  const bid = Number(id);
  const { rows: [b] } = await db.query('SELECT * FROM businesses WHERE id = $1', [bid]);
  if (!b) return null;
  const [user, stats, orders, payments, recent] = await Promise.all([
    db.query('SELECT id, email, verified, created_at FROM users WHERE business_id = $1 ORDER BY id LIMIT 1', [bid]),
    db.query(`SELECT COUNT(DISTINCT c.id)::int AS customers,
                     COUNT(*) FILTER (WHERE m.sender = 'bot' AND m.created_at >= now() - interval '7 days')::int AS bot7,
                     COUNT(*) FILTER (WHERE m.direction = 'out' AND m.created_at >= now() - interval '7 days')::int AS out7
                FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id WHERE c.business_id = $1`, [bid]),
    db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total) FILTER (WHERE status IN ('paid', 'delivered')), 0) AS value FROM orders WHERE business_id = $1`, [bid]),
    db.query('SELECT plan, currency, amount, method, status, created_at FROM payments WHERE business_id = $1 ORDER BY created_at DESC LIMIT 5', [bid]),
    db.query(`SELECT action, detail, created_at FROM admin_audit WHERE target_business_id = $1 ORDER BY created_at DESC LIMIT 6`, [bid]),
  ]);
  const s = stats.rows[0];
  const tier = planService.effectiveTier(b);
  return {
    id: b.id, name: b.name, niche: b.business_niche, createdAt: b.created_at, ownerNumber: b.owner_number ? String(b.owner_number).replace(/(\d{4})\d+(\d{4})$/, '$1 *** $2') : '',
    user: user.rows[0] || null, plan: tier, subscription: { status: b.subscription_status, expires: b.subscription_expires, bonusUntil: b.bonus_pro_until },
    botOn: b.bot_enabled !== false, model: b.whatsapp_model,
    channels: { whatsapp: !!b.meta_phone_number_id, whatsappVia: b.meta_connect_via || '', telegram: !!(b.telegram_bot_token || b.telegram_shared_on) },
    customers: s.customers, veloShare: s.out7 ? Math.round((s.bot7 / s.out7) * 100) : null,
    orders: { n: orders.rows[0].n, value: n(orders.rows[0].value) },
    payments: payments.rows, activity: recent.rows,
  };
}

// Admin actions on one shop. Every call is written to the activity log by the route.
async function action(id, body = {}) {
  const bid = Number(id);
  const a = String(body.action || '');
  const err = (s, m) => Object.assign(new Error(m), { status: s });
  if (a === 'plan') {
    const plan = String(body.plan || '');
    const months = Math.min(12, Math.max(1, Number(body.months) || 1));
    if (plan === 'free') { await db.query("UPDATE businesses SET subscription_status = 'expired', subscription_expires = now(), bonus_pro_until = NULL, trial_started_at = LEAST(trial_started_at, now() - interval '60 days') WHERE id = $1", [bid]); return 'Moved to Free.'; }
    if (!['pro', 'plus'].includes(plan)) throw err(400, 'Choose Free, Plus or Pro.');
    await db.query(`UPDATE businesses SET plan_tier = $2, subscription_status = 'active', subscription_expires = GREATEST(COALESCE(subscription_expires, now()), now()) + ($3 || ' months')::interval WHERE id = $1`, [bid, plan, String(months)]);
    return `Set to ${plan === 'pro' ? 'Plus' : 'Pro'} for ${months} month${months > 1 ? 's' : ''}.`;
  }
  if (a === 'days') {
    const days = Math.min(90, Math.max(1, Number(body.days) || 7));
    await db.query("UPDATE businesses SET bonus_pro_until = GREATEST(COALESCE(bonus_pro_until, now()), now()) + ($2 || ' days')::interval WHERE id = $1", [bid, String(days)]);
    return `Added ${days} free Pro days.`;
  }
  if (a === 'pause' || a === 'resume') { await db.query('UPDATE businesses SET bot_enabled = $2 WHERE id = $1', [bid, a === 'resume']); return a === 'pause' ? 'Velo paused for this shop.' : 'Velo answering again.'; }
  if (a === 'verify') { await db.query('UPDATE users SET verified = true WHERE business_id = $1', [bid]); return 'Email marked as verified.'; }
  if (a === 'notice') {
    const title = String(body.title || '').trim().slice(0, 120); const msg = String(body.body || '').trim().slice(0, 1000);
    if (!title) throw err(400, 'Give the notice a title.');
    await require('./notifyService').notify(bid, { title, body: msg, link: '/notifications' });
    return 'Notice sent to the shop.';
  }
  if (a === 'delete') {
    const { rows } = await db.query('SELECT name FROM businesses WHERE id = $1', [bid]);
    if (!rows.length) throw err(404, 'Shop not found.');
    if (String(body.confirmName || '').trim() !== rows[0].name) throw err(400, 'Type the shop name exactly to delete it.');
    await db.query('DELETE FROM businesses WHERE id = $1', [bid]);
    return 'Shop deleted.';
  }
  throw err(400, 'Unknown action.');
}

async function waitlist() {
  const { rows } = await db.query('SELECT email, created_at FROM launch_waitlist ORDER BY created_at DESC LIMIT 500');
  return rows;
}
async function aiUsage(days = 7) {
  const d = Math.min(90, Math.max(1, Number(days) || 7));
  const [byDay, byModel] = await Promise.all([
    db.query(`SELECT to_char((m.created_at AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS replies
                FROM messages m WHERE m.sender = 'bot' AND m.created_at >= now() - ($1 || ' days')::interval GROUP BY 1 ORDER BY 1`, [String(d)]),
    db.query(`SELECT model_id, SUM(count)::int AS n FROM model_usage WHERE day >= CURRENT_DATE - $1::int GROUP BY 1 ORDER BY 2 DESC`, [d]),
  ]);
  return { days: d, perReplyUsd: COST_PER_REPLY_USD, nairaPerUsd: NAIRA_PER_USD, byDay: byDay.rows.map((r) => ({ ...r, usd: Math.round(r.replies * COST_PER_REPLY_USD * 100) / 100 })), veloChatByModel: byModel.rows };
}
async function activity() {
  const { rows } = await db.query(`SELECT a.id, a.action, a.detail, a.ip, a.created_at, a.target_business_id, b.name AS shop
                                     FROM admin_audit a LEFT JOIN businesses b ON b.id = a.target_business_id ORDER BY a.created_at DESC LIMIT 200`);
  return rows;
}

// Middleware: write every admin change (POST/PUT/DELETE) to admin_audit. Secrets never logged.
function auditLog(req, res, next) {
  const isAdmin = (req.session && req.session.isAdmin) || (process.env.ADMIN_API_KEY && req.get('x-admin-key') === process.env.ADMIN_API_KEY);
  if (req.method === 'GET' || !isAdmin) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const body = { ...(req.body || {}) };
    for (const k of Object.keys(body)) if (/pass|secret|token|key|pin/i.test(k)) body[k] = '[hidden]';
    const m = String(req.originalUrl || '').match(/\/(?:shops|businesses)\/(\d+)/);
    db.query('INSERT INTO admin_audit (action, detail, ip, target_business_id) VALUES ($1, $2, $3, $4)',
      [`${req.method} ${String(req.originalUrl || '').split('?')[0]}`.slice(0, 200), JSON.stringify(body).slice(0, 1000), String(req.ip || '').slice(0, 64), m ? Number(m[1]) : null]).catch(() => {});
  });
  next();
}

module.exports = { overview, shops, shop, action, waitlist, aiUsage, activity, auditLog };
