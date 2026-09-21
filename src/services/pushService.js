// ── src/services/pushService.js ────────────────────────────────────
// WHAT: Web Push (phone-bar alerts even with the tab closed) with ZERO new
// dependencies — VAPID signing (ES256 JWT) + RFC 8291 aes128gcm payload
// encryption, all on Node built-in crypto + global fetch.
// WHY WEB PUSH FIRST: no vendor key, no Firebase project, no Apple paperwork
// (native FCM comes later). VAPID keys are OURS (generated once, env-stored).
// FLOW: owner taps "Phone alerts" (Profile) → browser subscribes → we store
// {endpoint, p256dh, auth} → every bell ALSO fans out here (fire-and-forget,
// never slows the request that triggered it!).
// ENV: VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (base64url, `npm run push:vapid`
// prints a pair!) + VAPID_SUBJECT (mailto:you@shop.com for the JWT).
// No npm modules — crypto + fetch only.

const crypto = require('crypto'); // ECDH P-256, HKDF, AES-GCM, ES256 JWT (all built in!)
const db = require('../db'); // subscription storage

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function vapidKeys() {
  const pub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pub || !priv) return null; // unset → push silently off (bell still works!)
  try {
    const pubBuf = unb64url(pub);
    const privBuf = unb64url(priv);
    if (pubBuf.length !== 65 || privBuf.length !== 32) return null; // wrong shape (pasted the wrong half?) → off, not broken!
    return { pub, priv, pubBuf, privBuf };
  } catch {
    return null;
  }
}

/** Generate a fresh VAPID pair (prints base64url — paste into .env!). */
function generateVapidKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([0x04]), unb64url(pubJwk.x), unb64url(pubJwk.y)]); // uncompressed point (65B!)
  return { publicKey: b64url(pub), privateKey: privJwk.d };
}

/** VAPID JWT for one push-service origin (aud = scheme+host of endpoint). */
function vapidJwt(endpoint, keys) {
  const aud = new URL(endpoint).origin; // "https://fcm.googleapis.com" (per-origin audience — RFC 8292!)
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(Buffer.from(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600, // 12h ticket (push services reject day-old JWTs!)
    sub: (process.env.VAPID_SUBJECT || 'mailto:push@localhost').trim(),
  })));
  const data = `${header}.${payload}`;
  const privKey = crypto.createPrivateKey({
    key: {
      kty: 'EC', crv: 'P-256',
      x: b64url(keys.pubBuf.slice(1, 33)), y: b64url(keys.pubBuf.slice(33, 65)), d: keys.priv,
    },
    format: 'jwk',
  });
  const sig = crypto.sign('sha256', Buffer.from(data), { key: privKey, dsaEncoding: 'ieee-p1363' }); // raw r||s (64B — NOT DER!)
  return `${data}.${b64url(sig)}`;
}

// RFC 8291 §3.4 content-encryption (aes128gcm): ECDH + HKDF + AES-128-GCM.
function encryptPayload(p256dhB64, authB64, plaintext) {
  const clientPub = unb64url(p256dhB64); // receiver's 65B uncompressed point
  const auth = unb64url(authB64); // receiver's 16B auth secret
  if (clientPub.length !== 65 || auth.length !== 16) throw new Error('Bad subscription keys');
  const ecdh = crypto.createECDH('prime256v1');
  const serverPub = ecdh.generateKeys(); // fresh ephemeral pair PER message (replay-safe!)
  const shared = ecdh.computeSecret(clientPub); // ECDH(server_priv, client_pub)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), clientPub, serverPub]); // binds keys into the derivation (replay across subs dies!)
  const prk = crypto.hkdfSync('sha256', shared, auth, Buffer.alloc(0), 32); // Extract(salt=auth, IKM=shared)
  const cek = crypto.hkdfSync('sha256', prk, Buffer.alloc(0), Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), keyInfo]), 16);
  const nonce = crypto.hkdfSync('sha256', prk, Buffer.alloc(0), Buffer.concat([Buffer.from('Content-Encoding: nonce\0', 'utf8'), keyInfo]), 12);
  const salt = crypto.randomBytes(16);
  // Single-record layout (RFC 8188 §3): salt(16) + rs u32 (=4096) + keyid-len(1)=65 + keyid(65B) + body
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([65]), serverPub]);
  const pad = Buffer.concat([Buffer.alloc(0), Buffer.from([0x02]), Buffer.from(plaintext, 'utf8')]); // 0x02 delimiter ends padding (no pad bytes needed — short alerts!)
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce); // AAD empty (RFC 8188 aes128gcm — header rides in the clear by design!)
  const ct = Buffer.concat([cipher.update(pad), cipher.final(), cipher.getAuthTag()]); // tag appended (16B integrity!)
  return { body: Buffer.concat([header, ct]), serverPub };
}

/** Send ONE encrypted push. Resolves true/false (404/410 = subscription dead — caller prunes!). */
async function sendPush(sub, payload) {
  const keys = vapidKeys();
  if (!keys) return false;
  const text = JSON.stringify({ title: String(payload.title || 'VeloSales Ai'), body: String(payload.body || ''), url: String(payload.url || '/dashboard') });
  let reqBody;
  try {
    reqBody = encryptPayload(sub.p256dh, sub.auth, text);
  } catch (e) {
    console.error('push encrypt error:', e.message);
    return false;
  }
  const ctrl = new AbortController(); // push services hanging must never hang US!
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Encryption': `salt=${b64url(reqBody.body.slice(0, 16))}`,
        'Crypto-Key': `dh=${b64url(reqBody.serverPub)};p256ecdsa=${keys.pub}`,
        Authorization: `vapid t=${vapidJwt(sub.endpoint, keys)}, k=${keys.pub}`,
        TTL: '86400', // 1 day store-and-forward (offline phones still get it!)
      },
      body: reqBody.body,
    });
    if (res.status === 404 || res.status === 410) return 'gone'; // subscription dead (uninstalled/blocked) → prune!
    if (!res.ok) console.error(`push ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return res.ok;
  } catch (e) {
    console.error('push send error:', e.message);
    return false;
  } finally {
    clearTimeout(t);
  }
}

// ---- storage (one row per browser — owners enable phone + laptop separately!) ----
async function saveSubscription(businessId, { endpoint, p256dh, auth }) {
  if (!endpoint || !p256dh || !auth) throw Object.assign(new Error('Bad subscription.'), { status: 400 });
  await db.query(
    `INSERT INTO push_subscriptions (business_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET business_id = EXCLUDED.business_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [Number(businessId), String(endpoint).slice(0, 2000), String(p256dh).slice(0, 200), String(auth).slice(0, 100)]
  );
  return true;
}

async function removeSubscription(businessId, endpoint) {
  await db.query('DELETE FROM push_subscriptions WHERE business_id = $1 AND endpoint = $2', [Number(businessId), String(endpoint || '')]);
  return true;
}

/** Fan out to ALL of one shop's browsers. Fire-and-forget SAFE (never throws!). */
async function pushBusiness(businessId, payload) {
  try {
    if (!vapidKeys() || !businessId) return 0; // off or nobody → silent (bell already landed!)
    const { rows } = await db.query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE business_id = $1', [Number(businessId)]);
    if (!rows.length) return 0; // never enabled alerts → nothing to do
    const results = await Promise.all(rows.map((s) => sendPush(s, payload))); // parallel (one slow push service never blocks the rest!)
    const dead = rows.filter((_, i) => results[i] === 'gone');
    for (const d of dead) { // prune corpses (uninstalled apps stop costing us sends!)
      try { await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [d.endpoint]); } catch {}
    }
    return results.filter((r) => r === true).length;
  } catch (e) {
    console.error('pushBusiness error:', e.message);
    return 0;
  }
}

module.exports = { vapidKeys, generateVapidKeys, vapidJwt, encryptPayload, sendPush, saveSubscription, removeSubscription, pushBusiness };
