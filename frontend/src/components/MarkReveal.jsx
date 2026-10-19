// ── frontend/src/components/MarkReveal.jsx ─────────────────────────
// WHAT: the brand mark assembling itself — the one authored motion in the app.
//
// Every move here is taken from the owner's reference animation (the logo
// reveal in logo animations.mp4): the parts arrive from outside the frame,
// curve in on a flight path that unwinds, spin as they travel, and snap into
// the finished mark while the outline draws itself around them with sweeping
// arcs. Then the mark settles and takes a pass of light.
//
// It is built from OUR geometry: the mark genuinely IS three triangles (see
// MARK_PIECES in Logo.jsx), so it can come apart and go back together for real
// rather than being a clipped bitmap. Only the choreography is borrowed, and
// the one move that really carries the reference — the wordmark dropping in
// letter by letter with a spring — lives in styles.css (.splash-name span).
//
// Timing is compressed for the web splash (2.3s, against the reference's 4.5s)
// so the app still feels instant. Same order, same beats, fewer frames. The
// phone runs the identical sequence at the identical speed, drawn by hand in
// mobile/lib/widgets/logo_reveal.dart.
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

        {/* The outline drawing itself: two arcs sweeping round the centre the
            pieces are converging on, at two different speeds and weights. */}
        <g className="rv-ring">
          <circle className="rv-arc-a" cx="301" cy="348" r="424" />
          <circle className="rv-arc-b" cx="301" cy="348" r="490" />
        </g>

        {/* The finished mark, revealed only once the pieces are home. Three
            anti-aliased triangles that share edges always leave a hairline
            where they meet; this single even-odd path covers it. It stays
            invisible until the assembly is done, so it never ghosts behind
            the pieces while they are still apart. */}
        <path className="rv-join" d={MARK_PIECES.map((p) => p.d).join(' ')} fillRule="evenodd" fill="url(#rv-g)" />

        {/* Everything that flies in sits inside the orbit group, so the whole
            flight path is turned and unwinds as they land. */}
        <g className="rv-orbit">
          {MARK_PIECES.map((p, i) => (
            <g
              key={i}
              className="rv-piece"
              style={{
                '--ox': `${p.ox}px`,
                '--oy': `${p.oy}px`,
                // FLIGHT_PATH: the artwork's own offsets are small (the pieces
                // travel barely 28px at this size), so they are scaled up for
                // the entrance — an arrival you can actually see.
                '--dx': `${p.dx * 2.4}px`,
                '--dy': `${p.dy * 2.4}px`,
                '--dr': `${p.rot * 2}deg`,
                '--dl': `${(0.1 + i * 0.09).toFixed(2)}s`,
              }}
            >
              <path d={p.d} fill="url(#rv-g)" />
            </g>
          ))}
        </g>

        {/* A light crossing the finished mark. */}
        <g clipPath="url(#rv-clip)">
          <rect className="rv-shine" x="60" y="-40" width="140" height="780" fill="#fff" />
        </g>
      </svg>
    </span>
  );
}
