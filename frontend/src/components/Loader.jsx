// ── frontend/src/components/Loader.jsx ─────────────────────────────
// WHAT: the ONE branded loader (Orbit V) — V monogram + rotating dashed
// orbit (mint dot + gold dot). Minimal at 16px, hero at 88px.
// Props: size (px), withLogo (splash: logo mark rides inside the orbit).
// BrandGate (below): the full-page loading FACE — scatter-and-assemble logo
// + wordmark, for every route fallback, guard and session check (the selling
// point users recognize!). Buttons use mini <Loader size={15}/> inline.
// No npm modules — inline SVG + CSS keyframes.
import MarkReveal from './MarkReveal.jsx'; // the assemble-itself mark (the selling-point moment!)
import Logo from './Logo.jsx'; // inline vector mark — no bitmap in the spinner
import { useEffect, useState } from 'react'; // useMinDisplay timer (brand beat — see below!)
export default function Loader({ size = 40, withLogo = false }) {
  return (
    <span className="orbit-loader" style={{ width: size, height: size }} role="status" aria-label="Loading">
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="orbit-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="orb-stop-a" stopColor="#818cf8" /><stop offset="1" className="orb-stop-b" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <g className="orbit-spin">
          <circle cx="60" cy="60" r="44" fill="none" stroke="url(#orbit-g)" strokeWidth="4" strokeDasharray="42 26" strokeLinecap="round" />
          <circle cx="60" cy="16" r="6" className="orb-dot-mint" fill="#a5b4fc" />
          <circle cx="60" cy="104" r="5" fill="#6366f1" />
        </g>
        {withLogo
          ? <g transform="translate(38 34)"><Logo width={44} height={51} /></g>
          : <path d="M42 44 L60 78 L78 44" fill="none" stroke="url(#orbit-g)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}

export function BrandGate({ size = 76, label = 'VeloSales Ai' }) { // full-page loading face (route fallbacks, guards, session checks — everywhere users wait on blank screens!)
  return (
    <div className="brandgate" role="status" aria-label="Loading">
      <MarkReveal size={size} />
      <div className="brandgate-name">{label}</div>
    </div>
  );
}

export function useMinDisplay(ms = 1000) { // brand beat: gate stays UP at least ms even if data lands instantly (fast loads still register the mark — max 1s delay, only when faster!)
  const [minDone, setMinDone] = useState(false); // false → keep the gate (mount starts the clock!)
  useEffect(() => { // mount-only timer (cleanup on unmount — no stray state!)
    const t = setTimeout(() => setMinDone(true), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return minDone;
}
