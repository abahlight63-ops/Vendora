# WhatsApp AI Customer Support Tool — MVP Build Plan

Target market: small businesses in Nigeria/Africa (shops, salons, online sellers) using WhatsApp for sales/support.

---

## 1. Core MVP Feature Set (build only this first)

Keep this brutally small — one working flow, one business type to start.

- **WhatsApp Business API connection** — receive and send messages via a business number
- **AI auto-reply engine** — answers common questions (hours, prices, availability, delivery info) using info the business owner provides
- **Order/inquiry capture** — logs customer name, request, and contact so the owner can follow up
- **Human handoff** — if the AI can't confidently answer, it flags the conversation for the business owner instead of guessing
- **Simple owner dashboard or digest** — even a daily WhatsApp/email summary of conversations is enough for v1; a full dashboard can come later

**Explicitly NOT in v1:** multi-language support, payment integration, Instagram integration, analytics, multi-agent handling. Add these only after your first paying customers ask for them.

---

## 2. Suggested Tech Stack

- **WhatsApp Business API access** via a provider like Twilio, Meta Cloud API (direct), or 360dialog — these give you the messaging infrastructure without building it from scratch
- **Backend**: Node.js or Python — whichever your dev is faster in
- **AI layer**: Claude API (Claude Sonnet/Haiku depending on cost needs) for the response generation
- **Database**: simple hosted Postgres (e.g. Supabase or Railway) to store conversations/business config
- **Hosting**: a basic cloud host (Railway, Render, or a cheap VPS) — no need for anything elaborate at MVP stage

---

## 3. Claude Code Starter Prompts

Use these directly in Claude Code to start scaffolding. Do them in order — don't try to build everything in one prompt.

**Prompt 1 — Project scaffold**
```
Set up a new Node.js backend project for a WhatsApp AI customer support tool.
It needs to: receive incoming WhatsApp messages via webhook (I'll be using
[Twilio/Meta Cloud API — pick one]), store conversations in Postgres, and
call the Claude API to generate a reply. Set up the folder structure,
package.json, environment variable handling, and a basic Express server
with a placeholder webhook route. Include a README explaining how to run
it locally.
```

**Prompt 2 — WhatsApp webhook integration**
```
Implement the WhatsApp webhook handler in [file]. It should receive
incoming message payloads from [Twilio/Meta Cloud API], parse the sender
number and message text, save the message to the conversations table,
and pass it to a reply-generation function (to be built next). Include
error handling for malformed payloads.
```

**Prompt 3 — AI reply logic**
```
Build a reply-generation function that takes a customer message and the
business's config (business name, hours, FAQ list, tone) and calls the
Claude API to generate a helpful response. If the model isn't confident
it has the right answer, it should return a flag instead of a reply, so
we can route that conversation to the human owner. Write this as a
standalone module I can test independently.
```

**Prompt 4 — Business config + onboarding**
```
Create a simple way for a business owner to input their config — business
name, hours, FAQ answers, tone/personality for replies. This can be a
JSON file or a basic form-backed database table for now, not a full
dashboard. Include a script to seed one test business's config for
development.
```

**Prompt 5 — Human handoff + digest**
```
Add a daily digest feature: at a set time, send the business owner a
summary (via WhatsApp or email) of conversations that were flagged for
human follow-up, with customer name/number and what they asked. Keep it
simple — no dashboard needed yet.
```

Once these five are working end-to-end with one test business, you have a real, demoable MVP.

---

## 4. Costing (MVP build + first 3 months running)

| Item | Cost | Notes |
|---|---|---|
| WhatsApp Business API access (Twilio or 360dialog) | $0–20/month to start | Usage-based; pay per conversation once live, minimal at low volume |
| Claude API usage | $10–30/month at MVP scale | Depends on message volume; cheap model tier is enough for FAQ-style replies |
| Hosting (Railway/Render) | $5–15/month | Free tiers often cover MVP testing |
| Database (Supabase free tier) | $0 | Free tier sufficient until real scale |
| Domain (optional, for a simple landing page) | $10–15/year | Only needed once you're pitching to businesses |
| **Total to build + run MVP for 3 months** | **~$50–150 total** | Far cheaper than the game hardware — this can realistically be self-funded from what you already have |

**No new hardware needed** — this runs fine on the dev PC you're already planning to get, and doesn't require the artist/videographer machines at all.

---

## 5. Path to first revenue

1. Build MVP with one test business (can be a friend's shop, or simulate one yourself)
2. Approach 5-10 real small businesses directly (market sellers, salons, Instagram shops) — offer free trial for 2-4 weeks
3. Once a business sees it saving them time/catching missed messages, convert to paid — ₦5,000-15,000/month is a realistic starting price point
4. Use early revenue to fund both this tool's growth AND the game studio hardware
