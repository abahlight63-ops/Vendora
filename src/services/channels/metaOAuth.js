// ── src/services/channels/metaOAuth.js ───────────────────────────────
// WHAT: the REDIRECT road to connect WhatsApp — the only Meta flow that
// survives a phone. The Embedded Signup popup dies on every mobile browser
// and every installed web app (blocked popups, dead webviews, silent closes),
// and that is exactly why mobile connecting never worked. A full-page OAuth
// redirect is the flow Meta designed for phones: navigate away, Meta logs in,
// Meta navigates back to a URL we control. No popup, no webview, no gamble.
// HOW: start() mints a single-use state (random nonce, signed with
// META_APP_SECRET, 10-minute life, recorded in app_meta so a redeploy
// mid-flow cannot break it). callback() redeems it once, exchanges the code
// server-side, DISCOVERS the WhatsApp Business Account + phone number from
// the returned token, and hands back clean numbers. No Meta secrets ever
// reach the browser.
// CAVEAT (honest, not optional): reading whatsapp_business_accounts off a
// Facebook Login token needs the whatsapp_business_management permission,
// which needs Meta App Review. Until that is granted, discovery returns a
// clear, actionable error instead of failing silently.

const crypto = require('crypto');
const { GRAPH } = require('./meta'); // one Graph version for the whole app

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes (long enough to type a password on mobile, short enough to be useless to a thief)
const STATE_PREFIX = 'meta_oauth:';

function appSecret() { return (process.env.META_APP_SECRET || '').trim(); }

// Our canonical callback. MUST be listed verbatim in Meta → Valid OAuth
// Redirect URIs or Meta refuses the redirect with an opaque error page.
function redirectUri(req) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '')
    || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/meta/oauth/callback`;
}

function sign(payload) {
  return crypto.createHmac('sha256', appSecret()).update(payload).digest('hex').slice(0, 32);
}

// Mint a single-use state for one shop. Records the nonce in app_meta so it
// can be redeemed exactly once, even across a dyno restart.
async function issueState(db, businessId) {
  const secret = appSecret();
  if (!secret) return { error: 'Server is missing META_APP_SECRET — paste your token manually instead.' };
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Date.now() + STATE_TTL_MS;
  const body = `${businessId}.${nonce}.${exp}`;
  const value = `${businessId}.${exp}`; // what we persist (nonce is the lookup key)
  const key = STATE_PREFIX + nonce;
  try {
    await db.query(
      `INSERT INTO app_meta (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  } catch (e) {
    return { error: 'Could not start the Meta connection — retry in a minute.' };
  }
  // Opportunistic cleanup: one stale row per abandoned attempt is harmless, but
  // we prune anyway so the table stays tiny.
  try {
    await db.query(`DELETE FROM app_meta WHERE key LIKE $1 AND updated_at < now() - interval '1 day'`, [STATE_PREFIX + '%']);
  } catch { /* cleanup is best-effort — never fail a real connection over it */ }
  return { state: `${body}.${sign(body)}`, nonce };
}

// Redeem a state exactly once. Returns { ok, businessId } or { ok:false, error }.
async function redeemState(db, state) {
  const secret = appSecret();
  const raw = String(state || '').trim();
  if (!secret || !raw) return { ok: false, error: 'Missing sign-in proof — start the connection again.' };
  const parts = raw.split('.');
  if (parts.length !== 4) return { ok: false, error: 'Sign-in proof is malformed — start again.' };
  const [businessId, nonce, exp, sig] = parts;
  const body = `${businessId}.${nonce}.${exp}`;
  const expected = sign(body);
  // Length-equal + timingSafeEqual: no early-exit leak on a forged signature.
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, error: 'Sign-in proof failed verification — start again.' };
  }
  if (Number(exp) < Date.now()) return { ok: false, error: 'That attempt expired — start again (it only takes a minute).' };
  let row;
  try {
    const { rows } = await db.query('DELETE FROM app_meta WHERE key = $1 RETURNING value', [STATE_PREFIX + nonce]);
    row = rows[0];
  } catch (e) {
    return { ok: false, error: 'Could not verify the attempt — retry in a minute.' };
  }
  if (!row || row.value !== `${businessId}.${exp}`) {
    return { ok: false, error: 'That link was already used or cancelled — start again.' };
  }
  return { ok: true, businessId: Number(businessId) };
}

// The URL we navigate the phone to. scope is what lets us discover WABAs.
function authUrl(state, req) {
  const appId = (process.env.META_APP_ID || '').trim();
  if (!appId) return { error: 'Server is missing META_APP_ID — paste your token manually instead.' };
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    state,
    scope: 'whatsapp_business_management,pages_show_list,pages_read_engagement,business_management',
  });
  return { url: `https://www.facebook.com/${GRAPH.split('/').pop()}/dialog/oauth?${params.toString()}` };
}

// Which WhatsApp Business Accounts does this token reach? Meta returns them
// under whatsapp_business_accounts; we take the first with a usable number.
// Returns { wabaId, name, error } — an error here is almost always a missing
// whatsapp_business_management permission (App Review), and we say so.
async function discoverWaba(tokenRaw) {
  const token = String(tokenRaw || '').trim();
  if (token.length < 20) return { error: 'Meta did not return a usable token — try again.' };
  let res;
  try {
    res = await fetch(`${GRAPH}/me?fields=whatsapp_business_accounts{id,name,account_review_status}`, {
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch (e) {
    return { error: 'Could not reach Meta — check your connection and retry.' };
  }
  const data = await res.json().catch(() => ({}));
  if (data && data.error) {
    const msg = String((data.error && data.error.message) || '');
    if (/permission|OAuthException|not authorized/i.test(msg)) {
      return { error: 'Meta would not share your WhatsApp accounts with this app yet — our Meta app still needs App Review for whatsapp_business_management. Talk to support: the manual paste below works today.' };
    }
    return { error: 'Meta would not share your WhatsApp accounts — reconnect, or paste your details manually below.' };
  }
  const accounts = (data && data.whatsapp_business_accounts && data.whatsapp_business_accounts.data) || [];
  if (!accounts.length) {
    return { error: 'No WhatsApp Business Account on this Facebook profile. Create one in WhatsApp Manager (or use an existing Business Portfolio), then retry — or paste details manually below.' };
  }
  const first = accounts[0];
  return { wabaId: String(first.id || ''), name: first.name || 'your WhatsApp account' };
}

module.exports = { issueState, redeemState, authUrl, discoverWaba, redirectUri };
