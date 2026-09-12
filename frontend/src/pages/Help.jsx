// ── frontend/src/pages/Help.jsx ──────────────────────────────────
// WHAT: in-app help — accordion FAQ (smooth grid-rows animation) + tour replay
// + support pointer. FAQS is a DATA array ([question, answer] pairs) mapped to
// UI — adding a question = adding one line, zero JSX!
// React pattern: single `open` index state (one open at a time; click toggles).
import { useEffect, useState } from 'react'; // useEffect = load ticket history on mount; useState = accordion + form
import { startTour } from '../components/Tour.jsx'; // named import { } (NOT default!) — replay button fires the tour bus
import { api, fmtDate, pop, toast } from '../lib/api.js'; // api() tickets; fmtDate stamps; pop() filed-confirmation; toast() small errors

const FAQS = [ // [question, answer] pairs — content lives HERE, markup below is generic (separation of content & presentation!)
  ['How do I connect my WhatsApp?', 'Twilio sandbox first: join with the code, point the webhook to your server URL + /webhook/whatsapp. Then upgrade to a live sender when ready.'],
  ['How does LEARN work?', 'From your owner number send: LEARN: Blue gown ₦45,000. The AI extracts name + price and updates the catalog. Same name overwrites.'],
  ['What if the AI doesn\'t know?', 'It sends a polite handoff, flags the chat gold in your inbox, and (if set) alerts your personal WhatsApp instantly. It never invents prices.'], // \' escapes apostrophe in single-quoted string
  ['Does it speak Pidgin?', 'Yes — it mirrors the customer. Pidgin in, Pidgin out. Formal English in, formal out.'],
  ['How do I test without WhatsApp?', 'Open Test bot, type like a customer: prices, stock, hours, then something you don\'t sell.'],
  ['How does billing work?', 'Manual catalog is free forever. The 14-day trial unlocks the full Pro plan; after that, pricing follows your location automatically — Naira in Nigeria, US Dollars everywhere else. Pay by card or transfer. Never paused — free keeps replying from your manual catalog.'],
  ['Which AI answers my customers?', 'Gemini by default, with Groq and OpenRouter as automatic backups — if one is slow or down, the next takes over instantly. You never have to touch anything.'],
  ['What does profile sync do?', 'Pro only: paste your WhatsApp Business profile text (or send SYNC: + the text from your owner number) and the AI builds your catalog from it, then verifies customer questions against it.'],
  ['Can I get a refund?', "First payment within 7 days if the service genuinely failed you — message us here with details. Duplicate charges are always refunded in full."], // double quotes dodge the apostrophe problem (pick quote style per string!)
  ['How do I cancel?', "Just stop paying — you drop to free at period end, nothing deleted. To erase everything, ask us here and it's gone within 14 days."],
  ['Can the AI make mistakes?', 'Rarely, but yes — which is why unsure chats hand off to you instead of guessing. Keep your catalog accurate and review flagged chats daily.'],
  ['Why do I see sponsored messages?', 'The free plan is supported by clearly-labeled sponsor cards (max one a day) plus quiet network ads. Pro removes all of them — see Billing.'],
  ['How do I connect Telegram?', 'Free: open Telegram → message @BotFather → /newbot → name it → copy the token → paste it in Profile → Telegram → Connect. Then tap Link my Telegram and send the code to your bot. Pro can also use the shared @VendoraBot — ask support for your link code.'],
  ['Do voice notes work?', 'Yes — on Pro. Customers send voice notes on WhatsApp or Telegram, the bot transcribes them with Whisper and answers like normal text. Free tier gets a polite handoff instead.'],
  ['Which AI should I pick?', 'Fast (Llama 8B, Gemini) for speed, Smart (Llama 70B, Scout, GPT-OSS) for quality, Reasoning (DeepSeek, Qwen) for hard thinking. Premium (Kimi K2, Claude, GPT) is Pro-only — tap one to see what you get.'],
];

export default function Help() {
  const [open, setOpen] = useState(0); // index of the OPEN question (0 = first open initially — shows the pattern immediately!; -1 = all closed)
  return (
    <>
      <div className="page-head"><div className="row" style={{ width: '100%' }}><div><h1>Help</h1><p>Answers to the questions every owner asks in week one.</p></div><button className="btn sm" onClick={startTour}>Take the guided tour</button></div></div> {/* header row: title left, tour-replay button right (startTour clears flag + fires bus + goes dashboard) */}
      <div className="card">
        {FAQS.map(([q, a], i) => ( // map pairs → accordion rows (destructure [q,a]; key={i} fine — static order!)
          <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid var(--line-soft)' : 'none', padding: '12px 0' }}> {/* divider under every row EXCEPT last (i < length-1 ternary!) — var(--line-soft) = theme-aware line color */}
            <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} style={{ background: 'none', border: 'none', font: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--ink)' }}>{q}<span>{open === i ? '−' : '+'}</span></button> {/* <button> (keyboard accessible!) reset to text-look via inline styles; onClick TOGGLES: open row → -1 (close), else → i (open). −/+ glyph flips. */}
            <div className={'faq-a' + (open === i ? ' open' : '')}><div><p className="hint" style={{ paddingTop: 6 }}>{a}</p></div></div> {/* .faq-a = grid-template-rows 0fr→1fr animation (CSS animates height smoothly — the modern <details> alternative!); inner div required (grid children need a wrapper to animate) */}
          </div>
        ))}
      </div>
      <SupportBox /> {/* complaint form + ticket history (lands in the admin console!) */}
    </>
  );
}

function SupportBox() { // support ticket form + history (Help tab's "Still stuck?" grown up: files structured tickets!)
  const [subject, setSubject] = useState(''); // controlled subject draft
  const [body, setBody] = useState(''); // controlled message draft
  const [busy, setBusy] = useState(false); // submit lock (double-submit protection — tickets must not duplicate!)
  const [tickets, setTickets] = useState(null); // null = loading; [] = none yet (history below the form!)
  async function load() { const { ok, data } = await api('/api/me/complaints'); if (ok) setTickets(data || []); } // reusable reload (mount + after filing — list updates instantly!)
  useEffect(() => { load(); }, []); // [] = mount-only
  async function send() { // file the ticket…
    if (!body.trim()) return toast('Describe the problem first', 'err'); // guard: blank body
    if (body.trim().length > 2000) return toast('Keep it under 2000 characters', 'err'); // client mirror of server cap (fail fast!)
    setBusy(true); // lock…
    const { ok, data } = await api('/api/me/complaints', { method: 'POST', body: JSON.stringify({ subject: subject.trim(), body: body.trim() }) });
    setBusy(false); // …unlock either way (always!)
    if (ok) { // filed → success popup + clear + reload (ticket appears in history below with status "open"!)
      pop('ok', 'Message sent!', 'Support will reply here and by email. Most issues resolve within a day.');
      setSubject(''); setBody(''); load();
    } else pop('err', 'Could not send', data.error || 'Please try again.'); // backend reason shown (validation/caps!)
  }
  return (
    <div className="card">
      <h2>Message support</h2> {/* form first (action!), history second */}
      <p className="desc">Stuck, confused, or something broken? Write us — include what you tried. Screenshots of the inbox + catalog fix 90% of issues in one reply.</p>
      <label>Subject</label>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Bot replies with old prices" maxLength={120} /> {/* maxLength mirrors server slice (defense in depth!) */}
      <label>What happened?</label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows="4" placeholder="Tell us step by step…" />
      <div style={{ marginTop: 12 }}><button className="btn" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send to support'}</button></div>
      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14 }}>Your messages</h2> {/* ticket history (status + admin replies inline!) */}
        {tickets === null ? <div className="skel" /> : tickets.length === 0 ? <p className="hint">No messages yet — your replies from support will appear here.</p> : ( // trilogy: loading bar → empty → tickets
          <div className="qa-list">
            {tickets.map((t) => ( // key={t.id} stable ticket ids…
              <div key={t.id} className="qa static">
                <span className={'qa-dot ' + (t.status === 'open' ? 'flag' : 'ok')} /> {/* gold = awaiting us, green = answered/resolved */}
                <div>
                  <b>{t.subject || 'Support request'}</b> {/* subject or fallback */}
                  <span className="hint">{t.body.slice(0, 120)}{t.body.length > 120 ? '…' : ''} · {fmtDate(t.created_at)} · {t.status}</span> {/* preview capped (slice) + date + status */}
                  {t.reply && <span className="hint" style={{ color: 'var(--green-dark)' }}><b>Support:</b> {t.reply}</span>} {/* && conditional: admin reply shown inline (the conversation loop, closed!) */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
