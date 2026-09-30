// ── src/services/telegramSelfHeal.js ───────────────────────────────
// WHAT: the anti-"worked, then stopped" system for Telegram bots.
// A shop's webhook is registered ONCE at connect time, but hosting realities
// kill it silently afterwards: redeploys, changed PUBLIC_BASE_URL, server
// naps through Telegram's retries, manual deleteWebhook, BotFather tests.
// Before this module, NOTHING ever re-checked — the UI kept saying
// "connected" while Telegram knocked on a dead URL.
// HOW: healShop() re-reads getWebhookInfo and re-registers ONLY when the
// registered URL differs from the expected one (idempotent — healthy shops
// cost one read, zero writes). Boot heals every shop; the daily watchdog
// heals before it bells; the save flow fails LOUDLY instead of green-lying.
// No npm modules — fetch only, hard timeouts (a hung Telegram call must
// never stall boot or the watchdog round!).
const channelHealth = require('./channelHealth');
const tg = require('./channels/telegram');

function baseUrl() {
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

// Heal ONE webhook against an EXPECTED url (the unit of work — every caller,
// per-shop or shared, funnels through here). Returns
//   { ok, healed, kind, detail }:
//   ok=true, healed=false → already correct (one read, zero writes!)
//   ok=true, healed=true  → was broken, re-registered just now
//   ok=false              → token-level failure (revoked/bad/unreachable —
//                           re-registering can't help; owner must re-save!)
async function healHook(token, expected, label) {
  const clean = String(token || '').trim();
  if (!clean) return { ok: false, healed: false, kind: 'token', detail: 'no-token' };
  if (!expected) return { ok: false, healed: false, kind: 'config', detail: 'no-base-url' };
  const base = String(expected).replace(/\/webhook\/telegram\/.*$/, ''); // hook path stripped — setShopWebhook re-appends it
  let h;
  try {
    h = await channelHealth.telegramHealth(clean);
  } catch (e) {
    return { ok: false, healed: false, kind: 'hook', detail: String((e && e.message) || 'unreachable').slice(0, 120) };
  }
  if (h.reason === 'rejected' || h.reason === 'no-token') {
    return { ok: false, healed: false, kind: 'token', detail: h.reason }; // Telegram refuses this token outright (revoked/regenerated?) — setWebhook would 401 too, so don't bother!
  }
  if (h.url === expected && h.ok) return { ok: true, healed: false, kind: 'hook', detail: 'already-correct' };
  // Broken or limping (wrong URL, no URL, or Telegram-side delivery errors):
  // re-register WITHOUT dropping the queue (dropPending=false — a heal must
  // never silently delete real customer messages waiting in backlog!).
  const bizId = String(expected).split('/webhook/telegram/')[1];
  const set = await tg.setShopWebhook(clean, base, bizId, false);
  if (!set.ok) return { ok: false, healed: false, kind: 'hook', detail: set.detail };
  let re;
  try {
    re = await channelHealth.telegramHealth(clean);
  } catch (e) {
    return { ok: false, healed: false, kind: 'hook', detail: String((e && e.message) || 'unreachable').slice(0, 120) };
  }
  if (re.url === expected) {
    console.log(`TELEGRAM HEAL: ${label} hook restored (${h.url || 'none'} → ${expected})`);
    return { ok: true, healed: true, kind: 'hook', detail: re.lastError || 'restored' };
  }
  return { ok: false, healed: false, kind: 'hook', detail: `set-accepted-but-info-shows(${re.url || 'none'})` };
}

// Same, for a shop's own bot (URL built from PUBLIC_BASE_URL + shop id).
async function healShop(bizId, token, base) {
  if (!base) return { ok: false, healed: false, kind: 'config', detail: 'no-base-url' };
  return healHook(token, tg.shopHookUrl(base, bizId), `shop ${bizId}`);
}

// Heal EVERY shop with a saved token (boot + daily).
// Bounds matter more than speed here: this runs on a SHARED host, so a large
// fleet must not turn into a Telegram rate-limit burst, and a dead network
// must never let one round eat the whole budget. Four workers, a 300ms beat
// between starts, and a hard deadline — whatever is left over is simply
// picked up by the next round (the daily watchdog is the safety net).
// Returns { checked, healed, skipped, broken: [{ bizId, kind, detail }] }.
const HEAL_WORKERS = 4; // parallel probes (Telegram is fine with a small pool!)
const HEAL_BEAT_MS = 300; // gap between starting probes (politeness)
const HEAL_BUDGET_MS = 90 * 1000; // hard deadline for one full round

async function healAllShops(db) {
  const base = baseUrl();
  if (!base) {
    console.warn('TELEGRAM HEAL: skipped — PUBLIC_BASE_URL missing (hooks cannot be verified without the canonical host!).');
    return { checked: 0, healed: 0, skipped: 0, broken: [] };
  }
  let rows = [];
  try {
    ({ rows } = await db.query(
      "SELECT id, telegram_bot_token FROM businesses WHERE telegram_bot_token <> ''"
    ));
  } catch (e) {
    console.error('TELEGRAM HEAL: shop list failed:', e.message);
    return { checked: 0, healed: 0, skipped: 0, broken: [] };
  }
  const deadline = Date.now() + HEAL_BUDGET_MS;
  const queue = rows.slice();
  let healed = 0;
  let checked = 0;
  const broken = [];
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const s = queue.shift();
      try {
        const r = await healShop(s.id, s.telegram_bot_token, base);
        checked++;
        if (r.healed) healed++;
        else if (!r.ok) broken.push({ bizId: s.id, kind: r.kind, detail: r.detail });
      } catch (e) {
        checked++;
        broken.push({ bizId: s.id, kind: 'hook', detail: String((e && e.message) || 'error').slice(0, 120) });
      }
      await new Promise((r) => setTimeout(r, HEAL_BEAT_MS));
    }
  };
  await Promise.all(Array.from({ length: Math.min(HEAL_WORKERS, Math.max(rows.length, 1)) }, worker));
  const skipped = queue.length;
  if (skipped) console.warn(`TELEGRAM HEAL: ${skipped} shop(s) not reached this round (budget) — the daily round picks them up.`);
  console.log(`TELEGRAM HEAL: ${checked} shops checked, ${healed} hooks restored, ${broken.length} still broken.`);
  return { checked, healed, skipped, broken };
}

module.exports = { healHook, healShop, healAllShops, baseUrl };
