// ── frontend/src/components/Splash.jsx ───────────────────────────
// WHAT: the brand intro, shown on every app start while data loads. The 3D logo
// assembles and turns (MarkReveal), then the wordmark and tagline arrive before
// the whole thing fades.
//
// 2.8s: the pieces lock at about 1.1s and the turn ends at 2.4s. The splash must
// outlast the turn, or the one authored moment in the app gets cut in half.
import { useEffect, useState } from 'react';
import MarkReveal from './MarkReveal.jsx';

const NAME = 'VeloSales Ai';

export default function Splash({ done }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2450); // start the fade once the turn has finished
    const t2 = setTimeout(done, 2800); // unmount once the fade has finished
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [done]);

  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="splash-inner">
        <MarkReveal size={150} />
        <div className="splash-name" role="img" aria-label={NAME}>
          {NAME.split('').map((c, i) => (
            <span key={i} style={{ '--li': i }} aria-hidden="true">
              {c === ' ' ? '\u00A0' : c}
            </span>
          ))}
        </div>
        <div className="splash-tag">Your WhatsApp shop, open 24/7</div>
        <div className="splash-bar">
          <i />
        </div>
      </div>
    </div>
  );
}
