// ── frontend/src/pages/Insights.jsx ──────────────────────────────
// WHAT: analytics-lite — totals, AI-resolution %, and TOP flag reasons
// (the money chart: fix these catalog gaps → AI handles more → fewer lost sales).
// No backend aggregation endpoint: crunches /api/me/conversations client-side
// (100 rows max — trivial for the browser, saves us an API).
import { useEffect, useState } from 'react'; // useState = stats object; useEffect = fetch+crunch on mount
import { api } from '../lib/api.js'; // conversations fetch

export default function Insights() { // no props (self-sufficient)
  const [d, setD] = useState(null); // null = loading (skeletons + '—' placeholders); object = {total, needs, rate, top[]}
  useEffect(() => {
    (async () => { // async IIFE (effects can't be async)
      const { data: convos } = await api('/api/me/conversations'); // raw chat list (same endpoint as inbox!)
      const c = convos || []; // || [] guards null (failed fetch → empty stats, not crash!)
      const needs = c.filter((x) => x.needs_human); // flagged subset (the interesting ones!)
      const reasons = {}; // plain OBJECT as frequency map: {reasonText: count} (JS objects = cheap hash maps!)
      needs.forEach((x) => { const r = (x.flag_reason || 'Other').slice(0, 60); reasons[r] = (reasons[r] || 0) + 1; }); // forEach (no return needed): normalize reason (|| 'Other', cap 60 chars) → increment (|| 0 handles first sighting!)
      const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5); // Object.entries → [[reason,count]…]; .sort DESC by count (b[1]-a[1]); slice(0,5) = top 5 (sort-then-slice = leaderboard pattern!)
      setD({ total: c.length, needs: needs.length, rate: c.length ? Math.round(((c.length - needs.length) / c.length) * 100) : 100, top }); // rate = % AI-handled (ternary guards divide-by-zero → 100 when empty)
    })(); // invoke immediately
  }, []); // [] = mount-only
  return (
    <>
      <div className="page-head"><div><h1>Insights</h1><p>What customers ask, what the AI nails, and where you lose money.</p></div></div>
      <div className="grid3"> {/* 3 stat tiles (d ? value : '—' = loading dashes — skeletons would also work, dashes are cheaper here) */}
        <div className="stat good"><div className="num">{d ? d.total : '—'}</div><div className="lbl">Total chats</div></div> {/* div (not Link): display-only tiles (contrast with Dashboard's clickable stats!) */}
        <div className="stat good"><div className="num">{d ? d.rate + '%' : '—'}</div><div className="lbl">Resolved by AI</div></div>
        <div className="stat warn"><div className="num">{d ? d.needs : '—'}</div><div className="lbl">Needed human</div></div> {/* warn = gold (needs attention!) */}
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Top reasons humans were needed</h2>
        <p className="desc">Fix these in your catalog or FAQs and the AI handles more alone.</p> {/* the ACTIONABLE insight (data → advice!) */}
        {!d ? <div className="skel" /> : d.top.length === 0 ? <div className="empty"><b>No flags yet</b>When the AI is unsure, the reason shows up here.</div> : // trilogy: loading bar → empty state → table
          <div className="table-wrap"><table><thead><tr><th>Reason</th><th>Count</th></tr></thead><tbody>
            {d.top.map(([r, n], i) => (<tr key={i}><td>{r}</td><td><span className="pill flag">{n}</span></td></tr>))} {/* destructure [reason, count] pairs; key={i} OK (static snapshot); count in gold pill */}
          </tbody></table></div>}
      </div>
    </>
  );
}
