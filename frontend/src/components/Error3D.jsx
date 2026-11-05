// ── frontend/src/components/Error3D.jsx ────────────────────────────
// WHAT: the failure illustration — the brand tile standing in space, with a
// soft contact shadow and one small status light (red = the request failed,
// amber = you are offline). Drawn as SVG, not an image: it stays crisp at any
// size, weighs nothing, and cannot 404.
//
// WHY 3D AT ALL: a flat warning glyph is what every dashboard ships. A solid
// object with weight reads as "this is a real place that is temporarily shut",
// which is exactly the message. The float is 3px and slow; it is motion that
// says "still here", not a loading spinner pretending the request is working.
//
// Props: tone = 'error' | 'offline'. Everything else is presentational.
export default function Error3D({ tone = 'error' }) {
  const offline = tone === 'offline';
  const dot = offline ? '#D97706' : '#DC2626'; // amber = attention, red = failure (DESIGN.md)
  return (
    <svg
      className="err3d"
      viewBox="0 0 220 200"
      role="img"
      aria-label={offline ? 'Offline' : 'Request failed'}
    >
      <defs>
        <linearGradient id="e3-face" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#7566EA" />
          <stop offset="0.52" stopColor="#4F3FC7" />
          <stop offset="1" stopColor="#352A7F" />
        </linearGradient>
        <linearGradient id="e3-gloss" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="e3-shadow">
          <stop offset="0" stopColor="#171532" stopOpacity="0.26" />
          <stop offset="1" stopColor="#171532" stopOpacity="0" />
        </radialGradient>
        <path
          id="e3-hex"
          d="M301 0 L602 189 L602 513 L301 696 L0 513 L0 189 Z"
          fillRule="evenodd"
        />
        <path
          id="e3-brand"
          d="M301 0 L602 189 L602 513 L301 696 L0 513 L0 189 Z M0 189 L602 189 L301 696 Z"
          fillRule="evenodd"
        />
      </defs>

      {/* contact shadow */}
      <ellipse cx="110" cy="176" rx="64" ry="13" fill="url(#e3-shadow)" />

      <g className="err3d-float">
        <g transform="translate(60 26) scale(0.165)">
          {/* extrusion: four darker plates behind the face */}
          <use href="#e3-hex" fill="#241B63" transform="translate(0 120)" />
          <use href="#e3-hex" fill="#2A2069" transform="translate(0 90)" />
          <use href="#e3-hex" fill="#31258A" transform="translate(0 60)" />
          <use href="#e3-hex" fill="#3A2E9E" transform="translate(0 30)" />

          {/* top face */}
          <use href="#e3-hex" fill="url(#e3-face)" />
          <use href="#e3-hex" fill="url(#e3-gloss)" />

          {/* white inlay, slightly inset so the rim stays purple */}
          <g transform="translate(301 348) scale(0.88) translate(-301 -348)">
            <use href="#e3-brand" fill="#FFFFFF" opacity="0.97" />
          </g>
        </g>

        {/* status light: a soft halo plus a solid core */}
        <circle cx="167" cy="52" r="11" fill={dot} opacity="0.14" />
        <circle cx="167" cy="52" r="5" fill={dot} />
        {offline ? (
          <circle
            cx="167"
            cy="52"
            r="9"
            fill="none"
            stroke={dot}
            strokeWidth="1.4"
            strokeDasharray="3 4"
            opacity="0.8"
          />
        ) : null}
      </g>
    </svg>
  );
}
