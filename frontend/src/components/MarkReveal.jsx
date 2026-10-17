// ── frontend/src/components/MarkReveal.jsx ─────────────────────────
// WHAT: the brand mark assembling itself — the one authored motion in the app.
//
// The reference animation works like this: the parts arrive scattered and
// spinning, sweep around a centre they are not yet part of, converge, and snap
// into the finished mark. This is that, built from OUR geometry: the mark
// genuinely IS three triangles (see MARK_PIECES in Logo.jsx), so it can come
// apart and go back together for real rather than being a clipped bitmap.
//
// Replaces the old ScatterLogo, which cut a raster PNG into 4×4 tiles and flung
// them around. That read as a photo being jumbled, not as a mark being drawn.
//
// Timing is compressed for the web splash, which is deliberately short (1.2s
// total) so the app feels instant. The phone's splash is longer and runs the
// same sequence with more room (mobile/lib/widgets/logo_reveal.dart).
import { MARK_PIECES } from './Logo.jsx';

export default function MarkReveal({ size = 112, className = '' }) {
  const h = size;
  const w = size * (602 / 696);

  return (
    <span
      className={`reveal-mark${className ? ' ' + className : ''}`}
      style={{ width: w, height: h }}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 602 696" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient
            id="rv-g"
            gradientUnits="userSpaceOnUse"
            x1="301"
            y1="0"
            x2="301"
            y2="696"
          >
            <stop offset="0" style={{ stopColor: 'var(--lg-top)' }} />
            <stop offset=".5" style={{ stopColor: 'var(--lg-mid)' }} />
            <stop offset="1" style={{ stopColor: 'var(--lg-bot)' }} />
          </linearGradient>
          <clipPath id="rv-clip">
            <path d={MARK_PIECES.map((p) => p.d).join(' ')} clipRule="evenodd" />
          </clipPath>
        </defs>

        {/* The ring the pieces sweep around before they belong to it. */}
        <g className="rv-ring">
          <circle cx="301" cy="348" r="424" />
        </g>

        {/* The finished mark, revealed only once the pieces are home. Three
            anti-aliased triangles that share edges always leave a hairline
            where they meet; this single even-odd path covers it. It stays
            invisible until the assembly is done, so it never ghosts behind
            the pieces while they are still apart. */}
        <path className="rv-join" d={MARK_PIECES.map((p) => p.d).join(' ')} fillRule="evenodd" fill="url(#rv-g)" />

        {MARK_PIECES.map((p, i) => (
          <g
            key={i}
            className="rv-piece"
            style={{
              '--ox': `${p.ox}px`,
              '--oy': `${p.oy}px`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--dr': `${p.rot}deg`,
              '--dl': `${(i * 0.05).toFixed(2)}s`,
            }}
          >
            <path d={p.d} fill="url(#rv-g)" />
          </g>
        ))}

        {/* A light crossing the finished mark. */}
        <g clipPath="url(#rv-clip)">
          <rect className="rv-shine" x="60" y="-40" width="140" height="780" fill="#fff" />
        </g>
      </svg>
    </span>
  );
}
