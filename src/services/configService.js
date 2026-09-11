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
  whatsapp_number TEXT NOT NULL UNIQUE, -- Twilio number, e.g. whatsapp:+234… (UNIQUE = one shop per number)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name) -- same name twice = update, never duplicate (upsert key)
);

CREATE TABLE IF NOT EXISTS conversations ( -- one row per customer chat
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  customer_number TEXT NOT NULL, -- whatsapp:+234… (who)
  customer_name TEXT, -- WhatsApp profile name if Twilio sent it
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

-- Subscription / billing (Paystack)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing'; -- trialing, active, pending, expired
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMPTZ; -- paid-until date (NULL = check status only)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT; -- Paystack customer id (or transfer:plan:timestamp for manual payments)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(); -- 14-day Pro trial clock starts at signup

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

-- Takeover controls: never let the bot fight the owner's personal chats
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT true; -- global kill-switch (dashboard toggle + PAUSE/RESUME)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS personal_contacts JSONB NOT NULL DEFAULT '[]'; -- WhatsApp numbers the bot ALWAYS ignores (friends/family)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS bot_paused BOOLEAN NOT NULL DEFAULT false; -- per-chat takeover (inbox Take over / Hand back)

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
