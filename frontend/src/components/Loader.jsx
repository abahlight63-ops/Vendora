// ── frontend/src/components/Loader.jsx ─────────────────────────────
// WHAT: the ONE spinner — the orbit. A dashed ring turning around the V, two
// dots riding it. Minimal at 15px inside a button, hero at 88px on a page.
//
// There is deliberately only one spinner in this app. A second style (a bare
// ring here, a dots row there) is what makes a product look assembled from
// parts; everything that says "working" says it with this.
//
// COLOUR: the ring reads its colours from --orb-a/--orb-b/--orb-dot, which are
// brand purple by default and currentColor inside a .btn — on a solid purple
// button the purple ring would otherwise disappear into its own background.
//
// GRADIENT IDS ARE PER-INSTANCE (useId): an SVG gradient id is document-wide,
// so two spinners on one page with a hard-coded id both resolve to the first.
// Harmless here (same colours) but wrong, and the mark had the same bug.
//
// BrandGate (below): the full-page loading FACE — assembling mark + wordmark,
// for route fallbacks, guards and session checks.
import { useEffect, useId, useState } from 'react';
import MarkReveal from './MarkReveal.jsx';
import Logo from './Logo.jsx';

export default function Loader({ size = 40, withLogo = false, label = 'Loading' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, ''); // ":r1:" → "r1" (CSS-safe fragment)
  const gid = `orb-${uid}`;
  return (
    <span className="orbit-loader" style={{ width: size, height: size }} role="status" aria-label={label}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--orb-a)" /><stop offset="1" stopColor="var(--orb-b)" />
          </linearGradient>
        </defs>
        <g className="orbit-spin">
          <circle cx="60" cy="60" r="44" fill="none" stroke={`url(#${gid})`} strokeWidth="4" strokeDasharray="42 26" strokeLinecap="round" />
          <circle cx="60" cy="16" r="6" fill="var(--orb-dot)" />
          <circle cx="60" cy="104" r="5" fill="var(--orb-b)" />
        </g>
        {withLogo
          ? <g transform="translate(38 34)"><Logo width={44} height={51} /></g>
          : <path d="M42 44 L60 78 L78 44" fill="none" stroke={`url(#${gid})`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />}
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
