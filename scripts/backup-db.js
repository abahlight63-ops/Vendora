// ── scripts/backup-db.js ───────────────────────────────────────────
// WHAT: a full, encrypted backup of the VeloSales database.
//   npm run backup            → backups/velosales-<date>.vsbak
//
// READ-ONLY BY DESIGN — this script can never change your data:
//   1. Everything runs inside ONE transaction opened as READ ONLY. Postgres
//      itself rejects any INSERT/UPDATE/DELETE/DDL inside it.
//   2. The script's own query guard refuses anything that is not a read.
//   3. It ends with ROLLBACK (nothing to keep, nothing changed).
// The snapshot is consistent (REPEATABLE READ): every table is read at the
// same moment, so orders always match their chats, payments their shops.
//
// ENCRYPTED: gzip, then AES-256-GCM with a key derived (scrypt) from
// BACKUP_PASSPHRASE. Without the passphrase the file is useless — keep the
// passphrase in a password manager; a lost passphrase means a lost backup.
// Needs: DATABASE_URL, BACKUP_PASSPHRASE (env or .env). Optional: BACKUP_DIR.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const MAGIC = Buffer.from('VSBAK1'); // file starts with this, then salt(16) iv(12) tag(16) data

function encrypt(plain, passphrase) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), data]);
}

// Only reads may pass. (Belt and braces: the READ ONLY transaction already forbids writes.)
function guard(sql) {
  const s = String(sql).trim().toUpperCase();
  if (!/^(SELECT|SHOW|BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY|ROLLBACK)\b/.test(s)) {
    throw new Error('Backup refused to run a non-read statement: ' + s.slice(0, 40));
  }
  return sql;
}

async function backup() {
  const url = process.env.DATABASE_URL;
  const pass = process.env.BACKUP_PASSPHRASE;
  if (!url) throw new Error('DATABASE_URL is not set.');
  if (!pass || pass.length < 16) throw new Error('BACKUP_PASSPHRASE is missing or shorter than 16 characters.');
  const ssl = /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl, max: 1, connectionTimeoutMillis: 20000 });
  const c = await pool.connect();
  const q = (sql, args) => c.query(guard(sql), args);
  const started = Date.now();
  try {
    await q('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const version = (await q('SHOW server_version')).rows[0].server_version;
    const { rows: tables } = await q(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                       WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`);
    const out = { format: 'velosales-backup-1', created: new Date().toISOString(), server: version, tables: {} };
    for (const { name } of tables) {
      const { rows: columns } = await q(`SELECT column_name AS name, data_type AS type, udt_name AS udt, is_nullable AS nullable, column_default AS def
                                          FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [name]);
      const { rows } = await q(`SELECT * FROM public."${name.replace(/"/g, '""')}"`);
      const { rows: [{ n }] } = await q(`SELECT COUNT(*)::int AS n FROM public."${name.replace(/"/g, '""')}"`);
      if (n !== rows.length) throw new Error(`Row count changed while reading ${name} (${rows.length} vs ${n}).`);
      out.tables[name] = { columns, count: rows.length, rows };
    }
    const json = Buffer.from(JSON.stringify(out));
    const sha = crypto.createHash('sha256').update(json).digest('hex');
    out.sha256 = sha;
    const packed = encrypt(zlib.gzipSync(Buffer.from(JSON.stringify({ ...out }))), pass);
    const dir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    const file = path.join(dir, `velosales-${stamp}.vsbak`);
    fs.writeFileSync(file, packed, { mode: 0o600 });
    const total = Object.values(out.tables).reduce((s, t) => s + t.count, 0);
    console.log(`Backup OK: ${Object.keys(out.tables).length} tables, ${total} rows, ${(packed.length / 1024).toFixed(0)} KB encrypted, ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log('Saved to ' + file);
    return { file, tables: Object.keys(out.tables).length, rows: total };
  } finally {
    await c.query('ROLLBACK').catch(() => {}); // nothing was changed; end the read-only snapshot
    c.release();
    await pool.end();
  }
}

if (require.main === module) {
  backup().catch((e) => { console.error('BACKUP FAILED: ' + e.message); process.exit(1); });
}
module.exports = { backup, encrypt, guard, MAGIC };
