// Backups: the script can only read, the file cannot be opened without the
// passphrase, any change to the file is detected, and restore refuses to
// touch the live database.
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { guard, encrypt } = require('../scripts/backup-db');
const { decrypt, load } = require('../scripts/backup-verify');
const { sameDb } = require('../scripts/restore-db');

test('backup can only read: every write or schema change is refused', () => {
  for (const ok of ['SELECT 1', 'SHOW server_version', 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY', 'ROLLBACK']) assert.doesNotThrow(() => guard(ok));
  for (const bad of ['DELETE FROM users', 'UPDATE users SET verified = true', 'INSERT INTO x VALUES (1)', 'DROP TABLE users', 'TRUNCATE orders', 'ALTER TABLE users ADD x int', 'BEGIN', 'COMMIT', 'CREATE TABLE t (a int)']) {
    assert.throws(() => guard(bad), /refused/, bad);
  }
});

test('backup file: opens with the passphrase, not without; tampering is detected', () => {
  const body = { format: 'velosales-backup-1', created: 'now', server: '17', tables: { users: { columns: [], count: 1, rows: [{ id: 1 }] } } };
  const sha = require('crypto').createHash('sha256').update(Buffer.from(JSON.stringify(body))).digest('hex');
  const file = path.join(os.tmpdir(), `vs-test-${Date.now()}.vsbak`);
  const packed = encrypt(zlib.gzipSync(Buffer.from(JSON.stringify({ ...body, sha256: sha }))), 'correct horse battery staple');
  fs.writeFileSync(file, packed);
  try {
    assert.equal(load(file, 'correct horse battery staple').tables.users.rows[0].id, 1);
    assert.throws(() => load(file, 'wrong passphrase here'), /Wrong BACKUP_PASSPHRASE/);
    const tampered = Buffer.from(packed); tampered[tampered.length - 5] ^= 0xff;
    assert.throws(() => decrypt(tampered, 'correct horse battery staple'), /damaged|Wrong/);
    assert.equal(packed.includes(Buffer.from('"rows"')), false, 'nothing readable in the file');
  } finally { fs.unlinkSync(file); }
});

test('restore recognises the live database in every URL form', () => {
  const live = 'postgresql://postgres.abcd1234:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres';
  assert.equal(sameDb(live, live), true);
  assert.equal(sameDb('postgresql://postgres.abcd1234:other@aws-0-eu-west-2.pooler.supabase.com:5432/postgres', live), true, 'same project, other port');
  assert.equal(sameDb('postgresql://postgres:pw@db.abcd1234.supabase.co:5432/postgres', live), true, 'same project, direct host');
  assert.equal(sameDb('postgresql://postgres.zzzz9999:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres', live), false, 'a different project is allowed');
  assert.equal(sameDb('not a url', live), true, 'unreadable → refuse');
});
