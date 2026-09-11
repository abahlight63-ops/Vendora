// ── frontend/src/pages/VendoraAI.jsx ─────────────────────────────
// WHAT: Gemini-style general assistant — greeting hero + suggestion chips +
// thread + pill input + model dropdown (7 AIs, paid locked for free tier).
// UNLIKE Playground: NOT catalog-grounded (free-form brain), WITH history,
// model choice, per-model caps, "answered by X" captions, sponsor hook on 429.
// STATE: msgs ({from, text, via?}), input, busy, models (dropdown list), model.
import { useEffect, useRef, useState } from 'react'; // useEffect = fetch models + autoscroll; useRef = scroll anchor (DOM node WITHOUT re-render!)
import { Link } from 'react-router-dom'; // Unlock-Pro link (locked model selected)
import { api, pop, toast } from '../lib/api.js'; // api() ask/models; pop() paywall popup; toast() small errors
import { maybeShowSponsor } from '../lib/ads.js'; // sponsor interstitial on daily-limit hit (perfect contextual moment!)
import Ic from '../components/icons.jsx'; // send-arrow icon

const SUGGESTIONS = [ // hero chips: one-tap starters (each sends immediately — zero typing needed!)
  'Write a sales caption for my new product',
  'Give me 5 business name ideas',
  'How do I price my products?',
  'Draft a reply to a difficult customer',
];

export default function VendoraAI({ biz }) { // biz = business (name for greeting)
  const [msgs, setMsgs] = useState([]); // [] = hero mode (greeting + chips); non-empty = thread mode (conditional UI on length!)
  const [input, setInput] = useState(''); // controlled draft
  const [busy, setBusy] = useState(false); // AI thinking (typing dots + send lock)
  const [models, setModels] = useState([]); // dropdown options [{id, label, tier, locked}] (empty → single fallback option below)
  const [model, setModel] = useState('gemini-flash'); // selected model id (default = free Gemini — safe before list loads!)
  const bottom = useRef(null); // ref object {current: null→div} — mutating .current does NOT re-render (unlike state!)
  const first = (biz?.name || 'there').split(' ')[0]; // greeting name ("Amaka Beauty Studio" → "Amaka")

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]); // autoscroll on new message/busy-toggle (?. guards pre-mount null; smooth = animated scroll)
  useEffect(() => { // mount: fetch dropdown list (locked flags depend on tier — computed SERVER-side!)…
    api('/api/me/ai-models').then(({ ok, data }) => { // .then (not await — fire-and-forget inside effect; effect callbacks can't be async!)
      if (ok && Array.isArray(data.models)) { // Array.isArray guards malformed responses (defensive frontend!)
        setModels(data.models); // store options…
        if (!data.models.some((m) => m.id === 'gemini-flash' && !m.locked)) { // …but if default choice is missing/locked (weird backend state)…
          const first = data.models.find((m) => !m.locked); // …pick first UNLOCKED model instead (.find = first match or undefined)…
          if (first) setModel(first.id); // …so the dropdown never starts on a locked/invalid value (if ALL locked, keep default — server will 402 with upgrade message)
        }
      }
    });
  }, []); // [] = mount-only

  async function send(text) { // text = optional preset (chips pass it; send() reads input otherwise)
    const clean = (text ?? input).trim(); // ?? picks text when provided (chip) else input; .trim() kills whitespace-only
    if (!clean || busy) return; // guard: empty + double-submit
    if (clean.length > 2000) return toast('Keep it under 2000 characters', 'err'); // client-side length mirror of server cap (fail fast, no wasted request!)
    const next = [...msgs, { from: 'you', text: clean }]; // build the NEW thread LOCALLY first (needed for history payload below)…
    setMsgs(next); setInput(''); setBusy(true); // …paint user message instantly (optimistic UI — feels instant!), clear box, lock
    try {
      const { ok, status, data } = await api('/api/me/ask', { // status ALSO destructured (need 402 vs 429 vs 502 differences!)
        method: 'POST',
        body: JSON.stringify({ message: clean, history: next.slice(-12), model }), // history = last 12 (server re-slices too — belt & braces); model = dropdown id (server VALIDATES tier!)
      });
      if (ok && data.reply) { // 200 + reply → append AI message WITH via caption…
        setMsgs((m) => [...m, { from: 'ai', text: data.reply, via: data.via }]); // functional update (latest state!) + extra `via` field (undefined for old messages — rendering guards with {m.via && …})
      } else if (status === 402) { // 402 = paywall (locked premium model — shouldn't happen via UI, but tampered requests possible!)…
        pop('err', 'Pro AI', data.error || 'Upgrade to unlock premium AIs.'); // …big upgrade popup (conversion moment!)
      } else if (status === 429) { // 429 = daily cap hit…
        setMsgs((m) => [...m, { from: 'ai', text: data.error }]); // …show the limit AS a chat message (conversational, not a dead popup!)…
        toast('Daily limit reached', 'err'); // …plus small toast…
        maybeShowSponsor(); // …plus sponsor interstitial (monetize the limit moment! fire-and-forget, daily-capped inside)
      } else { // 502/500/other → in-chat error (keep the conversation alive!)…
        setMsgs((m) => [...m, { from: 'ai', text: data.error || 'Vendora AI is resting — try again in a moment.' }]);
        toast(data.error || 'Ask failed', 'err');
      }
    } catch { // network DOWN (fetch threw — server unreachable)…
      setMsgs((m) => [...m, { from: 'ai', text: 'Network hiccup — check your connection and try again.' }]); // …in-chat message (bare `catch {` = we don't need the error object)
      toast('Network hiccup', 'err');
    }
    setBusy(false); // unlock (runs after EVERY path — no early returns above the try, so always reached)
  }

  const current = models.find((m) => m.id === model); // selected option object (for the locked-state Unlock link below; undefined while loading → ?. not needed, && guards)

  return (
    <div className="vai"> {/* .vai = column layout, max-width 760 (chat-app feel) */}
      <div className="vai-modelbar"> {/* dropdown row (label + select + conditional unlock link) */}
        <label htmlFor="vai-model">AI:</label> {/* htmlFor links label↔select (click label focuses select — accessibility!) */}
        <select id="vai-model" value={model} onChange={(e) => setModel(e.target.value)}> {/* controlled select: value mirrors state (options below) */}
          {models.length === 0 && <option value="gemini-flash">Gemini Flash</option>} {/* loading fallback (so the select is never empty!) */}
          {models.map((m) => ( // map options: locked gets 🔒 + (Pro) suffix (honest labeling!)
            <option key={m.id} value={m.id}>{m.locked ? '🔒 ' : ''}{m.label}{m.tier === 'paid' ? ' (Pro)' : ''}</option> {/* key={m.id} stable ids; string concat builds "🔒 Claude Haiku (Pro)" */}
          ))}
        </select>
        {current?.locked && <Link className="mini-link" to="/billing">Unlock Pro</Link>} {/* ?. guards loading; locked selection → direct upgrade path (conversion right where desire peaks!) */}
      </div>
      {msgs.length === 0 ? ( // HERO mode (no messages yet): logo + greeting + chips…
        <div className="vai-hero">
          <img src="/logo.png" alt="Vendora AI" className="vai-logo" /> {/* floating logo (CSS animation) */}
          <h1>Hello, {first}.</h1> {/* gradient headline (CSS background-clip:text!) */}
          <p>Ask Vendora AI anything — research, writing, ideas, advice. Not just your catalog.</p>
          <div className="vai-chips">
            {SUGGESTIONS.map((s) => ( // chips → send(s) directly (preset text bypasses input!)
              <button key={s} className="vai-chip" onClick={() => send(s)}>{s}</button> {/* key={s} = unique strings (stable!) */}
            ))}
          </div>
        </div>
      ) : ( // THREAD mode: bubbles + typing + scroll anchor…
        <div className="vai-thread">
          {msgs.map((m, i) => ( // key={i} OK (append-only, never reorders)
            <div key={i} className={m.from === 'you' ? 'vai-you' : 'vai-ai'}> {/* you = right/green; ai = left row with mini logo */}
              {m.from === 'ai' && <img src="/logo.png" alt="" className="vai-mini" />} {/* && conditional: logo only on AI rows (alt="" = decorative, screen readers skip) */}
              <div>
                <div className="vai-bubble">{m.text}</div> {/* white-space:pre-wrap in CSS = newlines render! */}
                {m.via && <div className="vai-via">answered by {m.via}</div>} {/* via caption ONLY when present (old/user messages skip) */}
              </div>
            </div>
          ))}
          {busy && ( // typing dots while awaiting (same row style as AI messages)…
            <div className="vai-ai">
              <img src="/logo.png" alt="" className="vai-mini" />
              <div className="vai-bubble typing"><span /><span /><span /></div> {/* 3 spans = 3 bouncing dots (CSS stagger) */}
            </div>
          )}
          <div ref={bottom} /> {/* INVISIBLE anchor div: ref={bottom} stores the DOM node; effect scrolls it into view (autoscroll trick!) */}
        </div>
      )}
      <div className="vai-bar"> {/* sticky bottom input (CSS position:sticky + fade mask) */}
        <div className="vai-input"> {/* pill container (focus ring on :focus-within!) */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Vendora AI…"
            maxLength={2000} // maxLength = browser blocks typing past 2000 (mirrors server cap — defense in depth with the toast check!)
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(); }} // Enter sends (Shift+Enter irrelevant single-line, but harmless guard)
          />
          <button className="vai-send" disabled={busy || !input.trim()} onClick={() => send()} aria-label="Send"> {/* round send button; disabled when busy OR blank (trim!); aria-label (icon-only!) */}
            <Ic n="send" s={17} /> {/* paper-plane icon */}
          </button>
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>Vendora AI can make mistakes — double-check important facts. Chats aren't saved.</p> {/* honesty footer (AI disclaimer = lawsuit-lite protection!) */}
      </div>
    </div>
  );
}
