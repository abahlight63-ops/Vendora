// ── src/services/authService.js ──────────────────────────────────
// WHAT: all user-account logic: password hashing, email lookup, signup,
// verification tokens. Controllers call these; SQL lives here (not in routes).
// MODULE: `crypto` (Node BUILT-IN — no install). Gives randomBytes (tokens +
// salts), scryptSync (password hashing), timingSafeEqual (safe comparison).
// Fetch (Node 18+ built-in) calls the Resend email API — no SDK installed.
const crypto = require('crypto'); // Node built-in: hashing, random bytes
const db = require('../db'); // shared Postgres pool
const mail = require('./emailTemplates'); // branded Resend templates (logo + contact in every mail)

/** Send the verification email (SMTP first, Resend second). Returns true if sent. */
async function sendVerificationEmail(email, token) {
  if (!mail.isMailConfigured()) return false; // dev mode: auto-verify — return false MEANS "not sent"
  return mail.sendVerificationEmail(email, token); // branded template (logo header, support footer)
}

/**
 * Auth service: owners sign up / sign in.
 * Passwords hashed with scrypt (no external dependency).
 * LESSON: NEVER store plain passwords. Hash = one-way fingerprint. Even we
 * can't reverse it — login just re-hashes the attempt and compares.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex'); // salt = 16 random bytes → unique per user (defeats rainbow tables)
  const hash = crypto.scryptSync(password, salt, 64).toString('hex'); // scrypt(password, salt, 64-byte output) → hex string. Sync version is fine (fast enough, runs once per signup/login)
  return `${salt}:${hash}`; // store BOTH, joined by ':' — we need the salt again at login
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':'); // destructuring: split "salt:hash" back into two vars
  if (!salt || !hash) return false; // corrupted row → fail closed (deny, don't crash)
  const candidate = crypto.scryptSync(password, salt, 64); // hash the ATTEMPT with the SAME salt…
  const expected = Buffer.from(hash, 'hex'); // …decode the stored hash back to bytes…
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected); // constant-time compare (length check first — timingSafeEqual throws on mismatch)
}

async function findUserByEmail(email) {
  const { rows } = await db.query( // JOIN users→businesses so login immediately knows the shop name
    `SELECT u.*, b.name AS business_name FROM users u
     JOIN businesses b ON b.id = u.business_id -- ON = how the two tables link (foreign key)
     WHERE LOWER(u.email) = LOWER($1) LIMIT 1`, // LOWER both sides = case-insensitive login
    [email]
  );
  return rows[0] || null; // row or null (callers check `if (!user)`)
}

async function createUser(businessId, email, password) {
  const verifyToken = crypto.randomBytes(32).toString('hex'); // 32 random bytes → unguessable 64-char token
  const emailSent = await sendVerificationEmail(email, verifyToken); // try the email (false in dev mode)
  // SECURITY RULE: auto-verify ONLY when NO mail path is configured (local dev).
  // Mail configured but send FAILED → stay UNVERIFIED (else an outage lets
  // anyone register without email access — fail CLOSED in production!).
  const verified = emailSent ? false : !mail.isMailConfigured(); // sent → must click (false); no mail → auto true; failed send → false!
  const { rows } = await db.query(
    `INSERT INTO users (business_id, email, password_hash, verified, verify_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, business_id, verified`, // RETURNING gives back the new row (no second query)
    [businessId, email.toLowerCase(), hashPassword(password), verified, emailSent ? verifyToken : null] // store lowercase email (login consistency); token only if email actually sent
  );
  return rows[0]; // the new user object
}

async function verifyByToken(token) {
  const { rows } = await db.query( // UPDATE…RETURNING = flip the flag AND get the email in one round-trip…
    `UPDATE users SET verified = true, verify_token = NULL -- NULL the token so the link can't be reused (one-time use!)
     WHERE verify_token = $1 AND verified = false -- AND guards: only unverified accounts with THIS token
     RETURNING email`,
    [token]
  );
  return rows[0] || null; // null = bad/expired/used token → controller shows error page
}

async function resendVerification(email) {
  const user = await findUserByEmail(email); // look them up first
  if (!user) return null; // unknown email → controller sends 404
  if (user.verified) return { already: true }; // idempotent: already done is still "success"
  const token = crypto.randomBytes(32).toString('hex'); // fresh token (old links die)
  await db.query('UPDATE users SET verify_token = $1 WHERE id = $2', [token, user.id]); // overwrite stored token
  const sent = await sendVerificationEmail(email, token); // try sending again
  return { sent }; // controller picks the message from this flag
}

// ---- OTP registration (6-digit email codes, scrypt-hashed like passwords) ----
// WHY hash OTPs: the users table may leak (backups, logs) — a plain code there
// lets anyone verify any account. Hash = useless to thieves, verifiable by us.
function makeOTP() {
  let code = ''; // 6 digits, crypto-random (NOT Math.random — predictable!)
  for (let i = 0; i < 6; i++) code += String(crypto.randomInt(0, 10)); // randomInt = uniform 0–9 (no modulo bias!)
  return code;
}

async function sendOTPEmail(email, code) { // pretty code email (SMTP/Resend — same providers, no new dependency!)…
  if (!mail.isMailConfigured()) return false; // dev mode: caller auto-verifies (same convention as links!)
  return mail.sendOTPEmail(email, code); // branded template (big digits + logo header)
}

async function issueOTP(email) { // create + send a fresh code (invalidates any previous one!)…
  const user = await findUserByEmail(email);
  if (!user) return { sent: false, reason: 'nouser' }; // unknown email (controller 404s — no enumeration beyond what signup already leaks)
  if (user.verified) return { sent: true, already: true }; // verified? nothing to do (idempotent!)
  const code = makeOTP(); // the plain code (lives ONLY in this function + the email — never stored!)
  const sent = await sendOTPEmail(email, code);
  await db.query( // store HASH + 10-min expiry + reset attempts (even if email FAILED — auto rules below decide)…
    'UPDATE users SET otp_hash = $1, otp_expires = now() + make_interval(mins => 10), otp_attempts = 0 WHERE id = $2', // make_interval(mins => 10) = now+10min; attempts reset (fresh code, fresh chances!)
    [hashPassword(code), user.id] // hashPassword REUSED (salt:hash — same machinery as passwords, zero new crypto!)
  );
  const auto = sent ? false : !mail.isMailConfigured(); // SECURITY: auto-verify only with NO mail path (dev); configured-but-failed → must use link fallback, NOT free pass!
  return { sent, auto };
}

async function verifyOTP(email, code) { // check a submitted code…
  const user = await findUserByEmail(email);
  if (!user) return { ok: false }; // unknown (same shape as wrong — no enumeration!)
  if (user.verified) return { ok: true, already: true }; // already done (idempotent!)
  const { rows } = await db.query('SELECT otp_hash, otp_expires, otp_attempts FROM users WHERE id = $1', [user.id]); // fresh read (attempts change per try!)
  const r = rows[0];
  if (!r || !r.otp_hash || !r.otp_expires) return { ok: false }; // no active code (never issued / already burned)
  if (new Date(r.otp_expires) < new Date()) return { ok: false, expired: true }; // past 10-min window (frontend offers resend!)
  if (Number(r.otp_attempts) >= 5) return { ok: false, locked: true }; // 5 wrong tries = burned (brute-force guard: 6 digits = 1M combos, 5 tries ≈ 0% chance!)
  if (!verifyPassword(String(code).trim(), r.otp_hash)) { // wrong code? (trim whitespace — mobile keyboards add spaces!)
    await db.query('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = $1', [user.id]); // count the try (SQL-side increment = race-safe!)
    return { ok: false, left: 5 - (Number(r.otp_attempts) + 1) }; // attempts LEFT (UX: "3 tries left" beats silent failure!)
  }
  await db.query('UPDATE users SET verified = true, otp_hash = NULL, otp_expires = NULL, otp_attempts = 0 WHERE id = $1', [user.id]); // SUCCESS: verify + BURN the code (NULL hash = single-use!) + reset counter
  return { ok: true, user }; // user object returned (controller logs them straight in!)
}

// ---- Forgot password (email LINK, 1-hour token — links beat typing for resets!) ----
async function issueReset(email) { // create a reset token (always "succeeds" publicly — no enumeration!)…
  const user = await findUserByEmail(email);
  if (!user) return { sent: true }; // unknown email: PRETEND success (don't reveal who has accounts — enumeration defense!)
  const token = crypto.randomBytes(32).toString('hex'); // 256-bit unguessable token (same strength as verify links!)
  await db.query('UPDATE users SET reset_token = $1, reset_expires = now() + make_interval(hours => 1) WHERE id = $2', [token, user.id]); // 1-hour window (short-lived secrets!)
  if (!mail.isMailConfigured()) {
    // Dev mode: hand the token back ONLY outside production (local testing
    // without email). In production missing mail must NEVER leak tokens —
    // users just see "sent" and the admin must configure SMTP or Resend.
    return process.env.NODE_ENV === 'production' ? { sent: true } : { sent: true, devToken: token };
  }
  const sent = await mail.sendResetEmail(email, token); // branded template (logo header, support footer)
  if (!sent) console.error('Resend reset failed (see log above)'); // log only (public response stays "sent" — enumeration defense even on failure!)
  return { sent: true };
}

async function resetPassword(token, password) { // consume a reset token + set new password…
  if (!token || !password || password.length < 8) return { ok: false }; // validate BOTH (length rule matches signup!)
  const { rows } = await db.query('SELECT id FROM users WHERE reset_token = $1 AND reset_expires > now() LIMIT 1', [token]); // token must exist AND be unexpired (SQL-side expiry = no timezone bugs!)
  if (rows.length === 0) return { ok: false }; // bad/expired/used (all look identical — no enumeration!)
  await db.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2', [hashPassword(password), rows[0].id]); // new hash + BURN token (one-time use — replay attacks dead!)
  return { ok: true };
}

module.exports = { hashPassword, verifyPassword, findUserByEmail, createUser, verifyByToken, resendVerification, makeOTP, sendOTPEmail, issueOTP, verifyOTP, issueReset, resetPassword }; // export all six for controllers
