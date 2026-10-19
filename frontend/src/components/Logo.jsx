// frontend/src/components/Logo.jsx — the VeloSales Ai brand mark.
//
// THE SHAPE: a hexagon with an inscribed inverted triangle. The negative space
// between them reads as a V — the V in VeloSales. Measured off the owner's own
// logo file, not invented; the same numbers are in mobile/lib/brand_mark.dart,
// so the web and the phone draw one mark from one geometry.
//
// Delivered as a single even-odd path rather than three triangles: the pieces
// share edges, and shared edges leave a hairline seam once they are
// anti-aliased. (The phone does split them — but only while the mark is
// assembling itself on the splash.)
//
// COLOUR: the shape ships no colour of its own. styles.css sets --lg-* on
// .vl-root (light) and [data-theme="dark"] .vl-root (dark), so the mark
// re-tints with the theme instead of being frozen at one value.
//
// GRADIENT IDS ARE PER-INSTANCE, and that is not a detail. An SVG gradient
// lives in the document, not in the element: `url(#vl-g)` resolves to the
// FIRST element with that id anywhere on the page. With one hard-coded id,
// every mark on a screen (sidebar, chat orb, each answer's avatar) painted
// itself with whichever gradient happened to come first — so a recoloured
// instance silently rendered in the wrong colour. React's useId keeps each
// instance's own defs, so the CSS variables above always win.
import { useId } from 'react';

const D =
  'M301 0 L602 189 L602 513 L301 696 L0 513 L0 189 Z ' +
  'M0 189 L602 189 L301 696 Z';

/** The artwork's own aspect — taller than wide. */
export const MARK_ASPECT = 602 / 696;

export default function Logo({
  className,
  alt = 'VeloSales Ai',
  width,
  height,
  size,
}) {
  const h = height ?? size ?? 34;
  const w = width ?? h * MARK_ASPECT;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, ''); // ":r1:" → "r1" (CSS-safe fragment)
  const gid = `vlg-${uid}`;
  const sid = `vls-${uid}`;

  return (
    <svg
      className={`vl-root${className ? ' ' + className : ''}`}
      width={w}
      height={h}
      viewBox="0 0 602 696"
      role="img"
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={gid}
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
        <linearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" style={{ stopOpacity: 'var(--lg-sheen)' }} />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={D} fillRule="evenodd" fill={`url(#${gid})`} />
      <path d={D} fillRule="evenodd" fill={`url(#${sid})`} />
    </svg>
  );
}

/** The same path, for places that need the raw geometry (canvas, favicons). */
export const MARK_PATH = D;

/**
 * The mark as its three real pieces — top cap, left wing, right wing. Used by
 * MarkReveal, and only there: the pieces can come apart and go back together
 * because they are genuinely separate triangles, not because a rectangle of
 * bitmap is being clipped.
 *
 * `ox`/`oy` is each piece's own centroid (its rotation pivot); dx/dy/rot are
 * where it flies in from.
 */
export const MARK_PIECES = [
  { d: 'M301 0 L602 189 L0 189 Z', ox: 301, oy: 126, dx: 0, dy: -190, rot: -17 },
  { d: 'M0 189 L0 513 L301 696 Z', ox: 100, oy: 466, dx: -185, dy: 80, rot: 15 },
  { d: 'M602 189 L602 513 L301 696 Z', ox: 502, oy: 466, dx: 185, dy: 80, rot: -15 },
];
