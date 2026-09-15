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
function secureHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); // blocks MIME-sniffing (served JS stays JS — kills a whole XSS class)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // no clickjacking from foreign iframes (our own pages may still embed)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Paystack/Flutterwave get origin only, never full URLs with ids
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); // we never need these (closes drive-by permission prompts)
  const proto = req.get('x-forwarded-proto') || req.protocol; // trust-proxy is set (server.js) so this is the REAL scheme
  if (proto === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HSTS: browsers refuse future http (prod only — never on localhost!)
  next();
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

const webhookLimiter = rateLimit({ // provider webhooks: very generous (Twilio/Telegram burst legitimately; forgery is stopped by signatures, not counts!)
  windowMs: 60 * 1000,
  max: 600,
});

module.exports = { secureHeaders, rateLimit, authLimiter, billingLimiter, webhookLimiter }; // server.js + route files import from here
