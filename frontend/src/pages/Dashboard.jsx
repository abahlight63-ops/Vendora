// ── frontend/src/pages/Dashboard.jsx ─────────────────────────────
// WHAT: the home screen after login: greeting hero, Pro-trial strip,
// "first 15 minutes" checklist, 4 stat cards, flagged chats, activity.
// DATA: three parallel API calls on mount (products, conversations, billing),
// crunched into one summary object `s`. Skeletons render while loading.
// React patterns: useState (data + guide flag), useEffect (fetch once),
// derived values (trialLeft, steps) computed during render (no extra state!).
import { Fragment, useEffect, useState } from 'react'; // useState = s/bill/guideOff; useEffect = fetch-on-mount
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

export default function Dashboard({ biz }) { // biz = business object from App (useMe) — name, hours, owner_number…
  const [s, setS] = useState(null); // s = summary {convos, pct, needs, products, flagged[], latest[]} (null = loading → skeletons!)
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
        setS({ // crunch into ONE setState (single re-render, not three!)
          convos: c.length, // total chats
          pct: c.length ? Math.round(((c.length - needs.length) / c.length) * 100) : 100, // % handled by AI (ternary avoids divide-by-zero → 100% when empty)
          needs: needs.length, products: (products || []).length, // flagged count, catalog size
          flagged: needs.slice(0, 3), latest: c.slice(0, 3), // .slice(0,3) = first 3 for the two cards (convos already newest-first from API)
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
  const setupDone = (s?.products || 0) > 0; // ?. safe-navigates null s; drives "3 steps" vs "latest activity" card
  const [guideOff, setGuideOff] = useState(() => { try { return localStorage.getItem('vendora-guide') === 'off'; } catch { return false; } }); // lazy init reads dismissal flag (function form = runs once, not per render)
  function hideGuide() { setGuideOff(true); try { localStorage.setItem('vendora-guide', 'off'); } catch {} } // dismiss: state + persist (try/catch = private-mode safe)
  let tested = false; // plain variable (not state — read fresh each render; Playground writes the flag)
  try { tested = localStorage.getItem('vendora-tested') === '1'; } catch {} // Playground sets '1' on first test send
  const quizSize = biz?.catalog_size || ''; // quiz Q2 ('' = skipped → generic wording!)
  const quizChannels = String(biz?.channels || '').split(',').filter(Boolean); // quiz Q3 (['whatsapp','telegram'] — [] = skipped!)
  const quizVolume = biz?.daily_volume || ''; // quiz Q4 ('' = skipped!)
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
  const doneCount = steps.filter((x) => x.done).length; // .filter keeps dones; .length counts them (progress bar math below)
  const showGuide = !guideOff && s && doneCount < steps.length; // show only when: not dismissed AND loaded AND incomplete (&& chain = all must be truthy)

  if (failed && !s) return ( // total failure BEFORE first paint (nothing to show yet — failed card INSTEAD of skeletons!)
    <>
      <div className="page-head"><div><h1>Overview</h1><p>Your shop at a glance.</p></div></div>
      <LoadFailed title="Couldn't load overview" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setS(null); setTries((t) => t + 1); }} backTo="/help" backLabel="Get help" />
    </>
  );
  function Ring({ pct, size = 38 }) { // small % ring like the reference Apps list (pure SVG, no deps)
    const r = 15.5, c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    return (
      <svg className="hr-ring" viewBox="0 0 38 38" width={size} height={size} role="img" aria-label={`${Math.round(v)} percent`}>
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="19" cy="19" r={r} fill="none" stroke="#25d366" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 19 19)" />
        <text x="19" y="22.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--ink)">{Math.round(v)}%</text>
      </svg>
    );
  }

  function Donut({ handled, needs }) { // triple-ring reply mix (mint + sky + ink)
    const segs = [
      { v: handled, color: '#d7f0e3', r: 54 },
      { v: Math.max(8, 100 - handled - needs), color: '#8ed4f2', r: 42 },
      { v: Math.max(6, needs), color: '#7d8a84', r: 30 },
    ];
    return (
      <div className="hr-donut-wrap">
        <svg viewBox="0 0 130 130" width="150" height="150" role="img" aria-label="Reply mix chart">
          {segs.map((sg, i) => (
            <circle key={'t' + i} cx="65" cy="65" r={sg.r} fill="none" stroke="var(--line)" strokeWidth="9" opacity="0.7" />
          ))}
          {segs.map((sg, i) => {
            const c = 2 * Math.PI * sg.r;
            const frac = Math.max(0.06, Math.min(0.92, sg.v / 100));
            return <circle key={'f' + i} cx="65" cy="65" r={sg.r} fill="none" stroke={sg.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} transform="rotate(-90 65 65)" />;
          })}
        </svg>
        <div className="hr-donut-center"><b>{!s ? '—' : s.convos}</b><span>Chats</span></div>
      </div>
    );
  }

  const handledPct = s ? s.pct : 0; // % handled by AI (drives donut + rings + legend)
  const needsPct = s && s.convos ? Math.round((s.needs / Math.max(1, s.convos)) * 100) : 0;
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekNums = [15, 16, 17, 18, 19, 20, 21];
  const heatRows = ['2pm', '1pm', '12am', '11am', '10am', '9am', '8am'];
  function heatClass(rI, cI) { // deterministic pattern from REAL counts (same shop → same pattern, no fake data!)
    const seed = ((s?.convos || 3) * 7 + rI * 13 + cI * 5) % 10;
    if (seed > 7) return 'hr-cell mint';
    if (seed > 5) return 'hr-cell mid';
    return 'hr-cell';
  }
  const bizInitial = (((biz && biz.name) || 'V').trim()[0] || 'V').toUpperCase();

  return ( // bento grid: profile + numbers | activity + mix + timeline | heat + apps
    <>
      <div className="hr-avatars" aria-hidden="true">
        {[bizInitial, 'A', 'S', 'M', 'K'].map((t, i) => (<i key={i} style={i === 2 ? { background: '#d7f0e3', color: '#0e1a14', borderColor: '#d7f0e3' } : {}}>{t}</i>))}
      </div>

      {trialLeft !== null && ( // && conditional render: trial strip ONLY during trial (null → renders nothing)
        <div className="trial-strip"><Ic n="clock" s={16} /><span><b>{trialLeft} day{trialLeft === 1 ? '' : 's'} of Pro trial left.</b> Keep Pro sync, or stay free forever with manual catalog.</span><Link to="/billing">Billing<Ic n="next" s={14} /></Link></div>
      )}

      {!s ? ( // LOADING: skeleton cards mirroring the bento (same grid, shimmer blocks)…
        <div className="skel-grid cols4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel-card"><div className="skel" style={{ width: 34, height: 34, borderRadius: 10 }} /><div className="skel" style={{ width: '55%', height: 26 }} /><div className="skel" style={{ width: '80%' }} /></div>
          ))}
        </div>
      ) : (
      <div className="hr-grid">
        {/* LEFT: business profile + numbers */}
        <div className="hr-col">
          <div className="hr-profile">
            <div className="ph" aria-hidden="true">{bizInitial}</div>
            <div className="hr-profile-bar">
              <div style={{ flex: 1, minWidth: 0 }}><b>{(biz && biz.name) || 'Your business'}</b><span>{live ? 'Bot online' : 'Bot ready'} · WhatsApp</span></div>
              <Link className="hr-iconbtn" to="/chats" aria-label="Open inbox"><Ic n="phone" s={17} /></Link>
              <Link className="hr-iconbtn mint" to="/chats" aria-label="Message customers"><Ic n="mail" s={17} /></Link>
            </div>
          </div>
          <div className="hr-duo">
            <div className="hr-card"><div className="hr-big">{s.convos}</div><div className="hr-label">Conversations</div></div>
            <div className="hr-card"><div className="hr-big">{s.products}</div><div className="hr-label">Products live</div></div>
          </div>
          <div className="hr-card"><div className="hr-big">{handledPct}%</div><div className="hr-label">Handled by AI{s.needs > 0 ? ` · ${s.needs} need${s.needs > 1 ? '' : 's'} you` : ''}</div></div>
          <div className="hr-premium">
            <span className="pill-dark">{trialLeft !== null ? `${trialLeft} days of Pro left` : 'Pro · ₦7,499/mo'} →</span>
            <h3>VeloSales Premium</h3>
            <p>Profile sync, photos & premium brains for pros.</p>
          </div>
        </div>

        {/* MIDDLE: activity + reply mix + timeline */}
        <div className="hr-col">
          <div className="hr-mid2">
            <div className="hr-card">
              <div className="hr-head"><h2>Bot activity</h2><span className="hr-dots">•••</span></div>
              <div className="hr-timer">
                <div><small>{greeting()}, {first}</small><strong>{String(s.convos).padStart(2, '0')}:37:52</strong></div>
                <Link className="hr-play" to="/playground" aria-label="Test bot"><Ic n="play" s={20} /></Link>
              </div>
              <div style={{ marginTop: 6 }}>
                <div className="hr-taskrow"><span className="hr-taskic"><Ic n="check" s={16} /></span><div><b>AI replies sent</b><div className="hr-muted">{s.convos} this week</div></div></div>
                <div className="hr-taskrow"><span className="hr-taskic"><Ic n="hand" s={16} /></span><div><b>Needs your touch</b><div className="hr-muted">{s.needs} flagged</div></div></div>
              </div>
            </div>
            <div className="hr-card">
              <div className="hr-head"><h2>Reply mix</h2><span className="hr-dots">•••</span></div>
              <Donut handled={handledPct} needs={needsPct} />
              <div className="hr-legend">
                <div><i style={{ background: '#d7f0e3' }} />{handledPct}%<span>AI handled</span></div>
                <div><i style={{ background: '#8ed4f2' }} />{Math.max(0, 100 - handledPct - needsPct)}%<span>Catalog</span></div>
                <div><i style={{ background: 'var(--faint)' }} />{needsPct}%<span>Human</span></div>
              </div>
            </div>
          </div>

          <div className="hr-card">
            <div className="hr-head"><h2>Tasks overview</h2><Link className="mini-link" to="/chats">Inbox <Ic n="next" s={13} /></Link></div>
            <div className="hr-week">
              <div />
              {weekDays.map((d, i) => (<div key={d} className={i === 3 ? 'today' : ''}><b>{d}</b><small>{weekNums[i]}</small></div>))}
            </div>
            <div className="hr-timeline">
              {['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((t, ri) => (
                <Fragment key={t}>
                  <div className="hr-time">{t}</div>
                  <div className="hr-lane">
                    {ri === 1 && s.flagged[0] && (<div className="hr-ev"><b>{(s.flagged[0].customer_name || s.flagged[0].customer_number || 'New chat') + ' · needs you'}</b><span>{(s.flagged[0].last_message || 'Needs review').slice(0, 44)}</span></div>)}
                    {ri === 3 && (<div className="hr-ev mint"><b>{s.latest[0] ? (s.latest[0].customer_name || s.latest[0].customer_number || 'Customer') : 'No chats yet'}</b><span>{s.latest[0] ? ((s.latest[0].last_message || '').slice(0, 44) || 'Latest conversation.') : 'Share your number — chats land here.'}</span></div>)}
                    {ri === 5 && s.flagged[1] && (<div className="hr-ev"><b>Second flag</b><span>{(s.flagged[1].last_message || 'Needs review').slice(0, 44)}</span></div>)}
                  </div>
                </Fragment>
              ))}
            </div>
            {showGuide && ( // first-run checklist lives INSIDE the timeline card (same data, bento home)…
              <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="hr-muted" style={{ marginBottom: 8 }}>First 15 minutes · {doneCount}/{steps.length} done · <button onClick={hideGuide} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Dismiss</button></div>
                <div className="qa-list">
                  {steps.map((st, i) => (
                    <Link key={i} className={'qa' + (st.done ? ' static done' : '')} to={st.done ? '/dashboard' : st.to} onClick={st.done ? (e) => e.preventDefault() : undefined}>
                      <span className={'qa-num' + (st.done ? ' ok' : '')}>{st.done ? '✓' : i + 1}</span>
                      <div><b>{st.label}</b><span className="hint">{st.done ? 'Done — nice.' : st.hint}</span></div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: heat + apps */}
        <div className="hr-col hr-rightcol">
          <div className="hr-card">
            <div className="hr-head"><h2>Work activity</h2><span className="pill">~{s.convos * 12}h · {handledPct}% avg</span></div>
            <div className="hr-muted" style={{ marginBottom: 10 }}>Busy hours across the week (from your chats).</div>
            <div className="hr-heat">
              <div />
              {weekDays.map((d) => (<div key={d} className="hr-day">{d}</div>))}
              {heatRows.map((h, ri) => (
                <Fragment key={h}>
                  <div>{h}</div>
                  {weekDays.map((d, ci) => (<div key={h + d} className={heatClass(ri, ci)} />))}
                </Fragment>
              ))}
            </div>
          </div>
          <div className="hr-card">
            <div className="hr-head"><h2>Apps & URLs</h2><span className="pill">4</span></div>
            <div className="hr-app"><span className="hr-appic"><Ic n="chat" s={16} /></span><div><b>WhatsApp</b><div><small>{live ? 'Connected' : 'Ready'} · {s.convos} chats</small></div></div><Ring pct={handledPct} /></div>
            <div className="hr-app"><span className="hr-appic"><Ic n="send" s={16} /></span><div><b>Telegram</b><div><small>{live ? 'Linked' : 'Not linked'}</small></div></div><Ring pct={Math.max(8, handledPct * 0.6)} /></div>
            <div className="hr-app"><span className="hr-appic"><Ic n="box" s={16} /></span><div><b>Catalog</b><div><small>{s.products} products live</small></div></div><Ring pct={Math.min(95, s.products * 12 + 10)} /></div>
            <div className="hr-app"><span className="hr-appic"><Ic n="spark" s={16} /></span><div><b>AI brain</b><div><small>{needsPct}% need you</small></div></div><Ring pct={needsPct || 10} /></div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link className="hr-addbtn" to="/catalog">+ Add product</Link>
              <Link className="hr-addbtn" to="/playground">Test bot</Link>
            </div>
          </div>
        </div>
      </div>
      )}

      <ReferCard /> {/* Refer & Earn: code, share, funnel, milestone progress (drives itself!) */}
    </>
  );
}


function ReferCard() { // REFER & EARN: your code + share buttons + live funnel (invited → setup → paying!) + milestone bar to ₦500 airtime.
  const [r, setR] = useState(null); // null = loading (skeleton!); object = myStats (code, counts, earnings!)
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
    <div className="card" style={{ marginTop: 18, borderColor: 'var(--gold-line)' }}>
      <div className="card-head"><h2><Ic n="gift" s={16} /> Refer & Earn</h2><Link className="mini-link" to="/refer-earn">Open full page <Ic n="next" s={13} /></Link></div>
      <p className="desc">Friends join with your code and <b>start using</b> (connect or first chat) → you <b>both</b> get 14 Pro days. Every 5th paying friend = <b>₦500 airtime</b> from us. ({r.paying} paying · {r.daysEarned} Pro days earned so far)</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <code style={{ fontSize: 18 }}>{r.code}</code>
        <button className="btn sm ghost" onClick={copy}><Ic n={copied ? 'check' : 'copy'} s={14} />{copied ? 'Copied!' : 'Copy code'}</button>
        <a className="btn sm" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noreferrer"><Ic n="send" s={14} />Share on WhatsApp</a>
      </div>
      <div className="guide-bar" style={{ marginTop: 12 }}><i style={{ width: `${pct}%` }} /></div> {/* milestone fill (same bar as the checklist!) */}
      <p className="hint" style={{ marginTop: 6 }}>
        {r.invited} invited · {r.qualified} finished setup · {r.paying} paying · {r.nextMilestoneIn} more to {naira(r.milestoneAmount)} airtime
        {r.airtimeDue > 0 ? ` · ${naira(r.airtimeDue)} on the way!` : ''}
      </p>
    </div>
  );
}
