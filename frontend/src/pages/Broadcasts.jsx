// ── frontend/src/pages/Broadcasts.jsx ─────────────────────────────
// WHAT: one message to many past customers, each in their own chat. Write it,
// pick who gets it and the channel, see exactly who it reaches (Telegram,
// WhatsApp in the last 24 hours, older WhatsApp that needs a template), see
// how the customer will read it, send. Below: broadcasts sent before.
// Server rules live in src/services/broadcastService.js (STOP line, limits).
import { useEffect, useRef, useState } from 'react';
import { api, pop, toast } from '../lib/api.js';
import Loader from '../components/Loader.jsx';
import Ic from '../components/icons.jsx';
import { CHANNEL_COINS } from '../lib/channelLogos.js';
import { when } from '../lib/orders.js';

let coinN = 0;
function Coin({ ch, s = 24 }) {
  coinN += 1;
  return <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: '0 0 auto' }} dangerouslySetInnerHTML={{ __html: CHANNEL_COINS[ch].replace(/(msg-g|ig-g)/g, '$1-b' + coinN) }} />;
}
const AUD = [['all', 'Everyone'], ['recent', 'Last 30 days'], ['bought', 'Bought before'], ['not_bought', "Asked, didn't buy"]];
const CH = [['all', 'Both'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram']];
const PLAN = { free: 'Free', pro: 'Plus', plus: 'Pro', business: 'Business' };
const FOOTER = 'Reply STOP to stop these messages.';

export default function Broadcasts() {
  const [msg, setMsg] = useState('');
  const [aud, setAud] = useState('recent');
  const [ch, setCh] = useState('all');
  const [tpl, setTpl] = useState('');
  const [pv, setPv] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    let dead = false;
    setPv(null);
    api(`/api/me/broadcasts/preview?audience=${aud}&channel=${ch}`, { timeout: 15000 }).then(({ ok, data }) => { if (!dead && ok) setPv(data); });
    return () => { dead = true; };
  }, [aud, ch]);
  const loadHistory = () => api('/api/me/broadcasts', { timeout: 15000 }).then(({ ok, data }) => setHistory(ok ? data.broadcasts || [] : []));
  useEffect(() => { loadHistory(); }, []);
  useEffect(() => { // refresh counts while one is still sending
    if (!history || !history.some((b) => b.status === 'sending')) return undefined;
    const t = setTimeout(loadHistory, 4000);
    return () => clearTimeout(t);
  }, [history]);

  function addName() {
    const el = box.current;
    const at = el ? el.selectionStart : msg.length;
    const next = msg.slice(0, at) + '{name}' + msg.slice(at);
    setMsg(next.slice(0, 1000));
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + 6; } });
  }

  const waOld = pv ? pv.whatsappNeedsTemplate : 0;
  const reachNow = pv ? Math.min(pv.max, pv.telegram + pv.whatsappFree + (tpl.trim() ? waOld : 0)) : 0;
  const left = pv ? pv.limit.left : 0;
  const sample = (msg.trim() || 'Your message shows here.').replace(/\{name\}/gi, 'Tunde');

  async function send() {
    if (busy || !pv) return;
    if (msg.trim().length < 2) return pop('err', 'Write the message first', 'Tell customers what is new: stock, a sale, opening hours.');
    setBusy(true);
    const { ok, data } = await api('/api/me/broadcasts', { method: 'POST', body: JSON.stringify({ message: msg.trim(), audience: aud, channel: ch, waTemplate: tpl.trim() || null }) });
    setBusy(false);
    if (!ok) return pop('err', 'Broadcast not sent', (data && data.error) || 'Check your connection and try again.');
    toast('Sending to ' + reachNow + (reachNow === 1 ? ' person' : ' people') + '. It shows in each chat too.');
    setMsg(''); setTpl('');
    loadHistory();
    api(`/api/me/broadcasts/preview?audience=${aud}&channel=${ch}`).then(({ ok: k, data: d }) => { if (k) setPv(d); });
  }

  const status = pv ? `${left} broadcast${left === 1 ? '' : 's'} left ${pv.limit.per === 'week' ? 'this week' : 'today'} (${PLAN[pv.limit.tier] || 'Free'})` : 'Broadcasts';
  return (
    <div className="bc">
      <div className="in-head">
        <div>
          <div className={'dg-status' + (left ? ' on' : '')}><i />{status}</div>
          <h1>Broadcasts</h1>
          <p>One message to many past customers, each in their own chat.</p>
        </div>
      </div>

      <div className="bc-grid">
        <section className="bc-card" aria-label="Write the broadcast">
          <label className="rc-lbl" htmlFor="bc-msg">Your message</label>
          <textarea id="bc-msg" ref={box} className="bc-msg" value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 1000))} placeholder="Hi {name}, new stock just landed! Reply to order." rows={6} />
          <div className="bc-meta"><button type="button" className="bc-name" onClick={addName}>+ {'{name}'}</button><span>adds each customer's first name</span><span className="bc-count">{msg.length} / 1,000</span></div>

          <span className="rc-lbl">Who gets it</span>
          <div className="wx-pills bc-wrap" role="group" aria-label="Who gets it">
            {AUD.map(([k, t]) => <button key={k} type="button" className={'wx-pill' + (aud === k ? ' on' : '')} aria-pressed={aud === k} onClick={() => setAud(k)}>{t}</button>)}
          </div>
          <span className="rc-lbl">Channel</span>
          <div className="rc-seg" role="group" aria-label="Channel">
            {CH.map(([k, t]) => <button key={k} type="button" className={ch === k ? 'on' : ''} aria-pressed={ch === k} onClick={() => setCh(k)}>{t}</button>)}
          </div>
        </section>

        <div className="bc-side">
          <section className="bc-reach" aria-label="Who it reaches">
            <div className="bc-reach-top"><b>This will reach</b><strong>{pv ? `${reachNow} ${reachNow === 1 ? 'person' : 'people'}` : '…'}</strong></div>
            {!pv ? <div className="skel" style={{ height: 90, borderRadius: 16 }} /> : (<>
              <div className="bc-line"><Coin ch="telegram" /><span>Telegram</span><b>{pv.telegram}</b></div>
              <div className="bc-line"><Coin ch="whatsapp" /><span>WhatsApp, wrote in the last 24 hours</span><b>{pv.whatsappFree}</b></div>
              {waOld > 0 && <div className="bc-line is-warn"><Coin ch="whatsapp" /><span>WhatsApp, older: needs a WhatsApp template</span><b>{waOld}</b></div>}
              {waOld > 0 && (<>
                <p className="bc-warn">WhatsApp only allows free messages to people who wrote in the last 24 hours. Add an approved template name to reach the other {waOld} (Meta charges your WhatsApp account per message), or leave it empty to skip them.</p>
                <input className="rc-fld" value={tpl} onChange={(e) => setTpl(e.target.value)} placeholder="WhatsApp template name (optional)" aria-label="WhatsApp template name" />
              </>)}
              {pv.capped && <p className="bc-warn">Your plan sends to {pv.max.toLocaleString()} people per broadcast; the most recent come first.</p>}
            </>)}
          </section>

          <section className="bc-prev" aria-label="Preview">
            <small>How Tunde sees it</small>
            <div className="bc-bubble">{sample}<br /><br /><span className="bc-stop">{FOOTER}</span></div>
          </section>

          <button type="button" className="btn lg bc-send" onClick={send} disabled={busy || !pv || !reachNow || !left}>{busy ? <Loader size={17} /> : <Ic n="send" s={18} />}{!pv ? 'Send' : !left ? 'No broadcasts left' : `Send to ${reachNow} now`}</button>
          {pv && waOld > 0 && !tpl.trim() && <p className="od-note">{waOld} older WhatsApp customer{waOld === 1 ? '' : 's'} will be skipped (no template)</p>}
          {pv && !left && <p className="od-note">{pv.limit.per === 'week' ? 'The free plan includes one broadcast a week. Plus sends one every day.' : 'You have used today\'s broadcasts. More tomorrow.'}</p>}
        </div>
      </div>

      <section className="bc-card bc-hist" aria-label="Sent before">
        <b className="bc-hist-title">Sent before</b>
        {history === null ? <div className="skel" style={{ height: 60, borderRadius: 18 }} />
          : history.length === 0 ? <p className="od-note" style={{ textAlign: 'left' }}>Nothing sent yet. Your first broadcast shows here with how many it reached.</p>
            : history.map((b) => (
              <div key={b.id} className="bc-row">
                <span className="bc-row-ic" aria-hidden="true"><Ic n="send" s={18} /></span>
                <div><b>{b.message}</b><small>{b.status === 'sending' ? `Sending… ${b.sent} of ${b.recipients}` : `${b.sent} sent${b.skipped ? ` · ${b.skipped} skipped` : ''}${b.failed ? ` · ${b.failed} failed` : ''}`}</small></div>
                <small>{when(b.created_at)}</small>
              </div>
            ))}
      </section>
    </div>
  );
}
