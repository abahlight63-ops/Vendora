// ── src/services/emailTemplates.js ───────────────────────────────
// WHAT: every email VeloSales Ai sends, in ONE branded place. All templates
// share the same shell (logo header, brand button, copy-friendly code box,
// Maitama footer), so the inbox always looks like the app — never plain text.
// SENDING: Resend ONLY (FROM address must sit on your VERIFIED Resend domain
// or Resend 400/403s — see the hint in the Resend-fail log below). Gmail SMTP
// is retired (no creds configured → smtpMailer stays dormant). No mail
// configured → returns false (callers auto-verify in dev). LINKS: built from PUBLIC_BASE_URL (set it to the live
// URL on Render — localhost links die in real inboxes!). Logo: /logo.png.
// No npm modules — fetch (Resend API) + local smtpMailer only.
const db = require('../db'); // owner lookups for lifecycle emails (no cycle: db never requires us!)

function baseUrl() {
  return (process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''); // env first (prod!), request host unknown here — never ship localhost links: set PUBLIC_BASE_URL on Render!
}

function supportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.SALES_EMAIL || 'velosales63@gmail.com'; // dedicated support inbox → sales fallback → default
}

function fromAddress() {
  return process.env.EMAIL_FROM || 'VeloSales Ai <hello@support.velosalesai.com.ng>'; // verified-subdomain default (must match a VERIFIED Resend domain!)
}

function mailFromDomain() { // domain part of EMAIL_FROM (for boot logs + mismatch hints — domain only, never the full address!)
  const m = /@([^>\s]+)/.exec(fromAddress() || '');
  return m ? m[1].toLowerCase() : '';
}

function brandAddress() {
  return 'Maitama, Abuja FCT, Nigeria'; // single source: every footer reads this (user asked: brand it!)
}

// Shop owner contact for lifecycle emails (first user on the business = owner).
async function ownerContact(businessId) {
  try {
    const { rows } = await db.query(
      `SELECT u.email, b.name FROM users u JOIN businesses b ON b.id = u.business_id
       WHERE u.business_id = $1 ORDER BY u.id ASC LIMIT 1`,
      [Number(businessId) || 0]
    );
    if (!rows[0] || !rows[0].email) return null;
    return { email: rows[0].email, name: rows[0].name || '' };
  } catch (e) {
    console.error('owner contact lookup failed:', e.message);
    return null;
  }
}

function money(major, currency) { // 7499 + NGN → ₦7,499 (Intl grouping, no decimals for whole naira/dollars!)
  const n = Number(major) || 0;
  const sym = String(currency || 'NGN').toUpperCase() === 'USD' ? '$' : '₦';
  return sym + Math.round(n).toLocaleString('en-NG');
}

// Email HTML escape (user/admin-typed strings can never break the markup!).
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Shared shell: preheader + logo header + content + code box + receipt rows +
// CTA button + brand footer. Inline styles only (clients strip <style>).
// opts: { preheader, title, intro, body, code, codeLabel, codeHint, rows,
//         ctaLabel, ctaLink, foot }
function layout(o) {
  const base = baseUrl();
  const contact = supportEmail();
  const year = new Date().getFullYear();
  const rows = Array.isArray(o.rows) && o.rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#ffffff;border:1px solid #e3efe9;border-radius:12px;margin:6px 0 14px;border-collapse:separate;border-spacing:0;overflow:hidden;">${
      o.rows.map(([k, v], i) => `<tr>
        <td style="padding:11px 14px;color:#667085;font-size:13px;${i ? 'border-top:1px solid #eef4f1;' : ''}">${esc(k)}</td>
        <td align="right" style="padding:11px 14px;color:#0d1f16;font-size:13px;font-weight:700;${i ? 'border-top:1px solid #eef4f1;' : ''}">${esc(v)}</td>
      </tr>`).join('')
    }</table>`
    : '';
  const code = o.code
    ? `<div style="margin:20px 0;padding:20px 12px;background:#ffffff;border:2px dashed #128c4a;border-radius:14px;text-align:center;">
        <div style="font-size:11px;color:#667085;letter-spacing:3px;margin-bottom:8px;">${esc(o.codeLabel || 'YOUR CODE')}</div>
        <div style="font-size:44px;font-weight:800;letter-spacing:14px;color:#0d1f16;user-select:all;-webkit-user-select:all;">${esc(o.code)}</div>
        <div style="font-size:12px;color:#667085;margin-top:8px;">${esc(o.codeHint || 'Tap and hold the code to copy it')}</div>
      </div>`
    : '';
  return `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader || o.intro || '')}</div>
  <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#f6faf8;border-radius:16px;overflow:hidden;color:#0d1f16;">
    <div style="background:#075E54;padding:22px 24px;text-align:center;">
      <img src="${base}/logo.png" alt="VeloSales Ai" width="48" style="border-radius:12px;background:#ffffff;padding:4px;display:block;margin:0 auto;" />
      <div style="color:#ffffff;font-weight:800;letter-spacing:3px;font-size:15px;margin-top:10px;">VELOSALES AI</div>
      <div style="color:#b9e8d2;font-size:12px;margin-top:2px;">Your WhatsApp shop, open 24/7</div>
    </div>
    <div style="padding:28px 26px;">
      <h2 style="color:#0d1f16;margin:0 0 10px;font-size:22px;">${o.title}</h2>
      <p style="color:#333333;line-height:1.65;margin:0 0 14px;font-size:14.5px;">${o.intro}</p>
      ${code}
      ${rows}
      ${o.body || ''}
      ${o.ctaLabel && o.ctaLink ? `<p style="text-align:center;margin:26px 0 8px;"><a href="${o.ctaLink}" style="background:#25D366;color:#04120c;padding:14px 30px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px;display:inline-block;">${esc(o.ctaLabel)}</a></p>` : ''}
      ${o.foot ? `<p style="color:#667085;font-size:12.5px;line-height:1.7;margin:16px 0 0;">${o.foot}</p>` : ''}
    </div>
    <div style="background:#eef4f1;padding:16px 24px;text-align:center;color:#667085;font-size:12px;line-height:1.8;">
      VeloSales Ai · ${esc(brandAddress())}<br>
      Need help? Write to <a href="mailto:${contact}" style="color:#075E54;font-weight:700;">${contact}</a><br>
      <a href="${base}/login" style="color:#075E54;">Open app</a> · <a href="${base}/billing" style="color:#075E54;">Billing</a> · <a href="${base}/help" style="color:#075E54;">Help center</a><br>
      <span style="color:#98a9a0;">© ${year} VeloSales Ai. You got this because you have an account with us.</span>
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
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Resend send failed: ${res.status} ${String(detail).slice(0, 300)} — hint: EMAIL_FROM domain (${mailFromDomain()}) must equal a domain verified in your Resend dashboard (subdomains need their own verification), and RESEND_API_KEY must be a live key.`);
      return false;
    }
    return true;
  } catch (e) { console.error('Resend send error:', e.message); return false; } // network down → false (never throw into signup/login!)
}

function emailOf(to) { return String(to || '').trim(); } // tiny guard (empty string → Resend 4xx → false, no crash)

function first(name) { return String(name || '').split(' ')[0] || 'there'; }

// 1) Email confirmation (signup + "send a link instead" fallback).
async function sendVerificationEmail(email, token) {
  const link = `${baseUrl()}/api/auth/verify?token=${token}`; // the click-target: our own /verify route
  return sendEmail({
    to: email,
    subject: 'Confirm your email — VeloSales Ai',
    html: layout({
      preheader: 'One tap verifies your email and activates your shop.',
      title: 'Confirm your email',
      intro: 'Welcome aboard! One tap below verifies your email and activates your AI sales assistant.',
      ctaLabel: 'Verify my email', ctaLink: link,
      foot: `Or paste this link into your browser:<br>${esc(link)}<br><br>Didn't sign up? Ignore this email.`,
    }),
  });
}

// 2) OTP code (6 digits — code in SUBJECT so phone notifications show it + big copy box!).
async function sendOTPEmail(email, code) {
  return sendEmail({
    to: email,
    subject: `${code} — your VeloSales Ai code`,
    html: layout({
      preheader: `Your verification code is ${code}. It expires in 10 minutes.`,
      title: 'Your verification code',
      intro: 'Enter this code in the app to verify your email:',
      code: String(code).trim(), codeLabel: 'YOUR CODE', codeHint: 'Tap and hold the code to copy it · expires in 10 minutes',
      foot: 'Didn\'t ask for this? Ignore it — your account stays safe.',
    }),
  });
}

// 3) Password reset (1-hour link).
async function sendResetEmail(email, token) {
  const link = `${baseUrl()}/reset?token=${token}`; // the reset page route (frontend Reset.jsx reads ?token=)
  return sendEmail({
    to: email,
    subject: 'Reset your VeloSales Ai password',
    html: layout({
      preheader: 'Set a new password within 1 hour.',
      title: 'Reset your password',
      intro: 'Someone asked to reset this password — click below within 1 hour to set a new one.',
      ctaLabel: 'Set a new password', ctaLink: link,
      foot: `Or paste this link into your browser:<br>${esc(link)}<br><br>Didn't ask? Ignore it — your password stays.`,
    }),
  });
}

// 4) Welcome (sent right AFTER verification — the "you're in!" moment).
async function sendWelcomeEmail(email, name) {
  return sendEmail({
    to: email,
    subject: 'Welcome to VeloSales Ai — your shop never sleeps',
    html: layout({
      preheader: 'Your 7-day Pro trial is running. Three quick wins inside.',
      title: `Welcome, ${esc(first(name))}!`,
      intro: 'Your email is confirmed and your 7-day Pro trial is running. Three quick wins for tonight:',
      body: `<ol style="color:#333333;line-height:1.9;margin:0 0 6px;padding-left:20px;font-size:14.5px;">
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
  return sendEmail({
    to: email,
    subject: `${esc(first(name))}, your customers are still messaging…`,
    html: layout({
      preheader: 'Your catalog and settings are exactly where you left them.',
      title: 'We miss you (your customers do too)',
      intro: `It's been a while since you opened VeloSales Ai, ${esc(first(name))}. Your catalog and settings are exactly where you left them — pick up in seconds:`,
      body: `<ul style="color:#333333;line-height:1.9;margin:0 0 6px;padding-left:20px;font-size:14.5px;">
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
async function sendTicketReplyEmail(email, subject, reply) {
  return sendEmail({
    to: email,
    subject: `Support replied: ${String(subject || 'your message').slice(0, 60)}`,
    html: layout({
      preheader: 'Our support team just answered your message.',
      title: 'Support replied',
      intro: `On “${esc(String(subject || 'your message').slice(0, 80))}”:`,
      body: `<div style="background:#ffffff;border-left:4px solid #25D366;padding:12px 14px;color:#333333;line-height:1.65;border-radius:0 8px 8px 0;font-size:14.5px;">${esc(String(reply || '').slice(0, 1000))}</div>`,
      ctaLabel: 'View in Help', ctaLink: `${baseUrl()}/help`,
    }),
  });
}

// 7) Trial ending (2 days left — sent once by the trial watchdog).
async function sendTrialEnding(email, name, daysLeft) {
  const n = Number(daysLeft) || 2;
  return sendEmail({
    to: email,
    subject: `Your Pro trial ends in ${n} day${n === 1 ? '' : 's'} — VeloSales Ai`,
    html: layout({
      preheader: `Keep profile sync, photos and premium AIs — pick a plan before day ${n}.`,
      title: `${n} day${n === 1 ? '' : 's'} left on Pro`,
      intro: `Hi ${esc(first(name))}, your 7-day Pro trial ends in ${n} day${n === 1 ? '' : 's'}. After that your bot keeps replying free forever — but profile sync, product photos in replies and premium AI brains switch off.`,
      ctaLabel: 'Keep Pro on', ctaLink: `${baseUrl()}/billing`,
      foot: 'Prefer free? Do nothing — your catalog, inbox and history stay yours.',
    }),
  });
}

// 8) Trial ended (sent once when the watchdog flips the account to free).
async function sendTrialEnded(email, name) {
  return sendEmail({
    to: email,
    subject: 'Your Pro trial ended — free plan is on',
    html: layout({
      preheader: 'Your bot keeps replying free. Switch Pro back on any time.',
      title: 'Trial over — you’re on Free',
      intro: `Hi ${esc(first(name))}, your Pro trial just ended. Nothing broke: your catalog, inbox and history are intact and your bot keeps replying from your manual catalog, free forever.`,
      ctaLabel: 'See Pro plans', ctaLink: `${baseUrl()}/billing`,
      foot: 'Come back to Pro any day — one card payment switches everything back on instantly.',
    }),
  });
}

// 9) Payment successful (card webhook activated the plan — receipt included!).
// amountMajor = e.g. 7499 (naira) or 5 (dollars); currency = NGN|USD.
async function sendPaymentSuccess(email, name, { plan, amountMajor, currency, reference, days } = {}) {
  return sendEmail({
    to: email,
    subject: `Payment confirmed — ${plan || 'Pro'} is active`,
    html: layout({
      preheader: `Your ${plan || 'Pro'} plan is active. Receipt inside.`,
      title: 'Payment confirmed',
      intro: `Hi ${esc(first(name))}, your payment went through and <b>${esc(plan || 'Pro')}</b> is active on your shop. Welcome back to full power!`,
      rows: [
        ['Plan', plan || 'Pro'],
        ['Amount paid', money(amountMajor, currency)],
        ['Duration', `${Number(days) || 30} days`],
        ['Reference', String(reference || '—').slice(0, 40)],
      ],
      ctaLabel: 'Open my dashboard', ctaLink: `${baseUrl()}/dashboard`,
      foot: 'Keep this email as your receipt. Questions about billing? Reply here — a human reads it.',
    }),
  });
}

// 10) Payment failed (card declined / abandoned — gentle recovery, no shame!).
async function sendPaymentFailed(email, name, { plan, amountMajor, currency, reason } = {}) {
  return sendEmail({
    to: email,
    subject: `Your ${plan || 'Pro'} payment didn't go through`,
    html: layout({
      preheader: 'No charge was made. Try again in one tap.',
      title: 'Payment didn’t go through',
      intro: `Hi ${esc(first(name))}, we couldn't complete your ${esc(plan || 'Pro')} payment${amountMajor ? ` of <b>${esc(money(amountMajor, currency))}</b>` : ''} — <b>no money left your account</b>. The usual culprits: expired card, bank decline, or a dropped connection.`,
      rows: reason ? [['What happened', String(reason).slice(0, 120)]] : [],
      ctaLabel: 'Try again', ctaLink: `${baseUrl()}/billing`,
      foot: 'Still stuck? Reply to this email with the last 4 digits of your card and we’ll sort it out. Bank transfer retirees: card is now the only checkout.',
    }),
  });
}

// 11) Password changed (security notice — if it wasn't you, act fast!).
async function sendPasswordChanged(email, name) {
  return sendEmail({
    to: email,
    subject: 'Your VeloSales Ai password was changed',
    html: layout({
      preheader: 'If this was you, ignore this. If not, reset immediately.',
      title: 'Password changed',
      intro: `Hi ${esc(first(name))}, your VeloSales Ai password was just changed. If this was you, ignore this email — you're all set.`,
      ctaLabel: 'Secure my account', ctaLink: `${baseUrl()}/reset`,
      foot: 'Wasn\'t you? Click above to set a new password right now, then reply to this email so we can lock things down.',
    }),
  });
}

// 12) Support ticket received (instant acknowledgement with the subject echoed).
async function sendSupportReceived(email, name, subject) {
  return sendEmail({
    to: email,
    subject: 'We got your message — VeloSales Ai support',
    html: layout({
      preheader: 'A human will reply. Track it in Help.',
      title: 'Message received',
      intro: `Thanks ${esc(first(name))} — your message “${esc(String(subject || 'support request').slice(0, 80))}” landed safely. A human reads every ticket and you'll get an email the moment we reply.`,
      ctaLabel: 'Track in Help', ctaLink: `${baseUrl()}/help`,
      foot: 'Urgent and can\'t wait? Reply to this email with “URGENT” first — it jumps our queue.',
    }),
  });
}

// 13) Complaint resolved (the loop closed — trust builder!).
async function sendComplaintResolved(email, name, subject) {
  return sendEmail({
    to: email,
    subject: 'Resolved: your VeloSales Ai report',
    html: layout({
      preheader: 'Your report is resolved. Tell us if it isn’t.',
      title: 'All sorted',
      intro: `Hi ${esc(first(name))}, your report “${esc(String(subject || 'your report').slice(0, 80))}” is now resolved. If anything still looks off, just reply — the same human picks it back up.`,
      ctaLabel: 'Open my dashboard', ctaLink: `${baseUrl()}/dashboard`,
      foot: 'Happy with the fix? Refer a fellow shop owner — you both earn free Pro days.',
    }),
  });
}

// 14) Manual transfer approved (bank-transfer era approvals — kept for history!).
async function sendTransferApproved(email, name, { plan, days } = {}) {
  return sendEmail({
    to: email,
    subject: `Payment approved — ${plan || 'Pro'} is active`,
    html: layout({
      preheader: 'Your transfer was confirmed. Enjoy your plan.',
      title: 'Transfer approved',
      intro: `Hi ${esc(first(name))}, we confirmed your transfer and <b>${esc(plan || 'Pro')}</b> is now active for ${Number(days) || 30} days. Thank you for growing with us!`,
      rows: [['Plan', plan || 'Pro'], ['Duration', `${Number(days) || 30} days`]],
      ctaLabel: 'Open my dashboard', ctaLink: `${baseUrl()}/dashboard`,
    }),
  });
}

// 15) Manual transfer rejected (with the reason + what to do next).
async function sendTransferRejected(email, name, reason) {
  return sendEmail({
    to: email,
    subject: 'About your transfer report',
    html: layout({
      preheader: 'We couldn’t match your transfer. Here’s the fix.',
      title: 'Transfer not matched',
      intro: `Hi ${esc(first(name))}, we couldn't match your transfer report to a bank alert${reason ? `: ${esc(String(reason).slice(0, 140))}` : ''}. No wahala — card checkout activates instantly, or reply with your debit screenshot and we'll re-check.`,
      ctaLabel: 'Pay by card instead', ctaLink: `${baseUrl()}/billing`,
      foot: 'Card is now our only checkout — one tap, Pro switches on immediately.',
    }),
  });
}

// 16) Referral reward earned (referrer gets free Pro days — celebration!).
async function sendReferralEarned(email, name, { days, friend } = {}) {
  return sendEmail({
    to: email,
    subject: `You earned ${Number(days) || 7} free Pro days!`,
    html: layout({
      preheader: 'Your referral link just paid off.',
      title: 'Referral reward landed',
      intro: `Hi ${esc(first(name))}, ${friend ? `<b>${esc(String(friend).slice(0, 40))}</b> joined with your link` : 'someone joined with your link'} — <b>${Number(days) || 7} free Pro days</b> are now on your account. Keep sharing; every active shop earns you more.`,
      ctaLabel: 'See my earnings', ctaLink: `${baseUrl()}/dashboard`,
      foot: 'Your referral code lives on the dashboard — one tap copies it.',
    }),
  });
}

// 17) Product update / announcement (generic news mail — releases, features!).
async function sendUpdateBroadcast(email, name, { title, body, link, linkLabel } = {}) {
  return sendEmail({
    to: email,
    subject: String(title || 'News from VeloSales Ai').slice(0, 80),
    html: layout({
      preheader: String(body || '').replace(/<[^>]*>/g, '').slice(0, 100),
      title: String(title || 'Something new').slice(0, 80),
      intro: `Hi ${esc(first(name))},`,
      body: `<div style="color:#333333;line-height:1.7;font-size:14.5px;">${body || ''}</div>`,
      ctaLabel: linkLabel || undefined, ctaLink: link || undefined,
      foot: 'You get product news because you have a VeloSales Ai account. Receipts and security mails always still arrive.',
    }),
  });
}

// 18) Paid plan expiring soon (3-day heads-up for card buyers).
async function sendPlanExpiring(email, name, { plan, daysLeft } = {}) {
  const n = Number(daysLeft) || 3;
  return sendEmail({
    to: email,
    subject: `${plan || 'Pro'} renews in ${n} day${n === 1 ? '' : 's'}`,
    html: layout({
      preheader: 'Renew before it lapses — uninterrupted Pro.',
      title: 'Plan ends soon',
      intro: `Hi ${esc(first(name))}, your <b>${esc(plan || 'Pro')}</b> plan ends in ${n} day${n === 1 ? '' : 's'}. Renew on Billing to keep everything running without a blink.`,
      ctaLabel: 'Renew now', ctaLink: `${baseUrl()}/billing`,
      foot: 'If it lapses, your bot keeps replying free — nothing is ever deleted.',
    }),
  });
}

// 19) Paid plan expired (lapsed — soft landing + one-tap return).
async function sendPlanExpired(email, name, { plan } = {}) {
  return sendEmail({
    to: email,
    subject: `Your ${plan || 'Pro'} plan ended — free plan is on`,
    html: layout({
      preheader: 'Free plan is on. Come back to Pro any time.',
      title: 'Plan ended',
      intro: `Hi ${esc(first(name))}, your <b>${esc(plan || 'Pro')}</b> plan just ended. You're on Free now: bot still replies, catalog and history intact. One card payment brings Pro straight back.`,
      ctaLabel: 'Switch Pro back on', ctaLink: `${baseUrl()}/billing`,
    }),
  });
}

// 20) Winback offer (dormant shops get a reason to return — used by promos!).
async function sendWinbackOffer(email, name, { offer } = {}) {
  return sendEmail({
    to: email,
    subject: `${esc(first(name))}, a gift while you were away`,
    html: layout({
      preheader: 'Open the app to claim it.',
      title: 'We saved you something',
      intro: `Hi ${esc(first(name))}, your shop has been quiet — so here's a nudge: ${offer ? esc(String(offer).slice(0, 160)) : 'open the app this week and your next Pro month is on us to try.'}`,
      ctaLabel: 'Claim in app', ctaLink: `${baseUrl()}/dashboard`,
      foot: 'Questions? Reply here — a human reads every email.',
    }),
  });
}

module.exports = {
  baseUrl, supportEmail, fromAddress, mailFromDomain, brandAddress, ownerContact,
  sendEmail, isMailConfigured,
  sendVerificationEmail, sendOTPEmail, sendResetEmail, sendWelcomeEmail,
  sendInactiveEmail, sendTicketReplyEmail, sendTrialEnding, sendTrialEnded,
  sendPaymentSuccess, sendPaymentFailed, sendPasswordChanged, sendSupportReceived,
  sendComplaintResolved, sendTransferApproved, sendTransferRejected,
  sendReferralEarned, sendUpdateBroadcast, sendPlanExpiring, sendPlanExpired,
  sendWinbackOffer,
};
