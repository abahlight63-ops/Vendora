# Channels roadmap — architecture, not promises

Two channels are live today (WhatsApp Cloud API + Telegram). This document is the
blueprint for the next ones, written down **before** any of it is built so the
design decisions are reviewable instead of archaeology.

Nothing here is committed to a date. Everything here is decided in terms of the
shape the code already has.

---

## The shape every channel must fit

The codebase already forced this shape via WhatsApp and Telegram. A new channel
is not free-form work: it plugs into five seams and inherits the rest.

| Seam | File | Contract |
|---|---|---|
| Inbound webhook | `src/routes/<channel>Routes.js` | Verify authenticity, normalize to one internal shape, hand to the brain |
| Channel adapter | `src/services/channels/<channel>.js` | Send text/media, read creds, report health |
| Connection status | `src/services/channels/status.js` | `connected` / `reason`, surfaced verbatim in Connect |
| Self-heal | `src/services/telegramSelfHeal.js` (pattern to copy) | Detect drift, repair, never silently degrade |
| Ownership | `src/controllers/webhookController.js` | Shared owner gate — never a channel-specific copy |

The normalization step is the important one. Every inbound message becomes the
same internal message shape before the brain sees it, which is why adding a
channel does **not** mean touching the brain, the catalog, or the billing logic.

### Non-negotiables learned the hard way

These are the rules that cost real debugging time. They apply to every channel
added from here on.

1. **Never trust a stored token.** Check liveness on read, repair on failure,
   and tell the owner the truth (`healHook` in `telegramSelfHeal.js` is the
   reference implementation).
2. **Never drop queued messages during a repair.** Telegram takes
   `drop_pending_updates: false` for exactly this reason. A "repair" that
   silently discards a customer's unanswered question is a data-loss bug wearing
   a self-healing hat.
3. **Verify the write, don't assume it.** Every repair re-reads the remote state
   and compares it to the exact expected URL. Optimistic UI lies; the API does not.
4. **Owner commands need identity, not position.** A group chat means any member
   can type. Gate on `fromId`/`chatId` matching the stored owner id
   (`isOwner` in `webhookController.js`) — never on "the message came from the
   configured chat".
5. **Full-page OAuth on phones.** Embedded/popup flows do not survive a mobile
   browser, an installed web app, or an in-app webview. Mobile must be a
   redirect with a single-use signed state (`metaOAuth.js` is the reference).
6. **Bounded fleets.** A daily loop over every tenant must have a concurrency cap
   and a wall-clock budget, or one slow API stalls the watchdog for everyone.
7. **Owner-visible failures.** A 502 that says *"Token saved, but the delivery
   hook was refused"* is a feature. Silent partial success is a bug.

---

## Messenger — next up

**Why next:** it is Meta, so it shares an app, an OAuth surface, and a WABA-shaped
credential concept with WhatsApp. It is the cheapest correct addition.

**Connect:** Meta OAuth redirect (same `state` machinery as WhatsApp; the pages
are namespaced per product). Page selection comes back in the callback.

**Inbound:** `GET`/`POST /api/messenger/events` — verify `X-Hub-Signature-256`
with the app secret, dedupe on `message.mid`, respond `200` fast and process
asynchronously. Messenger's 20-second window does not tolerate an LLM call
inline.

**Adapter:** Graph Send API (`/me/messages`). Text, image, audio, and quick
replies are enough for v1.

**Watch out for:**
- **24-hour messaging window.** Outside it, messages must be tagged
  `message_tag`. This is the single most common Messenger bug.
- **Conversations are per-page, per-user.** Routing needs the PSID threaded
  through, not just a page id.
- **Rate limits are per-page and bursty.** Share the bounded-fleet pattern.

---

## Email — highest user value, most work

**Why it's the biggest:** email is where customers actually expect to reach a
business, and it is the only channel here without a platform-imposed UI.

**Connect:** IMAP/SMTP credentials, or a provider OAuth (Google/Microsoft). IMAP
is universal and needs no review; OAuth is nicer and needs none of your
customers to hand you passwords. Ship IMAP first, OAuth second.

**Inbound:** a poller (or provider webhook) → parse MIME → strip quoted
replies and signatures → normalize to the internal message shape.

**Outbound:** SMTP with a real SPF/DKIM/DMARC setup. Reply threading via
`In-Reply-To`/`References` so the conversation reads as a conversation.

**Watch out for:**
- **Spam reputation.** A shared IP will burn the domain. Warm up, and consider a
  dedicated sending subdomain.
- **MIME is an attack surface.** Strip HTML aggressively and never render it.
- **No delivery receipts means no self-heal.** The Telegram self-heal pattern
  does not port. Bounce/complaint webhooks are the substitute — build the
  health check around them.

---

## TikTok — last, and deliberately

**Why last:** it is the only channel here that is *primarily* a marketing
surface with a messaging feature bolted on, not a support inbox.

**Connect:** TikTok OAuth for Business with a marketing-scope app review.

**Inbound:** the Messaging API webhook, plus the comment/DM event set.

**Watch out for:**
- **Review timelines and permission scope** are the long pole, not code.
- **Messaging features are unevenly available by region.** Do not promise
  parity with WhatsApp.
- Content policy for AI-generated replies is stricter than for human agents.

---

## What "done" means for a channel

A channel is not done when the first message arrives. It is done when it has:

- [ ] A real connect flow that works on a **phone**, not just desktop
- [ ] Health check + one-tap repair, with the **exact** expected config echoed
- [ ] Owner gate that survives **group chats**
- [ ] Owner commands (`LEARN:`, `SYNC:`, `PAUSE`) working identically to Telegram
- [ ] Catalog + products working over the channel
- [ ] Truthful status copy in Connect ("live" means verified, not "saved")
- [ ] Tests covering the failure paths, not just the happy path

Telegram shipped with 43 assertions covering exactly these failure paths before
it was called done. That is the bar.
