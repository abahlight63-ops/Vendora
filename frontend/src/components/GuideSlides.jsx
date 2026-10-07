// ── frontend/src/components/GuideSlides.jsx ────────────────────────
// WHAT: visual how-to slides for the Connect road cards (WhatsApp / Telegram).
// Auto-rotates every few seconds (NO clickable dots/arrows — these cards live
// INSIDE tappable road buttons, so controls would be invalid nesting +
// mis-taps!). Images drop into frontend/public/connect/ tonight; until then a
// branded placeholder shows (broken imgs hide via onError — never a torn icon!).
// Props: slides [{img, title, text}], label (aria), interval ms.
import { useEffect, useState } from 'react'; // useState = index + missing-map; useEffect = rotation timer

export default function GuideSlides({ slides = [], label = 'How it works', interval = 4000 }) {
  const [i, setI] = useState(0); // current slide index
  const [missing, setMissing] = useState({}); // src → true (screenshot not dropped in yet!)
  useEffect(() => { // auto-rotate (pauses naturally on unmount — cleanup clears it!)
    if (!slides.length) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [slides.length, interval]);
  if (!slides.length) return null; // nothing to show (misuse guard!)
  const n = i % slides.length;
  const s = slides[n];
  const gone = !!missing[s.img]; // this screenshot missing? → placeholder (never broken-image!)
  return (
    <div className="gslide" aria-label={label}>
      <div className="gslide-frame">
        {!gone && <img src={s.img} alt="" loading="lazy" onError={() => setMissing((m) => ({ ...m, [s.img]: true }))} />}
        {gone && (<div className="gslide-ph"><b>VeloSales Ai</b><span className="hint">Guide screenshot lands here</span></div>)}
      </div>
      <div className="gslide-cap"><b>{s.title}</b><span className="hint">{s.text}</span></div>
      <div className="gslide-dots" aria-hidden="true">{slides.map((_, d) => (<span key={d} className={d === n ? 'on' : ''} />))}</div>
    </div>
  );
}
