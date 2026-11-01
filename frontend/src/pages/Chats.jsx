// ── frontend/src/pages/Chats.jsx ──────────────────────────────────
// WHAT: the inbox on frosted glass — list and conversation side by side on
// desktop, list then conversation on a phone. Chats that need you come first.
// One row of filters, text search, and one Velo/You switch per chat. All data from
// /api/me/conversations (list) + /messages (thread) — no fake content.
// Outgoing bubbles carry no sender name: messages do not record yet whether Velo
// or the owner sent them, so the UI must not guess.
import CustomerFace from '../components/CustomerFace.jsx'; // real photo, or a person-shaped icon
import { waitedShort } from '../lib/waited.js'; // "12m" beside a waiting chat
import { useEffect, useRef, useState } from 'react'; // useState ×8; useEffect = load inbox on mount
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
  const threadRef = useRef(null); // the scrolling message column (we land on the newest message)
  useEffect(() => { // a conversation opens at the latest message, never at the oldest
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);
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
    if (window.innerWidth <= 760) window.scrollTo({ top: 0 }); // phone: the thread starts at its header, not mid-list
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
    && (!needle || ((c.customer_name || '') + ' ' + (c.customer_number || '') + ' ' + (c.last_message || '')).toLowerCase().includes(needle)))
    .sort((a, b) => (b.needs_human ? 1 : 0) - (a.needs_human ? 1 : 0)); // chats that need you come first; each group keeps the server's newest-first order
  const chanCount = (k) => (convos || []).filter((c) => (c.channel || 'whatsapp') === k).length; // only offer a channel tab that actually has chats
  const needsCount = (convos || []).filter((c) => c.needs_human).length; // badge on the Needs-you tab (real count!)

  async function takeover(paused) { // flip THIS chat's bot: true = you talk (bot silent), false = AI resumes.
    if (!thread || !!thread.bot_paused === !!paused) return; // already in that mode — no dead request
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
      <div className="page-head"><div><h1>Inbox</h1><p>Every chat from your channels, in one place.</p></div></div>
      <LoadFailed title="Couldn't load inbox" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setConvos(null); setTries((t) => t + 1); }} backTo="/dashboard" backLabel="Back to Home" />
    </>
  );
  const firstName = (c) => String((c && (c.customer_name || c.customer_number)) || 'them').trim().split(/\s+/)[0];
  const channelName = (c) => ((c.channel || 'whatsapp') === 'telegram' ? 'Telegram' : 'WhatsApp');
  const ChanDot = ({ c }) => (
    (c.channel || 'whatsapp') === 'telegram'
      ? <span className="wx-chan-dot is-tg"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M2.7 20.1L22.1 12 2.7 3.9v5.9L15.2 12 2.7 14.2z" /></svg></span>
      : <span className="wx-chan-dot is-wa"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" /></svg></span>
  );
  return ( // the inbox: list | conversation (a phone shows list OR conversation)
    <div className={'wx-layout' + (thread ? ' wx-has-thread' : '')}>
      {/* LEFT: conversation list */}
      <section className="wx-list" aria-label="Conversations">
        <div className="wx-list-head"><h1>Inbox</h1><span>{convos === null ? '' : convos.length + (convos.length === 1 ? ' chat' : ' chats')}</span></div>
        <div className="wx-search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search conversations" />
          {q && <button className="wx-clear" onClick={() => setQ('')} aria-label="Clear search">×</button>}
        </div>
        <div className="wx-pills" role="group" aria-label="Filter chats">
          <button className={'wx-pill' + (filter === 'all' && chan === 'all' ? ' on' : '')} aria-pressed={filter === 'all' && chan === 'all'} onClick={() => { setFilter('all'); setChan('all'); }}>All</button>
          <button className={'wx-pill' + (filter === 'needs' ? ' on is-hot' : needsCount > 0 ? ' is-hot-soft' : '')} aria-pressed={filter === 'needs'} onClick={() => setFilter(filter === 'needs' ? 'all' : 'needs')}>Needs you {convos === null ? '' : needsCount}</button>
          <button className={'wx-pill' + (filter === 'handled' ? ' on' : '')} aria-pressed={filter === 'handled'} onClick={() => setFilter(filter === 'handled' ? 'all' : 'handled')}>Handled</button>
          {[['whatsapp', 'WhatsApp'], ['telegram', 'Telegram']].filter(([k]) => chanCount(k) > 0).map(([k, l]) => (
            <button key={k} className={'wx-pill' + (chan === k ? ' on' : '')} aria-pressed={chan === k} onClick={() => setChan(chan === k ? 'all' : k)}>{l}</button>
          ))}
        </div>
        <div className="wx-rows">
          {convos === null ? ([0, 1, 2, 3, 4].map((i) => (<div key={i} className="wx-skel"><div className="skel skel-dot" /><div className="skel-lines"><div className="skel" style={{ width: '35%' }} /><div className="skel" style={{ width: '80%' }} /></div></div>)))
            : list.length === 0 ? (<div className="empty"><b>Nothing here</b>{needle || filter !== 'all' || chan !== 'all' ? 'No chats match. Clear your search or try All.' : 'Chats appear once you connect a channel.'}</div>)
            : list.map((c) => (
              <button key={c.id} className={'wx-row' + (c.needs_human ? ' is-needs' : '') + (thread && thread.id === c.id ? ' sel' : '')} onClick={() => open(c)} aria-current={thread && thread.id === c.id ? 'true' : undefined}>
                <span className="wx-ava" aria-hidden="true"><CustomerFace photo={c.customer_photo} /><ChanDot c={c} /></span>
                <span className="wx-main">
                  <span className="wx-top"><b>{c.customer_name || c.customer_number}</b>{c.needs_human ? <span className="wx-needs">Needs you, {waitedShort(c.updated_at || c.created_at)}</span> : <small>{fmtTime(c.updated_at)}</small>}</span>
                  <span className="wx-sub"><span>{(c.last_message || '').slice(0, 60) || 'No messages yet'}</span></span>
                  {c.bot_paused ? <span className="wx-chan-line">You are answering</span> : null}
                </span>
              </button>
            ))}
        </div>
      </section>

      {/* RIGHT: conversation */}
      <section className="wx-thread" aria-label={thread ? 'Conversation' : 'No conversation selected'}>
        {!thread ? (<div className="empty"><span className="empty-ic"><Ic n="chat" s={24} /></span><b>Select a chat</b>Pick a conversation to read and reply.</div>)
          : (
            <>
              <div className="wx-thead">
                <button className="wx-back" onClick={() => { setThread(null); if (window.innerWidth <= 760) window.scrollTo({ top: 0 }); load(); }} aria-label="Back to Inbox"><Ic n="back" s={18} /></button>
                <span className="wx-ava" aria-hidden="true"><CustomerFace photo={thread.customer_photo} /></span>
                <div className="wx-thead-main">
                  <b>{thread.customer_name || thread.customer_number}</b>
                  <span>{channelName(thread)}{thread.customer_name && thread.customer_number ? ', ' + thread.customer_number : ''}</span>
                </div>
                {/* One switch, both states visible. Same control as the phone. */}
                <div className="wx-mode" role="group" aria-label="Who answers this chat">
                  <button className={'wx-seg' + (!thread.bot_paused ? ' on' : '')} aria-pressed={!thread.bot_paused} onClick={() => takeover(false)}>Velo answers</button>
                  <button className={'wx-seg' + (thread.bot_paused ? ' on' : '')} aria-pressed={!!thread.bot_paused} onClick={() => takeover(true)}>You answer</button>
                </div>
              </div>
              {thread.needs_human ? (
                <div className="wx-flag"><span className="wx-flag-ic"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16zM10 21h4" /></svg></span><span><b>Velo needs you.</b> {thread.flag_reason || 'It was not sure how to answer this one.'}</span></div>
              ) : thread.bot_paused ? <p className="wx-note">Velo is paused on this chat, so the customer only hears from you. Hand back anytime.</p> : null}
              <div className="thread" ref={threadRef}>
                {msgs === null ? (<div className="skel-grid"><div className="skel" style={{ width: '70%', height: 44, borderRadius: 14 }} /><div className="skel" style={{ width: '60%', height: 44, borderRadius: 14, justifySelf: 'end' }} /><div className="skel" style={{ width: '50%', height: 44, borderRadius: 14 }} /></div>)
                  : msgs.length === 0 ? <p className="hint">No messages.</p>
                  : msgs.map((m, i) => (<div key={i} className={m.direction === 'in' ? 'bubble-in' : 'bubble-out'}>{m.media_url && <img src={m.media_url} alt="" />}{m.body}<div className="ts">{fmtTime(m.created_at)}</div></div>))}
              </div>
              <div className="wx-compose">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={'Reply to ' + firstName(thread)} maxLength={2000} disabled={sending} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Reply message" />
                <button className="wx-send" disabled={sending || !draft.trim()} onClick={send} aria-label="Send">{sending ? <Loader size={17} /> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>}</button>
              </div>
              {!thread.bot_paused && <p className="wx-note is-center">Sending pauses Velo on this chat. Hand back when you are done.</p>}
            </>
          )}
      </section>
    </div>
  );
}
