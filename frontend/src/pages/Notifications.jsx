// ── frontend/src/pages/Notifications.jsx ───────────────────────────
// WHAT: every bell item, readable end-to-end. /notifications = the list,
// grouped Today / Earlier, with All / Unread / Payments / Updates filters and
// "Mark all as read". /notifications/:id = one notice in full (marks it read).
// Rows have no stored type, so the icon and filter come from the row's link:
// /billing = payment, /chats = a chat that needs you, anything else = update.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, pop } from '../lib/api.js';
import { describeNetError } from '../lib/netDetail.js';
import LoadFailed from '../components/LoadFailed.jsx';
import Ic from '../components/icons.jsx';

const kindOf = (n) => {
  const l = String(n.link || '');
  if (l.startsWith('/billing') || /payment|paid|receipt|plan/i.test(n.title || '')) return 'pay';
  if (l.startsWith('/chats')) return 'chat';
  return 'news';
};
const KIND = { pay: ['nt-ic v', 'check'], chat: ['nt-ic c', 'help'], news: ['nt-ic v', 'bolt'] };
const isToday = (d) => { const x = new Date(d); const n = new Date(); return x.toDateString() === n.toDateString(); };
const when = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isToday(d)) return x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const days = (Date.now() - x.getTime()) / 864e5;
  return days < 7 ? x.toLocaleDateString([], { weekday: 'short' }) : x.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

function Row({ n, onOpen }) {
  const [cls, ic] = KIND[kindOf(n)];
  return (
    <button type="button" className={'nt-row' + (n.is_read ? '' : ' unread')} onClick={onOpen}>
      {n.image_url ? <img className="nt-thumb" src={n.image_url} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} /> : <span className={cls} aria-hidden="true"><Ic n={ic} s={22} /></span>}
      <span className="nt-main">
        <b>{n.title}</b>
        {n.body ? <span>{String(n.body).slice(0, 140)}{String(n.body).length > 140 ? '…' : ''}</span> : null}
      </span>
      <span className="nt-side">
        <small>{when(n.created_at)}</small>
        {!n.is_read && <i className="nt-dot" aria-label="Unread" />}
      </span>
    </button>
  );
}

export default function Notifications() {
  const { id } = useParams();
  const nav = useNavigate();
  const [items, setItems] = useState(null);
  const [one, setOne] = useState(null);
  const [failed, setFailed] = useState(null);
  const [tries, setTries] = useState(0);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let dead = false;
    setFailed(null);
    api('/api/me/notifications', { timeout: 15000 }).then(({ ok, status, data }) => {
      if (dead) return;
      if (ok && Array.isArray(data.items)) setItems(data.items);
      else if (!ok && status === 401) window.location.href = '/login';
      else setItems([]);
    }).catch(() => { if (!dead) { setFailed({ status: 0, detail: describeNetError() }); setItems([]); } });
    const onOnline = () => { if (!dead) setTries((t) => t + 1); };
    window.addEventListener('online', onOnline);
    return () => { dead = true; window.removeEventListener('online', onOnline); };
  }, [tries]);

  useEffect(() => {
    if (!id) { setOne(null); return; }
    setOne(null);
    api(`/api/me/notifications/${id}/read`, { method: 'POST' }).then(({ ok, data }) => setOne(ok ? data : 'missing')).catch(() => setOne('missing'));
  }, [id]);

  async function readAll() {
    const { ok } = await api('/api/me/notifications/read', { method: 'POST' });
    if (ok) setItems((xs) => (xs || []).map((x) => ({ ...x, is_read: true })));
    else pop('err', 'Could not mark them as read', 'Check your connection and try again.');
  }

  if (id) {
    return (
      <div className="nt">
        <Link className="nt-back" to="/notifications"><Ic n="back" s={18} />All notifications</Link>
        {!one ? <div className="nt-card"><div className="skel" style={{ height: 120 }} /></div>
          : one === 'missing' ? <div className="nt-card nt-empty"><b>Not found</b><span>This notice is gone, or it belongs to another shop.</span></div>
            : (
              <article className="nt-card nt-detail">
                <small>{one.created_at ? new Date(one.created_at).toLocaleString() : ''}</small>
                <h1>{one.title}</h1>
                {one.image_url ? <img src={one.image_url} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} /> : null}
                {one.video_url ? <video src={one.video_url} controls preload="metadata" /> : null}
                {one.body ? <p>{one.body}</p> : null}
                {one.link ? <Link className="btn lg" to={one.link}>Open</Link> : null}
              </article>
            )}
      </div>
    );
  }

  const list = (items || []).filter((n) => filter === 'all' || (filter === 'unread' ? !n.is_read : filter === 'pay' ? kindOf(n) === 'pay' : kindOf(n) !== 'pay'));
  const unread = (items || []).filter((n) => !n.is_read).length;
  const today = list.filter((n) => n.created_at && isToday(n.created_at));
  const earlier = list.filter((n) => !(n.created_at && isToday(n.created_at)));
  const FILTERS = [['all', 'All'], ['unread', unread ? `Unread ${unread}` : 'Unread'], ['pay', 'Payments'], ['news', 'Updates']];

  return (
    <div className="nt">
      <div className="in-head">
        <div>
          <div className="dg-status on"><i />{unread ? `${unread} unread` : 'All caught up'}</div>
          <h1>Notifications</h1>
          <p>Payments, chats that need you and news from VeloSales Ai.</p>
        </div>
        {unread > 0 && <button type="button" className="btn ghost" onClick={readAll}><Ic n="check" s={18} />Mark all as read</button>}
      </div>
      <div className="wx-pills" role="group" aria-label="Show">
        {FILTERS.map(([k, t]) => <button key={k} type="button" className={'wx-pill' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>)}
      </div>
      <div className="nt-card">
        {items === null ? [0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 70, marginBottom: 10, borderRadius: 22 }} />)
          : failed && items.length === 0 ? <LoadFailed title="Couldn't load notifications" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setItems(null); setTries((t) => t + 1); }} backTo="/dashboard" backLabel="Back to Home" />
            : list.length === 0 ? <div className="nt-empty"><span className="nt-ic v" aria-hidden="true"><Ic n="check" s={22} /></span><b>{filter === 'all' ? 'All caught up' : 'Nothing here'}</b><span>Payments, chats that need you and app news will show up here.</span></div>
              : (<>
                {today.length > 0 && <div className="nt-group">Today</div>}
                {today.map((n) => <Row key={n.id} n={n} onOpen={() => nav(`/notifications/${n.id}`)} />)}
                {earlier.length > 0 && <div className="nt-group">Earlier</div>}
                {earlier.map((n) => <Row key={n.id} n={n} onOpen={() => nav(`/notifications/${n.id}`)} />)}
              </>)}
      </div>
    </div>
  );
}
