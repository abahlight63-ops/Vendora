// ── frontend/src/pages/Onboarding.jsx ────────────────────────────
// WHAT: the welcome tour — six slides, one idea each, seen once after signup.
//
// The old version put a 2MB AI stock photo on every slide and let the copy sit
// still underneath it. Two problems with that: photographs of smiling people
// sell nothing here, and "AI-generated" is the exact look we are avoiding. So
// the art is now the product itself — a phone that TYPES a customer's question
// and then answers it from the catalog. It teaches the thing it is advertising.
//
// The motion is the point:
//   · the headline arrives word by word (a cascade, not a fade)
//   · the body types itself out behind a caret, so you read it as it is written
//   · inside the phone, the customer's message types, then the answer lands
//   · the whole slide is swipeable / arrow-key navigable, and the art restarts
//
// Everything is deferred to prefers-reduced-motion at the CSS layer, and the
// typing hook below returns the finished string when that is set — the page
// must be readable without a single frame of animation.
import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { Link, useNavigate } from 'react-router-dom';
import Ic from '../components/icons.jsx';

const SLIDES = [
  {
    k: 'welcome',
    eyebrow: 'Welcome to VeloSales Ai',
    title: 'Never miss a customer again.',
    body: 'Your WhatsApp becomes a 24/7 shop assistant. Customers ask, VeloSales Ai answers from YOUR catalog — even at 2am.',
    art: 'chat1',
    points: [
      ['chat', 'Replies in seconds'],
      ['spark', 'English or Pidgin'],
      ['shield', 'Never invents prices'],
    ],
    cta: 'See how it works',
    foot: 'Free plan forever. No card needed to start.',
  },
  {
    k: 'flow',
    eyebrow: 'How it works',
    title: 'Message in. Sale out.',
    body: 'The customer writes like a human. The AI checks your real products, prices and hours — then answers like your best sales rep.',
    art: 'chat2',
    cta: 'Teach it your products',
    foot: 'Every answer cites a real product from your catalog.',
  },
  {
    k: 'learn',
    eyebrow: 'The LEARN trick · Free forever',
    title: 'Teach it with one message.',
    body: 'From YOUR WhatsApp number, send the same ad you put on your status. Send the same product again and it simply updates the price.',
    art: 'chat3',
    cta: 'Unlock Pro powers',
    foot: 'Works on the free plan, with a manual catalog.',
  },
  {
    k: 'sync',
    eyebrow: 'Pro · Profile sync',
    title: 'Verified against your profile.',
    body: 'Pro builds your whole catalog from your WhatsApp Business profile, then checks every "is it available?" against it. Nothing is guessed.',
    art: 'sync',
    cta: 'See the plans',
    foot: 'Pro only. Your catalog stays yours if you cancel.',
  },
  {
    k: 'plans',
    eyebrow: 'Free vs Pro',
    title: 'Free forever. Pro when ready.',
    body: 'A manual catalog stays free forever. Pro adds profile sync, product photos and priority answers — from ₦7,499 / $5 a month.',
    art: 'plans',
    cta: 'Almost done',
    foot: 'Switch or cancel any time — no contract.',
  },
  {
    k: 'ready',
    eyebrow: "You're set",
    title: 'Start selling tonight.',
    body: 'Your 7-day Pro trial is running, profile sync included. Add 3–5 products, test the bot like a customer, then connect WhatsApp.',
    art: 'ready',
    cta: 'Open my dashboard',
    foot: 'Most shops connect WhatsApp the same day.',
  },
];

/** True when the person asked the OS to calm animation down. */
function calm() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Types `text` out one character at a time, restarting whenever the string
 * changes (i.e. on every slide). Returns [visible, done].
 *
 * `enabled` is passed by the caller so a slide can type its body only after
 * its headline has landed — two typing runs at once is noise, not life.
 */
function useTyped(text, speed = 12, enabled = true) {
  const [n, setN] = useState(0);
  const quiet = useRef(false);

  useEffect(() => {
    quiet.current = calm();
    if (!enabled) {
      setN(0);
      return undefined;
    }
    if (quiet.current) {
      setN(text.length);
      return undefined;
    }
    setN(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed, enabled]);

  return [text.slice(0, n), n >= text.length && enabled];
}

/** The headline, arriving one word at a time. */
function Words({ text, delay = 0 }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <span
          key={i}
          className="wv-word"
          style={{ animationDelay: `${(delay + i * 0.055).toFixed(2)}s` }}
        >
          {w}
        </span>
      ))}
    </>
  );
}

/** A blinking caret while a line is still being written. */
function Caret({ on }) {
  if (!on) return null;
  return <span className="wv-caret" aria-hidden="true" />;
}

/* ── the art: a phone doing the job ─────────────────────────────────
   One frame, several scripts. The customer's message types; the answer
   lands after it. Both restart whenever `play` changes (the slide key). */
function PhoneArt({ variant }) {
  // the first message types; the rest of the script follows it
  const [lead, setLead] = useState('');
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
    setLead('');
    if (variant === 'sync' || variant === 'plans' || variant === 'ready') {
      setStage(1);
      return undefined;
    }
    const script = {
      chat1: 'Good evening! Do you have the blue gown?',
      chat2: 'How much for 3? And do you deliver to Yaba?',
      chat3: 'LEARN: New stock! Blue gown ₦45,000',
    }[variant] || '';
    if (calm()) {
      setLead(script);
      setStage(2);
      return undefined;
    }
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setLead(script.slice(0, i));
      if (i >= script.length) {
        clearInterval(t);
        // a beat of "reading", then the assistant answers
        setTimeout(() => setStage(2), 520);
      }
    }, 34);
    return () => clearInterval(t);
  }, [variant]);

  const typing = stage === 0;

  return (
    <div className="wv-phone" aria-hidden="true">
      <div className="wv-head">
        <span className="wv-av">
          <Logo size={19} />
        </span>
        <div className="wv-who">
          <b>Adaeze Fabrics</b>
          <span className="wv-on">
            <i /> online
          </span>
        </div>
        <span className="wv-time">9:41</span>
      </div>

      {variant === 'chat1' && (
        <div className="wv-thread">
          <p className="wv-in">{lead}<Caret on={typing} /></p>
          {stage === 2 && (
            <>
              <p className="wv-out">
                Yes — the blue gown is ₦45,000, in stock. Want me to reserve it
                for tomorrow?
              </p>
              <p className="wv-meta">
                <Ic n="checkCircle" s={13} /> checked 12 products · 9am–7pm
              </p>
            </>
          )}
        </div>
      )}

      {variant === 'chat2' && (
        <div className="wv-thread">
          <p className="wv-in">{lead}<Caret on={typing} /></p>
          {stage === 2 && (
            <>
              <p className="wv-out">
                3 gowns come to ₦126,000. Delivery to Yaba is free and lands
                tomorrow before noon.
              </p>
              <p className="wv-meta">
                <Ic n="checkCircle" s={13} /> matched 3 items · free delivery
              </p>
            </>
          )}
        </div>
      )}

      {variant === 'chat3' && (
        <div className="wv-thread">
          <p className="wv-note">You, from your own WhatsApp</p>
          <p className="wv-own">{lead}<Caret on={typing} /></p>
          {stage === 2 && (
            <>
              <p className="wv-ack">
                <Ic n="checkCircle" s={13} /> Catalog updated — 1 item. I'll use
                this from now on.
              </p>
              <p className="wv-out">Yes — ₦45,000, in stock.</p>
            </>
          )}
        </div>
      )}

      {variant === 'sync' && (
        <div className="wv-rows">
          <p className="wv-note">Scaffolded from your profile</p>
          {[
            ['Blue Ankara gown', '₦45,000'],
            ['Two-piece set', '₦38,500'],
            ['Head wrap', '₦7,500'],
            ['Bridal lace', '₦92,000'],
          ].map(([name, price], i) => (
            <div className="wv-row" key={name} style={{ animationDelay: `${0.1 + i * 0.09}s` }}>
              <Ic n="checkCircle" s={15} />
              <b>{name}</b>
              <span>{price}</span>
            </div>
          ))}
          <p className="wv-foot">
            <Ic n="shield" s={13} /> verified before every answer
          </p>
        </div>
      )}

      {variant === 'plans' && (
        <div className="wv-rows">
          <div className="wv-plan">
            <div>
              <b>Free</b>
              <span>Manual catalog · AI replies</span>
            </div>
            <em>₦0</em>
          </div>
          <div className="wv-plan now">
            <div>
              <b>Pro</b>
              <span>Profile sync · photos · priority</span>
            </div>
            <em>₦7,499<small>/mo</small></em>
          </div>
          <p className="wv-foot">Cancel anytime — the manual catalog never expires.</p>
        </div>
      )}

      {variant === 'ready' && (
        <div className="wv-rows">
          <p className="wv-note">Three things, then you're live</p>
          {[
            ['Add 3–5 products', 'Catalog'],
            ['Test the bot yourself', 'Test bot'],
            ['Connect WhatsApp', 'Connect'],
          ].map(([name, where], i) => (
            <div className="wv-row" key={name} style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
              <span className="wv-num">{i + 1}</span>
              <b>{name}</b>
              <span className="wv-tag">{where}</span>
            </div>
          ))}
          <p className="wv-foot">
            <Ic n="bolt" s={13} /> most shops finish in one evening
          </p>
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  useEffect(() => {
    document.title = 'VeloSales Ai — Welcome';
  }, []);
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const touchX = useRef(null);
  const slide = SLIDES[step];

  // headline must land before the body starts typing
  const [headlineDone, setHeadlineDone] = useState(calm());
  useEffect(() => {
    setHeadlineDone(calm());
    if (calm()) return undefined;
    const t = setTimeout(() => setHeadlineDone(true), 90 + slide.title.split(' ').length * 55 + 260);
    return () => clearTimeout(t);
  }, [step, slide.title]);

  const [body, bodyDone] = useTyped(slide.body, 11, headlineDone);

  function go(n) {
    const next = Math.max(0, Math.min(SLIDES.length - 1, n));
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  // arrow keys: a tour should not require aiming at a button
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(step + 1);
      if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-top">
          <span className="landing-brand">
            <Logo alt="VeloSales Ai" />
            VELOSALES AI
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <span className="hint" style={{ fontSize: 12.5, fontWeight: 600 }}>
              {step + 1} of {SLIDES.length}
            </span>
            <button className="skip" onClick={() => nav('/welcome')}>
              Skip intro
            </button>
          </span>
        </div>

        <div className="slide-bar" role="tablist" aria-label="Tour progress">
          {SLIDES.map((s, i) => (
            <button
              key={s.k}
              role="tab"
              aria-selected={i === step}
              aria-label={s.eyebrow}
              className={'sbar' + (i <= step ? ' on' : '')}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <div
          className="slide-stage"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (dx < -50) go(step + 1);
            else if (dx > 50) go(step - 1);
            touchX.current = null;
          }}
        >
          <div className={'slide' + (dir > 0 ? ' fwd' : ' back')} key={slide.k}>
            <div className="slide-art wv-art">
              <div className="wv-glow" />
              <PhoneArt variant={slide.art} />
            </div>

            <div className="slide-copy">
              <p className="crumb">{slide.eyebrow}</p>
              <h1>
                <Words text={slide.title} delay={0.06} />
              </h1>
              <p className="lede wv-lede">
                {body}
                <Caret on={headlineDone && !bodyDone} />
              </p>

              {slide.points && (
                <div className="slide-points">
                  {slide.points.map(([ic, t]) => (
                    <span key={t}>
                      <Ic n={ic} s={15} />
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {slide.k === 'plans' && (
                <div className="qa-list">
                  <div className="qa static">
                    <Ic n="checkCircle" s={17} />
                    <div>
                      <b>Free forever</b>
                      <span className="hint">Manual catalog + AI replies</span>
                    </div>
                  </div>
                  <Link className="qa" to="/billing">
                    <Ic n="bolt" s={17} />
                    <div>
                      <b>Pro — from ₦7,499/mo</b>
                      <span className="hint">
                        Profile sync · photos · priority · priced in your currency
                      </span>
                    </div>
                  </Link>
                </div>
              )}

              {slide.k === 'ready' && (
                <div className="qa-list">
                  <Link className="qa" to="/catalog">
                    <Ic n="box" s={17} />
                    <div>
                      <b>Add your products</b>
                      <span className="hint">3–5 to start is plenty</span>
                    </div>
                  </Link>
                  <Link className="qa" to="/connect">
                    <Ic n="plug" s={17} />
                    <div>
                      <b>Connect WhatsApp + Telegram</b>
                      <span className="hint">TEST to LIVE in minutes</span>
                    </div>
                  </Link>
                  <Link className="qa" to="/playground">
                    <Ic n="play" s={17} />
                    <div>
                      <b>Test like a customer</b>
                      <span className="hint">Ask for prices, then chaos</span>
                    </div>
                  </Link>
                </div>
              )}

              {slide.foot ? <p className="slide-foot">{slide.foot}</p> : null}
            </div>
          </div>
        </div>

        <div className="foot-nav welcome-nav">
          <button className="btn ghost" disabled={step === 0} onClick={() => go(step - 1)}>
            <Ic n="back" s={15} /> Back
          </button>
          <button
            className="btn"
            onClick={() => (step < SLIDES.length - 1 ? go(step + 1) : nav('/welcome'))}
          >
            {slide.cta} <Ic n="next" s={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
