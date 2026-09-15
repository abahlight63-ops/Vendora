// ── frontend/src/components/Notifications.jsx ────────────────────
// WHAT: the topbar bell — unread badge + dropdown panel of the latest
// notifications (payment verifications, app updates). Polls every 60s,
// toasts on NEW arrivals, marks all read on open. Touch-friendly + mobile
// bottom-sheet positioned via CSS.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toast } from '../lib/api.js';
import Ic from './icons.jsx'; // drawn bell glyph (never an emoji!)

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0); // re-render ticker: NEW pills expire live without reload!
  const wrap = useRef(null);
  const seen = useRef(null); // first-load guard: don't toast history as "new"
  const nav = useNavigate();

  const NEW_MS = 2 * 60 * 1000; // NEW tag lifespan (2 minutes from created_at!)
  function isNew(n) { // fresh enough for the NEW pill? (bad dates → false, never crash!)
    const t = new Date(n && n.created_at).getTime();
    return Number.isFinite(t) && (Date.now() - t) < NEW_MS;
  }

  async function load(silent) {
    const { ok, data } = await api('/api/me/notifications');
    if (!ok || !data) return;
    const list = Array.isArray(data.items) ? data.items : [];
    if (seen.current === null) {
      seen.current = list.length ? list[0].id : 0; // baseline = newest known
    } else if (!silent && list.length && list[0].id > seen.current) {
      const fresh = list.filter((n) => n.id > seen.current);
      seen.current = list[0].id;
      if (fresh.length) toast(fresh[0].title || 'New notification', 'ok');
    }
    setItems(list);
    setUnread(Number(data.unread) || 0);
  }

  useEffect(() => {
    load(true);
    const t = setInterval(() => { if (!document.hidden) load(false); }, 60000);
    const tick = setInterval(() => setTick((x) => x + 1), 15000); // expire NEW pills on time (cheap render, no fetch!)
    return () => { clearInterval(t); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open ]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api('/api/me/notifications/read', { method: 'POST' });
      setUnread(0);
      setItems((xs) => xs.map((x) => ({ ...x, is_read: true })));
    }
  }

  function go(n) {
    setOpen(false);
    if (n.link) nav(n.link);
  }

  return (
    <div className="nbell" ref={wrap}>
      <button className={'nbell-btn' + (unread > 0 ? ' has-unread' : '')} onClick={toggle} aria-label={unread ? `${unread} unread notifications` : 'Notifications'} aria-expanded={open}>
        <span className="nbell-ic"><Ic n="bell" s={20} /></span>
        {unread > 0 && <span className="nbell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="nbell-pop" role="dialog" aria-label="Notifications">
          <div className="nbell-head"><b>Notifications</b>{unread > 0 && <span className="pill info">{unread} new</span>}</div>
          {items.length === 0 && <div className="nbell-empty">All caught up<span>Payment verifications and app updates will land here.</span></div>}
          {items.map((n) => (
            <button key={n.id} className={'nbell-item' + (n.is_read ? '' : ' fresh')} onClick={() => go(n)}>
              <span className="nbell-dot" />
              <span className="nbell-main">
                <b>{n.title} {isNew(n) && <span className="pill new">NEW</span>}</b>
                {n.body && <span>{n.body}</span>}
                <i>{new Date(n.created_at).toLocaleString()}</i>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
