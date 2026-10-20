// ── frontend/src/pages/VeloSalesAI.jsx ─────────────────────────────
// WHAT: Chat with Velo — the general assistant. A real app surface: the brain
// switch and the composer are fixed furniture and only the conversation
// scrolls. Your turn is a purple bubble on the right (purple = your voice);
// the answer is plain, well-spaced prose on the page itself, because on our
// near-white background a white bubble would be invisible.
//
// Answers are rendered through lib/rich.jsx, so "• option" lines become real
// bullets and "1." lines become a real numbered list instead of one grey wall.
//
// UNLIKE Playground: NOT catalog-only (free-form brain), WITH history, WITH
// photos (attach / paste / drop), and with the brain shown in plain words.
import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo.jsx'; // theme-aware brand mark
import { api, toast } from '../lib/api.js';
import { chipsFor } from '../lib/niches.js'; // niche starters (baker sees orders, not gowns)
import GlassUpsell from '../components/GlassUpsell.jsx';
import Ic from '../components/icons.jsx';
import BrainPicker, { BUCKETS, DEFAULT_BUCKET, bucketOf, idFor, labelFor } from '../components/BrainPicker.jsx';
import Rich from '../lib/rich.jsx'; // plain-text → real paragraphs / bullets / steps

const MAX_PHOTO = 12 * 1024 * 1024; // 12MB picked — we downscale before it ever leaves the browser

// Which glyph heads a suggestion card. The chips are written per niche, so the
// icon is inferred from what the asker is asking FOR rather than hard-coded
// per chip (every lane gets sensible icons for free).
function chipIcon(s) {
  const t = String(s).toLowerCase();
  if (/\bidea|ideas|brainstorm|content|outline|include|portfolio|should\b/.test(t)) return 'bulb';
  if (/\bprice|pricing|cost|charge|rate|quote|profit|package\b/.test(t)) return 'tag';
  if (/\breply|respond|answer|rebook|rebooking|enroll|qualify|buyer|viewing|follow|message\b/.test(t)) return 'chat';
  return 'pencil';
}
const TINT = { pencil: '', tag: 'w', bulb: 's', chat: '' }; // purple / gold / sky — three hues, one voice

function savedBrain() {
  try {
    const v = localStorage.getItem('vendora-brain');
    return ['fast', 'normal', 'smart'].includes(v) ? v : DEFAULT_BUCKET;
  } catch { return DEFAULT_BUCKET; }
}

export default function VeloSalesAI({ biz }) {
  const [msgs, setMsgs] = useState([]); // [{ from:'you'|'ai', text, image?, note?, live? }]
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false); // true from send until the answer has finished writing itself out
  const [models, setModels] = useState([]);
  const [brain, setBrain] = useState(savedBrain); // 'fast' | 'normal' | 'smart'
  const [img, setImg] = useState(null); // { dataUrl, name } — the photo waiting to be sent
  const [drag, setDrag] = useState(false); // a file is hovering the composer
  const [upsell, setUpsell] = useState(false);
  const [upsellLines, setUpsellLines] = useState(null); // quota-hit context lines (null = default premium list)
  const threadRef = useRef(null); // the ONE scrolling element (we scroll THIS, never the page)
  const fileRef = useRef(null); // the hidden <input type="file">
  const taRef = useRef(null); // the composer textarea (we resize THIS as you type)
  const stick = useRef(true); // true = pinned to bottom (auto-follow new messages)
  const revealTimer = useRef(null); // typewriter interval (cleared on unmount / new question)

  useEffect(() => () => clearInterval(revealTimer.current), []); // unmount → stop typing (no setState on a dead component)
  useEffect(() => { // grow the composer to fit the draft (capped, then it scrolls)
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, [input]);

  useEffect(() => { // load the engines once; nothing here needs a re-fetch
    api('/api/me/ai-models').then(({ ok, data }) => {
      if (ok && Array.isArray(data.models)) setModels(data.models);
    });
  }, []);

  // Streaming reveal: write the answer small-small so a long reply READS
  // downward instead of dumping in at the bottom. busy stays true until the
  // last character lands, which keeps send/regenerate locked in the meantime.
  function reveal(idx, full, done) {
    clearInterval(revealTimer.current);
    let n = 0;
    revealTimer.current = setInterval(() => {
      n += 20;
      if (n >= full.length) {
        clearInterval(revealTimer.current);
        setMsgs((m) => m.map((b, i) => (i === idx ? { ...b, text: full, live: false } : b)));
        done();
      } else {
        const slice = full.slice(0, n);
        setMsgs((m) => m.map((b, i) => (i === idx ? { ...b, text: slice } : b)));
      }
    }, 18);
  }

  const first = (biz?.name || 'there').split(' ')[0];
  const chips = chipsFor(biz?.business_niche);
  const canSend = !busy && (!!input.trim() || !!img);

  function onThreadScroll(e) { // track whether the reader is at the bottom…
    const el = e.currentTarget; // …so re-reading an old answer never yanks them away
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }
  useEffect(() => { // anchored follow: instant jump, zero page motion
    if (!stick.current) return;
    const el = threadRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [msgs, busy]);

  function pickBrain(key) {
    setBrain(key);
    try { localStorage.setItem('vendora-brain', key); } catch {}
    toast(labelFor(key) + ' answers', 'ok');
  }

  // One photo path for all three entrances (picker, paste, drop): read it,
  // shrink it on a canvas, then park it above the composer as a preview chip.
  function readImage(f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) return toast('That file is not an image', 'err');
    if (f.size > MAX_PHOTO) return toast('That photo is too large (max 12MB)', 'err');
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(im.width, im.height)); // 1280px longest edge — plenty for the model
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * scale);
      c.height = Math.round(im.height * scale);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); // the blob URL dies here — we keep the data URL only
      setImg({ dataUrl: c.toDataURL('image/jpeg', 0.82), name: f.name || 'pasted-photo.jpg' });
      taRef.current?.focus();
    };
    im.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that photo', 'err'); };
    im.src = url;
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = ''; // reset first: re-picking the SAME file must still fire onChange
    readImage(f);
  }

  // Paste: chat apps let you drop a screenshot straight in (Ctrl/⌘+V). Text
  // pastes fall through to the textarea untouched.
  function onPaste(e) {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) {
      if (it.type && it.type.indexOf('image/') === 0) {
        const f = it.getAsFile();
        if (f) { e.preventDefault(); readImage(f); return; }
      }
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readImage(f);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied', 'ok'); }
    catch { toast('Could not copy — select the text instead', 'err'); }
  }

  async function send(text, base) {
    const clean = (text ?? input).trim();
    const photo = img; // capture BEFORE clearing state
    if ((!clean && !photo) || busy) return; // an empty message with no photo is nothing to send
    clearInterval(revealTimer.current); // a new question kills any in-progress typing
    if (clean.length > 2000) return toast('Keep it under 2000 characters', 'err');
    stick.current = true; // sending = re-pin to the bottom (you want to see the answer)
    const pickedKey = brain;
    const pickedId = idFor(pickedKey, models);
    const log = base ?? msgs; // base override lets regenerate() resend without duplicating bubbles
    const next = [...log, { from: 'you', text: clean, image: photo ? photo.dataUrl : null }];
    setMsgs(next); setInput(''); setImg(null); setBusy(true);
    // History travels as TEXT ONLY — an image in every past turn would blow up
    // the payload (and the model already answered those photos once).
    const history = log.slice(-12).map((m) => ({ from: m.from, text: m.text }));
    try {
      const { ok, status, data } = await api('/api/me/ask', {
        method: 'POST',
        body: JSON.stringify({ message: clean, history, model: pickedId, image: photo ? { dataUrl: photo.dataUrl } : undefined }),
      });
      if (ok && data.reply) {
        // Only one caption ever appears: when the server had to swap the brain
        // out. Otherwise the answer speaks for itself (no "answered by X" noise).
        let note = null;
        if (data.fallback) {
          const answered = models.find((m) => m.label === data.via);
          const viaKey = answered ? bucketOf(answered.badge) : null;
          note = viaKey && viaKey !== pickedKey
            ? `${labelFor(pickedKey)} was busy — ${labelFor(viaKey)} answered instead.`
            : 'Your pick was busy — a backup brain answered.';
        }
        const idx = next.length; // the AI block's index (next = base + your turn)
        setMsgs((m) => [...m, { from: 'ai', text: '', note, live: true }]);
        reveal(idx, data.reply, () => setBusy(false)); // write it out; busy clears when the last word lands
        return; // NOTE: early return — setBusy(false) below is skipped while revealing
      } else if (status === 402) {
        setUpsell(true);
      } else if (status === 429) {
        setMsgs((m) => [...m, { from: 'ai', text: data.error }]);
        toast('Daily limit reached', 'err');
        setUpsellLines([ // a quota wall is an upgrade moment — context lines beat the generic list
          '50 free chats a day — Pro never queues',
          'Unlimited free AIs + 50 premium chats daily',
          'Smart, Normal and Fast modes included',
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

  async function regenerate() { // short or off-target answer? re-ask the last question
    if (busy) return;
    const idx = msgs.map((m) => m.from).lastIndexOf('you');
    if (idx < 0) return;
    await send(msgs[idx].text, msgs.slice(0, idx)); // …resent with history BEFORE it (no duplicated bubbles)
  }

  function newChat() { // start clean — nothing is saved server-side anyway
    clearInterval(revealTimer.current);
    setMsgs([]); setInput(''); setImg(null); setBusy(false); stick.current = true;
  }

  const lastAi = msgs.length > 0 && msgs[msgs.length - 1].from === 'ai';
  const waiting = busy && !lastAi; // still nothing back from the brain → "Thinking…"

  return (
    <div
      className={'vai' + (drag ? ' dragging' : '')}
      onPaste={onPaste}
      onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={onDrop}
    >
      <header className="vai-top">
        <BrainPicker models={models} value={brain} onPick={pickBrain} onLocked={() => setUpsell(true)} />
        {/* The blurb only — never the engine's name. The whole point of the
            switch is that "Gemini Flash" is not a decision a shop owner wants. */}
        <span className="vai-top-hint">{BUCKETS.find((b) => b.key === brain)?.blurb}</span>
        {msgs.length > 0 && (
          <button className="vai-new" onClick={newChat}><Ic n="plus" s={15} /> <span className="vai-new-label">New chat</span></button>
        )}
      </header>

      {msgs.length === 0 ? (
        <div className="vai-view">
          <div className="vai-hero">
            <span className="vai-orb"><Logo alt="" size={34} /></span>
            <h1>Hello! I&rsquo;m VeloSales Ai</h1>
            <p>How can I help your business today? Ask about pricing, captions, customers — or send a photo.</p>
            <div className="vai-sug">
              <span className="vai-suglab">Suggested</span>
              <div className="vai-suglist">
                {chips.map((s) => {
                  const ic = chipIcon(s);
                  return (
                    <button key={s} className="vai-scard" onClick={() => send(s)}>
                      <span className={'vai-sic ' + TINT[ic]}><Ic n={ic} s={17} /></span>
                      <span className="vai-sct">{s}</span>
                      <span className="vai-scg"><Ic n="next" s={15} /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="vai-view" ref={threadRef} onScroll={onThreadScroll}>
          <div className="vai-col">
            {msgs.map((m, i) => (
              m.from === 'you' ? (
                <div key={i} className="vai-you">
                  <div className="vai-bubble">
                    {m.image && <img src={m.image} alt="Attached photo" />}
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="vai-ai">
                  <span className="vai-mini"><Logo alt="" size={30} /></span>
                  <div className={'vai-say' + (m.live ? ' live' : '')}>
                    <Rich text={m.text} seed={'m' + i} />
                    {m.note && <div className="vai-via">{m.note}</div>}
                    {!m.live && m.text && (
                      <div className="vai-acts">
                        <button className="vai-act" onClick={() => copy(m.text)}><Ic n="copy" s={14} /> Copy</button>
                        {i === msgs.length - 1 && !busy && (
                          <button className="vai-act" onClick={regenerate}><Ic n="refresh" s={14} /> Regenerate</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            ))}
            {waiting && (
              <div className="vai-think">
                <span className="vai-think-orb"><Logo alt="" size={17} /></span>
                <span className="vai-think-txt">Thinking&hellip;</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="vai-bar">
        <div className="vai-bar-in">
          {drag && <div className="vai-drop"><Ic n="camera" s={20} /> Drop the photo to attach it</div>}
          {img && ( // the photo waiting to go — remove it before sending if you change your mind
            <div className="vai-attachment">
              <img src={img.dataUrl} alt="Attachment preview" />
              <b>{img.name}</b>
              <button onClick={() => setImg(null)} aria-label="Remove photo"><Ic n="x" s={15} /></button>
            </div>
          )}
          <div className="vai-input">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            <button className="vai-attach" onClick={() => fileRef.current?.click()} aria-label="Attach a photo" title="Attach, paste or drop a photo"><Ic n="camera" s={18} /></button>
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={first ? `Ask anything, ${first}\u2026` : 'Ask anything\u2026'}
              maxLength={2000}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} // Enter sends, Shift+Enter breaks the line
            />
            <button className="vai-send" disabled={!canSend} onClick={() => send()} aria-label="Send">
              <Ic n="send" s={17} />
            </button>
          </div>
          <p className="vai-note">VeloSales Ai can make mistakes — double-check important facts. Chats aren&rsquo;t saved.</p>
        </div>
      </div>

      <GlassUpsell show={upsell} lines={upsellLines} onClose={() => { setUpsell(false); setUpsellLines(null); }} />
    </div>
  );
}
