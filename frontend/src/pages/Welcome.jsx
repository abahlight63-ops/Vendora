// ── frontend/src/pages/Welcome.jsx ─────────────────────────────────
// WHAT: post-tour setup — a 5-question animated quiz (niche → catalog size →
// channels → chat volume → heard-from). ONE save at the end via
// POST /api/me/setup, then → dashboard. Niche set already? → straight to
// dashboard (never nag twice!). Only Q1 is required — the rest are skippable
// (empty = skipped, backend stores NULL).
// WHY IT MATTERS: answers DRIVE the app — niche reshapes catalog shelves +
// VeloSales Ai suggestions, size shapes the dashboard checklist, channels
// highlight Connect, volume guides the plan hint on Billing.
// React patterns: step state, per-step drafts, progress bar, key-remount
// step transitions (fresh entrance animation every step!), encouraging cheer
// lines that react to the pick.
import { useEffect, useState } from 'react'; // useState = step + 5 drafts + busy; useEffect = skip-if-done
import Logo from '../components/Logo.jsx'; // theme-aware brand mark (blue dark / green light!)
import { useNavigate } from 'react-router-dom'; // nav() after save (dashboard or back)
import { api, pop } from '../lib/api.js'; // api() calls; pop() for save outcomes
import { NICHES, HEARD_FROM } from '../lib/niches.js'; // picker data (shared with VeloSalesAI chips!)
import Ic from '../components/icons.jsx'; // check icons

const OTHER = 'Other / Custom Business'; // the free-text niche (reveals the input below the grid!)

// Q2–Q4 option decks: value (stored) + title + sub (the ENCOURAGEMENT — each
// pick tells them what the app will do with it, so answers feel powerful!).
const SIZES = [ // Q2: how many products? (drives dashboard checklist wording!)
  { v: 'starting', t: 'Just starting', sub: 'Zero products yet? Perfect — we will walk you from 0 to 5.', cheer: 'Fresh shelf energy — your first 5 products take 10 minutes.' },
  { v: 'under-20', t: 'Under 20', sub: 'Small and mighty — manual catalog fits you like a glove.', cheer: 'Small catalog, big control — every item gets its moment.' },
  { v: '20-100', t: '20 – 100', sub: 'Growing fast — we will show you bulk tricks like Pro SYNC.', cheer: 'Growth mode — bulk tools will save you hours weekly.' },
  { v: '100-plus', t: '100+', sub: 'Serious shelves — Pro SYNC + verification were built for you.', cheer: 'Big shelves need big tools — we have got them ready.' },
];
const CHANNELS = [ // Q3: where do customers message? (multi-pick — drives Connect highlights!)
  { v: 'whatsapp', t: 'WhatsApp', sub: 'The main stage — connect it first.' },
  { v: 'telegram', t: 'Telegram', sub: 'Nice — we will highlight the Telegram card.' },
  { v: 'instagram', t: 'Instagram DMs', sub: 'Post there, sell on WhatsApp — we will show you how.' },
  { v: 'walkin', t: 'Walk-in / market', sub: 'Physical hustle — the bot handles the overflow.' },
];
const VOLUMES = [ // Q4: chats per day? (drives the honest plan hint on Billing!)
  { v: 'few', t: 'Just a few', sub: 'Quiet and cozy — Free plan covers you for ages.', cheer: 'Cozy pace — Free will carry you far.' },
  { v: '10-50', t: '10 – 50', sub: 'Healthy flow — right in Free\'s sweet spot, Pro waiting.', cheer: 'Healthy flow — you are exactly who VeloSales Ai was built for.' },
  { v: '50-plus', t: '50+', sub: 'Big energy — we will point you at the plan that keeps up.', cheer: 'Big energy — your shop is about to feel unstoppable.' },
];

export default function Welcome() {
  const nav = useNavigate();
  const [step, setStep] = useState(0); // 0 niche · 1 size · 2 channels · 3 volume · 4 heard-from
  const [niche, setNiche] = useState(''); // Q1 pick ('' = none yet)
  const [custom, setCustom] = useState(''); // free-text niche when OTHER picked
  const [size, setSize] = useState(''); // Q2 value ('' = skipped)
  const [channels, setChannels] = useState([]); // Q3 values (multi-pick array!)
  const [volume, setVolume] = useState(''); // Q4 value ('' = skipped)
  const [heard, setHeard] = useState(''); // Q5 pick ('' = skipped)
  const [busy, setBusy] = useState(false); // save lock (double-tap protection!)
  const [checking, setChecking] = useState(true); // true until /api/me answers (no flashing!)

  useEffect(() => { // mount: already set up? → dashboard (returning users never see this!)
    api('/api/me').then(({ ok, data }) => {
      if (ok && data?.business?.business_niche) nav('/dashboard', { replace: true }); // replace = welcome can't "back" into the app
      else setChecking(false); // not set → show the quiz
    }).catch(() => setChecking(false)); // network down → show anyway (save will surface the error!)
  }, [nav]); // nav stable (react-router memoizes it)

  const finalNiche = niche === OTHER ? custom.trim() : niche; // OTHER resolves to the typed text (grid label never saved!)

  function toggleChannel(v) { // multi-pick toggle (max 4 — backend slices anyway, UI stays honest!)
    setChannels((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v].slice(0, 4))); // includes? remove : add (slice guards the cap!)
  }

  async function save() { // FINAL save: one write for all five answers (step 4 → dashboard!)
    if (!finalNiche) { setStep(0); return pop('err', 'Pick one first', 'Tell us what you sell so VeloSales Ai speaks your hustle.'); } // safety net (Q1 is the ONE required answer!)
    setBusy(true); // lock (slow networks + double-taps!)
    const { ok, data } = await api('/api/me/setup', {
      method: 'POST',
      body: JSON.stringify({ business_niche: finalNiche, catalog_size: size, channels, daily_volume: volume, heard_from: heard || '' }),
    });
    setBusy(false); // unlock either way (failure must not brick the page!)
    if (ok) nav('/dashboard', { replace: true }); // saved → dashboard (answers now drive checklist + hints!)
    else pop('err', 'Could not save', data.error || 'Check your connection and try again.');
  }

  function next() { // advance (Q1 gates — the rest skip freely!)
    if (step === 0 && !finalNiche) return pop('err', 'Pick one first', 'Tell us what you sell so VeloSales Ai speaks your hustle.');
    if (step >= 4) return save(); // last step → SAVE (single write!)
    setStep(step + 1); // forward (key={step} below replays the entrance animation!)
  }
  function back() { if (step > 0) setStep(step - 1); } // back keeps every draft (state lives outside the step!)

  if (checking) return <div className="page"><div className="card"><p className="hint">Loading…</p></div></div>; // session check (same placeholder habit as App guards!)

  const sizeCheer = SIZES.find((o) => o.v === size)?.cheer; // encouragement for the CURRENT pick (?. guards skipped!)
  const volCheer = VOLUMES.find((o) => o.v === volume)?.cheer;

  return (
    <div className="welcome neu-bg">
      <div className="welcome-inner">
        <div className="welcome-top">
          <span className="landing-brand"><Logo alt="VeloSales Ai" />VELOSALES AI</span>
          <span className="hint">Step {step + 1} of 5</span> {/* progress counter (Onboarding-style!) */}
        </div>
        <div className="quiz-prog"><i style={{ width: `${((step + 1) / 5) * 100}%` }} /></div> {/* progress fill (inline width = dynamic, CSS can't compute!) */}

        <div key={step} className="quiz-step"> {/* key={step} = remount per step → entrance animation replays EVERY time! */}
          {step === 0 && ( // Q1 — the niche grid (drives catalog shelves + AI suggestions!)
            <>
              <h1>What will you use VeloSales Ai for?</h1>
              <p className="lede">Pick your hustle — VeloSales Ai learns your lane, so suggestions and answers fit YOUR business (no more blue-gown examples for freelancers!).</p>
              <div className="niche-grid"> {/* CSS grid → 2 cols desktop, 1 col phones */}
                {NICHES.map((n, i) => (
                  <button key={n} type="button" className={'niche quiz-pop' + (niche === n ? ' sel' : '')} style={{ animationDelay: `${Math.min(i * 35, 400)}ms` }} onClick={() => setNiche(n)}>
                    {niche === n && <Ic n="checkCircle" s={15} />} {/* selected tick (visual proof!) */}
                    <span>{n}</span>
                  </button>
                ))}
              </div>
              {niche === OTHER && ( // free-text lane (only when Other picked — keeps the grid clean!)
                <div style={{ marginTop: 12 }}>
                  <label>Describe your business</label>
                  <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Car wash in Lekki" maxLength={80} />
                </div>
              )}
              {finalNiche ? <p className="quiz-cheer quiz-pop"><Ic n="checkCircle" s={15} /> Perfect — from here on, everything speaks {finalNiche}.</p> : null} {/* live encouragement (niche name mirrors back — they feel HEARD!) */}
            </>
          )}

          {step === 1 && ( // Q2 — catalog size (drives dashboard checklist wording!)
            <>
              <h1>How many products do you sell?</h1>
              <p className="lede">No wrong answer — this shapes your starting checklist (tiny shelf? 5 products and go. Huge? We will show bulk tricks).</p>
              <div className="qa-list">
                {SIZES.map((o, i) => (
                  <button key={o.v} type="button" className={'qa quiz-pop' + (size === o.v ? ' sel' : '')} style={{ animationDelay: `${i * 60}ms` }} onClick={() => setSize(size === o.v ? '' : o.v)}> {/* tap again = unpick (skippable!) */}
                    <Ic n={size === o.v ? 'checkCircle' : 'next'} s={16} />
                    <div><b>{o.t}</b><span className="hint">{o.sub}</span></div>
                  </button>
                ))}
              </div>
              {sizeCheer ? <p className="quiz-cheer quiz-pop"><Ic n="checkCircle" s={15} /> {sizeCheer}</p> : null}
            </>
          )}

          {step === 2 && ( // Q3 — channels, multi-pick (drives Connect highlights!)
            <>
              <h1>Where do customers reach you?</h1>
              <p className="lede">Pick all that apply — we will highlight the right connections for you. Skip if it's just walk-ins for now.</p>
              <div className="qa-list">
                {CHANNELS.map((o, i) => (
                  <button key={o.v} type="button" className={'qa quiz-pop' + (channels.includes(o.v) ? ' sel' : '')} style={{ animationDelay: `${i * 60}ms` }} onClick={() => toggleChannel(o.v)}>
                    <Ic n={channels.includes(o.v) ? 'checkCircle' : 'next'} s={16} />
                    <div><b>{o.t}</b><span className="hint">{o.sub}</span></div>
                  </button>
                ))}
              </div>
              {channels.length > 0 ? <p className="quiz-cheer quiz-pop"><Ic n="checkCircle" s={15} /> {channels.length === 1 ? 'One channel — we will make it shine.' : `${channels.length} channels — VeloSales Ai covers every one.`}</p> : null}
            </>
          )}

          {step === 3 && ( // Q4 — chat volume (drives the honest plan hint!)
            <>
              <h1>How many customer chats a day?</h1>
              <p className="lede">Rough guess is fine — this keeps plan advice honest (quiet shop? Free carries you. Flood? We will say so).</p>
              <div className="qa-list">
                {VOLUMES.map((o, i) => (
                  <button key={o.v} type="button" className={'qa quiz-pop' + (volume === o.v ? ' sel' : '')} style={{ animationDelay: `${i * 60}ms` }} onClick={() => setVolume(volume === o.v ? '' : o.v)}> {/* tap again = unpick (skippable!) */}
                    <Ic n={volume === o.v ? 'checkCircle' : 'next'} s={16} />
                    <div><b>{o.t}</b><span className="hint">{o.sub}</span></div>
                  </button>
                ))}
              </div>
              {volCheer ? <p className="quiz-cheer quiz-pop"><Ic n="checkCircle" s={15} /> {volCheer}</p> : null}
            </>
          )}

          {step === 4 && ( // Q5 — heard-from (marketing attribution, skippable!)
            <>
              <h1>Where did you hear about us?</h1>
              <p className="lede">Helps us show up where sellers like you hang out. Optional — skip freely.</p>
              <div className="qa-list">
                {HEARD_FROM.map((h, i) => (
                  <button key={h} type="button" className={'qa quiz-pop' + (heard === h ? ' sel' : '')} style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }} onClick={() => setHeard(heard === h ? '' : h)}> {/* tap again = unpick (toggle!) */}
                    <Ic n={heard === h ? 'checkCircle' : 'next'} s={16} />
                    <div><b>{h}</b></div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="foot-nav welcome-nav">
          {step === 0
            ? <span className="hint">You can change this later in Profile.</span>
            : <button className="btn ghost" disabled={busy} onClick={back}>Back</button>}
          {step === 4
            ? <button className="btn" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Start selling'} <Ic n="next" s={15} /></button>
            : <button className="btn" disabled={busy} onClick={next}>Continue <Ic n="next" s={15} /></button>}
        </div>
      </div>
    </div>
  );
}
