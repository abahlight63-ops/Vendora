# V2 Features (later — NOT building now)

Owner's parking lot for the next release wave. Each item gets specced +
built only when promoted out of here.

## 1. Instagram channel (DM salesmate + comments)

**Why:** sellers live on IG; same Velo brain, new transport. `generateReply`
is channel-agnostic — only the transport layer is new (~70% mirrors
`src/services/channels/meta.js`, same Graph API family).

**Phase 1 — DM salesmate (MVP):**
- `src/services/channels/instagram.js`: `sendText(pageToken, igsid, text)`,
  `parseInbound` (object `instagram` → `entry.messaging[]`),
  `checkCredentials` (token → Page → attached IG business account; missing
  link → seller-facing 2-minute fix instructions).
- DB: `ig_page_id` + `ig_page_token` on businesses;
  `conversations.channel = 'instagram'` (column already exists).
- Webhook `POST /webhook/instagram` — Meta calls ONE app URL; route by
  recipient Page ID → shop. Single `INSTAGRAM_VERIFY_TOKEN` env.
- `POST /me/instagram/link` { page_id, token } + disconnect + status in
  `channelsStatus`; Connect page gets a third card (paste-first, FB Login later).
- Quotas reuse the same reply budget (no new billing logic).

**Phase 2 — comments (heavier Meta review):**
- Subscribe to the `comments` field; private-reply API + spam hide.
- Needs `instagram_manage_comments` → stricter app review, ships after DMs.

**Heads-ups:**
- Meta app review ~1–2 weeks (permissions + business verification +
  data-deletion callback; `/privacy` already covers one requirement).
- Page tokens expire — store long-lived tokens + refresh cron.
- 24h messaging window: replies always fine; proactive ComeBack nudges only
  inside 24h unless the human-agent tag is granted.
- Unknown Page linkage across sellers → onboarding teaches linking + the
  API error path detects unlinked accounts with fix steps.

**Meta app checklist (when we start):** create app → add Messenger product →
request `instagram_manage_messages` (+ `instagram_manage_comments` for P2) →
link test Page + IG professional account → webhook verify → submit review.

---

## 2. Shop Pages: a one-page mini site that sells by chat

**Why:** most Nigerian shops have Instagram and WhatsApp but no website. A
Shop Page gives every shop a beautiful, fast, one-screen site whose main job
is to answer customers through Velo. It is a "link in bio" that actually sells.
Example: `velosalesai.com.ng/amaka-hair`.

**What a visitor sees (one scroll on a phone):**
1. **Header:** shop logo, name, a one-line bio, a "Velo is online" dot and
   today's opening hours ("Open now · closes 7pm").
2. **The chat, front and centre:** a large chat box with starter buttons built
   from the shop's own data: "What's the price of…", "Do you deliver to
   Lekki?", "How do I pay?", "Is it available?". Velo answers using the same
   brain as WhatsApp and Telegram: catalog prices, delivery fees, payment
   details, human tone, drafted orders.
3. **Best sellers:** up to 6 product cards from the catalog (photo, name,
   price, "Ask about this"), which opens the chat with that product filled in.
4. **Other ways to reach us:** WhatsApp and Telegram buttons (the Telegram one
   uses the shop's shared-bot link), plus the shop's QR poster to download.
5. **Shop details:** location, pickup, delivery areas and fees, returns,
   pulled from Settings → Shop, so nothing is typed twice.
6. **Footer:** "Answered by VeloSales Ai" (removable on Pro). This line is
   also free marketing: every visitor sees where the shop got its assistant.

**Templates (the owner picks one; all are mobile-first and load in under 1s):**
| Template | Look | Suits |
|---|---|---|
| **Glow** | soft gradient, rounded glass cards (the app's style) | beauty, hair, fashion |
| **Clean** | white, big product photos | gadgets, stores, wholesale |
| **Bold** | dark background, neon accents | sneakers, thrift, events |
| **Warm** | cream and earth tones | food, cakes, crafts |
Each template takes the shop's own colour as the accent (picked from the logo).

**Owner controls (one screen in the app, live preview on a phone frame):**
- Page address (`/amaka-hair`, checked for clashes and bad words)
- Template + accent colour, cover photo, bio, which products to feature
- Starter questions (auto-suggested, editable)
- Switch the page on or off; see visits, chats started, orders drafted
- Share buttons: copy link, WhatsApp Status image, Instagram story image, QR

**How the chat works:**
- Visitor messages go to `POST /api/site/:slug/message`; the reply comes back
  in the same request (or streams), so there is no login and no app.
- Each visitor gets an anonymous id kept in their browser, so a returning
  visitor continues the same conversation.
- When the visitor shows buying interest, Velo asks for a WhatsApp number
  ("so we can confirm your order"). Then the chat continues on WhatsApp and
  the order is drafted as usual.
- The chat appears in the owner's Inbox labelled **Website**; the owner can
  take over live.
- Replies count toward the shop's daily reply limit.

**Website bubble (for shops that already have a site):** one line to paste:
`<script src="https://app.velosalesai.com.ng/bubble.js" data-shop="amaka-hair" async></script>`
It adds a small Velo bubble that opens the same chat. Works on WordPress,
Wix, Shopify, Squarespace, Selar and plain HTML.

**Protections:** per-visitor and per-shop rate limits, a hidden spam trap and
a lightweight "are you human" check after many messages, no cookies (no
consent banner needed on the shop's page), all owner data read-only to
visitors, and the page never shows the owner's phone number unless they
choose to.

**SEO and speed:** pages are server-rendered with the shop's name, products
and location in the title and description, so they can show up on Google
("Amaka Hair Lekki"). Images go through Cloudinary at phone sizes.

**Later (Pro):** custom domain (`shop.amakahair.com`) via Cloudflare for SaaS:
the first 100 custom domains are free, then about $0.10 per domain a month.

**Plans (suggested):**
| | Free | Plus | Pro |
|---|---|---|---|
| Shop Page | 1 template, "Answered by VeloSales Ai" footer | all templates | all templates, no footer, custom domain |
| Website bubble | – | yes | yes |
| Visit and chat stats | basic | full | full |

**Cost to run:** nothing new except the usual AI cost per reply and a little
hosting traffic. No approval from Meta, Google or anyone else.

**Build size:** about one week: public page + 4 templates, chat endpoint,
Inbox "Website" channel, owner editor with live preview, bubble script, stats.

---

## 3. Email: Velo answers customer emails

**What the shop gets:** an inbox address, for example
`amaka-hair@inbox.velosalesai.com.ng`. The shop either shares it directly or
forwards its existing Gmail to it (Gmail setting, about 2 minutes, free).

**How an email flows:**
1. Email arrives at Cloudflare Email Routing (free; the domain is already on
   Cloudflare) → a small Cloudflare Email Worker → the server's webhook.
2. The server strips quoted history and signatures, reads photos, and keeps
   threads together using the email's Message-ID / In-Reply-To.
3. Velo writes the reply in a slightly more formal tone.
4. The chat appears in the Inbox labelled **Email**; replies to the reply land
   in the same conversation.

**Who the reply comes from (three levels):**
| Level | Customer sees | What it needs | Cost |
|---|---|---|---|
| 1. Inbox address (start here) | "Amaka Hair" <amaka-hair@inbox.velosalesai.com.ng> | SPF, DKIM and DMARC records on the inbox domain | Resend: free up to 3,000 emails a month, then about $20 a month |
| 2. The shop's own Gmail, send-only | "Amaka Hair" <amaka@gmail.com> | Shop connects Gmail with Google sign-in; Velo asks only for the `gmail.send` permission. Incoming mail still arrives by forwarding. | Free. Google classes `gmail.send` as **sensitive**: verification (a written reason + a demo video, days to a few weeks), **no paid security assessment** |
| 3. Read and send inside the shop's Gmail | same as level 2 | Restricted Gmail permissions (read, modify) | Needs a yearly paid security assessment (CASA). Quoted prices vary from about $500 to $75,000 a year. **Avoid: level 2 gives the same result to customers.** |

Do not ask for `gmail.compose`: it also sends, but Google treats it as
restricted, which would trigger the paid assessment.

**Safety rules:**
- Never reply to robots: skip "no-reply" senders, mailing lists
  (List-Unsubscribe), bulk mail (Precedence: bulk) and auto-replies
  (Auto-Submitted, out-of-office). This prevents two auto-responders
  replying to each other forever.
- One automatic reply per thread per hour at most; a daily cap per shop.
- Default mode: **Velo drafts, the owner taps Send** (switch to fully
  automatic in Settings). Email is slower and more formal than chat.
- Attachments: photos are read (product questions, payment proof → owner
  alert); other files are noted, never opened.

**Plans (suggested):** Plus and Pro.

**Build size:** about one week for level 1 (inbound worker, parsing,
threading, robot filter, draft-and-send, Inbox channel). Level 2 adds about
3 days of work plus Google's verification wait.

---

**Suggested order for version 2:** Shop Pages first (fastest, no approvals,
useful to every shop), then Email level 1, then Instagram/Messenger once Meta
approves the app, then Email level 2.
