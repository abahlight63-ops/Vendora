# WhatsApp AI Customer Support Tool (MVP)

AI auto-replies for small businesses on WhatsApp. Built per the MVP plan in
`whatsapp-ai-support-mvp-plan (1).md`.

## Stack

- Node.js + Express
- Twilio WhatsApp Business API (inbound webhooks + outbound sends)
- Postgres (local or Supabase)
- Claude API (`claude-3-5-haiku` by default) for replies

## How it works

1. Customer messages the business's WhatsApp number → Twilio POSTs to `/webhook/whatsapp`
2. The webhook parses sender + text, upserts a row in `conversations`
3. `replyEngine` sends the message + business config (name, hours, FAQs, tone) to Claude
4. Confident answer → reply sent back to the customer via Twilio
5. Unsure → conversation flagged (`needs_human = true`), customer gets a "we'll get back to you" message
6. `npm run digest:send` sends the owner a daily WhatsApp summary of flagged conversations

## Setup

```bash
npm install
cp .env.example .env    # then fill in DATABASE_URL, ANTHROPIC_API_KEY, Twilio keys
```

### 1. Database

- Local: create a database and set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/whatsapp_support`
- Supabase: copy the connection string from Project Settings → Database

Then:

```bash
npm run db:init    # create tables
npm run db:seed    # seed one test business
```

### 2. Twilio

1. Sign up at twilio.com, open **Messaging → Try it out → Send a WhatsApp message**
2. Join the sandbox from your phone (send the shown code to the sandbox number)
3. Set `TWILIO_WHATSAPP_NUMBER` to the sandbox number (e.g. `whatsapp:+14155238886`)
4. For the webhook, expose your local server with ngrok: `ngrok http 3000`
5. In the Twilio sandbox settings, set "When a message comes in" to `https://<ngrok-url>/webhook/whatsapp` (POST)

### 3. Claude API

Get a key at console.anthropic.com and set `ANTHROPIC_API_KEY` in `.env`.

### 4. Run

```bash
npm run dev
```

Then message the sandbox number from WhatsApp ("What are your prices?") — you should get an AI reply built from the seeded FAQ.

## Daily digest

Schedule `npm run digest:send` daily (Railway cron, GitHub Actions, or Task Scheduler).
It sends `OWNER_WHATSAPP` a summary of all conversations flagged in the last 24 hours.

## The product catalog & LEARN mode

The AI answers customers **strictly from each business's product catalog** — it never
invents prices or availability, and hands off to the owner for anything else.

**Teaching the bot:** the business owner sends a WhatsApp message to their own
business number starting with `LEARN:` followed by their normal ad text, e.g.:

```
LEARN: New stock! Bone straight wig 20" ₦95,000, silk press ₦15,000, knotless braids ₦25,000
```

The AI extracts the products/prices and updates the catalog automatically, then
confirms with a summary. The same product updated again just overwrites the price.
LEARN only works from the business's registered `owner_number` — customers can't use it.

## AI provider

Set in `.env`:
- `AI_PROVIDER=claude` (default) — best quality; `claude-3-5-haiku` is cheap at MVP scale
- `AI_PROVIDER=gemini` — cheapest option with a generous free tier; set `GEMINI_API_KEY`

You can switch providers with one line — no code changes. At MVP volume (under a few
thousand messages/month) either provider costs roughly $0–5/month.

## Configuring a business

Two ways:

1. **Onboarding form** (recommended for owners): run the server and open
   `http://localhost:3000/admin`. Set `ADMIN_API_KEY` in `.env` and enter it in the
   form — it creates or updates the business config (name, WhatsApp number, hours,
   FAQ list, tone).
2. **API** — with the `x-admin-key` header:
   - `POST /api/businesses` — create (JSON: name, whatsapp_number, hours, faq[], tone)
   - `PUT /api/businesses/:id` — update
   - `GET /api/businesses` — list
3. **Seed script**: `npm run db:seed` seeds one test business for development.

`whatsapp_number` must match the Twilio `To` field exactly, including the
`whatsapp:` prefix. Config is read fresh on every incoming message.

## Project structure

```
src/server.js          Express server + webhook route
src/webhook.js         Twilio payload parsing, message storage, reply sending
src/replyEngine.js     Claude API call + NEED_HUMAN confidence handling
src/configService.js   Business config lookup + schema
src/adminRoutes.js     Admin API for business config (protected by ADMIN_API_KEY)
src/digest.js          Daily flagged-conversation digest
public/admin.html      Owner onboarding form (served at /admin)
scripts/schema.js      Creates tables
scripts/seed.js        Seeds a test business
```

## Not in v1 (per plan)

Multi-language, payments, Instagram, analytics, dashboards, multi-agent.
