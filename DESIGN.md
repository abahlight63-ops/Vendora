# DESIGN.md — VeloSales AI

Read this file before any UI work and follow it strictly. If something is not
specified here, ask before inventing it. Scope: `frontend/` only (not website/,
mobile/, or Admin).

## Direction
Dark HR-bento world exactly like pinned Image 1 (HRadar): near-black app frame
floating on pale sage page, mint fills, triple-ring donut, heat grid, timeline,
apps-with-rings. Applied to a WhatsApp customer-support dashboard with real
VeloSales content — never the reference brand, names, photos, or text.

- One memorable thing per screen: the bento grid on Overview (profile photo
  card + mint timer + donut + heatmap + timeline + apps list).
- Glass appears only on: topbar, profile bottom bar, mobile floating bar.
- Everything readable sits on solid #1A201E cards with 1px hairlines.
- Copy the visual language, never the brand: no Milena Page, Capture IT,
  HRadar Premium name, illustrations, or photos.

- One memorable thing per screen: the dark hero card on Overview, the
  amber action circles under it.
- Glass appears only on: topbar, mobile floating bottom bar, hero-card chips,
  modals and sheets, chart tooltips. The paywall modal uses the amber glass variant.
- Everything the user reads or edits (lists, tables, forms, numbers, chat
  messages) sits on solid surfaces.
- Copy the visual language, never the brand: no Cleva name, logo, illustrations,
  3D icons, photos, or text.

## Implementation rules (stack: React + Vite, hand-written CSS, NO new dependencies)
- No Tailwind, no shadcn, no icon packages, no CSS-in-JS.
- ONE `:root` block (light) and ONE `[data-theme="dark"]` block in styles.css.
  Delete the duplicate `:root` blocks and both `[data-theme="light"]` override
  passes. Target zero `!important`.
- Components use tokens only. No hex literals outside the token blocks.
- Primitives live in `components/ui/` (Button, Input, OtpInput, Select, Card,
  Row, Chip, Toggle, Modal, Sheet, Tabs, EmptyState, Table), styled from tokens.
- One icon module, outline style, 1.75 stroke, 20px default, round caps and joins.
- Breakpoints: 640px and 1024px only.

## Themes
Default to the system setting. Settings offers System / Light / Dark and
remembers the choice.

### Light tokens (dark-first world; light follows the same bento)
- --page: #D3DBD9 (sage outer page)
- --bg: #0F1312 (app frame)
- --surface: #1A201E (cards)
- --surface-2: #232B28 (wells, rails, lanes)
- --border: rgba(255,255,255,0.08)
- --ink: #EEF3F0
- --ink-muted: #93A09A
- --mint: #D7F0E3 (timer fill, premium fill, heat cells, rings, primary buttons)
- --mint-ink: #0E1A14 (text on mint)
- --sky: #8ED4F2 (donut middle ring)
- --amber-500/400/300 remapped to mint for compat; --amber-100/150: #22302A;
  --amber-line: rgba(215,240,227,0.28); --on-amber: #0E1A14
- --live: #7FD6A0 on rgba(127,214,160,0.14); --danger: #FF8A7A;
  --badge: #E5372E

### Dark tokens (same as light — dark-only world)
- Same values as above. Toggle kept working; both themes render the bento.

Dark theme is not shown in the reference app; these values are designed to match
it. Check every text and background pair at 4.5:1 in both themes.

## Typography
- Font: Figtree (Google Fonts), weights 400, 500, 600, 700. Fallback system-ui.
  (Cleva's exact typeface cannot be identified from screenshots; Figtree is a
  close free match: friendly, geometric, rounded.)
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40. Body 16, line-height 1.5.
- ONE relationship between page title and topbar title. No unrelated sizes.
- Numbers: weight 600, `font-variant-numeric: tabular-nums`.
- Sentence case everywhere. No all-caps labels, no tracked eyebrows, no
  single accented word in a heading.

## Shape, spacing, depth
- Spacing base 4px: 4, 8, 12, 16, 20, 24, 32, 48.
- Radius: 12px banners and chips-with-text, 16px cards and rows and inputs,
  20px hero card, 28px sheets, 999px pills, buttons, nav, keys, action circles.
- Cards: solid --surface, 1px --border, no shadow (or 0 1px 2px rgba(0,0,0,0.04)).
  Depth comes from borders and spacing, not heavy shadows.
- Mobile page padding 16px. Desktop content max width 1120px.
- Touch targets at least 44px.

## Glass recipes
Light glass:
```css
.glass {
  background: rgba(255, 255, 255, 0.62);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9),
              0 10px 30px rgba(62, 42, 15, 0.12);
}
```
Dark glass:
```css
[data-theme="dark"] .glass {
  background: rgba(38, 35, 32, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18),
              0 12px 36px rgba(0, 0, 0, 0.45);
}
```
Amber glass (paywall modal and upgrade sheet only):
```css
.glass-amber {
  background: rgba(255, 201, 119, 0.28);
  -webkit-backdrop-filter: blur(24px) saturate(190%);
  backdrop-filter: blur(24px) saturate(190%);
  border: 1px solid rgba(255, 224, 170, 0.75);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8),
              0 12px 32px rgba(143, 91, 0, 0.18);
}
```
Rules:
- Glass needs something behind it (scrolling content, the hero glow, a dimmed page).
- Solid fallback: `@supports not (backdrop-filter: blur(1px)) { .glass, .glass-amber { background: var(--surface); } }`
- `@media (prefers-reduced-transparency: reduce)` switches to solid.
- Max two blurred layers on screen at once.
- Text on glass keeps 4.5:1 in both themes.

## Components
### Hero card (Overview)
- Radius 20px, near-black base (#0E0E0E) in both themes, faint tone-on-tone
  pattern at 4-6% opacity, and a large partly cropped amber disc glowing at the
  right edge (plain circle with radial gradient, no illustration).
- Top: glass pill selector (date range or WhatsApp number) with a chevron.
- Center: the one big number (today's conversations), 40px, white, tabular.
- Bottom: glass chip with bot status and masked number, with a chevron.
- Eye icon toggles hiding numbers where the data is sensitive.

### Action circles (under the hero)
- Four across: 56px circles, --amber-400 fill, 1px --amber-line, outline icon in
  --on-amber, label 14px below in --ink. Suggested: Add product, Test bot,
  Connect, More.

### Info strip
- Outlined card (1px --border, radius 16px) with a small icon, one line of text,
  and an underlined link on the right (--amber-700). Used for the trial status.

### Quick-action tiles
- One card, four equal tiles: icon, label, optional corner badge (amber-300 pill
  like "3 new", grey "Soon"). 

### Floating bottom bar (mobile)
- Glass pill, 64px tall, 16px side margins, floating 12px above the bottom edge.
- Five items max, outline icon plus 12px label. Active item: --amber-100 fill,
  1px --amber-line outline, pill shaped, bold label in --brown-900.
- Pages get bottom padding so content never hides behind it.

### Sidebar (desktop)
- Solid --surface with a 1px --border, no glass. Items 44px tall, outline icon
  and label. Active item uses the same cream pill with amber outline as the
  mobile bar. Group titles (Sell, Grow, Setup) in --ink-muted, sentence case.

### Topbar
- Glass, sticky. Title left. Right side: notification bell and help in one
  rounded pill. Bell badge uses --badge with a white count.

### Rows and settings lists
- Solid card, 1px --border, radius 16px, rows 56px. Left outline icon, label,
  right chevron, toggle, or status chip. Section titles above in --ink-muted.
- Promo banner: --amber-150 fill, 1px --amber-line, radius 12px, small amber icon.

### Chips
- Pills, 12-14px, weight 500. Promo: --amber-300 with --on-amber text.
  Live/success: --live pair. Danger: --danger pair. A chip is a status.

### Buttons
- Heights 40 / 48 / 56, fully rounded. Primary: --amber-400 fill, --on-amber text.
  Secondary: --surface with 1px --border. Tertiary: text in --amber-700, underlined
  where it is a link.
- One primary per screen. Labels name the action ("Add product"). No "Submit",
  no arrows appended to labels.
- States: hover, focus-visible (2px --amber-500 ring, 2px offset), pressed
  (scale 0.97), disabled (50%), loading (spinner, width unchanged).

### Inputs, OTP and keypad
- Inputs 48px, radius 16px, 1px --border, label above. Focus: 1.5px --amber-500
  border and a soft amber glow. Placeholders are never labels.
- OTP boxes: rounded 16px squares, 56px, the active one with the amber border
  and glow. On mobile, an optional numeric keypad of pill keys (--surface-2,
  22px numerals, 56px tall).
- Toggle: off = outlined pill with a grey knob, on = --amber-400 fill.

### Login screen
- Warm cream wash at the top fading to white (dark theme: warm black), logo or
  avatar circle, short greeting, inputs or OTP boxes, one primary button, a quiet
  underlined secondary link. No live demo chat inside a glass card.

### Chats
- List rows with 44px avatar circles. Outgoing (bot or agent) bubble in
  --amber-300, incoming in --surface with 1px --border. Radius 16px. WhatsApp
  green appears only as the channel badge and the online dot.

### Catalog and tables
- Rows, not grids of identical cards. Thumbnail 44px, name, price, a status chip,
  a chevron. Dense tables get a solid header row in --surface-2.

### Charts (Insights)
- Smooth line in --amber-500, 2px, with a soft fill fading from 16% amber to
  transparent. Dotted hairline gridlines. Selected point shows a glass tooltip.
  Range switch is a pill segmented control (selected = --amber-100 with outline).
  Gains --live, drops --danger, always paired with an icon.

### Modals, sheets, toasts
- Modals and sheets: glass, radius 28px, a grabber on mobile sheets, dimmed page
  behind. Paywall and upgrade modal use `.glass-amber`.
- Toasts: solid dark pill (light theme) or light pill (dark theme), bottom center
  above the bottom bar.

### Empty states
- Outline icon in an amber-100 circle, one line saying what is empty, one primary
  button saying what to do. No jokes.

## Motion
- Only motion that answers an action: press, open, close, confirm, tab change.
- 180-280ms ease-out. Sheets slide up. Buttons scale to 0.97 on press.
- One entrance at most (hero card on first load).
- Respect `prefers-reduced-motion` globally in one place.
- Remove: aurora background, dot grid, neumorphic cards, confetti, shine sweeps,
  banner pulse, logo orbit, the extra keyframes.

## Copy
- Sentence case, plain verbs, say what will happen. Errors say what went wrong
  and how to fix it. Real content only.

## Don'ts (these make it look AI-made)
- No stacks of identical cards. One hero, then rows and lists.
- No decorative gradient washes, no purple-blue gradients. The only gradients are
  the login cream wash, the hero glow, and the chart fill.
- No glass on rows, tables, forms, chat bubbles, or numbers.
- No cards inside cards.
- No gray text on amber fills. Use --on-amber.
- No emoji as icons. Outline icons only, one stroke width.
- No numbered markers (01 / 02) unless the content is a real sequence.
- No new colors, radii, fonts, or shadows beyond this file.
- No pure #000 text and no pure #fff page background.

## Build order (do ONE step, then stop for review)
1. Token layer: single :root and [data-theme="dark"], Figtree, theme switch.
   Verify contrast and write the final token table back into this file.
2. Primitives in components/ui/ and the single icon module.
3. Shell: sidebar, topbar, mobile floating bar, footer.
4. Login and signup.
5. Overview (hero card, action circles, info strip, quick-action tiles).
6. Catalog, Connect, Chats, Playground.
7. Insights, Profile, Settings, Billing and paywall.
8. Onboarding, Welcome, Notifications, Refer & Earn, Help, Chat with Velo.
9. Landing, FAQ, Privacy, Terms.
After each step: screenshots at 390px and desktop in both themes, and a list of
mismatches against this file before fixing. Keep all behavior and API calls
unchanged. Commit after each step that works.
