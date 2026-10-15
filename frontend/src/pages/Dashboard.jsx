// ── frontend/src/pages/Dashboard.jsx ─────────────────────────────
// WHAT: the home screen after login. Greeting hero, trial strip, four real
// KPIs, a 7-day activity chart, the AI reply mix, chats that need a human,
// and the first-15-minutes checklist. Real shop data only — no invented
// numbers (DESIGN.md §Dashboard Overview).
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
        <div className="ov-greet"><h1>Overview</h1><p>Your shop at a glance.</p></div>
      </div>
      <LoadFailed title="Couldn't load overview" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setS(null); setTries((t) => t + 1); }} backTo="/help" backLabel="Get help" />
    </>
  );

  function Spark({ data }) { // 7-day activity sparkline (pure SVG, real counts only)
    const w = 96, h = 30, max = Math.max(1, ...data);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * (w - 4) + 2},${h - 4 - (v / max) * (h - 10)}`).join(' ');
    const area = `2,${h - 3} ${pts} ${w - 2},${h - 3}`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Chats per day, last 7 days" className="ov-spark">
        <polygon points={area} style={{ fill: 'var(--purple-soft)' }} />
        <polyline points={pts} fill="none" style={{ stroke: 'var(--purple)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w - 2} cy={h - 4 - ((data[data.length - 1] || 0) / max) * (h - 10)} r="3" style={{ fill: 'var(--purple)' }} />
      </svg>
    );
  }

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

  function Donut({ handled, needs }) { // reply mix ring (purple = AI handled, sky = catalog answers, faint = human)
    const segs = [
      { v: handled, color: 'var(--purple)', r: 54 },
      { v: Math.max(8, 100 - handled - needs), color: 'var(--sky)', r: 42 },
      { v: Math.max(6, needs), color: 'var(--faint)', r: 30 },
    ];
    return (
      <div className="ov-donut">
        <svg viewBox="0 0 130 130" width="150" height="150" role="img" aria-label="Reply mix chart">
          {segs.map((sg, i) => (
            <circle key={'t' + i} cx="65" cy="65" r={sg.r} fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="9" opacity="0.7" />
          ))}
          {segs.map((sg, i) => {
            const c = 2 * Math.PI * sg.r;
            const frac = Math.max(0.06, Math.min(0.92, sg.v / 100));
            return <circle key={'f' + i} cx="65" cy="65" r={sg.r} fill="none" stroke={sg.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} transform="rotate(-90 65 65)" />;
          })}
        </svg>
        <div className="ov-donut-center"><b>{s ? s.convos : '—'}</b><span>Chats</span></div>
      </div>
    );
  }

  const handledPct = s ? s.pct : 0; // % handled by AI
  const needsPct = s && s.convos ? Math.round((s.needs / Math.max(1, s.convos)) * 100) : 0;
  const catalogPct = Math.max(0, 100 - handledPct - needsPct);
  const botLine = live ? 'Your bot is live and answering customers.' : 'Add a product and connect a channel to go live.';
  const statusLabel = live ? 'Bot online' : 'Bot ready';

  function StatTile({ label, value, sub, to, tone = '' }) { // one KPI (real number + tiny context line)
    const inner = (
      <>
        <span className="ov-stat-lbl">{label}</span>
        <b className={'ov-stat-num ' + tone}>{value}</b>
        <span className="ov-stat-sub">{sub}</span>
      </>
    );
    return to ? <Link className="ov-stat" to={to}>{inner}</Link> : <div className="ov-stat">{inner}</div>;
  }

  return (
    <>
      <div className="ov-hero">
        <div className="ov-greet">
          <h1>{greeting()}, {first}.</h1>
          <p>{botLine}</p>
        </div>
        <div className="ov-hero-actions">
          <span className={'ov-status' + (live ? ' on' : '')}><i />{statusLabel}</span>
          <Link className="btn" to="/playground"><Ic n="play" s={16} />Test bot</Link>
          <Link className="btn ghost" to="/catalog"><Ic n="plus" s={16} />Add product</Link>
        </div>
      </div>

      {trialLeft !== null && ( // trial strip ONLY during trial (null → renders nothing)
        <div className="trial-strip"><Ic n="clock" s={16} /><span><b>{trialLeft} day{trialLeft === 1 ? '' : 's'} of Pro trial left.</b> Keep Pro sync, or stay free forever with manual catalog.</span><Link to="/billing">Billing<Ic n="next" s={14} /></Link></div>
      )}

      {!s ? ( // LOADING: skeleton tiles mirroring the layout
        <div className="ov-skels">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ov-stat"><div className="skel" style={{ width: '45%', height: 12 }} /><div className="skel" style={{ width: '60%', height: 30, marginTop: 12 }} /><div className="skel" style={{ width: '75%', marginTop: 12 }} /></div>
          ))}
        </div>
      ) : (
        <>
          <div className="ov-stats">
            <div className="ov-stat">
              <span className="ov-stat-lbl">Conversations</span>
              <b className="ov-stat-num">{s.convos}</b>
              <div className="ov-stat-foot"><span className="ov-stat-sub">Last 7 days</span><Spark data={s.days} /></div>
            </div>
            <StatTile label="Products live" value={s.products} sub={s.products ? 'In your catalog' : 'Add your first one'} to="/catalog" />
            <StatTile label="Handled by AI" value={handledPct + '%'} sub="No human needed" tone="good" />
            <StatTile label="Needs you" value={s.needs} sub={s.needs ? 'Flagged chats' : 'All clear'} to="/chats" tone={s.needs ? 'warn' : ''} />
          </div>

          <div className="ov-grid">
            <div className="ov-card">
              <div className="ov-head"><h2>Activity</h2><Link className="mini-link" to="/insights">Insights <Ic n="next" s={13} /></Link></div>
              <p className="ov-sub">Chats per day, last 7 days</p>
              <Bars data={s.days} />
            </div>
            <div className="ov-card">
              <div className="ov-head"><h2>Reply mix</h2><span className="pill">Live</span></div>
              <p className="ov-sub">How your chats are handled</p>
              <Donut handled={handledPct} needs={needsPct} />
              <div className="ov-legend">
                <div><i style={{ background: 'var(--purple)' }} />{handledPct}%<span>AI handled</span></div>
                <div><i style={{ background: 'var(--sky)' }} />{catalogPct}%<span>Catalog</span></div>
                <div><i style={{ background: 'var(--faint)' }} />{needsPct}%<span>Human</span></div>
              </div>
            </div>
          </div>

          <div className="ov-grid">
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
                <div className="ov-head"><h2>Recent chats</h2><Link className="mini-link" to="/chats">Inbox <Ic n="next" s={13} /></Link></div>
                {s.latest.length === 0 ? (
                  <div className="ov-empty"><span className="ov-empty-ic"><Ic n="chat" s={22} /></span><b>No chats yet</b><span>Share your WhatsApp number — conversations land here.</span></div>
                ) : (
                  <div className="ov-list">
                    {s.latest.map((c, i) => (
                      <Link className="ov-row" key={i} to="/chats">
                        <span className="ov-row-ic"><Ic n="chat" s={16} /></span>
                        <span className="ov-row-main"><b>{c.customer_name || c.customer_number || 'Customer'}</b><span>{((c.last_message || '').slice(0, 64)) || 'Latest conversation.'}</span></span>
                        <span className="ov-row-time">{fmtTime(c.updated_at || c.created_at)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <ReferCard /> {/* Refer & Earn: code, share, funnel, milestone progress (drives itself!) */}
    </>
  );
}


function ReferCard() { // REFER & EARN: your code + share buttons + live funnel (invited → setup → paying!) + milestone bar to ₦500 airtime.
  const [r, setR] = useState(null); // null = loading (renders nothing); object = myStats (code, counts, earnings!)
  const [copied, setCopied] = useState(false); // copy feedback (tick + "Copied!" for 2s!)
  useEffect(() => { api('/api/me/referral', { timeout: 15000 }).then(({ ok, data }) => { if (ok && data && data.code) setR(data); }).catch(() => {}); }, []); // [] = mount-only (fresh each dashboard visit!); fail silent — full page has Retry!
  if (!r || !r.code) return null; // loading/error → render NOTHING (card pops in when ready — no skeleton flash for a bonus card! full /refer-earn page owns the error UI!)
  const every = Number(r.milestoneEvery) > 0 ? Number(r.milestoneEvery) : 5;
  const link = window.location.origin + '/login?ref=' + encodeURIComponent(r.code); // share link (Login prefills + validates the code!)
  const text = `I use VeloSales Ai — my WhatsApp shop answers customers 24/7, even at 2am. Start free with my code ${r.code} (we BOTH get 14 Pro days free): ${link}`;
  async function copy() { // clipboard with fallback (older browsers / permissions!)
    try { await navigator.clipboard.writeText(r.code); }
    catch { const ta = document.createElement('textarea'); ta.value = r.code; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 2000); // tick 2s (then back to copy icon!)
  }
  const pct = Math.min(100, Math.round(((Number(r.paying) || 0) % every) / every * 100)); // milestone bar (0–100 — resets each 5-pack, by design!)
  const naira = (kobo) => '₦' + (Number(kobo || 0) / 100).toLocaleString(); // minor → major (ledger stores kobo!)
  return (
    <div className="ov-refer">
      <div className="ov-refer-main">
        <h2><Ic n="gift" s={16} /> Refer &amp; Earn</h2>
        <p className="ov-sub">Friends join with your code and <b>start using</b> (connect or first chat) → you <b>both</b> get 14 Pro days. Every 5th paying friend = <b>₦500 airtime</b> from us.</p>
        <div className="ov-refer-code">
          <code>{r.code}</code>
          <button className="btn sm ghost" onClick={copy}><Ic n={copied ? 'check' : 'copy'} s={14} />{copied ? 'Copied!' : 'Copy code'}</button>
          <a className="btn sm" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noreferrer"><Ic n="send" s={14} />Share on WhatsApp</a>
        </div>
        <div className="guide-bar" style={{ marginTop: 14 }}><i style={{ width: `${pct}%` }} /></div>
        <p className="hint" style={{ marginTop: 8 }}>
          {r.invited} invited · {r.qualified} finished setup · {r.paying} paying · {r.nextMilestoneIn} more to {naira(r.milestoneAmount)} airtime
          {r.airtimeDue > 0 ? ` · ${naira(r.airtimeDue)} on the way!` : ''}
        </p>
      </div>
      <Link className="btn ghost sm ov-refer-link" to="/refer-earn">Open full page <Ic n="next" s={14} /></Link>
    </div>
  );
}
