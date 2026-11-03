// ── frontend/src/pages/Dashboard.jsx ─────────────────────────────
// WHAT: Home, the screen after login, on frosted glass. The chats that need you
// come first and turn coral when they are real, then today's replies, Velo's
// answer rate, the catalog, this week's chats, who is waiting, and the channels.
// Real shop data only, no invented numbers. The phone's copy is home_screen.dart.
// DATA: four parallel API calls on mount, crunched into one summary object `s`.
import { useEffect, useState } from 'react'; // useState = s/bill/guideOff; useEffect = fetch-on-mount
import { Link } from 'react-router-dom'; // Link = client-side nav (no page reload, unlike <a>)
import { api, pop } from '../lib/api.js'; // api() fetches; pop() celebrates payment returns
import { describeNetError } from '../lib/netDetail.js'; // one voice for load failures (offline? waking? stale?)
import LoadFailed from '../components/LoadFailed.jsx'; // branded failed card + Retry (never eternal skeletons!)
import Ic from '../components/icons.jsx'; // <Ic n="chat"/> icon set
import { waitedLong, waitedShort } from '../lib/waited.js'; // "12 minutes" / "12m"
import CustomerFace from '../components/CustomerFace.jsx'; // real photo, or a person-shaped icon


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
  const [chan, setChan] = useState(null); // channel status for the Channels row
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
        if (ch) setChan(ch);
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
          answered: c.length - needs.length, // chats Velo handled without a person
          missingPrice: (products || []).filter((p) => !p.price).length, // catalog gaps the owner can fix
          oldestWaiting: needs.reduce((old, x) => { const u = x.updated_at || x.created_at; return !old || new Date(u) < new Date(old) ? u : old; }, null),
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

  function WeekChart({ data }) { // this week's chats, drawn to scale from real counts
    const W = 660, top = 20, base = 190, max = Math.max(4, ...data);
    const x = (i) => 10 + i * ((W - 20) / 6);
    const y = (v) => base - (v / max) * (base - top);
    const pts = data.map((v, i) => x(i) + ',' + y(v)).join(' ');
    const dayName = (i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return DAYS[d.getDay()]; };
    const words = data.map((v, i) => dayName(i) + ' ' + v).join(', ');
    return (
      <svg className="dg-chart" viewBox={'0 0 ' + W + ' 226'} role="img" aria-label={'Chats per day: ' + words}>
        <defs>
          <linearGradient id="dg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="dg-stop-a" /><stop offset="1" className="dg-stop-b" /></linearGradient>
          <linearGradient id="dg-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" className="dg-stop-c" /><stop offset="1" className="dg-stop-d" /></linearGradient>
        </defs>
        {[top, (top + base) / 2, base].map((g) => <line key={g} className="dg-grid" x1="10" x2={W - 10} y1={g} y2={g} />)}
        <polygon fill="url(#dg-fill)" points={'10,' + base + ' ' + pts + ' ' + (W - 10) + ',' + base} />
        <polyline fill="none" stroke="url(#dg-line)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={pts} />
        <circle className="dg-dot" cx={W - 16} cy={y(data[6])} r="7" />
        {data.map((_, i) => <text key={i} className="dg-day" x={Math.min(W - 24, Math.max(22, x(i)))} y="218" textAnchor="middle">{dayName(i)}</text>)}
      </svg>
    );
  }

  const week = s ? s.days.reduce((a, b) => a + b, 0) : 0;
  const pct = usage && !usage.unlimited && usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const hot = !!(s && s.needs > 0); // coral only when a real chat is waiting
  const ringLen = 2 * Math.PI * 22;
  const Arrow = ({ size = 18 }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>;
  const channels = chan ? [
    ['WhatsApp', chan.whatsapp && chan.whatsapp.live ? 'live' : 'off', !!(chan.whatsapp && chan.whatsapp.live)],
    ['Telegram', chan.telegram && chan.telegram.connected ? 'live' : 'off', !!(chan.telegram && chan.telegram.connected)],
    ['Facebook', 'soon', false],
    ['Instagram', 'soon', false],
  ] : [];

  return (
    <div className="dg">
      <div className="dg-head">
        <div className="dg-greet">
          {!live && <div className="dg-status"><i />Connect a channel to go live</div>}
          <h1><span>Hi {first},</span> what do you need today?</h1>
        </div>
        <div className="dg-head-actions">
          <Link className="btn ghost lg" to="/catalog"><Ic n="plus" s={18} />Add product</Link>
          <Link className="btn lg btn-go" to="/playground">Test Drive<span className="btn-go-ic"><Arrow /></span></Link>
        </div>
      </div>

      {trialLeft !== null && ( // trial strip ONLY during trial (null → renders nothing)
        <div className="trial-strip"><Ic n="clock" s={16} /><span><b>{trialLeft} day{trialLeft === 1 ? '' : 's'} of Pro trial left.</b> Keep Pro sync, or stay free forever with manual catalog.</span><Link to="/billing">See plans<Ic n="next" s={14} /></Link></div>
      )}

      <div className="dg-stats">
        <Link className={'dg-stat dg-hot' + (hot ? ' is-on' : ' glass')} to="/chats">
          <span className="dg-hot-top">{s ? <span className="dg-hot-num">{s.needs}</span> : <span className="skel" style={{ width: 44, height: 44 }} />}<span className="dg-hot-go"><Arrow /></span></span>
          <span className="dg-hot-text"><b>{s && s.needs === 0 ? 'All chats handled' : s && s.needs === 1 ? 'Chat needs you' : 'Chats need you'}</b><span>{s && s.oldestWaiting ? 'Oldest waiting ' + waitedLong(s.oldestWaiting) : 'Nobody is waiting on you'}</span></span>
        </Link>
        <div className="dg-stat glass">
          <div className="dg-stat-top"><span className="dg-lbl">Replies today</span>
            {usage && !usage.unlimited && <svg className="dg-ring" viewBox="0 0 56 56" role="img" aria-label={pct + ' percent of today\'s replies used'}><circle className="dg-ring-bg" cx="28" cy="28" r="22" /><circle className={'dg-ring-fg' + (pct >= 80 ? ' is-near' : '')} cx="28" cy="28" r="22" strokeDasharray={(pct / 100) * ringLen + ' ' + ringLen} transform="rotate(-90 28 28)" /></svg>}
          </div>
          <div><span className="dg-num">{usage ? usage.used : '–'}</span>{usage && !usage.unlimited && <span className="dg-of"> of {usage.limit}</span>}<div className="dg-sub">Resets at midnight</div></div>
        </div>
        <div className="dg-stat glass">
          <span className="dg-lbl">Answered by Velo</span>
          <div><span className="dg-num is-good">{s ? s.pct + '%' : '–'}</span><div className="dg-sub">{s ? s.answered + ' of ' + s.convos + ' chats' : ' '}</div></div>
        </div>
        <Link className="dg-stat dg-catalog glass" to="/catalog">
          <span className="dg-lbl">Catalog</span>
          <div><span className="dg-num">{s ? s.products : '–'}</span><span className="dg-of"> product{s && s.products === 1 ? '' : 's'}</span><div className={'dg-sub' + (s && s.missingPrice ? ' is-warn' : '')}>{s && s.missingPrice ? s.missingPrice + (s.missingPrice === 1 ? ' needs a price' : ' need a price') : 'All priced'}</div></div>
        </Link>
      </div>

      <div className="dg-quick">
        <Link className="dg-q glass" to="/catalog"><span className="dg-q-ic"><Ic n="plus" s={18} /></span>Add product</Link>
        <Link className="dg-q glass" to="/playground"><span className="dg-q-ic"><Ic n="chat" s={18} /></span>Test bot</Link>
        <Link className="dg-q glass" to="/connect"><span className="dg-q-ic"><Ic n="next" s={18} /></span>Connect</Link>
      </div>

      <div className="dg-ask glass">
        <Link className="dg-ask-box" to="/velosales-ai">Ask Velo anything about your shop</Link>
        <Link className="dg-ask-go" to="/velosales-ai" aria-label="Open Chat with Velo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></Link>
      </div>

      <div className="dg-panels">
        <section className="dg-panel dg-panel-chart glass">
          <div className="dg-panel-head"><h2>Chats this week</h2><span>{week} chat{week === 1 ? '' : 's'}, last 7 days</span></div>
          {s ? <WeekChart data={s.days} /> : <div className="skel" style={{ height: 190, marginTop: 12, borderRadius: 12 }} />}
        </section>
        <section className="dg-panel glass">
          <div className="dg-panel-head"><h2>Waiting for you</h2><Link to="/chats">Open inbox</Link></div>
          {!s ? <div className="skel" style={{ height: 120, marginTop: 12, borderRadius: 12 }} /> : s.flagged.length === 0 ? (
            <div className="ov-empty"><span className="ov-empty-ic"><Ic n="checkCircle" s={22} /></span><b>Nothing needs you right now</b><span>Chats land here when Velo needs a person.</span></div>
          ) : (
            <div className="dg-rows">
              {s.flagged.map((c, i) => (
                <Link className="dg-row" key={i} to="/chats">
                  <span className="dg-face"><CustomerFace photo={c.customer_photo} /></span>
                  <span className="dg-row-main"><b>{c.customer_name || c.customer_number || 'New chat'}</b><span>{(c.last_message || 'Needs review').slice(0, 64)}</span></span>
                  <span className="dg-row-time">{waitedShort(c.updated_at || c.created_at)}</span>
                </Link>
              ))}
            </div>
          )}
          {channels.length > 0 && (
            <div className="dg-chans">
              <b>Your channels</b>
              <div>{channels.map(([n, st, on]) => <Link key={n} to="/connect" className={'dg-chan' + (on ? ' is-on' : '')}>{n} {st}</Link>)}</div>
            </div>
          )}
        </section>
      </div>

      {showGuide && (
        <section className="dg-panel glass">
          <div className="dg-panel-head"><h2>First 15 minutes</h2><button className="mini-link" onClick={hideGuide}>Dismiss</button></div>
          <p className="ov-sub">{doneCount} of {steps.length} done</p>
          <div className="ov-prog"><i style={{ width: ((doneCount / steps.length) * 100) + '%' }} /></div>
          <div className="ov-steps">
            {steps.map((st, i) => st.done ? null : (
              <Link key={i} className="ov-step" to={st.to}>
                <span className="ov-step-num">{i + 1}</span>
                <span className="ov-step-main"><b>{st.label}</b><span>{st.hint}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
