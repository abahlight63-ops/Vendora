// ── frontend/src/pages/Admin.jsx ──────────────────────────────────
// WHAT: YOUR private console (direct URL /admin only — NOT in the sidebar, so
// owners never stumble in). Password gate → tabs: Overview (stats), Users
// (search + verify), Revenue (payments ledger), Transfers (approve/reject),
// Complaints (reply/resolve). All session-authed (server checks isAdmin).
// React patterns: gate state, tab state, per-tab loaders, confirm() on
// destructive actions, pop() confirmations, fmt helpers for money/dates.
import { useEffect, useRef, useState } from 'react';
import { api, fmtDate, pop, toast } from '../lib/api.js';
import { money } from '../lib/money.js';
import Ic from '../components/icons.jsx';
import Loader from '../components/Loader.jsx'; // Orbit V while the gate checks
import { adsStatus, clearSponsorSeen, clearVideoSeen, maybeShowSponsor, maybeShowVideoAd } from '../lib/ads.js'; // sponsor + video previews (this browser's tier/tags, daily caps bypassed)

const TABS = [['stats', 'Overview', 'chart', 'green'], ['users', 'Users', 'profile', 'blue'], ['revenue', 'Income', 'cash', 'gold'], ['transfers', 'Transfers', 'send', 'orange'], ['referrals', 'Referrals', 'gift', 'purple'], ['channels', 'Channels', 'plug', 'teal'], ['complaints', 'Complaints', 'help', 'red'], ['templates', 'Templates', 'copy', 'gold'], ['broadcast', 'Broadcast', 'mega', 'orange'], ['warn', 'Warn user', 'warn', 'red'], ['ai', 'AI health', 'spark', 'purple'], ['ads', 'Ads', 'card', 'green']]; // [key, label, icon, accent] quads — EVERY console page is a tab (one page visible at a time, never stacked!)
const STATIC_TABS = ['templates', 'broadcast', 'warn', 'ai', 'ads']; // self-loading panels (no endpoint — render immediately, no skeleton!)

function isFresh(ts) { // "NEW" pill window: created within the last 24h (new users, fresh transfers, new referrals light up!)
  const t = new Date(ts).getTime();
  return Number.isFinite(t) && (Date.now() - t) < 24 * 3600 * 1000;
}

export default function Admin() {
  const [gate, setGate] = useState('checking'); // 'checking' | 'locked' | 'open' (three gate states — never flash the console to strangers!)
  const [pw, setPw] = useState(''); // password draft (controlled input, never stored beyond this submit!)
  const [tab, setTab] = useState('stats'); // active tab key
  const [d, setD] = useState(null); // tab data (shape depends on tab — single state, reused!)
  const [blastSeed, setBlastSeed] = useState(null); // template → broadcast prefill ({t,b,link,image,video,n})
  const [warnSeed, setWarnSeed] = useState(null); // template → warn-one prefill (same shape, who stays empty)

  async function check() { // lockdown: EVERY visit starts locked (tab closed + reopened = password again, always!)
    setGate('checking');
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); // burn any surviving admin session first (server expiry is the backstop!)
    setGate('locked'); // password gate, every time (working admins re-enter — 10 seconds for real security!)
  }
  useEffect(() => { check(); }, []); // [] = mount-only lockdown

  async function login() { // password submit…
    if (!pw) return toast('Enter the admin password', 'err'); // guard: blank submit
    const { ok, data } = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) }); // session.isAdmin set server-side on success…
    setPw(''); // clear the field EITHER way (never leave a password in the DOM!)
    if (ok) { setGate('open'); load('stats'); toast('Welcome back, boss.'); } // …in → load first tab (toast, not pop — minor moment!)
    else toast(data.error || 'Wrong password', 'err'); // generic backend message (never leaks config state!)
  }

  async function load(t) { // tab loader: one endpoint per DATA tab (switch re-fetches = always fresh!)…
    if (STATIC_TABS.includes(t)) { setTab(t); setD({}); return; } // static page (templates/forms/health load themselves — no endpoint, no skeleton!)
    setTab(t); setD(null); // set tab + null data (null renders skeletons — consistent loading UX!)
    if (t === 'referrals') { // referrals = THREE endpoints at once (overview + airtime queue + leaderboard!)
      const [o, p, l] = await Promise.all([api('/api/admin/referrals'), api('/api/admin/referrals/pending'), api('/api/admin/referrals/leaders')]);
      if (o.status === 401 || p.status === 401 || l.status === 401) { setGate('locked'); toast('Admin session expired — sign in again', 'err'); return; }
      if (o.ok && p.ok && l.ok) { setD({ overview: o.data.rows || [], pending: p.data.rows || [], leaders: l.data.rows || [] }); return; }
      toast('Could not load referrals', 'err'); return;
    }
    const urls = { stats: '/api/admin/stats', users: '/api/admin/users', revenue: '/api/admin/stats', transfers: '/api/admin/transfers', channels: '/api/admin/channels', complaints: '/api/admin/complaints' }; // tab → endpoint map (revenue reuses stats + payments list below? stats covers totals; transfers tab shows the money ACTIONS)
    const { ok, status, data } = await api(urls[t]); // fetch…
    if (ok) setD(data); // …store (array or object — panels branch on tab, not shape!)
    else if (status === 401) { setGate('locked'); toast('Admin session expired — sign in again', 'err'); } // idle 30 min → password again (tight by design!)
    else toast(data.error || 'Load failed', 'err'); // other failures → toast (gate stays — retry the tab!)
  }

  async function act(url, body, msg) { // generic ACTION helper: POST → pop → reload tab (approve/reject/verify/resolve all flow through here!)
    const { ok, data } = await api(url, { method: 'POST', body: body ? JSON.stringify(body) : '{}' }); // body optional (approve needs none; reply needs {reply})
    if (ok) { pop('ok', 'Done!', msg || 'Action recorded.'); load(tab); } // success popup + FRESH data (list reflects the change instantly!)
    else pop('err', 'Failed', data.error || 'Try again.'); // backend reason shown (already-touched guards explain themselves!)
  }

  if (gate !== 'open') { // GATE (locked OR checking): password card (same glass style as Login — familiar!)
    return (
      <div className="auth-wrap">
        <div className="auth-card glass" style={{ maxWidth: 420 }}>
          <div className="auth-pane">
            <h1>Admin only</h1> {/* plain title (no branding fanfare — obscurity is a feature here!) */}
            <p className="switch-note">{gate === 'checking' ? 'Checking access…' : 'This area is private. Enter the admin password.'}</p>
            {gate === 'checking' && <div style={{ display: 'grid', placeItems: 'center', padding: '18px 0 6px' }}><Loader size={40} /></div>}
            {gate === 'locked' && ( // password form ONLY when confirmed locked (checking shows text alone — no flash of inputs!)
              <>
                <label>Admin password</label>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={(e) => { if (e.key === 'Enter') login(); }} /> {/* Enter submits (same keyboard habit as Login!) */}
                <button className="btn login-cta" onClick={login}>Unlock console</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const accent = (TABS.find(([k]) => k === tab) || [, , , 'green'])[3]; // active tab's color (drives header dot + panel tint!)
  return ( // CONSOLE (gate open)…
    <div className="admin-liquid">
      <div className="page-head"><div className="row" style={{ width: '100%' }}><div><h1><span className={'admin-dot acc-' + accent} />Admin console</h1><p>Private — overview, users, income, transfers, referrals, channels, complaints, templates, broadcast, warnings, AI health, ads. One page at a time.</p></div><button className="btn ghost sm" onClick={async () => { await api('/api/admin/logout', { method: 'POST' }); setGate('locked'); }}>Sign out</button></div></div>
      <div className="card admin-tabs"> {/* tab bar (icons at 16px + labels, active solid / rest ghost) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(([k, l, ic, ac]) => ( // destructure quads; icon + label per tab…
            <button key={k} className={'btn sm ' + (tab === k ? 'acc-' + ac : 'ghost')} onClick={() => load(k)}><Ic n={ic} s={16} />{l}</button>
          ))}
        </div>
      </div>
      <div key={tab} className={'admin-panel acc-' + accent}> {/* key={tab} = remount per tab → entrance animation replays every switch! */}
      {!d ? <div className="card"><div className="skel" /></div> : tab === 'stats' ? <Stats d={d} /> // null → skeleton; else ONE panel per page (clicking Users never shows Templates — each page owns the screen!)
        : tab === 'users' ? <Users rows={d} refresh={() => load('users')} act={act} />
        : tab === 'revenue' ? <Revenue d={d} />
        : tab === 'transfers' ? <Transfers rows={d} act={act} />
        : tab === 'referrals' ? <Referrals d={d} act={act} refresh={() => load('referrals')} />
        : tab === 'channels' ? <Channels rows={(d && d.rows) || []} refresh={() => load('channels')} />
        : tab === 'templates' ? <Templates onBroadcast={(t) => { setBlastSeed({ ...t, n: Date.now() }); load('broadcast'); }} onWarn={(t) => { setWarnSeed({ ...t, n: Date.now() }); load('warn'); }} />
        : tab === 'broadcast' ? <Broadcast act={act} seed={blastSeed} />
        : tab === 'warn' ? <WarnUser act={act} seed={warnSeed} />
        : tab === 'ai' ? <AiHealth />
        : tab === 'ads' ? <AdsStatus />
        : <Complaints rows={d} act={act} />}
      </div>
    </div>
  );
}

async function uploadNoticeMedia(file) { // notice photo/mp4 → hosted URL (throws the human message on failure!)
  const isImg = String(file.type || '').startsWith('image/');
  const isMp4 = file.type === 'video/mp4';
  if (!isImg && !isMp4) throw new Error('Choose an image or an mp4 video.');
  const cap = isImg ? 2.5 * 1024 * 1024 : 10 * 1024 * 1024; // photos 2.5MB, video 10MB
  if (file.size > cap) throw new Error(isImg ? 'Image too large — max 2.5MB.' : 'Video too large — max 10MB.');
  const dataUrl = await new Promise((res, rej) => { // FileReader is callback-based → Promise-wrap to await it
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
  const { ok, data } = await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ dataUrl }) });
  if (!ok || !data.url) throw new Error((data && data.error) || 'Upload failed.');
  return data.url;
}

function MediaField({ label, value, onChange, accept, hint }) { // upload-or-paste URL field with preview (shared by broadcast, warn + builder!)
  const fileRef = useRef(null); // hidden picker (button opens it)
  const [busy, setBusy] = useState(false); // upload in flight (button locks!)
  const isVideo = accept.includes('video');
  async function pick(file) {
    if (!file) return; // dialog cancelled
    setBusy(true);
    try {
      onChange(await uploadNoticeMedia(file)); // URL lands in the draft (preview appears below!)
      toast('Media uploaded.');
    } catch (e) { toast(e.message || 'Upload failed', 'err'); }
    setBusy(false);
  }
  return (
    <div>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><Ic n="camera" s={14} />{busy ? 'Uploading…' : 'Upload ' + (isVideo ? 'video' : 'image')}</button>
        {value ? <button type="button" className="del" style={{ fontSize: 12 }} onClick={() => onChange('')}>Remove</button> : null}
      </div>
      <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }} /> {/* value reset: same file re-pickable! */}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint || '…or paste a public https:// link'} inputMode="url" spellCheck="false" style={{ marginTop: 8 }} />
      {value ? (isVideo
        ? <video src={value} controls preload="metadata" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block' }} />
        : <img src={value} alt="" loading="lazy" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block' }} onError={(e) => { e.target.style.display = 'none'; }} />) : null}
    </div>
  );
}

function Broadcast({ act, seed }) { // APP UPDATES: one broadcast → every owner's bell…
  const [t, setT] = useState('');
  const [b, setB] = useState('');
  const [link, setLink] = useState('/dashboard');
  const [image, setImage] = useState('');
  const [video, setVideo] = useState('');
  useEffect(() => { // template "Use" → prefill this form (seed.n bumps to retrigger!)
    if (!seed) return;
    setT(seed.t || ''); setB(seed.b || ''); setLink(seed.link || '/dashboard');
    setImage(seed.image || ''); setVideo(seed.video || '');
    toast('Template loaded — review, then send.');
  }, [seed]); // seed object identity changes per click (parent stamps n: Date.now())
  async function send() {
    if (!t.trim()) return toast('Give the update a title', 'err');
    const { ok, data } = await api('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ title: t.trim(), body: b.trim(), link: link.trim() || '/dashboard', image_url: image.trim() || null, video_url: video.trim() || null }) });
    if (ok) { pop('ok', 'Broadcast sent!', `Landed in ${data.sent} inbox${data.sent === 1 ? '' : 'es'}.`); setT(''); setB(''); setLink('/dashboard'); setImage(''); setVideo(''); }
    else pop('err', 'Failed', (data && data.error) || 'Try again.');
  }
  return (
    <div className="card" style={{ borderColor: 'var(--gold-line)' }}>
      <h2><Ic n="mega" s={18} /> Broadcast app update</h2>
      <p className="desc">Long message + optional photo/video → lands in every owner's bell instantly. {'{name}'} becomes each shop's name. Pick a template on the Templates page or write freehand.</p>
      <label>Title</label>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="e.g. Smarter VeloSales Ai is live" maxLength={120} />
      <label>Message (long is fine — the bell previews, the page shows all)</label>
      <textarea value={b} onChange={(e) => setB(e.target.value)} rows="6" placeholder="Write the full story here…" maxLength={4000} />
      <p className="hint">{b.length}/4000</p>
      <div className="grid2">
        <div><label>Opens (app page)</label><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/dashboard" spellCheck="false" /></div>
        <div><label>&nbsp;</label><p className="hint" style={{ margin: 0 }}>e.g. /billing, /catalog, /connect, /velosales-ai</p></div>
      </div>
      <div className="grid2" style={{ marginTop: 10 }}>
        <MediaField label="Photo (optional)" value={image} onChange={setImage} accept="image/*" />
        <MediaField label="Video mp4 (optional)" value={video} onChange={setVideo} accept="video/mp4" />
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={send}><Ic n="send" s={16} />Send to all bells</button>
    </div>
  );
}

function WarnUser({ act, seed }) { // ONE user, not all: a warning/notice → their bell only…
  const [who, setWho] = useState(''); // business ID, account email, or WhatsApp number (server resolves all three)
  const [t, setT] = useState('');
  const [b, setB] = useState('');
  const [image, setImage] = useState('');
  const [video, setVideo] = useState('');
  useEffect(() => { // template "Use for warning" → prefill (who stays empty — you pick the user!)
    if (!seed) return;
    setT(seed.t || ''); setB(seed.b || ''); setImage(seed.image || ''); setVideo(seed.video || '');
    toast('Template loaded — pick who, then send.');
  }, [seed]);
  async function send() {
    if (!who.trim()) return toast('Say who — email, business ID, or WhatsApp number', 'err');
    if (!t.trim()) return toast('Give the warning a title', 'err');
    await act('/api/admin/notify', { business_id: /^\d+$/.test(who.trim()) ? Number(who.trim()) : undefined, email: who.includes('@') ? who.trim() : undefined, whatsapp_number: !/^\d+$/.test(who.trim()) && !who.includes('@') ? who.trim() : undefined, title: t.trim(), body: b.trim(), link: '/dashboard', image_url: image.trim() || null, video_url: video.trim() || null }, 'Warning sent to their bell.');
    setWho(''); setT(''); setB(''); setImage(''); setVideo('');
  }
  return (
    <div className="card" style={{ borderColor: 'var(--red-line)' }}>
      <h2><Ic n="warn" s={18} /> Warn one user</h2>
      <p className="desc">Lands in that owner's bell only (web + phone app, within a minute). Use for payment issues, abuse, or personal notices.</p>
      <label>Who (email, business ID, or WhatsApp number)</label>
      <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. amaka@shop.com · 12 · 0803 123 4567" />
      <label>Title</label>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="e.g. Payment issue — action needed" maxLength={120} />
      <label>Message (long is fine)</label>
      <textarea value={b} onChange={(e) => setB(e.target.value)} rows="5" placeholder="e.g. Your card payment of ₦7,499 didn't complete — tap Billing to retry, or reply here for help…" maxLength={4000} />
      <div className="grid2" style={{ marginTop: 10 }}>
        <MediaField label="Photo (optional)" value={image} onChange={setImage} accept="image/*" />
        <MediaField label="Video mp4 (optional)" value={video} onChange={setVideo} accept="video/mp4" />
      </div>
      <button className="btn danger" style={{ marginTop: 12 }} onClick={send}><Ic n="send" s={16} />Send warning</button>
    </div>
  );
}

function Templates({ onBroadcast, onWarn }) { // GALLERY + BUILDER: 12 built-ins + your customs…
  const [list, setList] = useState(null); // null = loading (skeleton first!)
  const [et, setEt] = useState(''); // builder: title
  const [eb, setEb] = useState(''); // builder: body
  const [el, setEl] = useState('/dashboard'); // builder: link
  const [ei, setEi] = useState(''); // builder: image
  const [ev, setEv] = useState(''); // builder: video
  const [editing, setEditing] = useState(null); // custom id being edited (null = creating!)
  async function load() {
    const { ok, data } = await api('/api/admin/templates');
    if (ok && Array.isArray(data.templates)) setList(data.templates);
    else toast((data && data.error) || 'Could not load templates', 'err');
  }
  useEffect(() => { load(); }, []); // mount-only
  function clear() { setEt(''); setEb(''); setEl('/dashboard'); setEi(''); setEv(''); setEditing(null); } // fresh builder (after save + cancel!)
  async function save() {
    if (!et.trim()) return toast('Give the template a title', 'err');
    const body = JSON.stringify({ title: et.trim(), body: eb.trim(), link: el.trim() || '/dashboard', image_url: ei.trim() || null, video_url: ev.trim() || null });
    const { ok, data } = editing
      ? await api('/api/admin/templates/' + editing, { method: 'PUT', body })
      : await api('/api/admin/templates', { method: 'POST', body });
    if (ok) { toast(editing ? 'Template updated.' : 'Template saved.'); clear(); load(); }
    else toast((data && data.error) || 'Could not save template', 'err');
  }
  async function remove(id) {
    if (!confirm('Delete this template? Built-ins cannot be deleted — only your own.')) return;
    const { ok, data } = await api('/api/admin/templates/' + id, { method: 'DELETE' });
    if (ok) { toast('Template deleted.'); load(); }
    else toast((data && data.error) || 'Could not delete', 'err');
  }
  function startEdit(tpl) { // customs editable (built-ins: copy the text into a fresh builder row instead!)
    setEt(tpl.title || ''); setEb(tpl.body || ''); setEl(tpl.link || '/dashboard');
    setEi(tpl.image_url || ''); setEv(tpl.video_url || ''); setEditing(tpl.id);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // builder lives at the card top (take them there!)
  }
  function use(tpl, fn) { // "Use" → prefill broadcast/warn forms below (media rides along!)
    fn({ t: tpl.title || '', b: tpl.body || '', link: tpl.link || '/dashboard', image: tpl.image_url || '', video: tpl.video_url || '' });
  }
  return (
    <div className="card" style={{ borderColor: 'var(--gold-line)' }}>
      <h2><Ic n="mega" s={18} /> Notice templates</h2>
      <p className="desc">12 ready-made long messages + your own. “Use” jumps you to the Broadcast (or Warn user) page with the template loaded — review, attach media, send.</p>
      <label>{editing ? 'Editing your template' : 'Create your own template'}</label>
      <input value={et} onChange={(e) => setEt(e.target.value)} placeholder="Template title" maxLength={120} />
      <textarea value={eb} onChange={(e) => setEb(e.target.value)} rows="6" placeholder="Write the full long message here… {'{name}'} becomes each shop's name at send time." maxLength={4000} style={{ marginTop: 8 }} />
      <p className="hint">{eb.length}/4000</p>
      <div className="grid2">
        <div><label>Opens (app page)</label><input value={el} onChange={(e) => setEl(e.target.value)} placeholder="/dashboard" spellCheck="false" /></div>
        <div><label>&nbsp;</label><p className="hint" style={{ margin: 0 }}>Built-ins are read-only — copy one's text above to make your own version.</p></div>
      </div>
      <div className="grid2" style={{ marginTop: 10 }}>
        <MediaField label="Photo (optional)" value={ei} onChange={setEi} accept="image/*" />
        <MediaField label="Video mp4 (optional)" value={ev} onChange={setEv} accept="video/mp4" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={save}>{editing ? 'Save changes' : 'Save template'}</button>
        {editing ? <button className="btn ghost sm" onClick={clear}>Cancel</button> : null}
      </div>
      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {list === null && <div className="skel" />}
        {(list || []).map((tpl) => (
          <div key={(tpl.builtin ? 'b-' : 'c-') + tpl.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b>{tpl.title}</b>
              <span className={'pill ' + (tpl.builtin ? 'info' : 'ok')} style={{ fontSize: 11 }}>{tpl.builtin ? 'Built-in' : 'Yours'}</span>
              {(tpl.image_url || tpl.video_url) ? <span className="pill" style={{ fontSize: 11 }}>Has media</span> : null}
            </div>
            <p className="hint" style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{String(tpl.body || '').slice(0, 220)}{String(tpl.body || '').length > 220 ? '…' : ''}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={() => use(tpl, onBroadcast)}>Use for broadcast</button>
              <button className="btn ghost sm" onClick={() => use(tpl, onWarn)}>Use for warning</button>
              {!tpl.builtin && <button className="btn ghost sm" onClick={() => startEdit(tpl)}>Edit</button>}
              {!tpl.builtin && <button className="del" onClick={() => remove(tpl.id)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiHealth() { // AI KEYS LIVE? one-tap ping per provider (booleans + short errors — key VALUES never leave the server!)…
  const [h, setH] = useState(null); // null = not tested yet; 'checking' = in flight; array = results
  async function test() {
    if (h === 'checking') return; // double-tap guard (pings cost quota!)
    setH('checking');
    const { ok, data } = await api('/api/admin/ai-status');
    if (ok && Array.isArray(data.status)) setH(data.status);
    else { setH(null); toast('Could not test AIs — try again', 'err'); }
  }
  return (
    <div className="card">
      <h2><Ic n="spark" s={18} /> AI health</h2>
      <p className="desc">Pings every AI key with a 5-token hello. Green = working. Red names the exact problem (bad key? retired model? spent quota?) — fix that key on Render, then redeploy.</p>
      <button className="btn sm" disabled={h === 'checking'} onClick={test}>{h === 'checking' ? 'Testing…' : 'Test all AIs'}</button>
      {Array.isArray(h) && (
        <div style={{ marginTop: 10 }}>
          {h.map((r) => (
            <div key={r.provider} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', fontSize: 13 }}>
              <span>{r.ok ? '🟢' : '🔴'}</span>
              <b>{r.provider}</b>
              <span className="hint">{r.ok ? `${r.ms}ms` : (r.error || 'failed')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdsStatus() { // AD KEYS LIVE? booleans only — key VALUES never leave the server…
  const [s, setS] = useState(null); // null = loading (skeleton first — same habit as tabs!)
  const [previewMsg, setPreviewMsg] = useState(''); // preview outcome line (tells the truth when nothing shows) — hooks BEFORE any early return (React rule: same hook order every render!)
  const [vstats, setVstats] = useState(null); // video funnel per source (starts/completes/clicks + invoice estimate!)
  useEffect(() => { api('/api/admin/ads/status').then(({ ok, data }) => { if (ok) setS(data); }); }, []); // mount-only probe (admin session already open — 401 impossible here!)
  useEffect(() => { api('/api/ads/stats').then(({ ok, data }) => { if (ok) setVstats(data); }); }, []); // earnings funnel (same mount — completions × rate = sponsor invoice!)
  if (!s) return <div className="card"><div className="skel" /></div>;
  const dot = (on) => (<span className={'pill ' + (on ? 'ok' : 'flag')} style={{ fontSize: 11 }}>{on ? 'Yes' : 'No'}</span>); // boolean → at-a-glance pill (no key values shown, ever!)
  async function preview() { // Preview button: bypass today's cap, then run the REAL interstitial path…
    setPreviewMsg('Checking…');
    clearSponsorSeen(); // bypass the once/day cap (preview-only; owners still capped)
    const st = await adsStatus(); // this browser's actual tier/tags (Pro session? empty config?)
    if (st.state === 'pro') { setPreviewMsg('No preview: THIS browser session is Pro/trial — ads serve to free-tier owners only. Log in as a free shop to preview.'); return; }
    if (!st.sponsor) { setPreviewMsg('No preview: sponsor not configured — set SPONSOR_TITLE + SPONSOR_LINK in .env and restart the server. Network tags (Monetag) still load for free users.'); return; }
    const shown = await maybeShowSponsor(); // real interstitial (same card owners see)
    setPreviewMsg(shown ? '' : 'Not shown: already previewed today or sponsor missing.');
  }
  async function previewVideo(only) { // Preview button: force the REAL 30s gate (cap bypassed, events still logged as slot=preview!)
    setPreviewMsg('Checking…');
    clearVideoSeen('preview'); // bypass the daily cap (preview-only!)
    const st = await adsStatus(); // Pro session? video config present?
    if (st.state === 'pro') { setPreviewMsg('No preview: THIS browser session is Pro/trial — video gates serve free-tier owners only. Log in as a free shop to preview.'); return; }
    const out = await maybeShowVideoAd({ slot: 'preview', force: true, only: only || null }); // only = fire ONE layer alone (isolated debugging!)
    setPreviewMsg(out === 'skipped-empty'
      ? 'No preview: nothing configured — set SPONSOR_VIDEO_URL or a network video zone, then restart.'
      : out === 'failed-all'
        ? 'Configured BUT dead: wrong URL shape (offer link pasted where a VAST/.js tag belongs?), zone still pending approval, or YOUR ad-blocker killed the player. Open devtools console → window.__lastVideoGate, then retest in Incognito with extensions off.'
        : `Preview done (${out}). Events logged under slot=preview.`);
  }
  return (
    <div className="card">
      <h2><Ic n="cash" s={18} /> Ad keys live?</h2>
      <p className="desc">Network ({s.provider1}): {dot(s.network1)} · Sponsor “{(s.sponsorTitle || '—')}”: {dot(s.sponsor)}{s.sponsor ? <> · Video: {dot(s.sponsorVideo)}</> : null} · Sponsor rate: ₦{s.rateNaira}/click</p>
      <p className="desc">Video gate — own mp4: {dot(s.sponsorVideo)} · HilltopAds: {dot(s.videoHilltopads)} · Monetag: {dot(s.videoMonetag)} · Order: <code>{s.videoOrder}</code> · ₦{s.rateViewNaira}/completed view</p>
      <p className="hint">{s.note}</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn ghost sm" onClick={preview}>Preview sponsor card</button>
        <button className="btn ghost sm" onClick={() => previewVideo()}>Preview 30s video gate</button>
        {previewMsg ? <span className="hint">{previewMsg}</span> : null}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <span className="hint">Test one layer alone:</span>
          {[['sponsor', 'Own mp4'], ['hilltopads', 'HilltopAds'], ['monetag', 'Monetag']].map(([id, label]) => (
          <button key={id} className="btn ghost sm" onClick={() => previewVideo(id)}>Only {label}</button>
        ))}
      </div>
      {vstats && Array.isArray(vstats.video) && vstats.video.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="hint" style={{ marginBottom: 6 }}>Video funnel by source (completions = invoice unit · est. this month: ₦{(vstats.estimate_video_month_naira || 0).toLocaleString()})</p>
          <div className="table-wrap"><table>
            <thead><tr><th>Source</th><th>Starts</th><th>Completes</th><th>Clicks</th><th>Rate</th></tr></thead>
            <tbody>
              {vstats.video.map((r) => (
                <tr key={r.source}>
                  <td><b>{r.source}</b></td><td>{r.starts}</td><td><b>{r.completes}</b></td><td>{r.clicks}</td>
                  <td><span className="hint">{r.starts ? Math.round(r.completes / r.starts * 100) + '%' : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, l, good }) { // tiny tile (local component — lowercase file, uppercase fn: still a component!)
  return <div className={'stat' + (good === false ? ' warn' : ' good')}><div className="num">{n}</div><div className="lbl">{l}</div></div>; // good=false → gold (needs attention), else green
}

function wavePath(vals) { // values → SVG polyline across the 355×64 hub card (area fills under it!)
  if (!vals.length) return 'M0,56 L355,56'; // no data yet → flat baseline (honest, never fake waves!)
  const max = Math.max(...vals, 1); // ||1 guards all-zero weeks (divide-by-zero → flat!)
  return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (vals.length - 1) * 355).toFixed(1)},${(56 - (v / max) * 44).toFixed(1)}`).join(' ');
}

function Stats({ d }) { // CONTROL HUB (docs/image_e1a38d81.jpg): liquid glass, teal glow, REAL numbers only.
  const [charts, setCharts] = useState(null); // { daily:[{day,chats}], monthly:[{m,ngn,usd}] } — null = loading (flat fallbacks!)
  const [ver, setVer] = useState(''); // app version (public endpoint — real!)
  useEffect(() => {
    api('/api/admin/charts').then(({ ok, data }) => { if (ok) setCharts(data); }).catch(() => {}); // fail → flat charts (numbers below still real!)
    api('/api/version').then(({ ok, data }) => { if (ok && data.version) setVer('v' + data.version); }).catch(() => {});
  }, []); // mount-only
  const ngn = '₦' + (Number(d.ngn_kobo || 0) / 100).toLocaleString();
  const usd = '$' + (Number(d.usd_cents || 0) / 100).toLocaleString();
  const daily = ((charts && charts.daily) || []).map((x) => Number(x.chats) || 0);
  const monthly = ((charts && charts.monthly) || []).map((x) => Number(x.ngn) || 0);
  const handled = d.today > 0 ? Math.round(((d.today - (d.flagged || 0)) / d.today) * 100) : null; // AI-handled % today (real — not "uptime"!)
  const peak = daily.length && Math.max(...daily) > 0 ? daily.indexOf(Math.max(...daily)) : -1; // busiest day gets the dot
  const mmax = Math.max(...monthly, 1);
  return (
    <div className="hub">
      <div className="hub-top">
        <div className="card hub-perf">
          <div className="hub-row"><span className="hub-title">App Performance</span><span className="hub-uptime">{handled === null ? '—' : handled + '%'}</span></div>
          <svg viewBox="0 0 355 64" className="hub-wave" preserveAspectRatio="none"><path d={wavePath(daily)} />{peak >= 0 && <circle cx={peak / (daily.length - 1) * 355} cy={56 - (daily[peak] / Math.max(...daily, 1)) * 44} r="3.5" />}</svg>
          <div className="hub-sub">Chats/day · 14 days · AI handled today</div>
        </div>
        <div className="card hub-active">
          <div className="hub-row"><span className="hub-title">Active Users</span><Ic n="profile" s={16} /></div>
          <div className="hub-big">{Number(d.users || 0).toLocaleString()}</div>
          <div className="hub-sub">total accounts</div>
        </div>
      </div>
      <div className="hub-head"><h2>Control Hub</h2><p>Platform Control Center</p></div>
      <div className="hub-grid">
        <div className="card hub-status">
          <div className="hub-row"><span className="hub-title">System Status</span><span className="hub-dots">•••</span></div>
          <div className="hub-tiles">
            <div className="hub-tile"><span>Chats today</span><b>{d.today || 0}</b></div>
            <div className="hub-tile"><span>Need you</span><b>{d.flagged || 0}</b></div>
            <div className="hub-tile"><span>Awaiting pay</span><b>{d.pending || 0}</b></div>
            <div className="hub-tile"><span>Open tickets</span><b>{d.complaints || 0}</b></div>
          </div>
          <div className="hub-line"><span>App version</span><span className="hub-auto">{ver || '…'}</span></div>
          <div className="hub-line"><span>Collected this month</span><span className="hub-auto">{'₦' + (Number(d.month_all || 0) / 100).toLocaleString()}</span></div>
          <button className="hub-deploy" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>Deploy Update <span>Broadcast</span></button>
        </div>
        <div className="hub-col">
          <div className="card hub-activity">
            <div className="hub-title">Recent Activity</div>
            <div className="hub-feed">
              <div><b>Recent users</b><span>Total {d.users} · {d.trialing} trialing</span><i>{new Date().toLocaleTimeString()}</i></div>
              <div><b>Server Scaling</b><span>{d.active} Pro active · {d.pending} pending</span><i>{new Date().toLocaleTimeString()}</i></div>
              <div><b>Threat Monitor</b><span>{d.complaints} open tickets</span><i>{new Date().toLocaleTimeString()}</i></div>
            </div>
          </div>
          <div className="hub-duo">
            <div className="card hub-threat"><span className="hub-title">Threat Monitor</span><div className="hub-big small">{d.complaints || 0} <span>threats</span></div><Ic n="shield" s={34} /></div>
            <div className="card hub-rev"><span className="hub-title">Revenue Metrics</span><div className="hub-big small">{ngn === '₦0' ? usd : ngn}</div><div className="hub-bars">{monthly.length ? monthly.map((v, i) => <i key={i} style={{ height: `${Math.max(10, Math.round((v / mmax) * 100))}%` }} title={`${(charts.monthly[i] && charts.monthly[i].m) || ''}: ₦${(v / 100).toLocaleString()}`} />) : [14, 26, 12, 20, 16, 30].map((h, i) => <i key={i} style={{ height: h }} />)}</div></div>
          </div>
        </div>
      </div>
      <div className="grid4" style={{ marginTop: 14 }}>
        <Stat n={d.users} l="Total users" />
        <Stat n={d.active} l="Pro active" />
        <Stat n={d.trialing} l="On trial" />
        <Stat n={d.pending} l="Awaiting payment" good={d.pending === 0 ? true : false} />
      </div>
      <div className="grid4" style={{ marginTop: 16 }}>
        <Stat n={ngn} l="Collected (NGN)" />
        <Stat n={usd} l="Collected (USD)" />
        <Stat n={d.today} l="Chats today" />
        <Stat n={d.complaints} l="Open tickets" good={d.complaints === 0} />
      </div>
      <p className="hint" style={{ marginTop: 16 }}>Collected = active payments only. Per-view ad money lives in your Monetag dashboard; per-click sponsor totals: Admin → Revenue uses /api/ads/stats with x-admin-key.</p>
    </div>
  );
}

function Users({ rows, refresh, act }) { // USERS: search + verify + inspect (200 newest)…
  const [q, setQ] = useState(''); // search draft (client-side filter — 200 rows filter instantly, no backend needed!)
  const list = rows.filter((u) => !q.trim() || (u.email + ' ' + (u.business_name || '') + ' ' + (u.whatsapp_number || '')).toLowerCase().includes(q.trim().toLowerCase())); // concatenate searchable fields, lowercase both sides (simple contains-search!)
  return (
    <div className="card">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, business, number…" style={{ marginBottom: 12 }} /> {/* live filter input (no button — types-as-you-type!) */}
      <div className="table-wrap"><table>
        <thead><tr><th>ID</th><th>User</th><th>Business</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {list.map((u, i) => ( // key={u.id} stable DB ids…
            <tr key={u.id} className="admin-row" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}> {/* staggered entrance (capped — 200 rows never wait long!) */}
              <td style={{ whiteSpace: 'nowrap' }}><span className="hint">#{u.business_id ?? '—'}</span></td> {/* shop ID (tester lists, notify targeting — backend already sends it!) */}
              <td><b>{u.email}</b> {isFresh(u.created_at) ? <span className="pill new">NEW</span> : null}<br /><span className="hint">{u.verified ? 'verified' : 'UNVERIFIED'} · {fmtDate(u.created_at)}</span></td> {/* NEW = signed up in the last 24h (fresh users pulse at you!) */}
              <td>{u.business_name || '—'}<br /><span className="hint">{u.whatsapp_number || ''} · {u.subscription_status || ''} {u.currency ? `(${u.currency})` : ''}</span></td> {/* shop + number + plan + currency */}
              <td>{!u.verified ? <button className="btn ghost sm" onClick={() => { if (confirm(`Verify ${u.email}?`)) act(`/api/admin/users/${u.id}/verify`, null, `${u.email} verified.`); }}>Verify</button> : <span className="pill ok">ok</span>}</td> {/* unverified → Verify button (confirm() guards mis-taps!); verified → green pill */}
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

function Revenue({ d }) { // REVENUE: collected totals + where transfer money sits (transfers tab acts on it)…
  return (
    <div className="card">
      <h2>Subscription revenue (ledger)</h2>
      <p className="desc">Active payments only — pending transfers count after approval.</p>
      <div className="grid3">
        <div className="stat good"><div className="num">₦{(Number(d.ngn_kobo || 0) / 100).toLocaleString()}</div><div className="lbl">NGN collected</div></div>
        <div className="stat good"><div className="num">${(Number(d.usd_cents || 0) / 100).toLocaleString()}</div><div className="lbl">USD collected</div></div>
        <div className="stat"><div className="num">₦{(Number(d.month_all || 0) / 100).toLocaleString()}</div><div className="lbl">This month (all)</div></div>
      </div>
      <p className="hint" style={{ marginTop: 16 }}>Per-click sponsor earnings: call <b>GET /api/ads/stats</b> with your admin key. Per-view network earnings: Monetag dashboard.</p>
    </div>
  );
}

function Transfers({ rows, act }) { // TRANSFERS: FIFO approval queue (empty = celebrated!)…
  if (!rows.length) return <div className="card"><div className="empty"><b>Queue clear</b>No pending transfers. Money verified as fast as it arrives.</div></div>; // empty state SELLS the calm (not just blank!)
  return (
    <div className="card">
      <p className="desc">Verify each claim against your bank statement: sender name + bank + reference must match a real credit of the exact plan amount. Approve only what you see in the account.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Who</th><th>Plan</th><th>Amount</th><th>Sender proof</th><th>Reported</th><th></th></tr></thead>
        <tbody>
          {rows.map((t, i) => ( // key={t.id} payment ids…
            <tr key={t.id} className="admin-row" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
              <td><b>{t.business_name || '—'}</b> {isFresh(t.created_at) ? <span className="pill new">NEW</span> : null}<br /><span className="hint">{t.email || ''} · {t.whatsapp_number || ''}</span></td> {/* NEW = reported in the last 24h (fresh money pulses!) */}
              <td>{t.plan} ({t.currency})<br /><span className="hint">{t.reference || ''}</span></td> {/* plan + audit tag */}
              <td><b>{money(t.amount / 100, t.currency)}</b></td> {/* minor→major units via money() (single formatter everywhere!) */}
              <td style={{ fontSize: 13 }}><b>{t.sender_name || '—'}</b><br /><span className="hint">{t.sender_bank || ''}{t.sender_ref ? ` · ref: ${t.sender_ref}` : ''}</span></td>
              <td><span className="hint">{fmtDate(t.created_at)}</span></td>
              <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => { if (confirm(`Approve ${t.plan} for ${t.business_name}? Only if ₦ matches in your statement.`)) act(`/api/admin/transfers/${t.id}/approve`, null, 'Plan activated.'); }}>Approve</button> <button className="btn ghost sm" onClick={() => { if (confirm(`Reject transfer from ${t.business_name}?`)) act(`/api/admin/transfers/${t.id}/reject`, null, 'Transfer rejected.'); }}>Reject</button></td> {/* confirm() on BOTH (money moves on click — mis-taps cost real days!); nowrap keeps buttons together */}
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

function Channels({ rows, refresh }) { // LIFELINES: live-probed per load (green = a message right now would arrive!)
  const pill = (ok) => ok === null ? <span className="pill">—</span> : ok ? <span className="pill ok">live</span> : <span className="pill off">dead</span>; // null = not connected (no pill color earned!)
  const dead = rows.filter((r) => (r.meta_on && r.meta_ok === false) || (r.tg_on && r.tg_ok === false));
  return (
    <div className="card">
      <div className="card-head"><h2>Channel lifelines</h2><span className="hint">{rows.length} shops · {dead.length} need you</span><button className="btn ghost sm" onClick={refresh}>Re-probe</button></div>
      <p className="desc">Probed live on every load (Telegram hook + Meta token, 8s cap each). Dead rows already got an owner bell if the shop was active in the last 30 days.</p>
      {rows.length === 0 ? <div className="empty"><b>All quiet</b>No shop has connected a channel yet.</div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Shop</th><th>WhatsApp</th><th>Telegram</th><th>Meta token</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="admin-row" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                <td><b>{r.name || '—'}</b><br /><span className="hint">{r.whatsapp_number || ''}</span></td>
                <td>{r.wa_live ? <span className="pill ok">live</span> : <span className="pill flag">never</span>}<br /><span className="hint">{r.wa_last ? fmtDate(r.wa_last) : 'no inbound yet'}</span></td>
                <td>{!r.tg_on ? <span className="pill">off</span> : <>{pill(r.tg_ok)}{r.tg_pending > 0 && <><br /><span className="hint">{r.tg_pending} queued</span></>}{r.tg_err && <><br /><span className="hint">{r.tg_err.slice(0, 60)}</span></>}</>}</td>
                <td>{!r.meta_on ? <span className="pill">off</span> : <>{pill(r.meta_ok)}{r.meta_ok === false && r.meta_reason && <><br /><span className="hint">{r.meta_reason === 'token-dead' ? 'token dead (24h temp?)' : r.meta_reason}</span></>}</>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

function Referrals({ d, act, refresh }) { // REFERRALS: airtime queue (pay!) + monthly leaderboard (crown!) + every referrer (watch!)
  const naira = (kobo) => '₦' + (Number(kobo || 0) / 100).toLocaleString(); // minor → major (ledger stores kobo!)
  async function grantPlus(bizId, name) { // monthly champion → free Plus month (confirm: it grants REAL plan time!)
    if (!confirm(`Grant a FREE Plus month to ${name}?`)) return;
    const { ok, data } = await api('/api/admin/referrals/grant-plus', { method: 'POST', body: JSON.stringify({ business_id: bizId }) });
    if (ok) { pop('ok', 'Champion crowned!', `${name} got a free Plus month.`); refresh(); }
    else pop('err', 'Failed', (data && data.error) || 'Try again.');
  }
  return (
    <>
      <div className="card" style={{ borderColor: 'var(--gold-line)' }}>
        <h2><Ic n="cash" s={18} /> Airtime to send ({d.pending.length})</h2>
        <p className="desc">Every 5th paying referral earns ₦500 airtime. Buy the card yourself, send it to their number, then tap Sent — the referrer gets a bell.</p>
        {d.pending.length === 0 ? <p className="hint">Queue clear — nobody owed right now.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Who</th><th>Amount</th><th>Why</th><th></th></tr></thead>
            <tbody>
              {d.pending.map((p, i) => (
                <tr key={p.id} className="admin-row" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                  <td><b>{p.name || '—'}</b> {isFresh(p.created_at) ? <span className="pill new">NEW</span> : null}<br /><span className="hint">{p.whatsapp_number || p.owner_number || ''} · {fmtDate(p.created_at)}</span></td> {/* NEW = fresh referral payout (new referrer money pulses!) */}
                  <td><b>{naira(p.amount)}</b></td>
                  <td><span className="hint">{p.note || ''}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => { if (confirm(`Mark ${naira(p.amount)} airtime SENT to ${p.name}? Only after the card is delivered!`)) act(`/api/admin/referrals/${p.id}/sent`, null, 'Marked sent — referrer notified.'); }}>Mark sent</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      <div className="card">
        <h2><Ic n="chart" s={18} /> This month's leaderboard</h2>
        <p className="desc">Paying referrals per referrer, this month. Crown the winner with a free Plus month.</p>
        {d.leaders.length === 0 ? <p className="hint">No paying referrals yet this month.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Referrer</th><th>Code</th><th>Paying</th><th></th></tr></thead>
            <tbody>
              {d.leaders.map((l, i) => (
                <tr key={l.id}>
                  <td><b>{i + 1}</b></td>
                  <td><b>{l.name || '—'}</b></td>
                  <td><code>{l.referral_code || '—'}</code></td>
                  <td><b>{l.paying}</b></td>
                  <td>{i === 0 ? <button className="btn ghost sm" onClick={() => grantPlus(l.id, l.name)}>Grant Plus month</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      <div className="card">
        <h2>All referrers</h2>
        <p className="desc">Invited → active = connected or chatted (earned days) → paying (earn airtime). Watch for clusters sharing one number (fraud smell!).</p>
        {d.overview.length === 0 ? <p className="hint">No referrers yet — share your own code to seed it.</p> : (
          <div className="table-wrap"><table>
                  <thead><tr><th>Referrer</th><th>Code</th><th>Invited</th><th>Active</th><th>Paying</th><th>Days</th><th>Airtime</th></tr></thead>
            <tbody>
              {d.overview.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name || '—'}</b><br /><span className="hint">{r.whatsapp_number || ''}</span></td>
                  <td><code>{r.referral_code || '—'}</code></td>
                  <td>{r.invited}</td>
                  <td>{r.qualified}</td>
                  <td><b>{r.paying}</b></td>
                  <td>{r.days_granted}d</td>
                  <td><span className="hint">{naira(r.airtime_sent)} sent{naira(r.airtime_due) !== '₦0' ? ` · ${naira(r.airtime_due)} due` : ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

function Complaints({ rows, act }) { // COMPLAINTS: open-first tickets with inline reply box…
  const [replying, setReplying] = useState(null); // ticket id with open reply box (null = none; ONE box at a time!)
  const [text, setText] = useState(''); // reply draft (shared state — one box means one draft is fine!)
  async function send(id) { // submit reply…
    if (!text.trim()) return toast('Write a reply first', 'err'); // guard: blank replies
    await act(`/api/admin/complaints/${id}/reply`, { reply: text.trim() }, 'Reply sent + emailed.'); // act() pops + reloads (list shows "answered" instantly!)
    setReplying(null); setText(''); // close box + clear draft (fresh for next ticket!)
  }
  return (
    <div className="qa-list">
      {rows.length === 0 && <div className="card"><div className="empty"><b>No complaints</b>Silence is golden — or nobody found the form yet.</div></div>} {/* && empty state (honest humor, zero dev-talk!) */}
      {rows.map((c, i) => ( // key={c.id} ticket ids…
        <div key={c.id} className="card admin-row" style={{ animationDelay: `${Math.min(i * 60, 420)}ms` }}>
          <div className="card-head"><h2><Ic n="help" s={16} /> {c.subject || 'Support request'}</h2><span>{isFresh(c.created_at) && c.status === 'open' ? <span className="pill new">NEW</span> : null} <span className={'pill ' + (c.status === 'open' ? 'flag' : c.status === 'answered' ? 'info' : 'ok')}>{c.status}</span></span></div> {/* NEW = fresh open ticket (pulse at you!); status pill: gold open / blue answered / green resolved */}
          <p className="hint">{c.business_name || ''} · {c.whatsapp_number || ''} · {fmtDate(c.created_at)}</p> {/* who + when (triage context!) */}
          <p style={{ marginTop: 8 }}>{c.body}</p> {/* the complaint itself */}
          {c.reply && <div className="learn-box light" style={{ fontFamily: 'var(--font)', marginTop: 8 }}><b>Your reply:</b> {c.reply}</div>} {/* && conditional: past reply shown (no double-answering blind!) */}
          {replying === c.id ? ( // reply box open for THIS ticket?…
            <>
              <label style={{ marginTop: 16 }}>Reply (also emailed to the owner)</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows="3" placeholder="Hi! Here's the fix…" />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn sm" onClick={() => send(c.id)}><Ic n="send" s={16} />Send reply</button>
                <button className="btn ghost sm" onClick={() => { setReplying(null); setText(''); }}>Cancel</button>
              </div>
            </>
          ) : ( // …else action row (Reply opens box; Resolve closes without reply)…
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn ghost sm" onClick={() => { setReplying(c.id); setText(''); }}>Reply</button>
              {c.status !== 'resolved' && <button className="btn ghost sm" onClick={() => act(`/api/admin/complaints/${c.id}/resolve`, null, 'Ticket resolved.')}>Resolve</button>} {/* && conditional: resolved tickets hide Resolve (can't double-resolve!) */}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
