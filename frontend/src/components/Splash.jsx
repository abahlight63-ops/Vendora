// ── frontend/src/components/Splash.jsx ──────────────────────────────
// WHAT: the brand intro on every app start — the supplied logo clip centred
// on the near-black stage (the same field the logo was drawn for) with the
// wordmark + tagline under it, then a fade to the app.
// TIMING: the clip is 4.6s and plays untouched, so a first visit waits it
// out; later visits in the same tab get a short splash. Reduced motion
// skips the wait entirely.
// LESSON (why `plan` is a ref, not state read inside the effect): the
// "have I been here before?" answer must be taken ONCE per mount. If the
// effect read it itself, its own markSeen() call would flip the answer on a
// second run — which is exactly what React StrictMode's dev double-invoke
// does, collapsing the full intro to the short one.
import { useEffect, useState, useRef, useCallback } from 'react';
import LogoReveal from './LogoReveal.jsx'; // the centred logo animation

const SEEN = 'velosales-splash-seen';

function firstVisit() { // true once per browser tab (sessionStorage dies with the tab)
  try { return !sessionStorage.getItem(SEEN); } catch (e) { return false; } // private mode: assume seen, keep boots short
}
function markSeen() { try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* blocked storage: we just play it again */ } }

export default function Splash({ done }) { // done = callback prop: App hides splash when called
  const [out, setOut] = useState(false); // false → visible; true → fading (CSS .out transition)
  const plan = useRef(null); // the timing decision, taken once at mount
  const onReady = useCallback(() => {}, []); // LogoReveal already guarantees a painted first frame

  if (plan.current === null) { // first render only — StrictMode's second pass reuses this
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* no matchMedia */ }
    plan.current = reduced ? 500 : firstVisit() ? 4600 : 1100;
    markSeen();
  }

  useEffect(() => { // run once on mount: fade at hold-400, unmount at hold
    const hold = plan.current;
    const t1 = setTimeout(() => setOut(true), Math.max(0, hold - 400));
    const t2 = setTimeout(done, hold);
    return () => { clearTimeout(t1); clearTimeout(t2); }; // cleanup: never leave a timer pointing at an unmounted tree
  }, [done]); // [done] dep: re-run if the callback identity changes (useCallback in App keeps it stable)

  return (
    <div className={'splash' + (out ? ' out' : '')}> {/* string concat toggles the fade class */}
      <div className="splash-inner"> {/* centred stack: stage, wordmark, tagline, bar */}
        <LogoReveal size={196} onReady={onReady} /> {/* the clip, centred, exactly as supplied */}
        <div className="splash-name">VELOSALES AI</div> {/* letterspaced brand text */}
        <div className="splash-tag">Your WhatsApp shop, open 24/7</div> {/* tagline */}
        <div className="splash-bar"><i /></div> {/* indeterminate loading bar (CSS slides the <i> forever) */}
      </div>
    </div>
  );
}