// ── frontend/src/components/GlassUpsell.jsx ────────────────────────
// WHAT: the upgrade card shown when a shop taps something its plan doesn't
// include. Violet top with the feature's own icon and a lock tag, three benefits,
// the price, the long coral button and "Not now".
// Props: show, onClose, and optionally icon (an Ic name), title, sub, lines[],
// plan ('Plus' | 'Pro', default Pro) and price (text, default by plan).
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Ic from './icons.jsx';

const PRICE = { Plus: '₦7,499', Pro: '₦14,999' };

export default function GlassUpsell({ show, onClose, icon = 'spark', title, sub, lines, plan = 'Pro', price }) {
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);
  if (!show) return null;
  const list = lines && lines.length ? lines.slice(0, 4) : plan === 'Plus'
    ? ['500 replies a day', 'Product photos in replies', 'Import your WhatsApp catalog']
    : ['Voice notes on WhatsApp and Telegram', '1,500 replies a day', 'Our smartest AI and priority support'];
  return (
    <div className="up-back" role="presentation" onClick={onClose}>
      <div className="up-card" role="dialog" aria-modal="true" aria-labelledby="up-title" onClick={(e) => e.stopPropagation()}>
        <div className="up-top">
          <button type="button" className="up-x" onClick={onClose} aria-label="Close"><Ic n="x" s={18} /></button>
          <span className="up-ic"><Ic n={icon} s={30} /></span>
          <span className="up-tag"><Ic n="lock" s={12} />{plan} feature</span>
          <h2 id="up-title">{title || `Get more with ${plan}`}</h2>
          <p>{sub || 'Unlock this and more, and keep everything you have set up.'}</p>
        </div>
        <div className="up-body">
          <ul>{list.map((t) => <li key={t}><span><Ic n="check" s={13} /></span>{t}</li>)}</ul>
          <div className="up-price"><b>{price || PRICE[plan] || PRICE.Pro}</b><span>/ month · {plan}</span></div>
          <Link className="btn lg up-go" to="/billing" onClick={onClose}>Upgrade to {plan}</Link>
          <button type="button" className="up-later" onClick={onClose}>Not now</button>
        </div>
      </div>
    </div>
  );
}
