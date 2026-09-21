// ── frontend/src/components/ScatterLogo.jsx ────────────────────────
// WHAT: the logo that explodes into tiles and reassembles (scatter →
// arrange loop). 4×4 clipped tiles of /logo.png fly out with rotation +
// fade, then snap back together. Deterministic scatter (seeded per tile —
// same dance every loop, no hydration wobble). Used by Splash.
import { useTheme } from '../lib/theme.js';
function seed(i, salt) { // tiny deterministic pseudo-random (0..1, stable per tile!)
  let h = (i + 1) * 2654435761 + salt * 40503;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const N = 4; // 4×4 tiles (16 pieces — chunky enough to read, light enough to animate!)

export default function ScatterLogo({ size = 120, src }) {
  const [theme] = useTheme(); // scattered mark follows the theme (blue dark / green light!)
  const mark = src || (theme === 'light' ? '/logo-green.png?v=1' : '/logo-blue.png?v=1');
  const cells = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const dx = ((seed(i, 7) - 0.5) * 160).toFixed(0) + '%'; // fling distance (% of full logo!)
      const dy = ((seed(i, 13) - 0.5) * 160).toFixed(0) + '%';
      const dr = ((seed(i, 29) - 0.5) * 260).toFixed(0) + 'deg'; // tumble
      cells.push(
        <img
          key={i}
          src={mark}
          alt=""
          aria-hidden="true"
          style={{
            clipPath: `inset(${(y * 100) / N}% ${(100 - ((x + 1) * 100) / N).toFixed(2)}% ${((100 - ((y + 1) * 100) / N)).toFixed(2)}% ${(x * 100) / N}%)`,
            '--dx': dx, '--dy': dy, '--dr': dr,
            '--dl': (seed(i, 3) * 0.35).toFixed(2) + 's', // stagger the snap-back!
          }}
        />
      );
    }
  }
  return (
    <span className="scatter-logo" style={{ width: size, height: size }} role="status" aria-label="Loading">
      {cells}
    </span>
  );
}
