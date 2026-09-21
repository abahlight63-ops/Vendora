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
