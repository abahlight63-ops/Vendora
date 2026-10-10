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

const GROUPS = [ // sidebar sections: label + [iconKey, label, route] rows (data-driven nav = add a row, get a link)
  { label: 'Sell', items: [['overview', 'Overview', '/dashboard'], ['chats', 'Inbox', '/chats'], ['catalog', 'Catalog', '/catalog'], ['connect', 'Connect', '/connect'], ['playground', 'Test bot', '/playground']] }, // nested arrays: [icon, label, href] per item
  { label: 'Grow', items: [['insights', 'Insights', '/insights'], ['velosalesai', 'Chat with Velo', '/velosales-ai'], ['gift', 'Refer & Earn', '/refer-earn'], ['billing', 'Billing', '/billing']] },
  { label: 'Setup', items: [['profile', 'Business', '/profile'], ['settings', 'AI settings', '/settings'], ['help', 'Help', '/help']] },
];
const ALL = GROUPS.flatMap((g) => g.items); // flatMap = map + flatten one level (all nav rows in one array for the mobile bar filter)
const TITLES = { '/dashboard': 'Overview', '/chats': 'Inbox', '/catalog': 'Catalog', '/connect': 'Connect channels', '/playground': 'Test your bot', '/insights': 'Insights', '/velosales-ai': 'Chat with Velo', '/refer-earn': 'Refer & Earn', '/billing': 'Billing', '/profile': 'Business profile', '/settings': 'AI settings', '/help': 'Help', '/onboarding': 'Get started', '/login': 'Sign in' }; // object lookup: path → human title (topbar breadcrumb + document.title)

function Icon({ k }) { // tiny inline SVG set (stroke = inherits text color; no icon library installed)
  const p = { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }; // shared props object spread into every <svg> (currentColor = matches surrounding text)
  if (k === 'overview') return (<svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>); // {...p} = spread all shared props; each if = one icon (early returns)
  if (k === 'chats') return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /></svg>); // speech bubble (SVG path = vector drawing commands)
  if (k === 'catalog') return (<svg {...p}><path d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" /></svg>); // box/package
  if (k === 'connect') return (<svg {...p}><path d="M9 7V2M15 7V2M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /></svg>); // plug (Connect page — drawn, never emoji)
  if (k === 'playground') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></svg>); // play
  if (k === 'velosalesai') return (<svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>); // sparkles
  if (k === 'insights') return (<svg {...p}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>); // bar chart
  if (k === 'billing') return (<svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>); // credit card
  if (k === 'profile') return (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>); // person
  if (k === 'settings') return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>); // gear
  if (k === 'calendar') return (<svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);
  if (k === 'cash') return (<svg {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>);
  if (k === 'check') return (<svg {...p}><path d="M20 6L9 17l-5-5" /></svg>);
  if (k === 'mail') return (<svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>);
  if (k === 'bolt') return (<svg {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>);
  if (k === 'search') return (<svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>);
  if (k === 'bell') return (<svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>);
  if (k === 'x') return (<svg {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>); // close (drawer + dialogs — drawn, never a text glyph)
  if (k === 'gift') return (<svg {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9" /></svg>); // gift box (Refer & Earn!)
  return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>); // default = help "?" (unknown keys never render broken)
}

export default function Shell({ biz, children, theme = 'light', onToggleTheme = () => {}, onLogout = () => {} }) { // props: biz (business object), children (the page!), theme + toggle (defaults = safe if omitted), onLogout (App clears login state — without it /login bounces back to /dashboard!)
  const { pathname } = useLocation(); // destructure current path from router (re-renders on navigation)
  const navigate = useNavigate(); // navigate('/login') = go there in code (after logout)
  const [menuOpen, setMenuOpen] = useState(false); // mobile drawer open? (desktop sidebar always visible via CSS)
  const [updateBanner, setUpdateBanner] = useState(null); // {version} while the 2-min NEW window is open (null = hidden!)
  useEffect(() => { document.title = 'VeloSales Ai — ' + (TITLES[pathname] || 'Overview'); }, [pathname]); // side-effect: browser tab title follows route (|| fallback)
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
  const mobile = ALL.filter(([k]) => ['overview', 'chats', 'catalog', 'billing', 'help'].includes(k)); // bottom-bar subset: destructure [k] (first array item) + .includes whitelist (Help included so support is one tap away on phones!)
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const railItems = ALL.filter(([k]) => ['overview','chats','catalog','connect','playground','insights','billing','profile','settings','help'].includes(k)).slice(0, 10);
  return (
    <> {/* fragment: multiple roots without wrapper div */}
      <div className="shell"> {/* flex row: sidebar + main column (CSS) */}
        {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />} {/* && conditional: backdrop ONLY when open; click = close */}
        <aside className={'sidebar' + (menuOpen ? ' open' : '')}> {/* icon rail like reference */}
          <div className="logo"><Logo alt="VeloSales Ai" /><span>VELOSALES AI</span>
            <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon k="x" /></button> {/* drawn X, mobile only (CSS) */}
          </div>
          <nav>{railItems.map(([k, label, href]) => (<NavLink key={k} to={href} title={label} onClick={() => setMenuOpen(false)}><Icon k={k} /><span style={{display:'none'}}>{label}</span></NavLink>))}</nav>
          <div className="foot">AI replies 24/7 so you never miss a sale.<br />© 2026 VeloSales Ai
            <button className="drawer-signout" onClick={logout}>Sign out</button>
          </div>
        </aside>
        <div className="main-col"> {/* right column: topbar + scrolling page */}
          <header className="topbar"> {/* HRadar-style topbar */}
            <div className="top-left">
              <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon k="overview" /></button>
              <div className="date">{dateStr}</div>
              <div className="top-title">{safeName}</div>
              <div className="top-sub">{TITLES[pathname] || 'Overview'}</div>
            </div>
            <label className="hr-search"><Icon k="search" /><input placeholder="Search chats, products…" aria-label="Search" /></label>
            <div className="top-right">
              <Notifications /> {/* bell */}
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <div className="avatar" title={safeName}>{initial}</div>
              <button className="btn ghost sm signout-btn" onClick={logout}>Sign out</button>
            </div>
          </header>
          <main className="page">
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
      <nav className="mobile-bar glass"> {/* bottom tab bar: mobile only (CSS), 5 key sections */}
        {mobile.map(([k, label, href]) => (<NavLink key={k} to={href}><Icon k={k} /><span>{label}</span></NavLink>))}
      </nav>
      <div className="foot-links"><NavLink to="/help">Help</NavLink><NavLink to="/faq">FAQ</NavLink><NavLink to="/privacy">Privacy</NavLink><NavLink to="/terms">Terms</NavLink></div> {/* legal links (public FAQ/privacy/terms need no login) */}
      <Tour /> {/* coachmarks overlay (renders null until triggered) */}
    </>
  );
}
