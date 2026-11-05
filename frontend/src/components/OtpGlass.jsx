// ── frontend/src/components/OtpGlass.jsx ──────────────────────────
// WHAT: the glassy 6-digit code entry (approved design, from the owner's video).
// phase: 'idle'  → six boxes in a row, the next one glows coral
//        'busy'  → the boxes lift into a circle and spin ("Verifying code…")
//        'ok'    → they gather into a ring that closes in green, then a tick
//        'error' → the row shakes red, then clears for another try
// A hidden real <input> does the typing, so paste, phone autofill
// (one-time-code) and screen readers all work. Reduced-motion users get no spin.
import { useEffect, useRef } from 'react';

const GAP = 54;
export default function OtpGlass({ value, onChange, onComplete, phase = 'idle', autoSubmit = true, label = '6-digit code' }) {
  const input = useRef(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const digits = String(value || '').slice(0, 6);
  const width = typeof window !== 'undefined' && window.innerWidth < 440 ? 48 : GAP;

  useEffect(() => { // all six typed → verify by itself (like the video)
    if (autoSubmit && digits.length === 6 && phase === 'idle' && onComplete) onComplete(digits);
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === 'idle' && input.current) input.current.focus(); }, [phase]);

  const place = (i) => {
    if (phase === 'busy' && !reduce) { const a = (i / 6) * Math.PI * 2; return `translate(${Math.cos(a) * 70}px, ${Math.sin(a) * 54}px) rotate(${a * 57}deg)`; }
    if (phase === 'ok') return 'translate(0, 0) scale(.3)';
    return `translate(${(i - 2.5) * width}px, 0)`;
  };
  return (
    <div className={'og og-' + phase} onClick={() => input.current && input.current.focus()}>
      <label className="au-sr" htmlFor="og-in">{label}</label>
      <input id="og-in" ref={input} className="og-input" value={digits} disabled={phase === 'busy' || phase === 'ok'} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => { if (e.key === 'Enter' && digits.length === 6 && onComplete) onComplete(digits); }} autoFocus />
      <div className="og-zone" aria-hidden="true">
        <div className="og-orbit">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={'og-box' + (digits[i] ? ' full' : '') + (phase === 'idle' && digits.length === i ? ' cur' : '')} style={{ transform: place(i), transitionDelay: phase === 'busy' ? i * 40 + 'ms' : '0ms' }}>{digits[i] || ''}</span>
          ))}
        </div>
        <span className="og-ring"><svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="45" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" transform="rotate(-90 48 48)" /></svg></span>
        <span className="og-tick"><svg width="28" height="28" viewBox="0 0 24 24"><path fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
      </div>
    </div>
  );
}
