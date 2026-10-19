// ── frontend/src/components/ModelPicker.jsx ────────────────────────
// WHAT: the AI-tier popover — the inline switch used on Connect. Fast / Normal
// / Smart, with the plan lock on the heavy tier. It reads the same source of
// truth as the chat's pill picker (BrainPicker) so the two can never drift.
//
// It used to be a 14-row menu of engine names ("Gemini Flash", "GPT-OSS 120B",
// "Claude 3.5 Haiku"). An owner choosing how hard their shop should think does
// not benefit from those words, and the engines change with price and
// availability — so the promise is the TIER, and the tier is all we show.
// Locked tiers never silently swap: they carry a lock and hand the tap to the
// upgrade card.
import { useEffect, useRef, useState } from 'react'; // useState = open; useRef = outside-click box; useEffect = listeners
import Ic from './icons.jsx'; // lock/chev glyphs
import { BUCKETS, bucketOf, idFor, modelFor } from './BrainPicker.jsx'; // the ONE tier definition

export default function ModelPicker({ models, model, onPick, onLocked }) {
  const [open, setOpen] = useState(false); // is the popover showing?
  const wrap = useRef(null); // anything clicked outside this closes it
  const stored = models.find((m) => m.id === model); // the row the server says is live
  const current = bucketOf((stored && stored.badge) || 'Smart'); // …mapped to the tier name we show
  const curLabel = (BUCKETS.find((b) => b.key === current) || BUCKETS[1]).label;

  useEffect(() => { // close on outside click + Escape while open
    if (!open) return undefined;
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="mpick" ref={wrap}>
      <button type="button" className="mpick-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="mpick-spark"><Ic n="spark" s={15} /></span>
        <span className="mpick-label">{curLabel}</span>
        <span className="mpick-chev"><Ic n="chev" s={13} /></span>
      </button>
      {open && (
        <div className="mpick-pop" role="listbox" aria-label="How hard Velo should think">
          {BUCKETS.map((b) => {
            const m = modelFor(b.key, models);
            const locked = models.length > 0 && (!m || m.locked);
            const on = current === b.key;
            return (
              <button key={b.key} type="button" role="option" aria-selected={on}
                className={'mpick-opt' + (on ? ' sel' : '') + (locked ? ' locked' : '')}
                onClick={() => { if (locked) { setOpen(false); onLocked(b); return; } onPick(idFor(b.key, models)); setOpen(false); }}>
                <span className="mpick-check">{on ? '●' : ''}</span>
                <span className="mpick-main">
                  <span className="mpick-name">{locked ? (<><Ic n="lock" s={12} /> </>) : null}{b.label}</span>
                  <span className="mpick-desc">{b.blurb}{locked ? ' · needs the top plan' : ''}</span>
                </span>
              </button>
            );
          })}
          <div className="mpick-foot">Three settings, not thirty. Change it any time — the full explanation lives in AI settings.</div>
        </div>
      )}
    </div>
  );
}
