// ── frontend/src/pages/ReferEarn.jsx ──────────────────────────────
// WHAT: the full Refer & Earn page (the Dashboard card is just the teaser!).
// Hero with YOUR code + share buttons, the 3 rewards explained, live funnel,
// milestone progress, payout history, this month's leaderboard.
// DATA: /api/me/referral (stats) + /api/me/referral/extra (history+leaders).
// React patterns: parallel fetch, clipboard-with-fallback, progress math.
import { useEffect, useState } from 'react'; // useState = stats/extra/copied; useEffect = load-once
import { Link } from 'react-router-dom'; // back-to-dashboard link
import { api, toast } from '../lib/api.js'; // api() calls; toast() copy feedback
import Ic from '../components/icons.jsx'; // gift/check/send icons

const naira = (kobo) => '₦' + (Number(kobo || 0) / 100).toLocaleString(); // minor → major (ledger stores kobo!)

export default function ReferEarn() {
  const [s, setS] = useState(null); // myStats (code, funnel, earnings!) — null = loading
  const [x, setX] = useState(null); // extra (history + leaders!) — null = loading
  const [copied, setCopied] = useState(''); // which button ticked ('code' | 'link' | '')
  useEffect(() => { // mount: both endpoints fly in parallel (no await between!)
    api('/api/me/referral').then(({ ok, data }) => { if (ok) setS(data); });
    api('/api/me/referral/extra').then(({ ok, data }) => { if (ok) setX(data); });
  }, []); // [] = mount-only
  async function copy(text, which) { // clipboard with legacy fallback (older browsers / permissions!)
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
    setCopied(which); setTimeout(() => setCopied(''), 2000); // tick 2s (then back!)
    toast('Copied — go share it!');
  }
  if (!s) return <div className="page"><div className="card"><div className="skel" /></div></div>; // loading → skeleton (stats drive everything below!)
  const link = window.location.origin + '/login?ref=' + encodeURIComponent(s.code); // share link (Login prefills + validates!)
  const text = `I use Vendora — my WhatsApp shop answers customers 24/7, even at 2am. Start free with my code ${s.code} (we BOTH get ${s.quizDays} Pro days free): ${link}`;
  const pct = Math.min(100, Math.round((s.paying % s.milestoneEvery) / s.milestoneEvery * 100)); // milestone fill (resets each 5-pack!)
  const kindName = (k) => k === 'pro_days' ? 'Pro days' : k === 'airtime' ? 'Airtime' : k === 'plus_month' ? 'Plus month' : k; // payout kind → human words
  return (
    <div className="page">
      <div className="page-head"><div><h1>Refer & Earn</h1><p>Invite sellers, you both win. No caps on inviting.</p></div><Link className="mini-link" to="/dashboard">← Dashboard</Link></div>

      <div className="card" style={{ borderColor: 'var(--gold-line)', textAlign: 'center' }}>
        <p className="hint">YOUR CODE</p>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>{s.code}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn sm ghost" onClick={() => copy(s.code, 'code')}><Ic n={copied === 'code' ? 'check' : 'copy'} s={14} />{copied === 'code' ? 'Copied!' : 'Copy code'}</button>
          <button className="btn sm ghost" onClick={() => copy(link, 'link')}><Ic n={copied === 'link' ? 'check' : 'copy'} s={14} />{copied === 'link' ? 'Copied!' : 'Copy invite link'}</button>
          <a className="btn sm" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noreferrer"><Ic n="send" s={14} />Share on WhatsApp</a>
        </div>
        <div className="guide-bar" style={{ marginTop: 14 }}><i style={{ width: `${pct}%` }} /></div>
        <p className="hint" style={{ marginTop: 6 }}>{s.invited} invited · {s.qualified} finished setup · {s.paying} paying · {s.nextMilestoneIn} more to {naira(s.milestoneAmount)} airtime{s.airtimeDue > 0 ? ` · ${naira(s.airtimeDue)} on the way!` : ''}</p>
      </div>

      <div className="grid3">
        <div className="card"><h2><Ic n="gift" s={16} /> 14 Pro days × 2</h2><p className="desc">Friend finishes setup with your code → <b>both</b> shops get {s.quizDays} Pro days. Real Pro everywhere. Costs you nothing, earns you loyalty.</p></div>
        <div className="card"><h2><Ic n="cash" s={16} /> ₦500 airtime</h2><p className="desc">Every {s.milestoneEvery}th paying friend = ₦500 airtime. We track it, you get a bell, the card follows. Top champions only.</p></div>
        <div className="card"><h2><Ic n="chart" s={16} /> Monthly champion</h2><p className="desc">Top referrer each month wins a <b>free Plus month</b> + shout-out. Sell the dream, wear the crown.</p></div>
      </div>

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-head"><h2>My rewards</h2><span className="hint">{s.daysEarned} Pro days earned</span></div>
          {!x ? <div className="skel" /> : x.history.length === 0 ? <p className="hint">Nothing yet — share your code above and rewards land here.</p> : (
            <div className="qa-list">
              {x.history.map((h, i) => (
                <div key={i} className="qa static">
                  <span className={'qa-dot ' + (h.status === 'pending' ? 'flag' : 'ok')} />
                  <div><b>{kindName(h.kind)}{h.days ? ` +${h.days}d` : ''}{h.amount ? ` ${naira(h.amount)}` : ''}</b>
                  <span className="hint">{h.status}{h.note ? ` · ${h.note}` : ''}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>This month's leaders</h2></div>
          {!x ? <div className="skel" /> : x.leaders.length === 0 ? <p className="hint">No paying referrals yet this month — be the first name here.</p> : (
            <div className="qa-list">
              {x.leaders.map((l, i) => (
                <div key={i} className="qa static">
                  <span className="qa-num">{i + 1}</span>
                  <div><b>{l.name}</b><span className="hint">{l.paying} paying referral{l.paying === 1 ? '' : 's'}</span></div>
                </div>
              ))}
            </div>
          )}
          <p className="hint" style={{ marginTop: 10 }}>Anti-cheat on: self-referrals blocked, quiz-gated rewards, airtime only on paying shops.</p>
        </div>
      </div>
    </div>
  );
}
