// ── frontend/src/components/ModelPicker.jsx ────────────────────────
// WHAT: the ONE AI-brain picker (grouped popover: Fast / Smart / Reasoning /
// Premium, pills, locks, descs, outside-click + Escape to close). Shared by
// VeloSalesAI (chat brain) and Connect (WhatsApp brain) — one look, one
// behavior, zero drift. Locked picks call onLocked (upgrade card!), unlocked
// call onPick(id). No npm modules — React state + DOM listeners only.
import { useEffect, useRef, useState } from 'react'; // useState = open; useRef = outside-click box; useEffect = listeners
import Ic from './icons.jsx'; // spark/chev/lock glyphs
import Loader from './Loader.jsx'; // mini orbit while brains load

const GROUPS = ['Fast', 'Smart', 'Reasoning', 'Premium'];

function badgeClass(badge) {
  if (badge === 'Fast') return 'ok';
  if (badge === 'Smart') return 'info';
  if (badge === 'Reasoning') return 'flag';
  return 'off';
}

export default function ModelPicker({ models, model, onPick, onLocked }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const current = models.find((m) => m.id === model) || { id: model, label: 'Gemini Flash', badge: 'Smart', desc: 'Google · fuller answers, still free', tier: 'free' };

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function choose(m) {
    if (m.locked) { onLocked(m); return; }
    onPick(m.id);
    setOpen(false);
  }

  return (
    <div className="mpick" ref={wrap}>
      <button
        type="button"
        className="mpick-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="mpick-spark"><Ic n="spark" s={15} /></span>
        <span className="mpick-label">{current.label}</span>
        <span className={'pill ' + badgeClass(current.badge || 'Smart')}>{current.badge || 'Smart'}</span>
        {current.tier === 'paid' && <span className="mpick-lock"><Ic n="lock" s={12} /></span>}
        <span className={'mpick-chev' + (open ? ' open' : '')}><Ic n="chev" s={13} /></span>
      </button>
      {open && (
        <div className="mpick-pop" role="listbox" aria-label="Choose AI model">
          {models.length === 0 && <div className="mpick-empty"><Loader size={16} />Loading AIs…</div>}
          {GROUPS.map((g) => {
            const items = models.filter((m) => (m.badge || 'Smart') === g);
            if (!items.length) return null;
            return (
              <div key={g} className="mpick-group">
                <div className="mpick-ghead">{g === 'Premium' ? (<span className="mpick-glock">Premium <Ic n="lock" s={11} /></span>) : g}</div>
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={m.id === model}
                    className={'mpick-opt' + (m.id === model ? ' sel' : '') + (m.locked ? ' locked' : '')}
                    onClick={() => choose(m)}
                  >
                    <span className="mpick-check">{m.id === model ? '●' : ''}</span>
                    <span className="mpick-main">
                      <span className="mpick-name">{m.locked ? (<><Ic n="lock" s={12} /> </>) : null}{m.label}</span>
                      <span className="mpick-desc">{m.desc || (m.tier === 'paid' ? 'Premium quality — tap to see plans' : 'Free · no cost')}</span>
                    </span>
                    {m.tier === 'paid'
                      ? <span className="mpick-lock"><Ic n="lock" s={13} /></span>
                      : <span className={'pill ' + badgeClass(m.badge || 'Smart')}>{m.badge || 'Smart'}</span>}
                  </button>
                ))}
              </div>
            );
          })}
          <div className="mpick-foot">Free AIs cost you nothing. Locked AIs need an upgrade (heavy work models need the top plan) — tap one to see why.</div>
        </div>
      )}
    </div>
  );
}
