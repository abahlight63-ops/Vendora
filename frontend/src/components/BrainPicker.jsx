// ── frontend/src/components/BrainPicker.jsx ────────────────────────
// WHAT: the chat's answer-quality switch, in human words only.
//
// The catalog carries 14 engines, and their names (Gemini Flash, GPT-OSS 120B,
// Claude 3.5 Haiku) mean nothing to a shop owner deciding how hard Velo should
// think about a caption. So the chat shows THREE words — Fast, Normal, Smart —
// and maps each to one concrete id from GET /api/me/ai-models.
//
// Connect keeps the detailed ModelPicker on purpose: picking the brain that
// answers your CUSTOMERS is a different, more technical decision than picking
// how hard to think about your own caption. One component for both would make
// the chat worse to serve the Connect page.
//
// Locked buckets are never silently swapped — they show a lock and hand the
// tap to the upgrade card, exactly like the old picker did.
import Ic from './icons.jsx';

// badge is the server's own grouping (see src/services/aiModels.js): 'Fast'
// engines are the speed kings, 'Smart' are the best free quality, 'Premium'
// are the paid crown jewels. So "Normal" is a badge-'Smart' engine — the
// everyday pick — and our "Smart" is the paid tier.
export const BUCKETS = [
  { key: 'fast', label: 'Fast', badge: 'Fast', blurb: 'quickest answers' },
  { key: 'normal', label: 'Normal', badge: 'Smart', blurb: 'balanced — the everyday pick' },
  { key: 'smart', label: 'Smart', badge: 'Premium', blurb: 'deepest answers' },
];

export const DEFAULT_BUCKET = 'normal';

// Used only until /api/me/ai-models answers (and if it never does): the
// historic default, still free on every tier.
const FALLBACK_ID = { fast: 'gemini-flash', normal: 'gemini-flash-full', smart: 'gemini-flash-full' };

export function bucketOf(badge) {
  if (badge === 'Premium') return 'smart';
  if (badge === 'Fast') return 'fast';
  return 'normal';
}

export function labelFor(key) {
  return (BUCKETS.find((b) => b.key === key) || BUCKETS[1]).label;
}

/** The concrete engine a bucket sends: first unlocked one, else first in it. */
export function modelFor(key, models) {
  const b = BUCKETS.find((x) => x.key === key) || BUCKETS[1];
  const inBucket = models.filter((m) => (m.badge || 'Smart') === b.badge);
  return inBucket.find((m) => !m.locked) || inBucket[0] || null;
}

export function idFor(key, models) {
  const m = modelFor(key, models);
  return m ? m.id : FALLBACK_ID[key] || FALLBACK_ID.normal;
}

export default function BrainPicker({ models, value, onPick, onLocked }) {
  const ready = models.length > 0;

  return (
    <div className="vai-brains" role="radiogroup" aria-label="How hard Velo should think">
      {BUCKETS.map((b) => {
        const m = modelFor(b.key, models);
        const locked = ready && (!m || m.locked);
        const on = value === b.key;
        return (
          <button
            key={b.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!ready}
            className={`vai-brain${on ? ' on' : ''}${locked ? ' locked' : ''}`}
            title={locked ? `${b.label} needs an upgrade — ${b.blurb}` : `${b.label} — ${b.blurb}`}
            onClick={() => (locked ? onLocked(b) : onPick(b.key))}
          >
            {b.label}
            {locked && <Ic n="lock" s={11} />}
          </button>
        );
      })}
    </div>
  );
}
