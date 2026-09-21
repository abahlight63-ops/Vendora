# VeloSales AI Mobile (Flutter) — native app, same backend as the web app

NOT a web wrapper: real Dart screens calling the same JSON API the React
app uses (`/api/auth/*`, `/api/me*`). Same account, same shop, same
subscription — phone and browser stay in sync through the server.

## Prereqs

- Flutter SDK 3.35+ (`flutter --version`)
- Android Studio (SDK + one emulator) for APK/AAB; Xcode for iOS

## Run it

```bash
cd mobile
flutter pub get
# Local backend (run `npm run dev` in repo root first):
flutter run --dart-define API_BASE_URL=http://10.0.2.2:3000
# Live backend (default, no flag needed):
flutter run
```

Default `API_BASE_URL` = `https://vendora-fsse.onrender.com` (the live
backend — same one `vercel.json` proxies to). Android emulator reaches
your PC's localhost via `10.0.2.2`; a physical phone needs your PC's
LAN IP (`http://192.168.x.x:3000`) + same Wi-Fi.

## What's inside

| Screen | Backend calls |
|---|---|
| Auth (sign in / sign up / OTP) | `POST /api/auth/login`, `/signup`, `/verify-otp`, `/otp-resend` |
| Overview | `GET /api/me` + bot kill-switch `POST /api/me/bot` |
| Chats + thread + takeover | `GET /api/me/conversations`, `.../:id/messages`, `POST .../takeover` |
| Catalog add/delete | `GET/POST /api/me/products`, `DELETE /api/me/products/:id` |
| VeloSales AI + model picker | `POST /api/me/ask`, `GET /api/me/ai-models` |
| Billing (status + plans) | `GET /api/me/billing` — checkout itself opens in the browser (Paystack redirect needs a full web page) |

Sessions = the same `connect.sid` cookie as web (`lib/api.dart`
captures it on login, persists via SharedPreferences). 401 → cookie
wiped → back to login. Google sign-in is intentionally web-only for
now (native Google SDK is phase 2 — email login covers all accounts).

## Ship to Play Store ($25 account)

```bash
cd mobile
flutter build appbundle --dart-define API_BASE_URL=https://<your-backend>
# → build/app/outputs/bundle/release/app-release.aab
```

1. `https://play.google.com/console` → pay $25 → verify → Create app
2. Upload the `.aab` → fill listing (name VeloSales AI, Business category,
   screenshots 1080×1920, feature graphic 1024×500, privacy URL
   `https://vendorabot.vercel.app/privacy`)
3. Content rating + target-audience questionnaires → internal test
   track first → promote to production

Package id: `com.velosalesai.app` (set in `android/app/build.gradle*`
by `flutter create --org com.velosalesai`). Keystore: back it up — losing
it means you can never update the listing.
