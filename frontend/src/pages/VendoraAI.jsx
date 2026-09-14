// ── frontend/src/pages/VendoraAI.jsx ─────────────────────────────
// WHAT: Gemini-style general assistant — greeting hero + suggestion chips +
// thread + pill input + custom model picker (grouped, styled, mobile sheet).
// UNLIKE Playground: NOT catalog-grounded (free-form brain), WITH history,
// model choice, per-model caps, accurate "answered by X" captions.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, pop, toast } from '../lib/api.js';
import { maybeShowSponsor } from '../lib/ads.js';
import GlassUpsell from '../components/GlassUpsell.jsx';
import Ic from '../components/icons.jsx';

const SUGGESTIONS = [
  'Write a sales caption for my new product',
  'Give me 5 business name ideas',
  'How do I price my products?',
  'Draft a reply to a difficult customer',
];

const GROUPS = ['Fast', 'Smart', 'Reasoning', 'Premium'];

function badgeClass(badge) {
  if (badge === 'Fast') return 'ok';
  if (badge === 'Smart') return 'info';
  if (badge === 'Reasoning') return 'flag';
  return 'off';
}

function ModelPicker({ models, model, onPick, onLocked }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const current = models.find((m) => m.id === model) || { id: model, label: 'Gemini Flash (full)', badge: 'Smart', desc: 'Google · fuller answers, still free', tier: 'free' };

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open ]);

  function choose(m) {
    if (m.locked) { onLocked(m); return; }
    onPick(m.id);
    setOpen(false);
  }

  return (
    <div className="mpick" ref={wrap}>
      <button
        type="button"
        className="mpick-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="mpick-spark"><Ic n="spark" s={15} /></span>
        <span className="mpick-label">{current.label}</span>
        <span className={'pill ' + badgeClass(current.badge || 'Smart')}>{current.badge || 'Smart'}</span>
        {current.tier === 'paid' && <span className="mpick-pro">PRO</span>}
        <span className={'mpick-chev' + (open ? ' open' : '')}>▾</span>
      </button>
      {open && (
        <div className="mpick-pop" role="listbox" aria-label="Choose AI model">
          {models.length === 0 && <div className="mpick-empty">Loading AIs…</div>}
          {GROUPS.map((g) => {
            const items = models.filter((m) => (m.badge || 'Smart') === g);
            if (!items.length) return null;
            return (
              <div key={g} className="mpick-group">
                <div className="mpick-ghead">{g === 'Premium' ? '✦ Premium (Pro)' : g}</div>
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={m.id === model}
                    className={'mpick-opt' + (m.id === model ? ' sel' : '') + (m.locked ? ' locked' : '')}
                    onClick={() => choose(m)}
                  >
                    <span className="mpick-check">{m.id === model ? '●' : ''}</span>
                    <span className="mpick-main">
                      <span className="mpick-name">{m.locked ? '🔒 ' : ''}{m.label}</span>
                      <span className="mpick-desc">{m.desc || (m.tier === 'paid' ? 'Pro · premium quality' : 'Free · no cost')}</span>
                    </span>
                    {m.tier === 'paid'
                      ? <span className="pill off">PRO</span>
                      : <span className={'pill ' + badgeClass(m.badge || 'Smart')}>{m.badge || 'Smart'}</span>}
                  </button>
                ))}
              </div>
            );
          })}
          <div className="mpick-foot">Free AIs cost you nothing. Premium AIs need Pro — tap one to see why.</div>
        </div>
      )}
    </div>
  );
}

export default function VendoraAI({ biz }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => {
    try { return localStorage.getItem('vendora-model') || 'gemini-flash-full'; } catch { return 'gemini-flash-full'; } // full (not lite) default: complete answers, still free — lite stays one tap away
  });
  const threadRef = useRef(null); // the scrollable thread (we scroll THIS, never the page)
  const stick = useRef(true); // true = pinned to bottom (auto-follow new messages)
  const [upsell, setUpsell] = useState(false);
  const first = (biz?.name || 'there').split(' ')[0];

  function onThreadScroll(e) { // track whether the user is at the bottom…
    const el = e.currentTarget; // …so reading old messages never yanks them away
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }
  useEffect(() => { // anchored follow: instant jump, zero page motion…
    if (!stick.current) return; // …user scrolled up to read → leave them alone
    const el = threadRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); // rAF = after paint (correct height!)
  }, [msgs, busy]); // runs on every new bubble + typing toggle
  useEffect(() => {
    api('/api/me/ai-models').then(({ ok, data }) => {
      if (ok && Array.isArray(data.models)) {
        setModels(data.models);
        // Keep saved pick if still valid + unlocked; else first unlocked.
        const saved = (() => { try { return localStorage.getItem('vendora-model'); } catch { return null; } })();
        const okSaved = saved && data.models.some((m) => m.id === saved && !m.locked);
        if (okSaved) { setModel(saved); return; }
        if (!data.models.some((m) => m.id === model && !m.locked)) {
          const firstFree = data.models.find((m) => !m.locked);
          if (firstFree) setModel(firstFree.id);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistPick(id) {
    setModel(id);
    try { localStorage.setItem('vendora-model', id); } catch {}
    const m = models.find((x) => x.id === id);
    toast('Switched to ' + (m ? m.label : id), 'ok'); // visible proof the switch stuck
  }

  async function send(text, base) {
    const clean = (text ?? input).trim();
    if (!clean || busy) return;
    if (clean.length > 2000) return toast('Keep it under 2000 characters', 'err');
    stick.current = true; // sending = re-pin to bottom (user wants to see the answer)
    const pickedId = model;
    const pickedLabel = (models.find((m) => m.id === pickedId) || {}).label || 'AI';
    const log = base ?? msgs; // base override lets regenerate() resend without duplicating bubbles
    const next = [...log, { from: 'you', text: clean }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const { ok, status, data } = await api('/api/me/ask', {
        method: 'POST',
        body: JSON.stringify({ message: clean, history: log.slice(-12), model: pickedId }), // log (NOT next): history excludes the current question — no duplicate context
      });
      if (ok && data.reply) {
        // via = ACTUAL answerer from server (never assume = picked).
        // If server fell back (pick was down), say so honestly.
        const viaText = data.fallback && data.requested
          ? `${data.via} (your pick ${data.requested} was busy)`
          : (data.via || pickedLabel);
        setMsgs((m) => [...m, { from: 'ai', text: data.reply, via: viaText, modelId: data.model || pickedId }]);
      } else if (status === 402) {
        setUpsell(true);
      } else if (status === 429) {
        setMsgs((m) => [...m, { from: 'ai', text: data.error }]);
        toast('Daily limit reached', 'err');
        maybeShowSponsor();
      } else {
        setMsgs((m) => [...m, { from: 'ai', text: data.error || 'Vendora AI is resting — try again in a moment.' }]);
        toast(data.error || 'Ask failed', 'err');
      }
    } catch {
      setMsgs((m) => [...m, { from: 'ai', text: 'Network hiccup — check your connection and try again.' }]);
      toast('Network hiccup', 'err');
    }
    setBusy(false);
  }

  async function regenerate() { // short/weak answer? re-ask the last question (backend stub-guard usually already fixed it — this is the manual override)
    if (busy) return;
    const idx = msgs.map((m) => m.from).lastIndexOf('you'); // last question asked…
    if (idx < 0) return;
    await send(msgs[idx].text, msgs.slice(0, idx)); // …resent with history BEFORE it (no duplicated bubbles)
  }

  const current = models.find((m) => m.id === model);

  return (
    <div className="vai">
      <div className="vai-modelbar">
        <ModelPicker models={models} model={model} onPick={persistPick} onLocked={() => setUpsell(true)} />
        {current?.locked && <Link className="mini-link" to="/billing">Unlock Pro</Link>}
        <span className="mpick-hint">Switch brains anytime — the caption under each reply tells you who answered.</span>
        <GlassUpsell show={upsell} onClose={() => setUpsell(false)} />
      </div>
      {msgs.length === 0 ? (
        <div className="vai-hero">
          <img src="/logo.png" alt="Vendora AI" className="vai-logo" />
          <h1>Hello, {first}.</h1>
          <p>Ask Vendora AI anything — research, writing, ideas, advice. Not just your catalog.</p>
          <div className="vai-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="vai-chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="vai-thread" ref={threadRef} onScroll={onThreadScroll}>
          {msgs.map((m, i) => (
            <div key={i} className={m.from === 'you' ? 'vai-you' : 'vai-ai'}>
              {m.from === 'ai' && <img src="/logo.png" alt="" className="vai-mini" />}
              <div>
                <div className="vai-bubble">{m.text}</div>
                {m.via && <div className="vai-via">answered by {m.via}</div>}
              </div>
            </div>
          ))}
          {busy && (
            <div className="vai-ai">
              <img src="/logo.png" alt="" className="vai-mini" />
              <div className="vai-bubble typing"><span /><span /><span /></div>
            </div>
          )}
          {!busy && msgs.length > 0 && msgs[msgs.length - 1].from === 'ai' && (
            <button className="vai-regen" onClick={regenerate}>↻ Regenerate answer</button> // manual override for short/weak replies (resends the last question)
          )}
        </div>
      )}
      <div className="vai-bar">
        <div className="vai-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Vendora AI…"
            maxLength={2000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(); }}
          />
          <button className="vai-send" disabled={busy || !input.trim()} onClick={() => send()} aria-label="Send">
            <Ic n="send" s={17} />
          </button>
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>Vendora AI can make mistakes — double-check important facts. Chats aren't saved.</p>
      </div>
    </div>
  );
}
