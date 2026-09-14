// ── frontend/src/components/Tour.jsx ─────────────────────────────
// WHAT: first-run spotlight tour (5 coachmarks over the sidebar menu) + replay.
// Zero dependencies: raw DOM measurement (getBoundingClientRect) + fixed-position
// overlay divs. Progress in localStorage ('vendora-tour'). Mobile (<960px) gets
// centered cards instead of spotlights (no sidebar visible to point at).
// React patterns used: useState (step/box), useEffect (timers, listeners,
// measuring), useCallback (stable start/stop). Event 'vendora-tour' = global
// replay bus (Help button + Dashboard link dispatch it; Tour listens).
import { useCallback, useEffect, useState } from 'react'; // useCallback memoizes fns so effect deps stay stable

const STEPS = [ // the script: selector (where to point) + title + teaching text.
  // Selectors list BOTH desktop (.sidebar) and mobile (.mobile-bar) links — targetEl picks the VISIBLE one.
  { sel: '.sidebar nav a[href="/catalog"], .mobile-bar a[href="/catalog"]', title: '1 · Add what you sell', text: 'Your catalog is the brain. Add products here — or teach from WhatsApp with LEARN: Blue gown ₦45,000. The AI never quotes anything outside it.' }, // attribute selector a[href="…"] = link to that route
  { sel: '.sidebar nav a[href="/playground"], .mobile-bar a[href="/playground"]', title: '2 · Test like a customer', text: 'Pretend to be a buyer: ask prices, stock, hours — then something you don\'t sell, and watch the bot hand off instead of guessing.' }, // \' escapes the apostrophe inside a single-quoted string
  { sel: '.sidebar nav a[href="/chats"], .mobile-bar a[href="/chats"]', title: '3 · Your inbox', text: 'Every WhatsApp chat lands here. Green = AI handled. Gold = needs your human touch. Tap any chat to read the full thread.' },
  { sel: '.sidebar nav a[href="/vendora-ai"]', title: '4 · Vendora AI', text: 'Your personal assistant for everything else — captions, pricing ideas, replies to difficult customers. Pick from 7 AIs in the dropdown.' }, // desktop-only link (mobile bar lacks it → falls back to card mode there)
  { sel: '.sidebar nav a[href="/billing"], .mobile-bar a[href="/billing"]', title: '5 · Free vs Pro', text: 'Manual catalog is free forever. Pro adds profile sync, premium AIs and zero ads. Your 14-day Pro trial is already running.' },
];

function targetEl(sel) { // NOT a component (lowercase, returns a DOM node): find first VISIBLE match…
  const all = Array.from(document.querySelectorAll(sel)); // querySelectorAll = all matches (comma = OR); Array.from → real array for .find
  return all.find((el) => el.offsetParent !== null) || null; // offsetParent null = hidden (display:none) → skip; || null normalizes undefined
}

export default function Tour() { // default export: <Tour /> mounted once inside Shell
  const [step, setStep] = useState(-1); // -1 = tour hidden (renders null below); 0–4 = active step
  const [box, setBox] = useState(null); // measured {top,left,w,h} of the spotlight target (null = card mode)

  const stop = useCallback((done) => { // stop(done): hide + remember. useCallback = stable identity (safe in effect deps)
    setStep(-1); setBox(null); // -1 → component returns null (unmount visuals)
    try { localStorage.setItem('vendora-tour', done ? 'done' : 'skipped'); } catch {} // persist EITHER way (never nag twice)
  }, []); // [] deps = never changes (no external values used)

  const start = useCallback(() => { // begin at step 0…
    if (window.innerWidth < 960) { setStep(0); setBox(null); return; } // mobile: card mode immediately (measuring hidden sidebar is pointless)
    setStep(0); // desktop: step effect below measures the target
  }, []);

  useEffect(() => { // AUTO-START once + REPLAY listener. Runs on mount (and when start changes — it won't).
    let seen = null; // localStorage read guarded (private mode throws)…
    try { seen = localStorage.getItem('vendora-tour'); } catch {} // …so try/catch (seen stays null → tour WILL show, safe default)
    if (!seen) { // first visit ever → schedule auto-start…
      const t = setTimeout(() => { if (window.location.pathname === '/dashboard') start(); }, 1200); // 1.2s delay (splash lasts 1.5s… race is harmless: only starts ON dashboard)
      const onTour = () => start(); // replay handler: Dashboard link + Help button dispatch 'vendora-tour'
      window.addEventListener('vendora-tour', onTour); // global event bus (CustomEvent not needed — plain Event suffices, no data carried)
      return () => { clearTimeout(t); window.removeEventListener('vendora-tour', onTour); }; // cleanup BOTH on unmount (no leaks, no double-listeners)
    }
    const onTour = () => start(); // seen before → only the replay listener (no auto-start timer)
    window.addEventListener('vendora-tour', onTour);
    return () => window.removeEventListener('vendora-tour', onTour);
  }, [start]); // [start] dep (stable via useCallback → effect runs once)

  useEffect(() => { // MEASURE the spotlight target whenever step changes.
    if (step < 0) return; // hidden → nothing to measure (early return BEFORE listeners — hooks order stays valid because the return is after ALL hooks? NO — this IS a hook call site; conditional RETURN inside effect is fine, conditional HOOKS are not)
    if (window.innerWidth < 960) { setBox(null); return; } // PHONES: always card mode. The bottom-bar links ARE measurable, but a spotlight ring on them puts the tooltip below the bar = off-screen. Cards never misplace.
    const place = () => { // measure + store box…
      const el = targetEl(STEPS[step].sel); // find visible target for this step
      if (!el) { setBox(null); return; } // missing → card mode fallback (setBox(null) renders the centered card)
      const r = el.getBoundingClientRect(); // viewport-relative rect {top,left,width,height}
      setBox({ top: r.top + window.scrollY, left: r.left + window.scrollX, w: r.width, h: r.height }); // convert to DOCUMENT coords (fixed overlay uses these; scrollY compensates scroll)
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // gentle scroll so target is visible (nearest = minimal movement)
    };
    place(); // measure immediately…
    window.addEventListener('resize', place); // …and re-measure on window resize (responsive layout shifts targets)
    const t = setTimeout(place, 350); // …and once more after 350ms (fonts/images shifting layout — second pass corrects)
    return () => { window.removeEventListener('resize', place); clearTimeout(t); }; // cleanup on step change/unmount
  }, [step]); // [step] = re-run every step

  if (step < 0) return null; // hidden state: render NOTHING (React renders null = no DOM)
  const s = STEPS[step]; // current step shorthand
  const last = step === STEPS.length - 1; // last step? button says Finish (and go() stops instead of advancing)
  const go = (d) => { if (step + d >= STEPS.length) stop(true); else setStep(step + d); }; // d = +1/-1; past-the-end → stop(done)

  // Mobile or missing target: centered card.
  if (!box) { // card mode (no spotlight possible)…
    return (
      <div className="tour-overlay" onClick={() => stop(false)}> {/* fullscreen dim; click = skip (stop(false) records 'skipped') */}
        <div className="tour-card" onClick={(e) => e.stopPropagation()}> {/* stopPropagation = clicks INSIDE don't bubble to overlay (only outside clicks skip) */}
          <p className="hint">{s.title}</p> {/* eyebrow: "3 · Your inbox" */}
          <h3>{s.title.split('· ')[1]}</h3> {/* split('· ') → ['3','Your inbox']; [1] = clean title (reuses the string, no duplication!) */}
          <p>{s.text}</p>
          <div className="tour-nav">
            <button className="skip" onClick={() => stop(false)}>Skip tour</button> {/* .skip = link-styled button (CSS) */}
            <span className="hint">{step + 1} / {STEPS.length}</span> {/* "3 / 5" progress */}
            <span style={{ display: 'inline-flex', gap: 8 }}>
              {step > 0 && <button className="btn ghost sm" onClick={() => go(-1)}>Back</button>} {/* Back from step 1+ (same as desktop tooltip — phones deserve it too) */}
              <button className="btn sm" onClick={() => go(1)}>{last ? 'Finish' : 'Next'}</button>
            </span>
          </div>
        </div>
      </div>
    );
  }
  const below = box.top + box.h + 200 < document.documentElement.scrollHeight || box.top < window.innerHeight / 2; // tooltip BELOW target if room (or target in top half), else above (avoids viewport edges)
  return (
    <> {/* fragment <> = group without extra DOM node */}
      <div className="tour-dim" onClick={() => stop(false)} /> {/* fullscreen dim (self-closing: no children) */}
      <div className="tour-spot" style={{ top: box.top - 6, left: box.left - 6, width: box.w + 12, height: box.h + 12 }} /> {/* glowing ring: +6px padding around target (inline style = dynamic numbers CSS can't know) */}
      <div // the tooltip card, positioned near the target…
        className="tour-tip"
        style={below // ternary picks below-vs-above positioning object…
          ? { top: box.top + box.h + 14, left: Math.max(12, Math.min(box.left, window.innerWidth - 320)) } // …below: 14px gap; left CLAMPED 12px..(viewport-320) so card never overflows screen
          : { top: Math.max(12, box.top - 190), left: Math.max(12, Math.min(box.left, window.innerWidth - 320)) }} // …above: 190px up; same clamping
      >
        <p className="hint">{s.title}</p>
        <h3>{s.title.split('· ')[1]}</h3>
        <p>{s.text}</p>
        <div className="tour-nav">
          <button className="skip" onClick={() => stop(false)}>Skip</button>
          <span className="hint">{step + 1} / {STEPS.length}</span>
          <span style={{ display: 'inline-flex', gap: 8 }}> {/* inline-flex row for Back+Next */}
            {step > 0 && <button className="btn ghost sm" onClick={() => go(-1)}>Back</button>} {/* && conditional render: Back only from step 1+ (false renders nothing!) */}
            <button className="btn sm" onClick={() => go(1)}>{last ? 'Finish' : 'Next'}</button>
          </span>
        </div>
      </div>
    </>
  );
}

export function startTour() { // NAMED export (import { startTour }): replay entry for Help/Dashboard buttons
  try { localStorage.removeItem('vendora-tour'); } catch {} // clear the flag so auto-start COULD fire again…
  window.dispatchEvent(new Event('vendora-tour')); // …then fire the bus (Tour is mounted in Shell, so it hears everywhere)
  if (window.location.pathname !== '/dashboard') window.location.href = '/dashboard'; // tour points at sidebar items visible on every page, but dashboard is home base (full reload = simplest reliable nav here)
}
