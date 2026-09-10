// ── scripts/schema.js ────────────────────────────────────────────
// WHAT: creates every table the app needs. Run once per database:
//   npm run db:init   (package.json maps db:init → node scripts/schema.js)
// WHY A SCRIPT (not manual SQL): repeatable, version-controlled, and safe to
// re-run — every statement uses IF NOT EXISTS so it never destroys data.
// MODULES: dotenv (loads .env), ../src/db (pool), ../src/services/configService
// (exports the big CREATE_TABLE SQL string — single source of schema truth).
require('dotenv').config(); // must run BEFORE requiring db (db reads DATABASE_URL at load)
const { CREATE_TABLE } = require('../src/services/configService'); // the whole schema as one SQL string
const db = require('../src/db'); // shared pool from src/db/index.js

(async () => { // async IIFE = immediately-invoked function so we can use await at top level
  await db.query(CREATE_TABLE); // pg driver can run multi-statement SQL in one call
  console.log('Schema created (businesses, conversations).'); // success message for the terminal
  await db.pool.end(); // close the pool so the script exits (else Node hangs waiting)
})().catch((e) => { // .catch on the IIFE promise = handles any error above
  console.error(e); // print the real error (e.g. wrong DATABASE_URL)
  process.exit(1); // exit code 1 = failure (success is 0) — CI/scripts check this
});
