// ── frontend/src/pages/Landing.jsx ─────────────────────────────────
// WHAT: the web app's front door at /, and the same six slides as the phone's
// lib/screens/welcome_screen.dart. Real sellers, the WhatsApp messages Velo sends
// for them, the channels it works on, then the free offer. One action on every
// slide: Try it free. Guests only: App routes signed-in owners to /dashboard.
//
// MOTION: slides change every 7 seconds and stop while the pointer or keyboard
// focus is on them, or after the pause button. Reduced motion: no auto-advance,
// no zoom and no floating. Swipe and the arrow keys move between slides.
//
// PHOTOS: free Unsplash photos (see public/welcome/CREDITS.md). Before big
// marketing, swap them for the shop's own customers, with written consent.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';
import { CHANNEL_COINS, CHANNELS } from '../lib/channelLogos.js';

const STEP_MS = 7000;

const SLIDES = [
  {
    photo: 's1', pos: '50% 30%',
    title: 'Never miss a customer again',
    text: 'Velo answers your WhatsApp in seconds, day and night, with your real prices.',
    a: { coin: 'whatsapp', who: 'Customer', say: 'Is this bag still available?', top: 2 },
    b: { tick: true, who: 'Velo', say: 'Yes! ₦45,000. We deliver tomorrow.', top: 25 },
  },
  {
    photo: 's2', pos: '50% 50%',
    title: 'Chats that turn into sales',
    text: 'Velo sends the product photo, quotes your price and tells buyers how to pay you.',
    a: { thumb: '/welcome/s2-900.jpg', who: 'Photo sent', say: 'Black leather bag · ₦45,000', top: 4 },
    b: { naira: true, who: 'New order', say: '2 bags · ₦90,000', top: 76 },
  },
  {
    photo: 's3', pos: '50% 50%',
    title: 'Speaks Pidgin, never guesses',
    text: "Velo answers the way your customers write. It only quotes your prices, and calls you when it isn't sure.",
    a: { coin: 'whatsapp', who: 'Customer', say: 'How much be this one?', top: 4 },
    b: { tick: true, who: 'Velo', say: 'Na ₦12,500. E still dey!', top: 82 },
  },
  {
    art: 'channels',
    title: 'Every chat app, one Velo',
    text: 'WhatsApp and Telegram today. Facebook Messenger and Instagram are coming soon, answered by the same Velo.',
  },
  {
    art: 'connect',
    title: 'WhatsApp in one tap',
    text: 'Log in with Facebook, choose your number and Velo starts answering. Telegram takes about a minute.',
  },
  {
    photo: 's4', pos: '50% 50%',
    title: 'Start free and sell more today',
    text: '50 free replies every day. No card needed.',
    a: { gift: true, who: 'Free plan', say: '50 replies every day', top: 8 },
    b: { tick: true, who: 'Bonus', say: 'Pro free for 7 days', top: 80 },
  },
];

function Coin({ id, size = 46 }) {
  return <svg className="ws-coin" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHANNEL_COINS[id] }} />;
}

function Pill({ side, m }) {
  const icon = m.coin ? <Coin id={m.coin} />
    : m.thumb ? <img src={m.thumb} alt="" />
      : m.naira ? <b>₦</b>
        : m.gift ? <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0" /></svg>
          : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  return (
    <div className={'ws-pill ws-pill-' + side + (m.gift ? ' is-gift' : '')} style={{ '--top': m.top + '%' }}>
      <span className="ws-pill-ic">{icon}</span>
      <span><small>{m.who}</small>{m.say}</span>
    </div>
  );
}

function ChannelsArt() {
  return (
    <div className="ws-orbit-wrap" aria-hidden="true">
      <div className="ws-ring" />
      <div className="ws-orbit">
        {CHANNELS.map((c, i) => (
          <div key={c.id} className="ws-sat is-live" style={{ '--a': (i * 90 - 45) + 'deg' }}>
            <i className="ws-beam" />
            <div className="ws-sat-coin"><Coin id={c.id} size={58} /></div>
          </div>
        ))}
      </div>
      <div className="ws-core"><Logo size={56} alt="" /></div>
    </div>
  );
}

function ConnectArt() {
  return (
    <div className="ws-connect" aria-hidden="true">
      <div className="ws-connect-head"><b>Channels</b><span>Velo answers on</span></div>
      {CHANNELS.map((c) => (
        <div key={c.id} className="ws-crow">
          <Coin id={c.id} size={42} />
          <span className="ws-crow-name"><b>{c.id === 'messenger' ? 'Facebook Messenger' : c.name}</b><small>{c.id === 'whatsapp' ? 'Business number' : c.id === 'telegram' ? 'Your shop bot' : 'Coming soon'}</small></span>
          {c.id === 'whatsapp' ? (
            <span className="ws-cbtn">
              <span className="ws-cbtn-a">Connect</span>
              <span className="ws-cbtn-b"><i className="ws-cspin" />Connecting</span>
              <span className="ws-cbtn-c">✓ Live</span>
              <i className="ws-tap" />
            </span>
          ) : c.live ? <span className="ws-chip is-live">✓ Live</span> : <span className="ws-chip">Soon</span>}
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false); // the pause button
  const [held, setHeld] = useState(false); // pointer or focus is on the slides
  const [still, setStill] = useState(false); // reduced motion
  const drag = useRef(null);
  const n = SLIDES.length;
  const go = useCallback((i) => setCur(((i % n) + n) % n), [n]);

  useEffect(() => {
    setPageMeta({
      title: 'VeloSales Ai — Your WhatsApp sales assistant, open 24/7',
      description: 'VeloSales Ai answers your WhatsApp and Telegram customers in seconds, in English or Pidgin, with your real prices. Free plan with 50 replies a day, 7-day Pro trial, no card needed.',
      canonical: APP_URL + '/',
    });
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const set = () => setStill(!!(mq && mq.matches));
    set();
    if (mq && mq.addEventListener) mq.addEventListener('change', set);
    return () => { if (mq && mq.removeEventListener) mq.removeEventListener('change', set); };
  }, []);

  useEffect(() => {
    if (paused || held || still) return undefined;
    const t = setTimeout(() => go(cur + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [cur, paused, held, still, go]);

  function onKey(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
  }
  function down(e) { drag.current = { x: e.clientX, y: e.clientY }; setHeld(true); }
  function up(e) {
    const d = drag.current;
    drag.current = null;
    if (e.pointerType !== 'mouse') setHeld(false);
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
  }

  return (
    <div className="landing">
      <section
        className={'ws' + (still ? ' is-still' : '')}
        aria-roledescription="carousel"
        aria-label="What VeloSales Ai does"
        onKeyDown={onKey}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false); }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() => { drag.current = null; setHeld(false); }}
      >
        <h1 className="sr-only">VeloSales Ai: your WhatsApp sales assistant</h1>
        {SLIDES.map((s, i) => (
          <div key={i} className={'ws-slide' + (i === cur ? ' on' : '') + (s.art ? ' is-art' : '')} aria-hidden={i !== cur} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}>
            {s.photo ? (
              <>
                <img className="ws-photo" src={`/welcome/${s.photo}-1800.jpg`} srcSet={`/welcome/${s.photo}-900.jpg 900w, /welcome/${s.photo}-1800.jpg 1800w`} sizes="100vw" style={{ objectPosition: s.pos }} alt="" loading={i < 2 ? 'eager' : 'lazy'} draggable="false" />
                <i className="ws-tint" />
              </>
            ) : <i className="ws-stage" />}
            <i className="ws-shade" />
            <div className="ws-art">
              {s.a && <Pill side="a" m={s.a} />}
              {s.b && <Pill side="b" m={s.b} />}
              {s.art === 'channels' && <ChannelsArt />}
              {s.art === 'connect' && <ConnectArt />}
            </div>
            <div className="ws-copy">
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </div>
          </div>
        ))}

        <header className="ws-top">
          <span className="ws-brand"><Logo size={22} alt="" />VeloSales Ai</span>
          <div className="ws-nav">
            <button type="button" className="ws-circ is-glass" onClick={() => go(cur - 1)} aria-label="Previous slide">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button type="button" className="ws-circ is-white" onClick={() => go(cur + 1)} aria-label="Next slide">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className="ws-dots">
              {SLIDES.map((_, i) => <button key={i} type="button" className={i === cur ? 'on' : ''} aria-label={`Slide ${i + 1} of ${n}`} aria-current={i === cur ? 'true' : undefined} onClick={() => go(i)} />)}
              {!still && (
                <button type="button" className="ws-pause" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play slides' : 'Pause slides'}>
                  {paused
                    ? <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4l13 8-13 8z" /></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="ws-actions">
          <Link className="ws-go" to="/login?mode=signup">
            <b>Try it free</b>
            <span className="ws-chev" aria-hidden="true">{[0, 1, 2].map((k) => <svg key={k} width="12" height="18" viewBox="0 0 14 20"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M4 4l6 6-6 6" /></svg>)}</span>
            <span className="ws-knob" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M5 12h13M13 6l6 6-6 6" /></svg></span>
          </Link>
          <p className="ws-sign">No card needed · Already selling? <Link to="/login">Sign in</Link></p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
