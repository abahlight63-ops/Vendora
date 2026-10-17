// ── frontend/src/components/Splash.jsx ───────────────────────────
// WHAT: the brand intro, shown on every app start while data loads. The mark
// assembles itself (MarkReveal), the wordmark rises in letter by letter, the
// tagline follows, and a bar sweeps underneath before the whole thing fades.
//
// 1.15s. It was 0.9s, which cut the mark off mid-assembly — the splash faded
// before the logo had finished forming. Long enough for the choreography to
// land, short enough that it does not read as waiting.
import { useEffect, useState } from 'react';
import MarkReveal from './MarkReveal.jsx';

const NAME = 'VeloSales Ai';

export default function Splash({ done }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    // 1.2s total. The previous 0.9s cut the mark off mid-assembly — the splash
    // faded out before the logo had finished forming, so the one piece of
    // authored motion in the app was never actually seen.
    const t1 = setTimeout(() => setOut(true), 950); // start the fade
    const t2 = setTimeout(done, 1200); // unmount once the fade has finished
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
