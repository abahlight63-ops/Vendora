// ── frontend/src/pages/AdminFeatures.jsx ───────────────────────────
// WHAT: admin console → App functions. Every function of the app, grouped:
// is it set up, is anyone using it, and what to do when something is missing.
// Data: GET /api/admin/console/features?days= (read-only on the server).
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Ic from '../components/icons.jsx';

const STATUS = {
  working: ['Working', 'af-working', 'check'],
  idle: ['Not used yet', 'af-idle', 'clock'],
  setup: ['Needs setup', 'af-setup', 'warn'],
  off: ['Not live yet', 'af-off', 'lock'],
};
const FILTERS = [['all', 'All'], ['setup', 'Needs setup'], ['working', 'Working'], ['idle', 'Not used yet'], ['off', 'Not live yet']];

export default function AdminFeatures() {
  const [days, setDays] = useState(7);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const load = () => {
    setErr('');
    api('/api/admin/console/features?days=' + days, { timeout: 30000 })
      .then(({ ok, data, status }) => { if (ok) setD(data); else setErr(status === 401 ? 'Your admin session ended. Sign in again.' : (data && data.error) || 'Could not load.'); })
      .catch(() => setErr('Could not load. Check your connection.'));
  };
  useEffect(load, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="ad-card ad-fail"><b>{err}</b><button type="button" className="btn ghost" onClick={load}>Try again</button></div>;
  const needle = q.trim().toLowerCase();
  const list = d ? d.list.filter((f) => (filter === 'all' || f.status === filter) && (!needle || (f.name + ' ' + f.what + ' ' + f.group).toLowerCase().includes(needle))) : [];
  const groups = [...new Set(list.map((f) => f.group))];
  const c = (d && d.counts) || {};
  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <div className={'dg-status' + (c.setup ? '' : ' on')}><i />{!d ? 'Checking every function' : c.setup ? `${c.setup} function${c.setup === 1 ? '' : 's'} need${c.setup === 1 ? 's' : ''} a setting` : 'Everything that is live is set up'}</div>
          <h1>App functions</h1>
          <p>Every part of VeloSales: whether it is set up, whether shops use it, and what to do when something is missing. Settings are checked by name only; values are never shown.</p>
        </div>
        <div className="wx-pills" role="group" aria-label="Period">{[[1, 'Today'], [7, '7 days'], [30, '30 days']].map(([k, l]) => <button key={k} type="button" className={'wx-pill' + (days === k ? ' on' : '')} aria-pressed={days === k} onClick={() => { setD(null); setDays(k); }}>{l}</button>)}</div>
      </div>

      <div className="ad-kpis">
        {['working', 'setup', 'idle', 'off'].map((k) => (
          <button key={k} type="button" className={'ad-kpi af-kpi' + (filter === k ? ' on' : '')} onClick={() => setFilter(filter === k ? 'all' : k)}>
            <span>{STATUS[k][0]}</span><b>{d ? c[k] || 0 : '–'}</b><small>{k === 'setup' ? 'Fix these first' : k === 'off' ? 'Coming soon or not running' : k === 'idle' ? 'Ready, waiting for shops' : 'Set up and being used'}</small>
          </button>
        ))}
      </div>

      <div className="af-tools">
        <div className="wx-pills af-pills" role="group" aria-label="Show">{FILTERS.map(([k, l]) => <button key={k} type="button" className={'wx-pill' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
        <label className="od-search"><Ic n="search" s={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a function" aria-label="Find a function" /></label>
      </div>

      {!d ? <div className="skel" style={{ height: 320, borderRadius: 24 }} /> : list.length === 0 ? <div className="ad-card"><p className="ad-note">Nothing matches.</p></div> : groups.map((g) => (
        <section key={g} className="af-group">
          <h2 className="af-gtitle">{g}</h2>
          <div className="af-grid">
            {list.filter((f) => f.group === g).map((f) => {
              const [label, cls, ic] = STATUS[f.status] || STATUS.idle;
              return (
                <article key={f.key} className={'ad-card af-card ' + cls}>
                  <div className="af-top"><b>{f.name}</b><span className="af-chip"><Ic n={ic} s={13} />{label}</span></div>
                  <p className="af-what">{f.what}</p>
                  {f.numbers.length > 0 && <dl className="af-nums">{f.numbers.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v == null ? '–' : v}</dd></div>)}</dl>}
                  {f.hint && <p className="af-hint"><Ic n={f.status === 'setup' ? 'warn' : 'help'} s={15} />{f.hint}</p>}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {d && <p className="ad-note af-foot">Server version {d.server.version || '–'} · running for {d.server.uptimeHours} hours · Node {d.server.node}. Numbers cover the last {d.days === 1 ? 'day' : d.days + ' days'} unless they say "all time" or "now".</p>}
    </div>
  );
}
