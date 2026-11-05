// ── src/utils/secret.js ───────────────────────────────────────────
// Encrypts stored access keys (WhatsApp/Meta tokens) so a database leak does
// not hand out shops' WhatsApp access. AES-256-GCM with TOKEN_ENCRYPTION_KEY
// (32 random bytes, base64) from the environment.
//   seal(plain)  → "enc:v1:<base64 iv+tag+data>"  (plain text if no key is set)
//   open(stored) → plain text. Values without the prefix pass through, so keys
//                  saved before encryption keep working until they are re-saved.
const crypto = require('crypto');
const PREFIX = 'enc:v1:';
let warned = false;

function key() {
  const raw = (process.env.TOKEN_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    if (!warned) { warned = true; console.error('TOKEN_ENCRYPTION_KEY must be 32 bytes in base64. Keys are stored unencrypted until it is fixed.'); }
    return null;
  }
  return buf;
}

function seal(plain) {
  const text = String(plain == null ? '' : plain);
  if (!text || text.startsWith(PREFIX)) return text;
  const k = key();
  if (!k) {
    if (!warned) { warned = true; console.warn('TOKEN_ENCRYPTION_KEY is not set: access keys are stored unencrypted.'); }
    return text;
  }
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

function open(stored) {
  const text = String(stored == null ? '' : stored);
  if (!text.startsWith(PREFIX)) return text;
  const k = key();
  if (!k) { console.error('An encrypted access key was found but TOKEN_ENCRYPTION_KEY is missing.'); return ''; }
  try {
    const buf = Buffer.from(text.slice(PREFIX.length), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', k, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch (e) {
    console.error('Could not decrypt an access key (wrong TOKEN_ENCRYPTION_KEY?)');
    return '';
  }
}

module.exports = { seal, open, PREFIX };
