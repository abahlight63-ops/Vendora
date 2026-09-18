// ── frontend/src/pages/Chats.jsx ──────────────────────────────────
// WHAT: the inbox — filterable chat list (All / Needs you / Handled) + full
// thread view with photos + timestamps. Two "screens" in one component via
// `thread` state (null = list, object = thread). No router needed for this!
// STATE: convos (null = loading → skeletons), filter, thread, msgs.
// React pattern: CONDITIONAL early-return — `if (thread) return (…thread…)`
// renders a totally different screen from the same component.
import { useEffect, useState } from 'react'; // useState ×4; useEffect = load inbox on mount
import { api, fmtTime, toast } from '../lib/api.js'; // api() fetches; fmtTime stamps
import { maybeShowVideoAd } from '../lib/ads.js'; // page-entry 30s video gate (free tier, once/day — inbox pays too!)
import Ic from '../components/icons.jsx'; // back-arrow icon

export default function Chats() {
  const [convos, setConvos] = useState(null); // null = loading (skeleton rows); [] = loaded, empty inbox
  const [filter, setFilter] = useState('all'); // 'all' | 'needs' | 'handled' (tab state)
  const [thread, setThread] = useState(null); // null = LIST screen; conversation object = THREAD screen
  const [msgs, setMsgs] = useState(null); // thread messages (null = loading thread → bubble skeletons)
  async function load() { const { data } = await api('/api/me/conversations'); setConvos(data || []); } // reusable reload (called on mount + back-from-thread to refresh flags)
  useEffect(() => { load(); maybeShowVideoAd({ slot: 'page-chats' }); }, []); // [] = mount-only fetch + video gate (fire-and-forget: inbox loads UNDER the overlay!)
  async function open(c) { setThread(c); setMsgs(null); const { data } = await api('/api/me/conversations/' + c.id + '/messages'); setMsgs(data || []); } // open thread: show screen instantly (thread set) + spinner messages (msgs null) → fill when fetch lands. c.id in URL (backend ownership-checks it!)
  const list = (convos || []).filter((c) => filter === 'all' ? true : filter === 'needs' ? c.needs_human : !c.needs_human); // nested ternary filter: all→everything; needs→flagged; handled→rest ((convos||[]) guards loading)

  async function takeover(paused) { // flip THIS chat's bot: true = you talk (bot silent), false = AI resumes. POSTs to the takeover endpoint, then refreshes local state so the badge flips instantly.
    const { ok } = await api('/api/me/conversations/' + thread.id + '/takeover', { method: 'POST', body: JSON.stringify({ paused }) });
    if (ok) { setThread({ ...thread, bot_paused: paused }); load(); } // spread-copy with new flag (immutable update!) + reload list (badges there too)
    else toast('Could not update takeover', 'err'); // failure toast (button stays — retry possible)
  }
  if (thread) { // THREAD SCREEN (early return — completely different JSX below list screen)
    return (
      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}> {/* action row: back + takeover toggle side by side */}
          <button className="btn ghost sm" onClick={() => { setThread(null); load(); }}><Ic n="back" s={14} /> Back to inbox</button> {/* back: clear thread (→ list) + reload (flags may have changed) — two statements in one arrow body {} */}
          {thread.bot_paused // ternary: paused → green "Hand back to AI", else gold "Take over" (color = state at a glance!)
            ? <button className="btn sm" onClick={() => takeover(false)}>Hand back to AI</button>
            : <button className="btn ghost sm" onClick={() => takeover(true)}>Take over (pause bot)</button>}
        </div>
        {thread.bot_paused && <p className="hint" style={{ marginTop: 8 }}>Bot paused on this chat — the customer hears only you. Hand back anytime.</p>} {/* && explainer (only when paused — teaches what silence means!) */}
        <h2 style={{ margin: '12px 0 2px' }}>{thread.customer_name || thread.customer_number}</h2> {/* name or number (|| fallback) */}
        <p className="desc">{thread.customer_number} {thread.needs_human ? '· needs you' : '· handled by AI'}</p> {/* status suffix (ternary) */}
        <div className="thread"> {/* .thread = flex column of bubbles (CSS) */}
          {msgs === null ? (<div className="skel-grid"><div className="skel" style={{ width: '70%', height: 44, borderRadius: 14 }} /><div className="skel" style={{ width: '60%', height: 44, borderRadius: 14, justifySelf: 'end' }} /><div className="skel" style={{ width: '50%', height: 44, borderRadius: 14 }} /></div>) : msgs.length === 0 ? <p className="hint">No messages.</p> : // trilogy: loading bubbles (left/right/left mimic chat!) → empty → messages
            msgs.map((m, i) => (<div key={i} className={m.direction === 'in' ? 'bubble-in' : 'bubble-out'}>{m.media_url && <img src={m.media_url} alt="" />}{m.body}<div className="ts">{fmtTime(m.created_at)}</div></div>))} {/* key={i} index OK here (messages never reorder); bubble-in (customer, left) vs bubble-out (bot, right/green); {m.media_url && <img>} = photo only when present; .ts = tiny timestamp */}
        </div>
      </div>
    );
  }
  return ( // LIST SCREEN (thread is null)…
    <>
      <div className="page-head"><div><h1>Inbox</h1><p>Every WhatsApp chat. Green = AI handled. Gold = needs your human touch.</p></div></div>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}> {/* filter tabs row */}
          {[['all', 'All'], ['needs', 'Needs you'], ['handled', 'Handled']].map(([k, l]) => ( // array-of-pairs mapped to buttons (destructure [k,l] per pair!)
            <button key={k} className={'btn sm ' + (filter === k ? '' : 'ghost')} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="table-wrap"><table> {/* scroll wrapper (mobile) + semantic table */}
          <thead><tr><th>Customer</th><th>Last message</th><th>Status</th></tr></thead>
          <tbody> {/* trilogy again: loading → empty (filter-aware message!) → rows */}
            {convos === null ? <tr><td colSpan="3"><div className="skel-grid">{[0, 1, 2, 3].map((i) => (<div key={i} className="skel-row"><div className="skel skel-dot" /><div className="skel-lines"><div className="skel" style={{ width: '30%' }} /><div className="skel" style={{ width: '70%' }} /></div></div>))}</div></td></tr>
              : list.length === 0 ? <tr><td colSpan="3"><div className="empty"><b>Nothing here</b>{filter === 'all' ? 'Chats appear once WhatsApp is connected.' : 'No chats match this filter.'}</div></td></tr>
              : list.map((c) => (<tr key={c.id} className="rowlink" onClick={() => open(c)}>
                <td><b>{c.customer_name || c.customer_number}</b><br /><span className="hint">{fmtTime(c.updated_at)}</span></td> {/* name (or number) + timestamp below */}
                <td>{(c.last_message || '').slice(0, 90)}</td> {/* preview capped at 90 chars (|| '' guards null) */}
                <td><span className={'pill ' + (c.needs_human ? 'flag' : 'ok')}>{c.needs_human ? 'needs you' : 'handled'}</span>{c.bot_paused ? <span className="pill info" style={{ marginLeft: 6 }}>you talk</span> : null}</td>
              </tr>))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
