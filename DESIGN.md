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

### Colour — coral + indigo (locked with the owner, 2026-11)

**The one rule: indigo shows where you are and what is true. Coral shows what to
do next.** Coral is warm and human, indigo is trust and competence.

- **Indigo** owns the logo, the current tab, links, focus rings and meters.
- **Coral** owns main buttons, "needs you" and the upgrade prompt. Light mode uses
  #D03C16 with white text (4.84:1). Dark mode uses #FF8A6B with dark text (7.76:1).
  Never use the brighter coral with white text: it fails contrast.
- **The glow.** Light screens are white with a peach and lilac glow at the very
  top. Dark screens fade from violet to #0B0630. Lists, tables and forms always
  sit on solid surfaces.
- **The rail.** On desktop it is white in light mode and violet in dark mode. The
  phone drawer is an overlay, so it is violet in both.
- **Amber is a warning**, such as nearing the daily limit. It never means "something broke".
- **Green is only ever "it worked"**: success, online, KPI up, a tick.
- **Red is failure and destruction.** Never decoration.

- **One memorable thing per screen.** Home leads with what needs you; Inbox leads with the thread; Catalog leads with completeness.
- Indigo appears on: active nav, links, focus rings, meters, info status, outbound
  chat. Coral appears on: primary actions and needs-you. Everywhere else: neutrals.
- Everything the user reads or edits (lists, tables, forms, numbers, chat
  messages) sits on solid surfaces.
- Copy the visual language, never the brand: no Flowify/Venture Harbour names,
  logos, illustrations, or text. Real shop data only — never fake charts.

## Tokens (frontend/src/styles.css)

Tokens live in `:root` (light) and `[data-theme="dark"]`. New work uses tokens
only. No hex literals outside token blocks.

### Light tokens
- --purple: #4f3fc7 (indigo: active, links, focus) · --purple-dark: #3b2e9e (hover/pressed)
- --purple-soft: #efebfe (active nav, outbound chat, info chips) · --purple-line: #cfc6f8
- --accent-solid: #d03c16 · --accent-solid-hover: #b83412 · --on-accent: #fff (dark: #ff8a6b, #ffa488, #120b4a)
- --coral-ink: #b83412 · --coral-soft: #fff4ef · --coral-line: #f3c3b3 (needs-you text and chips)
- Violet frame (dark rail, phone drawer): #2a1c7a → #120b4a → #0b0630
- --ink: #1e1757; --muted: #5f5a7d; --faint: #736f8e
- --line: #e7e5f0; --line-soft: #f2f1f8 (borders, dividers)
- --bg: #ffffff (page, under --glow); --card: #ffffff (cards, forms, menus)
- --green: #10b981 on --green-soft: #d1fae5; --green-dark: #059669 (success, KPI-up)
- --gold: #d97706 on --gold-bg: #fffbeb; --gold-line: #fcd34d (needs attention, never errors)
- --red: #dc2626 on --red-bg: #fef2f2; --red-line: #fca5a5 (failed, destructive only)
- --blue: #2563eb on --blue-bg: #eff6ff (info, links)

### Dark tokens
- --purple: #8b7ff0 (never dimmed below 4.5:1), --purple-soft: #2e2478
- --ink: #f4f2fe; --muted: #c9c2f5; --faint: #9c95cb
- --line: #2e2478; --line-soft: #1b1450
- --bg: #0b0630; --card: #1b1450
- --green: #34d399; --gold: #fbbf24 on #2a1f08; --red: #f87171 on #2b1210; --blue: #60a5fa
- Dark is designed, not inverted: surface separation via borders, softer shadows.

The mark's ramp (`.vl-root`) lives in the same two blocks. A mark on a violet
rail uses the bright ramp.

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

## Glass rules (brought back by the owner, 2026-11)
- The signed-in app sits on a soft peach and lilac colour field (violet in dark).
- Home's stat cards and panels, the Inbox panels, the desktop sidebar and the Ask bar
  are strong frosted glass: see-through fill, bright edge, soft lift. Use the `.glass` class (web) and
  `VeloSalesTheme.glass` (phone).
- Readable surfaces stay nearly solid, so prices and chats survive sunlight: cards,
  forms and tables use `--glass-solid`, and Inbox bubbles and rows use brighter fills.
- Live blur runs only on desktop web. Phones get the same look without blur,
  because blur is heavy on cheap devices.
- Text on glass uses `--glass-ink`, which is darker than ordinary muted text.

## Components
### Brand mark
- The same hexagon and V, built from three pieces: coral (#FFB199 to #D03C16), indigo
  (#9C8FFA to #3B2E9E), and one blending both (#FF8A6B, #B44BA0, #4F3FC7).
- The geometry lives in `frontend/src/components/Logo.jsx` and `mobile/lib/brand_mark.dart`.
  Keep the colours the same on both, in light and dark. A one-colour white version is
  allowed only where gradients cannot sit, such as a coloured header.
- App icons and favicons sit on the violet gradient (#2A1C7A to #120B4A). Regenerate
  them all together; never hand-edit one PNG.
- The 3D version is `MarkReveal` / `MarkTurn` on web and `Mark3D` on phone. It plays once on
  the splash: the pieces fly in and lock, the logo turns with a flash of light, and a
  ring settles around it. Reduced motion shows one still pose.

### Loading
- Skeletons on anything that loads a list or numbers: a coral-to-lavender sweep (`.skel`
  on web, `Skeleton` on phone). A failed load shows a retry card, never an endless skeleton.
- The turning logo for longer page waits. A small coral and indigo arc inside buttons,
  where the button keeps its size and says what it is doing.
- Pull to refresh on the phone shows the turning logo with a soft tick.

### Shell
- Main menu, same words on both clients: Home, Inbox, Catalog, Channels, Insights.
  Everything else sits behind More. Never add a sixth main item.
- Desktop: left sidebar 232px with the five items and a More toggle. Topbar:
  breadcrumb + business name, page search, then Upgrade (free plan only), AI status,
  bell, theme toggle, avatar, sign out.
- Phone: bottom bar of Home, Inbox, Catalog, Channels, More. More opens the violet
  drawer, which holds Insights and everything else.

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

### Home
- Status line, then the greeting: "Hi {name}," in coral, then the question.
- Chats need you comes first, with how long the oldest has waited. It fills coral
  only when a real chat is waiting.
- Then replies today with a ring, answered by Velo, the catalog, Ask Velo, Chats this
  week, Waiting for you, and the channels row. The free plan sees the upgrade card.
- Customers appear as CustomerFace: their real photo if we have one, otherwise a
  person-shaped icon. Never initials.
- Everything shows REAL counts only. No invented analytics.

### Inbox / Chats
- Desktop: list and conversation side by side, both on glass, filling the screen
  height, each scrolling inside itself. At <=760px they become two pages, and a
  conversation hides the bottom menu because it has its own back button.
- One row of filters: All, Needs you, Handled, then channels that have chats.
- Chats that need you come first in brighter surfaces, showing "Needs you, 12m".
  A row carries one status. Customers appear as CustomerFace with a channel dot.
- The conversation header holds one switch: `Velo answers` / `You answer`, with the
  live one filled indigo. A flagged chat shows a coral "Velo needs you" note with the reason.
- Customer bubbles are frosted, outgoing bubbles are indigo. Outgoing bubbles have no
  sender name until messages record who sent them: never guess between Velo and the owner.
- The reply box is a glass pill with a round coral send button.

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

### Legal documents (Terms + Privacy)
- One document, two clients, same substance. Web `/terms` + `/privacy`;
  phone `lib/screens/legal_screen.dart` (Terms / Privacy segmented switch).
  If a clause changes, both change in the same commit.
- Phone consent must be real: the signup checkbox links to both documents in
  the app itself (no dead text), and Settings → Terms & privacy and Help →
  The fine print open the same screen.
- Reading surface is plain: 13.5px/1.6 body, bold section numbers, bullet
  dots in accent at 60%, one closing contact card. No accordions — legal text
  should be scrollable, not hidden behind taps.
- Dates: "Last updated: September 2026". Never show a future date or a
  version number users cannot check.

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

### Pre-signup welcome (web `/` + phone)
- One screen on both clients (`frontend/src/pages/Landing.jsx`,
  `mobile/lib/screens/welcome_screen.dart`): the 3D mark, one promise ("Your
  WhatsApp shop, open 24/7."), one sentence, then a choice. Pricing and detail
  live on the marketing site; the web links to it once and keeps its legal
  footer below the stage.
- The stage is saturated indigo in both themes, with slow drifting brand glows
  and a fine star field. This is marketing, not chrome: the backdrop and the
  orbit may loop here, and nowhere inside the app.
- The scene (`components/mark3d-core.js` + `Mark3D.jsx`, `widgets/mark_3d.dart`)
  extrudes the mark's three triangles with no model file and no 3D library. The
  pieces fly in and lock, the mark turns toward the cursor or finger, and channel
  tiles orbit on a tilted ring, passing behind and in front. Both files hold the
  same numbers: change one, change both.
- Only live channels orbit untagged. A channel that has not shipped carries an
  amber "soon" tag (Instagram today); remove the tag when it ships.
- Headline on this screen may exceed the type scale (up to 68px on desktop).
  The primary action is a white pill joined to an amber arrow, with "Sign in"
  beside it. Either opens auth in that mode. It never says "Create my free shop".
- Reduced motion: one still, angled pose with every channel visible, no drift.

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

### Failure and offline states (web `Error3D.jsx`, phone `ErrorArt`)
- A failure is an object, not a warning glyph: the brand tile stands in space
  with a contact shadow and one status light. Red core = the request failed,
  amber core + dashed ring = you are offline. Same geometry, same colours on
  both clients; the art is drawn (SVG / `CustomPainter`), never an image that
  can 404.
- Motion is 3px on a 6s loop and stops under `prefers-reduced-motion` /
  `disableAnimations`. It says "still here", never "loading".
- The copy still carries the meaning: what failed, what to do, Retry. The art
  never replaces the sentence.
- Genuine empty states stay calm and text-first — no 3D, no red.

### Transactional email (one shell, 21 templates)
Every email comes from `layout()` in `src/services/emailTemplates.js`. If a
template writes its own `<html>`, it is a bug — the inbox must look like the app.
- **Brand row** — circular mark (`/email-logo.png`, 256px, the same geometry as
  `Logo.jsx`), "VeloSales Ai", a small `OFFICIAL` pill, and the real From address
  underneath. It mirrors the sender row people already trust; it does not fake
  a blue verification tick.
- **Sheet** — 600px max, 20px radius, white card on `#F2F1F8`. Titles 24px,
  body 15px/1.7, one pink-free palette: CTA `#4F3FC7`, code box `#EFEBFE` with
  `#3B2E9E` digits, amber only for money.
- **Living footer** — the mark, three breathing dots and a 150px sweeping bar
  under "AI ON DUTY". This is the app's loader language, not decoration: it says
  the assistant is working while you read.
- **Animation is progressive** — `@keyframes` inside one `<style>` block. Gmail
  may drop it; the resting state is a 38%-filled bar with solid dots, which
  still reads as a status strip. No GIFs, no JS.
- **Dark mode** — `prefers-color-scheme` swaps card, rows, legal strip and link
  colour. Light values stay inline so clients that strip `<style>` still render.
- **Build rules** — tables + inline styles only, no flex/grid for structure,
  no background images that carry meaning, `esc()` on every user value.

## Motion
- Only motion that answers an action: press, open, close, confirm, tab change.
- 140–220ms ease-out. Sheets slide up. Buttons scale to 0.97 on press.
- Respect `prefers-reduced-motion` globally in one place.
- No decorative loops or pulse animations. The one exception is the signed-out
  welcome: its backdrop may drift and the channel marks may orbit the 3D mark.
  Neither runs under reduced motion, and neither appears in the app after sign-in.
- **Depth (phone only).** The phone may add real perspective to the same flat
  web surfaces: a card tilts 2–4° toward the finger, a page arrives with a 2°
  pitch and a 12px rise, and cards settle flat on entry. These are still
  action-answering, never ambient: no idle float, spin, or pulse. Implement
  them once in `mobile/lib/depth.dart` (`DepthCard`, `DepthReveal`) and let
  every screen reuse them; if the OS reduces motion, they render flat.

## Copy
- Sentence case, plain verbs, say what will happen. Errors say what went wrong
  and how to fix it. Real content only. No fake testimonials, countdowns, or
  "unlimited" claims.

## Don'ts (these make it look AI-made)
- No stacks of identical cards. North-star metric first, details on demand.
- No decorative gradients beyond the colour field, the coral action fill, the violet
  upgrade card and the signed-out welcome's sky.
- No see-through glass on lists, tables or forms. No cards inside cards. No gray text on fills.
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
