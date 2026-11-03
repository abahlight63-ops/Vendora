// ── frontend/src/components/VeloLoader.jsx ─────────────────────────
// WHAT: the brand loader, after the owner's reference video. One 2.9s loop:
// the logo rests, its pieces shrink away, a single line draws the outline,
// the pieces pop back (left, right, top), rays burst from the centre and it
// settles. Used by Loader (large sizes), BrandGate and the app-start Splash.
// `light` = white outline, for dark backgrounds (the Splash); otherwise the
// outline follows the theme through CSS.
import { useId } from 'react';

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

export default function VeloLoader({ size = 64, light = false, label = 'Loading' }) {
  const u = useId().replace(/:/g, '');
  return (
    <span className={'vl' + (light ? ' vl-light' : '')} style={{ '--s': size + 'px' }} role="status" aria-label={label}>
      <span className="vl-stage">
        <span className="vl-rays" aria-hidden="true">
          {RAYS.map((a) => <i key={a} style={{ transform: `rotate(${a}deg) translateY(-${size * 0.8}px)` }} />)}
        </span>
        <svg className="vl-mark" viewBox="-20 -20 642 736" width={size} height={Math.round(size * 1.15)} aria-hidden="true">
          <defs>
            <linearGradient id={'a' + u} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFB199" /><stop offset="1" stopColor="#D03C16" /></linearGradient>
            <linearGradient id={'b' + u} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9C8FFA" /><stop offset="1" stopColor="#3B2E9E" /></linearGradient>
            <linearGradient id={'c' + u} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF8A6B" /><stop offset=".5" stopColor="#B44BA0" /><stop offset="1" stopColor="#4F3FC7" /></linearGradient>
          </defs>
          <path className="vl-line" pathLength="100" d="M301 0 L602 189 L602 513 L301 696 L0 513 L0 189 Z M0 189 L602 189 M0 189 L301 696 L602 189" />
          <path className="vl-p vl-p2" fill={`url(#b${u})`} d="M0 189 L0 513 L301 696 Z" />
          <path className="vl-p vl-p3" fill={`url(#c${u})`} d="M602 189 L602 513 L301 696 Z" />
          <path className="vl-p vl-p1" fill={`url(#a${u})`} d="M301 0 L602 189 L0 189 Z" />
        </svg>
      </span>
      <span className="vl-floor" aria-hidden="true" />
    </span>
  );
}
