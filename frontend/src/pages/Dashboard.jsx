// ── frontend/src/pages/Dashboard.jsx ─────────────────────────────
// WHAT: Home, the screen after login. A greeting, four things to do next (chats
// that need you comes first and turns coral when it is real), today's reply
// meter, the way into Chat with Velo, then activity and the checklist. Real
// shop data only, no invented numbers. The phone's copy is home_screen.dart.
// DATA: four parallel API calls on mount, crunched into one summary object `s`.
import { useEffect, useState } from 'react'; // useState = s/bill/guideOff; useEffect = fetch-on-mount
import { Link } from 'react-router-dom'; // Link = client-side nav (no page reload, unlike <a>)
import { api, fmtTime, pop } from '../lib/api.js'; // api() fetches; fmtTime formats inbox timestamps; pop() celebrates payment returns
import { describeNetError } from '../lib/netDetail.js'; // one voice for load failures (offline? waking? stale?)
import LoadFailed from '../components/LoadFailed.jsx'; // branded failed card + Retry (never eternal skeletons!)
import Ic from '../components/icons.jsx'; // <Ic n="chat"/> icon set


function greeting() { // NOT a component (lowercase, returns a string): time-based hello.
  const h = new Date().getHours(); // getHours() = 0–23 local time…
  if (h < 12) return 'Good morning'; // …branch into day parts (early returns)
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // for the activity chart labels

export default function Dashboard({ biz }) { // biz = business object from App (useMe) — name, hours, owner_number…
  const [s, setS] = useState(null); // s = summary {convos, pct, needs, products, flagged[], latest[], days[]} (null = loading → skeletons!)
  const [bill, setBill] = useState(null); // billing object (status, trial_ends… for the trial strip)
  const [usage, setUsage] = useState(null); // today's replies: { used, limit, unlimited } from /api/me/channels
  const [live, setLive] = useState(false); // any channel LIVE? (WhatsApp inbound seen OR Telegram connected — Connect page owns this!)
  const [failed, setFailed] = useState(null); // null | { status, detail } — total load failure (Retry card, never eternal skeletons!)
  const [tries, setTries] = useState(0); // retry counter (bumps refetch — no page reload!)
  useEffect(() => { // runs on mount + every retry ([] + tries): fetch everything in parallel…
    let dead = false; // unmount guard (slow networks + fast navigation!)
    setFailed(null);
    (async () => { // async IIFE (effects can't be async directly — so define + call an async fn inside)
      try {
        const [{ data: products }, { data: convos }, { data: b }, { data: ch }] = await Promise.all([ // Promise.all = 4 requests AT ONCE (faster than sequential); destructure each {data}
          api('/api/me/products', { timeout: 15000 }), api('/api/me/conversations', { timeout: 15000 }), api('/api/me/billing', { timeout: 15000 }), api('/api/me/channels', { timeout: 15000 }),
        ]);
        if (dead) return;
        if (ch && ch.whatsapp) setUsage({ used: Number(ch.whatsapp.dailyUsed) || 0, limit: ch.whatsapp.dailyLimit, unlimited: !!ch.whatsapp.dailyUnlimited });
        if (ch && ch.whatsapp && (ch.whatsapp.live || (ch.telegram && ch.telegram.connected))) setLive(true); // checklist step ticks (WhatsApp TEST passed OR Telegram on!)
        const c = convos || [], needs = c.filter((x) => x.needs_human); // || [] guards null; .filter picks flagged chats
        const days = [0, 0, 0, 0, 0, 0, 0]; // active chats per day, last 7 days (oldest → today) for the activity chart
        c.forEach((x) => { // updated_at = last activity (falls back to created_at, then today)
          const t = new Date(x.updated_at || x.created_at || Date.now()).getTime();
          if (Number.isNaN(t)) return;
          const d = Math.floor((Date.now() - t) / 86400000);
          if (d >= 0 && d < 7) days[6 - d] += 1;
        });
        setS({ // crunch into ONE setState (single re-render, not three!)
          convos: c.length, // total chats
          pct: c.length ? Math.round(((c.length - needs.length) / c.length) * 100) : 100, // % handled by AI (ternary avoids divide-by-zero → 100% when empty)
          needs: needs.length, products: (products || []).length, // flagged count, catalog size
          flagged: needs.slice(0, 3), latest: c.slice(0, 3), // .slice(0,3) = first 3 for the two lists (convos already newest-first from API)
          days, // 7-day activity source (real timestamps only)
        });
        setBill(b || null); // billing (|| null normalizes undefined)
      } catch (e) { if (!dead) setFailed({ status: 0, detail: describeNetError(e) }); } // network down / timeout → failed card (never eternal skeletons!)
    })(); // ← invoke the IIFE immediately
    const onOnline = () => { if (!dead) setTries((x) => x + 1); }; // back online? auto-retry (no tap needed!)
    window.addEventListener('online', onOnline);
    return () => { dead = true; window.removeEventListener('online', onOnline); }; // cleanup on unmount (no leaked listener!)
  }, [tries]); // [tries] = Retry bumps → refetch (mount + retries share this path!)
  useEffect(() => { // Paystack RETURN: ?reference=… in the URL → server-verified activation (webhook usually already did it — idempotent, so double runs are safe!)
    const q = new URLSearchParams(window.location.search);
    const ref = q.get('reference') || q.get('trxref');
    if (!ref) return;
    window.history.replaceState({}, '', window.location.pathname); // strip FIRST (refresh-safe: reloads never re-verify!)
    api('/api/billing/verify?provider=paystack&reference=' + encodeURIComponent(ref)).then(({ ok, data }) => {
      if (ok) pop('ok', 'Payment confirmed — Pro is active!', 'Receipt emailed to you. Profile sync, photos + premium brains are on.');
      else pop('err', 'Payment not confirmed yet', (data && data.error) || 'If money left your account, wait a minute and retry.');
    }).catch(() => pop('err', 'Could not verify payment', 'Check Billing — if it still shows Free, retry in a minute.'));
  }, []);
  const first = (biz?.name || 'there').split(' ')[0]; // "Amaka Beauty Studio" → "Amaka" (?. guards slow-loading biz; || 'there' fallback)
  const trialLeft = bill && bill.status === 'trialing' && bill.trial_ends // trial countdown in DAYS: only when status IS trialing AND an end date exists…
    ? Math.max(0, Math.ceil((new Date(bill.trial_ends) - Date.now()) / 86400000)) : null; // …ms difference ÷ ms-per-day, ceil UP (a partial day still counts), max(0) clamps past-dates; null = hide the strip
  const [guideOff, setGuideOff] = useState(() => { try { return localStorage.getItem('vendora-guide') === 'off'; } catch { return false; } }); // lazy init reads dismissal flag (function form = runs once, not per render)
  function hideGuide() { setGuideOff(true); try { localStorage.setItem('vendora-guide', 'off'); } catch {} } // dismiss: state + persist (try/catch = private-mode safe)
  let tested = false; // plain variable (not state — read fresh each render; Playground writes the flag)
  try { tested = localStorage.getItem('vendora-tested') === '1'; } catch {} // Playground sets '1' on first test send
  const quizSize = biz?.catalog_size || ''; // quiz Q2 ('' = skipped → generic wording!)
  const quizChannels = String(biz?.channels || '').split(',').filter(Boolean); // quiz Q3 (['whatsapp','telegram'] — [] = skipped!)
  const firstHint = quizSize === 'starting' ? 'Start with 5 — 10 minutes, then test like a customer'
    : quizSize === '100-plus' || quizSize === '20-100' ? 'Big shelves? Catalog page + Pro SYNC do bulk fast'
    : 'The AI only quotes your catalog'; // checklist speaks THEIR shelf size (quiz payoff!)
  const connectHint = quizChannels.includes('telegram') && !quizChannels.includes('whatsapp') ? 'Telegram first? Connect page links it in a minute'
    : quizChannels.includes('instagram') ? 'Post on Instagram, sell on WhatsApp — the bot answers there (DM inbox coming soon)'
    : 'WhatsApp + Telegram — TEST to LIVE in minutes'; // checklist speaks THEIR channels (quiz payoff!)
  const steps = [ // checklist DATA (not JSX): done flags computed from REAL data (self-ticking!)…
    { done: (s?.products || 0) > 0, label: quizSize === 'starting' ? 'Add your first 5 products' : 'Add your first product', hint: firstHint, to: '/catalog' }, // to = where the step links
    { done: live, label: 'Connect your channels', hint: connectHint, to: '/connect' }, // live = TEST passed or Telegram on (Connect page owns it!)
    { done: tested || (s?.convos || 0) > 0, label: 'Test like a customer', hint: 'Ask prices, then something you don\'t sell', to: '/playground' }, // \' escapes apostrophe in single-quoted string
    { done: !!(biz?.hours && biz?.owner_number), label: 'Set hours + owner number', hint: 'So closed-hours replies feel human', to: '/profile' }, // !! forces boolean (&& returns the last value, not true/false!)
    { done: (s?.convos || 0) > 0, label: 'Get your first real chat', hint: 'Share your WhatsApp number with customers', to: '/chats' },
  ];
  const doneCount = steps.filter((x) => x.done).length; // .filter keeps dones; .length counts them (progress math below)
  const showGuide = !guideOff && s && doneCount < steps.length; // show only when: not dismissed AND loaded AND incomplete (&& chain = all must be truthy)

  if (failed && !s) return ( // total failure BEFORE first paint (nothing to show yet — failed card INSTEAD of skeletons!)
    <>
      <div className="ov-hero">
        <div className="ov-greet"><h1>Home</h1><p>Your shop at a glance.</p></div>
      </div>
      <LoadFailed title="Couldn't load overview" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setS(null); setTries((t) => t + 1); }} backTo="/help" backLabel="Get help" />
    </>
  );

  function Bars({ data }) { // 7-day activity bars (yesterday→today), real counts, today highlighted
    const max = Math.max(1, ...data);
    return (
      <div className="ov-bars" role="img" aria-label="Chats per day, last 7 days">
        {data.map((v, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i)); // label = the real date this bar covers
          const last = i === data.length - 1;
          return (
            <div className="ov-bar" key={i} title={`${v} chat${v === 1 ? '' : 's'}`}>
              <i className={last ? 'on' : ''} style={{ height: Math.max(6, (v / max) * 100) + '%' }} />
              <span>{DAYS[d.getDay()]}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const botLine = live ? 'Velo is answering your customers right now.' : 'Add a product and connect a channel to go live.';
  const pct = usage && !usage.unlimited && usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const hot = !!(s && s.needs > 0); // coral only when a real chat is waiting
  const Go = () => <svg className="hm-action-go" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>;

  return (
    <>
      <div className="hm-greet">
        <h1><span>Hi {first},</span>what do you need today?</h1>
        <p>{botLine}</p>
      </div>

      {trialLeft !== null && ( // trial strip ONLY during trial (null → renders nothing)
        <div className="trial-strip"><Ic n="clock" s={16} /><span><b>{trialLeft} day{trialLeft === 1 ? '' : 's'} of Pro trial left.</b> Keep Pro sync, or stay free forever with manual catalog.</span><Link to="/billing">See plans<Ic n="next" s={14} /></Link></div>
      )}

      <div className="hm-actions">
        <Link className={'hm-action' + (hot ? ' is-hot' : '')} to="/chats">
          <span className="hm-action-top">{s ? <span className="hm-action-num">{s.needs}</span> : <span className="skel" style={{ width: 28, height: 28 }} />}<Go /></span>
          <b>{s && s.needs === 0 ? 'All chats handled' : s && s.needs === 1 ? 'Chat needs you' : 'Chats need you'}</b>
        </Link>
        <Link className="hm-action" to="/catalog"><span className="hm-action-top"><span className="hm-action-ic"><Ic n="plus" s={18} /></span><Go /></span><b>Add a product</b></Link>
        <Link className="hm-action" to="/playground"><span className="hm-action-top"><span className="hm-action-ic"><Ic n="chat" s={18} /></span><Go /></span><b>Test your bot</b></Link>
        <Link className="hm-action" to="/connect"><span className="hm-action-top"><span className="hm-action-ic"><Ic n="next" s={18} /></span><Go /></span><b>Connect a channel</b></Link>
      </div>

      {usage && (
        <div className="hm-meter">
          <div className="hm-meter-row"><span>Replies today</span><span>{usage.unlimited ? usage.used : usage.used + ' of ' + usage.limit}</span></div>
          {!usage.unlimited && <div className={'hm-meter-bar' + (pct >= 80 ? ' is-near' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.used} aria-label="Replies used today"><i style={{ width: pct + '%' }} /></div>}
        </div>
      )}

      <div className="hm-ask">
        <Link className="hm-ask-box" to="/velosales-ai">Ask Velo anything</Link>
        <Link className="hm-ask-go" to="/velosales-ai" aria-label="Open Chat with Velo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></Link>
      </div>

      {!s ? (
        <div className="hm-grid">
          {[0, 1].map((i) => (
            <div key={i} className="ov-card">
              <div className="skel" style={{ width: 148, height: 14, marginBottom: 6 }} />
              {[0, 1, 2].map((r) => (
                <div key={r} className="skel-row">
                  <div className="skel skel-dot" />
                  <div className="skel-lines"><div className="skel" style={{ width: '52%', height: 12 }} /><div className="skel" style={{ width: '82%', height: 10 }} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="hm-grid">
            <div className="ov-card">
              <div className="ov-head"><h2>Needs your attention</h2><Link className="mini-link" to="/chats">Inbox <Ic n="next" s={13} /></Link></div>
              {s.flagged.length === 0 ? (
                <div className="ov-empty"><span className="ov-empty-ic"><Ic n="checkCircle" s={22} /></span><b>Nothing needs you right now</b><span>Flagged chats land here when the bot hands off.</span></div>
              ) : (
                <div className="ov-list">
                  {s.flagged.map((c, i) => (
                    <Link className="ov-row" key={i} to="/chats">
                      <span className="ov-row-ic warn"><Ic n="hand" s={16} /></span>
                      <span className="ov-row-main"><b>{c.customer_name || c.customer_number || 'New chat'}</b><span>{(c.last_message || 'Needs review').slice(0, 64)}</span></span>
                      <span className="ov-row-time">{fmtTime(c.updated_at || c.created_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {showGuide ? (
              <div className="ov-card">
                <div className="ov-head"><h2>First 15 minutes</h2><button className="mini-link" onClick={hideGuide}>Dismiss</button></div>
                <p className="ov-sub">{doneCount} of {steps.length} done</p>
                <div className="ov-prog"><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
                <div className="ov-steps">
                  {steps.map((st, i) => st.done ? null : (
                    <Link key={i} className="ov-step" to={st.to}>
                      <span className="ov-step-num">{i + 1}</span>
                      <span className="ov-step-main"><b>{st.label}</b><span>{st.hint}</span></span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ov-card">
                <div className="ov-head"><h2>Activity</h2><Link className="mini-link" to="/insights">Insights <Ic n="next" s={13} /></Link></div>
                <p className="ov-sub">Chats per day, last 7 days</p>
                <Bars data={s.days} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
