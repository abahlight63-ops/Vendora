// ── frontend/src/components/LockButton.jsx ─────────────────────────
// WHAT: the ONLY paywall affordance in the app — a drawn SVG padlock.
// Free users never see "PRO" text on a feature; they see a lock. Clicking
// it opens the GlassUpsell upgrade card (not a dead badge, not a raw error).
// Usage: <LockButton title="..." lines={[...]} /> — title/lines feed the modal.
// No npm modules — React state + GlassUpsell + the Ic lock glyph.
import { useState } from 'react'; // open flag for the upsell modal
import GlassUpsell from './GlassUpsell.jsx'; // the upgrade card (billing CTA inside!)
import Ic from './icons.jsx'; // the drawn padlock (never an emoji!)

export default function LockButton({ title, lines, size = 13, label }) {
  const [open, setOpen] = useState(false); // modal visibility (closed by backdrop / Maybe later)
  return (
    <>
      <button
        type="button"
        className="lock-btn"
        onClick={() => setOpen(true)}
        aria-label={(label || title || 'Premium feature') + ' — locked. Tap to see upgrade options.'}
        title="Locked — tap to see upgrade options"
      >
        <Ic n="lock" s={size} />
        {label ? <span>{label}</span> : null}
      </button>
      <GlassUpsell show={open} title={title} lines={lines} onClose={() => setOpen(false)} />
    </>
  );
}
