# Ads — parked until the custom domain lands (Hilltop video-type ONLY)

Status: **OFF**. `ADS_ENABLED` is `0`/unset → backend sends `ads: null` →
frontend shows zero ads (no tags, no gates, no interstitials, no redirects).
Pro never sees ads either way. Nothing was deleted — re-arming is one env var.

## The decision (owner's call, locked)

- **Hilltop video-type ads ONLY.** No banners, no social bars, no popunders,
  no Smartlink/offer links. Reason: popunder tags hijacked clicks and dragged
  the whole tab to offer URLs (the `/drm/…` incident); Smartlinks are exit
  traffic, not video.
- Start serving only **after** the custom domain + Hilltop account are live
  (ad networks approve real domains; localhost/Render subdomains get junk).

## Re-enable checklist (when ready)

1. HilltopAds account → create a **video/VAST zone** (NOT popunder, NOT
   Smartlink) → copy the tag URL (must contain `.js` — the app refuses
   non-`.js` URLs as players and degrades them to link-cards).
2. Render dashboard → set:
   - `ADS_ENABLED=1`
   - `ADS_VIDEO_HILLTOPADS=<the .js tag URL>`
   - `ADS_VIDEO_ORDER=hilltopads` (video-only waterfall; keep sponsor first
     only if you also set `SPONSOR_VIDEO_URL` + `SPONSOR_LINK` for your own mp4)
   - `SPONSOR_RATE_PER_VIEW=5` (your ₦ per completed view for invoicing)
3. Redeploy backend (Node reads env at boot).
4. Verify as a **free-tier** account with no ad-blocker: open Inbox → a 30s
   gated player with countdown + skip-at-5s appears (once/day/action).
   Check `/admin` → AdsStatus shows videoHilltopads: Yes, and completions
   land in `/api/ads/stats` (the sponsor invoice source).
5. Never set: `ADS_POPUNDER_URL`, `ADS_VIDEO_FALLBACK` (Smartlink),
   `ADS_SCRIPT_URL*` (banner tags) — these are the hijack formats.

## How the code enforces it

- `src/controllers/ownerController.js` (`getMe`): ads built only when
  `ADS_ENABLED === '1'`; popunder entry removed from auto-inject entirely.
- `frontend/src/lib/ads.js` (`injectTag`): refuses `freq === 'daily'` and any
  `*popunder*` provider even if a stale backend sends one.
- `isScriptTag()`: non-`.js` URLs can never become inline players.
- Video-gate order is env-driven (`ADS_VIDEO_ORDER`) — no redeploy needed to
  reorder, only to add keys.
