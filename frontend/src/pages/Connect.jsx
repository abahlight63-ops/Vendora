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
import Loader from '../components/Loader.jsx'; // mini orbit in busy buttons (brand consistency!)
import GlassUpsell from '../components/GlassUpsell.jsx'; // locked-model upgrade card
import ModelPicker from '../components/ModelPicker.jsx'; // shared brain picker (same look as VeloSalesAI!)
import GuideSlides from '../components/GuideSlides.jsx'; // visual how-to slides on the road cards (screenshots drop in tonight!)

function CopyRow({ label, value }) { // tap-anywhere copy row: plain selectable text + Copy button (NEVER a link — nothing navigates away, ever!)
  async function copy() {
    try { await navigator.clipboard.writeText(value); toast('Copied.'); }
    catch { toast('Copy this: ' + value, 'err'); }
  }
  return (<div><label>{label}</label><div className="copyrow" onClick={copy} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') copy(); }}><span>{value}</span><span className="btn ghost sm"><Ic n="copy" s={14} /> Copy</span></div></div>);
}

const WA_SLIDES = [ // road-card visuals (/connect/whatsapp-N.png land tonight — placeholders until then!)
  { img: '/connect/whatsapp-1.png', title: 'Tap Continue', text: 'One tap opens Meta — the login window appears.' },
  { img: '/connect/whatsapp-2.png', title: 'Log in + pick number', text: 'Facebook account tied to your business, then your number.' },
  { img: '/connect/whatsapp-3.png', title: 'Finish every step', text: 'Complete the whole window — skipped steps mean no code.' },
  { img: '/connect/whatsapp-4.png', title: 'Paste 2 values', text: 'Webhook URL + verify code into your Meta dashboard.' },
  { img: '/connect/whatsapp-5.png', title: 'TEST → LIVE', text: 'Send a message — this page flips LIVE instantly.' },
];
const TG_SLIDES = [
  { img: '/connect/telegram-1.png', title: 'Ask @BotFather', text: 'Open Telegram, search @BotFather, send /newbot.' },
  { img: '/connect/telegram-2.png', title: 'Name your bot', text: 'Display name customers see + username ending in bot.' },
  { img: '/connect/telegram-3.png', title: 'Copy the token', text: 'Tap-copy the long token from BotFather’s reply.' },
  { img: '/connect/telegram-4.png', title: 'Paste + connect', text: 'Paste here, tap Connect bot — verified instantly.' },
  { img: '/connect/telegram-5.png', title: 'Chat away', text: 'Customers message your bot — the AI answers.' },
];

function Steps({ n, of }) { // progress dots ("Step 2 of 4" — nobody gets lost!)
  return <p className="hint" style={{ margin: '0 0 10px' }}>Step {n} of {of}</p>;
}

// Load Meta's SDK once (Embedded Signup popup needs window.FB!).
function isStandaloneBrowser() { // installed PWA (popups lose their return trip here — offer the manual road!)
  try {
    if (window.navigator && window.navigator.standalone === true) return true; // iOS installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true; // Android/desktop installed
  } catch {}
  return false;
}
function isAndroidStandalone() { // installed app ON Android (Chrome-escape hatch applies — same profile, session carries over!)
  try {
    return isStandaloneBrowser() && isAndroid();
  } catch { return false; }
}
function isAndroid() { // ANY Android browser or installed app (gate the Chrome tools on this — desktops + iPhones never need them!)
  try {
    return /android/i.test(window.navigator.userAgent || '');
  } catch { return false; }
}
function chromeEscapeUrl() { // intent:// link that opens THIS page in full Chrome (popup machinery works there!)
  try {
    const u = new URL(window.location.href);
    const target = `https://${u.host}/connect`; // land back on the Connect road (fresh state, no stale query!)
    return `intent://${u.host}/connect#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target)};end`;
  } catch { return ''; }
}
async function openInChrome(setShowManual, toast) { // installed PWA → full Chrome, via the OS share sheet (native, never silently swallowed like intent: taps!) — same profile, login carries over!
  const target = (() => { try { return `${new URL(window.location.href).origin}/connect`; } catch { return ''; } })();
  if (target && navigator.share) { // share sheet: user picks Chrome (one familiar tap — pick it from the list!)
    try { await navigator.share({ title: 'VeloSales Ai — Connect WhatsApp', text: 'Open in Chrome to connect WhatsApp, then return here.', url: target }); return; }
    catch (e) { /* dismissed → fall through to the intent link below */ }
  }
  if (target) window.location.href = chromeEscapeUrl(); // no share API → intent link (watchdog below covers silence!)
  chromeEscapeArmed(setShowManual, toast);
}
function chromeEscapeArmed(setShowManual, toast) { // intent taps die SILENTLY when Chrome is missing (fallback reloads this same page = looks dead!) — watchdog catches it
  setTimeout(() => {
    let left = false; // did we actually leave for Chrome? (backgrounded tab = success!)
    try { left = document.hidden || !document.hasFocus(); } catch {}
    if (!left) { // still here 2.5s later → escape failed: reveal the manual road + say so (never a dead tap!)
      setShowManual(true);
      toast('Chrome didn\u2019t open — enter details manually below (same result, no popup needed).', 'err');
    }
  }, 2500);
}
function loadFbSdk(appId) {
  return new Promise((resolve) => {
    const init = () => { // (re-)init with THIS attempt's App ID (a stale init from an older/wrong ID would poison every retry until reload!)
      try { window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version: 'v22.0' }); } catch {}
    };
    if (window.FB) { init(); return resolve(true); } // already loaded (strict-mode double effects!) — re-init fresh, don't trust the old one!
    window.fbAsyncInit = function () { init(); resolve(true); };
    if (document.getElementById('facebook-jssdk')) { setTimeout(() => resolve(!!window.FB), 3000); return; } // tag already present (retry attempt!) — don't double-inject, just re-check!
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
  // Meta drafts (retired manual inputs — endpoint stays live server-side!)
  const [phoneId, setPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaProof, setMetaProof] = useState(null); // {phone, verifyToken} after connect
  const [showManual, setShowManual] = useState(false); // retired (one-tap only!) — state kept so old handlers stay valid, nothing renders it
  // Telegram drafts
  const [tgToken, setTgToken] = useState('');
  const [tgLink, setTgLink] = useState(null);
  const [tgShared, setTgShared] = useState(null); // shared-bot result {code, botName, deepLink, note} (Pro road!)
  const [tgHealth, setTgHealth] = useState(null); // webhook health verdict (Verify button!)
  const [waHealth, setWaHealth] = useState(null); // Meta token liveness verdict (Verify WhatsApp button!)
  // Brain + upsell
  const [brain, setBrain] = useState('');
  const [upsell, setUpsell] = useState(false);
  // TEST-verify
  const [testing, setTesting] = useState(false);
  // Embedded Signup listener state (popup posts these back!)
  const signup = useRef({ code: '', token: '', wabaId: '', phoneId: '', retried: false, watch: null }); // popup result holder (+ retry flag + stuck-busy watchdog timer!)

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
  // Key-variant tolerant: Meta's payload keys differ across SDK versions!
  function pickKey(o, ...keys) {
    for (const k of keys) {
      const v = o ? o[k] : undefined;
      if (v !== undefined && v !== null && String(v) !== '') return String(v);
    }
    return '';
  }
  useEffect(() => {
    function onMsg(event) {
      if (!/facebook\.com$/.test(String(event.origin || ''))) return; // Meta only (never trust random frames!)
      let d = event.data;
      try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
      if (!d || typeof d !== 'object') return;
      const payload = d.data || d; // Meta wraps in {type, data} (versions differ!)
      if (d.type !== 'WA_EMBEDDED_SIGNUP' && d.event !== 'WA_EMBEDDED_SIGNUP') return;
      const waba = pickKey(payload, 'waba_id', 'wabaID', 'waba_ID', 'wabaId');
      const ph = pickKey(payload, 'phone_number_id', 'phoneNumberID', 'phone_number_ID', 'phoneId');
      const cd = pickKey(payload, 'code', 'authCode', 'auth_code');
      const tok = pickKey(payload, 'access_token', 'accessToken'); // some flows hand the token directly (backend accepts it — no exchange needed!)
      if (waba) signup.current.wabaId = waba;
      if (ph) signup.current.phoneId = ph;
      if (cd) signup.current.code = cd;
      if (tok) signup.current.token = tok;
      if (signup.current.code || signup.current.token) finishEmbedded(); // have credentials → exchange server-side!
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  async function finishEmbedded() { // POST the popup result → server validates + stores (tokens never shown!)
    const { code, token, wabaId, phoneId: pid } = signup.current;
    if (!code && !token) return;
    signup.current.code = ''; signup.current.token = ''; // consume once (listener may fire twice!)
    setBusy(true);
    try {
      const { ok, status, data } = await api('/api/me/channels/meta/embedded', { method: 'POST', body: JSON.stringify({ code, token, waba_id: wabaId, phone_number_id: pid }) });
      const msg = (data && data.error) || '';
      if (ok) { setMetaProof(data); setStep(2); load(); pop('ok', 'WhatsApp connected!', `Number ${data.phone || ''} is linked. One paste in Meta, then TEST.`); }
      else if (status === 401) pop('err', 'Signed out', 'Your session expired — sign in again, then retry.');
      else if (status === 404) pop('err', 'Shop not found', 'Your login lost its shop — sign out and sign in again, then retry.');
      else if (status >= 500) pop('err', 'Server error', (msg || 'Our server hiccuped — wait a minute and retry.') + (data && data.ref ? ` (ref: ${data.ref})` : ''));
      else if (msg.includes('did not return a number') && !signup.current.retried) { // IDs lag the code sometimes — ONE auto-retry before asking to retry!
        signup.current.retried = true; signup.current.code = code; signup.current.token = token; // restore (late Meta events may have landed meanwhile!)
        toast('Almost — waiting for Meta details…', 'info');
        setTimeout(() => { signup.current.retried = false; finishEmbedded(); }, 4000);
      }
      else pop('err', 'Signup did not finish', msg || 'Try again — finish every step inside the popup, especially picking your number.');
    } catch (e) {
      pop('err', 'Server unreachable', 'Our server is waking up or offline (free-plan sleep takes ~1 min). Wait a minute and retry — or talk to support from Help.');
    } finally {
      setBusy(false);
    }
  }

  // ---- Embedded Signup launch ----
  async function embeddedConnect() {
    const appId = st?.metaAppId, configId = st?.metaConfigId;
    if (!appId || !configId) { setShowManual(true); return toast('One-tap signup is not set up yet — talk to support from Help', 'err'); }
    if (!/^\d{5,}$/.test(appId)) { setShowManual(true); return pop('err', 'Server App ID looks wrong', 'The META_APP_ID on Render must be the numeric App ID only (digits, no spaces, no business ID mixed in). Fix it there, redeploy, and retry.'); } // garbage-in guard (Meta answers these with "invalid app id"!)
    if (String(configId).length < 5) { setShowManual(true); return pop('err', 'Server config looks wrong', 'The META_CONFIGURATION_ID on Render looks incomplete — re-copy it from WhatsApp → Embedded Signup, redeploy, and retry.'); }
    signup.current = { code: '', token: '', wabaId: '', phoneId: '', retried: false, watch: null }; // fresh attempt!
    setBusy(true);
    const ready = await loadFbSdk(appId);
    if (!ready || !window.FB) { setBusy(false); setShowManual(true); return toast('Popup blocked — allow popups and retry', 'err'); }
    try {
      window.FB.login(function (resp) { // the Meta popup (OAuth + phone picker in one!)
        if (signup.current.watch) { clearTimeout(signup.current.watch); signup.current.watch = null; } // answered (any answer!) → watchdog stands down
        setBusy(false);
        try { if (typeof console !== 'undefined' && console.debug) console.debug('[meta] popup answered, keys:', resp ? Object.keys(resp) : null, 'hasCode:', !!(resp && resp.authResponse && resp.authResponse.code)); } catch {} // KEYS only (never tokens!) — devtools diagnosis without leaking secrets
        if (resp && resp.error) {
          const emsg = String(resp.error.message || resp.error);
          if (/javascript sdk|jssdk/i.test(emsg)) { setShowManual(true); return pop('err', 'One switch missing in Meta', 'In developers.facebook.com → your app → Facebook Login → Settings, set "Log in with the JavaScript SDK" to YES and save. Then retry here — the popup is blocked until that switch is on.'); } // Meta names the exact toggle (the #1 desktop blocker — mobile shows it as a silent close!)
          setShowManual(true); return pop('err', 'Meta refused the popup', emsg + ' — usual causes: wrong App ID on Render, or the app URL missing in Meta dashboard → Facebook Login → Authorized JavaScript origins.');
        } // Meta's REAL verdict surfaced (was swallowed as "closed before finishing"!)
        if (resp && resp.authResponse && resp.authResponse.code) {
          signup.current.code = String(resp.authResponse.code); // the server exchanges this for a token!
          // The message listener usually already captured the IDs — give it a beat, then finish anyway (server discovers the number itself!).
          setTimeout(finishEmbedded, 1500);
        } else if (resp && resp.authResponse) {
          pop('err', 'Signup incomplete', 'Meta logged you in but issued no signup code — the business/number steps were likely skipped. Reopen and complete EVERY popup step, especially picking your business number.'); // logged-in-but-codeless (was mislabeled "closed before finishing"!)
        } else {
          toast('Signup closed before finishing — try again when ready', 'err'); // user cancelled (no error state stuck!)
        }
      }, { config_id: configId, response_type: 'code', override_default_response_type: true, extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' } }); // extras = REQUIRED by Meta (without featureType the popup runs a plain login that never issues a WhatsApp code — the "I did everything!" mystery!)
      signup.current.watch = setTimeout(() => { // popup answered NOTHING in 2 min (swallowed callback — blocked third-party cookies do this!) → unstick + support pointer
        signup.current.watch = null; setBusy(false); setShowManual(true);
        toast('Popup went quiet — allow popups + third-party cookies for this site and retry, or talk to support from Help.', 'err');
      }, 120000); // 2-min cap (matches the TEST-verify patience — never an eternal spinner!)
    } catch (e) { setBusy(false); setShowManual(true); toast('Popup failed — allow popups and retry', 'err'); }
  }

  function back() { // Back button: step back, or road picker at step 1
    if (step > 1) setStep(step - 1);
    else { setRoad(null); setStep(1); }
  }
  function openRoad(r) { setRoad(r); setStep(1); setMetaProof(null); setTgLink(null); setTgShared(null); setTgHealth(null); setWaHealth(null); setShowManual(false); } // fresh drafts per road!

  // ---- Meta manual connect (retired UI — one-tap only! Endpoint stays live server-side for emergencies.) ----
  async function metaConnect() {
    if (!phoneId.trim() || !metaToken.trim()) return toast('Paste both values first', 'err');
    setBusy(true);
    try {
      const { ok, status, data } = await api('/api/me/channels/meta', { method: 'POST', body: JSON.stringify({ phone_number_id: phoneId.trim(), token: metaToken.trim() }) });
      const msg = (data && data.error) || '';
      if (ok) { setMetaProof(data); setMetaToken(''); setStep(2); load(); } // token cleared from the form (stored server-side only!)
      else if (status === 401) pop('err', 'Signed out', 'Your session expired — sign in again, then retry.');
      else if (status === 404) pop('err', 'Shop not found', 'Your login lost its shop — sign out and sign in again, then retry.');
      else if (status >= 500) pop('err', 'Server error', (msg || 'Our server hiccuped — wait a minute and retry.') + (data && data.ref ? ` (ref: ${data.ref})` : ''));
      else pop('err', 'Meta said no', msg || 'Check the values and try again.');
    } catch (e) {
      pop('err', 'Server unreachable', 'Our server is waking up or offline (free-plan sleep takes ~1 min). Wait a minute and retry.');
    } finally {
      setBusy(false);
    }
  }
  async function metaDisconnect() {
    setBusy(true);
    try {
      await api('/api/me/channels/meta/disconnect', { method: 'POST', body: '{}' });
      setMetaProof(null); setStep(1); load(); toast('WhatsApp disconnected.');
    } catch (e) {
      toast('Server unreachable — wait a minute and retry', 'err');
    } finally {
      setBusy(false);
    }
  }
  // ---- WhatsApp liveness: asks Meta if the stored token still works (dead temp tokens named here!) ----
  async function waHealthCheck() {
    setBusy(true); setWaHealth(null);
    try {
      const { ok, data } = await api('/api/me/channels/meta/health');
      if (ok) setWaHealth(data);
      else toast((data && data.error) || 'Health check failed', 'err');
    } catch (e) {
      toast('Server unreachable — wait a minute and retry', 'err');
    } finally {
      setBusy(false);
    }
  }
  // ---- Telegram actions ----
  const TG_SHAPE = /^\d+:[\w-]{30,}$/; // BotFather reality: numeric bot id + colon + ~35-char secret (finger-selected pastes that FAIL this are truncated — caught HERE, not at Telegram!)
  async function tgConnect() {
    const clean = tgToken.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '').replace(/\s+/g, ''); // strip EVERYTHING invisible first (wrapped BotFather messages paste with line-breaks/spaces inside — rejoined, never rejected!)
    if (!clean) return toast('Paste your BotFather token first', 'err');
    if (!TG_SHAPE.test(clean)) { pop('err', 'Token looks incomplete', 'BotFather tokens look like 123456789:ABCdefGhIJKlmNoPQRsTuVwxyZ (numbers, a colon, ~35 characters, no spaces). TAP-copy it in BotFather with /token — finger-selecting drops characters. No server key needed: this token IS the key.'); return; }
    setBusy(true);
    try {
      const { ok, status, data } = await api('/api/me/telegram/token', { method: 'POST', body: JSON.stringify({ token: clean }) });
      const msg = (data && data.error) || '';
      if (ok && data.connected) { setTgToken(''); setStep(2); load(); pop('ok', 'Telegram connected' + (data.botUsername ? ' as ' + data.botUsername : '') + '!', 'Send your bot any message to test it.'); }
      else if (status === 401) pop('err', 'Signed out', 'Your session expired — sign in again, then retry.');
      else if (status === 404) pop('err', 'Shop not found', 'Your login lost its shop — sign out and sign in again, then retry. (NOT your token.)');
      else if (status === 502) pop('err', 'Telegram unreachable', msg || 'Our server could not reach Telegram. Wait a minute and retry.');
      else if (status >= 500) pop('err', 'Server error', (msg || 'Our server hiccuped — wait a minute and retry.') + (data && data.ref ? ` (ref: ${data.ref} — send me this code!)` : '') + ' (NOT your token.)');
      else pop('err', 'Token rejected', msg || 'Check the token from BotFather.');
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
  // ---- Shared-bot road (Pro only, no BotFather!) ----
  async function tgSharedConnect() {
    setBusy(true);
    try {
      const { ok, status, data } = await api('/api/me/telegram/shared', { method: 'POST', body: '{}' });
      if (ok && data.connected) { setTgShared(data); setStep(2); load(); pop('ok', 'Shared bot connected!', 'Give customers your link below — they chat, the AI answers.'); }
      else if (status === 402) setUpsell(true); // free tier → upgrade card (never a dead error!)
      else if (status === 401) pop('err', 'Signed out', 'Your session expired — sign in again, then retry.');
      else pop('err', 'Shared bot unavailable', ((data && data.error) || 'Try your own bot below instead.') + (data && data.ref ? ` (ref: ${data.ref})` : ''));
    } catch (e) {
      pop('err', 'Server unreachable', 'Our server is waking up or offline (free-plan sleep takes ~1 min). Wait a minute and retry.');
    } finally {
      setBusy(false);
    }
  }
  async function tgSharedOff() {
    setBusy(true);
    try {
      await api('/api/me/telegram/shared', { method: 'POST', body: JSON.stringify({ off: true }) });
      setTgShared(null); setStep(1); load(); toast('Shared bot switched off.');
    } catch (e) {
      toast('Server unreachable — wait a minute and retry', 'err');
    } finally {
      setBusy(false);
    }
  }
  // ---- Webhook health: asks Telegram directly (hook registered? pointing at us? last error?) ----
  async function tgHealthCheck() {
    setBusy(true); setTgHealth(null);
    try {
      const { ok, data } = await api('/api/me/telegram/health');
      if (ok) setTgHealth(data);
      else toast((data && data.error) || 'Health check failed', 'err');
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
  const tgSharedCard = tgShared || null; // fresh shared result (code travels only on explicit generate!)
  const tgSharedOrOn = !!(tgShared || st?.telegram?.shared); // shared mode active (fresh tap OR earlier session!)

  return (
    <>
      <div className="page-head"><div><h1>Connect</h1><p>Plug in your channels once — the AI answers from then on.</p></div></div>

      <div className="card"> {/* status board: both doors at a glance */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={'pill ' + (!st ? 'off' : wa && wa.live ? 'ok' : 'flag')} style={{ fontSize: 13 }}>
            {!st ? 'Checking…' : `WhatsApp: ${wa.live ? 'LIVE' : 'OFF'}`} {/* LIVE = inbound seen (TEST passed!) */}
          </span>
          <span className={'pill ' + (!st ? 'off' : tgOn ? 'ok' : 'flag')} style={{ fontSize: 13 }}>
            {!st ? 'Checking…' : `Telegram: ${tgOn ? (st.telegram.shared ? 'LIVE · shared' : 'LIVE') : 'OFF'}`}
          </span>
          {wa && wa.number && <span className="hint">Shop number: {wa.number}</span>}
          {wa && wa.metaConnected && <span className="hint">Meta linked — no credentials needed from you.</span>}
          {wa && (wa.dailyUnlimited || wa.dailyLimit) ? <span className="hint">Today: {wa.dailyUsed || 0}/{wa.dailyUnlimited ? 'Unlimited' : wa.dailyLimit} replies ({wa.tier || 'free'} plan)</span> : null}
          {wa && wa.metaConnected && <button className="btn ghost sm" disabled={busy} onClick={metaDisconnect}>Disconnect</button>}
        </div>
        {wa && wa.metaConnected && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn ghost sm" disabled={busy} onClick={waHealthCheck}>{busy ? 'Verifying…' : 'Verify WhatsApp'}</button>
              {waHealth && waHealth.connected && <span className="pill ok" style={{ fontSize: 12 }}>Token alive{waHealth.phone ? ` · ${waHealth.phone}` : ''}</span>}
              {waHealth && !waHealth.connected && waHealth.reason && <span className="pill flag" style={{ fontSize: 12 }}>Needs attention</span>}
            </div>
            {waHealth && waHealth.connected && <p className="hint" style={{ marginTop: 6 }}>Meta accepts your token. If TEST messages still don&apos;t flip LIVE, the webhook paste in Meta (step 2) is the missing piece — not your credentials.</p>}
            {waHealth && !waHealth.connected && <p className="hint" style={{ marginTop: 6 }}>{waHealth.reason === 'token-dead' ? 'Your Meta token expired (temp tokens last 24h) — reconnect with a fresh token from Meta API Setup.' : 'Not connected yet — finish step 1 first.'}</p>}
          </div>
        )}
        {tgOn && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn ghost sm" disabled={busy} onClick={tgHealthCheck}>{busy ? 'Verifying…' : 'Verify Telegram connection'}</button>
              {tgHealth && tgHealth.configured && tgHealth.ok && <span className="pill ok" style={{ fontSize: 12 }}>Webhook OK{tgHealth.pending ? ` · ${tgHealth.pending} queued` : ''}</span>}
              {tgHealth && tgHealth.configured && !tgHealth.ok && <span className="pill flag" style={{ fontSize: 12 }}>Needs attention</span>}
            </div>
            {tgHealth && !tgHealth.configured && <p className="hint" style={{ marginTop: 6 }}>No bot saved yet — connect below first.</p>}
            {tgHealth && tgHealth.configured && tgHealth.ok && <p className="hint" style={{ marginTop: 6 }}>Telegram delivers to us correctly. Message the bot — it answers. Customers: nothing to install, just open your bot/link and chat.</p>}
            {tgHealth && tgHealth.configured && !tgHealth.ok && <p className="hint" style={{ marginTop: 6 }}>{tgHealth.lastError ? `Telegram says: ${tgHealth.lastError}. ` : 'Webhook not registered. '}Fix: re-save your token (own bot) or reconnect shared — saving re-registers the webhook automatically.</p>}
          </div>
        )}
      </div>

      {!road && ( // ROAD PICKER: visual cards (slideshow art up top, tap anywhere to enter!)
        <div className="grid2">
          <button className="card hover-lift" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => openRoad('meta')}>
            <GuideSlides slides={WA_SLIDES} label="How WhatsApp connecting works" />
            <h2>WhatsApp — One-tap connect <span className="pill ok">FREE TO START</span></h2>
            <p className="desc">Tap once, log in with Facebook, pick your business number — we handle the IDs and tokens for you. No copying, no console maze. 1,000 chats/month free.</p>
            <p className="hint">Recommended for everyone. Takes ~2 minutes.</p>
          </button>
          <button className="card hover-lift" style={{ textAlign: 'left', cursor: 'pointer', gridColumn: '1 / -1' }} onClick={() => openRoad('telegram')}>
            <GuideSlides slides={TG_SLIDES} label="How Telegram connecting works" />
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
            <div className="learn-box light" style={{ marginTop: 10 }}><b>Before you tap — 30 seconds that prevent 90% of popup failures:</b><br />1. Log into the RIGHT Facebook account in THIS browser (the one tied to your WhatsApp Business — business admin, not staff).<br />2. Allow popups + third-party cookies for this site (address-bar icon).<br />3. Finish EVERY step inside the popup — especially picking your business number, or we get a code with no number.<br />4. On the installed app? Do this step once in full Chrome, then return here for daily use.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={embeddedConnect}>{busy ? (<><Loader size={15} />Opening Meta…</>) : 'Continue to connect'}</button>
            </div>
            {isAndroid() && (
              <div className="learn-box light" style={{ marginTop: 10 }}>
                <b>{isStandaloneBrowser() ? 'On the installed app?' : 'Popup misbehaving?'}</b><br />
                <span className="hint">{isStandaloneBrowser() ? 'Popups can\u2019t complete inside the installed app — open this page in full Chrome instead (same login carries over, nothing to redo):' : 'Open this page fresh in Chrome — same login carries over, and the popup gets a clean window:'}</span>
                <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => openInChrome(setShowManual, toast)}>Open in Chrome</button></div>
                <span className="hint">Pick Chrome from the share list → finish the Meta steps there → return here. Your connection (and TEST) will be waiting. Nothing opens? The manual boxes appear below on their own.</span>
              </div>
            )}
            {!st?.metaEmbeddedReady && st && (
              <div className="learn-box light" style={{ marginTop: 10 }}>
                <b>One-tap popup isn&apos;t ready{!st.metaAppId ? ' — META_APP_ID missing on the server' : !st.metaConfigId ? ' — META_CONFIGURATION_ID missing on the server' : ''}.</b><br />
                <span className="hint">Server keys set but popup still won&apos;t open? Two usual culprits: (1) Meta app dashboard → Facebook Login → Settings → Authorized JavaScript origins must include your app URL{typeof window !== 'undefined' && window.location && window.location.origin ? (<> — yours right now is <b>{window.location.origin}</b> (copy it exactly, https + domain, no trailing slash)</>) : ''}; (2) popup/ad-blocker (allow popups + connect.facebook.net). Still stuck? Talk to support from Help.</span>
              </div>
            )}
            <p className="hint">Stuck on the popup? Allow popups for this site and retry — or talk to support from Help.</p>
            {!showManual && isStandaloneBrowser() && <p className="hint" style={{ marginTop: 8 }}>On the installed app? Popups struggle here — <button type="button" className="btn ghost sm" onClick={() => setShowManual(true)}>enter details manually</button></p>}
            {showManual && (<div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <h2>Enter details manually</h2>
              <p className="desc">Same two values from your Meta app dashboard (WhatsApp → API testing) — no developer maze:</p>
              <ol className="desc" style={{ margin: '8px 0 8px 18px', display: 'grid', gap: 4 }}>
                <li>Open your Meta app → WhatsApp → API testing.</li>
                <li>Copy the <b>Phone Number ID</b> (all digits) + the <b>temporary token</b> (lasts 24h — enough to connect + TEST today).</li>
              </ol>
              <label>Phone Number ID (all digits)</label>
              <input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="e.g. 123456789012345" inputMode="numeric" spellCheck="false" />
              <label>Access token (long string)</label>
              <input value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder="Paste the token from API testing" spellCheck="false" autoComplete="off" />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn sm" disabled={busy} onClick={metaConnect}>{busy ? (<><Loader size={15} />Checking…</>) : 'Check + continue'}</button>
              </div>
            </div>)}
          </>)}
          {step === 2 && (<>
            <h2>Link VeloSales Ai in your Meta dashboard</h2>
            <p className="desc">Open your Meta app dashboard → WhatsApp → Configuration. Paste BOTH values below there, then tap Verify and save. Nothing here navigates away — tap any box to copy it.</p>
            <CopyRow label="Value 1 — webhook URL" value={st?.webhookUrl || ''} />
            <div style={{ marginTop: 10 }}><CopyRow label="Value 2 — verify code" value={metaProof?.verifyToken || ''} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" onClick={() => setStep(3)}>I&apos;ve pasted in Meta — continue</button>
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
              <button className="btn sm" disabled={busy} onClick={tgConnect}>{busy ? (<><Loader size={15} />Checking…</>) : 'Connect bot'}</button>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>We check the token with Telegram instantly — a wrong or expired token is rejected right here.</p>
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <h2>Or skip BotFather — shared bot <span className="pill ok">PRO</span></h2>
              <p className="desc">Pro shops ride our house bot: one tap, no tokens, nothing to revoke. Customers open your link once, then chat normally.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" disabled={busy} onClick={tgSharedConnect}>{busy ? (<><Loader size={15} />Connecting…</>) : 'Connect shared bot'}</button>
              </div>
              <p className="hint" style={{ marginTop: 8 }}>Free plan? This button opens the upgrade card instead — your own bot above stays free forever.</p>
            </div>
          </>)}
          {step === 2 && tgSharedOrOn && (<>
            <h2>Shared bot is live — give customers this link</h2>
            <p className="desc">Anyone who opens it once is bound to your shop forever. Owner commands (LEARN:, PAUSE) stay in your dashboard.</p>
            {tgSharedCard && <div className="learn-box light" style={{ marginTop: 10 }}><b>Customer link: {tgSharedCard.deepLink || ('t.me/' + tgSharedCard.botName)}</b><br />Your code: <b>{tgSharedCard.code}</b><br />{tgSharedCard.note}<br /><span className="hint">New code invalidates the old one — regenerate any time.</span></div>}
            {!tgSharedCard && st?.telegram?.sharedBot && <div className="learn-box light" style={{ marginTop: 10 }}><b>Connected via @{st.telegram.sharedBot}</b><br /><span className="hint">Generate a fresh customer link below.</span></div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={back}>Back</button>
              <button className="btn sm" disabled={busy} onClick={tgSharedConnect}>{busy ? (<><Loader size={15} />Working…</>) : 'Get customer link'}</button>
              <button className="btn ghost sm" disabled={busy} onClick={tgSharedOff}>Switch off</button>
            </div>
          </>)}
          {step === 2 && !tgSharedOrOn && (<>
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

      <div className="card"> {/* the WhatsApp brain pick (same picker + locks as VeloSalesAI!) */}
        <h2>Which AI answers WhatsApp?</h2>
        <p className="desc">Locked brains need their plan — tap one to see upgrade options.</p>
        <ModelPicker models={models} model={brain} onPick={saveBrain} onLocked={() => setUpsell(true)} />
        <GlassUpsell show={upsell} onClose={() => setUpsell(false)} />
      </div>
    </>
  );

  async function metaPull() { // one-tap auto-sync (Pro!): Meta profile → catalog scaffold
    setBusy(true);
    try {
      const { ok, data } = await api('/api/me/channels/meta/pull-profile', { method: 'POST', body: '{}' });
      if (ok) pop('ok', 'Profile synced!', `${data.count} verified products added to your catalog.`);
      else if (data && data.error && String(data.error).toLowerCase().includes('premium')) setUpsell(true); // 402 → upgrade card (never a dead error!)
      else pop('err', 'Sync failed', ((data && data.error) || 'Try again.') + (data && data.ref ? ` (ref: ${data.ref})` : ''));
    } catch (e) {
      pop('err', 'Server unreachable', 'Our server is waking up or offline — wait a minute and retry.');
    } finally {
      setBusy(false);
    }
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
