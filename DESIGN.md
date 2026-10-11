# DESIGN.md — VeloSales AI

Read this file before any UI work and follow it strictly. If something is not
specified here, ask before inventing it. Scope: `frontend/` only (not website/,
mobile/, or Admin).

## Direction — "Calm WhatsApp-native"
Neutral-first surfaces, one green accent reserved for CTAs and status, cyan
for AI/info. Synthesized from Dribbble's WhatsApp SaaS leaders (Wati:
neutral ground + electric green used sparingly + pill buttons; Interakt/
AiSensy UI kit: KPI-with-sparklines dashboard, 3-panel inbox) and 2026 SaaS
patterns (one north-star metric, progressive disclosure, AI summarizes
instead of dumping). The mint bento lives on the Dashboard Overview as the
one memorably-designed surface; everything else stays calm so the app feels
trustworthy, not decorated.

- One memorable thing per screen: the mint bento grid on Overview; the
  3-panel thread on Inbox; completeness badges on Catalog.
- Green (#25D366 family) appears on: primary CTAs, unread badges, online
  dots, success states. Everywhere else: neutrals.
- Everything the user reads or edits (lists, tables, forms, numbers, chat
  messages) sits on solid surfaces.
- Copy the visual language, never the brand: no Wati/Interakt names, logos,
  illustrations, or text. Real shop data only — never fake charts.

## Implementation rules (stack: React + Vite, hand-written CSS, NO new dependencies)
- No Tailwind, no shadcn, no icon packages, no CSS-in-JS.
- Tokens live in `:root` (light) and `[data-theme="dark"]` in styles.css.
  New work uses tokens only. No hex literals outside token blocks.
- New screen work uses scoped classes (`.hr-*`, `.wx-*`) so one screen can
  never break another. Global rewrites are forbidden.
- One icon module, outline style, single stroke width, round caps and joins.
- Breakpoints: 640px and 1024px (plus 390px check for inbox).
- Theme default follows the system setting and remembers the choice
  (shop owners work in bright sunlight — light must be first-class).

## Themes
Default to the system setting. Settings offers System / Light / Dark and
remembers the choice.

### Light tokens (actual code — `styles.css:19-47`)
- --green: #128c4a (primary CTA, unread, online) on --green-soft: #e7f6ec
- --ink: #101828; --muted: #667085; --faint: #98a2b3
- --line: #e5e7eb; --line-soft: #eef1f4 (borders, dividers)
- --bg: #f4f6f5 (page); --card: #ffffff (cards, forms, menus)
- --gold: #b54708 on --gold-bg: #fffaeb (needs attention, never errors)
- --red: #d92d20 on --red-bg: #fef3f2 (failed, destructive only)
- --blue: #175cd3 on --blue-bg: #eff8ff (info, links)
- Mint accent (Overview bento only): #d7f0e3 fill with #0e1a14 text,
  sky #8ed4f2 secondary ring — dark text on mint in BOTH themes.

### Dark tokens (actual code — `styles.css:740-752`)
- --green: #25d366 (full-strength WhatsApp green, never dimmed)
- --ink: #eaf3ed; --muted: #a9c6b4; --faint: #6f9180
- --line: #1d4030; --bg: #06110c; --card: #0b1e14
- --gold: #f5b041 on #2a1f08; --red: #ff7a70 on #2b1210; --blue: #7ab8ff
- Dark is designed, not inverted: surface separation via borders, softer
  shadows, charts re-checked per theme.

Check every text/background pair at 4.5:1 in both themes.

## Typography
- Font: Inter (Google Fonts), weights 400–800. Fallback system-ui.
- Scale: 12 caption / 14 body-sm / 16 body / 20 h4 / 25 h3 / 31 h2 / 39 h1.
  Body 16, line-height 1.5. One clear heading per page.
- Numbers: weight 600–700, `font-variant-numeric: tabular-nums`.
- Sentence case everywhere. No all-caps labels, no tracked eyebrows.

## Shape, spacing, depth
- Spacing base 4px: 4, 8, 12, 16, 20, 24, 32, 48.
- Radius: 999px buttons and pills and badges; 24px cards; 12px inputs and
  small components; 18–20px hero/bento panels.
- Cards: solid surface, 1px border, soft small shadow. Depth from borders
  and spacing, not heavy shadows.
- Desktop content max width 1160–1200px. Mobile page padding 16px.
- Touch targets at least 44px.

## Glass rules (accent only)
- Glass lives on: floating mobile bar, modals/sheets, profile overlay bars.
  Never on rows, tables, forms, chat bubbles, or numbers.
- Solid fallback via `@supports not (backdrop-filter)`.
- Max two blurred layers on screen. Respect
  `prefers-reduced-transparency` and `prefers-reduced-motion`.

## Components
### Dashboard Overview (mint bento — built)
- 3-column bento: profile card + numbers | activity timer + reply-mix
  donut + tasks timeline | activity heat grid + apps-with-rings.
- North-star metric leads (conversations / AI-handled %). Everything else
  is progressive disclosure below it.
- Heat/donut/rings visualize REAL counts only. No invented analytics.

### Inbox / Chats (next)
- Desktop 3-panel: conversation list (search, channel + AI/human filters,
  unread badges, labels) + WhatsApp-style thread (ticks, media, AI vs
  human-labeled messages) + contact side panel (profile, activity timeline).
- Mobile: list → thread, channel chips (All / WhatsApp / Telegram),
  per-thread AI/human takeover toggle, slide-up quick actions (smart
  replies, templates, catalog).
- Green reserved for unread + online + send. AI drafts visually distinct
  from sent messages.

### Catalog and tables
- Rows, not grids of identical cards. Thumbnail 44px, name, price, a
  completeness chip (missing price/stock flagged gold), a chevron.
- Search + filters on top, one clear Add product action.

### Connect / channels
- One card per channel: status, last successful event, Test connection,
  Connect/Reconnect/Disconnect. Plain-language errors, never raw tokens.

### Charts (Insights)
- Functional color only: green healthy, gold warning, red failure — always
  paired with an icon or label, never color alone.
- Dotted hairline gridlines, tabular numerals, labeled date ranges.

### Buttons
- Heights 44 / 48, fully rounded pills. Primary: green fill, white text.
  Secondary: surface with 1px border. Tertiary: text with clear hover.
- One primary per screen. Labels name the action ("Add product").
- States: hover, focus-visible (2px ring, 2px offset), pressed (scale
  0.97), disabled (50%), loading (spinner, width unchanged).

### Inputs and forms
- Labels above fields, 12px radius, correct mobile keyboard types.
- Validation beside the field with a fix. Preserve input on error.
- Focus: border-color change + soft glow. Placeholders are examples,
  never labels.

### Modals, sheets, toasts
- Modals/sheets: surface, 24px radius, grabber on mobile sheets, dimmed
  page behind. Toasts confirm lightweight actions only — never for
  critical errors that need attention.

### Empty states
- Outline icon, one line saying what is empty, one primary button saying
  what to do. New accounts get a guided first action, never an empty
  chart.

## Motion
- Only motion that answers an action: press, open, close, confirm, tab change.
- 140–220ms ease-out. Sheets slide up. Buttons scale to 0.97 on press.
- Respect `prefers-reduced-motion` globally in one place.

## Copy
- Sentence case, plain verbs, say what will happen. Errors say what went
  wrong and how to fix it. Real content only. No fake testimonials,
  countdowns, or "unlimited" claims.

## Don'ts (these make it look AI-made)
- No stacks of identical cards. North-star metric first, details on demand.
- No decorative gradients. No glass on readable content.
- No cards inside cards. No gray text on colored fills.
- No emoji as icons. Outline icons only, one stroke width.
- No numbered markers (01 / 02) unless the content is a real sequence.
- No new colors, radii, fonts, or shadows beyond this file.
- No fake analytics or placeholder data that looks real.

## Build order (ALL screens, sequenced — one gate per step)
0. Direction lock (this file) — approved before any UI change. DONE.
1. Token foundation: freeze values, remove dead overrides. Zero visual drift.
2. Shell: minimal sidebar, topbar with search + status, floating mobile bar.
3. Dashboard Overview: north-star + sparklines + quick actions (bento kept).
4. Inbox: 3-panel desktop, list→thread mobile, AI/human toggle.
5. Catalog, Connect, Playground.
6. Insights, Billing, Profile, Settings.
7. Login, Onboarding, Welcome, Notifications, Refer & Earn, Help.
8. Landing, FAQ, Privacy, Terms.
After each step: `npm run build` + detector clean + user reviews on phone
and desktop before the next step. Keep all behavior and API calls unchanged.
Commit after each step that works.
