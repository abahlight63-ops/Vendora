// ── src/server.js ───────────────────────────────────────────────
// WHAT: the app's front door. Creates the Express server, plugs in
// middleware (body parsing, sessions), mounts all route files, serves the
// React frontend, and starts listening. Run with: npm run dev / npm start
// MODULE: `express` (npm i express) — the web framework. It gives us the
// `app` object: app.use() stacks middleware, app.get()/post() define routes,
// app.listen() starts the HTTP server.
const express = require('express'); // the Express framework itself
const path = require('path'); // Node BUILT-IN: joins file paths safely across OSes
require('dotenv').config(); // MODULE `dotenv` (npm i dotenv): reads .env into process.env

// Local modules we built (require order matters only for readability here):
const authMiddleware = require('./middleware/auth'); // (legacy import — requireAuth lives here too)
const PgSessionStore = require('./db/sessionStore'); // our Postgres session store class
const billingController = require('./controllers/billingController'); // Paystack webhook handler

// Route files — each exports an Express Router (a mini-app of routes):
const authRoutes = require('./routes/authRoutes'); // /api/auth/* (signup, login…)
const ownerRoutes = require('./routes/ownerRoutes'); // /api/me* (owner dashboard data)
const adminRoutes = require('./routes/adminRoutes'); // /api/businesses* (admin key)
const billingRoutes = require('./routes/billingRoutes'); // /api/billing/* (Paystack init)
const webhookRoutes = require('./routes/webhookRoutes'); // /webhook/whatsapp (Twilio inbound)
const telegramRoutes = require('./routes/telegramRoutes'); // /webhook/telegram/* (Telegram inbound, both modes)

const app = express(); // create the Express application object
app.set('trust proxy', 1); // behind Railway/Render/ngrok there is 1 proxy — trust its
// X-Forwarded-Proto header so req.protocol is "https" (needed for secure cookies)

// Middleware — functions EVERY request passes through, in order:
app.use(express.urlencoded({ extended: false })); // parse HTML form bodies (Twilio sends forms!)
app.use( // parse JSON bodies…
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // …but ALSO stash the raw bytes: Paystack's HMAC check needs them
    }, // (parsed JSON ≠ raw bytes; signatures are computed on raw bytes)
  })
);

// CORS — split deploy only: lets the Vercel frontend (different origin) call
// this API WITH cookies. Skipped when FRONTEND_URL is unset (same-origin mode).
// MODULE: `cors` (npm i cors) — sets Access-Control-Allow-Origin/credentials headers.
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, ''); // e.g. https://vendora.vercel.app (no trailing slash!)
if (FRONTEND_URL) {
  const cors = require('cors'); // lazy require (only needed for split deploy)
  app.use(cors({ origin: FRONTEND_URL, credentials: true })); // origin = exact Vercel URL (browsers reject '*' + credentials!); credentials:true = allow session cookie cross-site
}
const isSplit = !!FRONTEND_URL; // true on Render (Vercel frontend), false locally (!! forces boolean)

// Sessions — MODULE `express-session` (npm i express-session): reads the session
// cookie, loads the session from the store, attaches it as req.session.
const session = require('express-session'); // session middleware factory
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me', // signs cookies so clients can't forge them
    store: new PgSessionStore(), // where sessions live (Postgres, survives restarts)
    resave: false, // don't rewrite unchanged sessions (saves DB writes)
    saveUninitialized: false, // don't create sessions for guests (saves DB rows)
    cookie: isSplit
      ? { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 } // SPLIT: cross-site cookies REQUIRE Secure + SameSite=None (HTTPS only — Render/Vercel both are!)
      : { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }, // SAME-ORIGIN: Lax is safer (CSRF-resistant) + works on http://localhost
  })
);

// Health check — Render/Railway ping this to know the app is alive.
app.get('/health', (req, res) => res.json({ status: 'ok' })); // GET /health → {"status":"ok"}

// Routes — mount each router at a URL prefix:
app.use('/webhook', webhookRoutes); // POST /webhook/whatsapp ← Twilio
app.use('/webhook', telegramRoutes); // POST /webhook/telegram/:bizId + /shared ← Telegram (same /webhook prefix, distinct paths!)
app.use('/api/auth', authRoutes); // POST /api/auth/login etc.
// Admin login/logout BEFORE ownerRoutes (whose blanket requireAuth would 401
// guests before they ever reach these!). You can't require a session to OBTAIN
// a session — order matters in Express (first matching middleware wins!).
app.post('/api/admin/login', require('./controllers/adminController').adminLogin); // { password } → session.isAdmin
app.post('/api/admin/logout', require('./controllers/adminController').adminLogout); // clears the flag (owner session underneath untouched)
// Admin console mount BEFORE ownerRoutes (whose blanket requireAuth demands a
// userId that password-admin sessions don't have — mounting first lets
// requireAdmin decide instead!). Paths: /api/admin/stats, /users, /transfers…
app.use('/api/admin', require('./controllers/adminController').requireAdmin, require('./routes/adminRoutes'));
app.use('/api', ownerRoutes); // /api/me, /api/me/business, etc.
app.use('/api', billingRoutes.router); // POST /api/billing/initialize
app.post('/webhook/paystack', billingController.handlePaystackWebhook); // ← Paystack events

// Admin API — second layer of auth: either the ADMIN_API_KEY header…
app.use('/api', (req, res, next) => {
  const expected = process.env.ADMIN_API_KEY; // the secret from .env
  if (expected && req.get('x-admin-key') === expected) return next(); // key matches → in
  if (req.session && req.session.isAdmin) return next(); // …or the admin password session (full /api/admin/* + legacy businesses access)…
  if (req.session && req.session.businessId) { // …or a logged-in owner…
    if (req.path.startsWith('/me')) return next(); // …but only for their OWN /me routes
  }
  return res.status(401).json({ error: 'Unauthorized' }); // everyone else → 401
}, adminRoutes); // Express runs middleware THEN the router (chain!)

const fs = require('fs'); // Node built-in: check if files exist
// React-only UI: dist/ build + public/ assets (logo)
// `vite build` outputs the React app into dist/ — Express serves those STATIC files,
// and any unknown app route falls through to index.html (SPA = Single Page App routing).
const distDir = path.join(__dirname, '..', 'dist'); // path.join = correct slashes on Win/Mac/Linux
const publicDir = path.join(__dirname, '..', 'public'); // logos/images
const hasDist = fs.existsSync(path.join(distDir, 'index.html')); // was `npm run build` run?
if (hasDist) app.use(express.static(distDir)); // serve /assets/*.js, /index.html etc. directly
app.use(express.static(publicDir)); // serve /logo.png etc.
const spa = (req, res) => {
  if (hasDist) return res.sendFile(path.join(distDir, 'index.html')); // React Router takes over client-side
  return res.status(503).json({ error: 'Frontend not built. Run: npm run build' }); // 503 = not ready
};
// All app routes → React SPA
['/', '/login', '/reset', '/onboarding', '/dashboard', '/profile', '/catalog', '/chats', '/billing', '/playground', '/insights', '/vendora-ai', '/settings', '/help', '/privacy', '/terms', '/faq', '/admin'].forEach((r) => app.get(r, spa)); // register each page → same handler

const port = process.env.PORT || 3000; // hosts (Render) inject PORT; locally default 3000
app.listen(port, () => { // START listening — the callback runs once the socket is open
  console.log(`WhatsApp AI support server running on port ${port}`);
  console.log(`Signup/login: http://localhost:${port}/login`);
  console.log(`Dashboard:    http://localhost:${port}/dashboard`);
});
