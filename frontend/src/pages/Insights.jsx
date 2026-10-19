// ── frontend/src/pages/Insights.jsx ──────────────────────────────
// WHAT: analytics with forex-style charts — KPI strip, 14-day chat volume
// (line chart), AI-vs-you donut, resolution sparkline, 24h peak-hours bars,
// the INACTIVITY RECORD (customers who have gone quiet, banded by how long,
// with a one-tap WhatsApp nudge) and flag reasons as horizontal bars (the
// money chart: fix these catalog gaps → AI handles more → fewer lost sales).
// DATA: crunches /api/me/conversations client-side (100 latest — buckets by
// updated_at day/hour, so every pixel is REAL shop history). Nothing invented.
import { useEffect, useState } from 'react'; // useState = stats object; useEffect = fetch+crunch on mount
import { Link } from 'react-router-dom'; // deep-links (flag card → inbox!)

import { api } from '../lib/api.js'; // conversations fetch

import { describeLoadFailure, describeNetError } from '../lib/netDetail.js'; // one voice for load failures
import LoadFailed from '../components/LoadFailed.jsx'; // branded failed card + Retry (never eternal dashes!)
import { ForexChart, Spark } from '../components/Chart.jsx'; // forex line + sparkline (zero deps!)

function dayKey(t) { // local YYYY-MM-DD (toISOString is UTC — would bucket wrong near midnight!)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

const DAY = 86400000; // one day in ms (used for the quiet-customer bands)

export default function Insights() { // no props (self-sufficient)
  const [d, setD] = useState(null); // null = loading (skeletons); object = crunched stats
  const [failed, setFailed] = useState(null); // null | { status, detail } — fetch failure (Retry card, never eternal dashes!)
  const [tries, setTries] = useState(0); // retry counter (forces reload — no page refresh!)
  useEffect(() => {
    let dead = false; // unmount guard (slow networks + fast navigation!)
    setFailed(null);
    (async () => { // async IIFE (effects can't be async)
      try {
        const { ok, status, data: convos } = await api('/api/me/conversations', { timeout: 15000 }); // raw chat list (same endpoint as inbox!)
        if (dead) return;
        if (!ok) { setFailed({ status, detail: describeLoadFailure({ status, error: convos }) }); return; } // 401/session/server → failed card (empty state is for genuinely-empty shops!)
        const c = convos || []; // || [] guards null (failed fetch → empty stats, not crash!)
        const needs = c.filter((x) => x.needs_human); // flagged subset (the interesting ones!)
        const reasons = {}; // plain OBJECT as frequency map: {reasonText: count}
        needs.forEach((x) => { const r = (x.flag_reason || 'Other').slice(0, 60); reasons[r] = (reasons[r] || 0) + 1; });
        const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5); // leaderboard (sort DESC, top 5!)
        const days = [...Array(14)].map((_, i) => { const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() - (13 - i)); return t; }); // noon-anchored (DST-safe!)
        const perDay = days.map(() => ({ total: 0, needs: 0 }));
        const hours = new Array(24).fill(0); // peak-hours histogram (0–23!)
        c.forEach((x) => {
          const t = new Date(x.updated_at || x.created_at || Date.now());
          if (Number.isNaN(t.getTime())) return;
          const h = t.getHours();
          if (h >= 0 && h < 24) hours[h] += 1;
          const k = dayKey(t);
          const i = days.findIndex((dd) => dayKey(dd) === k); // 14-long scan per chat (100 max — trivial!)
          if (i >= 0) { perDay[i].total += 1; if (x.needs_human) perDay[i].needs += 1; }
        });
        const vol = perDay.map((p) => p.total); // chats/day series (forex line!)
        let carry = 100; // resolution trend (carry-forward over quiet days — no fake 100% spikes!)
        const res = perDay.map((p) => { if (p.total > 0) carry = Math.round(((p.total - p.needs) / p.total) * 100); return carry; });
        const labels = days.map((t) => t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
        const last7 = vol.slice(7).reduce((a, b) => a + b, 0), prev7 = vol.slice(0, 7).reduce((a, b) => a + b, 0);
        const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : (last7 > 0 ? 100 : 0); // week-over-week % (prev 0 + new chats = +100%!)
        const peakH = hours.indexOf(Math.max(...hours));
        const activeDays = perDay.filter((p) => p.total > 0).length; // how many of the 14 days actually had a conversation
        // ── the inactivity record ─────────────────────────────────────
        // "Quiet for N days" is measured from the customer's last message, not
        // from when we fetched. 7 days is the first honest warning: that buyer
        // has stopped asking, and they were not told no — they just drifted.
        const now = Date.now();
        const quiet = c
          .map((x) => {
            const t = new Date(x.updated_at || x.created_at || 0);
            if (Number.isNaN(t.getTime())) return null;
            return { ...x, days: Math.max(0, Math.floor((now - t.getTime()) / DAY)) };
          })
          .filter((x) => x && x.days >= 7)
          .sort((a, b) => b.days - a.days);
        const bands = {
          cooling: quiet.filter((x) => x.days < 14).length, // 7–13 days: still warm
          cold: quiet.filter((x) => x.days >= 14 && x.days < 30).length, // 14–29: needs a reason to return
          lost: quiet.filter((x) => x.days >= 30).length, // 30+: win-back, not support
        };
        setD({ total: c.length, needs: needs.length, rate: c.length ? Math.round(((c.length - needs.length) / c.length) * 100) : 100, top, vol, res, labels, hours, delta, last7, peakH, activeDays, quiet: quiet.slice(0, 6), quietTotal: quiet.length, bands });
      } catch { if (!dead) setFailed({ status: 0, detail: describeNetError() }); } // network down → failed card (empty state is for genuinely-empty shops!)
    })(); // invoke immediately
    const onOnline = () => { if (!dead) setTries((t) => t + 1); }; // internet's back? reload without a tap! (failed-only would also do — tries refetch is idempotent anyway)
    window.addEventListener('online', onOnline);
    return () => { dead = true; window.removeEventListener('online', onOnline); };
  }, [tries]); // [tries] = Retry bumps → refetch
  if (failed && !d) return ( // fetch failed BEFORE first paint (failed card, never skeletons!)
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>
      <LoadFailed title="Couldn't load insights" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setD(null); setTries((t) => t + 1); }} backTo="/dashboard" backLabel="Back to Overview" />
    </>
  );
  if (!d) return ( // LOADING: skeleton chart mirroring the real layout
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>
      <div className="skel-grid cols4">{[0, 1, 2, 3].map((i) => (<div key={i} className="skel-card"><div className="skel" style={{ width: '55%', height: 26 }} /><div className="skel" style={{ width: '80%' }} /></div>))}</div>
      <div className="card" style={{ marginTop: 16 }}><div className="skel" style={{ height: 150 }} /></div>
    </>
  );
  if (d.total === 0) return ( // EMPTY: honest onboarding (not blank!)
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>
      <div className="card"><div className="empty"><b>No chats yet</b>Charts build themselves from your first conversations — share your WhatsApp number and come back.</div></div>
    </>
  );
  const maxReason = Math.max(...d.top.map(([, n]) => n), 1);
  const hmax = Math.max(...d.hours, 1);
  const up = d.delta >= 0;
  const quietPct = d.total ? Math.round((d.quietTotal / d.total) * 100) : 0; // share of conversations that went quiet
  return (
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>

      {/* ── KPI strip: the four numbers an owner checks first ───────── */}
      <div className="ins-kpis">
        <div className="ins-kpi"><span className="ins-kpi-lbl">Total chats</span><b className="ins-kpi-num">{d.total}</b><span className="ins-kpi-sub">{d.activeDays} active of 14 days</span></div>
        <div className="ins-kpi"><span className="ins-kpi-lbl">Resolved by AI</span><b className="ins-kpi-num good">{d.rate}%</b><span className="ins-kpi-sub">{d.total - d.needs} chats answered alone</span></div>
        <div className="ins-kpi"><span className="ins-kpi-lbl">Needed you</span><b className="ins-kpi-num warn">{d.needs}</b><span className="ins-kpi-sub">Flagged for a human</span></div>
        <div className="ins-kpi"><span className="ins-kpi-lbl">Gone quiet</span><b className="ins-kpi-num">{d.quietTotal}</b><span className="ins-kpi-sub">{quietPct}% silent for 7+ days</span></div>
      </div>

      <div className="ins-top">
        <div className="card"> {/* 14-day volume — the forex card */}
          <div className="fx-head">
            <div><span className="fx-pair">CHATS · 14D</span><div className="fx-big">{d.total}<small> total</small></div></div>
            <span className={'pill ' + (up ? 'ok' : 'flag')}>{up ? '▲' : '▼'} {Math.abs(d.delta)}% <span className="hint">vs prior wk</span></span>
          </div>
          <ForexChart values={d.vol} labels={d.labels} />
          <p className="hint" style={{ marginTop: 8 }}>{d.last7} chats in the last 7 days · peak activity {String(d.peakH).padStart(2, '0')}:00.</p>
        </div>

        <div className="card"> {/* who actually answered — the reference's donut, with real counts */}
          <div className="card-head"><h2>Who answered</h2></div>
          <div className="ins-donut-wrap">
            <div className="ins-donut" style={{ background: `conic-gradient(var(--green) ${d.rate * 3.6}deg, var(--purple-line) 0)` }}>
              <div className="ins-donut-hole"><b>{d.rate}%</b><span>by AI</span></div>
            </div>
            <div className="ins-legend">
              <div className="ins-leg"><i className="ai" /><span>Answered by Velo</span><b>{d.total - d.needs}</b></div>
              <div className="ins-leg"><i className="you" /><span>Passed to you</span><b>{d.needs}</b></div>
            </div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>Every flagged chat is in your inbox — answering it teaches the AI.</p>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}> {/* resolution spark + peak hours (side by side, stack on phones!) */}
        <div className="card">
          <div className="card-head"><h2>AI resolution</h2><span className="hint">{d.rate}% handled</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
            <Spark values={d.res} width={150} height={52} />
            <p className="desc" style={{ margin: 0 }}>Daily trend, 14 days. Dips = days the AI needed you more.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Peak hours</h2><span className="hint">{String(d.peakH).padStart(2, '0')}:00 rush</span></div>
          <div className="pbars" style={{ marginTop: 10 }}>{d.hours.map((v, i) => <i key={i} style={{ height: `${Math.max(6, Math.round((v / hmax) * 100))}%` }} title={`${String(i).padStart(2, '0')}:00 — ${v} chats`} />)}</div>
          <p className="hint" style={{ marginTop: 6 }}>00 → 23. Your customers' clock — staff the rush.</p>
        </div>
      </div>

      {/* ── INACTIVITY RECORD: who stopped talking, and how long ago ─── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Inactivity record</h2><span className="hint">{d.quietTotal} quiet</span></div>
        <p className="desc">Customers whose last message is 7 days old or more. A quiet customer is not a lost one — most just need a reason to come back.</p>
        <div className="ins-bands">
          <span className="ins-band"><i className="b1" /><b>{d.bands.cooling}</b><span>Cooling · 7–13 days</span></span>
          <span className="ins-band"><i className="b2" /><b>{d.bands.cold}</b><span>Cold · 14–29 days</span></span>
          <span className="ins-band"><i className="b3" /><b>{d.bands.lost}</b><span>Lost · 30+ days</span></span>
        </div>
        {d.quiet.length === 0 ? (
          <div className="empty"><b>Nobody has gone quiet</b>Every conversation here is under a week old. That is a healthy shop.</div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Customer</th><th>Quiet for</th><th>Their last message</th><th></th></tr></thead>
              <tbody>
                {d.quiet.map((x) => {
                  const digits = String(x.customer_number || '').replace(/[^0-9]/g, ''); // wa.me wants digits only
                  const first = String(x.customer_name || '').split(' ')[0] || 'there'; // first name only — it is a shop, not a bank
                  const asked = (x.last_message || '').slice(0, 60); // quote them back: that is what makes a nudge feel personal
                  const msg = `Hello ${first}! Just checking in${asked ? ` — you asked about “${asked}”` : ''}. Want me to send the latest price and photos?`;
                  return (
                    <tr key={x.id}>
                      <td><b>{x.customer_name || x.customer_number || 'Customer'}</b></td>
                      <td><span className={'pill ' + (x.days >= 30 ? 'off' : x.days >= 14 ? 'flag' : 'info')}>{x.days} days</span></td>
                      <td><span className="ins-quote">{(x.last_message || '—').slice(0, 70)}{(x.last_message || '').length > 70 ? '…' : ''}</span></td>
                      <td className="ins-act">
                        {digits.length >= 8
                          ? <a className="mini-link" href={`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Nudge</a>
                          : <Link className="mini-link" to="/chats">Open inbox</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginTop: 10 }}>Counted from your {d.total} most recent conversations. Nudge opens WhatsApp with a message you can edit before sending.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Top reasons humans were needed</h2></div>
        <p className="desc">Fix these in your catalog or FAQs and the AI handles more alone.</p>
        {d.top.length === 0 ? <div className="empty"><b>No flags yet</b>When the AI is unsure, the reason shows up here.</div> : (
          <div className="hbars" style={{ marginTop: 10 }}>
            {d.top.map(([r, n]) => (
              <div key={r} className="hbar"><span>{r}</span><div className="hbar-track"><i style={{ width: `${Math.max(4, Math.round((n / maxReason) * 100))}%` }} /></div><b>{n}</b></div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
