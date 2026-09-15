// ── frontend/src/pages/Faq.jsx ───────────────────────────────────
// WHAT: PUBLIC marketing FAQ (/faq — no login needed). Light, airy design with
// live search filter + numbered accordion cards + signup CTA. Content-as-data:
// FAQS array of [question, answer] — add a row = new FAQ, zero JSX.
// React patterns: useState for open index + search query; useMemo for filtered
// list (recomputes only when query changes — no wasted filtering per render!).
import { useEffect, useMemo, useState } from 'react'; // useMemo = cached computation (filters only when `query` changes)
import { Link } from 'react-router-dom'; // brand/home/signin/trial/footer links
import Ic from '../components/icons.jsx'; // drawn close glyph for the search-clear button

const FAQS = [ // 15 pairs — CUSTOMER voice (plain answers, zero jargon; in-app Help rephrases for owners)
  ['Is there really a free plan?', 'Yes — the manual catalog is free forever: add products on the dashboard or teach the bot with LEARN: messages and it replies to customers at no cost. Pro (profile sync plus verification) is what you pay for, and every account starts with a 7-day Pro trial (countdown shown, bell warns you before it ends).'],
  ['How do I connect my WhatsApp?', 'After signup, open the Connect page and tap "Connect WhatsApp" — a Meta popup opens, you log in with Facebook and pick your business number. Send the TEST message and you flip to LIVE.'],
  ['How does LEARN work?', 'From your owner number send: LEARN: Blue gown ₦45,000. The AI extracts the name and price and updates the catalog. Sending the same name again overwrites the price. Free forever.'],
  ['What is profile sync (Pro)?', 'Paste your WhatsApp Business profile text in Catalog → Sync (or send SYNC: plus the text from your owner number). The AI scaffolds your whole catalog from it and then verifies customer questions against your synced profile.'],
  ["What if the AI doesn't know?", 'It sends a polite handoff, flags the chat gold in your inbox, and alerts your personal WhatsApp instantly. It never invents prices or delivery promises. Review flagged chats daily.'],
  ['Does it speak Pidgin?', 'Yes — it mirrors the customer. Pidgin in, Pidgin out. Formal English in, formal out. It never corrects their language.'],
  ['Can customers send photos?', 'Yes — if a customer sends a product photo, the AI matches it against your catalog and replies with the closest item, or hands off to you if nothing matches.'],
  ['How does billing work?', 'Pricing adapts to your location automatically — you pay by card on a secure checkout page — Pro from ₦7,499 or $5 per month, Pro Plus (voice notes + heavy work models) from ₦14,999 or $10 per month, with yearly savings up to 33%. Big shops ask about Enterprise. Dropping to free never deletes anything.'],
  ['Does Vendora work outside Nigeria?', 'Yes — any WhatsApp number worldwide works. Prices, hours and replies all follow your location and timezone, and the AI matches your customer\u2019s language.'],
  ['Can I get a refund?', 'First-ever payment: yes, within 7 days if the service genuinely didn\u2019t work for you — write to us from Help. Duplicate or failed charges are always refunded in full.'],
  ['How do I cancel?', 'Stop paying and you simply drop to the free plan at period end. Delete your account from Settings or Help and everything is removed within 14 days.'],
  ['Can the AI make mistakes?', 'Rarely, but possible — AI models can misread slang or sound confident about thin facts. That is why unsure moments hand off to you instead of guessing, and why your catalog accuracy matters.'],
  ['What if WhatsApp goes down?', 'Vendora rides on Meta WhatsApp Cloud API and AI providers. If they have an outage, replies may delay — the bot always fails safe by flagging a human instead of inventing answers. Your catalog and history are untouched.'],
  ['Is my data private?', 'Your catalog and chats only reply to your customers. No data sales, no advertising profiles, no training of public models on your content. Export or delete anytime from Help. Full details in Privacy.'],
  ['How do I reach support?', 'Fastest: the Help page inside your dashboard — it arrives with your account attached. Include your business name, number, and a screenshot; that combination resolves 90% of issues in one reply.'],
];

function useReveal() { // CUSTOM HOOK: fade .reveal elements in on scroll (IntersectionObserver = no scroll listeners, battery-friendly)
  useEffect(() => { // mount-only observer setup…
    const els = document.querySelectorAll('.reveal'); // all .reveal nodes currently rendered…
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('vis'); }), { threshold: 0.12 }); // 12% visible → .vis triggers the CSS transition (add-only, stays visible)
    els.forEach((el) => io.observe(el)); // watch each…
    return () => io.disconnect(); // cleanup on unmount (single call stops everything)
  }, []);
}

export default function Faq() {
  const [open, setOpen] = useState(0); // open accordion index (0 = first open on load shows the pattern; -1 = all closed)
  const [query, setQuery] = useState(''); // live search text (controlled input below)
  useEffect(() => { document.title = 'Vendora — FAQ'; }, []); // tab title
  useReveal(); // scroll-reveal wiring (hooks are just functions — top-level call, stable order)
  const shown = useMemo(() => { // filtered list, recomputed ONLY when query changes (useMemo caches otherwise)…
    const q = query.trim().toLowerCase(); // normalize once (trim + lowercase = case-insensitive match)
    if (!q) return FAQS.map((f, i) => ({ f, i })); // empty query → everything (keep original index i for numbering!)
    return FAQS.map((f, i) => ({ f, i })).filter(({ f }) => (f[0] + ' ' + f[1]).toLowerCase().includes(q)); // search question + answer together
  }, [query]); // [query] = only dependency (typing re-filters, nothing else re-runs it)
  return (
    <div className="faq-page"> {/* light airy theme (own scope — readable in both app themes via CSS vars!) */}
      <header className="landing-nav"><div className="landing-inner">
        <Link className="landing-brand" to="/"><img src="/logo.png" alt="Vendora" />VENDORA</Link> {/* brand links HOME */}
        <span><Link className="btn ghost sm" to="/login">Sign in</Link>{' '}<Link className="btn sm" to="/login">Start free trial</Link></span> {/* {' '} = explicit space (JSX collapses whitespace!) */}
      </div></header>
      <section className="landing-inner faq-hero"> {/* centered hero: pill + headline + search */}
        <span className="pill ok">FAQ</span> {/* eyebrow pill */}
        <h1>Questions? Answered clearly.</h1> {/* plain headline (no gimmicks — trust tone) */}
        <p>Everything owners ask in week one — free vs Pro, LEARN, sync, Pidgin, billing, refunds, privacy.</p>
        <div className="faq-search"> {/* search box with icon (filters below live!) */}
          <span aria-hidden="true">⌕</span> {/* magnifier glyph (decorative — aria-hidden hides from screen readers) */}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions… e.g. refund, Pidgin, price" aria-label="Search questions" /> {/* controlled input; aria-label (no visible <label> here!) */}
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><Ic n="x" s={14} /></button>} {/* && conditional: clear button only while typing */}
        </div>
      </section>
      <section className="landing-inner" style={{ maxWidth: 760, paddingBottom: 24 }}> {/* narrow reading column (760px = comfortable line length!) */}
        {shown.length === 0 ? ( // no matches → friendly empty state (never a dead page!)…
          <div className="card"><div className="empty"><b>No matches for “{query}”</b>Try fewer words — or ask us from the Help page after signing up.</div></div>
        ) : ( // …else numbered accordion cards…
          <div className="qa-list">
            {shown.map(({ f: [q, a], i }) => ( // destructure pair + original index (numbering stays stable when filtering!)
              <div key={i} className={'card faq-item reveal vis' + (open === i ? ' open' : '')}> {/* vis added immediately (list changes on typing — observer would miss new nodes, so no scroll-gating here!) */}
                <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}> {/* <button> = keyboard accessible; toggle open/closed */}
                  <span className="faq-num">{String(i + 1).padStart(2, '0')}</span> {/* ghost number 01–15 (padStart zero-pads!) */}
                  <span style={{ flex: 1 }}>{q}</span> {/* flex:1 pushes the +/− to the far edge */}
                  <span className="faq-plus">{open === i ? '−' : '+'}</span> {/* animated plus→minus (CSS rotates!) */}
                </button>
                <div className={'faq-a' + (open === i ? ' open' : '')}><div><p>{a}</p></div></div> {/* grid-rows open animation (shared system with Help!) */}
              </div>
            ))}
          </div>
        )}
        <div className="card hover-lift faq-cta"> {/* conversion card: every marketing page ends with ONE action! */}
          <div><h2>Still stuck?</h2><p className="desc">Start a free trial and message support from the Help page with your business name.</p></div>
          <Link className="btn" to="/login">Start free — 7 days Pro</Link>
        </div>
      </section>
      <footer className="foot-links landing-inner"> {/* legal trio (consistent everywhere) */}
        <Link to="/faq">FAQ</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}
