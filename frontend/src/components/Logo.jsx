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
// COLOUR: one coral piece, one indigo piece and one that blends both. The colours
// live here and in mobile/lib/brand_mark.dart, the same in light and dark.
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
  return (
    <svg
      className={`vl-root${className ? ' ' + className : ''}`}
      width={w}
      height={h}
      viewBox="0 0 602 696"
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : 'true'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`vl1-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFB199" /><stop offset="1" stopColor="#D03C16" /></linearGradient>
        <linearGradient id={`vl2-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9C8FFA" /><stop offset="1" stopColor="#3B2E9E" /></linearGradient>
        <linearGradient id={`vl3-${uid}`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF8A6B" /><stop offset=".5" stopColor="#B44BA0" /><stop offset="1" stopColor="#4F3FC7" /></linearGradient>
      </defs>
      <path d={MARK_PIECES[0].d} fill={`url(#vl1-${uid})`} />
      <path d={MARK_PIECES[1].d} fill={`url(#vl2-${uid})`} />
      <path d={MARK_PIECES[2].d} fill={`url(#vl3-${uid})`} />
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
