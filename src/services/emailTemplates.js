// ── src/services/emailTemplates.js ───────────────────────────────
// WHAT: every email VeloSales Ai sends, in ONE branded place. All templates share
// the same header (logo + name), button style and footer (support contact +
// app link), so the inbox always looks professional — no plain-text surprises.
// SENDING: Gmail SMTP first (no domain needed!), Resend second (needs a
// verified domain for real users). No mail configured → returns false
// (callers auto-verify in dev). LINKS: built from PUBLIC_BASE_URL (set it to
// the live URL on Render — localhost links die in real inboxes!).
// Logo served from /logo.png.
function baseUrl() {
  return (process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''); // env first (prod!), request host unknown here — never ship localhost links: set PUBLIC_BASE_URL on Render!
}

function supportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.SALES_EMAIL || 'velosales63@gmail.com'; // dedicated support inbox → sales fallback → default
}

function fromAddress() {
  return process.env.EMAIL_FROM || 'VeloSales Ai <onboarding@resend.dev>'; // Resend free sandbox default
}

// Shared shell: logo header, content, footer with contact. Inline styles only
// (email clients strip <style> tags — email HTML 101).
function layout({ title, intro, body, ctaLabel, ctaLink, foot }) {
  const base = baseUrl();
  const contact = supportEmail();
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;background:#f6faf8;border-radius:14px;overflow:hidden;">
      <div style="background:#075E54;padding:20px 24px;text-align:center;">
        <img src="${base}/logo-green.png?v=2" alt="VeloSales Ai" width="44" style="border-radius:10px;background:#fff;padding:3px;" />
        <div style="color:#ffffff;font-weight:800;letter-spacing:2px;font-size:15px;margin-top:8px;">VELOSALES AI</div>
        <div style="color:#b9e8d2;font-size:12px;">Your WhatsApp shop, open 24/7</div>
      </div>
      <div style="padding:26px 24px;">
        <h2 style="color:#0d1f16;margin:0 0 10px;">${title}</h2>
        <p style="color:#333;line-height:1.6;margin:0 0 14px;">${intro}</p>
        ${body || ''}
        ${ctaLabel && ctaLink ? `<p style="text-align:center;margin:24px 0;"><a href="${ctaLink}" style="background:#25D366;color:#04120c;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;">${ctaLabel}</a></p>` : ''}
        ${foot ? `<p style="color:#777;font-size:.85rem;line-height:1.6;">${foot}</p>` : ''}
      </div>
      <div style="background:#eef4f1;padding:14px 24px;text-align:center;color:#777;font-size:.78rem;line-height:1.7;">
        Need help? Write to <a href="mailto:${contact}" style="color:#075E54;">${contact}</a><br>
        <a href="${base}/login" style="color:#075E54;">Open VeloSales Ai</a> · <a href="${base}/help" style="color:#075E54;">Help center</a>
      </div>
    </div>`;
}

// Any mail path alive? (SMTP app-password OR Resend key — callers use this,
// never raw env checks, so adding a third provider later touches ONE line!)
function isMailConfigured() {
  try {
    if (require('./smtpMailer').isSmtpConfigured()) return true; // Gmail SMTP (no domain!)
  } catch {}
  return !!process.env.RESEND_API_KEY; // Resend (verified domain for real users!)
}

async function sendEmail({ to, subject, html }) { // single mail caller (all templates flow through here)…
  try { // SMTP first (works with zero domains!), Resend second…
    if (require('./smtpMailer').isSmtpConfigured()) {
      return await require('./smtpMailer').sendSMTP({ to, subject, html });
    }
  } catch (e) { console.error('SMTP path error:', e.message); } // SMTP blew up → fall THROUGH to Resend (never fail when a backup exists!)
  const key = process.env.RESEND_API_KEY;
  if (!key) return false; // nothing configured → "not sent" (callers decide: dev auto-verify, prod stays pending!)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, // Bearer = "here's my API key"
      body: JSON.stringify({ from: fromAddress(), to: [emailOf(to)], subject, html }), // to: is an ARRAY in Resend's API
    });
    if (!res.ok) { console.error('Resend send failed:', res.status, await res.text()); return false; }
    return true;
  } catch (e) { console.error('Resend send error:', e.message); return false; } // network down → false (never throw into signup/login!)
}

function emailOf(to) { return String(to || '').trim(); } // tiny guard (empty string → Resend 4xx → false, no crash)

// 1) Email confirmation (signup + "send a link instead" fallback).
async function sendVerificationEmail(email, token) {
  const link = `${baseUrl()}/api/auth/verify?token=${token}`; // the click-target: our own /verify route
  return sendEmail({
    to: email,
    subject: 'Confirm your email — VeloSales Ai',
    html: layout({
      title: 'Confirm your email',
      intro: 'Welcome aboard! One tap below verifies your email and activates your AI sales assistant.',
      ctaLabel: 'Verify my email', ctaLink: link,
      foot: `Or paste this link into your browser:<br>${link}<br><br>Didn't sign up? Ignore this email.`,
    }),
  });
}

// 2) OTP code (6 digits — code in SUBJECT so phone notifications show it!).
async function sendOTPEmail(email, code) {
  return sendEmail({
    to: email,
    subject: `${code} — your VeloSales Ai code`,
    html: layout({
      title: 'Your VeloSales Ai code',
      intro: 'Enter this code to verify your email:',
      body: `<div style="text-align:center;font-size:42px;font-weight:800;letter-spacing:12px;color:#0d1f16;margin:18px 0;">${code}</div>`,
      foot: 'Expires in 10 minutes. Didn\'t ask for this? Ignore it.',
    }),
  });
}

// 3) Password reset (1-hour link).
async function sendResetEmail(email, token) {
  const link = `${baseUrl()}/reset?token=${token}`; // the reset page route (frontend Reset.jsx reads ?token=)
  return sendEmail({
    to: email,
    subject: 'Reset your VeloSales Ai password',
    intro: 'Someone asked to reset this password — click below within 1 hour to set a new one.',
    ctaLabel: 'Set a new password', ctaLink: link,
    title: 'Reset your password',
    foot: `Or paste this link into your browser:<br>${link}<br><br>Didn't ask? Ignore it — your password stays.`,
  });
}

// 4) Welcome (sent right AFTER verification — the "you're in!" moment).
async function sendWelcomeEmail(email, name) {
  const first = String(name || '').split(' ')[0] || 'there';
  return sendEmail({
    to: email,
    subject: 'Welcome to VeloSales Ai — your shop never sleeps',
    html: layout({
      title: `Welcome, ${first}!`,
      intro: 'Your email is confirmed and your 7-day Pro trial is running. Three quick wins for tonight:',
      body: `<ol style="color:#333;line-height:1.9;margin:0 0 6px;padding-left:20px;">
        <li><b>Add 3–5 products</b> — the AI only quotes your catalog, never invents prices.</li>
        <li><b>Test like a customer</b> — open Test bot and ask for prices, then chaos.</li>
        <li><b>Connect WhatsApp</b> — one tap on the Connect page, TEST to LIVE in minutes.</li>
      </ol>`,
      ctaLabel: 'Open my dashboard', ctaLink: `${baseUrl()}/dashboard`,
      foot: 'Manual catalog stays free forever — Pro just adds automation. Reply to this email any time; a human reads it.',
    }),
  });
}

// 5) Inactivity nudge (winback script: quiet shops get ONE of these per 30 days).
async function sendInactiveEmail(email, name) {
  const first = String(name || '').split(' ')[0] || 'there';
  return sendEmail({
    to: email,
    subject: `${first}, your customers are still messaging…`,
    html: layout({
      title: 'We miss you (your customers do too)',
      intro: `It's been a while since you opened VeloSales Ai, ${first}. Your catalog and settings are exactly where you left them — pick up in seconds:`,
      body: `<ul style="color:#333;line-height:1.9;margin:0 0 6px;padding-left:20px;">
        <li><b>Unread chats</b> may be waiting in your inbox right now.</li>
        <li><b>One LEARN: message</b> from WhatsApp teaches the bot your newest stock.</li>
        <li><b>Still free</b> — your bot keeps replying from your manual catalog.</li>
      </ul>`,
      ctaLabel: 'Check my inbox', ctaLink: `${baseUrl()}/chats`,
      foot: 'Want out of these nudges? Reply “stop” and we\'ll only email receipts and security notices.',
    }),
  });
}

// 6) Support reply notice (admin answers a ticket → owner gets email + in-app reply).
function esc(s) { // email HTML escape (admin typing <script> can't break the email!)
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function sendTicketReplyEmail(email, subject, reply) {
  return sendEmail({
    to: email,
    subject: `Support replied: ${String(subject || 'your message').slice(0, 60)}`,
    html: layout({
      title: 'Support replied',
      intro: `On “${esc(String(subject || 'your message').slice(0, 80))}”:`,
      body: `<div style="background:#fff;border-left:4px solid #25D366;padding:12px 14px;color:#333;line-height:1.6;border-radius:0 8px 8px 0;">${esc(String(reply || '').slice(0, 1000))}</div>`,
      ctaLabel: 'View in Help', ctaLink: `${baseUrl()}/help`,
    }),
  });
}

module.exports = { baseUrl, supportEmail, sendEmail, isMailConfigured, sendVerificationEmail, sendOTPEmail, sendResetEmail, sendWelcomeEmail, sendInactiveEmail, sendTicketReplyEmail };
