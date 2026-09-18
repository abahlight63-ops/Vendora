// ── src/services/configService.js ──────────────────────────────────
// WHAT: the database SCHEMA (single source of truth) + tiny business lookups.
// The CREATE_TABLE string holds EVERY table + migration. scripts/schema.js runs
// it; new columns are added as ALTER TABLE … ADD COLUMN IF NOT EXISTS lines
// so old databases upgrade WITHOUT losing data (that's what a migration is).
// MODULES: ../db (pool). No npm packages — SQL strings + two query helpers.
// SQL COMMENT LESSON: inside these backtick strings, comments MUST use --
// (SQL style). JS // comments would be sent to Postgres as garbage and crash!
const db = require('../db'); // shared pool

/* Recreated users schema (was lost when src/auth.js was split during refactor). */
const USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, -- SERIAL = auto-incrementing integer id (1,2,3…)
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- FOREIGN KEY: owner link; CASCADE = deleting a business deletes its users too
  email TEXT NOT NULL UNIQUE, -- UNIQUE = no two accounts share an email (login identity)
  password_hash TEXT NOT NULL, -- NEVER a plain password: "salt:hash" from authService
  verified BOOLEAN NOT NULL DEFAULT false, -- email confirmed? (Resend flow flips it)
  verify_token TEXT, -- one-time email link token (NULL after use)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() -- TIMESTAMPTZ = timezone-aware timestamp; now() = insert time
);
`;

/**
 * Business config service.
 * A business config holds: name, whatsapp number, hours, FAQ list, tone.
 */
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY, -- shop id (everything links here)
  name TEXT NOT NULL, -- shop display name
  whatsapp_number TEXT NOT NULL UNIQUE, -- shop WhatsApp number, e.g. whatsapp:+234… (UNIQUE = one shop per number)
  owner_number TEXT, -- owner's personal WhatsApp (LEARN:/SYNC: rights + alerts)
  hours TEXT NOT NULL DEFAULT '', -- opening hours text the AI quotes
  faq JSONB NOT NULL DEFAULT '[]', -- JSONB = Postgres-native JSON (queryable Q&A array)
  tone TEXT NOT NULL DEFAULT 'friendly and helpful', -- AI personality instruction
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- migration for existing installs
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_number TEXT; -- old DBs created before this column get it added (IF NOT EXISTS = skip if present)

CREATE TABLE IF NOT EXISTS products ( -- the catalog the AI answers from
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- products die with their shop
  name TEXT NOT NULL,
  price TEXT, -- TEXT not number: keeps unit symbols exactly as written
  description TEXT,
  available BOOLEAN NOT NULL DEFAULT true, -- false = AI says "out of stock"
  image_url TEXT, -- product photo (public https URL — the bot sends it on WhatsApp for Pro shops)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name) -- same name twice = update, never duplicate (upsert key)
);

CREATE TABLE IF NOT EXISTS conversations ( -- one row per customer chat
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  customer_number TEXT NOT NULL, -- whatsapp:+234… (who)
  customer_name TEXT, -- WhatsApp profile name if Meta sent it
  last_message TEXT NOT NULL DEFAULT '', -- preview for the inbox list
  last_reply TEXT, -- preview of our last reply
  needs_human BOOLEAN NOT NULL DEFAULT false, -- gold flag in the inbox
  flag_reason TEXT, -- WHY the AI handed off (shown to owner + Insights)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() -- drives inbox sorting (newest first)
);

CREATE TABLE IF NOT EXISTS messages ( -- every single message, both directions
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')), -- CHECK constraint = DB enforces only these two values
  body TEXT NOT NULL, -- message text
  media_url TEXT, -- data: URL for photos (dashboard img), NULL otherwise
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at); -- INDEX = fast thread loading (without it, full table scan)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT; -- migration for older DBs

-- Subscription / billing (Paystack NGN + Flutterwave USD)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing'; -- trialing, active, pending, expired
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMPTZ; -- paid-until date (NULL = check status only)
-- 7-day trial lifecycle flags (checked lazily in getMe — no cron, no extra keys!):
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_warned BOOLEAN NOT NULL DEFAULT false; -- true = "2 days left" bell already sent (once!)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_expiry_notified BOOLEAN NOT NULL DEFAULT false; -- true = "trial ended" bell sent + status flipped to expired (once!)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT; -- Paystack customer id (or transfer:plan:timestamp for manual payments)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(); -- 7-day Pro trial clock starts at signup
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS winback_sent_at TIMESTAMPTZ; -- last inactivity-nudge email (winback script caps to one per 30 days)

-- Email verification (Resend)
${USERS_TABLE} -- interpolation: paste the users-table string defined above into this one
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false; -- safety net if users table predates the flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT;
-- OTP registration (6-digit email codes) + forgot-password reset links
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_hash TEXT; -- scrypt hash of the 6-digit code (NEVER the plain code — leaked DBs must not reveal OTPs!)
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMPTZ; -- 10-minute window (NULL = no active code)
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0; -- wrong tries (5 = code burned, request a new one)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT; -- forgot-password token (NULL after use — one-time!)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ; -- 1-hour window for reset links

-- ComeBack: abandonment recovery
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMPTZ; -- NULL = never nudged; timestamp = nudged once

-- SmartDeal: negotiation guardrails
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_discount_pct INTEGER NOT NULL DEFAULT 0; -- 0 = AI never discounts
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS min_order_naira INTEGER NOT NULL DEFAULT 0; -- discount floor (minor units of shop currency)

-- Pro: WhatsApp Business profile sync (verified catalog source)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS profile_snapshot TEXT NOT NULL DEFAULT ''; -- pasted profile text (Pro grounding)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS profile_synced_at TIMESTAMPTZ; -- when it was synced (shown in Catalog)

-- Vendora AI daily usage caps (free tier + paid-model guard)
CREATE TABLE IF NOT EXISTS ai_usage ( -- one row per business per day; PRIMARY KEY(a,b) = composite key
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE, -- DATE (no time) groups today's usage
  free_count INTEGER NOT NULL DEFAULT 0, -- free-model chats today
  paid_count INTEGER NOT NULL DEFAULT 0, -- paid-model chats today
  PRIMARY KEY (business_id, day)
);

-- Per-MODEL daily caps: stops one hammered model eating the shared key quota
-- (one row per business per day per model — 50/day free default for everything!)
CREATE TABLE IF NOT EXISTS model_usage (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  model_id TEXT NOT NULL, -- catalog id (gpt-oss-20b, kimi-k2…) — stable keys, not provider model names!
  count INTEGER NOT NULL DEFAULT 0, -- calls today
  PRIMARY KEY (business_id, day, model_id)
);

-- Ad monetization: per-click tracking (per-view earnings come from the
-- network dashboard, e.g. Monetag; clicks are tracked here for sponsor billing)
CREATE TABLE IF NOT EXISTS ad_clicks ( -- every "Visit sponsor" tap
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL, -- SET NULL (not CASCADE): keep stats even if shop deleted
  slot TEXT NOT NULL DEFAULT 'sponsor', -- which placement was clicked (future: more slots)
  target_url TEXT NOT NULL DEFAULT '', -- where they went (sponsor invoice proof)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_created ON ad_clicks(created_at); -- fast date-range stats

-- Global: per-business currency (NGN default) + timezone for business-hours logic
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN'; -- NGN (+234) or USD (world)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Lagos'; -- IANA zone for open/closed replies

-- Agentic inventory: stock counts per product (forward-compatible with the
-- back-office plan: low_threshold + supplier_id arrive with reorder drafts)
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0; -- integer counts (never floats — stock is whole units!)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT; -- niche-driven shelf section (Phones, Gowns… NULL = uncategorized legacy rows)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT; -- product photo URL (Pro shops: bot sends it on WhatsApp; NULL = older product, text-only)
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_threshold INTEGER NOT NULL DEFAULT 5; -- reorder watch level (used later, harmless now)

-- Inventory audit log: EVERY stock change, append-only (never edited, never
-- deleted by app code — UNDO writes a REVERSING entry, preserving history)
CREATE TABLE IF NOT EXISTS inventory_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- vendor scope (per-vendor system of record = Postgres!)
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, -- SET NULL: history survives product deletion (audit must outlive the row!)
  item TEXT NOT NULL DEFAULT '', -- product name snapshot (readable even if product renamed later)
  old_value INTEGER NOT NULL DEFAULT 0, -- before
  new_value INTEGER NOT NULL DEFAULT 0, -- after
  operation TEXT NOT NULL DEFAULT 'set', -- add | remove | set | undo
  source_message TEXT NOT NULL DEFAULT '', -- the exact owner message that caused it (audit proof!)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory_logs(business_id, created_at DESC); -- fast per-shop history (latest-first!)

-- Setup quiz answers (Welcome 5-step + mobile setup): what the shop sells is
-- business_niche (older migration); these three personalize the dashboard
-- checklist, Connect hints + plan guidance. Nullable = skipped questions!
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS catalog_size TEXT; -- starting | under-20 | 20-100 | 100-plus
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS channels TEXT; -- comma list: whatsapp,telegram,instagram,walkin
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS daily_volume TEXT; -- few | 10-50 | 50-plus

-- Paid-tier tracking: which tier the shop BOUGHT (pro | plus). Trials count as
-- Pro without touching this (planService.effectiveTier handles trial → pro).
-- Old single-plan buyers default to pro (same features they paid for).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'pro';

-- Welcome setup: what the shop sells + where they found us (niche drives
-- Vendora AI suggestions + WhatsApp reply context; heard_from is analytics).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_niche TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS heard_from TEXT NOT NULL DEFAULT '';

-- Takeover controls: never let the bot fight the owner's personal chats
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT true; -- global kill-switch (dashboard toggle + PAUSE/RESUME)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS personal_contacts JSONB NOT NULL DEFAULT '[]'; -- WhatsApp numbers the bot ALWAYS ignores (friends/family)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS bot_paused BOOLEAN NOT NULL DEFAULT false; -- per-chat takeover (inbox Take over / Hand back)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'; -- whatsapp | telegram (inbox filters + tone tweaks per channel!)

-- Telegram channel: per-shop bot tokens + shared-bot routing + owner linking
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT NOT NULL DEFAULT ''; -- per-shop BotFather token (empty = Telegram off for this shop)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS telegram_link_code TEXT NOT NULL DEFAULT ''; -- customer link code (t.me/SharedBot?start=CODE) + owner-link nonce (regenerated per tap!)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_telegram_id TEXT NOT NULL DEFAULT ''; -- linked owner chat id (owner commands work from here!)
CREATE TABLE IF NOT EXISTS telegram_links ( -- shared-bot routing: telegram user id → business (bound on /start CODE, forever!)
  telegram_id TEXT NOT NULL PRIMARY KEY, -- Telegram chat/user id (stable per user — the identity!)
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- bound shop (CASCADE: shop gone = links gone!)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revenue ledger: every money event (Paystack success, transfer report/approval)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL, -- SET NULL: revenue history survives shop deletion
  plan TEXT NOT NULL DEFAULT 'monthly', -- monthly | yearly | lifetime
  currency TEXT NOT NULL DEFAULT 'NGN', -- NGN | USD
  amount INTEGER NOT NULL DEFAULT 0, -- minor units (kobo/cents) — integers dodge float rounding!
  method TEXT NOT NULL DEFAULT 'paystack', -- paystack | transfer
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | rejected
  reference TEXT, -- Paystack reference or transfer:plan:timestamp tag
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
-- Transfer verification (anti-fraud: every manual claim carries who/where/ref)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sender_name TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sender_bank TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sender_ref TEXT NOT NULL DEFAULT '';

-- Support complaints: in-app tickets from owners (Help form → admin replies)
CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE, -- tickets die with the shop
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', -- open | answered | resolved
  reply TEXT NOT NULL DEFAULT '', -- admin's latest reply (shown in owner's Help)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaints_business ON complaints(business_id);

-- In-app notifications: the topbar bell (payment events auto, app updates via broadcast)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE, -- owner inbox (CASCADE: shop gone = inbox gone)
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '', -- app route to open on tap (e.g. /billing), '' = no-op
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_business ON notifications(business_id, created_at DESC);
-- Long-form notices with media: image/video attachments on broadcasts.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT; -- optional photo (bell shows thumb, detail page shows full)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS video_url TEXT; -- optional mp4 (detail page plays it)
-- Admin notice templates: reusable long-form broadcasts (built-ins ship in
-- code, customs live here). Edited/deleted only by you — owners just receive.
CREATE TABLE IF NOT EXISTS notification_templates (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Web Push subscriptions: one row per browser (phone + laptop separately!).
-- Powers phone-bar alerts even with the tab closed (bell fan-out rides here).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- owner scope (shop gone = subs gone)
  endpoint TEXT PRIMARY KEY, -- push-service URL (unique per browser — re-subscribing upserts!)
  p256dh TEXT NOT NULL, -- receiver public key (payload encryption!)
  auth TEXT NOT NULL, -- receiver auth secret (key derivation!)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_business ON push_subscriptions(business_id);

-- AI voice controls: the owner's own words for greetings + human handoff.
-- Empty = built-in polite defaults (replyEngine + webhookController fall back).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS greeting_msg TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS handoff_msg TEXT NOT NULL DEFAULT '';

-- Channel connections (Connect page): Meta WhatsApp Cloud API (Embedded Signup)
-- + Telegram. whatsapp_model = per-shop AI pick for WhatsApp/Playground replies
-- (default full). wa_channel is always 'meta' (Meta Cloud API direct, no
-- middleman). Meta creds = WABA ID + Phone Number ID + access token from
-- Embedded Signup (developers.facebook.com), stored server-side only.
-- whatsapp_last_inbound_at = LIVE pill + TEST-verify (stamped per inbound).
-- NOTE: twilio_* columns are RETIRED (kept so old databases still boot; the
-- app never reads or writes them — do not reintroduce Twilio anywhere).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_model TEXT NOT NULL DEFAULT 'gemini-flash-full';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS wa_channel TEXT NOT NULL DEFAULT 'meta';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS meta_token TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS meta_verify_token TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS meta_waba_id TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_last_inbound_at TIMESTAMPTZ;
-- Retire legacy Twilio rows: shops that already moved to Meta stop claiming 'twilio'.
UPDATE businesses SET wa_channel = 'meta' WHERE wa_channel = 'twilio' AND meta_phone_number_id <> '';
UPDATE businesses SET wa_channel = 'meta' WHERE wa_channel <> 'meta';

-- App-level key/value (broadcast cursors, release markers — tiny global state
-- that must survive restarts but needs no dedicated table per key).
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY, -- e.g. 'last_broadcast_version'
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function ensureSchema() {
  await db.query(CREATE_TABLE); // run the whole thing (safe to re-run: everything is IF NOT EXISTS)
}

async function getBusinessByWhatsAppNumber(number) {
  const { rows } = await db.query( // SELECT * = all columns (webhook needs subscription + owner + snapshot…)
    'SELECT * FROM businesses WHERE whatsapp_number = $1 LIMIT 1', // LIMIT 1: number is UNIQUE, so at most one row
    [number]
  );
  return rows[0] || null; // row or null (webhook 200s quietly on null)
}

async function getBusinessById(id) {
  const { rows } = await db.query('SELECT * FROM businesses WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

module.exports = { ensureSchema, getBusinessByWhatsAppNumber, getBusinessById, CREATE_TABLE, USERS_TABLE }; // schema.js needs CREATE_TABLE; auth.js re-export needs USERS_TABLE
