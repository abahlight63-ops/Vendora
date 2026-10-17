// ── frontend/src/pages/Settings.jsx ──────────────────────────────
// WHAT: the account hub — who you are, the two switches worth flipping, and
// the doors to everywhere else. This is the page the owner opens when they
// want to change something about THEIR account, as opposed to their shop's
// catalog or the assistant's voice.
//
// The profile picture is here for real: pick a file → shrink it in the browser
// to a 256px square → POST the data URL → the URL comes back on /api/me. No
// storage service, no upload widget library, and the file never leaves the
// browser at full size (a 4MB phone photo arrives as ~30KB).
//
// NOTE: the assistant's own voice/guardrails moved to pages/AiSettings.jsx
// (/ai-settings) when this page took over /settings — one page, one job.
import { useEffect, useRef, useState } from 'react'; // useRef = the hidden file input; useEffect = read the live push state
import { Link } from 'react-router-dom'; // Link = client-side nav (no full page reload!)
import { api, pop } from '../lib/api.js'; // api() calls; pop() animated outcomes
import { prettyPhone } from '../lib/phone.js'; // WhatsApp number → "0803 123 4567"
import Loader from '../components/Loader.jsx'; // mini orbit inside the avatar button while a photo uploads

// ── the row icons (drawn here, no icon package — same house style as Shell) ──
function Ic({ k }) {
  const p = { viewBox: '0 0 24 24', width: 19, height: 19, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (k === 'reply') return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /><path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" /></svg>); // reply bubble with dots (the assistant answering)
  if (k === 'bell') return (<svg {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>); // bell (phone alerts)
  if (k === 'card') return (<svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>); // credit card (plan & billing)
  if (k === 'store') return (<svg {...p}><path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="M3 6.5 4.6 4h14.8L21 6.5a2.5 2.5 0 0 1-4.5 1.5A2.5 2.5 0 0 1 12 9.5 2.5 2.5 0 0 1 7.5 8 2.5 2.5 0 0 1 3 6.5z" /><path d="M9 20v-5h6v5" /></svg>); // shop awning (business details)
  if (k === 'sliders') return (<svg {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></svg>); // sliders (AI settings)
  if (k === 'help') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>); // help
  if (k === 'pencil') return (<svg {...p}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M14.5 5.5l3 3" /></svg>); // pencil (edit the photo)
  if (k === 'chev') return (<svg {...p} width="16" height="16"><path d="M9 6l6 6-6 6" /></svg>); // the trailing chevron
  return null; // unknown key renders nothing (never a broken glyph)
}

// ── the switch ───────────────────────────────────────────────────────────
// A real <button role="switch">: keyboard-operable, screen-reader-legible, and
// with aria-checked it announces "on"/"off" without a label of its own.
// The ON colour is the brand accent, not green: in the reference the switch is
// green because green IS that app's brand colour — ours is purple.
function Switch({ on, onToggle, busy, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy}
      className={'sw' + (on ? ' on' : '')} onClick={onToggle}><i /></button>
  );
}

// ── shrink + square-crop a picked photo in the browser ───────────────────
// Draw the largest centred square of the source into a 256×256 canvas, then
// read it back as JPEG. This is why the server never sees a big file.
function shrinkToSquare(file, side = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url); // free the blob URL immediately (it is not garbage collected!)
      try {
        const s = Math.min(img.width, img.height); // the largest centred square
        const c = document.createElement('canvas');
        c.width = side; c.height = side;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, side, side);
        resolve(c.toDataURL('image/jpeg', 0.85));
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image.')); };
    img.src = url;
  });
}

export default function Settings({ biz, setMe }) { // biz = the business; setMe = swap in the updated business (avatar!) without a reload
  const fileRef = useRef(null); // the hidden <input type="file">
  const [photoBusy, setPhotoBusy] = useState(false); // a photo is uploading
  const [botOn, setBotOn] = useState(biz?.bot_enabled !== false); // assistant replies (server default is true — undefined must read as ON)
  const [botBusy, setBotBusy] = useState(false);
  const [push, setPush] = useState('checking'); // checking | off | on | unsupported | denied
  const [pushBusy, setPushBusy] = useState(false);

  // keep the switch honest if the business object arrives/refreshes late
  useEffect(() => { setBotOn(biz?.bot_enabled !== false); }, [biz?.bot_enabled]);

  // ── is THIS browser already subscribed to push? ────────────────────────
  useEffect(() => {
    (async () => {
      const ok = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      if (!ok) { setPush('unsupported'); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('/sw-app.js');
        const sub = await reg.pushManager.getSubscription();
        setPush(sub ? 'on' : 'off');
      } catch { setPush('off'); } // worker blocked (private mode?) — offer the tap, the tap explains
    })();
  }, []);

  const name = biz?.name || 'Your business';
  const initial = (name.trim()[0] || 'V').toUpperCase();
  const handle = biz?.whatsapp_number ? 'WhatsApp ' + prettyPhone(biz.whatsapp_number) : (biz?.business_niche || 'Finish your setup to go live');
  const plan = biz?.tier === 'pro' ? (biz?.subscription_status === 'trialing' ? 'Pro trial' : 'Pro') : 'Free plan';

  // ── the profile picture ────────────────────────────────────────────────
  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // reset FIRST: picking the same file twice must fire again
    if (!file) return; // cancelled the dialog — nothing to do
    if (!/^image\//.test(file.type)) { pop('err', 'That is not a picture', 'Choose a JPG, PNG or WebP image.'); return; }
    setPhotoBusy(true);
    try {
      const dataUrl = await shrinkToSquare(file);
      const { ok, data } = await api('/api/me/avatar', { method: 'POST', body: JSON.stringify({ dataUrl }) });
      if (!ok) { pop('err', 'Could not save your photo', (data && data.error) || 'Please try again.'); return; }
      setMe({ ...biz, avatar_url: data.avatar_url }); // swap the whole object so Shell's avatar updates too
      pop('ok', 'Profile picture updated', 'Customers and your topbar see it right away.');
    } catch {
      pop('err', 'Could not read that picture', 'Try another image (JPG or PNG works best).');
    } finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      const { ok, data } = await api('/api/me/avatar', { method: 'POST', body: JSON.stringify({ dataUrl: null }) }); // explicit null = clear
      if (!ok) { pop('err', 'Could not remove the photo', (data && data.error) || 'Please try again.'); return; }
      setMe({ ...biz, avatar_url: null });
      pop('ok', 'Photo removed', 'Back to your initial.');
    } finally { setPhotoBusy(false); }
  }

  // ── assistant replies (the kill-switch that already exists server-side) ──
  async function toggleBot() {
    const next = !botOn;
    setBotOn(next); setBotBusy(true); // optimistic: the switch reacts on the tap, not on the round-trip
    try {
      const { ok, data } = await api('/api/me/bot', { method: 'POST', body: JSON.stringify({ enabled: next }) });
      if (!ok) { setBotOn(!next); pop('err', 'Could not change that', (data && data.error) || 'Please try again.'); return; }
      setBotOn(data.bot_enabled); // sync to what the server actually stored
      pop('ok', data.bot_enabled ? 'Assistant replies are ON' : 'Assistant replies are PAUSED', data.bot_enabled ? 'Your AI answers customers again.' : 'Customers still reach you — the bot just stays quiet.');
    } finally { setBotBusy(false); }
  }

  // ── phone alerts (web push) ────────────────────────────────────────────
  function urlB64ToU8(s) {
    const norm = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  async function pushOn() {
    if (pushBusy) return; setPushBusy(true);
    try {
      if (push === 'unsupported') { pop('err', 'This browser cannot do phone alerts', 'Try Chrome on Android, or install the app.'); return; }
      if (Notification.permission === 'denied') { setPush('denied'); pop('err', 'Notifications are blocked', 'Allow them for this site in your browser settings, then tap again.'); return; }
      const perm = await Notification.requestPermission(); // must come from this tap — it does
      if (perm !== 'granted') { setPush(Notification.permission === 'denied' ? 'denied' : 'off'); return; }
      const { ok, data } = await api('/api/auth/config'); // VAPID public key (public by design)
      const key = ok && data && data.vapidPublicKey;
      if (!key) { pop('err', 'Phone alerts are not switched on yet', 'The server has no push keys configured.'); return; }
      const reg = await navigator.serviceWorker.register('/sw-app.js');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(key) });
      const put = await api('/api/me/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
      if (!put.ok) { pop('err', 'Could not enable alerts', (put.data && put.data.error) || 'Please try again.'); return; }
      setPush('on'); pop('ok', 'Phone alerts on', 'Quota and support news will reach your notification bar.');
    } catch {
      pop('err', 'Could not enable alerts', 'Try again — private mode blocks notification workers.');
    } finally { setPushBusy(false); }
  }
  async function pushOff() {
    if (pushBusy) return; setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      const endpoint = sub ? sub.endpoint : '';
      if (sub) await sub.unsubscribe(); // browser forgets first (a failed server call can't strand a live subscription)
      await api('/api/me/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
      setPush('off'); pop('ok', 'Phone alerts off', 'This browser stops receiving them. Other browsers keep theirs.');
    } catch { pop('err', 'Could not turn alerts off', 'Please try again.'); }
    finally { setPushBusy(false); }
  }

  const pushLabel = push === 'on' ? 'On for this browser' : push === 'denied' ? 'Blocked in your browser' : push === 'unsupported' ? 'Not available here' : 'Quiet — bell only';

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Your account, your plan, and the switches that change how VeloSales Ai behaves.</p></div></div>
      <div className="set-col">

        {/* ── who you are ─────────────────────────────────────────────── */}
        <div className="set-profile">
          <div className="set-av">{biz?.avatar_url ? <img src={biz.avatar_url} alt={name} /> : initial}</div>
          <div className="set-who"><b>{name}</b><span>{handle}</span></div>
          <button className="set-edit" onClick={() => fileRef.current && fileRef.current.click()} disabled={photoBusy} title="Change profile picture" aria-label="Change profile picture">
            {photoBusy ? <Loader size={16} /> : <Ic k="pencil" />}
          </button>
          {/* the input is hidden but real; the pencil above is its trigger (a styled <input type="file"> cannot be made to look like this everywhere) */}
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
        </div>
        {biz?.avatar_url && (
          <div className="set-under"><button onClick={removePhoto} disabled={photoBusy}>Remove photo</button></div>
        )}

        {/* ── group one: the switches ──────────────────────────────────── */}
        <div className="set-group">
          <h2>Shop &amp; account</h2>
          <div className="set-rows">
            <div className="set-row">
              <span className="set-ic"><Ic k="reply" /></span>
              <div className="set-main"><b>Assistant replies</b><span>{botOn ? 'Your AI answers customers automatically, day and night.' : 'Paused — customers can still reach you, the AI just stays quiet.'}</span></div>
              <Switch on={botOn} onToggle={toggleBot} busy={botBusy} label="Assistant replies" />
            </div>
            <div className="set-row">
              <span className="set-ic w"><Ic k="bell" /></span>
              <div className="set-main"><b>Phone alerts</b><span>{pushLabel}</span></div>
              <Switch on={push === 'on'} onToggle={push === 'on' ? pushOff : pushOn} busy={pushBusy || push === 'checking'} label="Phone alerts" />
            </div>
          </div>
        </div>

        {/* ── group two: the doors ─────────────────────────────────────── */}
        <div className="set-group">
          <h2>Plan &amp; support</h2>
          <div className="set-rows warm">
            <Link className="set-row" to="/billing">
              <span className="set-ic s"><Ic k="card" /></span>
              <div className="set-main"><b>Plan &amp; billing</b><span>See what you are on, and what a paid plan unlocks.</span></div>
              <span className="set-tail"><span className="hint">{plan}</span><Ic k="chev" /></span>
            </Link>
            <Link className="set-row" to="/profile">
              <span className="set-ic"><Ic k="store" /></span>
              <div className="set-main"><b>Business details</b><span>Shop name, WhatsApp number, opening hours and FAQs.</span></div>
              <span className="set-tail"><Ic k="chev" /></span>
            </Link>
            <Link className="set-row" to="/ai-settings">
              <span className="set-ic m"><Ic k="sliders" /></span>
              <div className="set-main"><b>AI settings</b><span>How your assistant talks, and how far it may negotiate.</span></div>
              <span className="set-tail"><Ic k="chev" /></span>
            </Link>
            <Link className="set-row" to="/help">
              <span className="set-ic w"><Ic k="help" /></span>
              <div className="set-main"><b>Help &amp; support</b><span>Guides, answers, and how to reach a human.</span></div>
              <span className="set-tail"><Ic k="chev" /></span>
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
