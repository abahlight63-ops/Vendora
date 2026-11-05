// ── frontend/src/components/Shell.jsx ────────────────────────────
// WHAT: the app frame around every logged-in page: sidebar nav + topbar +
// mobile drawer + bottom bar + footer + Tour mount. <Shell biz={me}> wraps
// page content (children). No npm modules beyond react-router-dom.
// ROUTER LESSON: NavLink = <a> that knows the current route (auto .active
// class); useLocation = current URL; useNavigate = go somewhere in code.
import { useEffect, useState } from 'react'; // useState = drawer open flag; useEffect = title + drawer side-effects
import Logo from './Logo.jsx'; // theme-aware brand mark (blue dark / green light!)
import { NavLink, useLocation, useNavigate } from 'react-router-dom'; // NavLink (active-aware link), useLocation (current path), useNavigate (code navigation)
import { api, toast } from '../lib/api.js'; // api() for the logout call (+ version check below)
import ThemeToggle from './ThemeToggle.jsx'; // sun/moon button (topbar — light mode for sensitive eyes!)
import Notifications from './Notifications.jsx'; // bell (payment + update alerts)
import Tour from './Tour.jsx'; // first-run coachmarks (mounted once here = available everywhere)
const MAIN = [['overview', 'Home', '/dashboard'], ['chats', 'Inbox', '/chats'], ['orders', 'Orders', '/orders'], ['broadcasts', 'Broadcasts', '/broadcasts'], ['catalog', 'Catalog', '/catalog'], ['connect', 'Channels', '/connect'], ['insights', 'Insights', '/insights']]; // the five daily jobs (same words on the phone)
const MORE = [['billing', 'Plan and usage', '/billing'], ['playground', 'Test Drive', '/playground'], ['velosalesai', 'Chat with Velo', '/velosales-ai'], ['gift', 'Refer & Earn', '/refer-earn'], ['settings', 'Settings', '/settings'], ['help', 'Help Center', '/help']]; // everything else, one tap behind More
const ALL = [...MAIN, ...MORE]; // all pages in one array (page search)
const TITLES = { '/dashboard': 'Home', '/chats': 'Inbox', '/orders': 'Orders', '/broadcasts': 'Broadcasts', '/catalog': 'Catalog', '/connect': 'Channels', '/playground': 'Test Drive', '/insights': 'Insights', '/velosales-ai': 'Chat with Velo', '/refer-earn': 'Refer & Earn', '/billing': 'Plan and usage', '/profile': 'Business profile', '/ai-settings': 'AI settings', '/settings': 'Settings', '/help': 'Help Center', '/notifications': 'Notifications', '/contact-sales': 'Business plan', '/onboarding': 'Get started', '/login': 'Sign in' }; // object lookup: path → human title (topbar breadcrumb + document.title)

function Icon({ k }) { // tiny inline SVG set (stroke = inherits text color; no icon library installed)
  const p = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }; // shared props object spread into every <svg> (currentColor = matches surrounding text)
  if (k === 'overview') return (<svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>); // {...p} = spread all shared props; each if = one icon (early returns)
  if (k === 'chats') return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /></svg>); // speech bubble (SVG path = vector drawing commands)
  if (k === 'broadcasts') return (<svg {...p}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>); // megaphone
  if (k === 'orders') return (<svg {...p}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" /></svg>); // receipt
  if (k === 'catalog') return (<svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></svg>); // box/package
  if (k === 'connect') return (<svg {...p}><path d="M9 7V2M15 7V2M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /></svg>); // plug (Connect page — drawn, never emoji)
  if (k === 'playground') return (<svg {...p}><path d="M12 3v4M9 13h.01M15 13h.01M9.5 16.5h5" /><rect x="5" y="7" width="14" height="12" rx="3" /></svg>); // bot face
  if (k === 'velosalesai') return (<svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></svg>); // sparkles (VeloSales Ai = magic)
  if (k === 'insights') return (<svg {...p}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>); // bar chart
  if (k === 'billing') return (<svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>); // credit card
  if (k === 'profile') return (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>); // person
  if (k === 'settings') return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></svg>); // gear
  if (k === 'aisettings') return (<svg {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></svg>); // sliders (AI settings — the assistant's dials)
  if (k === 'more') return (<svg {...p}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>); // three dots (the More menu)
  if (k === 'chev') return (<svg {...p} width="16" height="16"><path d="M6 9l6 6 6-6" /></svg>); // More opens downward
  if (k === 'x') return (<svg {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>); // close (drawer + dialogs — drawn, never a text glyph)
  if (k === 'logout') return (<svg {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 16l4-4-4-4" /><path d="M14 12H3" /></svg>); // door + arrow leaving it (sign out — never a bare X, which reads "close panel")
  if (k === 'gift') return (<svg {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8s-1.5-5-4.5-5S5 8 12 8zM12 8s1.5-5 4.5-5S19 8 12 8z" /></svg>); // gift box (Refer & Earn!)
  return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>); // default = help "?" (unknown keys never render broken)
}

function TopSearch() { // topbar page finder: filters ALL nav pages, Enter/click navigates (real nav, no fake results!)
  const navigate = useNavigate(); // code navigation (same as logout uses)
  const [q, setQ] = useState(''); // query text (empty = closed, no dropdown)
  const [open, setOpen] = useState(false); // dropdown visible? (focus opens, Esc/blur closes)
  const hits = q.trim() // trim: "  inbox " still matches…
    ? ALL.filter(([, label]) => label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) // …case-insensitive substring, max 6 (keep it scannable!)
    : [];
  function go(href) { setQ(''); setOpen(false); navigate(href); } // reset + go (dropdown unmounts on nav anyway via pathname effect below? no — TopSearch is separate, so reset here!)
  return (
    <div className="tsearch">
      <div className="tsearch-box">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
          placeholder="Search pages…" aria-label="Search pages"
          onKeyDown={(e) => { if (e.key === 'Enter' && hits.length) go(hits[0][2]); if (e.key === 'Escape') { setQ(''); setOpen(false); e.target.blur(); } }} />
      </div>
      {open && hits.length > 0 && (
        <div className="tsearch-pop" role="listbox" aria-label="Matching pages">
          {hits.map(([k, label, href]) => (
            <button key={k} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); go(href); }}><Icon k={k} /><span>{label}</span><span className="hint">{href}</span></button> // onMouseDown (not onClick): fires BEFORE input blur closes the pop!
          ))}
        </div>
      )}
    </div>
  );
}

export default function Shell({ biz, children, theme = 'light', onToggleTheme = () => {}, onLogout = () => {} }) { // props: biz (business object), children (the page!), theme + toggle (defaults = safe if omitted), onLogout (App clears login state — without it /login bounces back to /dashboard!)
  const { pathname } = useLocation(); // destructure current path from router (re-renders on navigation)
  const navigate = useNavigate(); // navigate('/login') = go there in code (after logout)
  const [menuOpen, setMenuOpen] = useState(false); // mobile drawer open? (desktop sidebar always visible via CSS)
  const inMore = MORE.some(([, , href]) => href === pathname); // the current page lives under More, so More stays open
  const [moreOpen, setMoreOpen] = useState(false); // the owner opened More by hand
  const [confirmOut, setConfirmOut] = useState(false); // the sign-out confirmation (one tap away from losing your chat list)
  const [updateBanner, setUpdateBanner] = useState(null); // {version} while the 2-min NEW window is open (null = hidden!)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine)); // the browser's own network verdict (instant, no polling)
  useEffect(() => { // connection truth is an EVENT, not a guess: flip the calm banner the moment the OS knows
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  useEffect(() => { // side-effects: tab title + robots, both follow the route
    document.title = 'VeloSales Ai — ' + (TITLES[pathname] || 'Home'); // || fallback keeps the tab readable
    const meta = document.getElementById('route-robots');
    if (meta) meta.setAttribute('content', 'noindex,follow'); // private app pages: don't let Google index an empty shell
    return () => { if (meta) meta.setAttribute('content', 'index,follow'); }; // leaving the app (sign-out → /login) restores indexing for public pages
  }, [pathname]);
  useEffect(() => { setMenuOpen(false); }, [pathname]); // auto-close drawer on every navigation (pick a link → drawer vanishes)
  useEffect(() => { // lock body scroll while drawer open (background mustn't scroll under the overlay)…
    document.body.style.overflow = menuOpen ? 'hidden' : ''; // '' restores default ('hidden' disables scroll)
    return () => { document.body.style.overflow = ''; }; // cleanup: always restore on unmount (stuck scroll = broken app!)
  }, [menuOpen]); // re-run when drawer toggles
  useEffect(() => { // app-update notice: version changed since last visit → 2-min NEW banner + toast…
    let timer = null;
    api('/api/version').then(({ ok, data }) => {
      if (!ok || !data?.version) return;
      let last = null, seenAt = 0;
      try {
        last = localStorage.getItem('vendora-version');
        seenAt = Number(localStorage.getItem('vendora-version-seen-at') || 0);
      } catch {}
      const now = Date.now();
      if (last && last !== data.version) {
        toast('VeloSales Ai updated to v' + data.version + ' — check out what changed!', 'ok');
        try {
          localStorage.setItem('vendora-version', data.version);
          localStorage.setItem('vendora-version-seen-at', String(now));
        } catch {}
        setUpdateBanner({ version: data.version }); // fresh update → banner for 2 minutes!
        timer = setTimeout(() => setUpdateBanner(null), 2 * 60 * 1000);
      } else if (last && seenAt && (now - seenAt) < 2 * 60 * 1000) {
        setUpdateBanner({ version: data.version }); // reload inside the window → banner for the REMAINDER!
        timer = setTimeout(() => setUpdateBanner(null), 2 * 60 * 1000 - (now - seenAt));
      } else {
        try { localStorage.setItem('vendora-version', data.version); } catch {}
      }
    });
    return () => { if (timer) clearTimeout(timer); }; // unmount → drop the timer (no leaked timeouts!)
  }, []); // mount-only (one check per page load, not per navigation)
  async function logout() {
    setMenuOpen(false); // close the drawer first (both topbar + drawer buttons use this)
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {} // try destroy server session (empty catch = still log out locally on network failure)
    onLogout(); // clear App's login state FIRST — otherwise /login sees stale `me` and bounces back to /dashboard
    navigate('/login', { replace: true }); // replace = signed-out page can't "back" into the app
  } // logout() = server destroy + local clear + go to login (all three, every time)
  const safeName = biz?.name || 'Your business'; // ?. + || : biz may load late — never render "undefined"
  const initial = (safeName.trim()[0] || 'V').toUpperCase(); // avatar letter: first char uppercased ([0] = first character)
  const mobile = MAIN.filter(([k]) => k !== 'insights' && k !== 'orders' && k !== 'broadcasts'); // bottom bar: four jobs + More (Orders and Insights sit in the drawer on phones)
  const showMore = moreOpen || inMore || menuOpen; // the phone's drawer always shows everything
  const moreActive = inMore || pathname === '/insights' || pathname === '/orders' || pathname === '/broadcasts'; // the bar's More lights up for anything behind it
  return (
    <> {/* fragment: multiple roots without wrapper div */}
      <div className="shell"> {/* flex row: sidebar + main column (CSS) */}
        {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />} {/* && conditional: backdrop ONLY when open; click = close */}
        <aside className={'sidebar' + (menuOpen ? ' open' : '')}> {/* .open slides the drawer in (CSS transform, mobile only) */}
          <div className="logo"><Logo alt="VeloSales Ai" /><span>VeloSales Ai</span>
            <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon k="x" /></button> {/* drawn X, mobile only (CSS) */}
          </div>
          <nav aria-label="Main">{MAIN.map(([k, label, href]) => (<NavLink key={k} to={href} onClick={() => setMenuOpen(false)}><Icon k={k} /><span>{label}</span></NavLink>))}</nav>
          <button className="nav-more-btn" aria-expanded={showMore} onClick={() => setMoreOpen((v) => !v)}><Icon k="more" /><span>More</span><span className="chev"><Icon k="chev" /></span></button>
          {showMore && <nav aria-label="More">{MORE.map(([k, label, href]) => (<NavLink key={k} to={href} onClick={() => setMenuOpen(false)}><Icon k={k} /><span>{label}</span></NavLink>))}</nav>}
          {biz && biz.tier !== 'plus' && (
            <div className="nav-upsell">
              <b>{biz.tier === 'pro' ? 'Add voice notes' : 'Get more replies'}</b>
              <p>{biz.tier === 'pro' ? 'Pro adds voice notes and our smartest AI.' : 'Go from 50 to 500 replies a day, with product photos.'}</p>
              <NavLink to="/billing" onClick={() => setMenuOpen(false)}>{biz.tier === 'pro' ? 'Upgrade to Pro' : 'Upgrade to Plus'}</NavLink>
            </div>
          )}
          <div className="foot">
            <div className="foot-note">© 2026 VeloSales Ai</div>
            <button className="drawer-signout" onClick={() => { setMenuOpen(false); setConfirmOut(true); }}><Icon k="logout" /><span>Sign out</span></button> {/* mobile-only: the topbar has no room for it on a phone, so the drawer carries it */}
          </div> {/* margin-top:auto in CSS pins this block to the bottom of the drawer */}
        </aside>
        <div className="main-col"> {/* right column: topbar + scrolling page */}
          <header className="topbar"> {/* sticky header (CSS position:sticky) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}> {/* inline style object (camelCase CSS!) for one-off layout */}
              <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"> {/* hamburger: 3 spans = 3 lines (CSS); desktop-hidden */}
                <span /><span /><span /> {/* self-closing spans (no children) */}
              </button>
              <div><div className="crumb">VeloSales Ai / {TITLES[pathname] || 'Home'}</div><h1>{safeName}</h1></div> {/* breadcrumb + shop name */}
            </div>
            <TopSearch /> {/* page finder sits center (desktop only via CSS) */}
            <div className="top-right">
              {biz && biz.tier !== 'plus' && <NavLink className="upgrade-pill" to="/billing">{biz.tier === 'pro' ? 'Get Pro' : 'Upgrade'}</NavLink>} {/* always in sight until the top plan */}
              <span className="live-dot"><i />AI online</span> {/* pulsing status pill (<i> = the dot, CSS) */}
              <Notifications /> {/* bell sits before theme toggle (thumb-side on mobile) */}
              <ThemeToggle theme={theme} onToggle={onToggleTheme} /> {/* sun/moon switch */}
              {biz?.avatar_url
                ? <img className="avatar avatar-img" src={biz.avatar_url} alt={safeName} title={safeName} /> // the owner's own picture (Settings → pencil); falls back to the initial below
                : biz?.avatar_emoji ? <div className="avatar avatar-emoji" title={safeName} aria-label={safeName}>{biz.avatar_emoji}</div> : <div className="avatar" title={safeName}>{initial}</div>} {/* title = hover tooltip */}
              <button className="btn ghost sm signout-btn" onClick={() => setConfirmOut(true)}>Sign out</button> {/* ghost = outline style; sm = small; .signout-btn hides on phones (drawer carries sign-out instead) */}
            </div>
          </header>
          <main className="page">
            {!online && (
              <div className="offline-banner" role="status" aria-live="polite"> {/* honest + calm: the state, and what it means for their work */}
                <span className="offline-dot" aria-hidden="true" />
                <span><b>You’re offline.</b> We’ll keep this screen exactly as it is — reconnect and everything carries on.</span>
                <button className="btn ghost sm" onClick={() => window.location.reload()}>Try again</button>
              </div>
            )}
            {updateBanner && (
              <div className="update-banner" role="status"> {/* 2-min release banner (auto-hides!) */}
                <span className="pill new">NEW</span>
                <span>VeloSales Ai v{updateBanner.version} is live — check it out!</span>
                <button className="btn sm" onClick={() => { setUpdateBanner(null); navigate('/dashboard'); }}>Check it out</button>
                <button className="btn ghost sm" onClick={() => setUpdateBanner(null)} aria-label="Dismiss">Dismiss</button>
              </div>
            )}
            {children}</main> {/* children = THE PAGE (Dashboard/Catalog/…) rendered inside the frame */}        </div>
      </div>
      <nav className="mobile-bar"> {/* bottom tab bar: mobile only (CSS), 5 key sections */}
        {mobile.map(([k, label, href]) => (<NavLink key={k} to={href}><Icon k={k} /><span>{label}</span></NavLink>))}
        <button className={'mb-more' + (moreActive ? ' active' : '')} onClick={() => setMenuOpen(true)} aria-label="More pages"><Icon k="more" /><span>More</span></button>
      </nav>
      <Tour /> {/* coachmarks overlay (renders null until triggered) */}
      {confirmOut && (
        // A confirmation, not a punishment: nothing here is styled red, because
        // signing out is a normal thing to do — it just should not be an
        // accident one millimetre from a thumb.
        <div className="pop-overlay confirm-back" role="presentation" onClick={() => setConfirmOut(false)}>
          <div className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-out-title" onClick={(e) => e.stopPropagation()}>
            <span className="confirm-grab" aria-hidden="true" />
            <span className="confirm-av" aria-hidden="true">{biz?.avatar_url ? <img src={biz.avatar_url} alt="" /> : biz?.avatar_emoji || initial}</span>
            <h2 id="confirm-out-title">Sign out of {safeName}?</h2>
            <p className="desc">Velo keeps answering your customers while you're away. Sign in any time to see the chats.</p>
            <div className="confirm-actions">
              <button className="confirm-out" onClick={() => { setConfirmOut(false); logout(); }}><Icon k="logout" s={18} />Sign out</button>
              <button className="confirm-stay" onClick={() => setConfirmOut(false)} autoFocus>Stay signed in</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
