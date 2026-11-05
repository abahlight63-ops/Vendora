// ── frontend/src/components/Splash.jsx ───────────────────────────
// WHAT: the brand intro, shown on every app start while data loads. The 3D logo
// assembles and turns (MarkReveal), then the wordmark and tagline arrive before
// the whole thing fades.
//
// 2.8s: the pieces lock at about 1.1s and the turn ends at 2.4s. The splash must
// outlast the turn, or the one authored moment in the app gets cut in half.
import { useEffect, useState } from 'react';
import VeloLoader from './VeloLoader.jsx';

// ready = the app knows who is signed in. The splash plays at least one full
// loop, then keeps playing until ready, then fades: one loading screen, never two.
export default function Splash({ done, ready = true }) {
  const [out, setOut] = useState(false);
  const [looped, setLooped] = useState(false);

  useEffect(() => { const t = setTimeout(() => setLooped(true), 2700); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!looped || !ready) return undefined;
    setOut(true);
    const t = setTimeout(done, 350); // unmount once the fade has finished
    return () => clearTimeout(t);
  }, [looped, ready, done]);

  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="splash-inner">
        <VeloLoader size={120} light label="Loading VeloSales Ai" />
      </div>
    </div>
  );
}
