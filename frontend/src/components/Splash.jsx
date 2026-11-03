// ── frontend/src/components/Splash.jsx ───────────────────────────
// WHAT: the brand intro, shown on every app start while data loads. The 3D logo
// assembles and turns (MarkReveal), then the wordmark and tagline arrive before
// the whole thing fades.
//
// 2.8s: the pieces lock at about 1.1s and the turn ends at 2.4s. The splash must
// outlast the turn, or the one authored moment in the app gets cut in half.
import { useEffect, useState } from 'react';
import VeloLoader from './VeloLoader.jsx';

export default function Splash({ done }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2700); // one full loop of the loader, then fade
    const t2 = setTimeout(done, 3050); // unmount once the fade has finished
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [done]);

  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="splash-inner">
        <VeloLoader size={120} light label="Loading VeloSales Ai" />
      </div>
    </div>
  );
}
