// ── frontend/src/pages/Admin.jsx ──────────────────────────────────
// WHAT: YOUR private console (direct URL /admin only — NOT in the sidebar, so
// owners never stumble in). Password gate → tabs: Overview (stats), Users
// (search + verify), Revenue (payments ledger), Transfers (approve/reject),
// Complaints (reply/resolve). All session-authed (server checks isAdmin).
// React patterns: gate state, tab state, per-tab loaders, confirm() on
// destructive actions, pop() confirmations, fmt helpers for money/dates.
import { useEffect, useState } from 'react';
import { api, fmtDate, pop, toast } from '../lib/api.js';
import { money } from '../lib/money.js';
import Ic from '../components/icons.jsx';

const TABS = [['stats', 'Overview', 'chart'], ['users', 'Users', 'profile'], ['revenue', 'Revenue', 'card'], ['transfers', 'Transfers', 'send'], ['complaints', 'Complaints', 'help']]; // [key, label, icon] triples (icons at fixed 16px per the icon system!)

export default function Admin() {
  const [gate, setGate] = useState('checking'); // 'checking' | 'locked' | 'open' (three gate states — never flash the console to strangers!)
  const [pw, setPw] = useState(''); // password draft (controlled input, never stored beyond this submit!)
  const [tab, setTab] = useState('stats'); // active tab key
  const [d, setD] = useState(null); // tab data (shape depends on tab — single state, reused!)

  async function check() { // probe: are we already admin? (reload-safe: session persists!)
    const { ok } = await api('/api/admin/stats'); // stats = cheapest authed probe (any 401 → locked!)
    setGate(ok ? 'open' : 'locked'); // ok → straight in (no password re-entry after reload!)
    if (ok) load('stats'); // auto-load first tab (gate open + empty = fetch now!)
  }
  useEffect(() => { check(); }, []); // [] = mount-only probe

  async function login() { // password submit…
    if (!pw) return toast('Enter the admin password', 'err'); // guard: blank submit
    const { ok, data } = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) }); // session.isAdmin set server-side on success…
    setPw(''); // clear the field EITHER way (never leave a password in the DOM!)
    if (ok) { setGate('open'); load('stats'); toast('Welcome back, boss.'); } // …in → load first tab (toast, not pop — minor moment!)
    else toast(data.error || 'Wrong password', 'err'); // generic backend message (never leaks config state!)
  }

  async function load(t) { // tab loader: one endpoint per tab (switch re-fetches = always fresh!)…
    setTab(t); setD(null); // set tab + null data (null renders skeletons — consistent loading UX!)
    const urls = { stats: '/api/admin/stats', users: '/api/admin/users', revenue: '/api/admin/stats', transfers: '/api/admin/transfers', complaints: '/api/admin/complaints' }; // tab → endpoint map (revenue reuses stats + payments list below? stats covers totals; transfers tab shows the money ACTIONS)
    const { ok, data } = await api(urls[t]); // fetch…
    if (ok) setD(data); // …store (array or object — panels branch on tab, not shape!)
    else toast(data.error || 'Load failed', 'err'); // session expired mid-use → toast (re-login via reload → gate re-checks!)
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

  return ( // CONSOLE (gate open)…
    <>
      <div className="page-head"><div className="row" style={{ width: '100%' }}><div><h1>Admin console</h1><p>Private — users, revenue, transfers, complaints. No owner ever sees this page.</p></div><button className="btn ghost sm" onClick={async () => { await api('/api/admin/logout', { method: 'POST' }); setGate('locked'); }}>Sign out</button></div></div>
      <div className="card"> {/* tab bar (icons at 16px + labels, active solid / rest ghost) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(([k, l, ic]) => ( // destructure triples; icon + label per tab…
            <button key={k} className={'btn sm ' + (tab === k ? '' : 'ghost')} onClick={() => load(k)}><Ic n={ic} s={16} />{l}</button>
          ))}
        </div>
      </div>
      {!d ? <div className="card"><div className="skel" /></div> : tab === 'stats' ? <Stats d={d} /> // null → skeleton; else panel per tab (ternary chain!)
        : tab === 'users' ? <Users rows={d} refresh={() => load('users')} act={act} />
        : tab === 'revenue' ? <Revenue d={d} />
        : tab === 'transfers' ? <Transfers rows={d} act={act} />
        : <Complaints rows={d} act={act} />}
      <Broadcast act={act} /> {/* always mounted: announce updates to every bell */}
      <WarnUser act={act} /> {/* always mounted: warn ONE user straight to their bell */}
      <AdsStatus /> {/* always mounted: are the Render ad keys live? (booleans only) */}
    </>
  );
}

function Broadcast({ act }) { // APP UPDATES: one broadcast → every owner's bell…
  const [t, setT] = useState('');
  const [b, setB] = useState('');
  async function send() {
    if (!t.trim()) return toast('Give the update a title', 'err');
    await act('/api/admin/broadcast', { title: t.trim(), body: b.trim(), link: '/dashboard' }, 'Update sent to every inbox.');
    setT(''); setB('');
  }
  return (
    <div className="card" style={{ borderColor: 'var(--gold-line)' }}>
      <h2><Ic n="mega" s={18} /> Broadcast app update</h2>
      <p className="desc">Title + 1–2 lines → lands in every owner's notification bell instantly. Use after each release.</p>
      <label>Title</label>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="e.g. Smarter Vendora AI is live" maxLength={120} />
      <label>What changed (1–2 lines)</label>
      <textarea value={b} onChange={(e) => setB(e.target.value)} rows="2" placeholder="e.g. Fuller answers, Lite default, no more scroll jump…" maxLength={500} />
      <button className="btn" style={{ marginTop: 10 }} onClick={send}><Ic n="send" s={16} />Send to all bells</button>
    </div>
  );
}

function WarnUser({ act }) { // ONE user, not all: a warning/notice → their bell only…
  const [who, setWho] = useState(''); // business ID, account email, or WhatsApp number (server resolves all three)
  const [t, setT] = useState('');
  const [b, setB] = useState('');
  async function send() {
    if (!who.trim()) return toast('Say who — email, business ID, or WhatsApp number', 'err');
    if (!t.trim()) return toast('Give the warning a title', 'err');
    await act('/api/admin/notify', { business_id: /^\d+$/.test(who.trim()) ? Number(who.trim()) : undefined, email: who.includes('@') ? who.trim() : undefined, whatsapp_number: !/^\d+$/.test(who.trim()) && !who.includes('@') ? who.trim() : undefined, title: t.trim(), body: b.trim(), link: '/dashboard' }, 'Warning sent to their bell.');
    setWho(''); setT(''); setB('');
  }
  return (
    <div className="card" style={{ borderColor: 'var(--red-line)' }}>
      <h2><Ic n="warn" s={18} /> Warn one user</h2>
      <p className="desc">Lands in that owner's notification bell only (web + phone app, within a minute). Use for payment issues, abuse, or personal notices.</p>
      <label>Who (email, business ID, or WhatsApp number)</label>
      <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. amaka@shop.com · 12 · 0803 123 4567" />
      <label>Title</label>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="e.g. Payment issue — action needed" maxLength={120} />
      <label>Message (1–3 lines)</label>
      <textarea value={b} onChange={(e) => setB(e.target.value)} rows="2" placeholder="e.g. Your card payment of ₦7,499 didn't complete — tap Billing to retry, or reply here for help…" maxLength={500} />
      <button className="btn danger" style={{ marginTop: 10 }} onClick={send}><Ic n="send" s={16} />Send warning</button>
    </div>
  );
}

function AdsStatus() { // AD KEYS LIVE? booleans only — key VALUES never leave the server…
  const [s, setS] = useState(null); // null = loading (skeleton first — same habit as tabs!)
  useEffect(() => { api('/api/admin/ads/status').then(({ ok, data }) => { if (ok) setS(data); }); }, []); // mount-only probe (admin session already open — 401 impossible here!)
  if (!s) return <div className="card"><div className="skel" /></div>;
  const dot = (on) => (<span className={'pill ' + (on ? 'ok' : 'flag')} style={{ fontSize: 11 }}>{on ? 'Yes' : 'No'}</span>); // boolean → at-a-glance pill (no key values shown, ever!)
  return (
    <div className="card">
      <h2><Ic n="cash" s={18} /> Ad keys live?</h2>
      <p className="desc">Network 1 ({s.provider1}): {dot(s.network1)} · Network 2 ({s.provider2}): {dot(s.network2)} · Sponsor “{(s.sponsorTitle || '—')}”: {dot(s.sponsor)}{s.sponsor ? <> · Video: {dot(s.sponsorVideo)}</> : null} · Sponsor rate: ₦{s.rateNaira}/click</p>
      <p className="hint">{s.note}</p>
    </div>
  );
}

function Stat({ n, l, good }) { // tiny tile (local component — lowercase file, uppercase fn: still a component!)
  return <div className={'stat' + (good === false ? ' warn' : ' good')}><div className="num">{n}</div><div className="lbl">{l}</div></div>; // good=false → gold (needs attention), else green
}

function Stats({ d }) { // OVERVIEW: users, tiers, money, activity, tickets (reads the merged adminStats object!)
  return (
    <>
      <div className="grid4">
        <Stat n={d.users} l="Total users" />
        <Stat n={d.active} l="Pro active" />
        <Stat n={d.trialing} l="On trial" />
        <Stat n={d.pending} l="Awaiting payment" good={d.pending === 0 ? true : false} /> {/* pending>0 = gold (money waiting on YOU!) */}
      </div>
      <div className="grid4" style={{ marginTop: 16 }}>
        <Stat n={'₦' + (Number(d.ngn_kobo || 0) / 100).toLocaleString()} l="Collected (NGN)" /> {/* minor units ÷ 100 (kobo→naira; integers in DB, pretty in UI!) */}
        <Stat n={'$' + (Number(d.usd_cents || 0) / 100).toLocaleString()} l="Collected (USD)" />
        <Stat n={d.today} l="Chats today" />
        <Stat n={d.complaints} l="Open tickets" good={d.complaints === 0} /> {/* open>0 = gold (someone needs YOU!) */}
      </div>
      <p className="hint" style={{ marginTop: 16 }}>Collected = active payments only. Per-view ad money lives in your Monetag/Adsterra dashboards; per-click sponsor totals: Admin → Revenue uses /api/ads/stats with x-admin-key.</p> {/* honest scope note (where each Naira is counted!) */}
    </>
  );
}

function Users({ rows, refresh, act }) { // USERS: search + verify + inspect (200 newest)…
  const [q, setQ] = useState(''); // search draft (client-side filter — 200 rows filter instantly, no backend needed!)
  const list = rows.filter((u) => !q.trim() || (u.email + ' ' + (u.business_name || '') + ' ' + (u.whatsapp_number || '')).toLowerCase().includes(q.trim().toLowerCase())); // concatenate searchable fields, lowercase both sides (simple contains-search!)
  return (
    <div className="card">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, business, number…" style={{ marginBottom: 12 }} /> {/* live filter input (no button — types-as-you-type!) */}
      <div className="table-wrap"><table>
        <thead><tr><th>User</th><th>Business</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {list.map((u) => ( // key={u.id} stable DB ids…
            <tr key={u.id}>
              <td><b>{u.email}</b><br /><span className="hint">{u.verified ? 'verified' : 'UNVERIFIED'} · {fmtDate(u.created_at)}</span></td> {/* verified flag + signup date (support context!) */}
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
      <p className="hint" style={{ marginTop: 16 }}>Per-click sponsor earnings: call <b>GET /api/ads/stats</b> with your admin key. Per-view network earnings: Monetag/Adsterra dashboards.</p>
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
          {rows.map((t) => ( // key={t.id} payment ids…
            <tr key={t.id}>
              <td><b>{t.business_name || '—'}</b><br /><span className="hint">{t.email || ''} · {t.whatsapp_number || ''}</span></td> {/* who + contacts (verify the credit against THESE!) */}
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
      {rows.map((c) => ( // key={c.id} ticket ids…
        <div key={c.id} className="card">
          <div className="card-head"><h2><Ic n="help" s={16} /> {c.subject || 'Support request'}</h2><span className={'pill ' + (c.status === 'open' ? 'flag' : c.status === 'answered' ? 'info' : 'ok')}>{c.status}</span></div> {/* status pill: gold open / blue answered / green resolved */}
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
