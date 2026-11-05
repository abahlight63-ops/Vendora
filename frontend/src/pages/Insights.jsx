// ── frontend/src/pages/Insights.jsx ──────────────────────────────
// WHAT: the shop's numbers, laid out like the approved design: a 7 or 14 day
// switch, a channel filter (All, WhatsApp, Telegram, Messenger, Instagram), four
// headline numbers, chats each day (today in coral), who answered, busiest hours
// (peak in coral), why customers needed you, customers going quiet, and a
// by-channel split.
// DATA: crunches /api/me/conversations client-side, so every number is real shop
// history. A chat with no channel saved is a WhatsApp chat (the first channel).
// Nothing is invented: a channel with no chats says so.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { describeLoadFailure, describeNetError } from '../lib/netDetail.js';
import LoadFailed from '../components/LoadFailed.jsx';
import { CHANNEL_COINS } from '../lib/channelLogos.js';

const DAY = 86400000;
const CHANS = [
  ['all', 'All channels'],
  ['whatsapp', 'WhatsApp'],
  ['telegram', 'Telegram'],
  ['messenger', 'Messenger'],
  ['instagram', 'Instagram'],
];
const chanOf = (x) => x.channel || 'whatsapp';
function dayKey(t) {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString('en-GB', { hour: 'numeric', hour12: true }).toUpperCase();
let coinN = 0;
function Coin({ id, s = 22 }) {
  coinN += 1;
  const n = coinN;
  return <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHANNEL_COINS[id].replace(/(msg-g|ig-g)/g, '$1-i' + n) }} />;
}

function crunch(all, span) {
  const now = Date.now();
  const days = [...Array(span)].map((_, i) => { const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() - (span - 1 - i)); return t; });
  const start = new Date(days[0]); start.setHours(0, 0, 0, 0);
  const when = (x) => new Date(x.updated_at || x.created_at || 0);
  const c = all.filter((x) => { const t = when(x); return !Number.isNaN(t.getTime()) && t >= start; });
  const needs = c.filter((x) => x.needs_human);
  const reasons = {};
  needs.forEach((x) => { const r = (x.flag_reason || 'Other').slice(0, 60); reasons[r] = (reasons[r] || 0) + 1; });
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const vol = days.map(() => 0);
  const hours = new Array(24).fill(0);
  c.forEach((x) => {
    const t = when(x);
    hours[t.getHours()] += 1;
    const i = days.findIndex((dd) => dayKey(dd) === dayKey(t));
    if (i >= 0) vol[i] += 1;
  });
  // this period against the one before it, from the same list
  const prevStart = new Date(start.getTime() - span * DAY);
  const prev = all.filter((x) => { const t = when(x); return t >= prevStart && t < start; }).length;
  const delta = prev > 0 ? Math.round(((c.length - prev) / prev) * 100) : null;
  const peakH = hours.indexOf(Math.max(...hours));
  const quiet = all
    .map((x) => ({ ...x, days: Math.floor((now - when(x).getTime()) / DAY) }))
    .filter((x) => x.days >= 7)
    .sort((a, b) => b.days - a.days);
  const waiting = all.filter((x) => x.needs_human && !x.owner_replied_at).length;
  return {
    total: c.length,
    needs: needs.length,
    waiting,
    rate: c.length ? Math.round(((c.length - needs.length) / c.length) * 100) : 0,
    top, vol, hours, delta, peakH,
    labels: days.map((t) => t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
    quiet,
    bands: {
      cooling: quiet.filter((x) => x.days < 14).length,
      cold: quiet.filter((x) => x.days >= 14 && x.days < 30).length,
      lost: quiet.filter((x) => x.days >= 30).length,
    },
  };
}

export default function Insights() {
  const [raw, setRaw] = useState(null);
  const [failed, setFailed] = useState(null);
  const [tries, setTries] = useState(0);
  const [span, setSpan] = useState(14);
  const [chan, setChan] = useState('all');
  const [showQuiet, setShowQuiet] = useState(false);

  useEffect(() => {
    let dead = false;
    setFailed(null);
    (async () => {
      try {
        const { ok, status, data } = await api('/api/me/insights-chats', { timeout: 20000 });
        if (dead) return;
        if (!ok) { setFailed({ status, detail: describeLoadFailure({ status, error: data }) }); return; }
        setRaw(Array.isArray(data) ? data : []);
      } catch { if (!dead) setFailed({ status: 0, detail: describeNetError() }); }
    })();
    const onOnline = () => { if (!dead) setTries((t) => t + 1); };
    window.addEventListener('online', onOnline);
    return () => { dead = true; window.removeEventListener('online', onOnline); };
  }, [tries]);

  const picked = useMemo(() => (raw || []).filter((x) => chan === 'all' || chanOf(x) === chan), [raw, chan]);
  const d = useMemo(() => (raw ? crunch(picked, span) : null), [raw, picked, span]);
  const byChan = useMemo(() => {
    const out = { whatsapp: 0, telegram: 0, messenger: 0, instagram: 0 };
    if (raw && d) {
      const start = Date.now() - span * DAY;
      raw.forEach((x) => { const t = new Date(x.updated_at || x.created_at || 0).getTime(); if (t >= start && out[chanOf(x)] != null) out[chanOf(x)] += 1; });
    }
    return out;
  }, [raw, d, span]);

  const head = (
    <div className="in-head">
      <div>
        <div className="dg-status on"><i />Last {span} days{chan !== 'all' ? ` · ${CHANS.find((c) => c[0] === chan)[1]}` : ''}</div>
        <h1>Insights</h1>
        <p>What customers ask, what Velo handles, and who needs you.</p>
      </div>
      <div className="wx-pills" role="group" aria-label="Time range">
        {[7, 14, 30].map((n) => <button key={n} type="button" className={'wx-pill' + (span === n ? ' on' : '')} aria-pressed={span === n} onClick={() => setSpan(n)}>{n} days</button>)}
      </div>
    </div>
  );
  const filter = (
    <div className="wx-pills in-chans" role="group" aria-label="Channel">
      {CHANS.map(([k, label]) => (
        <button key={k} type="button" className={'wx-pill' + (chan === k ? ' on' : '')} aria-pressed={chan === k} onClick={() => setChan(k)}>
          {k !== 'all' && <Coin id={k} />}{label}{k !== 'all' && raw ? <span className="in-count">{byChan[k]}</span> : null}
        </button>
      ))}
    </div>
  );

  if (failed && !raw) return (<>{head}<LoadFailed title="Couldn't load insights" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setRaw(null); setTries((t) => t + 1); }} backTo="/dashboard" backLabel="Back to Home" /></>);
  if (!d) return (
    <>
      {head}
      <div className="skel-grid cols4">{[0, 1, 2, 3].map((i) => (<div key={i} className="skel-card"><div className="skel" style={{ width: '55%', height: 26 }} /><div className="skel" style={{ width: '80%' }} /></div>))}</div>
      <div className="card" style={{ marginTop: 16 }}><div className="skel" style={{ height: 150 }} /></div>
    </>
  );

  const vmax = Math.max(...d.vol, 1);
  const hmax = Math.max(...d.hours, 1);
  const rmax = Math.max(...d.top.map(([, n]) => n), 1);
  const chName = CHANS.find((c) => c[0] === chan)[1];
  const totalBy = Object.values(byChan).reduce((a, b) => a + b, 0) || 1;
  const ring = 2 * Math.PI * 22;

  return (
    <div className="in">
      {head}
      {filter}
      {d.total === 0 ? (
        <section className="glass in-card in-empty">
          <b>{chan === 'all' ? 'No chats yet' : `No ${chName} chats in the last ${span} days`}</b>
          <span>{chan === 'messenger' || chan === 'instagram' ? `${chName} is coming soon. Its numbers will show here once it launches.` : 'Charts build themselves from your conversations. Share your number and come back.'}</span>
          {chan !== 'all' && <button type="button" className="btn ghost" onClick={() => setChan('all')}>Show all channels</button>}
        </section>
      ) : (
        <>
          <div className="in-kpis">
            <section className="glass in-kpi"><span>Chats</span><b>{d.total}</b>{d.delta == null ? <em className="ch-chip ready">New this period</em> : <em className={'in-delta ' + (d.delta >= 0 ? 'up' : 'down')}><strong>{d.delta >= 0 ? '▲' : '▼'} {Math.abs(d.delta)}%</strong><small>vs previous {span} days</small></em>}</section>
            <section className="glass in-kpi"><span>Answered by Velo</span><b>{d.rate}%</b><em className="ch-chip live">{d.total - d.needs} of {d.total}</em></section>
            <section className="glass in-kpi"><span>Needed you</span><b>{d.needs}</b><em className="ch-chip hot">{d.waiting ? `${d.waiting} waiting now` : 'None waiting'}</em></section>
            <section className="glass in-kpi"><span>Busiest hour</span><b>{hourLabel(d.peakH)}</b><em className="ch-chip ready">Plan to be online</em></section>
          </div>

          <div className="in-row2">
            <section className="glass in-card">
              <div className="in-card-head"><h2>Chats each day</h2><span>Coral is today</span></div>
              <div className="in-bars tall" role="img" aria-label={`Chats each day: ${d.vol.join(', ')}`}>
                {d.vol.map((v, i) => <i key={i} className={i === d.vol.length - 1 ? 'hot' : ''} style={{ height: `${Math.max(3, Math.round((v / vmax) * 100))}%` }} title={`${d.labels[i]}: ${v}`} />)}
              </div>
              <div className="in-axis"><span>{d.labels[0]}</span><span>{d.labels[Math.floor(span / 2)]}</span><span>Today</span></div>
            </section>
            <section className="glass in-card">
              <div className="in-card-head"><h2>Who answered</h2></div>
              <div className="in-who">
                <div className="in-ring">
                  <svg viewBox="0 0 56 56" width="170" height="170" aria-hidden="true">
                    <defs><linearGradient id="in-rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F3FC7" /><stop offset="1" stopColor="#D03C16" /></linearGradient></defs>
                    <circle cx="28" cy="28" r="22" fill="none" stroke="var(--ring-track)" strokeWidth="7" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke="url(#in-rg)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(d.rate / 100) * ring} ${ring}`} transform="rotate(-90 28 28)" />
                  </svg>
                  <b>{d.rate}%</b>
                </div>
                <div className="in-legend">
                  <span><i className="v" /><b>{d.total - d.needs}</b> by Velo</span>
                  <span><i className="y" /><b>{d.needs}</b> by you</span>
                </div>
              </div>
            </section>
          </div>

          <div className="in-row3">
            <section className="glass in-card">
              <div className="in-card-head"><h2>Busiest hours</h2></div>
              <div className="in-bars thin" role="img" aria-label={`Busiest at ${hourLabel(d.peakH)}`}>
                {d.hours.map((v, i) => <i key={i} className={i === d.peakH && v > 0 ? 'hot' : ''} style={{ height: `${Math.max(3, Math.round((v / hmax) * 100))}%` }} title={`${hourLabel(i)}: ${v}`} />)}
              </div>
              <div className="in-axis"><span>Midnight</span><span>Noon</span><span>11 PM</span></div>
            </section>
            <section className="glass in-card">
              <div className="in-card-head"><h2>Why customers needed you</h2></div>
              {d.top.length === 0 ? <p className="in-muted">Nothing yet. When Velo is unsure, the reason shows here.</p> : (
                <div className="in-reasons">
                  {d.top.map(([r, n]) => (
                    <div key={r}><div><span>{r}</span><b>{n}</b></div><div className="pu-meter in-thin"><i style={{ width: `${Math.max(6, Math.round((n / rmax) * 100))}%` }} /></div></div>
                  ))}
                </div>
              )}
            </section>
            <section className="glass in-card">
              <div className="in-card-head"><h2>Customers going quiet</h2></div>
              <div className="in-quiet">
                <div><b>{d.bands.cooling}</b><span className="ch-chip ready">Cooling</span></div>
                <div><b>{d.bands.cold}</b><span className="ch-chip hot">Cold</span></div>
                <div><b>{d.bands.lost}</b><span className="ch-chip hot">Lost</span></div>
              </div>
              <button type="button" className="btn ghost in-msg" disabled={!d.quiet.length} aria-expanded={showQuiet} onClick={() => setShowQuiet(!showQuiet)}>{d.quiet.length ? (showQuiet ? 'Hide the list' : 'Message them') : 'Nobody has gone quiet'}</button>
            </section>
          </div>

          {showQuiet && d.quiet.length > 0 && (
            <section className="glass in-card">
              <div className="in-card-head"><h2>Quiet for a week or more</h2><span>Nudge opens WhatsApp with a message you can edit</span></div>
              <div className="in-qlist">
                {d.quiet.slice(0, 8).map((x) => {
                  const digits = String(x.customer_number || '').replace(/[^0-9]/g, '');
                  const first = String(x.customer_name || '').split(' ')[0] || 'there';
                  const asked = (x.last_message || '').slice(0, 60);
                  const msg = `Hello ${first}! Just checking in${asked ? `, you asked about "${asked}"` : ''}. Want me to send the latest price and photos?`;
                  return (
                    <div key={x.id} className="in-qrow">
                      <span className="in-qmain"><b>{x.customer_name || x.customer_number || 'Customer'}</b><small>{(x.last_message || '').slice(0, 70)}</small></span>
                      <span className={'ch-chip ' + (x.days >= 14 ? 'hot' : 'ready')}>{x.days} days</span>
                      {digits.length >= 8 && chanOf(x) === 'whatsapp'
                        ? <a className="btn sm" href={`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Nudge</a>
                        : <Link className="btn ghost sm" to="/chats">Open chat</Link>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <section className="glass in-card in-by">
        <div className="in-by-coins">{['whatsapp', 'telegram', 'messenger', 'instagram'].map((k) => <Coin key={k} id={k} s={40} />)}</div>
        <div className="in-by-main">
          <b>By channel</b>
          <span>{['whatsapp', 'telegram', 'messenger', 'instagram'].map((k) => `${CHANS.find((c) => c[0] === k)[1]} ${byChan[k]}`).join(' · ')}</span>
        </div>
        <div className="in-by-bar" role="img" aria-label="Chats by channel">
          {['whatsapp', 'telegram', 'messenger', 'instagram'].map((k) => byChan[k] > 0 && <i key={k} className={k} style={{ width: `${(byChan[k] / totalBy) * 100}%` }} />)}
        </div>
      </section>
    </div>
  );
}
