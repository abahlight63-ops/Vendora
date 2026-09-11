// ── frontend/src/pages/Onboarding.jsx ────────────────────────────
// WHAT: AgriStock-style welcome tour — 6 swipeable slides (counter 01/06,
// progress dots, Back/Next, Skip, image per slide with icon fallback).
// Seen once after signup (Login routes new accounts here). Neumorphic card
// styling scoped to .neu-* classes (dashboard keeps flat clarity!).
// React patterns: slide data array, direction-aware animation key, touch swipe,
// SlideImg fallback chain (png → jpg → svg → icon slot).
import { useEffect, useRef, useState } from 'react'; // useEffect = title; useRef = touch X WITHOUT re-render (mutable box!); useState = step/dir
import { Link, useNavigate } from 'react-router-dom'; // Link = in-slide links (plans/checklist); useNavigate = Skip + Finish
import Ic from '../components/icons.jsx'; // slide art + row icons

// Drop ChatGPT-generated art at frontend/public/welcome-1.png … welcome-6.png
// (800×600). Missing files fall back to the icon slot automatically.
const SLIDES = [ // slide SCRIPT: data, not JSX (add a slide = add an object!). icon = fallback art; img = BASE path (SlideImg tries extensions).
  {
    k: 'welcome', icon: 'store', img: '/welcome-1', eyebrow: 'Welcome to Vendora', title: 'Never miss a customer again.', // k = stable key (dot buttons + animation key); eyebrow = small caps kicker
    body: 'Your WhatsApp becomes a 24/7 shop assistant. Customers ask, Vendora answers from YOUR catalog — even at 2am.',
    points: [['chat', 'Replies in seconds'], ['spark', 'English or Pidgin'], ['shield', 'Never invents prices']], // [icon, text] chips row
    cta: 'See how it works', // Next-button label for THIS slide (each slide sells the next!)
  },
  {
    k: 'flow', icon: 'chat', img: '/welcome-2', eyebrow: 'How it works', title: 'Message in. Sale out.',
    body: 'Customer writes naturally. The AI checks your real products, prices and hours — then replies like your best sales rep.',
    demo: true, cta: 'Teach it your products', // demo flag = render the mini chat sample below
  },
  {
    k: 'learn', icon: 'spark', img: '/welcome-3', eyebrow: 'The LEARN trick · Free forever', title: 'Teach it with one message.',
    body: 'From YOUR WhatsApp number, paste the same ad you put on your status. Same product sent again simply updates the price.',
    code: true, cta: 'Unlock Pro powers', // code flag = render the LEARN: sample box
  },
  {
    k: 'sync', icon: 'shield', img: '/welcome-4', eyebrow: 'Pro · Profile sync', title: 'Verified against your profile.',
    body: 'Pro scaffolds your whole catalog from your WhatsApp Business profile — then verifies every "is it available?" against it.',
    points: [['box', 'Auto-scaffold catalog'], ['checkCircle', 'Verified answers'], ['bolt', 'SYNC: from WhatsApp']],
    cta: 'See the plans',
  },
  {
    k: 'plans', icon: 'card', img: '/welcome-5', eyebrow: 'Free vs Pro', title: 'Free forever. Pro when ready.',
    body: 'Manual catalog stays free forever. Pro adds profile sync, priority support and zero ads — from ₦7,500 / $5 per month.',
    plans: true, cta: 'Almost done', // plans flag = free-vs-pro rows (Pro row LINKS to /billing!)
  },
  {
    k: 'ready', icon: 'checkCircle', img: '/welcome-6', eyebrow: "You're set", title: 'Start selling tonight.',
    body: 'Your 14-day Pro trial is running — profile sync included. Add 3–5 products, test the bot like a customer, then connect WhatsApp. Manual catalog stays free forever.',
    checklist: true, cta: 'Open my dashboard', // checklist flag = first-action links (Catalog, Test bot)
  },
];

const EXT_ORDER = ['.png', '.jpg', '.jpeg', '.svg']; // tried in order: your art first (any format!), our SVG placeholders last
function SlideImg({ src, icon, alt }) { // src = BASE ('/welcome-1'); tries each extension until one loads
  const [ext, setExt] = useState(0); // index into EXT_ORDER (0 = .png)
  if (ext >= EXT_ORDER.length) { // every format 404'd → icon placeholder (tour NEVER breaks on missing art!)
    return (
      <div className="neu-slot">
        <Ic n={icon} s={40} />
        <b>Your image here</b>
        <span>Add {src}.png or {src}.jpg to frontend/public</span> {/* tells YOU exactly what to do (dev-facing, but only visible with no art!) */}
      </div>
    );
  }
  return <img src={src + EXT_ORDER[ext]} alt={alt} className="neu-img" onError={() => setExt(ext + 1)} />; // string concat builds '/welcome-1.png'; onError (404) → next extension (escalation chain!)
}

export default function Onboarding() {
  useEffect(() => { document.title = 'Vendora — Welcome'; }, []); // tab title (mount-only)
  const nav = useNavigate(); // Skip intro + final CTA navigation
  const [step, setStep] = useState(0); // current slide index (0–5)
  const [dir, setDir] = useState(1); // slide direction: +1 forward / -1 back (drives fwd/back CSS animation!)
  const touchX = useRef(null); // touch-start X (useRef = mutable WITHOUT re-render — perfect for gesture tracking!)
  const slide = SLIDES[step]; // current slide object (shorthand used 10× below)
  function go(n) { // clamped navigation with direction tracking…
    const next = Math.max(0, Math.min(SLIDES.length - 1, n)); // Math.max/min CLAMP: 0 ≤ next ≤ 5 (can't overshoot either end!)
    setDir(next >= step ? 1 : -1); // direction = comparing target vs current (>= handles dot-jumps forward AND backward!)
    setStep(next); // two setStates = one re-render (batched) with slide + animation direction in sync
  }
  return (
    <div className="welcome neu-bg"> {/* fullscreen stage + neumorphic background tint */}
      <div className="welcome-inner"> {/* centered column (max-width) */}
        <div className="welcome-top">
          <span className="landing-brand"><img src="/logo.png" alt="Vendora" />VENDORA</span> {/* brand lockup (logo + letterspaced name) */}
          <button className="skip" onClick={() => nav('/dashboard')}>Skip intro</button> {/* link-styled skip (impatient users convert too!) */}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}> {/* counter + dots row */}
          <span className="hint" style={{ fontWeight: 800, letterSpacing: 1, whiteSpace: 'nowrap' }}>{String(step + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span> {/* "03 / 06": String() + padStart(2,'0') zero-pads (AgriStock-style counter!) */}
          <div className="slide-dots" style={{ flex: 1, margin: 0 }}>{SLIDES.map((s, i) => <button key={s.k} aria-label={s.eyebrow} className={'sdot' + (i === step ? ' on' : '')} onClick={() => go(i)} />)}</div> {/* dots: key={s.k} stable keys; aria-label = screen-reader names; .on highlights current; click jumps (go() computes direction!) */}
        </div>

        <div // swipe zone: touch handlers on the STAGE (not the slide — survives re-renders!)
          className="slide-stage"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }} // touches[0] = first finger; store X (no setState = no re-render mid-gesture!)
          onTouchEnd={(e) => { // finger lifted → measure horizontal travel…
            if (touchX.current === null) return; // guard: no start recorded (multi-touch edge)
            const dx = e.changedTouches[0].clientX - touchX.current; // changedTouches = fingers that LEFT (end event has no .touches!)
            if (dx < -50) go(step + 1); // swipe LEFT 50px+ = next (natural "push pages away" gesture)
            else if (dx > 50) go(step - 1); // swipe RIGHT 50px+ = back (go() clamps at ends — safe!)
            touchX.current = null; // reset for next gesture
          }}
        >
          <div className={'slide neu-card' + (dir > 0 ? ' fwd' : ' back')} key={slide.k}> {/* key={slide.k} = THE animation trick: new key → React UNMOUNTS old slide + mounts new (fresh .fwd/.back entrance every time!). dir picks slide direction class. */}
            <div className="slide-art neu-art"> {/* art panel: gradient + orbs + pressed frame */}
              <span className="orb o1" /><span className="orb o2" /> {/* ambient floating blobs (self-closing spans, pure CSS drift!) */}
              <div className="neu-frame"> {/* inset-shadow frame (neumorphic "pressed" look) */}
                <SlideImg src={slide.img} icon={slide.icon} alt={slide.eyebrow} /> {/* art with fallback chain (above) */}
              </div>
            </div>
            <div className="slide-copy neu-copy"> {/* copy panel: children stagger in via nth-child CSS delays! */}
              <p className="crumb">{slide.eyebrow}</p> {/* kicker */}
              <h1>{slide.title}</h1>
              <p className="lede">{slide.body}</p> {/* lede = intro paragraph style */}
              {slide.points && ( // points chips (slides 0 + 3 only — && conditional on the FLAG!)
                <div className="slide-points">{slide.points.map(([ic, t]) => <span key={t}><Ic n={ic} s={15} />{t}</span>)}</div> {/* destructure [icon, text] pairs; key={t} unique strings */}
              )}
              {slide.demo && ( // mini customer↔AI chat sample (slide 1)…
                <div className="learn-box light">Customer: "Abeg, do you have blue gown?"<div className="reply">AI: "Yes — blue gown ₦45,000, in stock. Want me to reserve it?"</div></div> {/* .learn-box.light = inset demo style (reused from Catalog tips!) */}
              )}
              {slide.code && ( // LEARN: sample (slide 2)…
                <div className="learn-box light">LEARN: New stock! Blue gown ₦45,000<div className="reply"><Ic n="checkCircle" s={14} /> Catalog updated — I'll now use this to answer customers.</div></div>
              )}
              {slide.plans && ( // Free-vs-Pro rows (slide 4 — Pro row is a real LINK!)…
                <div className="qa-list">
                  <div className="qa static"><Ic n="checkCircle" s={17} /><div><b>Free forever</b><span className="hint">Manual catalog + AI replies</span></div></div> {/* div (not Link) = non-clickable row (.static kills hover) */}
                  <Link className="qa" to="/billing"><Ic n="bolt" s={17} /><div><b>Pro — ₦7,500 / $5 per mo</b><span className="hint">Profile sync · no ads · priority</span></div></Link> {/* clickable upsell row → billing! */}
                </div>
              )}
              {slide.checklist && ( // first-action checklist (slide 5)…
                <div className="qa-list">
                  <Link className="qa" to="/catalog"><Ic n="box" s={17} /><div><b>Add your products</b><span className="hint">3–5 to start is plenty</span></div></Link>
                  <Link className="qa" to="/playground"><Ic n="play" s={17} /><div><b>Test like a customer</b><span className="hint">Ask for prices, then chaos</span></div></Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="foot-nav welcome-nav"> {/* bottom nav row */}
          <button className="btn ghost neu-btn" disabled={step === 0} onClick={() => go(step - 1)}><Ic n="back" s={15} /> Back</button> {/* disabled on first slide (can't go below 0 — go() would clamp anyway: defense in depth!) */}
          <button className="btn" onClick={() => step < SLIDES.length - 1 ? go(step + 1) : nav('/dashboard')}>{slide.cta} <Ic n="next" s={15} /></button> {/* ternary: advance (per-slide CTA label!) or finish → dashboard */}
        </div>
      </div>
    </div>
  );
}
