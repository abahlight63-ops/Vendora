// ── frontend/src/pages/Welcome.jsx ─────────────────────────────────
// WHAT: post-tour setup — step 1: "What will you use Vendora for?" (niche
// grid), step 2: "Where did you hear about us?" (heard-from list).
// Saves via POST /api/me/setup, then → dashboard. Niche set already?
// → straight to dashboard (never nag twice!). Heard-from is skippable.
import { useEffect, useState } from 'react'; // useState = step/niche/custom/heard/busy; useEffect = skip-if-done
import { useNavigate } from 'react-router-dom'; // nav() after save (dashboard or back)
import { api, pop } from '../lib/api.js'; // api() calls; pop() for save outcomes
import { NICHES, HEARD_FROM } from '../lib/niches.js'; // picker data (shared with VendoraAI chips!)
import Ic from '../components/icons.jsx'; // check icons

const OTHER = 'Other / Custom Business'; // the free-text niche (reveals the input below the grid!)

export default function Welcome() {
  const nav = useNavigate();
  const [step, setStep] = useState(0); // 0 = niche, 1 = heard-from
  const [niche, setNiche] = useState(''); // selected niche label ('' = none yet)
  const [custom, setCustom] = useState(''); // free-text niche when OTHER picked
  const [heard, setHeard] = useState(''); // heard-from pick ('' = skipped)
  const [busy, setBusy] = useState(false); // save lock (double-tap protection!)
  const [checking, setChecking] = useState(true); // true until /api/me answers (no flashing!)

  useEffect(() => { // mount: already set up? → dashboard (returning users never see this!)
    api('/api/me').then(({ ok, data }) => {
      if (ok && data?.business?.business_niche) nav('/dashboard', { replace: true }); // replace = welcome can't "back" into the app
      else setChecking(false); // not set → show the picker
    }).catch(() => setChecking(false)); // network down → show anyway (save will surface the error!)
  }, [nav]); // nav stable (react-router memoizes it)

  const finalNiche = niche === OTHER ? custom.trim() : niche; // OTHER resolves to the typed text (grid label never saved!)

  async function save(goHeard) { // goHeard true = step 0 → step 1; false = finish (step 1 → dashboard)
    if (step === 0) { // niche step: require a REAL pick…
      if (!finalNiche) return pop('err', 'Pick one first', 'Tell us what you sell so Vendora speaks your hustle.'); // …empty (incl. blank custom) → coach, don't advance
      if (goHeard) return setStep(1); // valid → heard-from page (save happens THERE — one write for both answers!)
    }
    setBusy(true); // lock (slow networks + double-taps!)
    const { ok, data } = await api('/api/me/setup', { // ONE write: niche (+ heard-from when step 1)
      method: 'POST',
      body: JSON.stringify({ business_niche: step === 0 ? finalNiche : (finalNiche || 'Other / Custom Business'), heard_from: heard || '' }),
    });
    setBusy(false); // unlock either way (failure must not brick the page!)
    if (ok) nav('/dashboard', { replace: true }); // saved → dashboard (niche now drives AI suggestions!)
    else pop('err', 'Could not save', data.error || 'Check your connection and try again.');
  }

  if (checking) return <div className="page"><div className="card"><p className="hint">Loading…</p></div></div>; // session check (same placeholder habit as App guards!)

  return (
    <div className="welcome neu-bg">
      <div className="welcome-inner">
        <div className="welcome-top">
          <span className="landing-brand"><img src="/logo.png" alt="Vendora" />VENDORA</span>
          <span className="hint">Step {step + 1} of 2</span> {/* progress counter (Onboarding-style!) */}
        </div>

        {step === 0 ? ( // STEP 1 — the niche grid (the important one: drives AI suggestions!)
          <>
            <h1>What will you use Vendora for?</h1>
            <p className="lede">Pick your hustle — Vendora learns your lane, so suggestions and answers fit YOUR business (no more blue-gown examples for freelancers!).</p>
            <div className="niche-grid"> {/* CSS grid → 2 cols desktop, 1 col phones */}
              {NICHES.map((n) => (
                <button key={n} type="button" className={'niche' + (niche === n ? ' sel' : '')} onClick={() => setNiche(n)}>
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
            <div className="foot-nav welcome-nav">
              <span className="hint">You can change this later in Profile.</span>
              <button className="btn" disabled={busy} onClick={() => save(true)}>Continue <Ic n="next" s={15} /></button>
            </div>
          </>
        ) : ( // STEP 2 — heard-from (skippable: every path saves!)
          <>
            <h1>Where did you hear about us?</h1>
            <p className="lede">Helps us show up where sellers like you hang out. Optional — skip freely.</p>
            <div className="qa-list">
              {HEARD_FROM.map((h) => (
                <button key={h} type="button" className={'qa' + (heard === h ? ' sel' : '')} onClick={() => setHeard(heard === h ? '' : h)}> {/* tap again = unpick (toggle!) */}
                  <Ic n={heard === h ? 'checkCircle' : 'next'} s={16} />
                  <div><b>{h}</b></div>
                </button>
              ))}
            </div>
            <div className="foot-nav welcome-nav">
              <button className="btn ghost" disabled={busy} onClick={() => save(false)}>Skip</button> {/* skip STILL saves the niche (save(false) writes niche + '' heard!) */}
              <button className="btn" disabled={busy} onClick={() => save(false)}>{busy ? 'Saving…' : 'Start selling'} <Ic n="next" s={15} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
