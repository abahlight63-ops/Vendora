// ── frontend/src/pages/Dashboard.jsx ─────────────────────────────
// WHAT: the home screen after login: greeting hero, Pro-trial strip,
// "first 15 minutes" checklist, 4 stat cards, flagged chats, activity.
// DATA: three parallel API calls on mount (products, conversations, billing),
// crunched into one summary object `s`. Skeletons render while loading.
// React patterns: useState (data + guide flag), useEffect (fetch once),
// derived values (trialLeft, steps) computed during render (no extra state!).
import { useEffect, useState } from 'react'; // useState = s/bill/guideOff; useEffect = fetch-on-mount
import { Link } from 'react-router-dom'; // Link = client-side nav (no page reload, unlike <a>)
import { api, fmtTime } from '../lib/api.js'; // api() fetches; fmtTime formats inbox timestamps
import Ic from '../components/icons.jsx'; // <Ic n="chat"/> icon set
import AdSlot from '../components/AdSlot.jsx'; // visible free-tier ad slot (Pro renders null)
import { maybeShowSponsor } from '../lib/ads.js'; // daily sponsor interstitial (free tier, silent for Pro)

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
  useEffect(() => { // runs ONCE on mount ([]): fetch everything in parallel…
    (async () => { // async IIFE (effects can't be async directly — so define + call an async fn inside)
      const [{ data: products }, { data: convos }, { data: b }, { data: ch }] = await Promise.all([ // Promise.all = 4 requests AT ONCE (faster than sequential); destructure each {data}
        api('/api/me/products'), api('/api/me/conversations'), api('/api/me/billing'), api('/api/me/channels'),
      ]);
      if (ch && ch.whatsapp && (ch.whatsapp.live || (ch.telegram && ch.telegram.connected))) setLive(true); // checklist step ticks (WhatsApp TEST passed OR Telegram on!)
      const c = convos || [], needs = c.filter((x) => x.needs_human); // || [] guards null; .filter picks flagged chats
      setS({ // crunch into ONE setState (single re-render, not three!)
        convos: c.length, // total chats
        pct: c.length ? Math.round(((c.length - needs.length) / c.length) * 100) : 100, // % handled by AI (ternary avoids divide-by-zero → 100% when empty)
        needs: needs.length, products: (products || []).length, // flagged count, catalog size
        flagged: needs.slice(0, 3), latest: c.slice(0, 3), // .slice(0,3) = first 3 for the two cards (convos already newest-first from API)
      });
      setBill(b || null); // billing (|| null normalizes undefined)
    })(); // ← invoke the IIFE immediately
    const t = setTimeout(() => { maybeShowSponsor(); }, 8000); // free-tier sponsor interstitial, 8s after Overview lands (daily cap inside; Pro = silent no-op)
    return () => clearTimeout(t); // cleanup on unmount (no stray popup after navigation)
  }, []); // [] deps = mount-only (fetch once; live updates would need polling/websocket — out of scope)
  const first = (biz?.name || 'there').split(' ')[0]; // "Amaka Beauty Studio" → "Amaka" (?. guards slow-loading biz; || 'there' fallback)
  const trialLeft = bill && bill.status === 'trialing' && bill.trial_ends // trial countdown in DAYS: only when status IS trialing AND an end date exists…
    ? Math.max(0, Math.ceil((new Date(bill.trial_ends) - Date.now()) / 86400000)) : null; // …ms difference ÷ ms-per-day, ceil UP (a partial day still counts), max(0) clamps past-dates; null = hide the strip
  const setupDone = (s?.products || 0) > 0; // ?. safe-navigates null s; drives "3 steps" vs "latest activity" card
  const [guideOff, setGuideOff] = useState(() => { try { return localStorage.getItem('vendora-guide') === 'off'; } catch { return false; } }); // lazy init reads dismissal flag (function form = runs once, not per render)
  function hideGuide() { setGuideOff(true); try { localStorage.setItem('vendora-guide', 'off'); } catch {} } // dismiss: state + persist (try/catch = private-mode safe)
  let tested = false; // plain variable (not state — read fresh each render; Playground writes the flag)
  try { tested = localStorage.getItem('vendora-tested') === '1'; } catch {} // Playground sets '1' on first test send
  const steps = [ // checklist DATA (not JSX): done flags computed from REAL data (self-ticking!)…
    { done: (s?.products || 0) > 0, label: 'Add your first product', hint: 'The AI only quotes your catalog', to: '/catalog' }, // to = where the step links
    { done: live, label: 'Connect your channels', hint: 'WhatsApp + Telegram — TEST to LIVE in minutes', to: '/connect' }, // live = TEST passed or Telegram on (Connect page owns it!)
    { done: tested || (s?.convos || 0) > 0, label: 'Test like a customer', hint: 'Ask prices, then something you don\'t sell', to: '/playground' }, // \' escapes apostrophe in single-quoted string
    { done: !!(biz?.hours && biz?.owner_number), label: 'Set hours + owner number', hint: 'So closed-hours replies feel human', to: '/profile' }, // !! forces boolean (&& returns the last value, not true/false!)
    { done: (s?.convos || 0) > 0, label: 'Get your first real chat', hint: 'Share your WhatsApp number with customers', to: '/chats' },
  ];
  const doneCount = steps.filter((x) => x.done).length; // .filter keeps dones; .length counts them (progress bar math below)
  const showGuide = !guideOff && s && doneCount < steps.length; // show only when: not dismissed AND loaded AND incomplete (&& chain = all must be truthy)

  return ( // <> fragment: hero + strip + guide + stats + two cards (no wrapper div needed)
    <>
      <div className="dash-hero"> {/* gradient banner card (CSS) */}
        <div>
          <p className="dash-eyebrow"><span className="live-dot"><i />AI on duty</span></p> {/* <i> = the pulsing dot (CSS) */}
          <h1>{greeting()}, {first}.</h1> {/* {expression} interpolates JS into JSX */}
          <p>{s && s.needs > 0 ? `${s.needs} chat${s.needs > 1 ? 's need' : ' needs'} your human touch — everything else is handled.` : "Here's what's happening on your WhatsApp while you were away."}</p> {/* nested ternary: needs>0 ? alert-text : default-text; inner ternary pluralizes */}
        </div>
        <div className="dash-cta"> {/* quick-action buttons */}
          <Link className="btn sm" to="/catalog"><Ic n="plus" s={14} /> Add product</Link> {/* icon + label inside Link (whole button navigates) */}
          <Link className="btn ghost sm" to="/playground"><Ic n="play" s={14} /> Test bot</Link>
        </div>
      </div>

      {trialLeft !== null && ( // && conditional render: trial strip ONLY during trial (null → renders nothing)
        <div className="trial-strip"><Ic n="clock" s={16} /><span><b>{trialLeft} day{trialLeft === 1 ? '' : 's'} of Pro trial left.</b> Keep Pro sync, or stay free forever with manual catalog.</span><Link to="/billing">Billing<Ic n="next" s={14} /></Link></div>
      )}

      <AdSlot /> {/* free-tier visible ads (Pro/null = renders nothing — zero layout shift for paid) */}

      {showGuide && ( // checklist card (see showGuide logic above)…
        <div className="card guide-card">
          <div className="card-head">
            <h2>Your first 15 minutes <span className="hint">· {doneCount}/{steps.length} done</span></h2> {/* live fraction */}
            <button className="skip" onClick={hideGuide}>Dismiss</button> {/* link-styled button */}
          </div>
          <div className="guide-bar"><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div> {/* progress fill: inline style width % (dynamic → must be inline, CSS can't compute) */}
          <div className="qa-list" style={{ marginTop: 12 }}>
            {steps.map((st, i) => ( // map steps → rows (i = index for numbering + key)
              <Link key={i} className={'qa' + (st.done ? ' static done' : '')} to={st.done ? '/dashboard' : st.to} onClick={st.done ? (e) => e.preventDefault() : undefined}> {/* done rows link nowhere (preventDefault cancels nav); todo rows link to their page */}
                <span className={'qa-num' + (st.done ? ' ok' : '')}>{st.done ? '✓' : i + 1}</span> {/* ✓ vs step number */}
                <div><b>{st.label}</b><span className="hint">{st.done ? 'Done — nice.' : st.hint}</span></div>
              </Link>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 10 }}>New here? <a style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => window.dispatchEvent(new Event('vendora-tour'))}>Take the 1-minute guided tour</a></p> {/* <a> WITHOUT href + onClick = action link (fires the Tour event bus); cursor:pointer keeps the hand */}
        </div>
      )}

      {!s ? ( // LOADING: skeleton stat cards mirroring the real layout (same grid, shimmer blocks)…
        <div className="skel-grid cols4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel-card"><div className="skel" style={{ width: 34, height: 34, borderRadius: 10 }} /><div className="skel" style={{ width: '55%', height: 26 }} /><div className="skel" style={{ width: '80%' }} /></div>
          ))}
        </div>
      ) : ( // LOADED: real stat cards (each a Link — whole card clickable!)…
      <div className="grid4">
        <Link className="stat link" to="/chats"><span className="stat-ic"><Ic n="chat" s={18} /></span><div className="num">{s.convos}</div><div className="lbl">Conversations</div></Link>
        <Link className="stat link good" to="/insights"><span className="stat-ic"><Ic n="spark" s={18} /></span><div className="num">{s.pct + '%'}</div><div className="lbl">Handled by AI</div></Link>
        <Link className={'stat link' + (s.needs > 0 ? ' warn' : '')} to="/chats"><span className="stat-ic"><Ic n="hand" s={18} /></span><div className="num">{s.needs}</div><div className="lbl">Need you</div></Link>
        <Link className="stat link" to="/catalog"><span className="stat-ic"><Ic n="box" s={18} /></span><div className="num">{s.products}</div><div className="lbl">Products live</div></Link>
      </div>
      )}

      <div className="grid2" style={{ marginTop: 18 }}> {/* two cards side-by-side (stack on mobile via CSS) */}
        <div className="card">
          <div className="card-head"><h2>Needs your attention</h2><Link className="mini-link" to="/chats">Inbox <Ic n="next" s={13} /></Link></div>
          <p className="desc">Chats the AI flagged instead of guessing.</p>
          {!s ? (<div className="skel-grid">{[0, 1, 2].map((i) => (<div key={i} className="skel-row"><div className="skel skel-dot" /><div className="skel-lines"><div className="skel" style={{ width: '40%' }} /><div className="skel" style={{ width: '75%' }} /></div></div>))}</div>) : s.flagged.length === 0 // nested ternary: loading → skeletons; empty → all-clear; else → rows
            ? <div className="empty"><span className="empty-ic"><Ic n="checkCircle" s={28} /></span><b>All clear</b>Nothing waiting for you right now.</div>
            : s.flagged.map((c) => (<Link key={c.id} className="qa" to="/chats"><span className="qa-dot flag" /><div><b>{c.customer_name || c.customer_number}</b><span className="hint">{(c.last_message || '').slice(0, 80)} · {fmtTime(c.updated_at)}</span></div></Link>))}
        </div>
        <div className="card">
          <div className="card-head"><h2>{setupDone ? 'Latest activity' : 'Get selling in 3 steps'}</h2></div> {/* title flips once catalog exists */}
          {!s ? (<div className="skel-grid">{[0, 1, 2].map((i) => (<div key={i} className="skel-row"><div className="skel skel-dot" /><div className="skel-lines"><div className="skel" style={{ width: '50%' }} /><div className="skel" style={{ width: '85%' }} /></div></div>))}</div>) : !setupDone ? ( // loading → skeletons; new user → 3-step links…
            <div className="qa-list">
              <Link className="qa" to="/catalog"><span className="qa-num">1</span><div><b>Add what you sell</b><span className="hint">The AI only quotes your catalog — never invents prices.</span></div></Link>
              <Link className="qa" to="/playground"><span className="qa-num">2</span><div><b>Test it like a customer</b><span className="hint">Ask "do you have blue gown?" before going live.</span></div></Link>
              <Link className="qa" to="/profile"><span className="qa-num">3</span><div><b>Set hours + FAQs</b><span className="hint">So closed-hours replies still feel human.</span></div></Link>
            </div>
          ) : ( // …active user → latest chats (static rows: not links, just status) —
            <div className="qa-list">
              {s.latest.length === 0 ? <div className="empty"><b>No chats yet</b>Share your WhatsApp number — chats land here.</div>
                : s.latest.map((c) => (<div key={c.id} className="qa static"><span className={'qa-dot ' + (c.needs_human ? 'flag' : 'ok')} /><div><b>{c.customer_name || c.customer_number}</b><span className="hint">{(c.last_message || '').slice(0, 80)} · {fmtTime(c.updated_at)}</span></div></div>))} {/* string concat picks dot color (flag=gold, ok=green) */}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
