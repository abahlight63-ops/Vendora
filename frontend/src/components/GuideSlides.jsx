// ── frontend/src/components/GuideSlides.jsx ────────────────────────
// WHAT: visual how-to slides for the Connect road cards (WhatsApp / Telegram).
// Auto-rotates every few seconds (NO clickable dots/arrows — these cards live
// INSIDE tappable road buttons, so controls would be invalid nesting +
// mis-taps!).
//
// THE ART: until a real screenshot is dropped into public/connect/, the frame
// draws a small phone with the step number and the step's own words. It used
// to draw a full-width 16:9 grey box that said "screenshot lands here" — a
// placeholder the size of a poster, which made a working page look unfinished.
// A compact drawn tile reads as intentional, and the real screenshot simply
// replaces it when it arrives (onError still hides broken images).
//
// Props: slides [{img, title, text}], label (aria), interval ms.
import { useEffect, useState } from 'react'; // useState = index + missing-map; useEffect = rotation timer

export default function GuideSlides({ slides = [], label = 'How it works', interval = 4000 }) {
  const [i, setI] = useState(0); // current slide index
  const [missing, setMissing] = useState({}); // src → true (screenshot not dropped in yet!)
  useEffect(() => { // auto-rotate (pauses naturally on unmount — cleanup clears it!)
    if (!slides.length) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [slides.length, interval]);
  if (!slides.length) return null; // nothing to show (misuse guard!)
  const n = i % slides.length;
  const s = slides[n];
  const gone = !!missing[s.img]; // this screenshot missing? → drawn tile (never broken-image!)
  return (
    <div className="gslide" aria-label={label}>
      <div className="gslide-frame">
        {!gone ? (
          <img src={s.img} alt="" loading="lazy" onError={() => setMissing((m) => ({ ...m, [s.img]: true }))} />
        ) : (
          <div className="gslide-ph" aria-hidden="true">
            <span className="gslide-phone">
              <span className="gslide-cam" />
              <span className="gslide-bubble"><b>{n + 1}</b></span>
              <span className="gslide-bubble alt" />
              <span className="gslide-bubble short" />
              <span className="gslide-bar" />
            </span>
          </div>
        )}
      </div>
      <div className="gslide-main">
        <div className="gslide-cap"><b>{s.title}</b><span className="hint">{s.text}</span></div>
        <div className="gslide-dots" aria-hidden="true">{slides.map((_, d) => (<span key={d} className={d === n ? 'on' : ''} />))}</div>
      </div>
    </div>
  );
}
