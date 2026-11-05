// ── src/services/followupService.js ───────────────────────────────
// WHAT: selling settings and the follow-up job.
//   Away mode: "I'm away until Monday" → Velo keeps answering but tells customers
//     orders and deliveries resume when the owner is back.
//   Follow-ups (free, inside WhatsApp's 24-hour window): a customer asked, Velo
//     answered, and the customer went quiet for N hours (default 4) → ONE short,
//     friendly nudge in their language. Never after an order, never to friends,
//     blocked numbers or people who said STOP, never twice for the same question.
const db = require('../db');

async function getSettings(businessId) {
  const { rows: [b] } = await db.query('SELECT away_until, away_note, followup_enabled, followup_hours FROM businesses WHERE id = $1', [Number(businessId)]);
  return b ? { awayUntil: b.away_until, awayNote: b.away_note || '', followupEnabled: !!b.followup_enabled, followupHours: b.followup_hours || 4 } : null;
}
async function saveSettings(businessId, body = {}) {
  const sets = []; const args = [Number(businessId)];
  const put = (sql, v) => { args.push(v); sets.push(sql.replace('?', '$' + args.length)); };
  if ('awayUntil' in body) { const d = body.awayUntil ? new Date(body.awayUntil) : null; put('away_until = ?', d && !isNaN(d) && d > new Date() ? d.toISOString() : null); }
  if ('awayNote' in body) put('away_note = ?', String(body.awayNote || '').trim().slice(0, 300) || null);
  if ('followupEnabled' in body) put('followup_enabled = ?', !!body.followupEnabled);
  if ('followupHours' in body) put('followup_hours = ?', Math.min(20, Math.max(1, Math.round(Number(body.followupHours) || 4))));
  if (sets.length) await db.query(`UPDATE businesses SET ${sets.join(', ')} WHERE id = $1`, args);
  return getSettings(businessId);
}
// Line for the reply prompt while the owner is away.
function awayLine(b) {
  if (!b || !b.away_until || new Date(b.away_until) <= new Date()) return '';
  const when = new Date(b.away_until).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });
  return `OWNER AWAY until ${when}${b.away_note ? ` (${b.away_note})` : ''}: keep answering questions, but tell customers kindly that orders, deliveries and bookings are handled from ${when}.`;
}

// ── The follow-up job ──
async function round() {
  const { rows } = await db.query(
    `SELECT c.id, c.business_id, c.customer_name, b.followup_hours, last_in.at AS last_in
       FROM conversations c
       JOIN businesses b ON b.id = c.business_id
       JOIN LATERAL (SELECT MAX(m.created_at) AS at FROM messages m WHERE m.conversation_id = c.id AND m.direction = 'in') last_in ON true
      WHERE b.followup_enabled = true AND COALESCE(b.bot_enabled, true) = true
        AND COALESCE(c.bot_paused, false) = false AND COALESCE(c.blocked, false) = false AND COALESCE(c.promo_opt_out, false) = false
        AND COALESCE(c.contact_type, '') NOT IN ('personal', 'unsure') AND COALESCE(c.needs_human, false) = false
        AND last_in.at < now() - make_interval(hours => COALESCE(b.followup_hours, 4))
        AND last_in.at > now() - interval '22 hours'                       -- still inside WhatsApp's free 24-hour window
        AND (c.followup_sent_at IS NULL OR c.followup_sent_at < last_in.at) -- one nudge per question
        AND (SELECT m.sender FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) = 'bot' -- Velo answered and they went quiet
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.conversation_id = c.id AND o.created_at > now() - interval '3 days')
      LIMIT 50`);
  for (const c of rows) {
    try {
      await db.query('UPDATE conversations SET followup_sent_at = now() WHERE id = $1', [c.id]); // mark first: never double-send
      const { rows: msgs } = await db.query(`SELECT direction, body FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6`, [c.id]);
      const transcript = msgs.reverse().map((m) => `${m.direction === 'in' ? 'Customer' : 'Shop'}: ${String(m.body || '').slice(0, 300)}`).join('\n');
      const system = 'You write ONE short, warm follow-up for a Nigerian shop to a customer who asked about something and went quiet. Max 20 words, in the customer\'s language (Pidgin if they wrote Pidgin). Mention the item they asked about. No pressure, no discounts, no prices that are not in the chat, no emojis. Example: "Hi Tunde, still interested in the bone straight 20 inch? I can keep one for you." Return only the message.';
      const text = String(await require('./ai/client').callAI(system, transcript, null) || '').replace(/^["']|["']$/g, '').trim().slice(0, 300);
      if (!text || /NEED_HUMAN/.test(text)) continue;
      const sent = await require('./customerSend').sendToConversation(c.business_id, c.id, text);
      if (sent.sent) await require('./conversationService').logMessage(c.id, 'out', text, null, 'bot');
    } catch (e) { console.error('follow-up failed for chat', c.id, e.message); }
  }
  return rows.length;
}
function start() {
  const tick = () => round().catch((e) => console.error('follow-up round error:', e.message));
  setTimeout(tick, 5 * 60 * 1000);
  setInterval(tick, 15 * 60 * 1000); // every 15 minutes
}

module.exports = { getSettings, saveSettings, awayLine, round, start };
