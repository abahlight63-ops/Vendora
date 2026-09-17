// ── frontend/src/pages/Notifications.jsx ───────────────────────────
// WHAT: the full inbox page — every bell item, readable end-to-end (the bell
// only previews). Tap one → full page with photo/video + "Open link" button.
// Route: /notifications (list) + /notifications/:id (detail, marks read).
// STATE: items (null = loading), one (detail row or 'missing').
import { useEffect, useState } from 'react'; // useState = items/one; useEffect = load on mount + id change
import { Link, useNavigate, useParams } from 'react-router-dom'; // Link = back nav; useParams = :id; useNavigate = row taps
import { api } from '../lib/api.js'; // api() calls (session-authed — owners see ONLY their inbox!)

export default function Notifications() {
  const { id } = useParams(); // undefined on /notifications (list mode!)
  const nav = useNavigate();
  const [items, setItems] = useState(null); // null = loading (skeletons!)
  const [one, setOne] = useState(null); // detail row (null = loading/missing!)

  useEffect(() => { // inbox list (both modes — detail needs the row even before mark-read returns!)
    api('/api/me/notifications').then(({ ok, data }) => {
      if (ok && Array.isArray(data.items)) setItems(data.items);
      else setItems([]);
    });
  }, []);

  useEffect(() => { // detail mode: open + mark read (scoped server-side — another shop's id = 404!)
    if (!id) { setOne(null); return; }
    setOne(null);
    api(`/api/me/notifications/${id}/read`, { method: 'POST' }).then(({ ok, data }) => {
      setOne(ok ? data : 'missing');
    });
  }, [id]); // id change (list → detail, detail → detail) re-runs

  if (id) { // ── DETAIL: the whole story (photo/video + full long body!) ──
    return (
      <div className="page">
        <p style={{ marginBottom: 10 }}><Link className="mini-link" to="/notifications">← All notifications</Link></p>
        {!one ? <div className="card"><div className="skel" /></div>
          : one === 'missing' ? <div className="card"><div className="empty"><b>Not found</b>This notice is gone or was never yours.</div></div>
            : (
              <div className="card">
                <h1 style={{ fontSize: 20 }}>{one.title}</h1>
                <p className="hint">{one.created_at ? new Date(one.created_at).toLocaleString() : ''}</p>
                {one.image_url ? <img src={one.image_url} alt="" loading="lazy" style={{ marginTop: 12, maxWidth: '100%', borderRadius: 14, display: 'block' }} onError={(e) => { e.target.style.display = 'none'; }} /> : null}
                {one.video_url ? <video src={one.video_url} controls preload="metadata" style={{ marginTop: 12, maxWidth: '100%', borderRadius: 14, display: 'block' }} /> : null}
                {one.body ? <p style={{ marginTop: 12, whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{one.body}</p> : null}
                {one.link ? <div style={{ marginTop: 14 }}><Link className="btn" to={one.link}>Open</Link></div> : null}
              </div>
            )}
      </div>
    );
  }

  return ( // ── LIST: every notice (tap → full page!) ──
    <div className="page">
      <div className="page-head"><div><h1>Notifications</h1><p>Payment news and app updates — tap any row to read it fully.</p></div></div>
      <div className="card">
        {items === null ? <div className="skel-grid">{[0, 1, 2].map((i) => (<div key={i} className="skel" style={{ height: 56, marginBottom: 8 }} />))}</div>
          : items.length === 0 ? <div className="empty"><b>All caught up</b>Payment verifications and app updates will land here.</div>
            : items.map((n) => (
              <button key={n.id} className={'nbell-item' + (n.is_read ? '' : ' fresh')} style={{ borderBottom: '1px solid var(--line-soft)' }} onClick={() => nav(`/notifications/${n.id}`)}>
                <span className="nbell-dot" />
                {n.image_url ? <img src={n.image_url} alt="" loading="lazy" width="44" height="44" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, flex: '0 0 auto' }} onError={(e) => { e.target.style.display = 'none'; }} /> : null}
                <span className="nbell-main">
                  <b>{n.title}</b>
                  {n.video_url && !n.image_url ? <span className="pill" style={{ fontSize: 11 }}>Has video</span> : null}
                  {n.body ? <span>{String(n.body).slice(0, 140)}{String(n.body).length > 140 ? '… tap to read all' : ''}</span> : null}
                  <i>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</i>
                </span>
              </button>
            ))}
      </div>
    </div>
  );
}
