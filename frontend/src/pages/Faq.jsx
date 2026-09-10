// ── frontend/src/pages/Faq.jsx ───────────────────────────────────
// WHAT: PUBLIC marketing FAQ (/faq — no login needed). Same accordion pattern
// as Help.jsx but on the dark landing theme + scroll-reveal + signup CTA.
// Shares the .faq-q/.faq-a CSS with Help (one animation system, two pages!).
// React patterns: custom useReveal hook (shared observer logic), open-index
// accordion, inline landing styles (landing theme differs from app theme).
import { useEffect, useState } from 'react'; // useEffect = title + reveal hook inside useReveal; useState = open index
import { Link } from 'react-router-dom'; // nav links (brand, sign in, trial, footer)

const FAQS = [ // 15 [question, answer] pairs — MARKETING voice (honest + punchy; the in-app Help rephrases some for owners). Content-as-data again: add a row = new FAQ, zero JSX!
  ['Is there really a free plan?', 'Yes — manual catalog is free forever: add products on the dashboard or teach with LEARN: messages and the bot replies to customers at no cost. Pro (profile sync + verification) is what you pay for, and every account starts with a 14-day Pro trial.'], // lead with the #1 objection (price fear kills signups!)
  ['How do I connect my WhatsApp?', 'Join the Twilio sandbox with the code, point the webhook to your server URL + /webhook/whatsapp. When ready, upgrade to a live WhatsApp sender — chats keep working the same way.'],
  ['How does LEARN work?', 'From your owner number send: LEARN: Blue gown ₦45,000. The AI extracts name + price and updates the catalog. Sending the same name again overwrites the price. Free forever.'],
  ['What is profile sync (Pro)?', 'Paste your WhatsApp Business profile text in Catalog → Sync (or send SYNC: + the text from your owner number). The AI scaffolds your whole catalog from it and then verifies customer questions against your synced profile — so "is it really available?" gets a verified yes.'],
  ["What if the AI doesn't know?", 'It sends a polite handoff, flags the chat gold in your inbox, and alerts your personal WhatsApp instantly. It never invents prices or delivery promises. Review flagged chats daily — unanswered flags are the only way sales slip.'], // double-quoted string (apostrophe inside would break single quotes!)
  ['Does it speak Pidgin?', 'Yes — it mirrors the customer. Pidgin in, Pidgin out. Formal English in, formal out. It never corrects their language.'],
  ['Can customers send photos?', 'Yes — if a customer sends a product photo, the AI matches it against your catalog and replies with the closest item, or hands off to you if nothing matches. Blurry mystery photos still need human eyes.'], // honest limit stated (trust > hype!)
  ['How does billing work?', 'Manual catalog free forever. After your 14-day Pro trial: Monthly ₦7,500 / $5, Yearly ₦50,000 / $33 (save ~44%), or Lifetime ₦100,000 / $65 once. Currency is auto-set from your WhatsApp number. Pay by card or direct bank transfer (transfer is Naira-only). Dropping to free never deletes anything.'],
  ['Does Vendora work outside Nigeria?', 'Yes — any WhatsApp number worldwide works. Non-Nigerian numbers bill in US Dollars, hours follow your timezone setting, and the AI matches your customer’s language.'], // global objection handled (currency + timezone + language in one answer!)
  ['Can I get a refund?', 'First-ever payment: yes, within 7 days if the service genuinely didn\'t work for you — write us from Help. Duplicate/failed charges are always refunded in full. Renewals past 7 days are non-refundable.'], // \' escape inside single quotes
  ['How do I cancel?', 'Stop paying and you simply drop to the free plan at period end — no calls, no dark patterns. Delete your account from Settings or Help and everything is removed within 14 days.'], // "no dark patterns" = trust phrase (cancellation fear kills trials!)
  ['Can the AI make mistakes?', 'Rarely, but possible — AI models can misread slang or sound confident about thin facts. That\'s why unsure moments hand off to you instead of guessing, and why your catalog accuracy matters: the AI quotes what YOU taught it.'],
  ['What if WhatsApp or Twilio goes down?', 'Vendora rides on WhatsApp, Twilio and AI providers. If they outage, replies may delay — we always fail safe (flag to human, never invent answers). Your catalog and history are untouched.'], // dependency honesty (outages WILL happen — set expectations now!)
  ['Is my data private?', 'Your catalog and chats only reply to your customers. No selling data, no ads, no training public models on your content. Export or delete anytime from Help. Full details in Privacy.'], // links conceptually to /privacy (footer has the real link)
  ['How do I reach support?', 'Fastest: the Help page inside your dashboard — it arrives with your account attached. Include your business name, number, and a screenshot; that combo fixes 90% of issues in one reply.'],
];

function useReveal() { // CUSTOM HOOK (useX + useEffect inside = reusable behavior!): fade elements in as you scroll.
  useEffect(() => { // mount-only observer setup…
    const els = document.querySelectorAll('.reveal'); // all .reveal elements CURRENTLY rendered (runs once — content below is static, so nothing missed!)
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('vis'); }), { threshold: 0.12 }); // callback fires per element on visibility change; isIntersecting + 12% visible → .vis triggers the CSS transition (add-only: never removes = stays visible!)
    els.forEach((el) => io.observe(el)); // watch each one…
    return () => io.disconnect(); // cleanup: stop ALL observation on unmount (single disconnect call!)
  }, []); // [] = once (if FAQs rendered LATER/async, they'd miss observation — here they're static, so fine!)
}

export default function Faq() {
  const [open, setOpen] = useState(0); // open accordion index (0 = first open on load — demonstrates the pattern!)
  useEffect(() => { document.title = 'Vendora — FAQ'; }, []); // tab title
  useReveal(); // CALL the custom hook (hooks are just functions! Rules: top-level, same order every render — this call never moves)
  return (
    <div className="landing"> {/* dark landing theme wrapper (all landing CSS lives under .landing scope!) */}
      <header className="landing-nav"><div className="landing-inner">
        <Link className="landing-brand" to="/"><img src="/logo.png" alt="Vendora" />VENDORA</Link> {/* brand links HOME (to="/") */}
        <span><Link className="btn ghost sm" to="/login">Sign in</Link>{' '}<Link className="btn sm" to="/login">Start free trial</Link></span> {/* {' '} explicit space (JSX eats literal whitespace!) */}
      </div></header>
      <section className="landing-inner" style={{ padding: '48px 24px 24px', maxWidth: 760 }}> {/* inline layout: vertical rhythm + narrower column (760px reads better than 1060 for FAQs!) */}
        <span className="pill ok">FAQ</span> {/* eyebrow pill */}
        <h1 style={{ fontSize: 36, color: '#fff', margin: '14px 0 8px', letterSpacing: -1 }}>Questions? Answered honestly.</h1> {/* inline headline styling (landing-dark needs explicit white — app theme vars don't apply here!) */}
        <p style={{ color: '#b9d4c2' }}>Everything owners ask in week one — free vs Pro, LEARN, sync, Pidgin, billing, refunds, privacy. No fine-print surprises.</p>
        <div className="card reveal" style={{ marginTop: 22 }}> {/* .reveal = observer fades this in on scroll (useReveal above!) */}
          {FAQS.map(([q, a], i) => ( // same accordion render as Help (destructure pairs; key={i} static order)…
            <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid var(--line-soft)' : 'none', padding: '12px 0' }}> {/* dividers except after last row */}
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} style={{ background: 'none', border: 'none', font: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--ink)' }}>{q}<span>{open === i ? '−' : '+'}</span></button> {/* <button> reset to text look (keyboard accessible!); toggle logic identical to Help */}
              <div className={'faq-a' + (open === i ? ' open' : '')}><div><p className="hint" style={{ paddingTop: 6 }}>{a}</p></div></div> {/* grid-rows animation (shared CSS with Help!) */}
            </div>
          ))}
        </div>
        <div className="card reveal hover-lift"> {/* conversion card: stuck → trial (every marketing page ends with ONE action!) */}
          <h2>Still stuck?</h2>
          <p className="desc">Start a free trial and message support from the Help page with your business name.</p>
          <Link className="btn sm" to="/login">Start free — 14 days</Link>
        </div>
      </section>
      <footer className="foot-links landing-inner"> {/* legal footer (same trio everywhere = consistent trust!) */}
        <Link to="/faq">FAQ</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}
