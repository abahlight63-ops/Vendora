# Ads — Hilltop video-only is LIVE in code (careful mode), sponsor next

Status: backend ships three modes (see `getMe` in ownerController.js):
- everything unset/`0` → `ads: null` → zero ads (current state).
- `ADS_VIDEO_ONLY=1` + `ADS_VIDEO_HILLTOPADS=<.js tag>` → Hilltop gated
  video ONLY: no tags injected, no interstitials, no popunders, no
  Smartlinks. Unconfigured/misconfigured tag → gates silently skip
  (buttons work exactly as today) + boot log warns.
- `ADS_ENABLED=1` → full menu (networks + sponsor + full waterfall).

## The decision (owner's call, locked)

- **Hilltop video-type ads ONLY.** No banners, no social bars, no popunders,
  no Smartlink/offer links. Reason: popunder tags hijacked clicks and dragged
  the whole tab to offer URLs (the `/drm/…` incident); Smartlinks are exit
  traffic, not video.
- Start serving only **after** the custom domain + Hilltop account are live
  (ad networks approve real domains; localhost/Render subdomains get junk).

## Hilltop-only turn-on checklist (careful path)

1. HilltopAds account → your **video zone** → **HTML code** dialog → keep
   **VAST** selected (NOT "VAST for Google Ad Manager" — that's for GAM
   publishers; our gate brings its own IMA player!) → **COPY CODE** → paste
   that URL as `ADS_VIDEO_HILLTOPADS` (zone #7458485-style VAST document
   URLs AND classic `.js` player tags both play — `.js` script-injects,
   anything else is fetched as VAST XML by the on-demand IMA player,
   never executed, never navigated).
2. Render dashboard → set ONLY:
   - `ADS_VIDEO_ONLY=1`
   - `ADS_VIDEO_HILLTOPADS=<that URL>`
   - `SPONSOR_RATE_PER_VIEW=5` (your ₦ per completed view for invoicing)
3. Redeploy backend (Node reads env at boot). Boot log must show NO
   `ADS_VIDEO_ONLY` warnings (a warning means the tag is missing/not-a-player
   and gates will skip — safe, just no revenue).
4. Verify as a **free-tier** account with no ad-blocker: open Inbox → a 30s
   gated player with countdown + skip-at-5s appears (once/day/action).
   Kill test: with ad-blocker on, the gate must vanish to a working button
   (5s empty-frame guard) — never a dead timer.
5. Admin → AdsStatus preview ("Only HilltopAds" button) fires the isolated
   layer; completions land in `/api/ads/stats` (the invoice source).
6. Never set in this mode: `ADS_ENABLED`, `ADS_POPUNDER_URL`,
   `ADS_VIDEO_FALLBACK`, `ADS_SCRIPT_URL*`, `SPONSOR_*` — the server ignores
   networks/sponsor layers in video-only mode anyway (belt + braces).

## Sponsor interstitials (later, same careful rules)

1. Set `ADS_ENABLED=1` (full mode) + ONLY `SPONSOR_TITLE`, `SPONSOR_LINK`
   (+ optional `SPONSOR_TEXT/IMAGE/VIDEO_URL`); leave every network/video key
   empty so tags and gates stay dark.
2. Behavior contract (already in code, verify on a free account): labeled
   "Sponsored" card, max once/day, Visit opens a NEW tab, dismiss always
   free, Pro sees nothing, completions bill per click in `/api/ads/stats`.
3. Kill switch: delete `SPONSOR_LINK` (or set `ADS_ENABLED=0`) → cards vanish
   on next login. No deploy-time code change ever needed.

## How the code enforces it

- `src/controllers/ownerController.js` (`getMe`): ads built only when
  `ADS_ENABLED === '1'`; popunder entry removed from auto-inject entirely.
- `frontend/src/lib/ads.js` (`injectTag`): refuses `freq === 'daily'` and any
  `*popunder*` provider even if a stale backend sends one.
- `isScriptTag()`: non-`.js` URLs can never become inline players.
- Video-gate order is env-driven (`ADS_VIDEO_ORDER`) — no redeploy needed to
  reorder, only to add keys.
