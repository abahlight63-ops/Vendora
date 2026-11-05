// ── frontend/src/pages/ReferEarn.jsx ──────────────────────────────
// WHAT: the full Refer & Earn page (the Dashboard card is just the teaser!).
// Indigo hero with YOUR code + share, four real counters, the three rewards,
// live payout history and this month's leaderboard.
// DATA: /api/me/referral (stats) + /api/me/referral/extra (history+leaders).
// React patterns: parallel fetch, clipboard-with-fallback, progress math.
import { useEffect, useState } from 'react'; // useState = stats/extra/copied; useEffect = load-once
import { Link } from 'react-router-dom'; // back-to-dashboard link
import { api, toast } from '../lib/api.js'; // api() calls; toast() copy feedback
import Ic from '../components/icons.jsx';
import { CHANNEL_COINS } from '../lib/channelLogos.js'; // gift/check/send icons

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
  const qualified = Number(s.qualified) || 0;
  const paying = Number(s.paying) || 0;
  const towards = paying % safeMilestone;
  const left = Number(s.nextMilestoneIn) || (safeMilestone - towards);
  const ring = 2 * Math.PI * 22;
  const days = s.quizDays || 14;
  const prize = naira(s.milestoneAmount || 50000);
  const leaders = (x && Array.isArray(x.leaders)) ? x.leaders.slice(0, 3) : [];
  const podium = [[leaders[1], 2], [leaders[0], 1], [leaders[2], 3]]; // the winner stands in the middle
  const endOfMonth = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate() - n.getDate(); })();
  return (
    <div className="re2">
      <section className="re2-hero">
        <div className="re2-hero-copy">
          <span className="re2-eyebrow"><Ic n="gift" s={15} />Refer &amp; Earn</span>
          <h1>Give {days} Pro days.<br />Get {days} Pro days.</h1>
          <p>When a friend joins with your code and starts using Velo, you both get {days} days of Pro. Every {safeMilestone}th friend who pays earns you {prize} airtime.</p>
        </div>
        <div className="re2-hero-side">
          <div className="re2-ticket">
            <span className="re2-perf" aria-hidden="true" />
            <div className="re2-ticket-main"><small>YOUR CODE</small><code>{s.code}</code><span>{link.replace(/^https?:\/\//, '')}</span></div>
            <button type="button" className="re2-ticket-copy" onClick={() => copy(s.code, 'code')} aria-label="Copy code"><Ic n={copied === 'code' ? 'check' : 'copy'} s={22} />{copied === 'code' ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="re2-shares">
            <a className="re2-share wa" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noreferrer"><svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHANNEL_COINS.whatsapp }} />Share on WhatsApp</a>
            <button type="button" className="re2-share ghost" onClick={() => copy(link, 'link')}><Ic n={copied === 'link' ? 'check' : 'copy'} s={18} />{copied === 'link' ? 'Link copied' : 'Copy link'}</button>
          </div>
        </div>
      </section>

      <div className="re2-row">
        <section className="glass re2-card">
          <div className="re2-card-head"><h2>Your friends so far</h2><span>Updates live</span></div>
          <div className="re2-steps">
            {[[totalInvited, 'Joined with your code', 'a'], [qualified, 'Started using', 'b'], [paying, 'Paying', 'c'], [(Number(s.daysEarned) || 0) + 'd', 'Pro days earned', 'd']].map(([v, l, k]) => (
              <div key={l} className="re2-step"><b className={'re2-n ' + k}>{v}</b><span>{l}</span></div>
            ))}
          </div>
        </section>
        <section className="glass re2-card re2-next">
          <div className="re2-ring">
            <svg viewBox="0 0 56 56" width="120" height="120" aria-hidden="true"><defs><linearGradient id="re2-rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F3FC7" /><stop offset="1" stopColor="#D03C16" /></linearGradient></defs><circle cx="28" cy="28" r="22" fill="none" stroke="var(--ring-track)" strokeWidth="6" /><circle cx="28" cy="28" r="22" fill="none" stroke="url(#re2-rg)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(towards / safeMilestone) * ring} ${ring}`} transform="rotate(-90 28 28)" /></svg>
            <b>{towards}/{safeMilestone}</b>
          </div>
          <div><span className="re2-lbl">{Number(s.airtimeDue) > 0 ? 'Airtime on the way' : 'Next airtime'}</span><strong>{Number(s.airtimeDue) > 0 ? naira(s.airtimeDue) : prize}</strong><p>{left} more paying {left === 1 ? 'friend' : 'friends'} to go.</p></div>
        </section>
      </div>

      <div className="re2-rewards">
        {[['gift', `${days} Pro days, both of you`, 'When a friend you invite starts using Velo.', 'indigo'], ['cash', `${prize} airtime`, `For every ${safeMilestone}th friend who pays for a plan.`, 'coral'], ['chart', 'Monthly champion', 'Top referrer each month wins a free Plus month.', 'plum']].map(([ic, t, d, c]) => (
          <section key={t} className="glass re2-card re2-reward"><span className={'re2-reward-ic ' + c}><Ic n={ic} s={24} /></span><b>{t}</b><p>{d}</p></section>
        ))}
      </div>

      <div className="re2-row even">
        <section className="glass re2-card">
          <div className="re2-card-head"><h2>This month&apos;s leaders</h2><span className="ch-chip hot">{endOfMonth} {endOfMonth === 1 ? 'day' : 'days'} left</span></div>
          {!x ? <div className="skel" style={{ height: 160, marginTop: 16 }} /> : leaders.length === 0 ? <div className="pu-empty" style={{ marginTop: 16 }}><b>No paying referrals yet</b><span>Be the first name on this board.</span></div> : (
            <div className="re2-podium">
              {podium.map(([l, r]) => l ? (
                <div key={r} className="re2-pod">
                  <span className="re2-face">{String(l.name || '?')[0]}</span>
                  <b>{l.name} · {l.paying}</b>
                  <div className={'re2-blk p' + r}>{r}</div>
                </div>
              ) : <div key={r} />)}
            </div>
          )}
        </section>
        <section className="glass re2-card">
          <div className="re2-card-head"><h2>My rewards</h2><span>{s.daysEarned || 0} Pro days earned</span></div>
          {!x ? <div className="skel" style={{ height: 120, marginTop: 14 }} /> : x.history.length === 0 ? <div className="pu-empty" style={{ marginTop: 14 }}><b>Nothing yet</b><span>Share your code above. Every reward lands here the moment it is added.</span></div> : (
            <div className="re2-list">
              {x.history.map((h, i) => (
                <div key={i} className="re2-item">
                  <span className="pu-tile-ic"><Ic n={h.kind === 'airtime' ? 'cash' : h.kind === 'plus_month' ? 'chart' : 'gift'} s={18} /></span>
                  <span className="re2-item-main"><b>{kindName(h.kind)}{h.days ? ` +${h.days} days` : ''}{h.amount ? ` ${naira(h.amount)}` : ''}</b>{h.note ? <small>{h.note}</small> : null}</span>
                  <span className={'ch-chip ' + (h.status === 'pending' ? 'ready' : 'live')}>{h.status === 'pending' ? 'Waiting' : 'Added'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="re2-fine">Self-referrals are blocked, rewards need a real setup, and airtime is only for paying shops.</p>
    </div>
  );
}
