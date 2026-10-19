# DESIGN.md — VeloSales AI

Read this file before any UI work and follow it strictly. Scope: `frontend/` and
`mobile/` — the two clients are one product, so every rule here binds both.
Web tokens live in `frontend/src/styles.css`; the phone's copies live in
`mobile/lib/theme.dart` and must hold the same values.
If something is not specified here, ask before inventing it.

**Mode:** Operate (dashboard, inbox, catalog, tools) + Persuade (landing/legal).
**Stack:** React + Vite, hand-written CSS. NO new dependencies (no Tailwind, no
shadcn, no icon packages, no CSS-in-JS).
**Logo:** the VeloSales AI mark — hexagonal frame, nested chevrons, centre
diamond, side bars. Source artwork is the designer vector kit in `files (2)/`
(gold); recoloured to the purple primary.

## Direction — "Premium Nigerian SaaS"

One visual system across every screen. Clean, generous whitespace, subtle
shadows, rounded everything, indigo primary. No liquid-glass overlay, no
neumorphism, no random gradients, no stacked identical cards. Real shop data
only — no fake charts, no invented numbers.

The look comes from the founder's reference dashboard (a dark-indigo rail,
white cards floating on a faintly lilac canvas, amber and green used only
semantically) plus the founder's Flowify reference for the marketing surfaces
(light background, white cards, pill buttons, generous border-radius, big
headlines, sentence case).

### Parity — one product, two clients
Every visual decision lands on **both** the web app (`frontend/`) and the phone
app (`mobile/`), in the same review pass. Login and sign-up are the only
exception: the phone uses a native auth flow, the web a page. If a page has a
different shape on the phone (a list instead of a table, a bottom sheet instead
of a popover), the words, order, states and emphasis still match — and so does
every empty, loading and error state. A screen that exists on one client only is
a bug, not a bonus.

### Colour — the reasoning (locked 2026-10, from the reference video)

- **Indigo is authority.** It reads as competent, calm and expensive, and it is
  the only hue that stays legible as text on white *and* as a fill under white
  text. So it owns every action the owner should take, and nothing else does.
- **The rail is deep indigo.** Dark chrome turns the nav into a frame; white
  content on a faintly lilac canvas becomes "the paper". The eye lands on the
  numbers and the inbox, not on the chrome. It also survives phone glare far
  better than a white column.
- **The canvas is warm off-white, not blue-white.** Clinical blue-white reads
  machine-made. A 2° shift toward violet ties the page to the brand for free.
- **Amber is money and attention** — the colour of a Naira note and of a warning
  lamp. It means "a decision is needed". It never means "something broke".
- **Green is only ever "it worked"**: success, online, KPI up, a tick.
- **Red is failure and destruction.** Never decoration.

- **One memorable thing per screen.** Overview leads with the north-star metric
  card; Inbox leads with the thread; Catalog leads with completeness.
- Purple appears on: primary CTAs, active nav, focus rings, info status,
  outbound chat. Everywhere else: neutrals.
- Everything the user reads or edits (lists, tables, forms, numbers, chat
  messages) sits on solid surfaces.
- Copy the visual language, never the brand: no Flowify/Venture Harbour names,
  logos, illustrations, or text. Real shop data only — never fake charts.

## Tokens (frontend/src/styles.css)

Tokens live in `:root` (light) and `[data-theme="dark"]`. New work uses tokens
only. No hex literals outside token blocks.

### Light tokens
- --purple: #5b4bd6 (primary accent, focus) · --purple-dark: #4938b4 (hover/pressed)
- --purple-soft: #efebfe (active nav, outbound chat, info chips) · --purple-line: #cfc6f8
- --accent-solid: #4f3fc7 · --accent-solid-hover: #4133a4 (white text on both, both themes)
- --rail-1 #352a7f → --rail-2 #221a56 → --rail-3 #1a1443 (the sidebar/drawer gradient,
  top-lit so the brand reads as nearest). Rail ink/muted/faint/line/hover/active:
  #f4f2fe / #b4aede / #847cb8 / rgba(255,255,255,.10) / .08 / .15
- --ink: #171532; --muted: #6b6885; --faint: #9693ac
- --line: #e7e5f0; --line-soft: #f2f1f8 (borders, dividers)
- --bg: #f7f6fb (page); --card: #ffffff (cards, forms, menus)
- --green: #10b981 on --green-soft: #d1fae5; --green-dark: #059669 (success, KPI-up)
- --gold: #d97706 on --gold-bg: #fffbeb; --gold-line: #fcd34d (needs attention, never errors)
- --red: #dc2626 on --red-bg: #fef2f2; --red-line: #fca5a5 (failed, destructive only)
- --blue: #2563eb on --blue-bg: #eff6ff (info, links)

### Dark tokens
- --purple: #8b7ff0 (never dimmed below 4.5:1), --purple-soft: #221c4d
- --ink: #f2f1fa; --muted: #a5a1c0; --faint: #6f6b8c
- --line: #272346; --line-soft: #1c1934
- --bg: #0e0c1d; --card: #181530
- rail drops a shade below the page (--rail-1 #2b2269 → --rail-3 #120e33)
- --green: #34d399; --gold: #fbbf24 on #2a1f08; --red: #f87171 on #2b1210; --blue: #60a5fa
- Dark is designed, not inverted: surface separation via borders, softer shadows.

The mark's ramp (`.vl-root`) lives in the same two blocks; the rail is dark in
BOTH themes, so a mark sitting on it uses the dark ramp via
`.sidebar .vl-root` (declared after the theme blocks so source order wins).

Check every text/background pair at 4.5:1 in both themes.

## Typography
- Font: Manrope (Google Fonts), weights 400–800. Fallback system-ui.
  (Not Inter/Roboto/Geist/Plus Jakarta/Space Grotesk — those read as generic AI UI.)
- Scale: 12 caption / 14 body-sm / 16 body / 20 h4 / 25 h3 / 31 h2 / 39 h1.
  Body 16, line-height 1.5. One clear heading per page.
- Headlines: weight 700–800, tight letter-spacing (-0.4px).
- Numbers: weight 600–700, `font-variant-numeric: tabular-nums`.
- Sentence case everywhere. No all-caps labels, no tracked eyebrows.

## Shape, spacing, depth
- Spacing base 4px: 4, 8, 12, 16, 20, 24, 32, 48.
- Radius: 999px buttons/pills/badges; 16px cards; 10px inputs and small
  components; 20px hero/bento panels.
- Cards: solid surface, 1px border, soft small shadow. Depth from borders
  and spacing, not heavy shadows.
- Desktop content max width 1160–1200px. Mobile page padding 16px.
- Touch targets at least 44px.

## Glass rules
- Glass is retired in the app UI. No `backdrop-filter` on cards, rows, tables,
  forms, chat bubbles, or numbers. (The old liquid-glass layer is removed.)
- Auth/landing may use one soft gradient backdrop, nothing more.

## Components
### Brand mark
- Two files, one shape. `frontend/src/components/Logo.jsx` inlines the SVG for
  React surfaces (sidebar, auth, landing); `frontend/public/logo.svg` is the
  standalone copy for `<img>`, the splash, and anything outside React.
- The component ships **no colour of its own** — colour lives only in
  `.vl-root` / `[data-theme="dark"] .vl-root` in styles.css. Never hard-code a
  fill in `Logo.jsx`; change the two token blocks instead.
- Shape is the designer kit in `files (2)/` (gold) with the ramp swapped to
  purple. Do not redraw it.
- App icons: `frontend/public/favicon.svg` is the master (rounded tile, inset
  purple mark, border). The PNG set + `favicon.ico` are generated from it —
  never hand-edit the PNGs.
- Mark + wordmark: mark 34px, gap 10px, wordmark 15.5px/700 at -0.2px.
- Clear space around the mark = 25% of its width. Never put it on the accent
  fill (purple-on-purple disappears); put it on a surface.

### Shell
- Left sidebar 232px, deep-indigo rail (top-lit gradient), grouped nav, footer.
  Brand + nav rows sit ON the rail; the rail is dark in both themes.
- Topbar: breadcrumb + business name, centered page search, right cluster
  (AI status pill, notifications bell, theme toggle, avatar, sign out).
- Mobile: slide-out drawer (same indigo rail) + 5-item bottom bar + footer links.

### Dropdowns
- ONE control, everywhere: `frontend/src/components/Select.jsx` (web) and
  `mobile/lib/widgets/app_select.dart` (phone). A native `<select>` or
  `DropdownButtonFormField` hands the menu to the operating system and looks a
  decade older than the rest of the app — never use one for a real choice.
- Web opens a card (14px radius, one shadow, a tick on the current choice);
  phone opens a bottom sheet with full-width rows, a hint line and a lock.
- Keyboard/web: Enter/Space opens, ↑/↓ moves, Enter picks, Esc closes.
- Anything that picks an AI brain shows the TIER (Fast / Normal / Smart).
  The engine's real name never reaches the UI.

### Dashboard Overview (built first)
- Hero: greeting + business name + primary "Test bot" action.
- North-star stat row: conversations, products live, handled-by-AI %.
- Main grid: activity sparkline, reply-mix donut, tasks timeline.
- Right column: busy-hours heat grid, connected apps with progress rings.
- Everything visualizes REAL counts only. No invented analytics.

### Inbox / Chats
- Desktop 3-panel: conversation list (search, channel + AI/human filters,
  unread badges) + thread (ticks, media, AI vs human-labeled messages) +
  contact side panel.
- Mobile: list -> thread, per-thread AI/human takeover toggle.
- Purple reserved for outbound + send. AI drafts visually distinct.

### Catalog
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
- Heights 44 / 48, fully rounded pills. Primary: purple fill, white text.
  Secondary: surface with 1px border. Tertiary: text with clear hover.
- One primary per screen. Labels name the action ("Add product").
- States: hover, focus-visible (2px ring, 2px offset), pressed (scale 0.97),
  disabled (50%), loading (spinner, width unchanged).

### Inputs and forms
- Labels above fields, 10px radius, correct mobile keyboard types.
- Validation beside the field with a fix. Preserve input on error.
- Focus: border-color change + soft glow. Placeholders are examples, never labels.

### Stat cards
- Big number (h2/h1), small uppercase label, optional green trend badge,
  optional sparkline. Card surface, 1px border.

### Modals, sheets, toasts
- Modals/sheets: surface, 16px radius, grabber on mobile sheets, dimmed page.
  Toasts confirm lightweight actions only — never for critical errors.
- Anything that ends a session asks first: "Sign out of VeloSales Ai?" with the
  reassuring line that the shop keeps answering, then Stay / Sign out. Both
  clients use the same words. The dialog is not red — leaving is routine, and a
  red alarm would punish a normal tap.

### Welcome tour (web + phone)
- Six slides, one idea each, shown once after sign-up, then never unprompted.
  Order on both clients: splash → tour → 5-question setup → dashboard.
- The art is the product: a phone that types the customer's message, then lands
  the answer. No stock photography — a smiling stranger teaches nothing.
- Copy types itself behind a caret; the art replays from the first frame when
  the slide is revisited or the art is tapped (phone says so in 10.5px type).
- Each slide ends with one honest footnote (free plan, no card, cancel anytime)
  — never a fake claim. Progress is six segments, plus "n of 6".
- The primary action is full-width on slide 1 and shares the row with Back
  afterwards; never a lone pill pinned to one side.
- Replayable from Help → "See the tour again" (phone) whenever someone asks.

### Empty states
- Outline icon, one line saying what is empty, one primary button saying what
  to do. New accounts get a guided first action, never an empty chart.

## Motion
- Only motion that answers an action: press, open, close, confirm, tab change.
- 140–220ms ease-out. Sheets slide up. Buttons scale to 0.97 on press.
- Respect `prefers-reduced-motion` globally in one place.
- No decorative loops or pulse animations.

## Copy
- Sentence case, plain verbs, say what will happen. Errors say what went wrong
  and how to fix it. Real content only. No fake testimonials, countdowns, or
  "unlimited" claims.

## Don'ts (these make it look AI-made)
- No stacks of identical cards. North-star metric first, details on demand.
- No decorative gradients (except one hero highlight if it matches the ref).
- No glass on readable content. No cards inside cards. No gray text on fills.
- No emoji as icons. Outline icons only, one stroke width.
- No numbered markers (01 / 02) unless the content is a real sequence.
- No new colors, radii, fonts, or shadows beyond this file.
- No fake analytics or placeholder data that looks real.
- No layered `!important` overrides fighting the base tokens.

## Build order (ALL screens, sequenced — one gate per step)

`[x]` = shipped on `main` · `[ ]` = not started. One step per review gate.

- [x] 0. Direction lock (this file).
- [x] 1. Token foundation: freeze values, remove the liquid-glass overrides.
- [x] 2. Shell: sidebar, topbar with search + status, floating mobile bar.
- [x] 3. Dashboard Overview + brand mark: hero, real KPIs, 7-day activity,
      reply-mix donut, and the purple logo/icon set.
- [x] 4. Shell retint + the app's one dropdown + Refer & Earn (web + phone).
- [ ] 5. Inbox: 3-panel desktop, list->thread mobile, AI/human toggle. **← NEXT**
- [ ] 6. Catalog, Connect, Playground. (Connect + Catalog shipped on both
      clients; Playground not re-reviewed.)
- [x] 7. Insights (incl. the inactivity record), Billing (billing card +
      history), AI settings (the model picker) — web and phone.
- [x] 8. Login, Onboarding, Welcome, Notifications, Help install icon — web and
      phone (the phone gained its own six-slide welcome tour, Oct 2026).
- [ ] 9. Landing, FAQ, Privacy, Terms.
- [ ] 10. `website/` marketing site — port to these tokens (still the old green).

After each step: `npm run build` + detector clean + user reviews on phone and
desktop before the next step. Keep all behavior and API calls unchanged.
Commit after each step that works.
