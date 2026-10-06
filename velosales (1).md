# velosales.md: design system and restructure plan for the VeloSales AI web app

This is the single source of truth for the look, layout and structure of the web
app in `frontend/`. It replaces DESIGN.md. (The Flutter app in `mobile/` follows
MOBILE-DESIGN.md.) Read the whole file before any UI work and follow it strictly.
If something is not specified here, stop and ask. Do not invent colors, sizes,
fonts, radii, shadows or new component styles.

## 0. How to work with this file
- Scope: `frontend/` only. Do not touch `src/` (Express backend), `website/`,
  `mobile/` or the Admin console unless told to.
- Keep all behavior, routes, API calls and data flow exactly as they are. This is
  a presentation and structure change.
- No new dependencies. No Tailwind, no shadcn, no icon packages, no CSS-in-JS.
- One step at a time. Show the plan first. Stop for review after each step.
- After every step run `node design-check.mjs frontend/src` and fix everything it
  lists before saying you are done.
- Commit after every step that works.

## 1. Product and design intent
VeloSales AI turns a business's WhatsApp number into a 24/7 AI sales assistant
that answers customers (English or Pidgin) from the business's own catalog. Users
are small-business owners, usually non-technical, busy, often on a phone. They
need to trust it, understand it in seconds, and fix things quickly.

Design principles (apply in this order when they conflict):
1. Clarity over decoration. One main thing per screen, obvious next action.
2. Consistency. The same thing always looks and sits the same way.
3. Calm and warm. Cream and amber on clean surfaces, a dark hero card for the
   key number, soft glass only where it floats above content.
4. Readable money and numbers. Solid surfaces, tabular numerals, high contrast.
5. Fast on cheap phones. Few effects, no heavy blur stacks, no looping animation.

The visual language is modeled closely on the Cleva mobile banking app (amber on
cream, pill shapes, floating nav, outline icons, soft bordered cards). Use the
language only. Never copy any brand's name, logo, illustrations, icons or copy.

## 2. Brand and logo
- Name: **VeloSales AI** (capital A and I) everywhere: page title, meta tags,
  UI, emails. Fix "VeloSales Ai" wherever it appears.
- Logo files live in `frontend/public/logo/`:
  - `logo-for-light.svg` on light surfaces, `logo-for-dark.svg` on dark surfaces.
  - `AnimatedLogo.jsx` (in `components/`) for the splash only.
  - `favicon.svg`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-180.png`
    (apple-touch) and `app-icon-*-1024.png` for manifest and sharing.
- Sidebar logo 32px with the wordmark "VeloSales AI" (18 / 600). Topbar on mobile:
  logo 28px. Login: logo 48px. Never stretch, recolor or add effects to it.
- Splash and BrandGate: play AnimatedLogo once per browser session (about 2s),
  then continue. If already played this session, show the static logo for the
  minimum time needed. Respect reduced motion (the component already does).
- Remove the old green logo everywhere, plus ScatterLogo effects, the logo orbit
  and any green glow tied to the old logo.
- Browser UI color: `<meta name="theme-color" content="#F4F4F4" media="(prefers-color-scheme: light)">`
  and `<meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">`.
  Update the manifest `theme_color` and `background_color` to match.

## 3. Design tokens (single source of truth)
Put exactly one `:root` block and one `[data-theme="dark"]` block in
`styles/tokens.css`. Delete every other `:root` block and both
`[data-theme="light"]` override passes. No color, size or radius may be written
anywhere else; components use `var(--token)` only.

```css
:root {
  color-scheme: light;
  /* surfaces */
  --bg: #F4F4F4;
  --surface: #FFFFFF;
  --surface-2: #F7F7F7;
  --border: #EBEBEB;
  --input-border: #8C8C8C;
  /* text */
  --ink: #1A1A1A;
  --ink-muted: #6B6B6B;
  --brown-900: #3E2A0F;
  /* amber family (signature) */
  --amber-500: #F5B63A;
  --amber-400: #FFC977;
  --amber-300: #FFE3B0;
  --amber-150: #FFF3DC;
  --amber-100: #FFF8EC;
  --amber-line: #F7D8A0;
  --amber-700: #8F5B00;
  --on-amber: #2A1A00;
  --focus: #8F5B00;
  --focus-glow: rgba(245, 182, 58, 0.35);
  /* status */
  --live: #1F7A4D;
  --live-bg: #E6F7EA;
  --danger: #C0392B;
  --danger-bg: #FBE9E6;
  --badge: #D92D20;
  --on-badge: #FFFFFF;
  /* hero card (dark in both themes) */
  --hero-bg: #0E0E0E;
  --hero-ink: #FFFFFF;
  --hero-muted: #B8B8B8;
  --hero-glow: rgba(245, 182, 58, 0.5);
  /* glass */
  --glass-bg: rgba(255, 255, 255, 0.62);
  --glass-border: rgba(255, 255, 255, 0.7);
  --glass-hl: rgba(255, 255, 255, 0.9);
  --glass-shadow: rgba(62, 42, 15, 0.12);
  --glass-amber-bg: rgba(255, 201, 119, 0.28);
  --glass-amber-border: rgba(255, 224, 170, 0.75);
  --glass-amber-shadow: rgba(143, 91, 0, 0.18);
  --overlay: rgba(26, 26, 26, 0.5);
  /* type */
  --font: "Figtree", system-ui, -apple-system, "Segoe UI", sans-serif;
  /* spacing (4px grid) */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 20px;
  --s-6: 24px;
  --s-8: 32px;
  --s-12: 48px;
  --s-16: 64px;
  /* radius */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;
  --r-2xl: 28px;
  --r-pill: 999px;
  /* motion */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --t-fast: 180ms;
  --t-base: 240ms;
  /* layout */
  --sidebar-w: 264px;
  --topbar-h: 64px;
  --content-max: 1120px;
  --bar-clearance: 96px;
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #121110;
  --surface: #1C1A17;
  --surface-2: #262320;
  --border: rgba(255, 255, 255, 0.08);
  --input-border: #7A7468;
  --ink: #F5F1EA;
  --ink-muted: #A8A094;
  --brown-900: #F5F1EA;
  --amber-500: #F5B63A;
  --amber-400: #F5B63A;
  --amber-300: #4A3611;
  --amber-150: #2A2012;
  --amber-100: #241C10;
  --amber-line: #6B4E14;
  --amber-700: #FFD27A;
  --on-amber: #2A1A00;
  --focus: #F5B63A;
  --focus-glow: rgba(245, 182, 58, 0.3);
  --live: #5FD38D;
  --live-bg: #12301F;
  --danger: #FF8A7A;
  --danger-bg: #3A1713;
  --glass-bg: rgba(38, 35, 32, 0.55);
  --glass-border: rgba(255, 255, 255, 0.14);
  --glass-hl: rgba(255, 255, 255, 0.18);
  --glass-shadow: rgba(0, 0, 0, 0.45);
  --glass-amber-bg: rgba(245, 182, 58, 0.16);
  --glass-amber-border: rgba(245, 182, 58, 0.35);
  --glass-amber-shadow: rgba(0, 0, 0, 0.45);
  --overlay: rgba(0, 0, 0, 0.6);
}
```

### 3.1 Color usage rules
- Theme: default to the system setting (`prefers-color-scheme`), saved choice wins.
  Set `data-theme="light"` or `"dark"` on `<html>`. Settings offers System / Light / Dark.
- Page background `--bg`, cards and rows `--surface`, quiet fills and hover
  `--surface-2`. Hairlines `--border`. Form field outlines `--input-border`
  (it meets the 3:1 contrast needed to see a field).
- Primary action fill `--amber-400` with `--on-amber` text. Never white text on amber.
- `--amber-500` is a fill or decoration only (chart line, selected ring, dots).
  Never use it as text or as a lone icon on a light surface (contrast is 1.8:1).
  Amber text or icons on light surfaces use `--amber-700`.
- Links and tertiary buttons: `--amber-700` (becomes bright amber in dark).
- Selected or active: `--amber-100` fill with a 1px `--amber-line` outline.
- Chips and outgoing chat bubbles: `--amber-300` fill with `--brown-900` text
  (dark text in light theme, light text in dark theme, so it always passes).
- Banners and promos: `--amber-150` fill, `--amber-line` border.
- Status: `--live` on `--live-bg` (online, connected, success), `--danger` on
  `--danger-bg` (errors, destructive). Always pair color with an icon or word.
- WhatsApp green appears only as the WhatsApp channel badge and the online dot
  (use `--live`). It is not a brand color of this UI.
- Notification count: `--badge` fill with `--on-badge` text.
- Hero card is dark in both themes: `--hero-bg`, text `--hero-ink`, secondary
  `--hero-muted`, one amber glow `--hero-glow` in a corner.
- No pure `#000` text. No pure `#fff` page background (cards may be white).
- No gradients except: login cream wash, hero glow, chart fill, glass.

### 3.2 Verified contrast (both themes pass)
| Pair | Ratio |
|---|---|
| ink on bg / surface (light) | 15+ : 1 |
| ink-muted on surface (light / dark) | 5.0+ / 6.0+ : 1 |
| on-amber on amber-400 | 11.1 : 1 (light), 9.3 : 1 (dark) |
| amber-700 on surface (light) | 5.7 : 1 |
| brown-900 on amber-300 | passes in both themes |
| focus ring on surface (light / dark) | 5.7 / 9.6 : 1 (needs 3) |
| input border on surface (light / dark) | 3.4 / 3.7 : 1 (needs 3) |
| on-badge on badge | 4.8 : 1 |
| hero-ink / hero-muted on hero-bg | 19 / 9.7 : 1 |
Run `node design-check.mjs frontend/src` after any color change.

## 4. Typography
- Font: **Figtree** (Google Fonts), weights 400, 500, 600, 700 only. Load it once
  in `index.html` with `display=swap` and preconnect, or self-host the files in
  `public/fonts`. Remove the Inter import. Never use Inter, Arial or Roboto first.
- Set `font-family: var(--font)` on `body`, and `font: inherit` on buttons, inputs,
  selects and textareas so they never fall back to the system font.
- Numbers: `font-variant-numeric: tabular-nums` for money, counts, tables, charts.
- Body text 16px (inputs 16px minimum, so phones do not zoom).
- Sentence case everywhere. No all-caps labels or tracked eyebrows above headings.

### Type roles (every piece of text is exactly one of these)
| Role | Size / weight / line-height | Color |
|---|---|---|
| Display (Landing hero, desktop only) | 48 / 600 / 1.1 | ink |
| Big number (hero card, stat tiles) | 40 / 600 / 1.1 | hero-ink or ink |
| Page title (h1) | 28 / 600 / 1.2 | ink |
| Topbar title (mobile and tablet only) | 18 / 600 / 1.2 | ink |
| Section title (h2) | 18 / 600 / 1.3 | ink |
| Card title (h3) | 16 / 600 / 1.3 | ink |
| Body | 16 / 400 / 1.5 | ink |
| Dense text (tables, list details) | 14 / 400 / 1.4 | ink or ink-muted |
| Label, button, nav item | 14 / 600 / 1 (nav inactive 500) | ink |
| Caption, helper text | 12 / 500 / 1.4 | ink-muted |
Allowed sizes: 12, 14, 16, 18, 22, 28, 40, 48. Allowed weights: 400, 500, 600, 700.
Target: 8 different font sizes in the whole app, down from the current dozens.
The page title and the topbar title are never shown together on the same screen.

## 5. Spacing, layout and grid
- Spacing scale only: 4, 8, 12, 16, 20, 24, 32, 48, 64 (and 96 for bottom-bar
  clearance). No 5px, 7px, 10px, 13px, 15px, 18px, 22px or rem guesses.
- Use `gap` on flex and grid containers. Do not space children with margins.
- Spacing roles:
  | Where | Value |
  |---|---|
  | Page padding | 16 mobile, 24 tablet, 32 desktop |
  | Content max width | 1120, centered, one shared left edge |
  | Card padding | 20 (16 on mobile) |
  | Gap between sibling cards | 16 mobile, 24 desktop |
  | Title to its content | 8 |
  | Items inside a group | 8 or 12 |
  | Between page sections | 32 |
  | Label to input / field to field / form actions | 8 / 16 / 24 |
- Related things sit closer than unrelated things. Siblings use the same gap.
- Breakpoints (only these two): `max-width: 639px` mobile, `640px to 1023px` tablet,
  `min-width: 1024px` desktop. Collapse the current seven breakpoints.
- Grid: 4 columns mobile, 8 tablet, 12 desktop. Card rows use
  `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` with
  `align-items: stretch` so cards in a row have equal heights.
- Radius scale: 8 (checkbox, tiny tags), 12 (banners, small cards), 16 (cards,
  rows, inputs), 20 (hero card), 28 (modals, sheets), 999 (buttons, chips, pills,
  nav, avatars, icon circles).
- Elevation: solid surfaces use a 1px `--border` and no shadow. Dropdowns and
  menus: `0 8px 24px` at 12% black. Glass has its own shadow (section 6).
- z-index scale: content 0, sticky 10, sidebar 20, topbar 30, dropdown 40,
  modal and sheet 50, toast 60, tour 70.
- Alignment rules:
  - Everything on a page shares one left edge and one max width.
  - Controls on the same row share the same height.
  - Icon plus text: `display: inline-flex; align-items: center; gap: 8px`,
    icon 20px, vertically centered on the text.
  - Text is left-aligned. Numbers in tables are right-aligned. Column headers
    align with their column content.
  - Footers of forms and dialogs: [secondary, primary], primary on the right;
    on mobile both full width, primary on top.
  - Images: fixed `aspect-ratio` and `object-fit: cover`.

## 6. Glass (the only places it is allowed)
Glass is used on: the topbar, the mobile floating bottom bar, chips on the hero
card, modals and sheets, and chart tooltips. The paywall (GlassUpsell) uses the
amber variant. Nowhere else: not rows, tables, forms, chat bubbles or numbers.

```css
.glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow: inset 0 1px 0 var(--glass-hl), 0 10px 30px var(--glass-shadow);
}
.glass-amber {
  background: var(--glass-amber-bg);
  -webkit-backdrop-filter: blur(24px) saturate(190%);
  backdrop-filter: blur(24px) saturate(190%);
  border: 1px solid var(--glass-amber-border);
  box-shadow: inset 0 1px 0 var(--glass-hl), 0 12px 32px var(--glass-amber-shadow);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass, .glass-amber { background: var(--surface); }
}
@media (prefers-reduced-transparency: reduce) {
  .glass, .glass-amber {
    background: var(--surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
```
Rules: glass needs content or a dimmed page behind it. At most two blurred layers
on screen at once. Text on glass must keep 4.5:1 contrast in both themes. Delete
the aurora background, dot grid, neumorphic cards, glass sidebar, confetti, shine
sweeps, banner pulse and logo orbit.

## 7. Components (build once in `components/ui/`, use everywhere)
Every page uses these primitives. No page writes its own button, modal, table,
input or chip. Reference CSS below is the gold standard; follow it exactly.

### 7.1 Button
Sizes: sm 32 (dense toolbars only), md 40 (default), lg 48, xl 56 (primary on
phone forms). Padding-x 12 / 16 / 20 / 24. Label 14 (16 on lg and xl), weight
600, never wraps. Icon 20px (16 in sm), 8px gap to label, icon left by default.
Variants: primary (amber-400 fill), secondary (surface fill, border), tertiary
(text only, amber-700), danger (danger-bg fill, danger text) for destructive.
States (all required): hover, focus-visible, pressed (scale 0.97), disabled
(50% opacity, no pointer), loading (spinner replaces label, width unchanged).
One primary button per screen section. Labels state the action ("Add product",
"Save changes"), never "Submit" or "OK", never an arrow in the label.
Icon-only buttons: square 40 x 40 (32 in sm) with a 44px minimum tap area and an
`aria-label`.

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  height: 40px;
  padding: 0 var(--s-4);
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: transform var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}
.btn-sm { height: 32px; padding: 0 var(--s-3); }
.btn-lg { height: 48px; padding: 0 var(--s-5); font-size: 16px; }
.btn-xl { height: 56px; padding: 0 var(--s-6); font-size: 16px; }
.btn-primary { background: var(--amber-400); color: var(--on-amber); border-color: var(--amber-line); }
.btn-primary:hover { filter: brightness(1.05); }
.btn-secondary { background: var(--surface); color: var(--ink); border-color: var(--border); }
.btn-secondary:hover { background: var(--surface-2); }
.btn-tertiary { background: transparent; color: var(--amber-700); }
.btn-tertiary:hover { background: var(--amber-100); }
.btn-danger { background: var(--danger-bg); color: var(--danger); }
.btn:active { transform: scale(0.97); }
.btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.btn[disabled] { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-icon { width: 40px; padding: 0; }
```

### 7.2 Inputs
Height 48, radius 16, 1px `--input-border`, `--surface` fill, padding-x 16, text
16. Label above (14 / 600), 8px gap. Helper text below (12, muted). Error text
below in `--danger` with an icon; the field border becomes `--danger`. Focus: border
`--focus` and a 4px `--focus-glow` ring. Placeholders are examples only, never
labels. Textarea: min-height 96, same style. Select matches input. Search input:
pill radius with a leading 20px icon. Mark optional fields with "Optional" in the
label, not asterisks on required ones.

```css
.input {
  width: 100%;
  height: 48px;
  padding: 0 var(--s-4);
  border: 1px solid var(--input-border);
  border-radius: var(--r-lg);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font);
  font-size: 16px;
}
.input::placeholder { color: var(--ink-muted); }
.input:focus-visible { outline: none; border-color: var(--focus); box-shadow: 0 0 0 4px var(--focus-glow); }
.input[aria-invalid="true"] { border-color: var(--danger); }
.label { display: block; margin-bottom: var(--s-2); font-size: 14px; font-weight: 600; color: var(--ink); }
.help { margin-top: var(--s-2); font-size: 12px; font-weight: 500; color: var(--ink-muted); }
```
OTP input: 6 boxes, each 48 wide x 56 tall, radius 16, active box gets the
focus border and glow, auto-advance, paste support, numeric keypad on mobile.

### 7.3 Toggle, checkbox, radio
Toggle: 44 x 24 track. Off = outlined track (`--input-border`) with a muted knob.
On = `--amber-400` track. Checkbox: 20px, radius 8, checked = amber-400 fill with
a dark check. Radio: 20px circle, selected = amber ring with a center dot. Each has
a visible 44px tap area and a label.

### 7.4 Card and rows
Card: `--surface`, 1px `--border`, radius 16, padding 20. Hero card: see 7.7.
List row: height 56, left outline icon 20, label, right chevron, toggle or chip;
separated by hairlines. Section title above a group in 14 / 600 muted. Never put a
card inside a card.

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: var(--s-5);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 56px;
  padding: 0 var(--s-4);
  border-bottom: 1px solid var(--border);
}
.row:last-child { border-bottom: 0; }
```

### 7.5 Chips, badges, avatars
Chip: pill, height 28, padding-x 12, 12 / 500. Neutral `--surface-2`, promo
`--amber-300` + `--brown-900`, live `--live-bg` + `--live`, danger `--danger-bg` +
`--danger`. Filter chips are 36 high; selected = `--amber-100` + `--amber-line`
outline. Count badge: min-width 20, height 20, pill, `--badge` + `--on-badge`,
12 / 600. Avatar: circle 32 / 40 / 48 with initials on `--amber-300` when no image.

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  height: 28px;
  padding: 0 var(--s-3);
  border-radius: var(--r-pill);
  background: var(--surface-2);
  color: var(--ink);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.chip-promo { background: var(--amber-300); color: var(--brown-900); }
.chip-live { background: var(--live-bg); color: var(--live); }
.chip-danger { background: var(--danger-bg); color: var(--danger); }
```

### 7.6 Tables
Row height 56, header 40 on `--surface-2` (14 / 600). Numbers right-aligned,
tabular. Hover row `--surface-2`. Sticky header inside scroll containers. Actions
in the last column as icon buttons. On mobile, tables become list rows (name and
main value on the first line, details below). Pagination or "Load more" below,
right-aligned.

### 7.7 Hero card
Radius 20, `--hero-bg`, padding 24, `--hero-ink` text, a faint tone-on-tone
pattern at 4 to 6% opacity and one `--hero-glow` radial corner. Layout: small
glass pill selector top-left (range or WhatsApp number), the big number (40 / 600)
in the middle, a glass status chip bottom-left, optional glass action pill
bottom-right. Used for: Overview (conversations today), Billing (current plan),
Refer & Earn (referral link). One hero card per page.

```css
.hero {
  position: relative;
  overflow: hidden;
  padding: var(--s-6);
  border-radius: var(--r-xl);
  background: var(--hero-bg);
  color: var(--hero-ink);
}
.hero::after {
  content: "";
  position: absolute;
  right: -96px;
  bottom: -96px;
  width: 320px;
  height: 320px;
  border-radius: var(--r-pill);
  background: radial-gradient(circle, var(--hero-glow), transparent 65%);
  pointer-events: none;
}
.hero-muted { color: var(--hero-muted); font-size: 14px; }
```

### 7.8 Action circles
Row of 4 under the hero: 56px circles, `--amber-400` fill, 1px `--amber-line`, outline
icon in `--on-amber`; label 14 / 500 below, centered, 8px gap. Equal widths, evenly
spaced, no wrapping labels (max 12 characters).

### 7.9 Tabs and segmented controls
Segmented (range, theme, Sign in / Create account): pill container `--surface-2`,
height 40, selected segment `--surface` with a border (or `--amber-100` +
`--amber-line` for filters). Tabs for page sections: 14 / 600 labels, selected has
a 2px `--amber-700` underline. Both keyboard navigable with arrow keys.

### 7.10 Modal, sheet, toast, menu, tooltip
- Modal: `.glass`, radius 28, max width 480 (640 for forms), padding 24, dimmed
  `--overlay`. Title 18 / 600, body 16, footer [secondary, primary] right-aligned.
  Focus trapped, closes on Escape and overlay click (not for destructive confirms).
- Sheet: on mobile all modals become bottom sheets (radius 28 on top corners, a
  grabber, max height 90%). On desktop, edit panels are right sheets 480 wide.
- Toast: solid dark pill (light theme) or light pill (dark theme), bottom center,
  16 above the bottom bar, auto-hides after 4s, errors stay until dismissed.
  `role="status"` (errors `role="alert"`).
- Menu and dropdown: `--surface`, 1px border, radius 16, 8px padding, rows 40 high,
  elevation `0 8px 24px` at 12% black.
- Tooltip: only for icon-only controls, 12px text, dark pill, 8px offset.

### 7.11 Banner and info strip
`--amber-150` fill, 1px `--amber-line`, radius 12, padding 12 / 16, a 20px icon,
one line of text (14), link on the right in `--amber-700`. Used for trial status,
"The AI only answers from this catalog", Install app. Dismissible banners have a
close icon button. Maximum one banner per page.

### 7.12 Empty, loading, error states
- Empty: 48px outline icon in an `--amber-100` circle, one sentence saying what is
  empty, one primary button saying what to do. No jokes.
- Loading: skeleton blocks in `--surface-2` matching the final layout (a slow
  opacity pulse is allowed, none under reduced motion). Buttons show their
  loading state. Never a full-page spinner except the BrandGate.
- Error / offline (LoadFailed): outline icon, what failed in plain words, one
  primary button "Try again". Network messages come from `netDetail.js`.

### 7.13 Charts (Insights, Spark)
Hand-rolled SVG stays. Line `--amber-500` 2px with a fill fading from 16% amber to
transparent. Dotted `--border` gridlines, axis labels 12 muted, tabular numbers.
Tooltip is a `.glass` chip. Range control is the segmented control. Gains
`--live`, drops `--danger`, always with an arrow icon and a sign. Never more than
two series per chart.

### 7.14 Progress, stepper, tour
Progress bar: 8 high, `--surface-2` track, `--amber-400` fill, radius pill.
Stepper (Connect, Welcome): numbered circles 28px (numbers are allowed here
because it is a real sequence), a line between steps, current step `--amber-400`,
done steps with a check. Tour coachmark: `--surface` card, radius 16, 16 padding,
arrow, "2 of 5" caption, [Skip, Next]; page dimmed with `--overlay`.

### 7.15 Notifications bell and panel
Bell is an icon button 40 x 40 inside the topbar's right cluster, with a count
badge top-right. Panel is a menu 360 wide (full-width sheet on mobile): header
"Notifications" with "Mark all read" tertiary button, rows with unread dot
(`--amber-500`), title 14 / 600, time 12 muted. Footer link "See all".

### 7.16 Paywall (LockButton and GlassUpsell)
LockButton looks like a secondary button with a 16px lock icon and the label of the
locked action. Clicking opens GlassUpsell: a `.glass-amber` modal with the plan
benefits (three rows), price, primary "Upgrade" and tertiary "Not now". Never block
the page behind a full-screen paywall.

### 7.17 Icons
One module: `components/ui/Icon.jsx` (merge icons.jsx, the private Icon copy in
Shell.jsx and inline SVGs). Outline style, 1.75 stroke, round caps and joins,
24 viewBox, rendered at 20px (16 small, 24 large). `currentColor` only. No emoji
as icons, ever.

## 8. App shell and navigation (restructure)
### 8.1 Information architecture
Group the 12 destinations by the job the owner is doing:
- **Sell**: Overview, Inbox, Catalog, Connect, Test bot
- **Grow**: Insights, Chat with Velo, Refer & Earn, Billing
- **Setup**: Business (Profile), AI settings (Settings), Help
Notifications live in the topbar bell. Admin stays outside the app navigation.
Section names stay Sell, Grow, Setup.

### 8.2 Desktop (min-width 1024)
```
+-------------+--------------------------------------------------+
| logo  VeloSales AI | (topbar, glass, 64 high)   [bell][help][theme][avatar] |
| Sell        +--------------------------------------------------+
|  Overview   |  Page title (28)                [secondary][primary]|
|  Inbox  (3) |  description (14, muted)                           |
|  Catalog    |                                                    |
|  Connect    |  content (max 1120, one left edge)                 |
|  Test bot   |                                                    |
| Grow        |                                                    |
|  ...        |                                                    |
| Setup       |                                                    |
|  ...        |                                                    |
| [plan mini] |                                                    |
| [user row]  |                                                    |
+-------------+--------------------------------------------------+
```
- Sidebar: 264 wide, solid `--surface`, 1px right border (no glass). Top: logo +
  wordmark at 64 high, aligned with the topbar. Group titles 12 / 500 muted.
  Items 44 high, icon 20, label 14 (active 600), 8px gap, radius pill. Active
  item: `--amber-100` fill, 1px `--amber-line`, label `--brown-900`. Badge on Inbox
  shows chats needing the owner. Bottom: a small plan card (plan name, usage bar,
  "Upgrade" tertiary), then the user row (avatar, name, chevron) that opens a menu:
  Business, Theme (System / Light / Dark), Help, Sign out. Legal links (Privacy,
  Terms) are small links at the very bottom. There is no separate app footer.
- Topbar: `.glass`, sticky, 64 high. Left: empty on desktop (the page title lives
  in the content). Right cluster, 8px gaps: notification bell, help icon, theme
  toggle, avatar. All 40 x 40.

### 8.3 Tablet (640 to 1023)
No sidebar. Topbar 64: menu button left (opens the sidebar as a drawer over a
`--overlay`), topbar title (18 / 600) after it, right cluster. Content padding 24.

### 8.4 Mobile (max 639)
- Topbar 56: logo (28) left, topbar title center-left, bell right. Page header
  inside the content shows only the description and actions (the title is in the
  topbar).
- Bottom bar: floating `.glass` pill, 64 high, 16px side margins, 12px above the
  bottom (plus safe area), radius pill. Five items: **Overview, Inbox, Catalog,
  Connect, More**. Each: 24px outline icon above a 12 / 500 label. Active item:
  `--amber-100` fill, `--amber-line` outline, label 600 `--brown-900`. Inbox shows
  the count badge. Content gets `--bar-clearance` bottom padding.
- More: a bottom sheet with rows for Test bot, Insights, Chat with Velo, Refer &
  Earn, Billing, Business, AI settings, Help, Theme, Sign out.

### 8.5 Page header pattern (every app page)
Title (28 / 600) left, optional one-line description (14 muted) below at 8px.
Right side: secondary actions then **one primary action** at the far right. On
mobile the actions drop below the description, full width, primary on top. No page
repeats its title elsewhere.

```css
.app {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  min-height: 100dvh;
  background: var(--bg);
}
.sidebar {
  position: sticky;
  top: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: var(--s-6);
  padding: var(--s-4);
  background: var(--surface);
  border-right: 1px solid var(--border);
}
.main { min-width: 0; }
.page { max-width: var(--content-max); margin: 0 auto; padding: var(--s-6) var(--s-8) var(--s-12); }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); margin-bottom: var(--s-6); }
.page-title { font-size: 28px; font-weight: 600; line-height: 1.2; color: var(--ink); }
.page-sub { margin-top: var(--s-2); font-size: 14px; color: var(--ink-muted); }
.page-actions { display: flex; align-items: center; gap: var(--s-3); }
@media (max-width: 1023px) {
  .app { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .page { padding: var(--s-4) var(--s-4) var(--bar-clearance); }
}
```

## 9. Page blueprints (positions of everything)
All pages use the page header from 8.5 and the components from section 7.

| Page | Primary action | Position |
|---|---|---|
| Overview | Add product (or Connect WhatsApp if not connected) | page header, right |
| Inbox | Take over chat | thread header, right |
| Catalog | Add product | page header, right |
| Connect | Go live | channel card, bottom right |
| Test bot | Send (composer) | composer, right |
| Insights | none (range control instead) | page header, right |
| Chat with Velo | Send (composer) | composer, right |
| Refer & Earn | Copy link | hero card |
| Billing | Upgrade | hero card, right |
| Business (Profile) | Save changes | sticky save bar, right |
| AI settings | Save changes | sticky save bar, right |
| Contact sales | Send message | form footer, right |

### 9.1 Overview (Dashboard)
Desktop 12-column grid, 24 gaps:
1. Header: greeting "Good morning, {name}" (h1 28) and today's date (14 muted) left;
   primary action right.
2. Row A: hero card "Conversations today" (cols 1-8) with the glass range selector
   and a status chip ("Bot is live" / "Test mode"); right column (cols 9-12) holds
   the trial info strip and the setup checklist card (progress bar plus 4 to 5
   rows with check circles).
3. Action circles row under the hero: Add product, Test bot, Connect, More.
4. Row B: four stat tiles (card, label 12 muted, number 28 / 600 tabular, Spark
   below, change chip): replies sent by AI, new leads, average reply time, flagged.
5. Row C: "Needs your attention" list (cols 1-8, rows with avatar, customer name,
   last message preview, time, chip, chevron; max 5, then "See all in Inbox" tertiary)
   and "Quick actions" tile card (cols 9-12).
Mobile order: greeting, hero, action circles, trial strip, stat tiles (2 x 2),
needs-attention list, checklist.

### 9.2 Inbox (Chats)
- Desktop two panes inside the page: list (360 wide) and thread (flexible), each
  scrolling independently, full viewport height under the topbar.
- List pane: search input (pill), filter chips (All, Needs you, Bot handled,
  Unread), rows 72 high: avatar 40, name 14 / 600, preview 14 muted (one line),
  time 12 right, unread dot or count badge, "Needs you" danger chip.
- Thread header (64): avatar, name, phone (12 muted), status chip (Bot replying,
  Needs you, Resolved), then right: secondary "Hand back to bot" and primary
  "Take over chat" (only the relevant one primary).
- Messages: customer left on `--surface` bubble with border; bot or agent right on
  `--amber-300` bubble with `--brown-900` text and a tiny label ("Bot" or "You");
  radius 16 with one 4px corner toward the sender; max width 70%; time 12 muted
  below; day separators centered chips.
- Quick replies: one row of chips above the composer. Composer: pinned bottom,
  textarea pill (min 48), attach icon button, 48px primary circle send button.
- Mobile: list full screen; tapping a chat opens the thread full screen with a back
  icon button; the bottom bar hides inside a thread.

### 9.3 Catalog
Core promise of the product, so it comes first in setup.
1. Header: title, primary "Add product" right, secondary "Import" next to it.
2. Info strip: "The AI only answers from this catalog."
3. Toolbar: search (pill, flexible), filter chips (All, In stock, Out of stock),
   sort menu right.
4. Product rows (table on desktop, list on mobile): 44px thumbnail, name 14 / 600,
   short description 14 muted, price (tabular, right-aligned), stock chip,
   "AI can mention" toggle, chevron. Row click opens the edit sheet.
5. Edit sheet (right sheet 480, bottom sheet on mobile): photo, name, price,
   description, stock, variants; footer [Delete (danger, left), Cancel, Save changes].
Empty: "Add your first product" with Add and Import actions.

### 9.4 Connect
1. Header: title and description "Connect your WhatsApp number so the bot can reply."
2. Channel cards grid (1 column mobile, 2 desktop): icon circle, channel name, status
   chip (Not connected, Test mode, Live), one-line description. Footer inside the
   card: secondary action left ("Send test message"), primary right ("Go live",
   disabled until the test passes, with the reason shown in muted text).
3. Setup flow opens in a sheet with the Stepper (numbered steps, one task each),
   [Back, Next] footer, and a final "Done" screen with the TEST to LIVE explanation.
4. State changes (test passed, went live) use a toast and the chip color change.
Keep each step short; split the current 670-line page into small step components.

### 9.5 Test bot (Playground)
Two columns on desktop: left a chat preview (same bubble styles as Inbox, composer
pinned), right a card "What the bot used" listing the catalog items it referenced
and the language detected. Header right: ModelPicker (select) and tertiary "Reset
chat". Mobile: chat first, "What the bot used" as a collapsible section under it.

### 9.6 Insights
Header right: segmented range (7 days, 30 days, 90 days). Row of four stat tiles
with Spark. Main chart card (conversations over time), full width, 280 high. Two
cards below side by side: "Top products asked about" (rows with a progress bar)
and "Common questions" (list). A last table "By channel". Mobile stacks everything.

### 9.7 Chat with Velo (VeloSalesAI)
Assistant chat for the owner. Centered thread max width 720, assistant replies on
`--amber-300` bubbles, owner messages on `--surface`; suggestion chips on an empty
chat; composer pinned bottom. Desktop shows a history list (240 wide) on the left.

### 9.8 Refer & Earn
Hero card containing the referral link in a read-only pill, the primary "Copy link"
button and share buttons (WhatsApp, copy). Then three stat tiles (invited, joined,
earned) and a "How it works" list of three rows (numbered, a real sequence), then a
rewards history list.

### 9.9 Billing
1. Hero card: current plan name, renewal date, usage meter (progress bar with
   "1,240 of 2,000 replies"), primary "Upgrade" bottom-right inside the card.
2. Plan picker: three plan cards in a row (stacked on mobile): name, price (28 /
   600), five benefits as rows with check icons, the current plan tagged, the
   recommended plan with an amber outline and a "Recommended" chip, button at the
   bottom of each card.
3. Payment method row, then invoices table (date, amount, status chip, download).
Currency and amounts use `money.js` and `locale.js`.

### 9.10 Contact sales
Single card max width 560 centered: short intro, form (name, business, phone,
message), footer [primary "Send message"]. Optional side card with direct contact.

### 9.11 Business (Profile) and AI settings
Grouped cards, each with a 18 / 600 title and a muted line: Business details,
Working hours, Greeting and tone, Language (English, Pidgin, Both), Handoff rules
(toggles), Notifications (toggles), Appearance (segmented System / Light / Dark).
A **sticky save bar** appears at the bottom only when something changed: left text
"Unsaved changes", right [Discard (secondary), Save changes (primary)]; on mobile
it sits above the bottom bar, buttons full width. Danger zone (delete account,
disconnect) as the last card, `--danger` outline button, always asks to confirm.

### 9.12 Help
Header; search input; two columns (FAQ accordions, Contact options card with
WhatsApp and email buttons); GuideSlides in a card with [Back, Next]. Accordion
rows 56 high, chevron rotates, one open at a time.

### 9.13 Notifications
List page: filter chips (All, Unread), rows with unread dot, title, one-line text,
time. Detail page `/:id`: back icon button, title (28), time, content card, optional
primary action. Empty: "You're all caught up."

### 9.14 Login, Reset, Welcome, Onboarding
- **Login** (sign in, sign up, OTP): desktop two-panel. Left 48%: dark hero-style
  panel with the logo, one headline (28) and a static chat mock (no live demo).
  Right: centered form card max 420 on the cream wash (light) or warm black (dark):
  logo 48, segmented [Sign in | Create account], fields, "Forgot password?" tertiary
  right-aligned under the password, full-width primary xl button, a quiet legal line
  (12 muted). OTP step: 6 OTP boxes, "Resend code in 0:30" tertiary, [Back] tertiary
  left, [Verify] primary. Mobile: single column, no left panel.
- **Reset**: same card, one email field, primary "Send reset link".
- **Welcome** (5-question quiz): full screen, segmented progress at the top (5
  segments), question 28 / 600, answers as selectable pill rows (like the plan
  picker), [Back] tertiary left and [Continue] primary right pinned at the bottom,
  "Skip" tertiary top-right.
- **Onboarding** (6-slide tour): hero-style card for the illustration area, title
  28, text 16, dots, "Skip" top-right, [Next] primary bottom (the last slide says
  "Get started").

### 9.15 Public pages and 404
- **Landing**: top nav (logo left, links center, "Log in" tertiary and "Start free"
  primary right), hero (display 48 headline, 16 subcopy max 560, primary lg and
  secondary lg buttons, a hero-style product preview with a chat mock), three
  feature rows, pricing (plan cards as in Billing), FAQ accordion, footer. Choose
  one canonical marketing site: Landing.jsx or `website/`, and redirect the other.
- **FAQ, Privacy, Terms**: reading column max 720, body 16 / 1.6, h2 22 (use the
  scale: 22 for these legal headings only), 32 between sections, table of contents
  on desktop.
- **404**: centered logo, "That page doesn't exist", primary "Go to Overview".
- **Splash / BrandGate**: page background token, AnimatedLogo 160px centered, plays
  once per session, then the app fades in over 150ms.
- **Admin**: out of scope. Later, reuse tokens and tables, no glass.

## 10. States, forms and feedback
- Every list and page needs four states designed: loading (skeleton), empty,
  error (LoadFailed), and content.
- Forms: single column max 560; two columns only for short pairs (first and last
  name, city and state). Validate on blur and on submit. Put the first error in a
  summary at the top of long forms and focus the first invalid field.
  Never disable the submit button just because the form is invalid; show the
  reason instead. Save buttons show a loading state and then a toast.
- Destructive actions: danger button, confirmation modal naming exactly what will
  be deleted, primary label repeats the action ("Delete product"), never close on
  overlay click.
- Success feedback: a toast for quick actions, an inline success chip for state
  changes. No confetti.
- Offline: LoadFailed plus a "Try again" primary button. Keep already-loaded data
  visible when a refresh fails.

## 11. Motion
- Only motion that answers an action: press, open, close, confirm, tab change.
- 180 to 240ms with `--ease`. Pressed buttons scale to 0.97. Sheets slide up.
  Modals fade and scale from 0.98. Toasts slide up 8px. Route changes fade in 150ms.
- Allowed loops: spinner, typing indicator, skeleton pulse. Nothing else loops.
- One entrance only: the hero card on first load of Overview.
- No bounce, elastic, overshoot easing, shine sweeps or parallax.
- All animation is switched off in one place:
  `@media (prefers-reduced-motion: reduce)`.

## 12. Content and copy
- Voice: warm, plain, direct. Say what will happen. Second person ("your catalog").
- Sentence case. Buttons start with a verb. No exclamation marks in UI text.
- Errors: "Couldn't save changes. Check your connection and try again." (what
  failed, why if known, what to do). Never "Oops" or "Something went wrong" alone.
- Empty states: "No chats yet. Customers who message your WhatsApp will appear here."
- Money: always through `money.js` (symbol, thousands separators, 2 decimals only
  when needed), tabular numerals, never mixed currencies on one screen.
- Dates and times: relative under 24 hours ("12 min ago"), otherwise "4 Oct, 7:32 pm".
- Phone numbers: through `phone.js`, grouped and readable.
- Customer messages (including Pidgin) are shown exactly as written. The interface
  itself stays in clear English.
- Real content only. No lorem ipsum and no placeholder names in production.

## 13. Accessibility
- Text contrast 4.5:1, large text and UI boundaries 3:1 (verified in section 3.2).
- Visible focus on every interactive element: 2px `--focus` outline, 2px offset.
- A "Skip to content" link, landmarks (nav, main), one h1 per page, logical order.
- Everything works with a keyboard: tabs and segmented controls with arrow keys,
  modals trap focus and restore it, menus close on Escape.
- Icon-only controls have `aria-label`. Status never relies on color alone.
- Form errors connect to fields with `aria-describedby` and `aria-invalid`.
- Toasts use `role="status"`, errors `role="alert"`.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Tap targets at least 44 x 44 on touch devices.
- Set `lang="en"` on `<html>`.

## 14. Responsive behavior
| Area | Mobile (up to 639) | Tablet (640-1023) | Desktop (1024+) |
|---|---|---|---|
| Navigation | floating glass bottom bar + More sheet | drawer from menu button | fixed 264 sidebar |
| Topbar | 56, logo and title | 64, menu and title | 64, right cluster only |
| Page padding | 16 | 24 | 32 |
| Card grids | 1 column | 2 columns | auto-fit, min 240 |
| Tables | list rows | tables | tables |
| Modals | bottom sheets | centered modals | centered modals, right sheets for edit |
| Page actions | full width under the header | inline right | inline right |
Test at 360, 390, 768, 1024 and 1440 wide, in both themes.

## 15. Implementation rules
- File structure (replace the single 131 KB `styles.css`):
  ```
  frontend/src/styles/tokens.css     # section 3 only
  frontend/src/styles/base.css       # reset, body, headings, focus, reduced motion
  frontend/src/styles/layout.css     # shell, page, grid, header
  frontend/src/styles/components.css # button, input, card, chip, glass, table, ...
  frontend/src/styles/pages.css      # page-specific rules, kept small
  frontend/src/components/ui/        # Button, IconButton, Input, Textarea, Select,
                                     # OtpInput, Toggle, Checkbox, Radio, Chip, Badge,
                                     # Avatar, Card, Row, Table, Tabs, Segmented, Modal,
                                     # Sheet, Toast, Menu, Tooltip, EmptyState, Skeleton,
                                     # Banner, Progress, Stepper, Icon
  ```
  Import them in this order in `main.jsx`: tokens, base, layout, components, pages.
- Zero `!important`. Zero hard-coded colors, font sizes, radii or spacing outside
  `tokens.css` and the primitives.
- Class naming: short, flat, lowercase with dashes (`btn`, `btn-primary`, `card`,
  `page-header`). No deep selector chains.
- Keep lazy loading and the single Suspense boundary. Keep the hand-rolled charts,
  toasts, modals and tour (restyle only).
- Primitive props: `Button` takes `variant`, `size`, `icon`, `loading`, `disabled`,
  `fullWidth`, `as`. Every primitive forwards `className`, `aria-*` and refs.
- Delete the dead code: the duplicate `:root` blocks, the green light theme, the
  blue light-mode override passes, aurora, dot grid, neumorphism, confetti and
  shine keyframes, the logo orbit, ScatterLogo effects.

## 16. Build order (stop for review after each step)
Phase 1: foundation
1. Tokens and theme: `tokens.css`, Figtree, `data-theme` switch (System / Light /
   Dark), delete duplicate `:root` and override passes. Verify contrast.
2. Base styles: typography roles, spacing, focus, reduced motion.
3. Primitives: build ONE Button first and show it. After approval build the rest.
4. Icon module: merge the three icon sources.
5. Shell: sidebar, topbar, mobile bar and More sheet, page header pattern.
Phase 2: highest-value screens
6. Login, Reset. 7. Overview. 8. Catalog. 9. Connect (split into steps).
10. Inbox and Test bot. 11. Insights. 12. Business and AI settings.
13. Billing, paywall, Contact sales. 14. Welcome, Onboarding, Splash.
15. Notifications, Refer & Earn, Help, Chat with Velo.
Phase 3: the rest
16. Landing and public pages. 17. 404. 18. Admin (separate, later).

Definition of done for every page:
- Uses only primitives and tokens; `node design-check.mjs frontend/src` reports 0
  must-fix and no new warnings.
- Looks right at 360, 390, 768, 1024 and 1440, in light and dark.
- All four states exist (loading, empty, error, content).
- Primary action is where section 9 says. Keyboard and focus work.
- Behavior and API calls unchanged. Committed.

## 17. Quality checklist (run before approving any screen)
- [ ] Only the type roles in section 4 appear (8 sizes, 4 weights).
- [ ] Only spacing values from the scale appear; gaps are consistent.
- [ ] Buttons are 32 / 40 / 48 / 56 high, same height in the same row.
- [ ] One primary button per section, in the right place.
- [ ] Everything shares one left edge; cards in a row are equal height.
- [ ] No hard-coded colors; both themes look right.
- [ ] Glass only on the allowed surfaces; text on glass is readable.
- [ ] Icons are one style and size; no emoji.
- [ ] Focus rings visible; tap targets 44 or more.
- [ ] Copy follows section 12; money, dates and phones are formatted.

## 18. Don'ts (these make it look AI-made or inconsistent)
- No stacks of identical cards. One hero, then lists, rows and a few cards.
- No decorative gradients, no purple-blue gradients, no aurora or dot grid.
- No glass on rows, tables, forms, chat bubbles or numbers.
- No cards inside cards.
- No gray text on amber fills. No amber text on light surfaces except `--amber-700`.
- No emoji as icons. No numbered markers unless the content is a real sequence.
- No page that writes its own button, modal, input or table.
- No new colors, radii, font sizes, weights, shadows or breakpoints.
- No `!important`. No inline styles for design values.
- No two different sizes for the same role (the old 39px page title and 17px
  topbar title must not return).
- No bounce, elastic or looping animation (spinner, typing and skeleton excepted).
