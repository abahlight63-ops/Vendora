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
import Loader, { BrandGate, useMinDisplay } from '../components/Loader.jsx'; // scatter gate (checking) + mini orbit (save button!) + brand beat
import { useNavigate } from 'react-router-dom'; // nav() after save (dashboard or back)
import { api, pop } from '../lib/api.js'; // api() calls; pop() for save outcomes
import { NICHES, HEARD_FROM } from '../lib/niches.js'; // picker data (shared with VeloSalesAI chips!)
import Ic from '../components/icons.jsx';
import { avatarsFor } from '../lib/avatars.js';
import { CHANNEL_COINS } from '../lib/channelLogos.js'; // check icons

const OTHER = 'Other / Custom Business'; // the free-text niche (reveals the input below the grid!)

// Q2–Q4 option decks: value (stored) + title + sub (the ENCOURAGEMENT — each
// pick tells them what the app will do with it, so answers feel powerful!).
const SIZES = [ // Q2: how many products? (drives the Home checklist wording)
  { v: 'starting', t: 'Just starting', sub: 'We will help you add your first 5 products.', cheer: '' },
  { v: 'under-20', t: 'Under 20', sub: 'Quick to add by hand, or teach Velo from WhatsApp.', cheer: '' },
  { v: '20-100', t: '20 to 100', sub: 'Import your WhatsApp catalog to save time.', cheer: '' },
  { v: '100-plus', t: '100 or more', sub: 'Catalog import brings them all in at once.', cheer: '' },
];
const CHANNELS = [ // Q3: where do customers message? (multi-pick — drives Connect highlights!)
  { v: 'whatsapp', t: 'WhatsApp', sub: 'The main stage — connect it first.' },
  { v: 'telegram', t: 'Telegram', sub: 'Nice — we will highlight the Telegram card.' },
  { v: 'instagram', t: 'Instagram', sub: '' },
  { v: 'messenger', t: 'Facebook Messenger', sub: '' },
  { v: 'walkin', t: 'Walk-in or market', sub: '' },
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
  const [heard, setHeard] = useState('');
  const [plan, setPlan] = useState('free'); // the plan picked on step 5 (free first) // Q5 pick ('' = skipped)
  const [busy, setBusy] = useState(false); // save lock (double-tap protection!)
  const [checking, setChecking] = useState(true); // true until /api/me answers (no flashing!)
  const minDone = useMinDisplay(1000); // brand beat (fast checks still show the scatter a full second!)

  useEffect(() => { // mount: already set up? → dashboard (returning users never see this!)
    api('/api/me').then(({ ok, data }) => {
      if (ok && data?.business?.business_niche) nav('/dashboard', { replace: true }); // replace = welcome can't "back" into the app
      else setChecking(false); // not set → show the quiz
    }).catch(() => setChecking(false)); // network down → show anyway (save will surface the error!)
  }, [nav]); // nav stable (react-router memoizes it)

  const finalNiche = niche === OTHER ? custom.trim() : niche; // OTHER resolves to the typed text (grid label never saved!)

  function toggleChannel(v) { // multi-pick toggle (max 4 — backend slices anyway, UI stays honest!)
    setChannels((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v].slice(0, 5))); // includes? remove : add (slice guards the cap!)
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

  if (checking || !minDone) return <div className="page"><div className="card"><BrandGate /></div></div>; // session check + brand beat (no flashing!)

  // ── the new flow: 0 sell · 1 size · 2 channels + chats · 3 heard · 4 plan · 5 all set ──
  const TOTAL = 6;
  const NICHE_EMOJI = (n) => (avatarsFor(n)[0] || '✨');
  const tops = NICHES.filter((n) => n !== OTHER);
  async function saveThenPlan() {
    if (!finalNiche) { setStep(0); return pop('err', 'Pick one first', 'Tell us what you sell so Velo speaks your business.'); }
    setBusy(true);
    const { ok, data } = await api('/api/me/setup', { method: 'POST', body: JSON.stringify({ business_niche: finalNiche, catalog_size: size, channels, daily_volume: volume, heard_from: heard || '' }) });
    setBusy(false);
    if (ok) setStep(4);
    else pop('err', 'Could not save', (data && data.error) || 'Check your connection and try again.');
  }
  const go2 = () => {
    if (step === 0 && !finalNiche) return pop('err', 'Pick one first', 'Tell us what you sell so Velo speaks your business.');
    if (step === 3) return saveThenPlan();
    if (step === 4) { if (plan === 'free') return setStep(5); return nav('/billing?pick=' + plan + '_monthly', { replace: true }); }
    if (step === 5) return nav('/catalog', { replace: true });
    return setStep(step + 1);
  };
  const label = step === 3 ? (busy ? 'Saving' : 'Continue') : step === 4 ? (plan === 'free' ? 'Start with Free' : `Continue to pay`) : step === 5 ? 'Add my first product' : 'Continue';
  const eyebrow = ['About your shop', 'About your shop', 'Your customers', 'Almost done', 'Your plan', ''][step];
  const first = '';
  return (
    <div className="ob2">
      <div className="ob2-in">
        {step < 5 && (
          <div className="ob2-top">
            <button type="button" className="ob2-back" disabled={step === 0 || busy} onClick={back} aria-label="Back"><Ic n="back" s={20} /></button>
            <div className="ob2-prog" aria-hidden="true">{Array.from({ length: TOTAL }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
            <span className="ob2-count">{step + 1} of {TOTAL}</span>
          </div>
        )}
        <div key={step} className="ob2-step">
          {eyebrow && <div className="ob2-eye">{eyebrow}</div>}
          {step === 0 && (<>
            <h1>What do you sell?</h1>
            <p className="ob2-lede">Velo learns the words your customers use.</p>
            <div className="ob2-tiles">
              {tops.map((n) => (
                <button key={n} type="button" className={'ob2-tile' + (niche === n ? ' on' : '')} aria-pressed={niche === n} onClick={() => setNiche(n)}>
                  <span className="ob2-em" aria-hidden="true">{NICHE_EMOJI(n)}</span>{n.split(/,| & | or /)[0]}
                </button>
              ))}
              <button type="button" className={'ob2-tile' + (niche === OTHER ? ' on' : '')} aria-pressed={niche === OTHER} onClick={() => setNiche(OTHER)}><span className="ob2-em" aria-hidden="true">✨</span>Something else</button>
            </div>
            {niche === OTHER && <input className="ob2-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Tell us what you sell" autoFocus />}
          </>)}
          {step === 1 && (<>
            <h1>How many products do you sell?</h1>
            <p className="ob2-lede">No wrong answer. It shapes your starting checklist.</p>
            <div className="ob2-list">{SIZES.map((o) => (
              <button key={o.v} type="button" className={'ob2-choice' + (size === o.v ? ' on' : '')} aria-pressed={size === o.v} onClick={() => setSize(o.v)}>
                <span className="ob2-choice-main"><b>{o.t}</b><small>{o.sub}</small></span><span className="ob2-radio" aria-hidden="true" />
              </button>))}</div>
          </>)}
          {step === 2 && (<>
            <h1>Where do customers message you?</h1>
            <p className="ob2-lede">Pick all that apply. You connect them later.</p>
            <div className="ob2-list">{CHANNELS.map((o) => (
              <button key={o.v} type="button" className={'ob2-choice' + (channels.includes(o.v) ? ' on' : '')} aria-pressed={channels.includes(o.v)} onClick={() => toggleChannel(o.v)}>
                {CHANNEL_COINS[o.v] ? <svg width="44" height="44" viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHANNEL_COINS[o.v].replace(/(msg-g|ig-g)/g, '$1-ob' + o.v) }} /> : <span className="ob2-em sm" aria-hidden="true">🏪</span>}
                <span className="ob2-choice-main"><b>{o.t}</b></span><span className="ob2-check" aria-hidden="true">{channels.includes(o.v) ? <Ic n="check" s={15} /> : null}</span>
              </button>))}</div>
            <div className="ob2-eye" style={{ marginTop: 6 }}>About how many chats a day?</div>
            <div className="wx-pills ob2-vol" role="group" aria-label="Chats a day">{VOLUMES.map((o) => <button key={o.v} type="button" className={'wx-pill' + (volume === o.v ? ' on' : '')} aria-pressed={volume === o.v} onClick={() => setVolume(o.v)}>{o.t}</button>)}</div>
          </>)}
          {step === 3 && (<>
            <h1>How did you hear about us?</h1>
            <p className="ob2-lede">Optional. It helps us reach sellers like you.</p>
            <div className="ob2-pills">{HEARD_FROM.map((h) => <button key={h} type="button" className={'wx-pill' + (heard === h ? ' on' : '')} aria-pressed={heard === h} onClick={() => setHeard(heard === h ? '' : h)}>{h}</button>)}</div>
          </>)}
          {step === 4 && (<>
            <h1>Start free, or get more replies</h1>
            <div className="ob2-plans">
              {[['free', 'Free', '₦0', '', '50 replies a day · WhatsApp and Telegram · Free forever', 'Recommended to start'], ['pro', 'Plus', '₦7,499', ' / month', '500 replies a day · Product photos · Catalog import', ''], ['plus', 'Pro', '₦14,999', ' / month', '1,500 replies a day · Voice notes · Smartest AI', 'Best value']].map(([k, n, p, per, d, tag]) => (
                <button key={k} type="button" className={'ob2-plan' + (plan === k ? ' on' : '') + (k === 'plus' ? ' best' : '')} aria-pressed={plan === k} onClick={() => setPlan(k)}>
                  <span className="ob2-plan-top"><b>{n}</b>{tag && <span className={'ob2-tag' + (k === 'free' ? ' good' : '')}>{tag}</span>}<span className="ob2-radio" aria-hidden="true" /></span>
                  <span className="ob2-price">{p}<small>{per}</small></span>
                  <small>{d}</small>
                </button>))}
            </div>
            <p className="ob2-note"><Ic n="spark" s={18} /><span>Every new shop gets <b>7 days of Pro free</b>. No card needed.</span></p>
          </>)}
          {step === 5 && (<div className="ob2-done">
            <div className="ob2-badge"><Logo size={60} alt="" /><span><Ic n="check" s={20} /></span></div>
            <h1>You're all set{first}!</h1>
            <p className="ob2-lede">Three quick steps and Velo starts selling for you.</p>
            <div className="ob2-list">{[['/catalog', 'tag', 'Add your first product', '2 minutes'], ['/connect', 'plug', 'Connect WhatsApp', '2 minutes'], ['/playground', 'spark', 'Try it in Test Drive', '1 minute']].map(([to, ic, t, d], i) => (
              <button key={to} type="button" className="ob2-choice" onClick={() => nav(to, { replace: true })}>
                <span className={'ob2-num' + (i ? '' : ' hot')}><Ic n={ic} s={18} /></span><span className="ob2-choice-main"><b>{t}</b><small>{d}</small></span><Ic n="next" s={18} />
              </button>))}</div>
          </div>)}
        </div>
        <div className="ob2-foot">
          <button type="button" className="btn lg ob2-go" disabled={busy} onClick={go2}>{busy ? (<><Loader size={17} />{label}</>) : label}</button>
          {step === 3 && <button type="button" className="ob2-skip" disabled={busy} onClick={() => { setHeard(''); saveThenPlan(); }}>Skip</button>}
          {step === 5 && <button type="button" className="ob2-skip" onClick={() => nav('/dashboard', { replace: true })}>Go to Home</button>}
        </div>
      </div>
    </div>
  );
}
