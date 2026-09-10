// ── frontend/src/pages/Help.jsx ──────────────────────────────────
// WHAT: in-app help — accordion FAQ (smooth grid-rows animation) + tour replay
// + support pointer. FAQS is a DATA array ([question, answer] pairs) mapped to
// UI — adding a question = adding one line, zero JSX!
// React pattern: single `open` index state (one open at a time; click toggles).
import { useState } from 'react'; // useState only (static content + accordion index)
import { startTour } from '../components/Tour.jsx'; // named import { } (NOT default!) — replay button fires the tour bus

const FAQS = [ // [question, answer] pairs — content lives HERE, markup below is generic (separation of content & presentation!)
  ['How do I connect my WhatsApp?', 'Twilio sandbox first: join with the code, point the webhook to your server URL + /webhook/whatsapp. Then upgrade to a live sender when ready.'],
  ['How does LEARN work?', 'From your owner number send: LEARN: Blue gown ₦45,000. The AI extracts name + price and updates the catalog. Same name overwrites.'],
  ['What if the AI doesn\'t know?', 'It sends a polite handoff, flags the chat gold in your inbox, and (if set) alerts your personal WhatsApp instantly. It never invents prices.'], // \' escapes apostrophe in single-quoted string
  ['Does it speak Pidgin?', 'Yes — it mirrors the customer. Pidgin in, Pidgin out. Formal English in, formal out.'],
  ['How do I test without WhatsApp?', 'Open Test bot, type like a customer: prices, stock, hours, then something you don\'t sell.'],
  ['How does billing work?', 'Manual catalog is free forever. The 14-day trial unlocks the full Pro plan; after that keep Monthly ₦7,500 / $5, Yearly ₦50,000 / $33 (save ~44%), or Lifetime ₦100,000 / $65 once. Currency follows your WhatsApp number (+234 → Naira). Pay by card or transfer (transfer is Naira-only). Never paused — free keeps replying from your manual catalog.'],
  ['Which AI answers my customers?', 'Gemini by default, with Groq and OpenRouter as automatic backups — if one is slow or down, the next takes over instantly. You never have to touch anything.'],
  ['What does profile sync do?', 'Pro only: paste your WhatsApp Business profile text (or send SYNC: + the text from your owner number) and the AI builds your catalog from it, then verifies customer questions against it.'],
  ['Can I get a refund?', "First payment within 7 days if the service genuinely failed you — message us here with details. Duplicate charges are always refunded in full."], // double quotes dodge the apostrophe problem (pick quote style per string!)
  ['How do I cancel?', "Just stop paying — you drop to free at period end, nothing deleted. To erase everything, ask us here and it's gone within 14 days."],
  ['Can the AI make mistakes?', 'Rarely, but yes — which is why unsure chats hand off to you instead of guessing. Keep your catalog accurate and review flagged chats daily.'],
  ['Why do I see sponsored messages?', 'The free plan is supported by clearly-labeled sponsor cards (max one a day) plus quiet network ads. Pro removes all of them — see Billing.'],
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
      <div className="card"><h2>Still stuck?</h2><p className="desc">Message support with your business name + WhatsApp number and what you tried.</p><p className="hint">Tip: screenshots of the inbox + catalog fix 90% of issues in one reply.</p></div> {/* support card: tells users EXACTLY what to include (fewer back-and-forths!) */}
    </>
  );
}
