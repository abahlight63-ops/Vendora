// ── scripts/restore-db.js ──────────────────────────────────────────
// WHAT: puts a backup into a NEW, EMPTY database (for example a fresh
// Supabase project) when the live one is lost or damaged.
//   RESTORE_DATABASE_URL=<new empty db> npm run restore -- <file.vsbak> --yes
//
// SAFETY LOCKS — it refuses to run when:
//   • RESTORE_DATABASE_URL is missing (it never falls back to DATABASE_URL)
//   • the target is the same database as DATABASE_URL (your live one)
//   • any table in the target already has rows (it never overwrites data)
//   • --yes is not given
// Everything happens in ONE transaction on the target: if anything fails,
// the target is left exactly as it was. Your live database is never opened.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { load, newest } = require('./backup-verify');

function sameDb(a, b) {
  try {
    const x = new URL(a); const y = new URL(b);
    const id = (u) => [u.hostname.toLowerCase(), u.port || '5432', u.pathname.replace(/^\//, '') || 'postgres', decodeURIComponent(u.username).split('.').pop()].join('|');
    // Supabase poolers name the project in the user ("postgres.<project>"), direct hosts in the host ("db.<project>.supabase.co")
    const proj = (u) => (u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/) || [])[1] || (decodeURIComponent(u.username).split('.')[1] || '');
    return id(x) === id(y) || (proj(x) && proj(x) === proj(y));
  } catch { return true; } // unreadable URL → treat as the same (refuse)
}

const SESSIONS_TABLE = `CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess JSONB NOT NULL, expires TIMESTAMPTZ NOT NULL);`;

// Create a table the app schema does not know (old tables), from the backup's column list.
function ddlFromColumns(name, columns) {
  const cols = columns.map((c) => {
    let type = c.type === 'ARRAY' ? (c.udt || '').replace(/^_/, '') + '[]' : c.type === 'USER-DEFINED' ? 'text' : c.type;
    if (/nextval\(/.test(String(c.def || ''))) type = type === 'bigint' ? 'BIGSERIAL' : 'SERIAL';
    return `"${c.name}" ${type}`;
  });
  return `CREATE TABLE IF NOT EXISTS public."${name}" (${cols.join(', ')})`;
}

async function restore(file, targetUrl, opts = {}) {
  const data = load(file, process.env.BACKUP_PASSPHRASE);
  if (!targetUrl) throw new Error('RESTORE_DATABASE_URL is not set. It must be a NEW, EMPTY database, never your live one.');
  if (process.env.DATABASE_URL && sameDb(targetUrl, process.env.DATABASE_URL)) throw new Error('Refused: RESTORE_DATABASE_URL points at your live database.');
  if (!opts.yes) throw new Error('Add --yes to confirm you want to fill the NEW database ' + new URL(targetUrl).hostname);
  const pool = opts.pool || new Pool({ connectionString: targetUrl, ssl: /localhost|127\.0\.0\.1/.test(targetUrl) ? false : { rejectUnauthorized: false }, max: 1 });
  const c = opts.client || await pool.connect();
  try {
    // Refuse if the target already holds data.
    const { rows: existing } = await c.query(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`);
    for (const { name } of existing) {
      const { rows: [{ n }] } = await c.query(`SELECT COUNT(*)::int AS n FROM public."${name}"`);
      if (n > 0) throw new Error(`Refused: the target database is not empty (table ${name} has ${n} rows).`);
    }
    await c.query('BEGIN');
    process.env.DATABASE_URL = process.env.DATABASE_URL || targetUrl; // configService only reads the schema text; it never connects here
    const { CREATE_TABLE } = require('../src/services/configService');
    await c.query(CREATE_TABLE);
    await c.query(SESSIONS_TABLE);
    for (const [name, t] of Object.entries(data.tables)) await c.query(ddlFromColumns(name, t.columns));

    // Insert parents before children (foreign keys).
    const { rows: fks } = await c.query(`SELECT cl.relname AS child, pr.relname AS parent FROM pg_constraint co
      JOIN pg_class cl ON cl.oid = co.conrelid JOIN pg_class pr ON pr.oid = co.confrelid WHERE co.contype = 'f'`);
    const order = []; const seen = new Set();
    const visit = (n, stack = new Set()) => {
      if (seen.has(n) || stack.has(n)) return; stack.add(n);
      fks.filter((f) => f.child === n && f.parent !== n).forEach((f) => visit(f.parent, stack));
      seen.add(n); order.push(n);
    };
    Object.keys(data.tables).forEach((n) => visit(n));

    let total = 0;
    for (const name of order) {
      const t = data.tables[name];
      if (!t || !t.rows.length) continue;
      const { rows: targetCols } = await c.query(`SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [name]);
      const typeOf = Object.fromEntries(targetCols.map((x) => [x.name, x.type]));
      const cols = t.columns.map((x) => x.name).filter((n) => typeOf[n]);
      // Columns pointing at the same table (a shop "referred_by" another shop) are filled in a second pass,
      // once every row exists, so the order of rows never matters.
      const { rows: selfCols } = await c.query(`SELECT a.attname AS col FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid
        JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = ANY (co.conkey)
        WHERE co.contype = 'f' AND co.conrelid = co.confrelid AND cl.relname = $1`, [name]);
      const later = new Set(selfCols.map((x) => x.col).filter((n) => cols.includes(n)));
      const pk = cols.includes('id') ? 'id' : null;
      const val = (row, n) => (row[n] !== null && typeof row[n] === 'object' && /json/.test(typeOf[n]) ? JSON.stringify(row[n]) : row[n]);
      for (const row of t.rows) {
        const vals = cols.map((n) => (later.has(n) && pk ? null : val(row, n)));
        await c.query(`INSERT INTO public."${name}" (${cols.map((n) => `"${n}"`).join(', ')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')})`, vals);
        total++;
      }
      if (pk) for (const n of later) for (const row of t.rows) {
        if (row[n] == null) continue;
        await c.query(`UPDATE public."${name}" SET "${n}" = $1 WHERE "${pk}" = $2`, [row[n], row[pk]]);
      }
    }
    // Counters continue after the restored ids (new orders get #0042, not #0001).
    const { rows: seqs } = await c.query(`SELECT table_name AS t, column_name AS col FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`);
    for (const s of seqs) await c.query(`SELECT setval(pg_get_serial_sequence('public."${s.t}"', '${s.col}'), GREATEST(COALESCE((SELECT MAX("${s.col}") FROM public."${s.t}"), 0), 1))`);
    await c.query('COMMIT');
    return { tables: order.filter((n) => data.tables[n] && data.tables[n].count).length, rows: total, created: data.created };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (!opts.client) { c.release(); await pool.end(); }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--')) || newest(path.join(__dirname, '..', 'backups'));
  restore(file, process.env.RESTORE_DATABASE_URL, { yes: args.includes('--yes') })
    .then((r) => console.log(`Restored ${r.rows} rows into ${r.tables} tables from the backup taken ${r.created}.`))
    .catch((e) => { console.error('RESTORE STOPPED: ' + e.message); process.exit(1); });
}
module.exports = { restore, sameDb, ddlFromColumns };
