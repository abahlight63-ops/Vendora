# DESIGN.md

Read this file before any UI work and follow it strictly. If something is not
specified here, ask before inventing it.

## Direction
A warm, confident money app. Solid, readable content with a few glass surfaces
that float above it. Gold is the signature. Everything else stays quiet.

- One memorable thing: the balance hero card (dark, glossy, with a gold glow).
- Glass is used in exactly four places: the floating bottom nav, the hero card's
  inner chips, bottom sheets and modals, and chart tooltips. Nowhere else.
- Lists, rows, forms, tables and every number the user must read stay on solid
  surfaces. Readability beats effect, especially for money.
- Reference apps inform structure and feel only. Do not copy any brand's logo,
  illustrations, icons, copy or exact layout.

## Themes
Light and dark are both first-class. Define every color as a CSS variable under
`:root` (light) and `[data-theme="dark"]`. Default to the system setting
(`prefers-color-scheme`). Settings offers System / Light / Dark.
Never hard-code a color in a component. Always use a token.

### Light tokens
- --bg: #F4F2EE (page, warm light gray)
- --surface: #FFFFFF (cards, rows)
- --surface-2: #F7F6F3 (keys, inputs, quiet fills)
- --border: #E9E6DF
- --ink: #1D1A14 (text)
- --ink-muted: #6A645A (secondary text, never on colored fills)
- --gold-500: #F5B63A (primary accent, icons, focus rings)
- --gold-400: #FFCB78 (action circles, primary fill)
- --gold-300: #FFE3B0 (chips)
- --gold-100: #FFF6E4 (selected backgrounds, banners)
- --gold-700: #8F5B00 (links and text on light, passes 4.5:1)
- --brown-900: #3E2A0F (names, strong headings on cream)
- --positive: #1F7A4D on --positive-bg: #E3F5EA
- --negative: #C0392B on --negative-bg: #FBE9E6

### Dark tokens
- --bg: #14100A (warm black, never pure #000)
- --surface: #1D1913
- --surface-2: #26211A
- --border: rgba(255,255,255,0.08)
- --ink: #F6F1E7
- --ink-muted: #A99F8E
- --gold-500: #F5B63A
- --gold-400: #F5B63A (fills use gold with dark text #2A1A00)
- --gold-300: #4A3611 (chips on dark)
- --gold-100: #2A2012
- --gold-700: #FFD27A (links and text on dark)
- --positive: #5FD38D on #12301F
- --negative: #FF8A7A on #3A1713

## Typography
- Font: Figtree (Google Fonts) for everything. Weights 400, 500, 600, 700.
- Fallback: system-ui, sans-serif.
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40 / 48. Body 16, line-height 1.5.
- Headings 600-700, line-height 1.2, sentence case.
- Money and numbers: weight 600, `font-variant-numeric: tabular-nums`, never thin.
- Balance on the hero card: 40-48px, weight 600.
- No all-caps labels, no tracked-out eyebrows above headings, no accent color on
  a single word of a heading.

## Shape and spacing
- Spacing base 4px. Allowed: 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Radius: 16px cards and rows, 14px inputs, 24px hero card, 28px sheets,
  999px for pills, buttons, chips, nav and keypad keys.
- Screen padding 16px on mobile, content max width 480px on phones and 1120px
  on desktop dashboards. Design mobile-first and verify at 390px and 360px.
- Touch targets at least 44px.
- Shadows on solid surfaces: none, or 0 1px 2px rgba(0,0,0,0.05). Separate
  surfaces with 1px --border and spacing, not heavy shadows.

## Glass recipe (the only places it is allowed)
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
  background: rgba(38, 32, 24, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18),
              0 12px 36px rgba(0, 0, 0, 0.45);
}
```
Rules:
- Glass needs something behind it (scrolling content, the hero glow). Never on
  a flat empty background.
- Always provide a solid fallback:
  `@supports not (backdrop-filter: blur(1px)) { .glass { background: var(--surface); } }`
- Honor `@media (prefers-reduced-transparency: reduce)` by switching to solid.
- No more than two blurred layers on screen at once. Phones with weak GPUs lag.
- Text on glass must keep 4.5:1 contrast. Check both themes.

## Components
### Hero balance card
- Radius 24px. Base: dark gradient #17130C to #2A1D07 (same in light and dark
  themes). One soft blurred gold glow (radial, rgba(245,182,58,0.5)) in a corner.
  This is the only decorative gradient in the app.
- Currency selector: glass pill, flag + code + chevron.
- Balance: white, 40-48px. Hide/show eye icon beside it.
- Account chip: glass pill showing masked number and a chevron.

### Action circles (Add funds, Transfer, Convert, More)
- 56px circles, fill --gold-400, dark outline icon (Lucide, 1.75 stroke).
- Label below, 14px, --ink. Four across, evenly spaced.

### Floating bottom nav
- Glass pill floating 12px above the bottom edge, 16px side margins, height 64px.
- Five items max: outline icon plus label. Active item: --gold-100 fill, 1px
  --gold-500 outline, pill shaped, label in --brown-900 (dark: --gold-700).
- Content scrolls beneath it and shows through the blur. Add bottom padding to
  pages so nothing hides behind it.

### Rows and settings lists
- Solid --surface card, 1px --border, radius 16px, rows 56px tall.
- Left: outline icon 20px. Middle: label. Right: chevron or toggle or status chip.
- Section titles in --ink-muted, 14px, sentence case.
- Rows are separated by spacing or a hairline, never by nested cards.

### Chips and badges
- Pill, 12-14px, weight 500. Promo/neutral: --gold-300. Positive: green pair.
  Negative: red pair. A chip is a status, not decoration.

### Buttons
- Heights 40 / 48 / 56. Fully rounded. Primary: --gold-400 fill, dark text.
  Secondary: --surface with 1px --border. Tertiary: text in --gold-700.
- One primary per screen. Labels state the action ("Send money", "Save changes").
  Never "Submit", never an arrow appended to the label.
- All states: hover, focus-visible (2px --gold-500 ring, 2px offset), pressed,
  disabled (50%), loading (spinner, width unchanged).

### Inputs and PIN entry
- Inputs: 48px, radius 14px, 1px --border, label above, never placeholder-only.
- Focused input: 1.5px --gold-500 border and a soft gold glow.
- PIN boxes: 4 rounded squares 56px, active one gets the gold border and glow.
- Keypad: 3x4 grid of pill keys, --surface-2 fill, 22px numerals, 56px tall.

### Charts (for markets and balances)
- Smooth line in --gold-500, 2px, with a soft fade fill under it from gold at
  16% to transparent. No heavy gridlines (dotted hairlines at most).
- Selected point: a glass tooltip chip with the value and time.
- Range switch (1D, 1W, 1M, 1Y): pill segmented control, selected = --gold-100.
- Gains in --positive, losses in --negative, always with a sign and an arrow icon
  so color is never the only signal.

### Stories / highlights row (optional)
- 64px circles with a 2px gold ring and a label below.

## Motion
- Only motion that answers an action: press, open, close, confirm, tab change.
- 180-280ms, ease-out. Sheets slide up. Buttons scale to 0.97 on press.
- One orchestrated entrance at most (the hero card on first load).
- No bounce, no looping animation, no fade-up on every section, no hover
  effects on every card. Respect `prefers-reduced-motion`.

## Copy
- Sentence case. Plain verbs. Say exactly what will happen.
- Errors say what went wrong and how to fix it, never "Oops".
- Real content only. No lorem ipsum, no "John Doe".

## Don'ts (these make it look AI-made)
- No identical cards stacked everywhere. Vary hierarchy: one hero, then lists.
- No gradient washes as decoration, no purple-blue gradients.
- No glass on rows, tables, forms or number-heavy areas.
- No cards inside cards.
- No gray text on colored fills.
- No emoji as icons. Lucide outline icons only, one stroke width.
- No numbered markers (01 / 02) unless the content is truly a sequence.
- No new colors, radii, fonts or shadows beyond this file.
- No pure #000 or pure #fff text on pure #000 or #fff backgrounds.

## Screen blueprints
- Lock/PIN: warm cream-to-white top wash in light, warm black in dark. Avatar
  circle, greeting, 4 PIN boxes, keypad, quiet "Not you? Sign out" link.
- Home: top bar (avatar, greeting, notification and help in one pill), optional
  stories row, hero balance card, four action circles, one info strip, quick
  actions, floating glass nav.
- Settings: profile row, one promo banner on --gold-100, grouped lists with
  section titles, theme setting (System / Light / Dark).
- Asset detail: name and price, chart with range switch, key stats as plain
  rows, one primary action at the bottom.

## Rules for the agent
- Use shadcn/ui components, restyled with the tokens above. Do not hand-write
  buttons, inputs, dialogs or toggles.
- Put all tokens in one place (CSS variables and the Tailwind theme).
- Build in this order and review each step before the next:
  1. Tokens, fonts, theme switch (light and dark).
  2. One screen, solid surfaces only.
  3. Hero card, then bottom nav glass.
  4. Sheets, chart tooltip.
- After each screen, take a screenshot at 390px in both themes and check it
  against this file. List mismatches before fixing them.
- Do not touch backend files (routes, auth, billing, db) during UI work.
