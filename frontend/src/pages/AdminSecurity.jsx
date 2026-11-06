// ── frontend/src/pages/AdminSecurity.jsx ───────────────────────────
// WHAT: admin console → Security. Two views:
//   Suspicious activity — wrong passwords, account lockouts, blocked
//     cross-site requests, fake webhooks, rate limits, admin sign-ins
//     (from /api/admin/console/security). Serious ones are emailed too.
//   Payment check — every recent payment next to its plan's price
//     (from /api/admin/console/payments), short ones flagged.
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Ic from '../components/icons.jsx';
import { when } from '../lib/orders.js';

function useLoad(url, deps = []) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const run = () => { setErr(''); api(url, { timeout: 20000 }).then(({ ok, data, status }) => { if (ok) setD(data); else setErr(status === 401 ? 'Your admin session ended. Sign in again.' : (data && data.error) || 'Could not load.'); }).catch(() => setErr('Could not load. Check your connection.')); };
  useEffect(run, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return [d, err, run];
}
const Skel = ({ h = 120 }) => <div className="skel" style={{ height: h, borderRadius: 24 }} />;
const Fail = ({ msg, retry }) => <div className="ad-card ad-fail"><b>{msg}</b><button type="button" className="btn ghost" onClick={retry}>Try again</button></div>;
const Kpi = ({ label, value, sub, tone }) => <div className="ad-kpi"><span>{label}</span><b>{value}</b>{sub ? <small className={tone || ''}>{sub}</small> : null}</div>;

const WORDS = {
  admin_login_failed: 'Wrong admin password', admin_key_failed: 'Wrong admin key', payment_mismatch: 'Payment did not match its price', account_locked: 'Account locked after wrong attempts',
  login_failed: 'Wrong password or code', cross_site_blocked: 'Blocked request from another website', webhook_rejected: 'Fake or unsigned webhook', rate_limited: 'Too many requests',
  admin_login: 'Admin signed in', password_reset_requested: 'Password reset asked for', password_changed: 'Password changed',
};
const TONE = { high: 'coral', medium: 'gold', info: 'violet' };
const money = (minor, cur) => (cur === 'USD' ? '$' : '₦') + (Number(minor || 0) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 });

export default function AdminSecurity() {
  const [days, setDays] = useState(7);
  const [view, setView] = useState('activity');
  const [kind, setKind] = useState('');
  const [d, err, retry] = useLoad('/api/admin/console/security?days=' + days, [days]);
  const [p, perr, pretry] = useLoad('/api/admin/console/payments', []);
  if (err) return <Fail msg={err} retry={retry} />;
  const events = d ? d.events.filter((e) => !kind || e.kind === kind) : [];
  const flagged = p ? (p.counts.short || 0) + (p.counts.check || 0) : 0;
  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <div className={'dg-status' + (d && d.last24.high ? '' : ' on')}><i />{!d ? 'Checking' : d.last24.high ? `${d.last24.high} serious event${d.last24.high === 1 ? '' : 's'} in the last 24 hours` : 'Nothing serious in the last 24 hours'}</div>
          <h1>Security</h1>
          <p>Wrong passwords, blocked attacks, fake webhooks and payments that do not match their price. Serious ones are also emailed to you.</p>
        </div>
        <div className="wx-pills" role="group" aria-label="Period">{[[1, 'Today'], [7, '7 days'], [30, '30 days']].map(([k, l]) => <button key={k} type="button" className={'wx-pill' + (days === k ? ' on' : '')} aria-pressed={days === k} onClick={() => setDays(k)}>{l}</button>)}</div>
      </div>
      <div className="wx-pills" role="group" aria-label="Show">
        <button type="button" className={'wx-pill' + (view === 'activity' ? ' on' : '')} aria-pressed={view === 'activity'} onClick={() => setView('activity')}>Suspicious activity</button>
        <button type="button" className={'wx-pill' + (view === 'payments' ? ' on' : '')} aria-pressed={view === 'payments'} onClick={() => setView('payments')}>Payment check{flagged ? ` · ${flagged} to look at` : ''}</button>
      </div>

      {view === 'activity' ? (!d ? <Skel h={260} /> : (<>
        <div className="ad-kpis">
          <Kpi label="Serious (24h)" value={d.last24.high} tone={d.last24.high ? 'warn' : 'good'} sub={d.last24.high ? 'Read them below' : 'All quiet'} />
          <Kpi label="Warnings (24h)" value={d.last24.medium} sub="Wrong passwords, blocks" />
          {d.kinds.slice(0, 2).map((k) => <Kpi key={k.kind} label={WORDS[k.kind] || k.kind} value={k.n} sub={`in ${d.days} day${d.days === 1 ? '' : 's'}`} />)}
        </div>
        {d.ips.length > 0 && (
          <section className="ad-card">
            <b className="sec-title">Busiest suspicious addresses</b>
            {d.ips.map((x) => <div key={x.ip} className="ad-log"><span className="ad-ic coral"><Ic n="shield" s={16} /></span><div><b>{x.ip}</b><small>{x.kinds}</small></div><small>{x.n} event{x.n === 1 ? '' : 's'}<br />last {when(x.last)}</small></div>)}
          </section>
        )}
        <section className="ad-card">
          <div className="wx-pills sec-kinds" role="group" aria-label="Filter">
            <button type="button" className={'wx-pill' + (!kind ? ' on' : '')} onClick={() => setKind('')}>All</button>
            {d.kinds.map((k) => <button key={k.kind} type="button" className={'wx-pill' + (kind === k.kind ? ' on' : '')} onClick={() => setKind(k.kind)}>{WORDS[k.kind] || k.kind} {k.n}</button>)}
          </div>
          {events.length === 0 ? <p className="ad-note">Nothing recorded in this period.</p> : events.map((e) => (
            <div key={e.id} className="ad-log">
              <span className={'ad-ic ' + (TONE[e.level] || 'violet')}><Ic n={e.level === 'info' ? 'check' : 'warn'} s={16} /></span>
              <div><b>{WORDS[e.kind] || e.kind}</b><small>{[e.shop, e.detail, e.path].filter(Boolean).join(' · ')}</small></div>
              <small>{when(e.created_at)}<br />{e.ip}</small>
            </div>
          ))}
        </section>
      </>)) : (perr ? <Fail msg={perr} retry={pretry} /> : !p ? <Skel h={260} /> : (<>
        <div className="ad-kpis">
          <Kpi label="Paid in full" value={p.counts.ok || 0} tone="good" />
          <Kpi label="Short payments" value={p.counts.short || 0} tone={p.counts.short ? 'warn' : 'good'} sub={p.counts.short ? 'Look at these' : 'None'} />
          <Kpi label="To check" value={p.counts.check || 0} tone={p.counts.check ? 'warn' : 'good'} sub="Unknown plan or repeated reference" />
          <Kpi label="By credit or by hand" value={(p.counts.credit || 0) + (p.counts.manual || 0)} />
        </div>
        <section className="ad-card">
          <b className="sec-title">Prices the server charges today</b>
          <p className="ad-note">{Object.values(p.prices).map((x) => `${x.label}: ₦${Number(x.NGN).toLocaleString()} or $${x.USD}`).join(' · ')}</p>
        </section>
        <section className="ad-card">
          {p.rows.length === 0 ? <p className="ad-note">No payments yet.</p> : p.rows.map((r) => (
            <div key={r.id} className="ad-log">
              <span className={'ad-ic ' + (r.verdict === 'ok' ? 'green' : r.verdict === 'short' || r.verdict === 'check' ? 'coral' : 'violet')}><Ic n={r.verdict === 'ok' ? 'check' : r.verdict === 'credit' ? 'gift' : r.verdict === 'manual' ? 'hand' : 'warn'} s={16} /></span>
              <div><b>{r.shop || 'Shop ' + r.business_id} · {money(r.amount, r.currency)}</b><small>{r.plan} · {r.method}{r.expected ? ` · price ${money(r.expected, r.currency)}` : ''} · {r.note}</small></div>
              <small>{when(r.created_at)}<br />{String(r.reference || '').slice(0, 18)}</small>
            </div>
          ))}
        </section>
      </>))}
    </div>
  );
}
