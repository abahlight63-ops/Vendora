// ── frontend/src/pages/Help.jsx ──────────────────────────────────
// WHAT: the Help Center. Search, six picture guides, common questions, install
// card and support messages. A guide opens full screen and slides through real
// screenshots of the app; on each one a ring, an arrow, a "Tap here" label and
// a tapping hand point at the exact button (boxes measured when the screenshots
// were taken, see lib/helpGuides.js). Phones get phone screenshots.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, fmtDate, pop, toast } from '../lib/api.js';
import Loader from '../components/Loader.jsx';
import InstallApp from '../components/InstallApp.jsx';
import Ic from '../components/icons.jsx';
import { GUIDES, boxFor } from '../lib/helpGuides.js';

const FAQS = [
  ['Will Velo ever make up a price?', 'No. Velo only quotes prices that are in your catalog. If a price is missing, it tells the customer you will reply and flags the chat for you.'],
  ['How do I connect WhatsApp?', 'Open Channels and tap Continue with Facebook. Log in with the Facebook account that runs your business, pick your WhatsApp number, then send one test message. See the picture guide above.'],
  ['How does LEARN work?', 'From your own number send: LEARN: Blue gown ₦45,000. Velo adds it to your catalog. Sending the same name again updates the price.'],
  ['Does Velo speak Pidgin?', 'Yes. It answers the way the customer writes: Pidgin in, Pidgin out. English in, English out.'],
  ['What happens when I reach my daily replies?', 'Customers get "Thanks for your message! We\'ll be back with you shortly" and the chat waits for you in the Inbox. Replies reset at midnight, or upgrade for more.'],
  ['Can customers send voice notes?', 'Yes on Pro. Velo listens to the voice note and answers like a normal message. On other plans the chat is passed to you.'],
  ['How do I take over a chat?', 'Open the chat in Inbox and type your reply. Velo steps back for that chat so you never talk over each other.'],
  ['How do I test without customers?', 'Open Test Drive and chat like a customer. If an answer is wrong there, fix the product in Catalog.'],
  ['How do payments work?', 'Pick a plan in Plan and usage, then pay by card, bank transfer or USSD through Paystack. Your plan turns on the moment the payment lands.'],
  ['Can I get a refund?', 'Your first payment within 7 days if the service genuinely failed you. Message us below with the details. Double charges are always refunded in full.'],
  ['How do I cancel?', 'Just stop paying. You move to the free plan at the end of what you paid for, and nothing is deleted.'],
  ['Will I see ads?', 'No. VeloSales Ai has no ads on any plan, free included.'],
];

function Pointer({ box, label, imgRef }) {
  const [px, setPx] = useState(null);
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !box) { setPx(null); return undefined; }
    const measure = () => { const w = img.clientWidth, h = img.clientHeight; if (w && h) setPx({ w, h }); };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(img);
    img.addEventListener('load', measure);
    return () => { if (ro) ro.disconnect(); img.removeEventListener('load', measure); };
  }, [box, imgRef]);
  if (!box || !px) return null;
  const x = box.x * px.w, y = box.y * px.h, w = box.w * px.w, h = box.h * px.h;
  const cx = x + w / 2, cy = y + h / 2;
  // the label sits on the roomier side, the arrow curves from it to the box edge
  const right = cx < px.w * 0.55;
  const up = cy > px.h * 0.32;
  const lx = Math.max(8, Math.min(px.w - 150, right ? cx + Math.min(120, px.w * 0.18) : cx - Math.min(120, px.w * 0.18) - 120));
  const ly = Math.max(8, Math.min(px.h - 44, up ? y - Math.min(110, px.h * 0.2) : y + h + Math.min(80, px.h * 0.14)));
  const sx = lx + (right ? 10 : 110), sy = ly + (up ? 40 : 0);
  const ex = Math.max(x + 6, Math.min(x + w - 6, cx + (right ? Math.min(w / 2 - 6, 30) : -Math.min(w / 2 - 6, 30)))), ey = up ? y - 4 : y + h + 4;
  const qx = (sx + ex) / 2 + (right ? 30 : -30), qy = Math.min(sy, ey) - (up ? 10 : -10);
  const ang = Math.atan2(ey - qy, ex - qx);
  const head = (a) => `${ex},${ey} ${ex - 14 * Math.cos(ang - a)},${ey - 14 * Math.sin(ang - a)}`;
  return (
    <div className="hp-ptr" aria-hidden="true">
      <span className="hp-ring" style={{ left: x - 6, top: y - 6, width: w + 12, height: h + 12 }} />
      <svg className="hp-arrow" width={px.w} height={px.h}>
        <path className="hp-ln" d={`M${sx},${sy} Q${qx},${qy} ${ex},${ey}`} />
        <polyline className="hp-head" points={`${head(0.45)} ${ex},${ey} ${ex - 14 * Math.cos(ang + 0.45)},${ey - 14 * Math.sin(ang + 0.45)}`} />
      </svg>
      <span className="hp-label" style={{ left: lx, top: ly }}>{label}</span>
      <span className="hp-tap" style={{ left: cx, top: cy }} />
      <span className="hp-hand" style={{ left: cx - 10, top: cy - 6 }}>
        <svg viewBox="0 0 24 24" width="42" height="42"><path fill="#fff" stroke="#1E1757" strokeWidth="1.6" strokeLinejoin="round" d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 14.5a1.6 1.6 0 0 1 2.6-1.8L9 15z" /></svg>
      </span>
    </div>
  );
}

function Guide({ guide, onClose }) {
  const [i, setI] = useState(0);
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760);
  const imgRef = useRef(null);
  const step = guide.steps[i];
  const usePhone = phone && !!boxFor(step.shot, true); // a step with no phone picture shows the desktop one
  const last = i === guide.steps.length - 1;
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 760);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight' && !last) setI(i + 1); if (e.key === 'ArrowLeft' && i > 0) setI(i - 1); };
    window.addEventListener('resize', onResize); window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); };
  }, [i, last, onClose]);
  return (
    <div className="hp-back" role="presentation" onClick={onClose}>
      <div className="hp-guide" role="dialog" aria-modal="true" aria-labelledby="hp-step-title" onClick={(e) => e.stopPropagation()}>
        <div className="hp-shot-wrap">
          <div className={'hp-shot' + (usePhone ? ' is-phone' : '')} key={step.shot + (usePhone ? 'p' : 'd')}>
            <img ref={imgRef} src={`/help/${step.shot}-${usePhone ? 'p' : 'd'}.jpg`} alt={`Screenshot: ${step.title}`} />
            <Pointer box={boxFor(step.shot, usePhone)} label={step.label || 'Tap here'} imgRef={imgRef} />
          </div>
        </div>
        <div className="hp-side">
          <div className="hp-side-top">
            <span className="ch-chip ready"><Ic n={guide.icon} s={14} />{guide.title}</span>
            <button type="button" className="ps-close" onClick={onClose} aria-label="Close guide"><Ic n="x" s={18} /></button>
          </div>
          <div className="hp-bars" aria-hidden="true">{guide.steps.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
          <div className="hp-count">Step {i + 1} of {guide.steps.length}</div>
          <h2 id="hp-step-title">{step.title}</h2>
          <p className="hp-text">{step.text}</p>
          {step.tip && <p className="hp-tip"><Ic n="help" s={18} /><span>{step.tip}</span></p>}
          <div className="hp-nav">
            <button type="button" className="hp-prev" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Previous step"><Ic n="back" s={22} /></button>
            <button type="button" className="btn lg hp-next" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Done' : 'Next step'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Help() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(0);
  const [guide, setGuide] = useState(null);
  const needle = q.trim().toLowerCase();
  const guides = useMemo(() => GUIDES.filter((g) => !needle || (g.title + ' ' + g.sub + ' ' + g.steps.map((s) => s.title + ' ' + s.text).join(' ')).toLowerCase().includes(needle)), [needle]);
  const faqs = useMemo(() => FAQS.filter(([a, b]) => !needle || (a + ' ' + b).toLowerCase().includes(needle)), [needle]);
  return (
    <div className="hp">
      <section className="hp-hero">
        <h1>How can we help?</h1>
        <p>Picture guides for every part of VeloSales Ai.</p>
        <form className="hp-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Ic n="help" s={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: connect WhatsApp, add a product, refund…" aria-label="Search help" />
          {q && <button type="button" className="hp-clear" onClick={() => setQ('')} aria-label="Clear search">×</button>}
        </form>
      </section>

      <div className="hp-sec-head"><h2>Picture guides</h2><span>Tap a topic to slide through it</span></div>
      {guides.length === 0 ? <p className="hp-none">No guide matches that. Try the questions below, or message us.</p> : (
        <div className="hp-topics">
          {guides.map((g) => (
            <button key={g.id} type="button" className="hp-topic glass" onClick={() => setGuide(g)}>
              <span className="hp-topic-top"><span className="hp-topic-ic" style={{ background: g.color, boxShadow: `0 12px 24px ${g.color}55` }}><Ic n={g.icon} s={24} /></span><span className="ch-chip ready">{g.steps.length} steps</span></span>
              <b>{g.title}</b>
              <span className="hp-topic-sub">{g.sub}</span>
              <span className="hp-start">Start guide <Ic n="next" s={16} /></span>
            </button>
          ))}
        </div>
      )}

      <div className="hp-row">
        <section className="glass hp-card">
          <h2>Common questions</h2>
          {faqs.length === 0 ? <p className="hp-none">No question matches that.</p> : (
            <div className="hp-faqs">
              {faqs.map(([qq, a], k) => (
                <div key={qq} className={'hp-faq' + (open === k ? ' open' : '')}>
                  <button type="button" aria-expanded={open === k} onClick={() => setOpen(open === k ? -1 : k)}><span>{qq}</span><b aria-hidden="true">{open === k ? '−' : '+'}</b></button>
                  {open === k && <p>{a}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="hp-stuck">
          <b>Still stuck?</b>
          <p>Message our team below. We usually reply within a few hours, here and by email.</p>
          <a className="hp-stuck-go" href="#support">Message support</a>
        </section>
      </div>

      <InstallApp />
      <div id="support"><SupportBox /></div>
      {guide && <Guide guide={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}

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
