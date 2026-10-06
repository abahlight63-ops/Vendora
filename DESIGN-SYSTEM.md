# VeloSales AI — Unified Design System

This file merges `velosales (1).md` (web) and `files (2)/MOBILE-DESIGN.md`
(Flutter) into ONE system. Where they disagreed, the conflict is resolved in
the section named "Resolutions". This file is the source of truth for both
apps. If something is not specified here, stop and ask.

## 0. How to work with this file
- Scope: `frontend/` and `mobile/`. The Express backend in `src/` and the
  Admin console are untouched unless told.
- Keep all behavior, routes, API calls and data flow exactly as they are.
  Presentation and structure only.
- No new dependencies. No Tailwind, no shadcn, no icon packages, no CSS-in-JS
  on the web. No new Flutter packages on mobile unless asked.
- One step at a time. Run the project's own checker after each step
  (`node design-check.mjs frontend/src`, `flutter analyze`), fix everything it
  lists, then commit.

## 1. Product and design intent
VeloSales AI turns a business's WhatsApp number into a 24/7 AI sales assistant.
Users are small-business owners: busy, non-technical, often on a phone. They
need to trust it in seconds and act without reading.

### Design principles (apply in this order when they conflict)
1. Clarity over decoration. One main thing per screen, obvious next action.
2. Consistency. The same thing always looks and sits the same way.
3. Warm and premium. Rich amber gold on deep charcoal, silver for primary
   actions, soft glass only where it floats above content.
4. Readable money and numbers. Solid surfaces, tabular numerals, high contrast.
5. Fast on cheap phones. Few effects, no heavy blur stacks, no looping motion
   except the typing indicator.

## 2. The one accent
The brand gold is `#F5B63A`. It is the single accent across both apps. It reads
as a rich, saturated amber — never as a pale cream, never as bronze text.

| Token | Value | Used for |
|---|---|---|
| accent / amber-500 | `#F5B63A` | the brand gold: fills, rings, dots, chart lines, gold text on dark |
| accentGlow / amber-400 | `#FFD27A` | hover, glow ring, highlight on dark |
| onAccent | `#2A1A00` | text and icons on gold fills |
| amber-300 | `#FFE3B0` | chips and outgoing bubbles (light surfaces) |
| amber-700 | `#8F5B00` | gold text/icons on light surfaces (contrast 5.7:1) |

**Resolutions**
- **Gold fills are `#F5B63A`, not `#FFC977`.** The old web spec called the pale
  `#FFC977` the "primary action fill". Measured against the real logo it is
  washed out and the button edge barely separates from the cream page. Primary
  buttons, plan badges, toggles and any large gold surface now use `#F5B63A`.
  `#FFD27A` is the hover/glow tone only.
- **Dark theme keeps gold at full strength.** `#F5B63A` on `#121110` is 9.3:1 —
  excellent. Do not dim it.
- **No bronze text.** `#8F5B00` is for light surfaces only, and only for text
  and small icons — never for a filled button.

## 3. Color tokens
Exactly one `:root` block and one `[data-theme="dark"]` block in
`frontend/src/styles/tokens.css`. No color, size or radius anywhere else;
components use `var(--token)` only. On mobile, every color lives in
`mobile/lib/theme.dart` as a token — never hard-coded in a widget.

### Web, light (`:root`)
```
--bg: #F4F4F4;  --surface: #FFFFFF;  --surface-2: #F7F7F7;
--border: #EBEBEB;  --input-border: #8C8C8C;
--ink: #1A1A1A;  --ink-muted: #6B6B6B;  --brown-900: #3E2A0F;
--amber-500: #F5B63A;  --amber-400: #FFD27A;  --amber-300: #FFE3B0;
--amber-150: #FFF3DC;  --amber-100: #FFF8EC;  --amber-line: #F7D8A0;
--amber-700: #8F5B00;  --on-amber: #2A1A00;
--focus: #8F5B00;  --focus-glow: rgba(245, 182, 58, 0.35);
--live: #1F7A4D;  --live-bg: #E6F7EA;
--danger: #C0392B;  --danger-bg: #FBE9E6;
--badge: #D92D20;  --on-badge: #FFFFFF;
--hero-bg: #0E0E0E;  --hero-ink: #FFFFFF;  --hero-muted: #B8B8B8;
--hero-glow: rgba(245, 182, 58, 0.5);
--glass-bg: rgba(255, 255, 255, 0.62);
--glass-border: rgba(255, 255, 255, 0.7);
--glass-hl: rgba(255, 255, 255, 0.9);
--glass-shadow: rgba(62, 42, 15, 0.12);
--glass-amber-bg: rgba(255, 201, 119, 0.28);
--glass-amber-border: rgba(255, 224, 170, 0.75);
--glass-amber-shadow: rgba(143, 91, 0, 0.18);
--overlay: rgba(26, 26, 26, 0.5);
```

### Web, dark (`[data-theme="dark"]`)
```
--bg: #121110;  --surface: #1C1A17;  --surface-2: #262320;
--border: rgba(255, 255, 255, 0.08);  --input-border: #7A7468;
--ink: #F5F1EA;  --ink-muted: #A8A094;  --brown-900: #F5F1EA;
--amber-500: #F5B63A;  --amber-400: #FFD27A;  --amber-300: #4A3611;
--amber-150: #2A2012;  --amber-100: #241C10;  --amber-line: #6B4E14;
--amber-700: #FFD27A;  --on-amber: #2A1A00;
--focus: #F5B63A;  --focus-glow: rgba(245, 182, 58, 0.3);
--live: #5FD38D;  --live-bg: #12301F;
--danger: #FF8A7A;  --danger-bg: #3A1713;
--hero-bg: #0E0E0E;  --hero-ink: #FFFFFF;  --hero-muted: #B8B8B8;
--hero-glow: rgba(245, 182, 58, 0.5);
--glass-bg: rgba(38, 35, 32, 0.55);
--glass-border: rgba(255, 255, 255, 0.14);
--glass-hl: rgba(255, 255, 255, 0.18);
--glass-shadow: rgba(0, 0, 0, 0.45);
--glass-amber-bg: rgba(245, 182, 58, 0.16);
--glass-amber-border: rgba(245, 182, 58, 0.35);
--glass-amber-shadow: rgba(0, 0, 0, 0.45);
--overlay: rgba(0, 0, 0, 0.6);
```

### Mobile (dark-only, `VsTokens` in `theme.dart`)
```
accent        #F5B63A     accentGlow    #FFD27A     onAccent     #2A1A00
bgTop         #2A332F     bgBottom      #0E1210
surfaceTop    #232A27     surfaceBottom #1A201D     surfaceDeep  #0F1311
surfaceGlass  rgba(255,255,255,0.10)
glassBorder   rgba(255,255,255,0.12)
innerHighlight rgba(255,255,255,0.06)
hairline      rgba(255,255,255,0.08)
silverTop     #FFFFFF     silverBottom  #A8ADAA     onSilver     #101513
text          #F2F4F1     textMuted     #8F9994     textFaint    #5F6965
danger        #FF8A7A     success       #7FD6A0
```

**Resolutions**
- The web spec asked for a cream/amber banking look. The mobile spec asked for
  deep green-charcoal with silver pills. Both are now real: **web is warm cream
  with gold, mobile is deep charcoal with gold and silver.** They share the
  accent, the radii, the spacing scale and the icon language, so the brand
  reads as one product on both platforms.
- The mobile app stays **dark-only**. Do not build a light theme for it now.
- The web app stays **light-first with a real dark theme** via `[data-theme]`.

## 4. Typography
- Web: **Figtree** only, loaded from the Google Fonts stylesheet in
  `frontend/index.html`, with `font-family: var(--font)` on `body` and
  `font: inherit` on buttons, inputs, selects and textareas.
- Mobile: **Sora** for headlines (weight 300, 40–48px, line-height 1.05,
  letter-spacing -1%), **DM Sans** for body and UI (400/500, 14–16px, 1.45).
  Fonts are bundled in `mobile/assets/fonts` and declared in `pubspec.yaml`.
  No runtime font downloading, no new packages.
- Sentence case everywhere. No all-caps except tiny plan labels (12px, tracked).
- One accent-colored word in a big headline is allowed on onboarding and
  upgrade screens only — max one per screen, never elsewhere.
- Allowed web sizes: 12, 14, 16, 18, 22, 28, 40, 48. Weights: 400, 500, 600, 700.
- Numbers: `font-variant-numeric: tabular-nums` for money, counts, tables,
  charts on the web; `FontFeature.tabular()` on mobile.

**Resolutions**
- The two apps deliberately use two typefaces — Figtree on web, Sora/DM Sans on
  mobile — because the mobile spec's light-weight display look does not exist
  in Figtree. They share scale, case and spacing discipline, so the brand still
  reads as one product. Do not add a third family.

## 5. Spacing, radius, elevation
- Spacing scale (both apps): 4, 8, 12, 16, 20, 24, 32, 48. Mobile screen
  padding 20. Web content max width 1120.
- Radius web: `--r-sm: 8px` (checkbox, small tags), `--r-md: 12px` (inputs,
  small cards), `--r-lg: 16px` (cards, modals), `--r-xl: 20px` (hero cards),
  `--r-2xl: 28px` (large modals), `--r-pill: 999px` (buttons, chips, nav,
  avatars, icon circles).
- Radius mobile: 16 chips and inputs-inside-cards, 24 cards, 28 rows and
  bottom bar, 999 buttons, pills, bubbles, avatars, icon circles.
- Elevation: solid surfaces use a 1px `--border`/hairline and **no shadow**.
  Only dropdowns and menus get `0 8px 24px rgba(0,0,0,0.12)` on the web
  (`--shadow-menu`). On mobile, the one allowed soft shadow is under silver
  pills: `0 8 24 rgba(0,0,0,0.35)`.
- Cards are separated by spacing and a hairline, not by heavy shadows.
- Touch targets at least 48px on mobile.

## 6. Components

### 6.1 Buttons (web)
Variants: `primary` (gold fill `--amber-500`, `--on-amber` text, 1px
`--amber-line` border), `secondary` (surface fill, `--ink` text, 1px
`--border`), `tertiary` (transparent, `--amber-700` text), `danger`
(`--danger-bg` fill, `--danger` text).
Sizes: `sm` 32, `md` 40, `lg` 48, `xl` 56. Radius 999. Icon 16 / 20 / 24.
- Pressed: `transform: scale(0.97)` over 180ms `--ease`.
- Hover: primary → `filter: brightness(1.05)`.
- Focus: `outline: 2px solid var(--focus); outline-offset: 2px`.
- Disabled: `opacity: 0.5; cursor: not-allowed; transform: none`.
- Labels sentence case, `font-weight: 600`, `letter-spacing: 0`.
- Buttons never use a gradient. Gold is flat `#F5B63A`.

### 6.2 Buttons (mobile)
- Primary: **gold pill**, height 56, full width on forms, `onAccent` text,
  radius 999. Pressed scale 0.97. Disabled 40% opacity. Loading: small spinner
  in place of the label, width unchanged.
- Secondary: `surfaceDeep` fill, hairline border, white text.
- Tertiary: text only, `accentGlow` on dark.

**Resolutions**
- The mobile spec's "silver pill" primary button is replaced by the **gold
  pill**. Silver-white reads as a generic iOS control and under-sells the
  brand. Silver is kept for chat bubbles and decorative highlights only.
- `FilledButton` in `theme.dart` is restyled to the gold pill so all 29 existing
  usages inherit it without touching every screen.

### 6.3 Inputs
- Web: 1px `--input-border`, radius `--r-md`, height 40 (48 for form fields),
  focus ring exactly `outline: none; border-color: var(--focus);
  box-shadow: 0 0 0 4px var(--focus-glow)`.
- Mobile: `surfaceDeep` well, hairline border, radius 16, focused border 1.5px
  `accent`, error border 1.5px `danger`.

### 6.4 Cards
- Web `.card`: `--surface`, 1px `--border`, radius `--r-lg`, **no shadow**.
  `.stat` and `.qa` follow the same rule.
- Mobile `GlassCard`: `surfaceGradient`, radius 24, 1px hairline, 1px white@6%
  inner top highlight. `BackdropFilter` blur 16 only when it sits over an image
  or a gradient glow, and at most twice per screen.
- Explore cards (mobile): two across, glass, outline icon top-left, title 16
  white, description 13 muted, max three lines. May bleed off the right edge.

### 6.5 Icons
- Web: one set, `currentColor`, 24 viewBox, stroke 1.75, sizes 16/20/24.
- Mobile: one outline set, stroke width 1.5. No emoji as icons.

### 6.6 Chips and pills
- Web: radius pill, 1px `--border`, `--ink-muted` text, `--surface-2` fill.
  Info pill: `--amber-150` fill, `--amber-700` text.
- Mobile: silver chips for the selected or featured item, deep chips for the
  rest. Horizontal scroll, 8px gaps, height 40, text 14. Chips on dark use
  `surfaceDeep`.

### 6.7 Navigation
- Web sidebar: 264px, `--surface`, 1px right border, active item `--amber-100`
  fill with `--amber-700` text. Topbar 64px.
- Mobile bottom bar: floating `surfaceDeep` container, radius 28, 16px side
  margins, height 72, outline icon plus 12px label. Active item white, inactive
  `textFaint`. Five items max (Home, Chats, Catalog, Insights, Settings).
  Respect the safe area.

### 6.8 Chat thread (mobile)
- Header: 44px silver circle back button left, title centered (16 white), 44px
  translucent circle "more" right.
- Customer message: surface bubble, radius 24, small avatar circle.
- Bot reply: silver gradient bubble, dark text, radius 24, small dark circular
  logo avatar. Reactions below in `textMuted`.
- Status pill above the composer when the bot is working, and "Take over chat"
  for handoff — both deep pills.
- Composer: deep gray gradient pill, placeholder `textMuted`, 48px silver
  circle send button.

### 6.9 Plan picker (mobile billing)
Selectable pill rows, radius 28, gray gradient. Label 12px tracked, price 16.
Right side radio dot. Selected row: brighter fill and a glowing ring in
`accentGlow` around the dot. White "Continue" pill below.

### 6.10 Empty and error states
Outline icon in a glass circle, one sentence, one action pill. Errors say what
failed and how to fix it.

## 7. Imagery and illustration
- Images use a fixed `aspect-ratio` and `object-fit: cover` on the web; on
  mobile they sit inside the hero-style frame with radius 16.
- Every image slot has a graceful fallback: a dashed slot with an outline icon
  and a caption telling the developer which file to drop in. A missing image
  must never break a screen.
- Onboarding and welcome screens are the primary home for imagery. Dashboard,
  billing and settings stay mostly typographic — do not decorate them.
- Generated art (Pollinations or otherwise) must be **cached as files** and
  shipped with the app. The running app never depends on a live generation API
  call, and API keys never leave the backend.

**Resolutions**
- The web spec's "calm, no decoration" stance was read too narrowly and left
  the welcome screens bare. Imagery is explicitly welcome on onboarding,
  welcome and auth screens. It is still forbidden on dense operational screens.

## 8. Motion
- Web: 180–240ms `--ease` for hover/press/focus. Route fade 150ms. Toast
  slide-up 8px. Spinner and skeleton opacity pulse only — no shimmer, no
  decorative entrance animations.
- Mobile: 200–300ms ease-out. Page transitions gentle fade plus 12px slide.
  New chat messages fade in and rise 8px. Pressed pills scale 0.97.
  No bounce, no looping animation except the typing indicator.
- Both apps respect reduced motion (`prefers-reduced-motion` on the web,
  `MediaQuery.disableAnimations` on mobile).

**Resolutions**
- The two motion budgets are different because the platforms are. Web stays
  restrained (it is a working tool). Mobile gets the richer treatment because
  it is the product's first impression. Both still respect reduce-motion.

## 9. Accessibility
- Contrast: `on-amber` on gold 9.3:1 minimum, `amber-700` on surface 5.7:1,
  `ink` on surface 12:1+, `ink-muted` on surface 4.5:1 minimum.
- Focus visible on every interactive element, 2px outline with 2px offset.
- Touch targets 48px minimum on mobile.
- Never encode state by color alone — always pair with an icon or label.

## 10. Brand assets
- The brand gold is `#F5B63A`. The logo is never stretched, recoloured or
  given effects.
- Web logo files live in `frontend/public/logo/`: `logo-for-light.svg`,
  `logo-for-dark.svg`, `favicon.svg`, `favicon.ico`, `icon-192.png`,
  `icon-512.png`, `icon-180.png`, `app-icon-*-1024.png`.
- Mobile assets live in `mobile/assets/`: `brand-mark.png`,
  `brand-mark-light.png`, `logo.png`, `logo-green.png`, `icon-512.png`.
- Remove the old green logo and any green glow tied to it.

## 11. Live2D and 3D — explicitly out of scope
Live2D is a proprietary 2D character-animation runtime (VTubers, games). It
needs the Cubism editor, layered PSD artwork, `.moc3` model files and a
runtime licence, and there is no maintained Flutter plugin for it. It is
therefore **not used**. The equivalent capability this product ships is:
- illustrated character art (generated once, cached as files, shipped in the
  app), and
- real motion built natively — Flutter's `AnimationController` on mobile,
  CSS transitions on the web.

No third-party animation runtime, no 3D engine, no new packages.

## 12. Rules for the agent
- Follow this file. If a change would violate it, stop and ask instead of
  inventing something.
- Web: after every step run `node design-check.mjs frontend/src` and fix
  everything it lists before saying you are done.
- Mobile: after every step run `flutter analyze` and list mismatches against
  this file before fixing them.
- Keep behavior, state management, routes and API calls unchanged.
- Commit after each step that works.
