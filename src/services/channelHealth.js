// ── src/services/channelHealth.js ────────────────────────────────
// WHAT: lifeline checks for every shop's channels (the anti-silent-death
// system). Two probes, both live, both read-only:
//   telegram: getWebhookInfo (hook URL set? last error? pending backlog?)
//   meta:      GET the stored phone_number_id (token alive? number still there?)
// No npm modules — fetch with hard timeouts (a hung probe must never stall
// the admin console; allSettled upstream means one slow shop never blocks!).
const FETCH_MS = 8000; // per-probe cap (slow networks get 8s, then we call it dead!)

async function timed(url, opts) { // fetch with an 8s guillotine (AbortController!)
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const r = await fetch(url, { ...(opts || {}), signal: ctrl.signal });
    return { res: r, data: await r.json().catch(() => ({})) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Telegram lifeline for one bot token.
 * Returns { ok, url, pending, lastError } — ok=false covers bad token,
 * no webhook, and Telegram-side errors (all look the same to a shop!).
 */
async function telegramHealth(token) {
  if (!token) return { ok: false, reason: 'no-token' };
  try {
    const { res, data } = await timed(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getWebhookInfo`
    );
    if (!res.ok || !data || data.ok !== true || !data.result) {
      return { ok: false, reason: 'rejected' };
    }
    const info = data.result;
    return {
      ok: !!(info.url && !info.last_error_date),
      url: info.url || '',
      pending: Number(info.pending_update_count) || 0,
      lastError: info.last_error_message
        ? `${info.last_error_message} (${info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleDateString('en-GB') : 'date?'})`
        : '',
    };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

/**
 * Meta lifeline for one stored phone_number_id + token.
 * Returns { ok, phone } — a dead/expired token (goodbye 24h temp token!)
 * fails closed as ok:false, which is exactly the bell we want to ring.
 */
async function metaHealth(phoneId, token) {
  if (!phoneId || !token) return { ok: false, reason: 'not-connected' };
  try {
    const { res, data } = await timed(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneId)}?fields=display_phone_number`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!res.ok || (data && data.error)) return { ok: false, reason: 'token-dead' };
    return { ok: true, phone: (data && data.display_phone_number) || '' };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

module.exports = { telegramHealth, metaHealth };
