// ── frontend/src/pages/Help.jsx ──────────────────────────────────
// WHAT: in-app help — accordion FAQ (smooth grid-rows animation) + tour replay
// + support pointer. FAQS is a DATA array ([question, answer] pairs) mapped to
// UI — adding a question = adding one line, zero JSX!
// React pattern: single `open` index state (one open at a time; click toggles).
// SHELL: same centred column as Settings (pages/Settings.jsx) — a card, then
// tinted .set-row groups — so Help reads as part of the same family.
import { useEffect, useState } from 'react'; // useEffect = load ticket history on mount; useState = accordion + form
import { startTour } from '../components/Tour.jsx'; // named import { } (NOT default!) — replay button fires the tour bus
import { api, fmtDate, pop, toast } from '../lib/api.js'; // api() tickets; fmtDate stamps; pop() filed-confirmation; toast() small errors
import Loader from '../components/Loader.jsx'; // mini orbit in the send button
import InstallApp from '../components/InstallApp.jsx'; // install-as-app card (top of Help — the filmable tutorial!)

const FAQS = [ // [question, answer] pairs — content lives HERE, markup below is generic (separation of content & presentation!)
  ['How do I connect my WhatsApp?', 'Open the Connect page and tap "Connect WhatsApp" — a Meta popup opens, you log in with Facebook and pick your business number. We store everything against your account automatically. Then paste our webhook URL + verify code in Meta (shown on screen) and finish with TEST — the page flips to LIVE.'],
  ['How does LEARN work?', 'From your owner number send: LEARN: Blue gown ₦45,000. The AI extracts name + price and updates the catalog. Same name overwrites.'],
  ['What if the AI doesn\'t know?', 'It sends a polite handoff, flags the chat gold in your inbox, and (if set) alerts your personal WhatsApp instantly. It never invents prices.'], // \' escapes apostrophe in single-quoted string
  ['Does it speak Pidgin?', 'Yes — it mirrors the customer. Pidgin in, Pidgin out. Formal English in, formal out.'],
  ['How do I test without WhatsApp?', 'Open Test bot, type like a customer: prices, stock, hours, then something you don\'t sell.'],
  ['How does billing work?', 'Manual catalog is free forever. The 7-day trial unlocks the full Pro plan (countdown shown, bell warns before it ends); after that, pricing follows your location automatically on a secure card checkout. Never paused — free keeps replying from your manual catalog.'],
  ['Which AI answers my customers?', 'Whichever brain you pick on the Connect page — Gemini Flash by default, with automatic free backups if one is slow or down. You never have to touch anything after picking.'],
  ['What does profile sync do?', 'Pro only: paste your WhatsApp Business profile text (or send SYNC: + the text from your owner number) and the AI builds your catalog from it, then verifies customer questions against it.'],
  ['Can I get a refund?', "First payment within 7 days if the service genuinely failed you — message us here with details. Duplicate charges are always refunded in full."], // double quotes dodge the apostrophe problem (pick quote style per string!)
  ['How do I cancel?', "Just stop paying — you drop to free at period end, nothing deleted. To erase everything, ask us here and it's gone within 14 days."],
  ['Can the AI make mistakes?', 'Rarely, but yes — which is why unsure chats hand off to you instead of guessing. Keep your catalog accurate and review flagged chats daily.'],
  ['Will I see ads?', 'No — VeloSales Ai shows zero ads on every plan, free included. Pro adds profile sync, product photos and premium AI brains — see Billing.'],
  ['How do I install the app?', 'See the Install card at the top of this page — one tap on Android/desktop Chrome (system confirm included), Share → Add to Home Screen on iPhone Safari. Icon on your home screen, full-screen, no app store.'],
  ['How do I connect Telegram?', 'Open the Connect page and pick Telegram: message @BotFather → /newbot → name it → paste the token here. Then get your link code so owner commands work from your phone. Free, about a minute.'],
  ['Do voice notes work?', 'Yes — on Pro. Customers send voice notes on WhatsApp or Telegram, the bot transcribes them with Whisper and answers like normal text. Free tier gets a polite handoff instead.'],
  ['Which AI should I pick?', 'Fast (GPT-OSS 20B, Gemini Lite, VeloSales Ai Fast) for speed, Smart (Meta 70B, Gemini Flash, VeloSales Ai Smart) for quality. Backup AI always works when others are busy. Premium (Kimi K2, Claude, GPT) is Pro-only — tap one to see what you get.'],
];

// ── the row icons (drawn here, no icon package — same house style as Settings) ──
function RowIc({ k }) {
  const p = { viewBox: '0 0 24 24', width: 19, height: 19, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (k === 'help') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>); // help (a question)
  if (k === 'tag') return (<svg {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></svg>); // tag (topic chips)
  if (k === 'message') return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /></svg>); // speech bubble (subject)
  if (k === 'pencil') return (<svg {...p}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M14.5 5.5l3 3" /></svg>); // pencil (what happened)
  if (k === 'send') return (<svg {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>); // paper plane (send)
  if (k === 'clock') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>); // clock (ticket still open)
  if (k === 'check') return (<svg {...p}><path d="M20 6 9 17l-5-5" /></svg>); // tick (ticket answered)
  return null; // unknown key renders nothing (never a broken glyph)
}

export default function Help() {
  const [open, setOpen] = useState(0); // index of the OPEN question (0 = first open initially — shows the pattern immediately!; -1 = all closed)
  return (
    <>
      <div className="page-head"><div className="row"><div><h1>Help</h1><p>Answers to the questions every owner asks in week one.</p></div><button className="btn sm" onClick={startTour}>Take the guided tour</button></div></div> {/* header row: title left, tour-replay button right (startTour clears flag + fires bus + goes dashboard) */}
      <div className="set-col">
        <InstallApp /> {/* install tutorial FIRST (users film this card + the system dialog!) */}

        {/* ── group: the accordion ─────────────────────────────────────── */}
        <div className="set-group">
          <h2>Common questions</h2>
          <div className="set-rows warm">
            {FAQS.map(([q, a], i) => ( // map pairs → accordion rows (destructure [q,a]; key={i} fine — static order!)
              <div key={i} className="set-faq"> {/* .set-faq + .set-faq draws the divider — the last row stays clean (.faq-item belongs to the landing FAQ, not this one) */}
                <button className="set-row faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{/* one clickable row: icon chip + question + trailing +/− (onClick TOGGLES: open row → -1 (close), else → i (open)) */}
                  <span className="set-ic w"><RowIc k="help" /></span>
                  <div className="set-main"><b>{q}</b></div>
                  <span className="set-tail">{open === i ? '−' : '+'}</span>
                </button>
                <div className={'faq-a' + (open === i ? ' open' : '')}><div><p className="hint">{a}</p></div></div> {/* .faq-a = grid-template-rows 0fr→1fr animation (CSS animates height smoothly — the modern <details> alternative!); inner div required (grid children need a wrapper to animate) */}
              </div>
            ))}
          </div>
        </div>

        <SupportBox /> {/* complaint form + ticket history (lands in the admin console!) */}
      </div>
    </>
  );
}

function SupportBox() { // support ticket form + history (Help tab's "Still stuck?" grown up: files structured tickets!)
  const [cat, setCat] = useState('feedback'); // feedback | complaint | feature | bug (chips below — triages the admin inbox!)
  const [subject, setSubject] = useState(''); // controlled subject draft
  const [body, setBody] = useState(''); // controlled message draft
  const [busy, setBusy] = useState(false); // submit lock (double-submit protection — tickets must not duplicate!)
  const [tickets, setTickets] = useState(null); // null = loading; [] = none yet (history below the form!)
  async function load() { const { ok, data } = await api('/api/me/complaints'); if (ok) setTickets(Array.isArray(data) ? data : []); } // reusable reload (mount + after filing — list updates instantly!); Array.isArray guard: a malformed body must not take the whole page down
  useEffect(() => { // mount + 60s poll (support replies land here live — same rhythm as the bell!)
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(t);
  }, []); // [] = mount-only setup
  async function send() { // file the ticket…
    if (!body.trim()) return toast('Describe the problem first', 'err'); // guard: blank body
    if (body.trim().length > 2000) return toast('Keep it under 2000 characters', 'err'); // client mirror of server cap (fail fast!)
    setBusy(true); // lock…
    const { ok, data } = await api('/api/me/feedback', { method: 'POST', body: JSON.stringify({ category: cat, subject: subject.trim(), body: body.trim() }) });
    setBusy(false); // …unlock either way (always!)
    if (ok) { // filed → success popup + clear + reload (ticket appears in history below with status "open"!)
      pop('ok', 'Message sent!', 'Thanks — we read every note. Support replies here and by email, most within a day.');
      setSubject(''); setBody(''); load();
    } else pop('err', 'Could not send', data.error || 'Please try again.'); // backend reason shown (validation/caps!)
  }
  return (
    <>
      <div className="set-group">
        <h2>Message support</h2> {/* form first (action!), history second */}
        <p className="desc">Stuck, confused, or something broken? Pick a topic and write us — include what you tried. Screenshots of the inbox + catalog fix 90% of issues in one reply.</p>
        <div className="set-rows">
          <div className="set-row">
            <span className="set-ic s"><RowIc k="tag" /></span>
            <div className="set-main set-chips">
              {[['feedback', 'Feedback'], ['complaint', 'Complaint'], ['feature', 'Feature idea'], ['bug', 'Bug report']].map(([v, l]) => ( // category chips (single-select — one topic per message!)
                <button key={v} className={'btn sm' + (cat === v ? '' : ' ghost')} onClick={() => setCat(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="set-row form">
            <span className="set-ic"><RowIc k="message" /></span>
            <div className="set-main"><label>Subject</label><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Bot replies with old prices" maxLength={120} /></div> {/* maxLength mirrors server slice (defense in depth!) */}
          </div>
          <div className="set-row form">
            <span className="set-ic m"><RowIc k="pencil" /></span>
            <div className="set-main"><label>What happened?</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows="4" placeholder="Tell us step by step…" /></div>
          </div>
        </div>
        <div className="set-foot"><button className="btn" disabled={busy} onClick={send}>{busy ? (<><Loader size={15} />Sending…</>) : 'Send to support'}</button></div>
      </div>
      <div className="set-group">
        <h2>Your messages</h2> {/* ticket history (status + admin replies inline!) */}
        {tickets === null ? <div className="skel" /> : tickets.length === 0 ? <p className="hint">No messages yet — your replies from support will appear here.</p> : ( // trilogy: loading bar → empty → tickets
          <div className="set-rows warm">
            {tickets.map((t) => ( // key={t.id} stable ticket ids…
              <div key={t.id} className="set-row form">
                <span className={'set-ic ' + (t.status === 'open' ? 'w' : 'm')}><RowIc k={t.status === 'open' ? 'clock' : 'check'} /></span> {/* gold = awaiting us, green = answered/resolved */}
                <div className="set-main">
                  <b>{t.subject || 'Support request'}</b> {/* subject or fallback */}
                  <span className="hint">{t.body.slice(0, 120)}{t.body.length > 120 ? '…' : ''} · {fmtDate(t.created_at)} · {t.status}</span> {/* preview capped (slice) + date + status */}
                  {t.reply && <span className="hint reply"><b>Support:</b> {t.reply}</span>} {/* && conditional: admin reply shown inline (the conversation loop, closed!) */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
