// ── frontend/src/pages/Landing.jsx ─────────────────────────────────
// WHAT: the public marketing homepage (/) — nav, hero with live-looking chat
// mock, how-it-works cards, dual-currency pricing, FAQ teaser, legal footer.
// Guests only (App routes logged-in users to /dashboard instead).
// Also: scroll-reveal via IntersectionObserver (no animation library!).
import { useEffect } from 'react'; // useEffect ×1: title + reveal observer setup
import { Link } from 'react-router-dom'; // Links (client-side nav, no reloads)
import ThemeToggle from '../components/ThemeToggle.jsx'; // theme switch in the nav (guests get dark mode too!)
import { useCurrency } from '../lib/locale.js'; // location → 'NGN' | 'USD' (single-currency pricing!)

export default function Landing({ theme = 'light', onToggleTheme = () => {} }) { // theme props from App (defaults = safe standalone render)
  const cur = useCurrency(); // visitor currency (NGN default → corrected after IP/timezone detection, auto re-render!)
  useEffect(() => { // mount: title + scroll-reveal wiring…
    document.title = 'Vendora — Your WhatsApp shop, open 24/7'; // tab title (SEO-ish + tabs)
    const els = document.querySelectorAll('.reveal'); // grab ALL reveal elements (cards below)…
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('vis'); }), { threshold: 0.12 }); // IntersectionObserver = browser API: fires when element enters viewport (12% visible → add .vis → CSS transitions opacity/position. No scroll listeners = buttery + battery-friendly!)
    els.forEach((el) => io.observe(el)); // watch each…
    return () => io.disconnect(); // cleanup: stop observing on unmount (no leaks!)
  }, []); // [] = mount-only
  return (
    <div className="landing"> {/* dark-green marketing theme (own CSS section — separate from app theme!) */}
      <header className="landing-nav"> {/* sticky top nav (CSS) */}
        <div className="landing-inner"> {/* centered max-width container (reused per section!) */}
          <span className="landing-brand"><img src="/logo.png" alt="Vendora" />VENDORA</span> {/* brand lockup (span, not link — already home) */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}> {/* right cluster: toggle + two CTAs (inline-flex rows them up) */}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <Link className="btn ghost sm" to="/login">Sign in</Link>{' '} {/* {' '} = explicit space between inline elements (JSX collapses whitespace!) */}
            <Link className="btn sm" to="/login">Start free trial</Link> {/* primary CTA (same destination — choice of words, not paths!) */}
          </span>
        </div>
      </header>

      <section className="landing-hero landing-inner"> {/* <section> = semantic landmark (SEO + screen readers); two classes: layout + container */}
        <div> {/* left: copy + CTAs */}
          <span className="pill ok">AI sales assistant for WhatsApp</span> {/* eyebrow pill */}
          <h1>Your WhatsApp shop, open 24/7.</h1> {/* the ONE promise (biggest type on page) */}
          <p>Customers message you at midnight. Vendora answers in seconds — prices, stock, hours — in English or Pidgin. You only step in when a human touch truly matters.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}> {/* CTA row (wraps on phones) */}
            <Link className="btn" to="/login">Start free — 14 days</Link>
            <a className="btn ghost" href="#how">See how it works</a> {/* plain <a href="#how"> = in-page ANCHOR jump (no router involved — scrolls to id="how" below!) */}
          </div>
          <p className="hint" style={{ marginTop: 12 }}>No card required · Set up in 15 minutes · Cancel anytime</p> {/* objection-killers (middle dots ·) */}
          <div className="landing-hero-photo"> {/* real photo slot: save frontend/public/photos/hero.jpg (1200×800). Missing file hides itself (onError) — layout never breaks! */}
            <img src="/photos/hero.jpg" alt="Shop owner chatting with customers on WhatsApp" loading="lazy" decoding="async" onError={(e) => { e.target.closest('.landing-hero-photo').style.display = 'none'; }} />
          </div>
        </div>
        <div className="landing-phone"> {/* right: fake phone with sample chat (CSS bubbles + float animation!) */}
          <div className="landing-phone-head"><i />Amaka Beauty Studio <span>online</span></div> {/* <i> = green dot; shop name + online */}
          <div className="bubble">Abeg, do you have blue gown?</div> {/* .bubble = customer (left, Pidgin! — speaks to the market) */}
          <div className="bubble-out">Yes — blue gown ₦45,000, in stock. Want me to reserve it for you?</div> {/* .bubble-out = AI (right, green — mirrors real chat UI!) */}
          <div className="bubble">How much for delivery to Lekki?</div>
          <div className="bubble-out">Delivery to Lekki is ₦2,500, arrives in 2–3 days. Should I pack it?</div>
        </div>
      </section>

      <p className="hint reveal" style={{ textAlign: 'center', margin: '6px 0 0' }}>Manual catalog free forever · 14-day Pro trial included · profile sync is Pro · pricing adapts to your location</p> {/* location-based pricing note (single currency shown below — never dual tags!) */}

      <section className="landing-inner grid3" id="how"> {/* id="how" = the anchor target from "See how it works"! grid3 = 3 columns → stack mobile */}
        <div className="card hover-lift reveal"><div className="how-thumb"><img src="/photos/how-1.jpg" alt="Teaching the bot with a WhatsApp message" loading="lazy" decoding="async" onError={(e) => { e.target.closest('.how-thumb').style.display = 'none'; }} /></div><h2>1. Teach it once</h2><p className="desc">Send <b>LEARN: Blue gown ₦45,000</b> from your WhatsApp — or add products here. Same name always updates the price.</p></div> {/* thumbs: frontend/public/photos/how-{1,2,3}.jpg (800×600), self-hiding when missing */}
        <div className="card hover-lift reveal"><div className="how-thumb"><img src="/photos/how-2.jpg" alt="AI replying to a customer instantly" loading="lazy" decoding="async" onError={(e) => { e.target.closest('.how-thumb').style.display = 'none'; }} /></div><h2>2. It sells while you sleep</h2><p className="desc">Every customer gets an instant, accurate answer from YOUR catalog. Never an invented price.</p></div>
        <div className="card hover-lift reveal"><div className="how-thumb"><img src="/photos/how-3.jpg" alt="Owner closing a flagged sale" loading="lazy" decoding="async" onError={(e) => { e.target.closest('.how-thumb').style.display = 'none'; }} /></div><h2>3. You close the hot ones</h2><p className="desc">Unsure moments get flagged to your inbox + WhatsApp instantly — with the customer's words attached.</p></div>
      </section>

      <section className="landing-inner grid3"> {/* pricing trio — ONE currency each, picked by visitor location (useCurrency hook below!) */}
        <div className="card hover-lift reveal">
          <h2>Monthly — {cur === 'USD' ? '$5' : '₦7,500'}</h2> {/* ternary per card: location decides the tag (no dual display!) */}
          <p className="desc">Pay as you grow. Every feature included, cancel anytime.</p>
          <Link className="btn ghost sm" to="/login">Start free trial</Link>
        </div>
        <div className="card hover-lift reveal" style={{ borderColor: '#25d366' }}> {/* inline borderColor = featured card pops (one-off override, no new class!) */}
          <h2>Yearly — {cur === 'USD' ? '$33' : '₦50,000'}</h2>
          <p className="desc"><b style={{ color: '#7ef0c0' }}>Save 44%+</b> vs paying monthly. Priority support included.</p>
          <Link className="btn sm" to="/login">Start free trial</Link> {/* solid (not ghost) = featured plan gets the primary button (eye-flow!) */}
        </div>
        <div className="card hover-lift reveal">
          <h2>Lifetime — {cur === 'USD' ? '$65' : '₦100,000'}</h2>
          <p className="desc">Pay once, sell forever. Pays for itself in ~14 months.</p>
          <Link className="btn ghost sm" to="/login">Start free trial</Link>
        </div>
      </section>

      <section className="landing-inner reveal"> {/* FAQ teaser → full /faq page (keeps landing short!) */}
        <div className="card hover-lift">
          <h2>Common questions</h2>
          <p className="desc">Pidgin support? LEARN mode? Billing? Answered in 60 seconds.</p>
          <Link className="btn ghost sm" to="/faq">Read FAQ</Link>
        </div>
      </section>

      <footer className="foot-links landing-inner"> {/* <footer> semantic landmark: legal links + copyright */}
        <Link to="/faq">FAQ</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link> {/* Router Links (client-side) */}
        <span className="hint">© 2026 Vendora · Made for shops that never sleep</span>
      </footer>
    </div>
  );
}
