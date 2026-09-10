// ── src/services/authService.js ──────────────────────────────────
// WHAT: all user-account logic: password hashing, email lookup, signup,
// verification tokens. Controllers call these; SQL lives here (not in routes).
// MODULE: `crypto` (Node BUILT-IN — no install). Gives randomBytes (tokens +
// salts), scryptSync (password hashing), timingSafeEqual (safe comparison).
// Fetch (Node 18+ built-in) calls the Resend email API — no SDK installed.
const crypto = require('crypto'); // Node built-in: hashing, random bytes
const db = require('../db'); // shared Postgres pool

/** Send the verification email via Resend (free tier). Returns true if sent. */
async function sendVerificationEmail(email, token) {
  const key = process.env.RESEND_API_KEY; // from .env (get free one at resend.com)
  if (!key) return false; // dev mode: auto-verify — return false MEANS "not sent"
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000'; // links must point at the PUBLIC url, not localhost
  const link = `${base}/api/auth/verify?token=${token}`; // the click-target: our own /verify route
  const from = process.env.EMAIL_FROM || 'Vendora <onboarding@resend.dev>'; // sender identity (Resend's free sandbox domain default)
  const html = ` // backticks = multi-line template string; ${link} interpolates the URL twice
    <div style="font-family:Segoe UI,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f6faf8;border-radius:14px;">
      <h2 style="color:#075E54;">Confirm your email — Vendora</h2>
      <p style="color:#333;line-height:1.6;">Welcome aboard! Click the button below to verify your email and activate your AI sales assistant.</p>
      <p style="text-align:center;margin:26px 0;">
        <a href="${link}" style="background:#25D366;color:#04120c;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;">Verify my email</a>
      </p>
      <p style="color:#777;font-size:.85rem;">Or paste this link into your browser:<br>${link}</p>
      <p style="color:#999;font-size:.8rem;">Didn't sign up? Ignore this email.</p>
    </div>`; // inline styles because email clients strip <style> tags (email HTML 101)
  const res = await fetch('https://api.resend.com/emails', { // POST to Resend's send endpoint
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, // Bearer = "here's my API key"
    body: JSON.stringify({ from, to: [email], subject: 'Confirm your email — Vendora', html }), // to: is an ARRAY in Resend's API
  });
  if (!res.ok) {
    console.error('Resend send failed:', res.status, await res.text()); // log Resend's reason (bad key? bad domain?)
    return false; // caller treats false as "auto-verify instead"
  }
  return true; // sent — user must click before login works
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
     JOIN businesses b ON b.id = u.business_id // ON = how the two tables link (foreign key)
     WHERE LOWER(u.email) = LOWER($1) LIMIT 1`, // LOWER both sides = case-insensitive login
    [email]
  );
  return rows[0] || null; // row or null (callers check `if (!user)`)
}

async function createUser(businessId, email, password) {
  const verifyToken = crypto.randomBytes(32).toString('hex'); // 32 random bytes → unguessable 64-char token
  const emailSent = await sendVerificationEmail(email, verifyToken); // try the email (false in dev mode)
  // If no Resend key (dev mode) or send failed, auto-verify so nothing blocks
  const verified = emailSent ? false : true; // ternary: sent → must click (false); not sent → auto true
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
    `UPDATE users SET verified = true, verify_token = NULL // NULL the token so the link can't be reused (one-time use!)
     WHERE verify_token = $1 AND verified = false // AND guards: only unverified accounts with THIS token
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

module.exports = { hashPassword, verifyPassword, findUserByEmail, createUser, verifyByToken, resendVerification }; // export all six for controllers
