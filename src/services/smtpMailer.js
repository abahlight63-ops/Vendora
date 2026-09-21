// ── src/services/smtpMailer.js ─────────────────────────────────────
// WHAT: send email through any SMTP server (Gmail default) with ZERO new
// dependencies — raw protocol over Node built-ins (net + tls + crypto).
// WHY: Resend's free sandbox only delivers to YOUR OWN inbox until you verify
// a domain you own. Gmail SMTP (free, app password, no domain) delivers to
// real users TODAY; flip to Resend later by unsetting the SMTP vars.
// ENV: EMAIL_SMTP_HOST (smtp.gmail.com), EMAIL_SMTP_PORT (587),
//   EMAIL_SMTP_USER (you@gmail.com), EMAIL_SMTP_PASS (16-char app password),
//   EMAIL_FROM (optional display name+address, defaults to the SMTP user).
// Get the app password: Google Account → Security → 2-Step Verification →
// App passwords → generate → paste (spaces don't matter, we strip them).
// No npm modules — net + tls + crypto only.
const net = require('net'); // plain TCP (greeting + EHLO + STARTTLS handshake)
const tls = require('tls'); // encrypted channel after STARTTLS (credentials NEVER travel plain!)

function smtpConfig() {
  const host = (process.env.EMAIL_SMTP_HOST || '').trim();
  const user = (process.env.EMAIL_SMTP_USER || '').trim();
  const pass = (process.env.EMAIL_SMTP_PASS || '').replace(/\s/g, ''); // app passwords shown spaced ("abcd efgh…") — spaces are NOT part of it!
  if (!host || !user || !pass) return null; // all three or nothing (partial config = misconfigured = treat as off!)
  return { host, port: Number(process.env.EMAIL_SMTP_PORT || 587), user, pass };
}

function isSmtpConfigured() {
  return !!smtpConfig();
}

// Line reader: resolves { code, lines } for one SMTP reply (handles 250-… multiline!).
function readReply(sock, buf, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('SMTP timeout')), timeoutMs || 15000);
    const onData = (chunk) => {
      buf.s += chunk.toString('utf8');
      const lines = buf.s.split('\r\n');
      buf.s = lines.pop(); // keep the incomplete tail for next time
      for (const ln of lines) {
        const m = ln.match(/^(\d{3})([ -])(.*)$/); // "250-…" continues, "250 …" ends (that's the RFC!)
        if (m && m[2] === ' ') {
          clearTimeout(t);
          sock.removeListener('data', onData);
          resolve({ code: Number(m[1]), text: ln });
          return;
        }
      }
    };
    sock.on('data', onData);
  });
}

function sendCmd(sock, buf, cmd, expect2xx) {
  return new Promise((resolve, reject) => {
    sock.write(cmd + '\r\n');
    readReply(sock, buf, 15000).then((r) => {
      if (expect2xx && (r.code < 200 || r.code >= 300)) reject(new Error(`SMTP rejected: ${r.code} ${r.text}`));
      else resolve(r);
    }, reject);
  });
}

function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64'); // AUTH LOGIN credentials ride base64 (inside TLS — opaque on the wire!)
}

function mimeSubject(s) {
  const t = String(s || '');
  return /^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64(t)}?=`; // pure ASCII → plain; anything else (₦, —) → RFC2047 base64 word
}

/**
 * Send one HTML email. Returns true on 250 Queued, false otherwise (never
 * throws into signup/login — callers treat false as "not sent").
 */
async function sendSMTP({ to, subject, html }) {
  const cfg = smtpConfig();
  if (!cfg) return false; // not configured (caller falls back to Resend!)
  const dest = String(to || '').trim();
  if (!dest) return false; // no recipient (guard — never open an SMTP session for nothing!)
  const fromAddr = cfg.user; // envelope sender = the account itself (Gmail rewrites mismatched From anyway!)
  const fromHeader = process.env.EMAIL_FROM && process.env.EMAIL_FROM.trim()
    ? process.env.EMAIL_FROM.trim() // custom display (works once Gmail "Send As" is set; harmless otherwise!)
    : `VeloSales Ai <${cfg.user}>`;
  // Base64 body: no dot-stuffing worries (base64 alphabet has no leading dots)
  // and 8-bit chars (₦, —, “[”) survive every relay untouched.
  const lines = [
    `From: ${fromHeader}`,
    `To: ${dest}`,
    `Subject: ${mimeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    ...b64(html).match(/.{1,76}/g), // 76-char wraps (RFC line limit!)
  ];
  const message = lines.join('\r\n');
  let sock = null;
  try {
    sock = net.connect(cfg.port, cfg.host);
    await new Promise((resolve, reject) => { // wait for connect OR fail fast (no hanging signups!)
      const t = setTimeout(() => reject(new Error('SMTP connect timeout')), 15000);
      sock.once('connect', () => { clearTimeout(t); resolve(); });
      sock.once('error', (e) => { clearTimeout(t); reject(e); });
    });
    const buf = { s: '' };
    const hello = await readReply(sock, buf, 15000); // server greeting (220 …)
    if (hello.code !== 220) throw new Error(`SMTP greeting: ${hello.code}`);
    const ehlo1 = await sendCmd(sock, buf, `EHLO velosalesai`, true); // introduce ourselves (hostname needn't be real!)
    void ehlo1;
    const tlsCapable = true; // port 587 = STARTTLS expected (Gmail REQUIRES it!)
    if (tlsCapable) {
      const st = await sendCmd(sock, buf, 'STARTTLS', false);
      if (st.code !== 220) throw new Error('SMTP STARTTLS refused');
      sock = tls.connect({ socket: sock, servername: cfg.host }); // UPGRADE the same socket (credentials never travel plain!)
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('TLS timeout')), 15000);
        sock.once('secureConnect', () => { clearTimeout(t); resolve(); });
        sock.once('error', (e) => { clearTimeout(t); reject(e); });
      });
      const buf2 = { s: '' };
      await sendCmd(sock, buf2, `EHLO velosalesai`, true); // re-introduce (RFC: EHLO again after TLS!)
      await sendCmd(sock, buf2, 'AUTH LOGIN', false); // AUTH LOGIN = two base64 prompts (username, then password)…
      await sendCmd(sock, buf2, b64(cfg.user), false);
      const auth = await sendCmd(sock, buf2, b64(cfg.pass), false);
      if (auth.code !== 235) throw new Error('SMTP auth failed — check EMAIL_SMTP_USER/PASS (app password, not login password!)');
      await sendCmd(sock, buf2, `MAIL FROM:<${fromAddr}>`, true);
      const rcpt = await sendCmd(sock, buf2, `RCPT TO:<${dest}>`, false);
      if (rcpt.code !== 250 && rcpt.code !== 251) throw new Error('SMTP recipient refused');
      await sendCmd(sock, buf2, 'DATA', false); // "354 …" = start the message…
      await sendCmd(sock, buf2, message + '\r\n.', true); // …end with <CRLF>.<CRLF> (the dot line!)
      try { await sendCmd(sock, buf2, 'QUIT', false); } catch {} // polite goodbye (failure here = already sent, ignore!)
    }
    return true; // 250 Queued somewhere above (sendCmd throws otherwise!)
  } catch (e) {
    console.error('SMTP send failed:', e.message);
    return false;
  } finally {
    try { sock && sock.destroy(); } catch {} // always close (no leaked sockets on failure paths!)
  }
}

module.exports = { smtpConfig, isSmtpConfigured, sendSMTP };
