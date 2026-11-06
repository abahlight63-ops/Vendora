// ── src/services/adminFeatures.js ─────────────────────────────────
// WHAT: admin console → App functions. Every function of the app on one
// page: is it switched on, is it set up, and is anyone using it.
// Status per function:
//   working — set up and used in the period
//   idle    — set up, but nobody used it in the period
//   setup   — a setting it needs is missing (named, never its value)
//   off     — not built yet, or not running automatically
// READ-ONLY: only SELECTs. Each count is isolated, so one failing query
// shows "–" for that number instead of breaking the page.
const db = require('../db');

const env = (k) => String(process.env[k] || '').trim();
const has = (...keys) => keys.every((k) => !!env(k));

async function one(sql, args = []) {
  try { const { rows } = await db.query(sql, args); return rows[0] || {}; }
  catch (e) { console.error('admin features query:', e.message.slice(0, 120)); return {}; }
}
const n = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));

function status({ ready = true, used = 0, off = false }) {
  if (off) return 'off';
  if (!ready) return 'setup';
  return used > 0 ? 'working' : 'idle';
}

async function features(days = 7) {
  const d = Math.min(90, Math.max(1, Number(days) || 7));
  const A = [d];
  const W = `now() - make_interval(days => $1)`;

  const [users, shops, msgs, ch, orders, sell, money, refs, notes, sec, ai, contacts, bc, prof] = await Promise.all([
    one(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE created_at >= ${W})::int new, COUNT(*) FILTER (WHERE verified)::int verified,
                COUNT(*) FILTER (WHERE password_hash = '')::int google FROM users`, A),
    one(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE COALESCE(business_niche,'') <> '')::int setup_done,
                COUNT(*) FILTER (WHERE subscription_status = 'trialing')::int trialing,
                COUNT(*) FILTER (WHERE subscription_status = 'active' AND (subscription_expires IS NULL OR subscription_expires > now()))::int paying,
                COUNT(*) FILTER (WHERE bot_enabled = false)::int bot_off FROM businesses`),
    one(`SELECT COUNT(*) FILTER (WHERE m.direction = 'in')::int customer_in,
                COUNT(*) FILTER (WHERE m.direction = 'out' AND m.sender = 'bot')::int velo,
                COUNT(*) FILTER (WHERE m.direction = 'out' AND m.sender = 'owner')::int owner,
                COUNT(*) FILTER (WHERE m.direction = 'in' AND c.customer_number LIKE 'whatsapp:%')::int wa_in,
                COUNT(*) FILTER (WHERE m.direction = 'in' AND c.customer_number LIKE 'telegram:%')::int tg_in,
                COUNT(DISTINCT c.business_id) FILTER (WHERE m.direction = 'out' AND m.sender = 'bot')::int shops_answered
           FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.created_at >= ${W}`, A),
    one(`SELECT COUNT(*) FILTER (WHERE meta_phone_number_id <> '')::int wa,
                COUNT(*) FILTER (WHERE telegram_bot_token <> '')::int tg_own,
                COUNT(*) FILTER (WHERE telegram_shared_on)::int tg_shared,
                COUNT(*) FILTER (WHERE owner_telegram_id <> '')::int tg_owner_linked,
                (SELECT COUNT(*)::int FROM telegram_links) tg_customers,
                (SELECT COUNT(*)::int FROM conversations WHERE needs_human) needs_you,
                (SELECT COUNT(*)::int FROM conversations WHERE blocked) blocked,
                (SELECT COUNT(*)::int FROM conversations WHERE bot_paused) taken_over FROM businesses`),
    one(`SELECT COUNT(*) FILTER (WHERE created_at >= ${W})::int orders,
                COUNT(*) FILTER (WHERE created_at >= ${W} AND source = 'auto_draft')::int drafted,
                COUNT(*) FILTER (WHERE created_at >= ${W} AND source = 'velo_chat')::int velo_chat,
                COUNT(*) FILTER (WHERE created_at >= ${W} AND source = 'owner')::int by_owner,
                COUNT(*) FILTER (WHERE receipt_sent_at >= ${W})::int receipts,
                COALESCE(SUM(total) FILTER (WHERE created_at >= ${W} AND status IN ('paid','delivered')), 0)::bigint paid_value,
                COUNT(*)::int all_time FROM orders`, A),
    one(`SELECT (SELECT COUNT(*)::int FROM products) products,
                (SELECT COUNT(DISTINCT business_id)::int FROM products) shops_with_products,
                (SELECT COUNT(*)::int FROM products WHERE COALESCE(image_url,'') <> '') with_photo,
                (SELECT COUNT(*)::int FROM businesses WHERE followup_enabled) followup_on,
                (SELECT COUNT(*)::int FROM conversations WHERE followup_sent_at >= ${W}) followups_sent,
                (SELECT COUNT(*)::int FROM businesses WHERE away_until > now()) away_now`, A),
    one(`SELECT COUNT(*) FILTER (WHERE status = 'active' AND created_at >= now() - interval '30 days')::int pays_30,
                COALESCE(SUM(amount) FILTER (WHERE status = 'active' AND created_at >= now() - interval '30 days'), 0)::bigint minor_30,
                COUNT(*) FILTER (WHERE method = 'paystack')::int paystack, COUNT(*) FILTER (WHERE method = 'flutterwave')::int flutterwave,
                COUNT(*) FILTER (WHERE method = 'credit')::int by_credit FROM payments`),
    one(`SELECT (SELECT COUNT(*)::int FROM businesses WHERE referred_by IS NOT NULL) referred,
                (SELECT COUNT(*)::int FROM businesses WHERE bonus_pro_until > now()) bonus_now,
                COALESCE(SUM(amount) FILTER (WHERE kind = 'plan_credit'), 0)::bigint credit_given,
                COALESCE(SUM(amount) FILTER (WHERE kind = 'credit_spent'), 0)::bigint credit_used,
                COUNT(*) FILTER (WHERE kind = 'airtime' AND status = 'pending')::int airtime_pending FROM referral_payouts`),
    one(`SELECT COUNT(*) FILTER (WHERE created_at >= ${W})::int sent, COUNT(*) FILTER (WHERE NOT is_read)::int unread,
                (SELECT COUNT(*)::int FROM push_subscriptions) push_devices FROM notifications`, A),
    one(`SELECT COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND level = 'high')::int high_24,
                COUNT(*) FILTER (WHERE created_at >= ${W} AND level <> 'info')::int warnings FROM security_events`, A),
    one(`SELECT COALESCE(SUM(free_count + paid_count), 0)::int asks, COUNT(DISTINCT business_id)::int shops FROM ai_usage WHERE day >= (now() - make_interval(days => $1))::date`, A),
    one(`SELECT COUNT(*)::int people, COUNT(DISTINCT business_id)::int shops FROM personal_contacts`),
    one(`SELECT COUNT(*) FILTER (WHERE created_at >= ${W})::int sent, COALESCE(SUM(sent) FILTER (WHERE created_at >= ${W}), 0)::int delivered FROM broadcasts`, A),
    (async () => {
      try {
        const sp = require('./shopProfile');
        const { rows } = await db.query('SELECT * FROM businesses ORDER BY id DESC LIMIT 2000');
        if (!rows.length) return { avg: 0, full: 0 };
        const pcts = rows.map((b) => (sp.completeness(b) || {}).pct || 0);
        return { avg: Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length), full: pcts.filter((x) => x >= 80).length };
      } catch (e) { return {}; }
    })(),
  ]);

  const mailFrom = (env('EMAIL_FROM').match(/@([^>\s]+)/) || [])[1] || '';
  const mailReady = has('RESEND_API_KEY') || has('EMAIL_SMTP_HOST');
  const aiKeys = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'SAMBANOVA_API_KEY'].filter((k) => has(k)).length;
  const paystackLive = env('PAYSTACK_SECRET_KEY').startsWith('sk_live_');
  const F = (group, key, name, what, st, numbers, hint = '') => ({ group, key, name, what, status: st, numbers, hint });

  const list = [
    // ── Accounts and setup
    F('Accounts and setup', 'signup', 'Sign-up and sign-in', 'Shops create an account with email or Google, confirm with a 6-digit code.',
      status({ ready: mailReady, used: n(users.new) }), [['New accounts', n(users.new)], ['All accounts', n(users.total)], ['Email confirmed', n(users.verified)], ['Signed up with Google', n(users.google)]],
      mailFrom === 'resend.dev' ? 'Emails are sent from resend.dev, which only reaches your own Resend email. Verify velosalesai.com.ng in Resend and set EMAIL_FROM.' : !mailReady ? 'No email service: set RESEND_API_KEY.' : ''),
    F('Accounts and setup', 'google', 'Continue with Google', 'One-tap sign-in and sign-up with a Google account.',
      status({ ready: has('GOOGLE_CLIENT_ID'), used: n(users.google) }), [['Google accounts', n(users.google)]], has('GOOGLE_CLIENT_ID') ? '' : 'Set GOOGLE_CLIENT_ID.'),
    F('Accounts and setup', 'setup', 'Setup screens', 'What they sell, shop details, delivery and payment, plan pick.',
      status({ used: n(shops.setup_done) }), [['Finished setup', n(shops.setup_done)], ['All shops', n(shops.total)]]),
    F('Accounts and setup', 'profile', 'Shop profile ("Velo knows X%")', 'Address, hours, delivery fees, payment details, returns. Velo answers from these.',
      status({ used: n(prof.full) || n(prof.avg) }), [['Average filled in', prof.avg == null ? null : prof.avg + '%'], ['Shops 80%+ filled', n(prof.full)]]),

    // ── Channels
    F('Channels', 'whatsapp', 'WhatsApp', 'Velo answers customers on the shop\'s WhatsApp Business number.',
      status({ ready: has('META_APP_ID', 'META_CONFIGURATION_ID', 'META_APP_SECRET'), used: n(msgs.wa_in) }), [['Shops connected', n(ch.wa)], ['Customer messages', n(msgs.wa_in)]],
      has('META_APP_ID', 'META_CONFIGURATION_ID', 'META_APP_SECRET') ? '' : 'Set META_APP_ID, META_CONFIGURATION_ID and META_APP_SECRET.'),
    F('Channels', 'tg_own', 'Telegram: shop\'s own bot', 'The shop makes a bot with BotFather and pastes the token.',
      status({ used: n(ch.tg_own) }), [['Shops connected', n(ch.tg_own)], ['Owners linked', n(ch.tg_owner_linked)], ['Customer messages', n(msgs.tg_in)]],
      has('TELEGRAM_WEBHOOK_SECRET') ? '' : 'Set TELEGRAM_WEBHOOK_SECRET so fake Telegram messages are refused.'),
    F('Channels', 'tg_shared', 'Telegram: shared bot + QR poster', 'One tap, no BotFather. Every shop gets a link, a QR code and a poster.',
      status({ ready: has('TELEGRAM_SHARED_BOT_TOKEN', 'TELEGRAM_SHARED_BOT_NAME'), used: n(ch.tg_shared) }), [['Shops using it', n(ch.tg_shared)], ['Customers linked', n(ch.tg_customers)]],
      has('TELEGRAM_SHARED_BOT_TOKEN', 'TELEGRAM_SHARED_BOT_NAME') ? '' : 'Set TELEGRAM_SHARED_BOT_TOKEN and TELEGRAM_SHARED_BOT_NAME.'),
    F('Channels', 'messenger', 'Facebook Messenger', 'Answer a Page\'s messages.', 'off', [], 'Coming soon: needs Meta app review.'),
    F('Channels', 'instagram', 'Instagram', 'Answer Instagram DMs.', 'off', [], 'Coming soon: needs Meta app review.'),
    F('Channels', 'web', 'Shop Pages and website chat', 'A one-page chat site per shop and a bubble for websites.', 'off', [], 'Planned for version 2.'),
    F('Channels', 'email', 'Email answering', 'Velo answers customer emails.', 'off', [], 'Planned for version 2.'),

    // ── Velo (AI)
    F('Velo (AI)', 'replies', 'Customer replies', 'Velo answers from the catalog in English or Pidgin, like a real person.',
      status({ ready: aiKeys > 0, used: n(msgs.velo) }), [['Replies by Velo', n(msgs.velo)], ['Customer messages', n(msgs.customer_in)], ['Shops answered', n(msgs.shops_answered)]],
      aiKeys ? `${aiKeys} of 4 AI providers have keys.` : 'No AI key: set GEMINI_API_KEY or GROQ_API_KEY.'),
    F('Velo (AI)', 'handoff', 'Hand-off to the owner', 'When Velo is not sure, it says so politely and the chat is marked Needs you.',
      status({ used: n(ch.needs_you) + n(msgs.owner) }), [['Chats needing an owner now', n(ch.needs_you)], ['Replies typed by owners', n(msgs.owner)], ['Chats taken over', n(ch.taken_over)]]),
    F('Velo (AI)', 'chatvelo', 'Chat with Velo', 'The owner\'s own assistant: shop numbers, receipts, captions.',
      status({ ready: aiKeys > 0, used: n(ai.asks) }), [['Questions asked', n(ai.asks)], ['Shops using it', n(ai.shops)]]),
    F('Velo (AI)', 'killswitch', 'Velo on/off switch', 'Owners can pause Velo for the whole shop.',
      status({ used: 1 }), [['Shops with Velo paused', n(shops.bot_off)]]),

    // ── Selling
    F('Selling', 'catalog', 'Catalog', 'Products, prices, stock and photos Velo sells from.',
      status({ used: n(sell.products) }), [['Products', n(sell.products)], ['Shops with products', n(sell.shops_with_products)], ['With a photo', n(sell.with_photo)]],
      has('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_UPLOAD_PRESET') ? '' : 'Photo uploads are stored on Render\'s disk and vanish on redeploy: set the Cloudinary keys.'),
    F('Selling', 'orders', 'Orders and receipts', 'Every sale with its receipt; mark paid or delivered.',
      status({ used: n(orders.orders) }), [['Orders', n(orders.orders)], ['Made by owners', n(orders.by_owner)], ['Via Chat with Velo', n(orders.velo_chat)], ['Receipts sent', n(orders.receipts)], ['Paid value (₦)', orders.paid_value == null ? null : Number(orders.paid_value).toLocaleString('en-NG')]]),
    F('Selling', 'drafts', 'Velo drafts orders', 'When a customer decides to buy, Velo writes the order and rings the owner.',
      status({ ready: aiKeys > 0, used: n(orders.drafted) }), [['Orders drafted by Velo', n(orders.drafted)]]),
    F('Selling', 'followups', 'Follow-ups', 'One friendly nudge to customers who asked and went quiet (inside 24 hours).',
      status({ used: n(sell.followups_sent) }), [['Shops with it on', n(sell.followup_on)], ['Nudges sent', n(sell.followups_sent)]]),
    F('Selling', 'away', 'Away mode', 'Velo keeps answering but says orders resume when the owner is back.',
      status({ used: n(sell.away_now) }), [['Shops away now', n(sell.away_now)]]),
    F('Selling', 'broadcasts', 'Broadcasts', 'Send a message to past customers.',
      status({ used: n(bc.sent) }), [['Broadcasts sent', n(bc.sent)], ['Messages delivered', n(bc.delivered)]]),
    F('Selling', 'friends', 'Friends and family list', 'Velo never sells to these numbers.',
      status({ used: n(contacts.people) }), [['People listed', n(contacts.people)], ['Shops using it', n(contacts.shops)]]),
    F('Selling', 'block', 'Block a number', 'Blocked chats are logged but never answered.',
      status({ used: n(ch.blocked) }), [['Blocked chats', n(ch.blocked)]]),

    // ── Money
    F('Money', 'paystack', 'Card, transfer and USSD (Paystack, naira)', 'Plan payments in naira.',
      status({ ready: has('PAYSTACK_SECRET_KEY') && paystackLive, used: n(money.paystack) }), [['Payments (all time)', n(money.paystack)], ['Paid in 30 days', n(money.pays_30)], ['Collected in 30 days (₦)', money.minor_30 == null ? null : (Number(money.minor_30) / 100).toLocaleString('en-NG')]],
      !has('PAYSTACK_SECRET_KEY') ? 'Set PAYSTACK_SECRET_KEY.' : !paystackLive ? 'Paystack is on a TEST key: no real money is collected.' : ''),
    F('Money', 'flutterwave', 'International cards (Flutterwave, dollars)', 'Plan payments in US dollars.',
      status({ ready: has('FLW_SECRET_KEY', 'FLW_SECRET_HASH'), used: n(money.flutterwave) }), [['Payments (all time)', n(money.flutterwave)]],
      has('FLW_SECRET_KEY', 'FLW_SECRET_HASH') ? '' : 'Set FLW_SECRET_KEY and FLW_SECRET_HASH.'),
    F('Money', 'trial', 'Free trial and plans', '7 days of Pro free; Free, Plus and Pro.',
      status({ used: n(shops.trialing) + n(shops.paying) }), [['On trial now', n(shops.trialing)], ['Paying now', n(shops.paying)]]),
    F('Money', 'refer', 'Refer & Earn', '14 Pro days for both shops; plan credit when a friend pays.',
      status({ used: n(refs.referred) }), [['Shops referred', n(refs.referred)], ['Credit given (₦)', refs.credit_given == null ? null : (Number(refs.credit_given) / 100).toLocaleString('en-NG')], ['Credit used (₦)', refs.credit_used == null ? null : (Number(refs.credit_used) / 100).toLocaleString('en-NG')], ['Paid with credit', n(money.by_credit)]]),

    // ── Notifications
    F('Notifications', 'bell', 'Bell and Notifications page', 'Problems to fix, payments, chats that need the owner. Each opens the exact place.',
      status({ used: n(notes.sent) }), [['Notices sent', n(notes.sent)], ['Unread now', n(notes.unread)]]),
    F('Notifications', 'push', 'Phone push notifications', 'Notices on the owner\'s phone lock screen.',
      status({ ready: has('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'), used: n(notes.push_devices) }), [['Phones subscribed', n(notes.push_devices)]],
      has('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY') ? '' : 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (npm run push:vapid).'),
    F('Notifications', 'alerts', 'Crash and security alerts (to you)', 'Emails you when the server breaks or something looks like an attack.',
      status({ ready: has('ALERT_EMAIL') || has('SUPPORT_EMAIL'), used: 1 }), [], has('ALERT_EMAIL') || has('SUPPORT_EMAIL') ? '' : 'Set ALERT_EMAIL.'),

    // ── Safety and system
    F('Safety and system', 'security', 'Security log', 'Wrong passwords, lockouts, blocked attacks, fake webhooks, payment mismatches.',
      status({ used: 1 }), [['Serious (24h)', n(sec.high_24)], ['Warnings', n(sec.warnings)]], n(sec.high_24) ? 'Open Security to read them.' : ''),
    F('Safety and system', 'encryption', 'Encrypted tokens', 'WhatsApp and Telegram tokens are stored locked.',
      status({ ready: has('TOKEN_ENCRYPTION_KEY'), used: 1 }), [], has('TOKEN_ENCRYPTION_KEY') ? '' : 'Set TOKEN_ENCRYPTION_KEY (same value as your .env).'),
    F('Safety and system', 'backups', 'Nightly database backups', 'Encrypted, read-only backup every night on GitHub, kept 30 days.',
      'idle', [], 'Runs on GitHub, not on this server: check GitHub → Actions → Database backup for green ticks.'),
    F('Safety and system', 'jobs_on', 'Automatic jobs that run', 'Follow-ups, friend-or-customer question, channel check every 6 hours, keep-awake ping, security log clean-up.',
      'working', []),
    F('Safety and system', 'jobs_off', 'Daily summary, payment reminders, win-back', 'Written, but not started automatically on the server yet.',
      'off', [], 'Not running: these need turning on (on the to-do list).'),
  ];
  const counts = list.reduce((m, f) => { m[f.status] = (m[f.status] || 0) + 1; return m; }, {});
  let version = '';
  try { version = require('../version').APP_VERSION; } catch { /* ignore */ }
  return { days: d, counts, list, server: { version, uptimeHours: Math.round(process.uptime() / 360) / 10, node: process.version } };
}

module.exports = { features };
