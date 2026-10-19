// ── frontend/src/pages/ReferEarn.jsx ──────────────────────────────
// WHAT: the full Refer & Earn page (the Dashboard card is just the teaser!).
// Indigo hero with YOUR code + share, four real counters, the three rewards,
// live payout history and this month's leaderboard.
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
  const [failed, setFailed] = useState(null); // null | { status, detail } — show it, never spin forever!
  const [copied, setCopied] = useState(''); // which button ticked ('code' | 'link' | '')
  const [tries, setTries] = useState(0); // retry counter (forces reload effect!)
  useEffect(() => { // mount + retry: both endpoints fly in parallel (no await between!)
    let dead = false; // unmount guard (slow networks + fast navigation!)
    setFailed(null);
    api('/api/me/referral', { timeout: 15000 }).then(({ ok, data, status }) => {
      if (dead) return;
      if (ok && data && data.code) setS(data);
      else if (status === 401) window.location.href = '/login'; // session died → login (not an error loop!)
      else setFailed({
        status,
        detail: (data && (data.error || data.message)) || (!navigator.onLine ? 'You look offline — reconnect and retry.' : status === 404 ? 'This app copy is older than the Refer & Earn page — redeploy the backend.' : status === 503 ? 'Server is waking up (cold start?) — tap Retry in a few seconds.' : 'The server did not answer — your code and earnings are safe.'),
      }); // 404/500/503 = backend older/sleeping (SAY SO below); offline = say offline!
    }).catch((e) => {
      if (!dead) setFailed({
        status: 0,
        detail: !navigator.onLine ? 'You look offline — reconnect and retry.' : 'Network hiccup (' + (e && e.name === 'AbortError' ? 'timed out after 15s' : 'connection failed') + ') — tap Retry.',
      });
    }); // network down / abort → error card, not eternal skeleton
    api('/api/me/referral/extra', { timeout: 15000 }).then(({ ok, data }) => { if (!dead && ok) setX({ history: data.history || [], leaders: data.leaders || [] }); else if (!dead) setX({ history: [], leaders: [] }); }).catch(() => { if (!dead) setX({ history: [], leaders: [] }); }); // extra is garnish (page works without it — empty beats skeleton!)
    const onOnline = () => { if (!dead && failed) setTries((t) => t + 1); }; // auto-retry when browser comes back online!
    window.addEventListener('online', onOnline);
    return () => { dead = true; window.removeEventListener('online', onOnline); };
  }, [tries]); // [tries] = Retry button bumps this → refetch (no full page reload!)
  async function copy(text, which) { // clipboard with legacy fallback (older browsers / permissions!)
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
    setCopied(which); setTimeout(() => setCopied(''), 2000); // tick 2s (then back!)
    toast('Copied — go share it!');
  }
  const head = ( // the page head is identical in all three states (only what follows changes)
    <div className="page-head"><div className="row"><div><h1>Refer &amp; Earn</h1><p>Invite sellers, you both win. No caps on inviting.</p></div><Link className="mini-link" to="/dashboard">← Dashboard</Link></div></div>
  );
  if (!s && !failed) return ( // loading → the hero shape, so the page doesn't jump when data lands
    <div className="page">
      {head}
      <div className="re-hero is-skel"><div className="skel" style={{ width: 150, height: 12 }} /><div className="skel" style={{ width: 280, height: 40, marginTop: 14 }} /><div className="skel" style={{ width: 200, height: 44, marginTop: 18, borderRadius: 999 }} /></div>
      <div className="re-stats">{[0, 1, 2, 3].map((i) => (<div key={i} className="re-stat"><div className="skel" style={{ width: '55%', height: 12 }} /><div className="skel" style={{ width: '45%', height: 30, marginTop: 12 }} /></div>))}</div>
    </div>
  );
  if (!s && failed) return ( // backend unreachable / sleeping / older than this page — SAY SO with in-place retry (never spin forever!)
    <div className="page">
      {head}
      <div className="card"><div className="empty"><b>Couldn't load rewards{failed.status ? ` (${failed.status})` : ''}</b>{failed.detail || "The server didn't answer (offline? old version?). Check your connection, then try again — your code and earnings are safe."}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><button className="btn sm" onClick={() => { setS(null); setX(null); setTries((t) => t + 1); }}>Retry{tries > 0 ? ` (${tries})` : ''}</button><Link className="btn sm ghost" to="/dashboard">Back to Dashboard</Link></div></div>
    </div>
  );
  const safeMilestone = Number(s.milestoneEvery) > 0 ? Number(s.milestoneEvery) : 5;
  const link = window.location.origin + '/login?ref=' + encodeURIComponent(s.code || ''); // share link (Login prefills + validates!)
  const text = `I use VeloSales Ai — my WhatsApp shop answers customers 24/7, even at 2am. Start free with my code ${s.code} (we BOTH get ${s.quizDays || 14} Pro days free): ${link}`;
  const pct = Math.min(100, Math.round(((Number(s.paying) || 0) % safeMilestone) / safeMilestone * 100)); // milestone fill (resets each 5-pack!)
  const kindName = (k) => k === 'pro_days' ? 'Pro days' : k === 'airtime' ? 'Airtime' : k === 'plus_month' ? 'Plus month' : k; // payout kind → human words
  const totalInvited = Number(s.invited) || 0; // counters are read 2–3 times each below — normalise once
  const stats = [
    { v: totalInvited, l: 'Invited', sub: 'Friends with your code' },
    { v: Number(s.qualified) || 0, l: 'Finished setup', sub: 'Connected or first chat' },
    { v: Number(s.paying) || 0, l: 'Paying', sub: 'Earning you airtime' },
    { v: `${Number(s.daysEarned) || 0}d`, l: 'Pro earned', sub: 'Banked on your account', tone: 'good' },
  ];
  return (
    <div className="page">
      {head}

      <div className="re-hero">
        <div className="re-hero-main">
          <span className="re-eyebrow">Your invite code</span>
          <div className="re-code">
            <code>{s.code}</code>
            <button className="re-ic-btn" onClick={() => copy(s.code, 'code')} aria-label="Copy code"><Ic n={copied === 'code' ? 'check' : 'copy'} s={16} /></button>
          </div>
          <p className="re-hero-line">A friend joins with your code and <b>starts using</b> — connects a channel or sends the first chat — and <b>you both</b> get {s.quizDays || 14} Pro days. Real Pro everywhere, costs you nothing.</p>
          <div className="re-hero-actions">
            <a className="btn re-share" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noreferrer"><Ic n="send" s={15} />Share on WhatsApp</a>
            <button className="btn re-ghost" onClick={() => copy(link, 'link')}><Ic n={copied === 'link' ? 'check' : 'copy'} s={15} />{copied === 'link' ? 'Link copied' : 'Copy invite link'}</button>
          </div>
        </div>
        <div className="re-hero-side">
          <span className="re-earn-lbl">Airtime earned</span>
          <div className="re-earn">{naira(s.airtimeDue)}{s.airtimeDue > 0 ? <span className="re-earn-flag">on the way</span> : null}</div>
          <div className="re-bar"><i style={{ width: `${pct}%` }} /></div>
          <p className="re-earn-sub">{Number(s.nextMilestoneIn) || 0} more paying {Number(s.nextMilestoneIn) === 1 ? 'friend' : 'friends'} to {naira(s.milestoneAmount)} airtime</p>
        </div>
      </div>

      <div className="re-stats">
        {stats.map((t) => (
          <div className="re-stat" key={t.l}><span className="re-stat-lbl">{t.l}</span><b className={'re-stat-num ' + (t.tone || '')}>{t.v}</b><span className="re-stat-sub">{t.sub}</span></div>
        ))}
      </div>

      <div className="grid3">
        <div className="re-reward"><span className="re-reward-ic"><Ic n="gift" s={18} /></span><h3>{(s.quizDays || 14)} Pro days × 2</h3><p>Both shops get real Pro the moment your friend starts using the app.</p>{s.degraded ? <p className="hint">Stats refreshing — code works, counts syncing.</p> : null}</div>
        <div className="re-reward"><span className="re-reward-ic gold"><Ic n="cash" s={18} /></span><h3>₦500 airtime</h3><p>Every {safeMilestone}th paying friend = ₦500 airtime. We track it, you get a bell, the card follows.</p></div>
        <div className="re-reward"><span className="re-reward-ic"><Ic n="chart" s={18} /></span><h3>Monthly champion</h3><p>Top referrer each month wins a free Plus month and a shout-out.</p></div>
      </div>

      <div className="grid2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h2>My rewards</h2><span className="hint">{s.daysEarned || 0} Pro days earned</span></div>
          {!x || !Array.isArray(x.history) ? <div className="skel" style={{ height: 90 }} /> : x.history.length === 0 ? <div className="empty"><b>Nothing yet</b>Share your code above — every reward lands here the moment it is credited.</div> : (
            <div className="re-rows">
              {x.history.map((h, i) => (
                <div key={i} className="re-row">
                  <span className={'re-row-ic ' + (h.status === 'pending' ? 'gold' : '')}><Ic n={h.kind === 'airtime' ? 'cash' : h.kind === 'plus_month' ? 'chart' : 'gift'} s={16} /></span>
                  <span className="re-row-main"><b>{kindName(h.kind)}{h.days ? ` +${h.days} days` : ''}{h.amount ? ` ${naira(h.amount)}` : ''}</b>{h.note ? <span>{h.note}</span> : null}</span>
                  <span className={'pill ' + (h.status === 'pending' ? 'flag' : 'ok')}>{h.status || 'credited'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>This month's leaders</h2></div>
          {!x || !Array.isArray(x.leaders) ? <div className="skel" style={{ height: 90 }} /> : x.leaders.length === 0 ? <div className="empty"><b>No paying referrals yet</b>Be the first name on this board.</div> : (
            <div className="re-rows">
              {x.leaders.map((l, i) => (
                <div className={'re-row' + (i === 0 ? ' lead' : '')} key={i}>
                  <span className={'re-medal' + (i < 3 ? ' m' + (i + 1) : '')}>{i + 1}</span>
                  <span className="re-row-main"><b>{l.name}</b><span>{l.paying} paying referral{l.paying === 1 ? '' : 's'}</span></span>
                  {i === 0 ? <span className="pill flag">Champion</span> : null}
                </div>
              ))}
            </div>
          )}
          <p className="hint" style={{ marginTop: 12 }}>Anti-cheat on: self-referrals blocked, rewards gated behind a real setup, airtime only on paying shops.</p>
        </div>
      </div>
    </div>
  );
}
