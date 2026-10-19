// ── frontend/src/components/Splash.jsx ───────────────────────────
// WHAT: the brand intro, shown on every app start while data loads. The mark
// assembles itself (MarkReveal), the wordmark drops in letter by letter, the
// tagline follows, and a bar sweeps underneath before the whole thing fades.
//
// 2.3s, because the choreography now has the reference's full sequence: parts
// fly in (1.0s), the outline draws, the mark settles, then twelve letters drop
// one at a time (1.1s → 1.88s). The splash has to outlast the last letter or
// the one authored moment in the app gets cut in half — which is exactly what
// the old 1.2s splash did.
import { useEffect, useState } from 'react';
import MarkReveal from './MarkReveal.jsx';

const NAME = 'VeloSales Ai';

export default function Splash({ done }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    // 1.95s: the last letter lands at 1.88s, so the fade starts just after the
    // wordmark is whole. 2.3s: unmount once the fade has finished.
    const t1 = setTimeout(() => setOut(true), 1950); // start the fade
    const t2 = setTimeout(done, 2300); // unmount once the fade has finished
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [done]);

  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="splash-inner">
        <MarkReveal size={104} />
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
