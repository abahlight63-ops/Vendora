# RAILWAY.md — deploy Vendora backend on Railway (no card to start)

> Backend only. Frontend stays on Vercel (`vendorabot.vercel.app`).

## 0. What Railway needs from this repo (already done)
- `package.json` → `engines.node >= 20.19.0` (Railway picks Node 22; v18 breaks the vite build!)
- `railway.toml` → build `npm install && npm run build`, start `node src/server.js`, healthcheck `/health`
- `src/server.js` → reads `PORT` from env, `trust proxy` on, Postgres sessions

## 1. Create the service (5 min)
1. `railway.app` → Login with GitHub → **New Project → Deploy from GitHub repo** → select `abahlight63-ops/Vendora`
2. Click the service → **Settings** → confirm Build/Start commands (auto from `railway.toml`)
3. If a Node-version error appears: Variables → add `NODE_VERSION` = `22` → redeploy

## 2. Add Postgres (2 min — fixes the #1 crash!)
Without a database the app throws `DATABASE_URL is not set` and the deploy shows failed:
1. Project canvas → **+ New → Database → PostgreSQL**
2. App service → **Variables → + New Variable → Add Reference** → Postgres → `DATABASE_URL`
3. Auto-redeploy. Expect: `WhatsApp AI support server running on port $PORT` in logs.

## 3. Env vars (copy values from local `.env` — never commit them!)
In app service → Variables, add each (see `.env.example` for docs):
`SESSION_SECRET`, `ADMIN_API_KEY`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`,
`AI_PROVIDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`,
`META_APP_ID`, `META_CONFIGURATION_ID`, `META_APP_SECRET`,
`RESEND_API_KEY`, `EMAIL_FROM`, `PAYSTACK_SECRET_KEY`,
`PRICE_MONTHLY_NAIRA`, `PRICE_YEARLY_NAIRA`, `PRICE_LIFETIME_NAIRA`,
`PRICE_MONTHLY_USD`, `PRICE_YEARLY_USD`, `PRICE_LIFETIME_USD`,
`BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`,
`TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_SHARED_BOT_TOKEN`, `TELEGRAM_SHARED_BOT_NAME`,
`FREE_AI_PER_DAY`, `MODEL_DAILY_CAP`, `CUSTOMER_DAILY_CAP`, `GROQ_RPM`,
`TRIAL_DAYS`, `SUBSCRIPTION_DAYS`, `AI_TIMEOUT_MS`
Skip: `PORT` (Railway injects), `FRONTEND_URL` + `PUBLIC_BASE_URL` (step 4).

## 4. Domain + callbacks
1. Service → **Settings → Networking → Generate Domain** → copy `xxx.up.railway.app`
2. Variables: set `PUBLIC_BASE_URL=https://xxx.up.railway.app` and
   `FRONTEND_URL=https://vendorabot.vercel.app` → auto-redeploy
3. Meta → WhatsApp → Configuration → webhook `https://xxx.up.railway.app/webhook/whatsapp` + per-shop verify code (shown on the Connect page after tapping "Connect WhatsApp")
4. Telegram bots (if used): setWebhook to `https://xxx.up.railway.app/webhook/telegram/<bizId>` with `secret_token` = your `TELEGRAM_WEBHOOK_SECRET`
5. Paystack dashboard → webhook URL `https://xxx.up.railway.app/webhook/paystack`

## 5. Migrate + verify
1. One-off: service **⋯ menu → One-off Command** → `node scripts/schema.js` → expect `Schema created`
2. `https://xxx.up.railway.app/health` → `{"status":"ok"}` (+ `ai:{gemini:true,groq:true,...}` per keys)
3. Vercel → set `VITE_API_URL=https://xxx.up.railway.app` → **Redeploy** frontend
4. Live test: signup → OTP → catalog → playground → billing → WhatsApp message

## 6. Reading failures (no screenshots needed)
Deployments → failed deploy → **View Logs** → copy icon → paste last ~30 lines as text.
Common signatures:
- `styleText ... node:util` → Node 18 (fix: `NODE_VERSION=22`, check `engines`)
- `DATABASE_URL is not set` → Postgres reference missing (step 2)
- `EAI_AGAIN` → transient DNS, redeploy
- HMAC/signature 403s → wrong secret env on that host
