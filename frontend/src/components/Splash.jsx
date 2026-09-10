// ── frontend/src/components/Splash.jsx ───────────────────────────
// WHAT: the 1.5-second brand intro (logo float + loading bar + fade) shown on
// every app start while data loads. Pure CSS animations; React only times it.
// No npm modules — React hooks + styles.css keyframes.
import { useEffect, useState } from 'react'; // useState = fade flag; useEffect = timers

export default function Splash({ done }) { // done = callback prop: App hides splash when called
  const [out, setOut] = useState(false); // false → visible; true → fading (CSS .out transition)
  useEffect(() => { // runs ONCE on mount (empty deps [] = "do this once, like componentDidMount")
    const t1 = setTimeout(() => setOut(true), 1100); // after 1.1s: start fading (adds .out class → opacity transition)
    const t2 = setTimeout(done, 1500); // after 1.5s: tell App to unmount us (fade finished by then)
    return () => { clearTimeout(t1); clearTimeout(t2); }; // CLEANUP function: if unmounted early, cancel timers (prevents setState-on-unmounted warnings)
  }, [done]); // [done] dep: re-run if callback identity changes (useCallback in App keeps it stable)
  return (
    <div className={'splash' + (out ? ' out' : '')}> {/* string concat toggles the fade class */}
      <div className="splash-inner"> {/* cardIn-style entrance animation (CSS) */}
        <img src="/logo.png" alt="Vendora" className="splash-logo" /> {/* /logo.png = served from dist/public (Express static) */}
        <div className="splash-name">VENDORA</div> {/* letterspaced brand text */}
        <div className="splash-tag">Your WhatsApp shop, open 24/7</div> {/* tagline */}
        <div className="splash-bar"><i /></div> {/* indeterminate loading bar (CSS slides the <i> forever) */}
      </div>
    </div>
  );
}
