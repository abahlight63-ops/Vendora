// ── frontend/src/pages/Connect.jsx ─────────────────────────────────
// WHAT: the channel switchboard — connect the shop's WhatsApp (Meta Cloud API
// first, own-Twilio second) + Telegram, pick the WhatsApp brain, TEST-verify
// to LIVE. One action per screen: road picker → credentials → webhook → TEST.
// Nothing here needs a deploy or a console maze beyond pasting 2 values.
// DATA: GET /api/me/channels (status) + GET /api/me/ai-models (brain picker).
import { useEffect, useState } from 'react'; // state per step; effect loads status once
import { api, pop, toast } from '../lib/api.js'; // api() calls; pop() big outcomes; toast() small notes
import Ic from '../components/icons.jsx'; // drawn glyphs (never emoji!)
import GlassUpsell from '../components/GlassUpsell.jsx'; // locked-model upgrade card

function CopyBtn({ text, label }) { // one-tap copy (navigator.clipboard + fallback!)
  async function copy() {
    try { await navigator.clipboard.writeText(text); toast('Copied.'); }
    catch { // clipboard API blocked (old browsers, no HTTPS) → select-and-tell fallback
      toast('Copy this: ' + text, 'err');
    }
  }
  return <button type="button" className="btn ghost sm" onClick={copy}><Ic n="copy" s={14} /> {label || 'Copy'}</button>;
}

function Steps({ n, of }) { // progress dots ("Step 2 of 4" — nobody gets lost!)
  return <p className="hint" style={{ margin: '0 0 10px' }}>Step {n} of {of}</p>;
}

export default function Connect() {
  const [st, setSt] = useState(null); // channels status (null = loading → skeleton!)
  const [models, setModels] = useState([]); // brain picker options (locked flags by tier!)
  const [road, setRoad] = useState(null); // null = road picker; 'meta' | 'twilio' | 'telegram'
  const [step, setStep] = useState(1); // step inside the road (1-based!)
  const [busy, setBusy] = useState(false); // action lock (double-tap protection!)
  // Meta drafts
  const [phoneId, setPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaProof, setMetaProof] = useState(null); // {phone, verifyToken} after connect
  // Twilio drafts
  const [sid, setSid] = useState('');
  const [twToken, setTwToken] = useState('');
  const [numbers, setNumbers] = useState(null); // [{sid, phone}] picker after validate
  const [picked, setPicked] = useState('');
  // Telegram drafts
  const [tgToken, setTgToken] = useState('');
  const [tgLink, setTgLink] = useState(null);
  // Brain + upsell
  const [brain, setBrain] = useState('');
  const [upsell, setUpsell] = useState(false);
  // TEST-verify
  const [testing, setTesting] = useState(false);

  async function load() { // refresh status (after every connect/disconnect!)
    const { data } = await api('/api/me/channels');
    if (data) {
      setSt(data);
      if (data.whatsapp && !brain) setBrain(data.whatsapp.model || 'gemini-flash-full'); // adopt server truth once (user edits after!)
    }
  }
  useEffect(() => { // mount: status + models in parallel (no await between = both fly!)
    load();
    api('/api/me/ai-models').then(({ ok, data }) => { if (ok && Array.isArray(data.models)) setModels(data.models); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function back() { // Back button: step back, or road picker at step 1
    if (step > 1) setStep(step - 1);
    else { setRoad(null); setStep(1); }
  }
  function openRoad(r) { setRoad(r); setStep(1); setNumbers(null); setMetaProof(null); setTgLink(null); } // fresh drafts per road!

  // ---- Meta actions ----
  async function metaConnect() {
    if (!phoneId.trim() || !metaToken.trim()) return toast('Paste both values first', 'err');
    setBusy(true);
    const { ok, data } = await api('/api/me/channels/meta', { method: 'POST', body: JSON.stringify({ phone_number_id: phoneId.trim(), token: metaToken.trim() }) });
    setBusy(false);
    if (ok) { setMetaProof(data); setMetaToken(''); setStep(2); load(); } // token cleared from the form (stored server-side only!)
    else pop('err', 'Meta said no', data.error || 'Check the values and try again.');
  }
  // ---- Twilio actions ----
  async function twilioList() {
    if (!sid.trim() || !twToken.trim()) return toast('Paste both values first', 'err');
    setBusy(true);
    const { ok, data } = await api('/api/me/channels/twilio', { method: 'POST', body: JSON.stringify({ sid: sid.trim(), token: twToken.trim() }) });
    setBusy(false);
    if (ok && data.numbers && data.numbers.length) { setNumbers(data.numbers); setPicked(data.numbers[0].sid); setStep(2); }
    else if (ok) pop('err', 'No numbers found', 'Your Twilio account has no phone numbers yet — buy one in the Twilio console first.');
    else pop('err', 'Twilio said no', data.error || 'Check the values and try again.');
  }
  async function twilioAdopt() {
    if (!picked) return toast('Pick one of your numbers', 'err');
    setBusy(true);
    const { ok, data } = await api('/api/me/channels/twilio/select', { method: 'POST', body: JSON.stringify({ sid: sid.trim(), token: twToken.trim(), numberSid: picked }) });
    setBusy(false);
    if (ok) { setTwToken(''); pop('ok', 'Number connected!', `We pointed ${data.phone} at your bot. Now send the TEST below.`); setStep(3); load(); }
    else pop('err', 'Could not connect', data.error || 'Try again.');
  }
  // ---- Telegram actions ----
  async function tgConnect() {
    if (!tgToken.trim()) return toast('Paste your BotFather token first', 'err');
    setBusy(true);
    const { ok, data } = await api('/api/me/telegram/token', { method: 'POST', body: JSON.stringify({ token: tgToken.trim() }) });
    setBusy(false);
    if (ok && data.connected) { setTgToken(''); setStep(2); load(); pop('ok', 'Telegram connected!', 'Send your bot any message to test it.'); }
    else pop('err', 'Token rejected', data.error || 'Check the token from BotFather.');
  }
  async function tgLinkGen() {
    setBusy(true);
    const { ok, data } = await api('/api/me/telegram/link', { method: 'POST', body: '{}' });
    setBusy(false);
    if (ok) setTgLink(data);
    else toast(data.error || 'Could not generate link', 'err');
  }
  // ---- Brain pick ----
  async function saveBrain(id) {
    const m = models.find((x) => x.id === id);
    if (m && m.locked) { setUpsell(true); return; } // locked → upgrade card (never a dead dropdown!)
    setBrain(id);
    const { ok, data } = await api('/api/me/whatsapp-model', { method: 'PUT', body: JSON.stringify({ model: id }) });
    if (ok) toast('WhatsApp brain: ' + (data.label || id), 'ok');
    else if (data && data.error) { setUpsell(true); load(); } // 402 → card + reload truth (downgraded picks revert!)
  }
  // ---- TEST-verify: poll until an inbound lands, then celebrate ----
  useEffect(() => { // runs only while testing (interval polls status!)
    if (!testing) return;
    const t = setInterval(async () => {
      const { data } = await api('/api/me/channels');
      if (data && data.whatsapp && data.whatsapp.live) { setTesting(false); setSt(data); pop('ok', 'Connected — you are LIVE!', 'Your AI now replies to customers on its own.'); }
    }, 5000); // 5s poll (cheap indexed read!)
    const stop = setTimeout(() => { setTesting(false); toast('Still waiting — check the 3 common mistakes below', 'err'); }, 120000); // 2-min cap (never poll forever!)
    return () => { clearInterval(t); clearTimeout(stop); }; // cleanup on unmount/stop (no leaked timers!)
  }, [testing]);

  const wa = st && st.whatsapp;
  const tgOn = !!st?.telegram?.connected;

  return (
    <>
      <div className="page-head"><div><h1>Connect</h1><p>Plug in your channels once — the AI answers from then on.</p></div></div>

      <div className="card"> {/* status board: both doors at a glance */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={'pill ' + (!st ? 'off' : wa && wa.live ? 'ok' : 'flag')} style={{ fontSize: 13 }}>
            {!st ? 'Checking…' : `WhatsApp: ${wa.live ? 'LIVE' : 'OFF'}`} {/* LIVE = inbound seen (TEST passed!) */}
          </span>
          <span className={'pill ' + (!st ? 'off' : tgOn ? 'ok' : 'flag')} style={{ fontSize: 13 }}>
            {!st ? 'Checking…' : `Telegram: ${tgOn ? 'LIVE' : 'OFF'}`}
          </span>
          {wa && wa.number && <span className="hint">Shop number: {wa.number}</span>}
        </div>
      </div>

      {!road && ( // ROAD PICKER: three doors, time + cost on each (no surprises!)
        <div className="grid2">
          <button className="card hover-lift" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => openRoad('meta')}>
            <h2>WhatsApp — Meta <span className="pill ok">FREE TO START</span></h2>
            <p className="desc">Direct from Meta, no middleman. ~5 minutes, 3 values to paste. 1,000 chats/month free.</p>
            <p className="hint">Recommended for everyone.</p>
          </button>
          <button className="card hover-lift" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => openRoad('twilio')}>
            <h2>WhatsApp — Twilio</h2>
            <p className="desc">Already pay for Twilio? Paste your SID + token once — we point your number at the bot for you.</p>
            <p className="hint">For existing Twilio owners.</p>
          </button>
          <button className="card hover-lift" style={{ textAlign: 'left', cursor: 'pointer', gridColumn: '1 / -1' }} onClick={() => openRoad('telegram')}>
            <h2>Telegram — BotFather <span className="pill ok">FREE · 1 MIN</span></h2>
            <p className="desc">Message @BotFather on Telegram → /newbot → paste the token here. No payment, ever.</p>
          </button>
        </div>
      )}

      {road === 'meta' && (
        <div className="card">
          <Steps n={step} of={3} />
          {step === 1 && (<>
            <h2>Paste 2 values from Meta</h2>
            <p className="desc">developers.facebook.com → your app → WhatsApp → API Setup. Copy both into the boxes:</p>
            <label>Phone Number ID (all digits)</label>
            <input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="e.g. 123456789012345" inputMode="numeric" spellCheck="false" />
            <label>Access token (long string)</label>
            <input value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder="Paste the token from API Setup" spellCheck="false" autoComplete="off" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={metaConnect}>{busy ? 'Checking…' : 'Check + continue'}</button>
            </div>
          </>)}
          {step === 2 && (<>
            <h2>Link our app to Meta — one paste</h2>
            <p className="desc">In Meta: WhatsApp → Configuration → paste BOTH below → tap Verify and save.</p>
            <label>Our webhook URL</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ flex: 1, minWidth: 200, overflowWrap: 'anywhere' }}>{st?.webhookUrl || ''}</code>
              <CopyBtn text={st?.webhookUrl || ''} label="Copy URL" />
            </div>
            <label style={{ marginTop: 12 }}>Your verify code</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code>{metaProof?.verifyToken || ''}</code>
              <CopyBtn text={metaProof?.verifyToken || ''} label="Copy code" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" onClick={() => setStep(3)}>I've pasted in Meta — continue</button>
            </div>
          </>)}
          {step === 3 && (<TestStep testing={testing} setTesting={setTesting} onBack={back} number={wa?.number} onPull={metaPull} />)}
        </div>
      )}

      {road === 'twilio' && (
        <div className="card">
          <Steps n={step} of={3} />
          {step === 1 && (<>
            <h2>Paste your Twilio SID + token</h2>
            <p className="desc">Twilio console → Account Info. We only use them to list your numbers and point one at the bot — the token never leaves our server.</p>
            <label>Account SID (starts with AC…)</label>
            <input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" spellCheck="false" autoComplete="off" />
            <label>Auth Token</label>
            <input value={twToken} onChange={(e) => setTwToken(e.target.value)} placeholder="Your auth token" spellCheck="false" autoComplete="off" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={twilioList}>{busy ? 'Checking…' : 'Find my numbers'}</button>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>No Twilio? Use the Meta road instead — or paste this URL into any Twilio number's SmsUrl by hand:<br /><code style={{ overflowWrap: 'anywhere' }}>{st?.webhookUrl || ''}</code></p>
          </>)}
          {step === 2 && (<>
            <h2>Pick the number customers text</h2>
            <label>Your Twilio numbers</label>
            <select value={picked} onChange={(e) => setPicked(e.target.value)}>
              {(numbers || []).map((n) => (<option key={n.sid} value={n.sid}>{n.phone}</option>))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={twilioAdopt}>{busy ? 'Pointing…' : 'Point it at my bot'}</button>
            </div>
          </>)}
          {step === 3 && (<TestStep testing={testing} setTesting={setTesting} onBack={back} number={wa?.number} />)}
        </div>
      )}

      {road === 'telegram' && (
        <div className="card">
          <Steps n={step} of={2} />
          {step === 1 && (<>
            <h2>Paste your BotFather token</h2>
            <p className="desc">In Telegram: message @BotFather → send /newbot → name it → copy the token it gives you.</p>
            <label>Bot token</label>
            <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456:ABC-DEF1234…" spellCheck="false" autoComplete="off" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={tgConnect}>{busy ? 'Checking…' : 'Connect bot'}</button>
            </div>
          </>)}
          {step === 2 && (<>
            <h2>Telegram is live — link yourself (optional)</h2>
            <p className="desc">Customers just message your bot. This step links YOUR Telegram so owner commands (LEARN:, PAUSE) work from your phone.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={tgLinkGen}>Get my link code</button>
            </div>
            {tgLink && <div className="learn-box light" style={{ marginTop: 10 }}><b>Your code: {tgLink.code}</b><br />{tgLink.note}<br /><span className="hint">Send it in Telegram now — codes refresh on every tap.</span></div>}
          </>)}
        </div>
      )}

      <div className="card"> {/* the WhatsApp brain pick (same locks as the VendoraAI dropdown!) */}
        <h2>Which AI answers WhatsApp?</h2>
        <p className="desc">Locked brains need their plan — tap one to see upgrade options.</p>
        <label>WhatsApp brain</label>
        <select value={brain} onChange={(e) => saveBrain(e.target.value)}>
          {models.length === 0 && <option value={brain}>Loading brains…</option>}
          {models.map((m) => (<option key={m.id} value={m.id}>{m.label}{m.locked ? ' (Locked)' : ''}</option>))}
        </select>
        <GlassUpsell show={upsell} onClose={() => setUpsell(false)} />
      </div>
    </>
  );

  async function metaPull() { // one-tap auto-sync (Pro!): Meta profile → catalog scaffold
    setBusy(true);
    const { ok, data } = await api('/api/me/channels/meta/pull-profile', { method: 'POST', body: '{}' });
    setBusy(false);
    if (ok) pop('ok', 'Profile synced!', `${data.count} verified products added to your catalog.`);
    else if (data && data.error && String(data.error).toLowerCase().includes('premium')) setUpsell(true); // 402 → upgrade card (never a dead error!)
    else pop('err', 'Sync failed', (data && data.error) || 'Try again.');
  }
}

function TestStep({ testing, setTesting, onBack, number, onPull }) { // shared TEST-verify screen (both WhatsApp roads!)
  return (<>
    <h2>Send TEST — we watch for it live</h2>
    <p className="desc">From ANY phone, send any message to <b>{number || 'your shop number'}</b>. The moment it lands here, this page flips to LIVE.</p>
    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
      <button className="btn ghost sm" onClick={onBack}>Back</button>
      {!testing
        ? <button className="btn sm" onClick={() => setTesting(true)}>Start watching</button>
        : <button className="btn sm" disabled>Watching… send the message now</button>}
      {onPull && <button className="btn ghost sm" onClick={onPull}>Pull my WhatsApp profile (auto-sync)</button>}
    </div>
    {testing && <p className="hint" style={{ marginTop: 10 }}>Watching for your message (checks every few seconds, stops after 2 minutes)…</p>}
    <p className="hint" style={{ marginTop: 10 }}>Still waiting? The 3 usual culprits: the wrong number got the message · step 2 wasn't saved in Meta · the token expired (re-paste it). Stuck? Talk to support from Help.</p>
  </>);
}
