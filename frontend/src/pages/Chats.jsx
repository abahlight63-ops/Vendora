// ── frontend/src/pages/Chats.jsx ──────────────────────────────────
// WHAT: the inbox — 3-panel on desktop (list | thread | contact), list→thread
// on mobile. Filters: status (All / Needs you / Handled) + channel chips +
// text search. AI/human takeover toggle per thread. All data from
// /api/me/conversations (list) + /messages (thread) — no fake content.
import { useEffect, useState } from 'react'; // useState ×8; useEffect = load inbox on mount
import { api, fmtTime, toast } from '../lib/api.js'; // api() fetches; fmtTime stamps; toast() send errors
import { describeNetError } from '../lib/netDetail.js'; // one voice for load failures (offline? waking? stale?)
import LoadFailed from '../components/LoadFailed.jsx'; // branded failed card + Retry (never eternal skeletons!)
import Ic from '../components/icons.jsx'; // icons
import Loader from '../components/Loader.jsx'; // mini orbit in the Send button

export default function Chats() {
  const [convos, setConvos] = useState(null); // null = loading (skeleton rows); [] = loaded, empty inbox
  const [filter, setFilter] = useState('all'); // 'all' | 'needs' | 'handled' (tab state)
  const [thread, setThread] = useState(null); // null = no thread selected; conversation object = thread open
  const [msgs, setMsgs] = useState(null); // thread messages (null = loading thread → bubble skeletons)
  const [draft, setDraft] = useState(''); // reply draft (controlled input!)
  const [sending, setSending] = useState(false); // send in flight (button locks — no double-sends!)
  const [failed, setFailed] = useState(null); // null | { status, detail } — list load failure (Retry card, never eternal skeletons!)
  const [tries, setTries] = useState(0); // retry counter (forces reload — no page refresh!)
  const [chan, setChan] = useState('all'); // 'all' | 'whatsapp' | 'telegram' — mixed inboxes need a way to zoom into one channel
  const [q, setQ] = useState(''); // list text search (name, number, preview — client-side, instant)
  async function load() { // reusable reload (mount + retry + back-from-thread to refresh flags)
    try {
      setFailed(null);
      const { data } = await api('/api/me/conversations', { timeout: 15000 });
      setConvos(data || []);
    } catch (e) { setFailed({ status: 0, detail: describeNetError(e) }); } // down/timeout → failed card (never eternal skeletons!)
  }
  useEffect(() => { // mount + retry (tries in deps!) + auto-retry when back online
    let dead = false; // unmount guard (slow networks + fast navigation!)
    load();
    const onOnline = () => { if (!dead && failed) setTries((t) => t + 1); }; // internet's back? reload without a tap!
    window.addEventListener('online', onOnline);
    return () => { dead = true; window.removeEventListener('online', onOnline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]);
  async function open(c) { // open thread: show instantly + spinner messages → fill when fetch lands
    setThread(c); setMsgs(null); setDraft('');
    try {
      const { data } = await api('/api/me/conversations/' + c.id + '/messages', { timeout: 15000 });
      setMsgs(data || []);
    } catch { toast('Could not open chat — check connection and retry', 'err'); setMsgs([]); } // failed open → toast + empty (thread stays — retry by reopening!)
  }
  // Channel + flag + text filters all apply. `c.channel || 'whatsapp'` matters:
  // rows written before the column existed come back null — treating those as
  // WhatsApp keeps old chats visible instead of silently vanishing.
  const needle = q.trim().toLowerCase();
  const list = (convos || []).filter((c) =>
    (chan === 'all' || (c.channel || 'whatsapp') === chan)
    && (filter === 'all' ? true : filter === 'needs' ? c.needs_human : !c.needs_human)
    && (!needle || ((c.customer_name || '') + ' ' + (c.customer_number || '') + ' ' + (c.last_message || '')).toLowerCase().includes(needle)));
  const chanCount = (k) => (convos || []).filter((c) => (c.channel || 'whatsapp') === k).length; // only offer a channel tab that actually has chats
  const needsCount = (convos || []).filter((c) => c.needs_human).length; // badge on the Needs-you tab (real count!)

  async function takeover(paused) { // flip THIS chat's bot: true = you talk (bot silent), false = AI resumes.
    const { ok } = await api('/api/me/conversations/' + thread.id + '/takeover', { method: 'POST', body: JSON.stringify({ paused }) });
    if (ok) { setThread({ ...thread, bot_paused: paused }); load(); } // spread-copy with new flag (immutable update!) + reload list (badges there too)
    else toast('Could not update takeover', 'err'); // failure toast (button stays — retry possible)
  }
  async function send() { // owner reply: sends through the chat's OWN channel, clears the gold flag + pauses the bot (you're talking now!)
    const text = draft.trim();
    if (!text || sending || !thread) return; // empty/double-tap/no-thread guards
    setSending(true);
    const { ok, data } = await api('/api/me/conversations/' + thread.id + '/reply', { method: 'POST', body: JSON.stringify({ text: text.slice(0, 2000) }) });
    setSending(false);
    if (ok) {
      setMsgs((msgs || []).concat([{ direction: 'out', body: text.slice(0, 2000), created_at: new Date().toISOString() }])); // optimistic append (bubble appears instantly — server already stored it!)
      setDraft(''); // clear the box
      setThread({ ...thread, needs_human: false, bot_paused: true }); // flag cleared + you-talk-now (Hand back to AI appears!)
      load(); // list badges refresh underneath
    } else toast((data && data.error) || 'Could not send — try again', 'err'); // honest backend reason (not connected? blocked chat? — retriable!)
  }
  if (failed && convos === null && !thread) return ( // list failed BEFORE first paint (nothing to show — failed card, never skeletons!)
    <>
      <div className="page-head"><div><h1>Inbox</h1><p>Every WhatsApp and Telegram chat, in one inbox. Green = AI handled. Gold = needs your human touch.</p></div></div>
      <LoadFailed title="Couldn't load inbox" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setConvos(null); setTries((t) => t + 1); }} backTo="/dashboard" backLabel="Back to Overview" />
    </>
  );
  const initialOf = (c) => (((c && (c.customer_name || c.customer_number)) || '?').trim()[0] || '?').toUpperCase();
  return ( // 3-panel inbox: list | thread | contact (mobile shows list OR thread)
    <>
      <div className="page-head"><div><h1>Inbox</h1><p>Every WhatsApp and Telegram chat, in one inbox. Green = AI handled. Gold = needs your human touch.</p></div></div>
      <div className={'wx-layout' + (thread ? ' wx-has-thread' : '')}>
        {/* LEFT: conversation list */}
        <section className="wx-list" aria-label="Conversations">
          <div className="wx-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number, message…" aria-label="Search conversations" />
            {q && <button className="wx-clear" onClick={() => setQ('')} aria-label="Clear search">×</button>}
          </div>
          <div className="wx-tabs" role="tablist" aria-label="Filter by status">
            {[['all', 'All', (convos || []).length], ['needs', 'Needs you', needsCount], ['handled', 'Handled', (convos || []).length - needsCount]].map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={'wx-tab' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}<b>{convos === null ? '·' : n}</b></button>
            ))}
          </div>
          <div className="wx-chans">
            {[['all', 'All'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram']].filter(([k]) => k === 'all' || chanCount(k) > 0).map(([k, l]) => (
              <button key={k} className={'wx-chip' + (chan === k ? ' on' : '')} onClick={() => setChan(k)} aria-pressed={chan === k}>{l}{k !== 'all' ? ` (${chanCount(k)})` : ''}</button>
            ))}
          </div>
          <div className="wx-rows">
            {convos === null ? ([0, 1, 2, 3, 4].map((i) => (<div key={i} className="wx-skel"><div className="skel skel-dot" /><div className="skel-lines"><div className="skel" style={{ width: '35%' }} /><div className="skel" style={{ width: '80%' }} /></div></div>)))
              : list.length === 0 ? (<div className="empty"><b>Nothing here</b>{needle || filter !== 'all' || chan !== 'all' ? 'No chats match — clear search or try All.' : 'Chats appear once you connect WhatsApp or Telegram.'}</div>)
              : list.map((c) => (
                <button key={c.id} className={'wx-row' + (thread && thread.id === c.id ? ' sel' : '')} onClick={() => open(c)} aria-current={thread && thread.id === c.id ? 'true' : undefined}>
                  <span className="wx-ava" aria-hidden="true">{initialOf(c)}{c.needs_human ? <i className="wx-dot" /> : null}</span>
                  <span className="wx-main">
                    <span className="wx-top"><b>{c.customer_name || c.customer_number}</b><small>{fmtTime(c.updated_at)}</small></span>
                    <span className="wx-sub"><span>{(c.last_message || '').slice(0, 60) || '—'}</span></span>
                    <span className="wx-tags">
                      <span className={'pill ' + (c.needs_human ? 'flag' : 'ok')} style={{ fontSize: 10 }}>{c.needs_human ? 'needs you' : 'handled'}</span>
                      <span className="pill info" style={{ fontSize: 10 }}>{(c.channel || 'whatsapp') === 'telegram' ? 'Telegram' : 'WhatsApp'}</span>
                      {c.bot_paused ? <span className="pill info" style={{ fontSize: 10 }}>you talk</span> : null}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        </section>

        {/* MIDDLE: thread */}
        <section className="wx-thread" aria-label={thread ? 'Conversation thread' : 'No conversation selected'}>
          {!thread ? (<div className="empty"><span className="empty-ic"><Ic n="chat" s={24} /></span><b>Select a chat</b>Pick a conversation to read and reply.</div>)
            : (
              <>
                <div className="wx-thead">
                  <button className="btn ghost sm wx-back" onClick={() => { setThread(null); load(); }} aria-label="Back to list"><Ic n="back" s={14} /></button>
                  <span className="wx-ava" aria-hidden="true">{initialOf(thread)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.customer_name || thread.customer_number}</b>
                    <span className="hint">{thread.customer_number} · {thread.needs_human ? 'needs you' : 'handled by AI'}</span>
                  </div>
                  {thread.bot_paused
                    ? <button className="btn sm" onClick={() => takeover(false)}>Hand back to AI</button>
                    : <button className="btn ghost sm" onClick={() => takeover(true)}>Take over</button>}
                </div>
                {thread.bot_paused
                  ? <p className="hint" style={{ margin: '8px 2px 0' }}>Bot paused — the customer hears only you. Hand back anytime.</p>
                  : (thread.flag_reason || thread.needs_human) ? <p className="hint" style={{ margin: '8px 2px 0' }}>{thread.flag_reason || 'Flagged for your human touch.'}</p> : null}
                <div className="thread">
                  {msgs === null ? (<div className="skel-grid"><div className="skel" style={{ width: '70%', height: 44, borderRadius: 14 }} /><div className="skel" style={{ width: '60%', height: 44, borderRadius: 14, justifySelf: 'end' }} /><div className="skel" style={{ width: '50%', height: 44, borderRadius: 14 }} /></div>)
                    : msgs.length === 0 ? <p className="hint">No messages.</p>
                    : msgs.map((m, i) => (<div key={i} className={m.direction === 'in' ? 'bubble-in' : 'bubble-out'}>{m.media_url && <img src={m.media_url} alt="" />}{m.body}<div className="ts">{fmtTime(m.created_at)}</div></div>))}
                </div>
                <div className="row-input" style={{ marginTop: 10 }}>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={thread.needs_human ? 'Answer them here — sending pauses the bot…' : 'Reply as yourself…'} maxLength={2000} disabled={sending} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Reply message" />
                  <button className="btn sm" disabled={sending || !draft.trim()} onClick={send}>{sending ? (<><Loader size={15} />Sending…</>) : 'Send'}</button>
                </div>
                {!thread.bot_paused && <p className="hint" style={{ marginTop: 6 }}>Sending pauses the bot on this chat — hand back to AI when you&apos;re done.</p>}
              </>
            )}
        </section>

        {/* RIGHT: contact panel */}
        {thread && (
          <aside className="wx-side" aria-label="Contact details">
            <div style={{ textAlign: 'center', padding: '6px 0 12px' }}>
              <span className="wx-ava lg" aria-hidden="true">{initialOf(thread)}</span>
              <b style={{ display: 'block', marginTop: 8 }}>{thread.customer_name || thread.customer_number}</b>
              <span className="hint">{thread.customer_number}</span>
            </div>
            <div className="wx-facts">
              <div><span>Channel</span><b>{(thread.channel || 'whatsapp') === 'telegram' ? 'Telegram' : 'WhatsApp'}</b></div>
              <div><span>Status</span><b>{thread.needs_human ? 'Needs you' : thread.bot_paused ? 'You talk' : 'AI handles'}</b></div>
              <div><span>Messages</span><b>{msgs === null ? '…' : msgs.length}</b></div>
              <div><span>Last active</span><b>{fmtTime(thread.updated_at)}</b></div>
            </div>
            {thread.flag_reason && <p className="hint" style={{ marginTop: 10 }}>Flag: {thread.flag_reason}</p>}
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {thread.bot_paused
                ? <button className="btn sm" onClick={() => takeover(false)}>Hand back to AI</button>
                : <button className="btn ghost sm" onClick={() => takeover(true)}>Take over (pause bot)</button>}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
