# Ads setup — how money actually flows in

Three income streams. All serve **FREE-tier owners only** (Pro and trial
accounts get `ads: null` by design — paying users never see ads).

## Stream 1 — Per-VIEW network ads (Monetag, recommended)

Pays per 1,000 views. Earnings + payout live in the network's dashboard,
not in Vendora.

1. Sign up at **monetag.com** → Sites → add your site (`vendorabot.vercel.app`
   or your domain) → create a **MultiTag** zone → copy the tag script URL
   (the `https://… .js` address).
2. The tag's service worker is already wired: `frontend/public/sw.js`
   (zone `11798042`, domain `5gvci.com`). If Monetag gives you a NEW zone,
   update those two values in that file.
3. Add to your backend env (**Render dashboard → Environment**):
   `ADS_PROVIDER=monetag`, `ADS_SCRIPT_URL=<the tag URL>`.
   Optional second network (Social-Bar format ONLY — never two popunders):
   `ADS_PROVIDER_2=adsterra`, `ADS_SCRIPT_URL_2=<url>`.
4. **Redeploy** (Render → Manual Deploy). Node reads env at boot — keys
   added without a redeploy do nothing. This is cause #1 of "ads don't work".
5. Check Admin → "Ad keys live?" card: Network 1 must be ✅ (booleans only —
   key values never leave the server).
6. Test with a **free-tier account** (not Pro, not trial) and **no ad-blocker**
   (cause #2 and #3). Log in → tags load once per session, silently.

## Stream 2 — VIDEO ads (your own mp4, no network needed)

This is the reliable video path: a 15–30s clip that plays INSIDE the
Sponsored card on web, plus a Watch-video button in the phone app.

1. Get a clip: ask a local business for a 15–30s promo video (this is also
   your sales pitch — THEY pay YOU per click, `SPONSOR_RATE_PER_CLICK`).
2. Host the mp4 free: **cloudinary.com** → Media Library → Upload → copy
   the `https://… .mp4` URL. (Any direct-mp4 https URL works.)
3. Backend env: `SPONSOR_TITLE`, `SPONSOR_TEXT`, `SPONSOR_LINK` (where
   "Visit sponsor" goes), `SPONSOR_VIDEO_URL=<mp4 url>`,
   `SPONSOR_RATE_PER_CLICK=50`.
4. Redeploy. Admin → "Ad keys live?" must show Sponsor ✅ and Video ✅.
5. Test with a free-tier account: add a product (Catalog) or hit the AI
   daily limit → Sponsored card appears (max once/day) with the video.

## Stream 3 — Per-CLICK sponsor billing (both platforms)

Every "Visit sponsor" tap is logged to the `ad_clicks` table BEFORE the
visitor leaves (web `ads.js`, phone `lib/ads.dart` — identical rule).
Bill sponsors from Admin → Revenue, or `GET /api/admin/ads/stats`
(month + today counts × your per-click rate).

## Troubleshooting ("ads don't work")

1. Added keys but no redeploy → redeploy.
2. Testing on Pro/trial account → use a free account.
3. Ad-blocker on → off (or test in a clean browser profile).
4. `SPONSOR_TITLE` without `SPONSOR_LINK` (or vice versa) → card stays off;
   both must exist.
5. Phone app shows nothing → same three checks; the phone reads the same
   `/api/me` ads payload as web.
