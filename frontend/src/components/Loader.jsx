// ── frontend/src/components/Loader.jsx ─────────────────────────────
// WHAT: the app's loaders. Up to 28px it is a coral and indigo arc, for inside
// buttons (it follows the text colour there). Larger, it is the small 3D logo
// turning in its ring. Everything that says "working" says it with one of these.
//
// BrandGate (below): the full-page loading FACE — assembling mark + wordmark,
// for route fallbacks, guards and session checks.
import { useEffect, useState } from 'react';
import { MarkTurn } from './MarkReveal.jsx';

export default function Loader({ size = 40, label = 'Loading' }) {
  if (size > 28) return <MarkTurn size={size} />;
  return <span className="orbit-loader" style={{ width: size, height: size }} role="status" aria-label={label} />;
}

export function BrandGate({ size = 62, label = 'VeloSales Ai' }) { // full-page loading face (route fallbacks, guards, session checks)
  return (
    <div className="brandgate" role="status" aria-label="Loading">
      <MarkTurn size={size} />
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
