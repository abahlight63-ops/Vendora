// ── src/db/index.js ──────────────────────────────────────────────
// WHAT: the single shared Postgres connection pool for the whole backend.
// WHY A POOL: opening a new DB connection per request is slow; a pool keeps
// a few warm connections ready and hands them out on demand.
// MODULE: `pg` (node-postgres) — installed via `npm i pg`. It gives us the
// `Pool` class that talks to Postgres over TCP using the connection string.
require('dotenv').config(); // load .env into process.env (see package dotenv note)
const { Pool } = require('pg'); // pull just the Pool class out of the pg package

// Guard clause: crash fast with a helpful message if DB isn't configured.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure it.');
}

// Create ONE pool for the whole process (this file is require-cached, so every
// `require('../db')` shares it — that's the Singleton pattern via modules).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // e.g. postgres://user:pass@host:5432/db
  // Local Postgres doesn't use SSL; hosted ones (Supabase/Railway) require it.
  ssl: process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }, // needed for Supabase/Railway hosted Postgres
  max: 5, // never hold more than 5 connections (respects free-tier limits)
  idleTimeoutMillis: 10000,        // kill idle connections before Supabase drops them
  connectionTimeoutMillis: 15000, // fail after 15s instead of hanging forever
});

// Network errors that are safe to retry once (blips, not bugs).
const RETRYABLE = ['ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', '57P01'];
// Helper: does this error look transient? Checks the code + message text.
function isRetryable(err) {
  return err && (RETRYABLE.includes(err.code) || /terminated|connection.*closed|receive/i.test(err.message || ''));
}

/**
 * Query with one automatic retry on transient network failures.
 * App code calls this instead of pool.query directly.
 */
async function query(text, params) {
  try {
    return await pool.query(text, params); // first attempt: SQL text + $1,$2 params
  } catch (err) {
    if (isRetryable(err)) {
      await new Promise((r) => setTimeout(r, 400)); // wait 400ms…
      return await pool.query(text, params); // …second attempt on a fresh connection
    }
    throw err; // real error (bad SQL, etc.) — let the caller handle it
  }
}

// Log surprise pool errors (e.g. DB restarted) instead of crashing silently.
pool.on('error', (err) => console.error('Unexpected pool error:', err.message));

// Export both: query() for daily use, pool for shutdown (pool.end()).
module.exports = { query, pool };
