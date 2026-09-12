// ── frontend/src/components/GlassUpsell.jsx ────────────────────────
// WHAT: warm-glass premium upsell modal — frosted card, shimmer CTA, benefits.
// Shown when free users touch premium: Kimi K2 / locked models / 402s / caps.
// Props: show (bool), title, lines[] (benefits), onClose. Billing CTA inside.
// No npm modules — React + CSS (backdrop-filter glassmorphism!).
import { Link } from 'react-router-dom'; // Billing CTA (client-side nav!)

export default function GlassUpsell({ show, title, lines, onClose }) {
  if (!show) return null; // hidden → render nothing (parent toggles!)
  return (
    <div className="glass-overlay" onClick={onClose}> {/* fullscreen dim; click outside = close (low-pressure UX — premium never begs!) */}
      <div className="glass-card" onClick={(e) => e.stopPropagation()}> {/* stopPropagation = clicks INSIDE don't dismiss (only backdrop does!) */}
        <div className="glass-shine" /> {/* moving light streak (pure CSS shimmer — the "premium" feel!) */}
        <div className="glass-badge">✦ PRO</div> {/* sparkle badge (CSS glow!) */}
        <h2>{title || 'Tired of slow messages?'}</h2> {/* emotional headline (user's words: speed pain → upgrade!) */}
        <p className="hint">Premium AIs answer sharper, reason deeper, and never queue behind free traffic.</p>
        <ul className="glass-feats">
          {(lines && lines.length ? lines : [ // default benefit list (override per context via lines prop!)…
            'Kimi K2 — the smartest assistant we offer',
            'Claude Haiku + GPT-4o mini included',
            'Voice-note transcription on WhatsApp',
            '50 premium chats daily + unlimited free AIs',
            'Zero ads, priority support',
          ]).map((t) => (<li key={t}><span className="glass-tick">✓</span>{t}</li>))} {/* key={t} unique strings (static list!) */}
        </ul>
        <Link className="btn glass-cta" to="/billing" onClick={onClose}>Upgrade to Pro</Link> {/* shimmer CTA → billing (closes modal AND navigates!) */}
        <button className="skip" onClick={onClose}>Maybe later</button> {/* low-pressure exit (forced upsells breed resentment!) */}
      </div>
    </div>
  );
}
