// ── frontend/src/pages/Playground.jsx ────────────────────────────
// WHAT: "Test your bot" — a fake customer chat hitting POST /api/me/playground
// (the REAL generateReply with the REAL catalog, zero WhatsApp needed).
// If an answer is wrong HERE, fix the catalog — the bot will be wrong there too.
// STATE: msgs (thread incl. greeting), input (draft), busy (AI thinking?).
// Also sets localStorage 'vendora-tested' so the Dashboard checklist ticks!
import { useEffect, useState } from 'react'; // useState only (no mount fetch — starts with a greeting); useEffect = video gate once
import { maybeShowVideoAd } from '../lib/ads.js'; // page-entry 30s video gate (free tier, once/day!)

export default function Playground() { // no props (uses session catalog server-side)
  const [msgs, setMsgs] = useState([{ from: 'ai', text: 'Hi! I\'m your AI shop assistant. Ask me like a customer — e.g. "Abeg, do you have blue gown?"' }]); // initial AI greeting (from:'ai' renders left/green bubble; \' escapes apostrophe)
  const [input, setInput] = useState(''); // controlled input draft
  const [busy, setBusy] = useState(false); // true while awaiting AI (typing indicator + send lock — prevents double-submit races!)
  useEffect(() => { maybeShowVideoAd({ slot: 'page-playground' }); }, []); // [] = video gate once on entry (fire-and-forget: playground works UNDER the overlay!)
  async function send() {
    const text = input.trim(); // trim whitespace-only messages…
    if (!text || busy) return; // …reject empties AND clicks while busy (guard clause — the cheapest validation)
    try { localStorage.setItem('vendora-tested', '1'); } catch {} // mark "tested" for Dashboard checklist (try/catch = private-mode safe; fire-and-forget)
    setInput(''); setBusy(true); // clear box + lock (TWO setStates = ONE re-render — React batches!)
    setMsgs((m) => [...m, { from: 'you', text }]); // FUNCTIONAL update: (m) => new array (uses LATEST state — safe inside async fn where `msgs` variable would be STALE!). [...m, new] = immutable append (never .push — React needs new references to detect change!)
    try {
      const r = await fetch('/api/me/playground', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) }); // raw fetch here (not api()) — historic style, works identically (credentials:include = session cookie!)
      const data = await r.json().catch(() => ({})); // .catch(()=>({})) = empty-body safe parse
      setMsgs((m) => [...m, { from: 'ai', text: data.reply || data.reason || 'Hmm — I\'d hand this to a human. (No reply from test endpoint yet.)' }]); // reply wins; else handoff reason (TEACHES what to fix!); else generic fallback (|| chain = priority order)
    } catch { setMsgs((m) => [...m, { from: 'ai', text: "Hmm, that test didn't go through — check your connection and try again." }]); } // network DOWN → in-chat error (customer voice, zero dev-talk!)
    setBusy(false); // unlock (ALWAYS runs — try/catch has no early returns past this… note: placed AFTER try/catch, not in finally — equivalent here since catch doesn't return)
  }
  return (
    <>
      <div className="page-head"><div><h1>Test your bot</h1><p>Pretend to be a customer. If the answer is wrong here, fix the catalog — not the customer.</p></div></div>
      <div className="card">
        <div className="thread" style={{ minHeight: 220 }}> {/* .thread = chat column (CSS); minHeight stops layout jump when empty */}
          {msgs.map((m, i) => (<div key={i} className={m.from === 'you' ? 'bubble-out' : 'bubble-in'}>{m.text}</div>))} {/* key={i} ACCEPTABLE here (append-only list, never reorders — index keys only break on reorder/delete!); bubble-out = you/right, bubble-in = AI/left */}
          {busy && <div className="bubble-in"><span className="hint">Typing…</span></div>} {/* && conditional: typing bubble ONLY while busy */}
        </div>
        <div className="row-input"> {/* flex row: input stretches, button fixed (CSS .row-input rules) */}
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Do you have blue gown?" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} /> {/* controlled input + Enter-to-send (onKeyDown checks e.key — Shift+Enter irrelevant for <input> single-line) */}
          <button className="btn" disabled={busy} onClick={send}>Send</button> {/* disabled while busy (visual + functional lock) */}
        </div>
        <p className="hint" style={{ marginTop: 10 }}>Try: prices, stock, hours, delivery, then something you don't sell — watch it hand off instead of guessing.</p> {/* coaching footer (teaches the handoff test!) */}
      </div>
    </>
  );
}
