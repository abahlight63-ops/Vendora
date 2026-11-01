// ── frontend/src/components/MarkReveal.jsx ─────────────────────────
// WHAT: the 3D logo. MarkReveal plays once: three solid pieces fly in and lock
// together, the logo turns with a flash of light, and a coral and indigo ring
// settles around it. MarkTurn is the small one that keeps turning during a long
// wait. Both are pure CSS 3D (stacked layers give the thickness), with no library
// and no model file. The phone's copy is mobile/lib/widgets/mark_3d.dart.
const LAYERS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]; // steps of depth, in units of --m3d

function Solid() {
  return ['p1', 'p2', 'p3'].map((p) => (
    <div key={p} className={'m3d-piece ' + p}>
      {LAYERS.map((n) => <i key={n} className="m3d-lay m3d-side" style={{ '--n': n }} />)}
      <i className="m3d-lay m3d-face" style={{ '--n': 5.4 }} />
      <i className="m3d-lay m3d-glint" style={{ '--n': 5.5 }} />
      <i className="m3d-lay m3d-face" style={{ '--n': -5.4 }} />
    </div>
  ));
}

export default function MarkReveal({ size = 112, className = '' }) {
  return (
    <div className={'m3d' + (className ? ' ' + className : '')} style={{ '--m3d': size + 'px' }} role="img" aria-label="VeloSales Ai">
      <i className="m3d-halo" />
      <i className="m3d-floor" />
      <i className="m3d-ring"><b /></i>
      <i className="m3d-ring m3d-ring2" />
      <div className="m3d-world"><Solid /></div>
    </div>
  );
}

export function MarkTurn({ size = 62 }) {
  return (
    <span className="m3d-turn" style={{ '--m3d': size + 'px' }} role="status" aria-label="Loading">
      <i className="m3d-arc" />
      <span className="m3d-world"><Solid /></span>
    </span>
  );
}
