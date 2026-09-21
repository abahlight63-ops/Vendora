// ── frontend/src/components/Loader.jsx ─────────────────────────────
// WHAT: the ONE branded loader (Orbit V) — V monogram + rotating dashed
// orbit (mint dot + gold dot). Minimal at 16px, hero at 88px.
// Props: size (px), withLogo (splash: logo mark rides inside the orbit).
// No npm modules — inline SVG + one CSS keyframe (.orbit-loader).
export default function Loader({ size = 40, withLogo = false }) {
  return (
    <span className="orbit-loader" style={{ width: size, height: size }} role="status" aria-label="Loading">
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="orbit-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7ef0c0" /><stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <g className="orbit-spin">
          <circle cx="60" cy="60" r="44" fill="none" stroke="url(#orbit-g)" strokeWidth="4" strokeDasharray="42 26" strokeLinecap="round" />
          <circle cx="60" cy="16" r="6" fill="#7ef0c0" />
          <circle cx="60" cy="104" r="5" fill="#ffcf5c" />
        </g>
        {withLogo
          ? <image href="/logo.png?v=4" x="36" y="36" width="48" height="48" />
          : <path d="M42 44 L60 78 L78 44" fill="none" stroke="url(#orbit-g)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}
