// ── frontend/src/components/Chart.jsx ──────────────────────────────
// WHAT: zero-dependency forex-style SVG charts (no chart library installed).
// ForexChart: smooth area+line, gridlines with min/max, day labels, glowing
// last dot (the "live price" feel). Spark: mini trend for tight spaces.
// Theme-safe: line/grid/text colors come from CSS vars (.fx-* in styles.css).
// No npm modules — React (useId for unique gradient ids) + math only.
import { useId } from 'react'; // unique gradient ids per instance (dupe ids = wrong fills!)

const W = 600; // viewBox width (scales to any screen — SVG!)

function smooth(pts) { // catmull-rom → bezier (the flowing forex curve, not jagged segments!)
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function ForexChart({ values = [], labels = [], height = 190 }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, ''); // React ids contain ":" (invalid in url(#…)) — strip!
  const n = values.length;
  const H = height;
  const PAD = 10;
  const max = Math.max(...values, 1); // ||1 guards all-zero (flat line, never NaN!)
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const X = (i) => (n < 2 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2));
  const Y = (v) => PAD + 8 + (1 - (v - min) / span) * (H - PAD * 2 - 30);
  const pts = values.map((v, i) => [X(i), Y(v)]);
  const line = smooth(pts);
  const base = H - 16;
  const area = line ? `${line}L${pts[n - 1][0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z` : '';
  const last = n ? pts[n - 1] : null;
  const gridVals = [max, min + span * 0.66, min + span * 0.33, min]; // 4 gridlines (top → bottom!)
  const showEvery = Math.max(1, Math.ceil(n / 6)); // ~6 day labels max (never crowded!)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Chat volume chart">
      <defs>
        <linearGradient id={'fxa' + gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#25d366" stopOpacity="0.35" />
          <stop offset="1" stopColor="#25d366" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridVals.map((g, i) => { // gridline + value tag (left-aligned, muted!)
        const y = PAD + 8 + (1 - (g - min) / span) * (H - PAD * 2 - 30);
        return (<g key={i}><line x1={PAD} x2={W - PAD} y1={y} y2={y} className="fx-grid" /><text x={PAD + 2} y={y - 4} className="fx-txt">{Math.round(g)}</text></g>);
      })}
      {area && <path d={area} fill={`url(#fxa${gid})`} />}
      {line && <path d={line} className="fx-line" />}
      {last && (<g><circle cx={last[0]} cy={last[1]} r="9" className="fx-halo" /><circle cx={last[0]} cy={last[1]} r="4.5" className="fx-dot" /></g>)}
      {labels.map((l, i) => (i % showEvery === 0 || i === n - 1 ? <text key={i} x={X(i)} y={H - 2} textAnchor="middle" className="fx-txt">{l}</text> : null))}
    </svg>
  );
}

export function Spark({ values = [], width = 120, height = 38 }) {
  const n = values.length;
  if (!n) return <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}><line x1="0" x2={width} y1={height / 2} y2={height / 2} className="fx-grid" /></svg>;
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = Math.max(max - min, 1);
  const X = (i) => (n < 2 ? width / 2 : 3 + (i / (n - 1)) * (width - 6));
  const Y = (v) => 4 + (1 - (v - min) / span) * (height - 8);
  const pts = values.map((v, i) => [X(i), Y(v)]);
  const d = smooth(pts);
  const last = pts[n - 1];
  const up = values[n - 1] >= values[0]; // direction tint (green up / gold down!)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block' }} role="img" aria-label="Trend sparkline">
      <path d={d} fill="none" stroke={up ? '#25d366' : '#f5b041'} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={up ? '#25d366' : '#f5b041'} />
    </svg>
  );
}
