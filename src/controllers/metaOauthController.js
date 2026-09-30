// ── src/controllers/metaOauthController.js ───────────────────────────
// WHAT: the two ends of the WhatsApp REDIRECT connection. start() hands the
// phone a real Meta OAuth URL to navigate to; callback() is where Meta sends
// the browser back, and it does the entire exchange server-side before
// bouncing the user into the app. Both live here (not in ownerController)
// because the callback has NO session — Meta's redirect is a fresh navigation
// and the proof of intent is the signed, single-use state, not a cookie.
// SECURITY: no Meta secret ever reaches the browser; the state is signed with
// META_APP_SECRET, expires in 10 minutes, and is destroyed on first use.

const db = require('../db');
const metaOauth = require('../services/channels/metaOAuth');
const meta = require('../services/channels/meta');

// GET /api/me/meta/oauth/start → { url } for the browser to open.
// Session required (ownerRoutes puts it behind the normal /me guard).
async function start(req, res) {
  const uri = metaOauth.redirectUri(req); // always echoed: a mismatched redirect URI is Meta's #1 config error and support needs the exact string
  try {
    const issued = await metaOauth.issueState(db, req.session.businessId);
    if (issued.error) return res.status(503).json({ error: issued.error, redirectUri: uri });
    const url = metaOauth.authUrl(issued.state, req);
    if (url.error) return res.status(503).json({ error: url.error, redirectUri: uri });
    res.json({ url, redirectUri: uri });
  } catch (e) {
    console.error('meta oauth start failed:', (e && e.code) || '-', e.message);
    res.status(500).json({ error: 'Could not start the Meta connection — retry in a minute.', redirectUri: uri });
  }
}

// GET /api/meta/oauth/callback?code&state (or ?error=…&error_description=…)
// Public by necessity. Always ends in a REDIRECT to the app — a JSON error in
// a browser tab is a dead end the user cannot act on.
function backToApp(req, res, params) {
  const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '')
    || (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '')
    || `${req.protocol}://${req.get('host')}`;
  const qs = new URLSearchParams(params).toString();
  return res.redirect(`${frontend}/connect${qs ? '?' + qs : ''}`);
}

async function callback(req, res) {
  const q = req.query || {};
  // Meta error params: user hit Cancel, or the app/redirect URI is misconfigured.
  if (q.error) {
    const denied = String(q.error) === 'access_denied';
    return backToApp(req, res, {
      meta: denied ? 'cancelled' : 'error',
      meta_reason: String(q.error_description || q.error).slice(0, 160),
    });
  }
  try {
    const redeemed = await metaOauth.redeemState(db, q.state);
    if (!redeemed.ok) return backToApp(req, res, { meta: 'error', meta_reason: redeemed.error });
    const ex = await meta.exchangeCode(q.code);
    if (ex.error) return backToApp(req, res, { meta: 'error', meta_reason: ex.error });
    const waba = await metaOauth.discoverWaba(ex.token);
    if (waba.error) return backToApp(req, res, { meta: 'error', meta_reason: waba.error });
    const listed = await meta.listWabaNumbers(waba.wabaId, ex.token);
    if (listed.error) return backToApp(req, res, { meta: 'error', meta_reason: listed.error });
    if (!listed.numbers.length) return backToApp(req, res, {
      meta: 'error',
      meta_reason: 'That WhatsApp Business Account has no phone numbers yet — add one in WhatsApp Manager, then reconnect.',
    });
    // Validate BEFORE storing (same guarantee as the manual/popup roads).
    const phone = listed.numbers[0];
    const checked = await meta.checkCredentials(phone.id, ex.token);
    if (checked.error) return backToApp(req, res, { meta: 'error', meta_reason: checked.error });
    const crypto = require('crypto');
    const { rows: shopRows } = await db.query(
      'SELECT meta_verify_token FROM businesses WHERE id = $1', [redeemed.businessId]
    );
    if (!shopRows.length) return backToApp(req, res, { meta: 'error', meta_reason: 'That shop no longer exists — sign in and try again.' });
    const verify = (shopRows[0].meta_verify_token || '').trim()
      || ('VND' + crypto.randomBytes(8).toString('hex').toUpperCase()); // keep an existing token: Meta may already be subscribed to it!
    await db.query(
      `UPDATE businesses SET meta_token = $1, meta_phone_number_id = $2, meta_waba_id = $3,
         meta_verify_token = $4, wa_channel = 'meta'
       WHERE id = $5`,
      [ex.token, phone.id, waba.wabaId, verify, redeemed.businessId]
    );
    require('../services/referralService').onFirstActive(redeemed.businessId)
      .catch((e) => console.error('referral reward error:', e.message)); // never breaks a connect
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
    return backToApp(req, res, {
      meta: 'linked',
      meta_phone: checked.phone || phone.display || '',
      meta_waba: waba.wabaId,
      meta_webhook: `${base}/webhook/whatsapp`,
      meta_verify: verify,
    });
  } catch (e) {
    console.error('meta oauth callback failed:', (e && e.code) || '-', e.message);
    return backToApp(req, res, { meta: 'error', meta_reason: 'Our server hit a snag finishing the connection — retry, or talk to support.' });
  }
}

module.exports = { start, callback };
