# API Keys — Starter Business Guide

What each key unlocks, where to get it, and what happens if you skip it.
Rule of thumb: **test keys first, real money later.** After ANY key change:
restart the server (`Ctrl+C`, `npm run dev`) — Node reads `.env` once at boot.

Copy `.env.example` to `.env`, then fill the rows below.

## 1. Money in (do these first)

### Paystack — Naira card payments (NGN shops)
1. Sign up at https://paystack.com (business name + bank account).
2. Dashboard → **Settings → API Keys**.
3. Copy the **SECRET** key (`sk_test_...` to test, `sk_live_...` for real money).
4. Paste as `PAYSTACK_SECRET_KEY`.
5. Webhook: Dashboard → **Settings → Webhooks** → URL `https://YOUR-BACKEND/webhook/paystack`.
6. Test keys work without BVN. **Live keys need BVN + NIN + CAC.**
- Without it: Billing shows "payment unavailable" — app still works free.

### Flutterwave — Dollar card payments (USD / international shops)
1. Sign up at https://flutterwave.com.
2. Dashboard → **Settings → API Keys** → copy the **SECRET** key
   (`FLWSECK_TEST...` to test, `FLWSECK...` live) → `FLW_SECRET_KEY`.
3. Dashboard → **Settings → Webhooks** → URL `https://YOUR-BACKEND/webhook/flutterwave`,
   copy the **secret hash** → `FLW_SECRET_HASH` (this is what proves webhooks are genuine).
4. Test with a test card from their docs before going live.
- Without it: Dollar shops can't check out — Naira shops unaffected.

## 2. The AI brain (pick at least one)

### Google Gemini — main brain (free tier, recommended first)
1. Go to https://aistudio.google.com → **Get API key** → Create.
2. Paste as `GEMINI_API_KEY`. Keep `AI_PROVIDER=gemini`.
3. Free quota covers small shops; the app falls back automatically if it fails.

### Groq — fast backup + voice notes (free tier, recommended second)
1. Go to https://console.groq.com → **API Keys** → Create.
2. Paste as `GROQ_API_KEY`.
3. This also powers **voice-note transcription** (Whisper) for Pro Plus shops.
- Without AI keys: the bot hands everything to you (safe, but silent).

## 3. Messaging doors

### Meta WhatsApp — one-tap Embedded Signup (recommended, free to start)
No per-shop console maze: owners tap **Connect WhatsApp** on the Connect page,
log in with Facebook in the popup, and pick their number — the app stores the
WABA ID + phone number ID + access token against their account automatically.
Server needs three keys (see `.env.example`):
1. `META_APP_ID` — App Dashboard → App ID (public value).
2. `META_CONFIGURATION_ID` — WhatsApp → Embedded Signup configuration (create one!).
3. `META_APP_SECRET` — App Dashboard → App secret (SERVER ONLY — exchanges the
   signup code for a token. If empty, owners use the manual paste below).
4. Manual fallback (popup unavailable): developers.facebook.com → App (Business)
   → WhatsApp → **API Setup**: copy **Phone Number ID** + token → paste on the
   Connect page; then **Configuration**: paste our webhook URL + verify code.
- Without it: WhatsApp stays OFF — Telegram still works.

### Telegram — second door (optional, free)
To connect Telegram, you need a free bot token from Telegram itself — it takes under a minute.
1. Open Telegram and search for **@BotFather** (the official bot for creating bots).
2. Send the command `/newbot`
3. Give your bot a name (this is what customers will see).
4. Give it a username — it must end in "bot" (e.g. YourShopBot).
5. BotFather will reply with a message containing your API token — a long string like `123456789:ABCdefGhIJKlmNoPQRsTuVwxyZ`.
6. Copy that token and paste it on the Connect page → Telegram road.
⚠️ Keep this token private — anyone with it can control your bot.
7. Set ONE `TELEGRAM_WEBHOOK_SECRET` in `.env` and the same value in every
   BotFather `setWebhook` call — wrong secret gets 403.

### Manual Meta paste (fallback when the popup is unavailable)
No `.env` key needed — each shop pastes its own 2 values on the Connect page
(never touch the server). Free test number included, 1,000 chats/month free.
1. Go to https://developers.facebook.com → log in → **Create App**
   (type Business) → any name.
2. In the app dashboard → **Add Product** → **WhatsApp** — a free test
   number appears instantly.
3. Open **API Setup**: copy **Phone Number ID** (all digits) + the
   **temporary token** (lasts 24h — enough to connect + TEST today).
4. Open **Configuration**: paste the webhook URL + verify code from OUR
   Connect page → **Verify and save** → tick the **messages** field.
5. Back in our app: TEST → LIVE. Done.
6. Later, for a token that never expires: Meta **Business Settings →
   System Users** → add user → attach your app → **Generate token** —
   swap it into the same box.
7. Real business number: **Phone numbers → Add number** (free; Meta lifts
   messaging limits after business verification — also free, takes days;
   the test number works meanwhile).

## 4. Email (do this before launch — no domain needed!)

### Gmail SMTP — verification + OTP emails (free: ~500/day, NO domain)
1. Google Account → **Security** → 2-Step Verification **ON** → **App passwords**
   → Generate (name it "VeloSales Ai") → copy the 16-character code.
2. Paste as `EMAIL_SMTP_USER=you@gmail.com` + `EMAIL_SMTP_PASS=xxxx xxxx xxxx xxxx`
   (spaces don't matter) + `EMAIL_SMTP_HOST=smtp.gmail.com`.
3. Signup → real 6-digit codes land in REAL inboxes today. No domain, no card.
- Without ANY mail path: accounts auto-verify in dev (fine for testing, NEVER production!).

### Resend — verification + OTP emails (free: 100/day, needs YOUR domain later)
1. Sign up at https://resend.com → **API Keys** → Create → `RESEND_API_KEY`.
2. `EMAIL_FROM=VeloSales Ai <onboarding@resend.dev>` works for testing **only to your own inbox**
   (sandbox rule!) — verify your own domain at resend.com → Domains for real users.
3. SMTP wins when both are set. Either set = codes deliver.

## 4b. Bot wall (nothing to configure)

Login/signup/OTP/forgot sit behind rate limits (30 tries/15min per IP) plus a
5-attempt burn on OTP codes — enough for a shop app without a checkbox in the way.

## 4c. Phone-bar push (no vendor key — generate your own, FREE forever)

Web Push alerts owners on their phone notification bar even with the tab closed.
1. Run `npm run push:vapid` → paste `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` +
   `VAPID_SUBJECT=mailto:you@yourshop.com` into Render env → redeploy.
2. Open Profile → Phone alerts → Turn on (per browser — phone + laptop separately).
3. Every bell (quota limits, support replies, broadcasts) now ALSO pushes.
- HTTPS required (Render/Vercel have it). iOS needs the app installed to Home
  Screen (Apple's rule). Unset keys = bell only, nothing breaks.
- Native FCM (icon badges in the Play Store app) comes later — needs Firebase
  + Apple paperwork, a week by itself. Web push covers ~90% of the value now.

## 4d. Photos that survive redeploys (Cloudinary free tier)

Render's disk is wiped on every deploy — product + notice photos die with it.
1. Sign up at https://cloudinary.com (free) → Settings → Upload → Upload presets
   → Add → Signing Mode: **Unsigned** → copy the preset name.
2. Paste `CLOUDINARY_CLOUD_NAME` (dashboard top) + `CLOUDINARY_UPLOAD_PRESET`.
3. Unset = local disk (dev only!). After setting: re-upload one photo to confirm
   the URL is `res.cloudinary.com/...`.

## 4e. Uptime alerts (know before users complain — FREE, no code)

1. Sign up at https://uptimerobot.com (free: 50 monitors, 5-min checks).
2. Add monitor 1: `https://YOUR-BACKEND/health` (keyword: `ok`).
3. Add monitor 2: your Vercel login page URL (keyword: `VeloSales Ai`).
4. Alerts → your email/WhatsApp. Also switch Render off the Free plan (sleeping
   instances = 50s cold starts that look like outages) — Starter or higher.

## 5. Things that need NO key

- **Trial countdown + expiry bells** — built in, checked on every app load. No cron, no key.
- **In-app notification bell** — built in (the app polls every 60s).
- **Pay-once sales** — just create `vendorabot26@gmail.com` and set `SALES_EMAIL` to it.
- **Admin console** — set `ADMIN_PASSWORD` (long random string, password manager!).

## 6. Going live checklist

- [ ] `SESSION_SECRET` = long random string (production REFUSES to boot without it).
- [ ] Paystack `sk_live_...` + webhook URL set.
- [ ] Flutterwave live secret + secret hash + webhook URL set (if serving USD shops).
- [ ] `PUBLIC_BASE_URL=https://your-backend-url` (payment return pages).
- [ ] `FRONTEND_URL=https://your-frontend-url` (split deploy cookies).
- [ ] Gemini + Groq keys in place, test message answered in Playground.
- [ ] Meta Embedded Signup live (App ID + Configuration ID set, TEST message flips Connect to LIVE).
- [ ] Gmail SMTP (or Resend domain) live — sign up a test user with a REAL inbox, code arrives.
- [ ] `npm run push:vapid` → VAPID keys on Render → Profile → Phone alerts ON (test bell!).
- [ ] Cloudinary preset set → upload one product photo → URL is res.cloudinary.com.
- [ ] UptimeRobot watching /health + login page; Render off Free plan (no sleeping!).
- [ ] Hit a free limit on purpose (ask 50× / use Test-my-AIs in /admin) → Pro card shows.
