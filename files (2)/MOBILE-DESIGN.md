# MOBILE-DESIGN.md — VeloSales AI (Flutter app in mobile/)

Read this file before any UI work in `mobile/`. The web app in `frontend/` keeps
following DESIGN.md. If something is not specified here, ask before inventing it.

## Direction
Dark, calm, premium. Deep green-charcoal gradients, large light-weight headlines,
soft silver-white "glass" pills and bubbles, thin outline icons, lots of air.
Modeled on a reference set of dark chat-app screens (onboarding, home with chat
history and prompt library, chat thread, voice assist, upgrade plan).
- Copy the visual language only. No reference brand names, logos, avatars or copy.
- Dark-first. A light theme can come later; do not build it now.
- One accent color, used sparingly: a headline word, a status dot, a selected ring.

## Accent (one switch)
Default = reference look (sage). To match the amber logo and web app, swap the
three accent tokens to the amber set. Nothing else changes.

| Token | Sage (default) | Amber (matches logo and web) |
|---|---|---|
| accent | #A9BC8E | #F5B63A |
| accentGlow | #C9E08A | #FFD27A |
| onAccent | #14180F | #2A1A00 |

## Color tokens (dark)
- bgTop #2A332F, bgBottom #0E1210 (screen background, vertical gradient,
  slight diagonal toward bottom-right)
- surface #232A27 to #1A201D (cards, rows, vertical gradient)
- surfaceGlass rgba(255,255,255,0.10) with 1px rgba(255,255,255,0.12) border
- surfaceDeep #0F1311 (bottom bar, chips on dark, input wells)
- silverTop #FFFFFF, silverBottom #A8ADAA (silver pill and bubble gradient,
  left-to-right or top-to-bottom). Text on silver: #101513
- text #F2F4F1, textMuted #8F9994, textFaint #5F6965
- hairline rgba(255,255,255,0.08)
- danger #FF8A7A, success #7FD6A0 (status only, always with an icon or label)

## Typography
- Headlines: Sora (or Outfit), weight 300, 40-48px, line-height 1.05,
  letter-spacing -1%. Section titles 22px, weight 400.
- Body and UI: DM Sans, weights 400 and 500, 14-16px, line-height 1.45.
- Bundle font files in `assets/fonts` and declare them in pubspec.yaml.
  No runtime font downloading, no new packages.
- One accent-colored word in a big headline is allowed on onboarding and
  upgrade screens only (max one per screen). Never elsewhere.
- Sentence case. No all-caps except tiny plan labels (12px, tracked).

## Shape and spacing
- Spacing scale 4, 8, 12, 16, 20, 24, 32, 48. Screen padding 20.
- Radius: 16 chips and inputs-inside-cards, 24 cards, 28 rows and bottom bar,
  999 buttons, pills, bubbles, avatars, icon circles.
- Cards separated by spacing and a hairline, not heavy shadows. One soft shadow
  allowed under silver pills: 0 8 24 rgba(0,0,0,0.35).
- Touch targets at least 48.

## Surfaces (Flutter recipes)
- Screen: Container with LinearGradient(bgTop to bgBottom), full bleed under
  the status bar. Status bar icons light.
- Card: gradient surface, radius 24, 1px hairline border, inner top highlight
  (a 1px white at 6% along the top edge).
- Glass card (Explore cards, feature rows): surfaceGlass fill, same border,
  optional BackdropFilter blur 16 only when it sits over an image or gradient glow.
- Silver pill (primary actions, bot bubbles): LinearGradient silverTop to
  silverBottom, dark text, radius 999, soft shadow.
- Deep chip (prompt library items): surfaceDeep fill, 1px hairline border, white
  text, radius 999.
- Use BackdropFilter at most twice per screen (bottom bar, sheets). It is
  expensive on weak phones. Everything else is plain gradients.

## Components
### Primary button
- Silver pill, height 56, full width on forms. Label states the action
  ("Open inbox", "Continue"). Pressed: scale 0.97. Disabled: 40% opacity.
- Secondary: surfaceDeep fill with hairline border and white text.
- Loading: small spinner in place of the label, width unchanged.

### Feature rows (onboarding)
- Dark pill rows, radius 28, height 72. Left: 44px black circle with a thin
  accent outline icon. Right: muted two-line description.

### Chips (chat history, prompt library, filters)
- Silver chips for the selected or featured item, deep chips for the rest.
  Horizontal scroll, 8px gaps, height 40, text 14.

### Explore cards
- Two across, glass card, outline icon top-left, title 16 white, description
  13 muted, max three lines. Cards may bleed off the right edge to hint scrolling.

### Chat thread
- Header: 44px silver circle back button left, title centered (16, white),
  44px translucent circle "more" button right.
- Customer message: plain text on a surface bubble (radius 24), small avatar circle.
- Bot or agent reply: silver gradient bubble, dark text, radius 24, with a small
  dark circular logo avatar. Reaction icons below in textMuted.
- Status pill above the composer when the bot is working ("Replying..." with a
  spinner) and "Take over chat" for human handoff, both deep pills.
- Composer: deep gray gradient pill, placeholder in textMuted, 48px silver
  circle send button.

### Bottom navigation
- Floating deep container, radius 28, 16px side margins, height 72, outline icon
  plus 12px label. Active item: white icon and label. Inactive: textFaint.
- Five items max (Home, Chats, Catalog, Insights, Settings). Respect the safe area.

### Plan picker (billing)
- Selectable pill rows, radius 28, gray gradient. Label 12px tracked, price 16.
  Right side: radio dot. Selected row: brighter fill and a glowing ring in
  accentGlow around the dot. White "Continue" pill below.

### Lists and settings
- Grouped rows on surface cards, radius 24, hairline dividers, outline icon,
  label, chevron or switch. Switch on state uses accent.

### Empty and error states
- Outline icon in a glass circle, one sentence, one silver pill action.
  Errors say what failed and how to fix it.

## Motion
- 200-300ms ease-out. Page transitions: gentle fade and 12px slide.
- New chat messages fade in and rise 8px. Pressed pills scale to 0.97.
- No bounce, no looping animation except the typing indicator.
- Respect reduce-motion (MediaQuery.disableAnimations).

## Screen blueprints
- Onboarding: big light headline (one accent word), three feature rows, silver
  "Get started" pill, quiet skip link top right.
- Home: greeting "Good morning, {name}" (name in accent), one wide silver pill
  for the main action, "Recent chats" chips, "Explore more" glass cards (Catalog,
  Insights, Connect), "Quick replies" deep chips, bottom nav.
- Chat thread: as in Components. Keep message actions to like, dislike, copy.
- Billing: big headline, three-line benefits list, plan picker, Continue pill.
- Settings: profile card, grouped lists, theme and notification switches.

## Don'ts
- No white page backgrounds, no pure #000 backgrounds.
- No stacked identical cards. Mix a hero, chips, and a few cards.
- No gradients other than those listed (background, surface, silver, glow ring).
- No emoji as icons. One outline icon set, one stroke width (1.5).
- No new colors, radii or fonts. No more than one accent word per screen.
- Never hard-code a color in a widget. Use theme tokens only.

## Rules for the agent (Flutter)
- Add no new packages unless asked. Fonts are bundled assets.
- Put tokens in `theme.dart` (ThemeData plus a ThemeExtension for gradients,
  radii and spacing). Put reusable widgets in `glass.dart` or a new
  `widgets/` folder: AppBackground, SurfaceCard, SilverButton, SilverBubble,
  DeepChip, GlassCard, BottomBar, PlanTile.
- Build in this order and stop for review after each step:
  1. Tokens, fonts, AppBackground, status bar styling.
  2. Core widgets, shown on one demo screen.
  3. Bottom bar and Home.
  4. Chat thread and composer.
  5. Onboarding and login.
  6. Billing, settings, notifications, remaining screens.
- After each step run `flutter analyze` and test on a real device or emulator at
  a small screen size. List mismatches against this file before fixing them.
- Keep all behavior, state management, routes and API calls unchanged.
- Commit after each step that works.
