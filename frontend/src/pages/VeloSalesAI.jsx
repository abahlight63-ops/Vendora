// ── frontend/src/pages/VeloSalesAI.jsx ─────────────────────────────
// WHAT: Gemini-style general assistant — greeting hero + suggestion chips +
// thread + pill input + custom model picker (grouped, styled, mobile sheet).
// UNLIKE Playground: NOT catalog-grounded (free-form brain), WITH history,
// model choice, per-model caps, accurate "answered by X" captions.
import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo.jsx'; // theme-aware brand mark (blue dark / green light!)
import { Link } from 'react-router-dom';
import { api, pop, toast } from '../lib/api.js';
import { maybeShowSponsor } from '../lib/ads.js';
import { chipsFor, DEFAULT_CHIPS } from '../lib/niches.js'; // niche starter chips (freelancer sees gigs, baker sees orders!)
import GlassUpsell from '../components/GlassUpsell.jsx';
import Ic from '../components/icons.jsx';
import ModelPicker from '../components/ModelPicker.jsx'; // shared brain picker (same component as Connect!)

const SUGGESTIONS = DEFAULT_CHIPS; // generic fallback (niche chips replace these when the shop picked a hustle!)

export default function VeloSalesAI({ biz }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => {
    try { return localStorage.getItem('vendora-model') || 'gemini-flash-full'; } catch { return 'gemini-flash-full'; } // full (not lite) default: complete answers, still free — lite stays one tap away
  });
  const threadRef = useRef(null); // the scrollable thread (we scroll THIS, never the page)
  const stick = useRef(true); // true = pinned to bottom (auto-follow new messages)
  const revealTimer = useRef(null); // typewriter interval (cleared on unmount / new question)
  useEffect(() => () => clearInterval(revealTimer.current), []); // unmount → stop typing (no setState on dead component)

  // Progressive reveal: write the answer small-small (~14 chars per tick) so
  // long answers READ downward instead of dumping all at once at the bottom.
  // The anchored-follow effect below re-runs on every tick (msgs changes).
  function reveal(idx, full, done) {
    clearInterval(revealTimer.current);
    let n = 0;
    revealTimer.current = setInterval(() => {
      n += 14;
      if (n >= full.length) {
        clearInterval(revealTimer.current);
        setMsgs((m) => m.map((b, i) => (i === idx ? { ...b, text: full } : b)));
        done();
      } else {
        const slice = full.slice(0, n);
        setMsgs((m) => m.map((b, i) => (i === idx ? { ...b, text: slice } : b)));
      }
    }, 24);
  }
  const [upsell, setUpsell] = useState(false);
  const [upsellLines, setUpsellLines] = useState(null); // quota-hit context lines (null = default premium list!)
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
    clearInterval(revealTimer.current); // new question kills any in-progress typing
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
        const idx = next.length; // the AI bubble's index (next = base + user msg, bubble appends right after)
        const full = data.reply;
        setMsgs((m) => [...m, { from: 'ai', text: '', via: viaText, modelId: data.model || pickedId }]);
        reveal(idx, full, () => setBusy(false)); // type out small-small; busy clears when typing finishes
        return; // NOTE: early return — setBusy(false) below is skipped while revealing
      } else if (status === 402) {
        setUpsell(true);
      } else if (status === 429) {
        setMsgs((m) => [...m, { from: 'ai', text: data.error }]);
        toast('Daily limit reached', 'err');
        maybeShowSponsor();
        setUpsellLines([ // quota wall = upgrade moment (context lines beat the generic list!)
          '50 free chats a day — Pro never queues',
          'Unlimited free AIs + 50 premium chats daily',
          'Kimi K2, Claude + GPT-4o mini included',
          'Zero ads, priority support',
        ]);
        setUpsell(true);
      } else {
        setMsgs((m) => [...m, { from: 'ai', text: data.error || 'Velo is resting — try again in a moment.' }]);
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
        {current?.locked && <Link className="mini-link" to="/billing">See upgrade options</Link>} {/* locked pick → billing (modal already explains why!) */}
        <span className="mpick-hint">Switch brains anytime — the caption under each reply tells you who answered.</span>
        <GlassUpsell show={upsell} lines={upsellLines} onClose={() => { setUpsell(false); setUpsellLines(null); }} />
      </div>
      {msgs.length === 0 ? (
        <div className="vai-hero">
          <Logo alt="Velo" className="vai-logo" />
          <h1>Chat with Velo.</h1>
          <p>Ask Velo anything — research, writing, ideas, advice. Not just your catalog.</p>
          <div className="vai-chips">
            {chipsFor(biz?.business_niche).map((s) => ( // niche chips (freelancer → gigs, baker → orders; generic when unset!)
              <button key={s} className="vai-chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="vai-thread" ref={threadRef} onScroll={onThreadScroll}>
          {msgs.map((m, i) => (
            <div key={i} className={m.from === 'you' ? 'vai-you' : 'vai-ai'}>
              {m.from === 'ai' && <Logo alt="" className="vai-mini" />}
              <div>
                <div className="vai-bubble">{m.text}</div>
                {m.via && <div className="vai-via">answered by {m.via}</div>}
              </div>
            </div>
          ))}
          {busy && (
            <div className="vai-ai">
              <Logo alt="" className="vai-mini" />
              <div className="vai-bubble typing"><span /><span /><span /></div>
            </div>
          )}
          {!busy && msgs.length > 0 && msgs[msgs.length - 1].from === 'ai' && (
            <button className="vai-regen" onClick={regenerate}><Ic n="refresh" s={14} /> Regenerate answer</button> // manual override for short/weak replies (resends the last question)
          )}
        </div>
      )}
      <div className="vai-bar">
        <div className="vai-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Velo…"
            maxLength={2000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(); }}
          />
          <button className="vai-send" disabled={busy || !input.trim()} onClick={() => send()} aria-label="Send">
            <Ic n="send" s={17} />
          </button>
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>VeloSales Ai can make mistakes — double-check important facts. Chats aren't saved.</p>
      </div>
    </div>
  );
}
