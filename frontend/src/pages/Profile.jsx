// ── frontend/src/pages/Profile.jsx ─────────────────────────────────
// WHAT: business identity editor — name, locked WhatsApp number, personal
// number, hours, tone, currency, timezone, FAQs. Save → PUT /api/me/business.
// The AI introduces the shop EXACTLY from this data (garbage in = garbage out).
// SHELL: same centred column as Settings (pages/Settings.jsx) — a profile hero,
// then tinted .set-row groups — so the two account screens read as one family.
import React, { useEffect, useState } from 'react'; // React namespace (TelegramCard uses React.useState/useEffect); useEffect = Telegram status fetch on mount
import { Link } from 'react-router-dom'; // Connect-page link (channels moved to their own page!)
import { api, pop, toast } from '../lib/api.js'; // api() save; pop() big success/fail animation; toast() small toggle notes
import { normalizePhone, prettyPhone } from '../lib/phone.js'; // live phone help: normalize (validate) + pretty (display)
import { NICHES } from '../lib/niches.js'; // lane picker (same list as Welcome — catalog shelves + AI suggestions follow it!)
import Ic from '../components/icons.jsx'; // check icon for the "Saved as …" line
import Select from '../components/Select.jsx'; // the app's one dropdown (see that file for why it is not a <select>)
import Loader from '../components/Loader.jsx'; // mini orbit in the alerts buttons

// ── the row icons (drawn here, no icon package — same house style as Settings) ──
function RowIc({ k }) {
  const p = { viewBox: '0 0 24 24', width: 19, height: 19, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (k === 'reply') return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /><path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" /></svg>); // reply bubble with dots (bot replies)
  if (k === 'bell') return (<svg {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>); // bell (phone alerts)
  if (k === 'plug') return (<svg {...p}><path d="M9 7V2M15 7V2M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /></svg>); // plug (channels)
  if (k === 'store') return (<svg {...p}><path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="M3 6.5 4.6 4h14.8L21 6.5a2.5 2.5 0 0 1-4.5 1.5A2.5 2.5 0 0 1 12 9.5 2.5 2.5 0 0 1 7.5 8 2.5 2.5 0 0 1 3 6.5z" /><path d="M9 20v-5h6v5" /></svg>); // shop awning (business name)
  if (k === 'lock') return (<svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>); // padlock (the locked number)
  if (k === 'phone') return (<svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9z" /></svg>); // handset (personal WhatsApp)
  if (k === 'clock') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>); // clock (opening hours)
  if (k === 'cash') return (<svg {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>); // banknote (billing currency)
  if (k === 'globe') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" /></svg>); // globe (timezone)
  if (k === 'tag') return (<svg {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></svg>); // price tag (what you sell)
  if (k === 'voice') return (<svg {...p}><path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>); // mic (how the AI sounds)
  if (k === 'users') return (<svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5" /><path d="M17 8.5a3 3 0 0 1 0 5.9M19 20c0-2.3-.8-4-2.2-5" /></svg>); // two people (personal contacts)
  if (k === 'help') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>); // help (FAQs)
  return null; // unknown key renders nothing (never a broken glyph)
}

export default function Profile({ biz }) { // biz prop = business from App's useMe (includes currency/timezone from getMe!)
  const [f, setF] = useState({ name: biz?.name || '', owner: biz?.owner_number || '', hours: biz?.hours || '', tone: biz?.tone || 'friendly and helpful', currency: biz?.currency || 'NGN', timezone: biz?.timezone || 'Africa/Lagos', niche: biz?.business_niche || '', personal: ((biz?.personal_contacts || []).join('\n')), faq: (biz?.faq || []).map((x) => x.question + ' | ' + x.answer).join('\n') }); // ONE form object (biz?. guards slow load; || defaults; faq ARRAY → one-per-line "question | answer" TEXT for easy editing!; personal JSONB array → one-number-per-line text!)
  const nicheOpts = f.niche && !NICHES.includes(f.niche) ? [f.niche, ...NICHES] : NICHES; // custom lane kept as first option (never strand a saved custom value!)
  const [botOn, setBotOn] = useState(biz?.bot_enabled !== false); // kill-switch state (default ON; !== false treats missing as on — safe default!)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); // CURRIED setter factory: set('name') returns an onChange handler writing f.name (computed key [k]!). One line replaces 7 handlers!
  const name = biz?.name || 'Your business'; // the hero name (the SAVED business, not the draft in the form)
  const initial = (name.trim()[0] || 'V').toUpperCase();
  async function save() {
    const faq = f.faq.split('\n').map((l) => { const [q, ...a] = l.split('|'); return q && a.length ? { question: q.trim(), answer: a.join('|').trim() } : null; }).filter(Boolean); // parse BACK: lines → split on FIRST '|' (destructure [q, ...a] keeps extra pipes in the answer via a.join!) → trim → drop blank/invalid lines (filter(Boolean) removes nulls)
    const personal = f.personal.split('\n').map((l) => l.trim()).filter(Boolean); // one-number-per-line → clean array (any format accepted — backend normalizes!)
    const { ok, data } = await api('/api/me/business', { method: 'PUT', body: JSON.stringify({ name: f.name.trim(), owner_number: f.owner.trim(), hours: f.hours.trim(), tone: f.tone.trim(), currency: f.currency, timezone: f.timezone.trim() || 'Africa/Lagos', business_niche: f.niche, personal_contacts: personal, faq }) }); // PUT full update (trim strings, pass currency/timezone/niche/personal through)
    if (ok) pop('ok', 'Profile saved!', 'The AI talks with this from now on.'); // big success (profile = high-stakes!)
    else pop('err', 'Save failed', (data.errors || [data.error || 'Please try again.']).join('; ')); // backend sends errors ARRAY (validation) or single error — handle BOTH shapes!
  }
  return (
    <>
      <div className="page-head"><div><h1>Business profile</h1><p>Exactly how the AI introduces you. Short, true, and fresh beats long and stale.</p></div></div>
      <div className="set-col">

        {/* ── hero: the shop the AI speaks for ─────────────────────────── */}
        <div className="set-profile">
          <div className="set-av">{initial}</div>
          <div className="set-who"><b>{name}</b><span>{biz?.whatsapp_number ? 'WhatsApp ' + prettyPhone(biz.whatsapp_number) : 'Finish your setup so the AI can introduce you.'}</span></div>
        </div>

        {/* ── group one: the two switches + the channel door ───────────── */}
        <div className="set-group">
          <h2>Assistant &amp; alerts</h2>
          <div className="set-rows">
            <div className="set-row wrap">
              <span className="set-ic"><RowIc k="reply" /></span>
              <div className="set-main"><b>Bot replies: {botOn ? 'ON' : 'OFF'}</b><span>{botOn ? 'The AI answers customers.' : 'Silent everywhere — messages are logged only.'}</span></div>
              <button className={'btn sm ' + (botOn ? 'ghost' : '')} onClick={async () => { const { ok } = await api('/api/me/bot', { method: 'POST', body: JSON.stringify({ enabled: !botOn }) }); if (ok) { setBotOn(!botOn); toast(!botOn ? 'Bot resumed.' : 'Bot paused everywhere.'); } else toast('Could not switch bot', 'err'); }}>{botOn ? 'Pause bot' : 'Resume bot'}</button>
            </div>
            <PhoneAlerts />
            <TelegramCard />
          </div>
        </div>

        {/* ── group two: what the AI reads about the shop ──────────────── */}
        <div className="set-group">
          <h2>Business details</h2>
          <div className="set-rows warm">
            <div className="set-row form">
              <span className="set-ic"><RowIc k="store" /></span>
              <div className="set-main"><label>Business name</label><input value={f.name} onChange={set('name')} /></div> {/* controlled input: value mirrors state, onChange writes back (React owns the text!) */}
            </div>
            <div className="set-row form">
              <span className="set-ic w"><RowIc k="lock" /></span>
              <div className="set-main"><label>WhatsApp number (locked)</label><input value={biz?.whatsapp_number || ''} disabled /></div> {/* disabled = identity can't change (currency auto-resolves from it at signup!) */}
            </div>
            <div className="set-row form">
              <span className="set-ic s"><RowIc k="phone" /></span>
              <div className="set-main"><label>Your personal WhatsApp</label><input value={f.owner} onChange={set('owner')} onBlur={() => { const n = normalizePhone(f.owner); if (n) setF({ ...f, owner: prettyPhone(n) }); }} placeholder="0803 123 4567" inputMode="tel" /><span className="hint">Only this number can teach with LEARN: — type it any way you like.</span>
                {f.owner.trim() !== '' && (normalizePhone(f.owner) ? <span className="hint ok-line"><Ic n="check" s={13} /> Saved as {normalizePhone(f.owner)}</span> : <span className="hint err-line">That number doesn't look right.</span>)}</div> {/* onBlur = when field loses focus: normalize + pretty-print (live formatting lesson!). Inline validation BELOW the input: green "Saved as …" vs red warning (non-empty only — empty field shows neither!) */}
            </div>
            <div className="set-row form">
              <span className="set-ic m"><RowIc k="clock" /></span>
              <div className="set-main"><label>Opening hours</label><input value={f.hours} onChange={set('hours')} placeholder="Mon–Sat, 9am–7pm" /></div>
            </div>
            <div className="set-row form">
              <span className="set-ic w"><RowIc k="cash" /></span>
              <div className="set-main"><label>Billing currency</label><Select value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={[{ value: 'NGN', label: 'Naira (₦)', hint: 'Nigerian cards and bank transfer' }, { value: 'USD', label: 'US Dollar ($)', hint: 'International cards' }]} label="Billing currency" /><span className="hint">Auto-set from your number — change anytime.</span></div> {/* one control for every choice in the app — see components/Select.jsx */}
            </div>
            <div className="set-row form">
              <span className="set-ic s"><RowIc k="globe" /></span>
              <div className="set-main"><label>Timezone</label><input value={f.timezone} onChange={set('timezone')} placeholder="Africa/Lagos" spellCheck="false" /><span className="hint">Used for open/closed replies. e.g. America/New_York, Europe/London.</span></div> {/* spellCheck off for technical strings */}
            </div>
            <div className="set-row form">
              <span className="set-ic"><RowIc k="tag" /></span>
              <div className="set-main"><label>What you sell</label><Select value={f.niche} onChange={(v) => setF({ ...f, niche: v })} options={nicheOpts} label="What you sell" /><span className="hint">Your lane — catalog shelves + AI suggestions follow it.</span></div> {/* lane switch (catalog categories + VeloSales Ai chips reshape on save!) */}
            </div>
            <div className="set-row form">
              <span className="set-ic m"><RowIc k="voice" /></span>
              <div className="set-main"><label>How should the AI sound?</label> {/* tone = personality prompt (free text → system prompt!) */}
                <input value={f.tone} onChange={set('tone')} placeholder="warm, short, a little Pidgin when they use Pidgin" /></div>
            </div>
            <div className="set-row form">
              <span className="set-ic s"><RowIc k="users" /></span>
              <div className="set-main"><label>Personal contacts — one number per line (bot NEVER replies to these)</label>
                <textarea value={f.personal} onChange={set('personal')} rows="3" placeholder={'0803 123 4567\n0805 987 6543'} />
                <span className="hint">Friends and family chatting personally — their messages are ignored entirely, so the bot never fights your own conversations.</span></div>
            </div>
            <div className="set-row form">
              <span className="set-ic w"><RowIc k="help" /></span>
              <div className="set-main"><label>FAQs — one per line: question | answer</label> {/* the pipe format (parsed in save() above) */}
                <textarea value={f.faq} onChange={set('faq')} rows="5" placeholder={"Where are you? | 12 Allen Avenue, Ikeja\nDo you deliver? | Yes, nationwide in 2–4 days"} /></div> {/* <textarea> multiline; rows="5" height; {"…\n…"} = placeholder with real newline */}
            </div>
          </div>
        </div>

        <div className="set-foot"><button className="btn" onClick={save}>Save profile</button></div>

      </div>
    </>
  );
}

function PhoneAlerts() { // Web Push toggle: quota/support/broadcast alerts on the phone notification bar, tab closed or not!
  const [st, setSt] = React.useState('checking'); // checking | off | on | unsupported | denied
  const [busy, setBusy] = React.useState(false); // subscribe in flight (double-tap protection!)
  function supported() { // all three APIs or nothing (iOS Safari needs installed-PWA + iOS 16.4+!)
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }
  React.useEffect(() => { // mount: already subscribed in THIS browser?
    (async () => {
      if (!supported()) { setSt('unsupported'); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('/sw-app.js'); // app worker owns push now (sw-push.js merged in — same scope, subscription survives!)
        const sub = await reg.pushManager.getSubscription();
        setSt(sub ? 'on' : 'off');
      } catch { setSt('off'); } // worker blocked (private mode?) → offer the button anyway (tap explains!)
    })();
  }, []); // [] = mount-only probe
  function urlB64ToU8(s) { // websafe base64 → Uint8Array (PushManager demands raw bytes, not the string!)
    const norm = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  async function enable() { // permission → subscribe → POST to backend (three gates, each with its own message!)
    if (busy) return; setBusy(true);
    try {
      if (Notification.permission === 'denied') { setSt('denied'); return; } // browser-level block (only Settings can undo — say so!)
      const perm = await Notification.requestPermission(); // the browser prompt (must come from a tap — it does, this IS the tap handler!)
      if (perm !== 'granted') { setSt(Notification.permission === 'denied' ? 'denied' : 'off'); return; }
      const { ok, data } = await api('/api/auth/config'); // VAPID public key (backend serves it — public by design!)
      const key = ok && data && data.vapidPublicKey;
      if (!key) { toast('Phone alerts are not switched on yet (server keys missing).'); return; } // backend has no VAPID pair (admin: npm run push:vapid!)
      const reg = await navigator.serviceWorker.register('/sw-app.js'); // app worker (push handlers live inside it now!)
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(key) });
      const put = await api('/api/me/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) }); // {endpoint, keys:{p256dh, auth}} → stored per business!
      if (put.ok) { setSt('on'); toast('Phone alerts on — quota and support news will find you.'); }
      else toast((put.data && put.data.error) || 'Could not enable alerts', 'err');
    } catch { toast('Could not enable alerts — try again (private mode blocks workers).', 'err'); } // any throw above lands here (never a dead button!)
    finally { setBusy(false); } // unlock either way!
  }
  async function disable() { // unsubscribe locally + forget server-side (other browsers keep theirs!)
    if (busy) return; setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      const endpoint = sub ? sub.endpoint : '';
      if (sub) await sub.unsubscribe(); // browser forgets first (server delete can't strand a live sub!)
      await api('/api/me/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
      setSt('off'); toast('Phone alerts off for this browser.');
    } catch { toast('Could not disable alerts', 'err'); }
    finally { setBusy(false); }
  }
  return (
    <div className="set-row wrap">
      <span className="set-ic w"><RowIc k="bell" /></span>
      <div className="set-main"><b>Phone alerts</b><span>
        {st === 'checking' ? 'Checking…' : st === 'on' ? 'ON — quota, replies and broadcasts reach your notification bar.' : st === 'denied' ? 'Blocked — allow notifications in browser Settings, then tap again.' : st === 'unsupported' ? 'This browser cannot do phone alerts — try Chrome on Android or an installed app.' : 'OFF — quota and support news stay in the bell only.'}
      </span></div>
      {st !== 'checking' && st !== 'unsupported' && (
        st === 'on'
          ? <button className="btn sm ghost" disabled={busy} onClick={disable}>{busy ? (<><Loader size={15} />Working…</>) : 'Turn off'}</button>
          : <button className="btn sm" disabled={busy} onClick={enable}>{busy ? (<><Loader size={15} />Enabling…</>) : 'Turn on'}</button>
      )}
    </div>
  );
}

function TelegramCard() { // Channels moved to the Connect page — this card just points there (one home for WhatsApp + Telegram!)
  const [st, setSt] = React.useState(null); // null = loading; {connected}
  React.useEffect(() => { api('/api/me/channels').then(({ ok, data }) => { if (ok) setSt(data); }); }, []); // [] = mount-only status fetch
  const waLive = !!(st && st.whatsapp && st.whatsapp.live);
  const tgOn = !!(st && st.telegram && st.telegram.connected);
  return (
    <div className="set-row wrap">
      <span className="set-ic s"><RowIc k="plug" /></span>
      <div className="set-main"><b>Channels</b><span>{!st ? 'Checking…' : `WhatsApp: ${waLive ? 'LIVE' : 'OFF'} · Telegram: ${tgOn ? 'LIVE' : 'OFF'}`}</span></div>
      <Link className="btn sm" to="/connect">Open Connect page</Link>
    </div>
  );
}
