# VeloSales Ai — build list

Last updated: **17 Oct 2026**. Legend: `[x]` done · `[~]` partly done · `[ ]` not started · `[!]` blocked on you

---

## 0. Blocked on you

- [!] **The new logo you pasted is NOT in the project.** Nothing has been added
      since 15 Oct. The only logo files present are the two old candidates from
      yesterday — `new logo to use.webp` (teal triangle) and `new logo 2.webp`
      (white hexagon with a V cut out). Neither is a "V check".
      **Action:** drop the file into `frontend/public/photos/` (or anywhere in
      the project) and tell me the filename.
- [!] **Phone not visible to Windows.** Needed to sideload the APK. Plug in,
      unlock, choose **"Transfer files"**.
- [!] **Google sign-in needs one thing from you.** Register an Android OAuth
      client in Google Cloud Console with:
      package `com.velosalesai.app`, SHA-1
      `1E:0C:7E:8F:C5:3A:D7:18:9D:45:C8:15:CA:46:07:B1:D1:90:36:3A`.
      I can build the button and the flow now; the login only works after this.

---

## 1. Brand and colour

- [x] Real vector brand mark drawn in code (was a green PNG on a white box)
- [x] Purple launcher icon (was green)
- [x] Removed the watermarked AI-generated mascot
- [ ] **Colour psychology pass — expand past purple-only.** Build a real
      multi-hue system: purple stays the primary action; add a warm accent
      (amber/coral) for attention, teal for informational, green for success,
      red for danger — each with a tint pair for light and dark, and a rule for
      where each may appear. No more "everything is one purple".
- [ ] Apply the new hues to empty states, status pills, KPI cards, charts.
- [ ] Final logo swap once you provide the file (mark painter is one file).

## 2. First-run experience (what a brand-new user sees)

- [ ] **Welcome / onboarding carousel** — the reference's big-image slides,
      auto-typing headline, page dots, Skip. 3 slides:
      what the product does → how it makes money for you → get started.
- [ ] **Animated loading states** — replace plain skeletons with a branded
      shimmer; add a branded spinner component used everywhere.
- [ ] **Splash motion** — animate the mark assembling (draw-on), not just a fade.
- [ ] **Empty states with personality** — illustrated, not just an icon + text.

## 3. Auth screens

- [ ] **Rebuild sign-in / sign-up to the reference:**
      centred title + subtitle · labelled fields with rounded grey pill inputs
      · password reveal toggle · "Remember me" checkbox + red "Forgot password?"
      · full-width dark pill primary button · "OR" divider · "Continue with
      Google" · "Continue with Apple" · centred footer link.
- [ ] **OTP screen** — 4 boxes with focus, Continue button, "Resend OTP".
- [ ] **Google sign-in** — button + native flow wired to the existing
      `/api/auth/google` endpoint (blocked on the SHA-1 registration above).
- [ ] **Apple sign-in** — button present; needs an Apple developer account to
      actually function. Flag rather than fake.

## 4. VeloSales Ai chat

- [ ] **Rebuild to look like a modern AI assistant** — larger reading column,
      message grouping, copy/regenerate actions, streaming feel, suggestion
      chips on an empty thread.
- [ ] **Model picker: plain-language labels only** — "Smart", "Normal", "Fast"
      (with a one-line description each). No raw model names anywhere in the UI.
- [ ] Photo attach polish (already wired end-to-end).

## 5. Button and control system

- [ ] **One button component with real variants** per the reference:
      primary (solid dark pill) · secondary (outlined pill) · gradient (the
      brand CTA) · quiet (text) · Skip pill · icon circle.
- [ ] States for every variant: default, pressed (0.97 scale), disabled,
      loading (spinner in place of the label, width unchanged).
- [ ] Apply across all screens so nothing hand-rolls a button again.

## 6. Dashboard / overview

- [ ] **Adopt the reference's arrangement** — hero KPI tile plus quieter
      tiles, one chart, a list, a progress figure.
- [ ] Real data only. No fabricated metrics (DESIGN.md rule).
- [ ] Add a chart component (the repo already has `Chart.jsx` on web).

## 7. Professional / graceful behaviour

- [ ] **Confirm before sign-out** — proper dialog, not an instant logout.
- [ ] **Error surfaces for every action**, good and bad, styled consistently:
      a toast/inline system that says what failed and how to fix it.
- [ ] **Offline handling** — detect no network, show a styled offline state,
      make retry work, never show a bare spinner forever.
- [ ] Success confirmations for actions that change data.

## 8. Guide / explainer pages

- [ ] **"How to use VeloSales Ai" — animated and illustrated.** Step-by-step
      with motion and depth so a non-technical shop owner understands it.
      First pass (plain text + steps) is already shipped; needs the visual
      treatment.
- [ ] Per-feature explainers reachable from the feature itself.

## 9. Remaining screens for parity with the web app

- [ ] Insights · Refer & Earn · Settings · Profile · Notifications as a page
- [ ] Connect screen polish
- [ ] Catalog screen polish

---

## Already shipped

- [x] Full purple token system on mobile (`theme.dart`)
- [x] Glass system removed (flat surfaces, hairline borders)
- [x] Manrope + flat surfaces + pill buttons
- [x] Sidebar drawer with hints and a "Learn and manage" group
- [x] New Home screen — greeting, needs-you strip, action grid, recent chats
- [x] Shared UI vocabulary (`widgets/brand_ui.dart`)
- [x] Guide page, first pass (`screens/help_screen.dart`)
- [x] Web: auth, onboarding and Velo chat rebuilt; image upload wired end-to-end
