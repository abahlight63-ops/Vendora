// ── src/middleware/security.js ─────────────────────────────────────
// WHAT: the app's locks — security headers + rate limiting, zero new
// dependencies (hand-rolled so `npm install` never gates a deploy).
// 1. secureHeaders: X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
//    Permissions-Policy, HSTS (https only), and X-Powered-By removal (don't
//    advertise the stack to scanners).
// 2. rateLimit({windowMs, max}): per-IP sliding-window counter. 429s with a
//    plain message (no stack, no internals). In-memory = single instance;
//    behind multiple dynos use a shared store (Redis) — noted, not built.
// No npm modules — plain Express patterns + Maps.
// Content Security Policy for the web app's pages: scripts only from this site,
// Google sign-in and Facebook's SDK (WhatsApp connect). No inline scripts, no
// plugins, no framing by other sites. The same string is set on Vercel (vercel.json).
const APP_CSP = "default-src 'self'; script-src 'self' https://accounts.google.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https:; frame-src https://accounts.google.com https://*.facebook.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

function secureHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); // blocks MIME-sniffing (served JS stays JS — kills a whole XSS class)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // no clickjacking from foreign iframes (our own pages may still embed)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Paystack/Flutterwave get origin only, never full URLs with ids
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); // we never need these (closes drive-by permission prompts)
  const proto = req.get('x-forwarded-proto') || req.protocol; // trust-proxy is set (server.js) so this is the REAL scheme
  if (proto === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HSTS: browsers refuse future http (prod only — never on localhost!)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // our window can't be grabbed by other sites (popups for Google/Meta sign-in still work)
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhook/')) {
    // API answers are data, never pages: nothing in them may run, load or be framed.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('Cache-Control', 'no-store'); // private data never sits in shared caches
  } else {
    res.setHeader('Content-Security-Policy', APP_CSP + (proto === 'https' ? '; upgrade-insecure-requests' : '')); // pages and assets served by this server
  }
  next();
}

// HTTPS only in production: plain-http requests are sent to the https address.
// (Health checks from the host stay on http so the platform can still probe.)
function forceHttps(req, res, next) {
  if (!require('../utils/isProd')() || process.env.ALLOW_HTTP === '1') return next();
  const proto = String(req.get('x-forwarded-proto') || req.protocol || '').split(',')[0].trim();
  if (proto === 'https' || req.path === '/health') return next();
  const host = req.get('host');
  if (!host) return res.status(400).end();
  if (req.method === 'GET' || req.method === 'HEAD') return res.redirect(301, 'https://' + host + req.originalUrl);
  return res.status(403).json({ error: 'Use https.' }); // never accept form/API data over plain http
}

// Sliding-window limiter: hits = timestamps array per IP, pruned each call.
// Returns 429 + Retry-After when over budget (standard, scanner-friendly).
function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // ip → [timestamps] (single-instance memory; restarts reset budgets — fail-open, never fail-closed!)
  const WINDOW = Number(windowMs) || 60000;
  const MAX = Number(max) || 60;
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.get('x-forwarded-for') || 'unknown'; // req.ip respects trust-proxy (real client, not the load balancer!)
    let times = hits.get(ip) || [];
    times = times.filter((t) => now - t < WINDOW); // prune expired (sliding, not fixed — no burst-at-boundary abuse!)
    if (times.length >= MAX) {
      try { require('../services/securityLog').log('rate_limited', req, `limit ${MAX} per ${Math.round(WINDOW / 60000)} min`); } catch { /* never block on logging */ }
      res.setHeader('Retry-After', Math.ceil(WINDOW / 1000)); // tell honest clients when to return
      return res.status(429).json({ error: message || 'Too many requests — slow down and try again.' }); // 429 (never a body with internals!)
    }
    times.push(now);
    hits.set(ip, times);
    if (hits.size > 5000) { // memory cap: drop the oldest bucket (a botnet with 5k IPs is a bigger problem than this map!)
      const oldest = hits.keys().next().value;
      hits.delete(oldest);
    }
    next();
  };
}

const authLimiter = rateLimit({ // login/signup/OTP/reset: brute-force + enumeration wall (30 tries/15min/IP is generous for humans, useless for attackers!)
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many sign-in attempts — wait 15 minutes and try again.',
});

const billingLimiter = rateLimit({ // checkout starts: stops payment-session spam (60/15min — nobody taps Pay 60 times!)
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many payment attempts — wait a few minutes and try again.',
});

const apiLimiter = rateLimit({ // the owner app's API: generous for people, a wall for scripts hammering it
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_MAX || 1500),
  message: 'Too many requests. Wait a few minutes and try again.',
});
const aiLimiter = rateLimit({ // AI answers cost money per call: Chat with Velo and Test Drive
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_MAX || 30),
  message: 'You are sending messages very fast. Wait a minute and try again.',
});

// Same-site guard (stops forged form posts): a browser always sends Origin on a
// cross-site POST. Changes that come from a website that is not ours are refused.
// Requests with no Origin (the phone app, servers, Meta, Paystack) are unaffected.
function allowedOrigins() {
  const list = ['https://velosalesai.com.ng', 'https://www.velosalesai.com.ng', 'https://app.velosalesai.com.ng', 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
  for (const v of [process.env.FRONTEND_URL, process.env.PUBLIC_BASE_URL, process.env.EXTRA_ALLOWED_ORIGINS]) {
    for (const one of String(v || '').split(',')) { try { if (one.trim()) list.push(new URL(one.trim()).origin); } catch { /* ignore */ } }
  }
  return new Set(list);
}
// CSRF defence, three checks for every change (POST/PUT/PATCH/DELETE on /api):
//  1. Origin header present → must be one of ours.
//  2. No Origin but a Referer → the Referer must be one of ours.
//  3. The browser says Sec-Fetch-Site: cross-site → refused even without the above.
// Requests with none of these (the phone app, servers, webhooks) carry no
// browser cookies from another site, so they cannot be forged this way.
function sameSiteGuard(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !req.path.startsWith('/api/')) return next();
  const allowed = allowedOrigins();
  const origin = req.get('origin');
  let from = origin || '';
  if (!from) { try { const r = req.get('referer'); if (r) from = new URL(r).origin; } catch { from = 'invalid-referer'; } }
  const site = String(req.get('sec-fetch-site') || '');
  const ok = from ? allowed.has(from) : site !== 'cross-site';
  if (ok && !(site === 'cross-site' && !allowed.has(from))) return next();
  try { require('../services/securityLog').log('cross_site_blocked', req, `${req.method} from ${from || site || 'unknown'}`); } catch { /* ignore */ }
  return res.status(403).json({ error: 'This request came from another website and was blocked.' });
}

// Constant-time compare for secrets (no timing hints).
function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && require('crypto').timingSafeEqual(x, y);
}

const webhookLimiter = rateLimit({ // provider webhooks: very generous (Meta/Telegram burst legitimately; forgery is stopped by verify tokens + secrets, not counts!)
  windowMs: 60 * 1000,
  max: 600,
});

module.exports = { APP_CSP, forceHttps, allowedOrigins, apiLimiter, aiLimiter, sameSiteGuard, safeEqual, secureHeaders, rateLimit, authLimiter, billingLimiter, webhookLimiter }; // server.js + route files import from here
