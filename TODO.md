# VeloSales Ai — build list

Last updated: **17 Oct 2026**. Legend: `[x]` done · `[~]` partly done · `[ ]` not started · `[!]` blocked on you

---

## 0. Blocked on you

- [~] **Logo — I picked one; say the word if you disagree.** Both candidates in
      `frontend/public/photos/` were compared side by side. I went with
      **`new logo 2.webp`** — the white hexagon with the V cut out of it. It is
      the one you called "a v check", it is monochrome (so it re-tints with the
      theme instead of fighting it), and it survives being shrunk to 24px.
      The teal one has its colour and a drop shadow baked into the bitmap, so it
      cannot sit on a tinted surface. It is still in the folder if you want it
      instead — the mark is one file on each side.
      **Delivered:** `velosales-mark.png` (+ white and on-purple variants) in
      `frontend/public/photos/`, and the mark redrawn as vectors so it is sharp
      at any size.
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
- [x] **Mark redrawn from your own logo file** — measured off the bitmap row by
      row, redrawn as a hexagon with an inscribed inverted triangle. Web and
      phone now draw one mark from one set of numbers.
- [x] `velosales-mark.png` exported, plus white and on-purple variants
- [x] Purple launcher icon re-cut from the new geometry (all five densities)
- [x] Favicons, apple-touch icon and favicon.ico re-cut from the new geometry
- [x] Removed the watermarked AI-generated mascot
- [~] **Colour psychology pass — expand past purple-only.** Purple is now the
      only brand/hover/selection colour (the old `--green` was still wired to
      hover states, selection rings, card borders, empty-state icons, dark-mode
      backgrounds and dark-mode skeletons all over the app — that is why it kept
      reading green). Green now means only what it should: success, online, a
      completed step, a KPI going up, a tick on an included feature. Amber is
      used for attention (the trial banner, the AI "spark" mark).
      **Still to do:** a teal "informational" hue, and a written rule for where
      each hue may appear.
- [ ] Apply the new hues to empty states, status pills, KPI cards, charts.

## 2. First-run experience (what a brand-new user sees)

- [ ] **Welcome / onboarding carousel** — the reference's big-image slides,
      auto-typing headline, page dots, Skip. 3 slides:
      what the product does → how it makes money for you → get started.
- [ ] **Animated loading states** — replace plain skeletons with a branded
      shimmer; add a branded spinner component used everywhere.
- [x] **Splash motion** — the mark assembles itself (three pieces fly in, sweep
      around a ring, settle; then the wordmark types in, then the tagline).
      Web: `components/MarkReveal.jsx`. Phone: `widgets/logo_reveal.dart`.
      The old web splash was still dark green — that is fixed too.
- [ ] **Empty states with personality** — illustrated, not just an icon + text.

## 3. Auth screens

- [~] **Sign-up + sign-in rebuilt to the reference** (phone, one
      screen for all four modes). Drawn from `widgets/auth_ui.dart`:
      purple band with the mark and wordmark · white sheet with a 30px top
      radius rising 26px over it · "Create An Account" · one icon-led field per
      row (leading icon, hairline divider, focus glow) · password reveal ·
      terms checkbox · full-width solid purple button with an in-button spinner
      · "Or sign up with" + circular Google/Apple buttons · footer switch.
      Errors / success / hints are three styled notices (`AuthNotice`).
      **Left:** the web side still uses the older centred-card layout.
- [ ] **Google sign-in** — the button is on the screen and says so when tapped;
      it needs the SHA-1 registration above before it can do anything.
- [ ] **Apple sign-in** — same: present, and honest about not being live.
- [!] **Terms of Service / Privacy Policy pages do not exist yet** — the
      checkbox labels them but there is nothing to link to. Say the word and I
      will write both pages.
- [x] **OTP is part of the same screen** — 6-digit code (capped, centred,
      letter-spaced), plus the new-password pair on the reset-code path.

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
