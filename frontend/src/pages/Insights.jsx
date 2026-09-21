// ── frontend/src/pages/Insights.jsx ──────────────────────────────
// WHAT: analytics with forex-style charts — 14-day chat-volume line chart
// (live-dot head, min/max grid, day labels), AI-resolution sparkline,
// 24h peak-hours bars, and flag reasons as horizontal bars (the money
// chart: fix these catalog gaps → AI handles more → fewer lost sales).
// DATA: crunches /api/me/conversations client-side (100 latest — buckets
// by updated_at day/hour, so every pixel is REAL shop history).
import { useEffect, useState } from 'react'; // useState = stats object; useEffect = fetch+crunch on mount
import { Link } from 'react-router-dom'; // deep-links (flag card → inbox!)
import { api } from '../lib/api.js'; // conversations fetch
import { ForexChart, Spark } from '../components/Chart.jsx'; // forex line + sparkline (zero deps!)

function dayKey(t) { // local YYYY-MM-DD (toISOString is UTC — would bucket wrong near midnight!)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export default function Insights() { // no props (self-sufficient)
  const [d, setD] = useState(null); // null = loading (skeletons); object = crunched stats (never stuck: catch → empty!)
  useEffect(() => {
    (async () => { // async IIFE (effects can't be async)
      try {
        const { ok, data: convos } = await api('/api/me/conversations'); // raw chat list (same endpoint as inbox!)
        if (!ok) { setD({ empty: true }); return; } // 401/session → empty state, not eternal dashes!
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
        setD({ total: c.length, needs: needs.length, rate: c.length ? Math.round(((c.length - needs.length) / c.length) * 100) : 100, top, vol, res, labels, hours, delta, last7, peakH });
      } catch { setD({ empty: true }); } // network down → empty state (never eternal dashes!)
    })(); // invoke immediately
  }, []); // [] = mount-only
  if (!d) return ( // LOADING: skeleton chart mirroring the real layout
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>
      <div className="skel-grid cols4">{[0, 1, 2, 3].map((i) => (<div key={i} className="skel-card"><div className="skel" style={{ width: '55%', height: 26 }} /><div className="skel" style={{ width: '80%' }} /></div>))}</div>
      <div className="card" style={{ marginTop: 16 }}><div className="skel" style={{ height: 150 }} /></div>
    </>
  );
  if (d.empty || d.total === 0) return ( // EMPTY: honest onboarding (not blank!)
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>
      <div className="card"><div className="empty"><b>No chats yet</b>Charts build themselves from your first conversations — share your WhatsApp number and come back.</div></div>
    </>
  );
  const maxReason = Math.max(...d.top.map(([, n]) => n), 1);
  const hmax = Math.max(...d.hours, 1);
  const up = d.delta >= 0;
  return (
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>
      <div className="card"> {/* forex header: pair name + big figure + week delta pill (live-market feel!) */}
        <div className="fx-head">
          <div><span className="fx-pair">CHATS · 14D</span><div className="fx-big">{d.total}<small> total</small></div></div>
          <span className={'pill ' + (up ? 'ok' : 'flag')}>{up ? '▲' : '▼'} {Math.abs(d.delta)}% <span className="hint">vs prior wk</span></span>
        </div>
        <ForexChart values={d.vol} labels={d.labels} />
        <p className="hint" style={{ marginTop: 8 }}>{d.last7} chats in the last 7 days · peak activity {String(d.peakH).padStart(2, '0')}:00.</p>
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
      <div className="grid4" style={{ marginTop: 16 }}> {/* stat tiles (kept — glanceable totals!) */}
        <div className="stat good"><div className="num">{d.total}</div><div className="lbl">Total chats</div></div>
        <div className="stat good"><div className="num">{d.rate + '%'}</div><div className="lbl">Resolved by AI</div></div>
        <div className="stat warn"><div className="num">{d.needs}</div><div className="lbl">Needed human</div></div>
        <div className="stat"><div className="num">{d.last7}</div><div className="lbl">Last 7 days</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Top reasons humans were needed</h2><Link className="mini-link" to="/chats">Open inbox</Link></div>
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
