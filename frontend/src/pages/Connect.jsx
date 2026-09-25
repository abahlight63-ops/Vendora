// ── frontend/src/pages/Connect.jsx ─────────────────────────────────
// WHAT: the channel switchboard — connect the shop's WhatsApp via Meta's
// Embedded Signup popup (one tap, no copy-pasting IDs) + Telegram via a
// BotFather token, pick the WhatsApp brain, TEST-verify to LIVE.
// One action per screen: road picker → connect → webhook verify → TEST.
// DATA: GET /api/me/channels (status + Meta App ID/Config ID) + GET /api/me/ai-models.
import { useEffect, useRef, useState } from 'react'; // state per step; effect loads status once
import { api, pop, toast } from '../lib/api.js'; // api() calls; pop() big outcomes; toast() small notes
import { maybeShowVideoAd } from '../lib/ads.js'; // gated 30s video (free tier connects watch first — Pro never sees it!)
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

// Load Meta's SDK once (Embedded Signup popup needs window.FB!).
function loadFbSdk(appId) {
  return new Promise((resolve) => {
    if (window.FB) return resolve(true); // already loaded (strict-mode double effects!)
    window.fbAsyncInit = function () {
      try { window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version: 'v22.0' }); } catch {}
      resolve(true);
    };
    const s = document.createElement('script'); // official snippet (id-guarded!)
    s.id = 'facebook-jssdk';
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true; s.defer = true;
    s.onerror = () => resolve(false); // adblock/offline → manual fallback (never a dead button!)
    document.body.appendChild(s);
    setTimeout(() => resolve(!!window.FB), 8000); // never hang the button (slow networks!)
  });
}

export default function Connect() {
  const [st, setSt] = useState(null); // channels status (null = loading → skeleton!)
  const [models, setModels] = useState([]); // brain picker options (locked flags by tier!)
  const [road, setRoad] = useState(null); // null = road picker; 'meta' | 'telegram'
  const [step, setStep] = useState(1); // step inside the road (1-based!)
  const [busy, setBusy] = useState(false); // action lock (double-tap protection!)
  // Meta drafts (manual fallback)
  const [phoneId, setPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaProof, setMetaProof] = useState(null); // {phone, verifyToken} after connect
  const [showManual, setShowManual] = useState(false); // manual paste = fallback only!
  // Telegram drafts
  const [tgToken, setTgToken] = useState('');
  const [tgLink, setTgLink] = useState(null);
  // Brain + upsell
  const [brain, setBrain] = useState('');
  const [upsell, setUpsell] = useState(false);
  // TEST-verify
  const [testing, setTesting] = useState(false);
  // Embedded Signup listener state (popup posts these back!)
  const signup = useRef({ code: '', wabaId: '', phoneId: '' });

  async function load() { // refresh status (after every connect/disconnect!)
    const { data } = await api('/api/me/channels');
    if (data) {
      setSt(data);
      if (data.whatsapp && !brain) setBrain(data.whatsapp.model || 'gemini-flash-full'); // adopt server truth once (user edits after!)
    }
  }
  useEffect(() => { // mount: status + models in parallel (no await between = both fly!) + ONE page-entry video gate
    load();
    api('/api/me/ai-models').then(({ ok, data }) => { if (ok && Array.isArray(data.models)) setModels(data.models); });
    maybeShowVideoAd({ slot: 'page-connect' }); // page gate replaces per-button gates (one video/day here — never stacked!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for the Embedded Signup popup result (Meta posts a message with
  // the WABA id + phone number id once the user finishes the flow!).
  useEffect(() => {
    function onMsg(event) {
      if (!/facebook\.com$/.test(String(event.origin || ''))) return; // Meta only (never trust random frames!)
      let d = event.data;
      try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
      if (!d || typeof d !== 'object') return;
      const payload = d.data || d; // Meta wraps in {type, data} (versions differ!)
      if (d.type !== 'WA_EMBEDDED_SIGNUP' && d.event !== 'WA_EMBEDDED_SIGNUP') return;
      if (payload.waba_id) signup.current.wabaId = String(payload.waba_id);
      if (payload.phone_number_id) signup.current.phoneId = String(payload.phone_number_id);
      if (payload.code) signup.current.code = String(payload.code);
      if (signup.current.code) finishEmbedded(); // have the code → exchange it server-side!
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  async function finishEmbedded() { // POST the popup result → server validates + stores (tokens never shown!)
    const { code, wabaId, phoneId: pid } = signup.current;
    if (!code) return;
    signup.current.code = ''; // consume once (listener may fire twice!)
    setBusy(true);
    const { ok, data } = await api('/api/me/channels/meta/embedded', { method: 'POST', body: JSON.stringify({ code, waba_id: wabaId, phone_number_id: pid }) });
    setBusy(false);
    if (ok) { setMetaProof(data); setStep(2); load(); pop('ok', 'WhatsApp connected!', `Number ${data.phone || ''} is linked. One paste in Meta, then TEST.`); }
    else pop('err', 'Signup did not finish', data.error || 'Try again or paste your details manually below.');
  }

  // ---- Embedded Signup launch ----
  async function embeddedConnect() {
    const appId = st?.metaAppId, configId = st?.metaConfigId;
    if (!appId || !configId) { setShowManual(true); return toast('One-tap signup is not set up yet — paste your details below', 'err'); }
    signup.current = { code: '', wabaId: '', phoneId: '' }; // fresh attempt!
    setBusy(true);
    const ready = await loadFbSdk(appId);
    if (!ready || !window.FB) { setBusy(false); setShowManual(true); return toast('Popup blocked — paste your details below instead', 'err'); }
    try {
      window.FB.login(function (resp) { // the Meta popup (OAuth + phone picker in one!)
        setBusy(false);
        if (resp && resp.authResponse && resp.authResponse.code) {
          signup.current.code = String(resp.authResponse.code); // the server exchanges this for a token!
          // The message listener usually already captured the IDs — give it a beat, then finish anyway (server discovers the number itself!).
          setTimeout(finishEmbedded, 1500);
        } else {
          toast('Signup closed before finishing — try again when ready', 'err'); // user cancelled (no error state stuck!)
        }
      }, { config_id: configId, response_type: 'code', override_default_response_type: true });
    } catch (e) { setBusy(false); setShowManual(true); toast('Popup failed — paste your details below instead', 'err'); }
  }

  function back() { // Back button: step back, or road picker at step 1
    if (step > 1) setStep(step - 1);
    else { setRoad(null); setStep(1); }
  }
  function openRoad(r) { setRoad(r); setStep(1); setMetaProof(null); setTgLink(null); setShowManual(false); } // fresh drafts per road!

  // ---- Meta manual fallback (popup unavailable) ----
  async function metaConnect() {
    if (!phoneId.trim() || !metaToken.trim()) return toast('Paste both values first', 'err');
    setBusy(true);
    const { ok, data } = await api('/api/me/channels/meta', { method: 'POST', body: JSON.stringify({ phone_number_id: phoneId.trim(), token: metaToken.trim() }) });
    setBusy(false);
    if (ok) { setMetaProof(data); setMetaToken(''); setStep(2); load(); } // token cleared from the form (stored server-side only!)
    else pop('err', 'Meta said no', data.error || 'Check the values and try again.');
  }
  async function metaDisconnect() {
    setBusy(true);
    await api('/api/me/channels/meta/disconnect', { method: 'POST', body: '{}' });
    setBusy(false);
    setMetaProof(null); setStep(1); load(); toast('WhatsApp disconnected.');
  }
  // ---- Telegram actions ----
  async function tgConnect() {
    if (!tgToken.trim()) return toast('Paste your BotFather token first', 'err');
    setBusy(true);
    try {
      const { ok, status, data } = await api('/api/me/telegram/token', { method: 'POST', body: JSON.stringify({ token: tgToken.trim() }) });
      if (ok && data.connected) { setTgToken(''); setStep(2); load(); pop('ok', 'Telegram connected' + (data.botUsername ? ' as ' + data.botUsername : '') + '!', 'Send your bot any message to test it.'); }
      else if (status === 401) pop('err', 'Signed out', 'Your session expired — sign in again, then retry.');
      else if (status === 502) pop('err', 'Telegram unreachable', (data && data.error) || 'Our server could not reach Telegram. Wait a minute and retry.');
      else pop('err', 'Token rejected', (data && data.error) || 'Check the token from BotFather.');
    } catch (e) {
      pop('err', 'Server unreachable', 'Our server is waking up or offline (free-plan sleep takes ~1 min). Wait a minute and tap Connect bot again.');
    } finally {
      setBusy(false);
    }
  }
  async function tgLinkGen() {
    setBusy(true);
    try {
      const { ok, status, data } = await api('/api/me/telegram/link', { method: 'POST', body: '{}' });
      if (ok) setTgLink(data);
      else if (status === 401) toast('Your session expired — sign in again', 'err');
      else toast((data && data.error) || 'Could not generate link', 'err');
    } catch (e) {
      toast('Server unreachable — wait a minute and retry', 'err');
    } finally {
      setBusy(false);
    }
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
          {wa && wa.metaConnected && <span className="hint">Meta linked — no credentials needed from you.</span>}
          {wa && (wa.dailyUnlimited || wa.dailyLimit) ? <span className="hint">Today: {wa.dailyUsed || 0}/{wa.dailyUnlimited ? 'Unlimited' : wa.dailyLimit} replies ({wa.tier || 'free'} plan)</span> : null}
          {wa && wa.metaConnected && <button className="btn ghost sm" disabled={busy} onClick={metaDisconnect}>Disconnect</button>}
        </div>
      </div>

      {!road && ( // ROAD PICKER: WhatsApp (Embedded Signup!) + Telegram
        <div className="grid2">
          <button className="card hover-lift" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => openRoad('meta')}>
            <h2>WhatsApp — One-tap connect <span className="pill ok">FREE TO START</span></h2>
            <p className="desc">Tap once, log in with Facebook, pick your business number — we handle the IDs and tokens for you. No copying, no console maze. 1,000 chats/month free.</p>
            <p className="hint">Recommended for everyone. Takes ~2 minutes.</p>
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
            <h2>Let&apos;s connect your WhatsApp Business account</h2>
            <p className="desc">Here&apos;s what happens next — it takes about 2 minutes:</p>
            <ol className="desc" style={{ margin: '8px 0 8px 18px', display: 'grid', gap: 6 }}>
              <li>You&apos;ll be asked to log in with the Facebook account linked to your WhatsApp Business.</li>
              <li>Facebook will show you your WhatsApp Business number — confirm it&apos;s the right one.</li>
              <li>Once confirmed, your account connects automatically — no codes or technical setup needed on your end.</li>
            </ol>
            <p className="hint">We never see or store your Facebook password — this login happens directly and securely through Meta.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={embeddedConnect}>{busy ? 'Opening Meta…' : 'Continue to connect'}</button>
            </div>
            {!st?.metaEmbeddedReady && st && (
              <p className="hint" style={{ marginTop: 10 }}>One-tap signup is being set up on our side — use the manual paste below for now.</p>
            )}
            {!showManual
              ? <p className="hint" style={{ marginTop: 10 }}>Popup blocked or prefer copy-paste? <button type="button" className="btn ghost sm" onClick={() => setShowManual(true)}>Paste details manually</button></p>
              : (<div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <h2>Paste 2 values from Meta</h2>
                <p className="desc">Get them in 2 minutes — free:</p>
                <ol className="desc" style={{ margin: '8px 0 8px 18px', display: 'grid', gap: 4 }}>
                  <li>Go to developers.facebook.com → Log in → Create App (type: Business).</li>
                  <li>In the app dashboard → Add Product → WhatsApp (a free test number appears).</li>
                  <li>Open WhatsApp → API Setup → copy <b>Phone Number ID</b> (all digits) + the <b>temporary token</b> (lasts 24h — enough to connect + TEST today).</li>
                </ol>
                <label>Phone Number ID (all digits)</label>
                <input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="e.g. 123456789012345" inputMode="numeric" spellCheck="false" />
                <label>Access token (long string)</label>
                <input value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder="Paste the token from API Setup" spellCheck="false" autoComplete="off" />
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn sm" disabled={busy} onClick={metaConnect}>{busy ? 'Checking…' : 'Check + continue'}</button>
                </div>
              </div>)}
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

      {road === 'telegram' && (
        <div className="card">
          <Steps n={step} of={2} />
          {step === 1 && (<>
            <h2>Connect your Telegram bot</h2>
            <p className="desc">To connect Telegram, you need a free bot token from Telegram itself — it takes under a minute.</p>
            <ol className="desc" style={{ margin: '8px 0 8px 18px', display: 'grid', gap: 4 }}>
              <li>Open Telegram and search for <b>@BotFather</b> (the official bot for creating bots).</li>
              <li>Send the command <b>/newbot</b></li>
              <li>Give your bot a name (this is what customers will see).</li>
              <li>Give it a username — it must end in <b>bot</b> (e.g. YourShopBot).</li>
              <li>BotFather will reply with a message containing your API token — a long string like <b>123456789:ABCdefGhIJKlmNoPQRsTuVwxyZ</b>.</li>
              <li>Copy that token and paste it below.</li>
            </ol>
            <p className="hint">⚠️ Keep this token private — anyone with it can control your bot.</p>
            <label>Bot token</label>
            <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456789:ABCdefGhIJKlmNoPQRsTuVwxyZ" spellCheck="false" autoComplete="off" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={tgConnect}>{busy ? 'Checking…' : 'Connect bot'}</button>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>We check the token with Telegram instantly — a wrong or expired token is rejected right here.</p>
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

      <div className="card"> {/* the WhatsApp brain pick (same locks as the VeloSalesAI dropdown!) */}
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

function TestStep({ testing, setTesting, onBack, number, onPull }) { // shared TEST-verify screen (Meta road!)
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
    <p className="hint" style={{ marginTop: 10 }}>Still waiting? The 3 usual culprits: the wrong number got the message · step 2 wasn't saved in Meta · the token expired (reconnect). Stuck? Talk to support from Help.</p>
  </>);
}
