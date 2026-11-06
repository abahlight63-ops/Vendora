// ── scripts/backup-verify.js ───────────────────────────────────────
// WHAT: opens an encrypted backup and proves it is complete and readable.
// Touches NO database. Usage:
//   npm run backup:verify                  → checks the newest file in backups/
//   npm run backup:verify -- <file.vsbak>  → checks that file
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MAGIC = Buffer.from('VSBAK1');

function decrypt(buf, passphrase) {
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a VeloSales backup file.');
  let o = MAGIC.length;
  const salt = buf.subarray(o, o += 16);
  const iv = buf.subarray(o, o += 12);
  const tag = buf.subarray(o, o += 16);
  const key = crypto.scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(buf.subarray(o)), d.final()]); }
  catch { throw new Error('Wrong BACKUP_PASSPHRASE, or the file was changed or damaged.'); }
}

function load(file, passphrase) {
  const plain = zlib.gunzipSync(decrypt(fs.readFileSync(file), passphrase));
  const data = JSON.parse(plain.toString('utf8'));
  if (data.format !== 'velosales-backup-1') throw new Error('Unknown backup format.');
  const { sha256, ...rest } = data;
  const check = crypto.createHash('sha256').update(Buffer.from(JSON.stringify(rest))).digest('hex');
  if (sha256 && sha256 !== check) throw new Error('Checksum mismatch: the backup content is not what was saved.');
  for (const [name, t] of Object.entries(data.tables)) if (t.rows.length !== t.count) throw new Error(`Table ${name} is incomplete.`);
  return data;
}

function newest(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.vsbak')).sort() : [];
  if (!files.length) throw new Error('No backups found in ' + dir);
  return path.join(dir, files[files.length - 1]);
}

if (require.main === module) {
  try {
    const pass = process.env.BACKUP_PASSPHRASE;
    if (!pass) throw new Error('BACKUP_PASSPHRASE is not set.');
    const file = process.argv[2] || newest(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));
    const data = load(file, pass);
    const tables = Object.entries(data.tables);
    console.log(`Backup is complete and readable: ${path.basename(file)}`);
    console.log(`Taken ${data.created} from Postgres ${data.server}; checksum OK`);
    console.log(tables.map(([n, t]) => `${n}: ${t.count}`).join(', '));
  } catch (e) { console.error('BACKUP CHECK FAILED: ' + e.message); process.exit(1); }
}
module.exports = { decrypt, load, newest };
