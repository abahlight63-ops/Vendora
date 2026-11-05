// ── frontend/src/components/Notifications.jsx ────────────────────
// WHAT: the topbar bell — unread badge; a tap opens the Notifications page,
// where each notice takes you straight to the problem it is about.
// Polls every 60s, toasts on NEW arrivals, and shares the unread count with
// the sidebar (window event 'velo-unread'). The page fires
// 'velo-notifs-changed' after it marks things read, so the badge refreshes.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toast } from '../lib/api.js';
import Ic from './icons.jsx'; // drawn bell glyph (never an emoji!)

export default function Notifications() {
  const [unread, setUnread] = useState(0);
  const seen = useRef(null); // first-load guard: don't toast history as "new"
  const nav = useNavigate();

  async function load(silent) {
    let res;
    try { res = await api('/api/me/notifications'); } catch { return; } // offline: keep the last count
    const { ok, data } = res || {};
    if (!ok || !data) return;
    const list = Array.isArray(data.items) ? data.items : [];
    if (seen.current === null) {
      seen.current = list.length ? list[0].id : 0; // baseline = newest known
    } else if (!silent && list.length && list[0].id > seen.current) {
      const fresh = list.filter((n) => n.id > seen.current);
      seen.current = list[0].id;
      if (fresh.length) toast(fresh[0].title || 'New notification', 'ok');
    }
    const n = Number(data.unread) || 0;
    setUnread(n);
    window.dispatchEvent(new CustomEvent('velo-unread', { detail: n }));
  }

  useEffect(() => {
    load(true);
    const t = setInterval(() => { if (!document.hidden) load(false); }, 60000);
    const changed = () => load(true); // the page marked something read → refresh the badge
    window.addEventListener('velo-notifs-changed', changed);
    return () => { clearInterval(t); window.removeEventListener('velo-notifs-changed', changed); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="nbell">
      <button className={'nbell-btn' + (unread > 0 ? ' has-unread' : '')} onClick={() => nav('/notifications')} aria-label={unread ? `${unread} unread notifications` : 'Notifications'}>
        <span className="nbell-ic"><Ic n="bell" s={20} /></span>
        {unread > 0 && <span className="nbell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
    </div>
  );
}
