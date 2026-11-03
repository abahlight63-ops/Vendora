// ── frontend/src/pages/Playground.jsx ────────────────────────────
// WHAT: Test Drive (was "Test your bot"). The owner chats with Velo like a
// customer inside a phone that looks like the chosen channel. Replies come from
// POST /api/me/playground: the REAL reply engine with the REAL catalog.
// "How Velo answered" explains the last reply from facts on this page: which of
// the shop's products it named, whether it matched the customer's Pidgin, and
// whether it handed the chat to the owner. Nothing is guessed.
// Phone and desktop show the same parts; the phone stacks them under the chat.
// Also sets localStorage 'vendora-tested' so the Home checklist ticks.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Ic from '../components/icons.jsx';
import Logo from '../components/Logo.jsx';
import { CHANNEL_COINS } from '../lib/channelLogos.js';

const CHANNELS = [['whatsapp', 'WhatsApp'], ['telegram', 'Telegram'], ['messenger', 'Messenger'], ['instagram', 'Instagram']];
const TRIES = ['How much be this one?', 'Last price abeg', 'Do you deliver to Abuja?', 'Is it original?', 'I want 3, any discount?', 'Wetin be your account number?'];
const PIDGIN = /\b(abeg|dey|wetin|una|wan|na|sef|oga|abi|sha|shey|wahala|sharp sharp|e still|how much be)\b/i;
const time = () => new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

let coinN = 0;
function Coin({ id, s = 22 }) {
  coinN += 1;
  const n = coinN;
  return <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHANNEL_COINS[id].replace(/(msg-g|ig-g)/g, '$1-t' + n) }} />;
}

export default function Playground() {
  const [chan, setChan] = useState('whatsapp');
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState([]);
  const [why, setWhy] = useState(null); // explanation of the last reply
  const listRef = useRef(null);

  useEffect(() => { api('/api/me/products').then(({ ok, data }) => { if (ok && Array.isArray(data)) setProducts(data); }).catch(() => {}); }, []);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);

  function explain(asked, reply, handed) {
    const low = String(reply || '').toLowerCase();
    const hit = products.find((p) => p.name && low.includes(String(p.name).toLowerCase()))
      || products.find((p) => p.price && String(p.price).length > 2 && low.includes(String(p.price).toLowerCase()));
    return {
      product: hit || null,
      pidginAsked: PIDGIN.test(asked),
      pidginReplied: PIDGIN.test(reply || ''),
      handed,
    };
  }

  async function send(textIn) {
    const text = String(textIn ?? input).trim();
    if (!text || busy) return;
    try { localStorage.setItem('vendora-tested', '1'); } catch {}
    setInput('');
    setBusy(true);
    setMsgs((m) => [...m, { from: 'you', text, at: time() }]);
    try {
      const { ok, data } = await api('/api/me/playground', { method: 'POST', body: JSON.stringify({ message: text }), timeout: 30000 });
      const reply = ok && data && data.reply ? data.reply : null;
      const handed = !reply;
      const shown = reply || `I go ask the owner for you. They will reply you soon.${data && data.reason ? '' : ''}`;
      const ex = explain(text, reply, handed);
      setMsgs((m) => [...m, { from: 'ai', text: shown, at: time(), product: ex.product }]);
      setWhy({ ...ex, reason: handed ? ((data && (data.reason || data.error)) || 'Velo was not sure, so it would hand this chat to you.') : null });
    } catch {
      setMsgs((m) => [...m, { from: 'ai', text: "That test didn't go through. Check your connection and try again.", at: time() }]);
    }
    setBusy(false);
  }

  const restart = () => { setMsgs([]); setWhy(null); };
  const chName = CHANNELS.find((c) => c[0] === chan)[1];

  const phone = (
    <div className={'td-phone td-' + chan}>
      <div className="td-screen">
        <div className="td-top">
          <span className="td-avatar"><Logo size={18} alt="" /></span>
          <span className="td-top-main"><b>Your shop</b><small>{busy ? 'Velo is typing…' : `${chName} · Velo answers`}</small></span>
          <button type="button" className="td-restart" onClick={restart} aria-label="Start again"><Ic n="refresh" s={18} /></button>
        </div>
        <div className="td-thread" ref={listRef} aria-live="polite">
          <div className="td-note">Test Drive · only you can see this</div>
          {msgs.length === 0 && <div className="td-hint">Type a question like a customer, or tap one below.</div>}
          {msgs.map((m, i) => (
            <div key={i} className={m.from === 'you' ? 'td-out' : 'td-in'}>
              {m.product && (
                <div className="td-prod">
                  <span className="td-prod-img">{m.product.image_url ? <img src={m.product.image_url} alt="" /> : null}</span>
                  <span><b>{m.product.name}</b><small>{m.product.price || 'No price'}{m.product.quantity != null ? ` · ${m.product.quantity} left` : ''}</small></span>
                </div>
              )}
              {m.text}
              <small>{m.at}{m.from === 'you' ? ' ✓✓' : ''}</small>
            </div>
          ))}
          {busy && <div className="td-in td-typing"><i /><i /><i /></div>}
        </div>
        <form className="td-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type like a customer…" aria-label="Message as a customer" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M12 19V6M6 12l6-6 6 6" /></svg></button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="td">
      <div className="td-head">
        <div>
          <div className="dg-status on"><i />Only you can see these chats</div>
          <h1>Test Drive</h1>
          <p>Chat with Velo like a customer would, before real customers do.</p>
        </div>
        <div className="wx-pills td-chans" role="group" aria-label="Preview as">
          {CHANNELS.map(([k, n]) => <button key={k} type="button" className={'wx-pill' + (chan === k ? ' on' : '')} aria-pressed={chan === k} onClick={() => setChan(k)}><Coin id={k} />{n}</button>)}
        </div>
      </div>

      <div className="td-grid">
        <div className="td-left">{phone}</div>
        <div className="td-right">
          <section className="glass td-card">
            <h2>Try a real situation</h2>
            <p>Tap one and Velo answers as it would on {chName}.</p>
            <div className="td-tries">{TRIES.map((t) => <button key={t} type="button" className="wx-pill" disabled={busy} onClick={() => send(t)}>{t}</button>)}</div>
          </section>

          <section className="glass td-card">
            <div className="td-card-head"><h2>How Velo answered</h2>{why && <span className="ch-chip live">Last reply</span>}</div>
            {!why ? <p>Send a message and Velo explains its answer here.</p> : (
              <div className="td-why">
                <div className="td-score">
                  <span className={'td-dot ' + (why.product ? 'good' : 'soft')}><Ic n="box" s={18} /></span>
                  <span><b>{why.product ? 'Used your catalog' : why.handed ? 'No product needed' : 'No product named'}</b><small>{why.product ? `${why.product.name}${why.product.price ? ` · ${why.product.price}` : ''}${why.product.quantity != null ? ` · ${why.product.quantity} in stock` : ''}` : why.handed ? 'Velo handed this one to you' : 'If you expected a product, check its name and price in Catalog'}</small></span>
                </div>
                <div className="td-score">
                  <span className="td-dot indigo"><Ic n="spark" s={18} /></span>
                  <span><b>{why.pidginAsked ? (why.pidginReplied || why.handed ? 'Matched their Pidgin' : 'Answered in English') : 'Answered in English'}</b><small>{why.pidginAsked ? 'The customer wrote in Pidgin' : 'The customer wrote in English'}</small></span>
                </div>
                <div className="td-score">
                  <span className={'td-dot ' + (why.handed ? 'hot' : 'good')}><Ic n={why.handed ? 'hand' : 'check'} s={18} /></span>
                  <span><b>{why.handed ? 'Passed to you' : 'Answered on its own'}</b><small>{why.handed ? why.reason : 'Velo never gives a price that is not in your catalog'}</small></span>
                </div>
              </div>
            )}
          </section>

          <div className="td-two">
            <section className="glass td-card">
              <h2>Wrong answer?</h2>
              <p>Fix the product or add a rule, then try again.</p>
              <div className="td-acts"><Link className="btn ghost" to="/catalog">Edit catalog</Link><Link className="btn ghost" to="/ai-settings">AI settings</Link></div>
            </section>
            <section className="td-card td-live">
              <h2>Happy with Velo?</h2>
              <p>Connect your channels and let it answer real customers.</p>
              <Link className="td-live-go" to="/connect">Go live</Link>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
