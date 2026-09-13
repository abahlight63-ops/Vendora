# Google Sign-In Setup (one-time, ~10 minutes, FREE forever)

Your app already has the full Google flow built (button → Google popup →
verified session → one-tap shop creation). The button currently says
"not switched on" for one reason only: no `GOOGLE_CLIENT_ID` is set.
Follow these steps and it works.

## Part 1 — Get the Client ID (Google Cloud Console)

1. Go to https://console.cloud.google.com and sign in with your Google account.
2. Top bar → project dropdown → **New Project** → name it `Vendora` → **Create**.
   Wait ~30 seconds, then select the new project in the same dropdown.
3. Left menu → **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - App name: `Vendora`, User support email: your email, Developer email: your email.
   - Click **Save and Continue** through Scopes (add nothing) and Test users (add nothing).
4. Left menu → **APIs & Services → Credentials** → **+ Create Credentials →
   OAuth client ID**:
   - Application type: **Web application**, name: `Vendora web`.
   - Under **Authorized JavaScript origins**, add EACH of these lines (one per line):
     - `http://localhost:3000` (local dev)
     - `https://YOUR-BACKEND.onrender.com` (your real backend URL — no trailing slash)
     - `https://YOUR-FRONTEND.vercel.app` (only if frontend/backend are split)
   - Click **Create** → copy the **Client ID** (looks like
     `123456789012-abc....apps.googleusercontent.com`).
   - NOTE: this ID is PUBLIC (it ships to the browser by design). There is no
     secret to protect here — the security is Google verifying the token
     server-side on every login.

## Part 2 — Plug it into the app

5. Local: add to your `.env` file:
   `GOOGLE_CLIENT_ID=paste-the-id-here`
   Production: hosting dashboard (Render → Environment, Vercel NOT needed —
   the backend serves it) → add the same variable → **Save**.
6. **Restart the server** (local: Ctrl+C then `npm run dev`; Render redeploys
   automatically on env change).
7. Verify: open `/login` → click **Continue with Google** → pick an account:
   - Existing Vendora email → signed straight in (and email auto-verified).
   - New email → one-tap form asks for shop name + WhatsApp number → account
     created, verified instantly (Google already proved the inbox — no OTP).

## Part 3 — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Google sign-in is not switched on yet" | `GOOGLE_CLIENT_ID` empty / server not restarted | Set var + restart; check `/api/auth/config` returns the id |
| Popup closes instantly / "closed or blocked" | Origin not allowlisted, or adblock | Add the exact origin (http vs https matters); disable adblock for `accounts.google.com` |
| "Google sign-in failed — try again" | Wrong Client ID, or clock skew | Re-copy ID; ensure token verified against same ID (`aud` check in `authController.google`) |
| Works locally, fails in production | Prod origin missing | Add backend + frontend URLs to Authorized JavaScript origins (takes ~5 min to propagate) |
| Session doesn't stick after Google login | Split-deploy cookie/CORS mismatch | Set `FRONTEND_URL` on backend to exact Vercel URL; see `RAILWAY.md`/split-deploy notes |

## How it works (for the curious)

`Login.jsx → GoogleButton` lazy-loads Google Identity Services, gets a signed
JWT ID token, POSTs it to `/api/auth/google`. The backend re-verifies the
token with Google (`tokeninfo`: signature + expiry + `aud === our client id` +
`email_verified`), then finds-or-creates the user and stamps the same session
as password login. No password is ever stored for Google accounts.
