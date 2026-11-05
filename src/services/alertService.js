// ── src/services/alertService.js ───────────────────────────────────
// WHAT: tells the owner of VeloSales (not shop owners) when the server breaks:
// crashes, unhandled promise errors, 500s from the API, and webhook failures.
// Where it goes (any that are set):
//   ALERT_EMAIL (falls back to SUPPORT_EMAIL) → an email per new problem
//   ALERT_TELEGRAM_CHAT_ID + TELEGRAM_SHARED_BOT_TOKEN → a Telegram message
// Quiet by design: the same problem alerts at most once an hour, and never
// more than ALERT_MAX_PER_HOUR (default 12) alerts in total per hour. Never
// throws, never blocks a request, never includes secrets or customer messages.

const WINDOW_MS = 60 * 60 * 1000;
const seen = new Map(); // signature → last alert time
let sentTimes = [];

function maxPerHour() { return Math.max(1, Number(process.env.ALERT_MAX_PER_HOUR) || 12); }

// Strip anything that looks like a key, token or long number before it leaves the server.
function scrub(text) {
  return String(text == null ? '' : text)
    .replace(/bot\d+:[\w-]+/g, 'bot<token>')
    .replace(/\b(sk|pk|rk)_(live|test)_[\w]+/gi, '<key>')
    .replace(/(Bearer\s+)[\w.-]+/gi, '$1<token>')
    .replace(/(key|token|secret|password)=([^&\s]+)/gi, '$1=<hidden>')
    .replace(/\b[A-Za-z0-9+/_-]{40,}={0,2}/g, '<long-value>')
    .slice(0, 3000);
}

function signature(kind, err) {
  const msg = (err && err.message) || String(err || '');
  const frame = (err && err.stack ? String(err.stack).split('\n')[1] || '' : '').trim();
  return `${kind}|${msg.slice(0, 160)}|${frame.slice(0, 160)}`;
}

// Decide whether this alert may go out now (dedupe + hourly cap). Exported for tests.
function shouldSend(sig, now = Date.now()) {
  sentTimes = sentTimes.filter((t) => now - t < WINDOW_MS);
  const last = seen.get(sig);
  if (last && now - last < WINDOW_MS) return false;
  if (sentTimes.length >= maxPerHour()) return false;
  seen.set(sig, now);
  sentTimes.push(now);
  if (seen.size > 500) for (const [k, t] of seen) if (now - t >= WINDOW_MS) seen.delete(k);
  return true;
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function deliver(subject, body) {
  const jobs = [];
  const to = (process.env.ALERT_EMAIL || process.env.SUPPORT_EMAIL || '').trim();
  if (to) {
    jobs.push(require('./emailTemplates').sendEmail({
      to, subject,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#0B132B"><p><b>${esc(subject)}</b></p><pre style="white-space:pre-wrap;background:#f4f4f6;padding:12px;border-radius:8px;font-size:12.5px">${esc(body)}</pre><p style="color:#3A506B;font-size:12px">The same problem will not alert again for an hour. Full details are in the Render logs.</p></div>`,
    }).catch(() => false));
  }
  const chat = (process.env.ALERT_TELEGRAM_CHAT_ID || '').trim();
  const bot = (process.env.TELEGRAM_SHARED_BOT_TOKEN || '').trim();
  if (chat && bot) jobs.push(require('./channels/telegram').sendText(bot, chat, `${subject}\n\n${body}`.slice(0, 3900)).catch(() => false));
  if (!jobs.length) return false;
  const results = await Promise.all(jobs);
  return results.some(Boolean);
}

// report('api-500', err, { path: '/api/me/orders' }) → fire-and-forget.
function report(kind, err, ctx) {
  try {
    if (process.env.NODE_ENV === 'test' || process.env.ALERTS_OFF === '1') return Promise.resolve(false);
    const sig = signature(kind, err);
    if (!shouldSend(sig)) return Promise.resolve(false);
    const where = ctx && typeof ctx === 'object' ? Object.entries(ctx).map(([k, v]) => `${k}: ${v}`).join('\n') : '';
    const stack = err && err.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : String(err || '');
    const subject = `VeloSales alert: ${kind}`;
    const body = scrub(`${new Date().toISOString()}\n${where ? where + '\n' : ''}\n${stack}`);
    return deliver(subject, body).catch(() => false);
  } catch (e) {
    return Promise.resolve(false);
  }
}

// Process-wide safety nets. A stray rejected promise is logged and alerted
// but does not take the server down; a real crash alerts, then exits so
// Render restarts a clean process.
function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise error:', reason);
    report('unhandled-promise', reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    console.error('Server crash:', err);
    const done = () => process.exit(1);
    const t = setTimeout(done, 4000);
    Promise.resolve(report('crash', err)).finally(() => { clearTimeout(t); done(); });
  });
}

module.exports = { report, installProcessHandlers, scrub, shouldSend, _reset: () => { seen.clear(); sentTimes = []; } };
