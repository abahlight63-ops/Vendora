// ── frontend/src/components/Shell.jsx ────────────────────────────
// WHAT: the app frame around every logged-in page: sidebar nav + topbar +
// mobile drawer + bottom bar + footer + Tour mount. <Shell biz={me}> wraps
// page content (children). No npm modules beyond react-router-dom.
// ROUTER LESSON: NavLink = <a> that knows the current route (auto .active
// class); useLocation = current URL; useNavigate = go somewhere in code.
import { useEffect, useState } from 'react'; // useState = drawer open flag; useEffect = title + drawer side-effects
import { NavLink, useLocation, useNavigate } from 'react-router-dom'; // NavLink (active-aware link), useLocation (current path), useNavigate (code navigation)
import { api, toast } from '../lib/api.js'; // api() for the logout call (+ version check below)
import ThemeToggle from './ThemeToggle.jsx'; // sun/moon button (topbar)
import Notifications from './Notifications.jsx'; // bell (payment + update alerts)
import AdSlot from './AdSlot.jsx'; // visible free-tier ad slot (Pro renders null — mounted once here = on every page)
import Tour from './Tour.jsx'; // first-run coachmarks (mounted once here = available everywhere)

const GROUPS = [ // sidebar sections: label + [iconKey, label, route] rows (data-driven nav = add a row, get a link)
  { label: 'Sell', items: [['overview', 'Overview', '/dashboard'], ['chats', 'Inbox', '/chats'], ['catalog', 'Catalog', '/catalog'], ['connect', 'Connect', '/connect'], ['playground', 'Test bot', '/playground']] }, // nested arrays: [icon, label, href] per item
  { label: 'Grow', items: [['insights', 'Insights', '/insights'], ['velosalesai', 'VeloSales AI', '/velosales-ai'], ['gift', 'Refer & Earn', '/refer-earn'], ['billing', 'Billing', '/billing']] },
  { label: 'Setup', items: [['profile', 'Business', '/profile'], ['settings', 'AI settings', '/settings'], ['help', 'Help', '/help']] },
];
const ALL = GROUPS.flatMap((g) => g.items); // flatMap = map + flatten one level (all nav rows in one array for the mobile bar filter)
const TITLES = { '/dashboard': 'Overview', '/chats': 'Inbox', '/catalog': 'Catalog', '/connect': 'Connect channels', '/playground': 'Test your bot', '/insights': 'Insights', '/velosales-ai': 'VeloSales AI', '/refer-earn': 'Refer & Earn', '/billing': 'Billing', '/profile': 'Business profile', '/settings': 'AI settings', '/help': 'Help', '/onboarding': 'Get started', '/login': 'Sign in' }; // object lookup: path → human title (topbar breadcrumb + document.title)

function Icon({ k }) { // tiny inline SVG set (stroke = inherits text color; no icon library installed)
  const p = { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }; // shared props object spread into every <svg> (currentColor = matches surrounding text)
  if (k === 'overview') return (<svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>); // {...p} = spread all shared props; each if = one icon (early returns)
  if (k === 'chats') return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /></svg>); // speech bubble (SVG path = vector drawing commands)
  if (k === 'catalog') return (<svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></svg>); // box/package
  if (k === 'connect') return (<svg {...p}><path d="M9 7V2M15 7V2M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /></svg>); // plug (Connect page — drawn, never emoji)
  if (k === 'playground') return (<svg {...p}><path d="M12 3v4M9 13h.01M15 13h.01M9.5 16.5h5" /><rect x="5" y="7" width="14" height="12" rx="3" /></svg>); // bot face
  if (k === 'velosalesai') return (<svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></svg>); // sparkles (VeloSales AI = magic)
  if (k === 'insights') return (<svg {...p}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>); // bar chart
  if (k === 'billing') return (<svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>); // credit card
  if (k === 'profile') return (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>); // person
  if (k === 'settings') return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></svg>); // gear
  if (k === 'x') return (<svg {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>); // close (drawer + dialogs — drawn, never a text glyph)
  if (k === 'gift') return (<svg {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8s-1.5-5-4.5-5S5 8 12 8zM12 8s1.5-5 4.5-5S19 8 12 8z" /></svg>); // gift box (Refer & Earn!)
  return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>); // default = help "?" (unknown keys never render broken)
}

export default function Shell({ biz, children, theme = 'light', onToggleTheme = () => {}, onLogout = () => {} }) { // props: biz (business object), children (the page!), theme + toggle (defaults = safe if omitted), onLogout (App clears login state — without it /login bounces back to /dashboard!)
  const { pathname } = useLocation(); // destructure current path from router (re-renders on navigation)
  const navigate = useNavigate(); // navigate('/login') = go there in code (after logout)
  const [menuOpen, setMenuOpen] = useState(false); // mobile drawer open? (desktop sidebar always visible via CSS)
  const [updateBanner, setUpdateBanner] = useState(null); // {version} while the 2-min NEW window is open (null = hidden!)
  useEffect(() => { document.title = 'VeloSales AI — ' + (TITLES[pathname] || 'Overview'); }, [pathname]); // side-effect: browser tab title follows route (|| fallback)
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
        toast('VeloSales AI updated to v' + data.version + ' — check out what changed!', 'ok');
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
  const mobile = ALL.filter(([k]) => ['overview', 'chats', 'catalog', 'billing', 'help'].includes(k)); // bottom-bar subset: destructure [k] (first array item) + .includes whitelist (Help included so support is one tap away on phones!)
  return (
    <> {/* fragment: multiple roots without wrapper div */}
      <div className="shell"> {/* flex row: sidebar + main column (CSS) */}
        {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />} {/* && conditional: backdrop ONLY when open; click = close */}
        <aside className={'sidebar' + (menuOpen ? ' open' : '')}> {/* .open slides the drawer in (CSS transform, mobile only) */}
          <div className="logo"><img src="/logo.png" alt="VeloSales AI" /><span>VELOSALES AI</span>
            <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon k="x" /></button> {/* drawn X, mobile only (CSS) */}
          </div>
          {GROUPS.map((g) => ( // map sections → JSX (key = stable identity for React's reconciler — NEVER use array index when order can change; here labels are stable)
            <div key={g.label}>
              <div className="nav-label">{g.label}</div> {/* SELL / GROW / SETUP eyebrows */}
              <nav>{g.items.map(([k, label, href]) => (<NavLink key={k} to={href} onClick={() => setMenuOpen(false)}><Icon k={k} /><span>{label}</span></NavLink>))}</nav> {/* NavLink adds .active on current route (CSS highlights); destructure [k,label,href] per row */}
            </div>
          ))}
          <div className="foot">AI replies 24/7 so you never miss a sale.<br />© 2026 VeloSales AI
            <button className="drawer-signout" onClick={logout}>Sign out</button> {/* mobile-only: topbar sign-out hides on phones, so the drawer carries it */}
          </div> {/* <br/> = line break element; margin-top:auto in CSS pins it bottom */}
        </aside>
        <div className="main-col"> {/* right column: topbar + scrolling page */}
          <header className="topbar"> {/* sticky header (CSS position:sticky) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}> {/* inline style object (camelCase CSS!) for one-off layout */}
              <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"> {/* hamburger: 3 spans = 3 lines (CSS); desktop-hidden */}
                <span /><span /><span /> {/* self-closing spans (no children) */}
              </button>
              <div><div className="crumb">VeloSales AI / {TITLES[pathname] || 'Overview'}</div><h1>{safeName}</h1></div> {/* breadcrumb + shop name */}
            </div>
            <div className="top-right">
              <span className="live-dot"><i />AI online</span> {/* pulsing status pill (<i> = the dot, CSS) */}
              <Notifications /> {/* bell sits before theme toggle (thumb-side on mobile) */}
              <ThemeToggle theme={theme} onToggle={onToggleTheme} /> {/* sun/moon switch */}
              <div className="avatar" title={safeName}>{initial}</div> {/* title = hover tooltip */}
              <button className="btn ghost sm signout-btn" onClick={logout}>Sign out</button> {/* ghost = outline style; sm = small; .signout-btn hides on phones (drawer carries sign-out instead) */}
            </div>
          </header>
          <main className="page">
            {updateBanner && (
              <div className="update-banner" role="status"> {/* 2-min release banner (auto-hides!) */}
                <span className="pill new">NEW</span>
                <span>VeloSales AI v{updateBanner.version} is live — check it out!</span>
                <button className="btn sm" onClick={() => { setUpdateBanner(null); navigate('/dashboard'); }}>Check it out</button>
                <button className="btn ghost sm" onClick={() => setUpdateBanner(null)} aria-label="Dismiss">Dismiss</button>
              </div>
            )}
            <AdSlot /> {/* free-tier visible ads on EVERY page (Pro/null = renders nothing — zero layout shift for paid) */}
            {children}</main> {/* children = THE PAGE (Dashboard/Catalog/…) rendered inside the frame */}        </div>
      </div>
      <nav className="mobile-bar"> {/* bottom tab bar: mobile only (CSS), 5 key sections */}
        {mobile.map(([k, label, href]) => (<NavLink key={k} to={href}><Icon k={k} /><span>{label}</span></NavLink>))}
      </nav>
      <div className="foot-links"><NavLink to="/help">Help</NavLink><NavLink to="/faq">FAQ</NavLink><NavLink to="/privacy">Privacy</NavLink><NavLink to="/terms">Terms</NavLink></div> {/* legal links (public FAQ/privacy/terms need no login) */}
      <Tour /> {/* coachmarks overlay (renders null until triggered) */}
    </>
  );
}
