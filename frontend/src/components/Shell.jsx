// ── frontend/src/components/Shell.jsx ────────────────────────────
// WHAT: the app frame around every logged-in page: sidebar nav + topbar +
// mobile drawer + bottom bar + footer + Tour mount. <Shell biz={me}> wraps
// page content (children). No npm modules beyond react-router-dom.
// ROUTER LESSON: NavLink = <a> that knows the current route (auto .active
// class); useLocation = current URL; useNavigate = go somewhere in code.
import { useEffect, useState } from 'react'; // useState = drawer open flag; useEffect = title + drawer side-effects
import { NavLink, useLocation, useNavigate } from 'react-router-dom'; // NavLink (active-aware link), useLocation (current path), useNavigate (code navigation)
import { api } from '../lib/api.js'; // api() for the logout call
import ThemeToggle from './ThemeToggle.jsx'; // sun/moon button (topbar)
import Tour from './Tour.jsx'; // first-run coachmarks (mounted once here = available everywhere)

const GROUPS = [ // sidebar sections: label + [iconKey, label, route] rows (data-driven nav = add a row, get a link)
  { label: 'Sell', items: [['overview', 'Overview', '/dashboard'], ['chats', 'Inbox', '/chats'], ['catalog', 'Catalog', '/catalog'], ['playground', 'Test bot', '/playground']] }, // nested arrays: [icon, label, href] per item
  { label: 'Grow', items: [['insights', 'Insights', '/insights'], ['vendoraai', 'Vendora AI', '/vendora-ai'], ['billing', 'Billing', '/billing']] },
  { label: 'Setup', items: [['profile', 'Business', '/profile'], ['settings', 'AI settings', '/settings'], ['help', 'Help', '/help']] },
];
const ALL = GROUPS.flatMap((g) => g.items); // flatMap = map + flatten one level (all nav rows in one array for the mobile bar filter)
const TITLES = { '/dashboard': 'Overview', '/chats': 'Inbox', '/catalog': 'Catalog', '/playground': 'Test your bot', '/insights': 'Insights', '/vendora-ai': 'Vendora AI', '/billing': 'Billing', '/profile': 'Business profile', '/settings': 'AI settings', '/help': 'Help', '/onboarding': 'Get started', '/login': 'Sign in' }; // object lookup: path → human title (topbar breadcrumb + document.title)

function Icon({ k }) { // tiny inline SVG set (stroke = inherits text color; no icon library installed)
  const p = { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }; // shared props object spread into every <svg> (currentColor = matches surrounding text)
  if (k === 'overview') return (<svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>); // {...p} = spread all shared props; each if = one icon (early returns)
  if (k === 'chats') return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /></svg>); // speech bubble (SVG path = vector drawing commands)
  if (k === 'catalog') return (<svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></svg>); // box/package
  if (k === 'playground') return (<svg {...p}><path d="M12 3v4M9 13h.01M15 13h.01M9.5 16.5h5" /><rect x="5" y="7" width="14" height="12" rx="3" /></svg>); // bot face
  if (k === 'vendoraai') return (<svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></svg>); // sparkles (Vendora AI = magic)
  if (k === 'insights') return (<svg {...p}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>); // bar chart
  if (k === 'billing') return (<svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>); // credit card
  if (k === 'profile') return (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>); // person
  if (k === 'settings') return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></svg>); // gear
  return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>); // default = help "?" (unknown keys never render broken)
}

export default function Shell({ biz, children, theme = 'light', onToggleTheme = () => {} }) { // props: biz (business object), children (the page!), theme + toggle (defaults = safe if omitted)
  const { pathname } = useLocation(); // destructure current path from router (re-renders on navigation)
  const navigate = useNavigate(); // navigate('/login') = go there in code (after logout)
  const [menuOpen, setMenuOpen] = useState(false); // mobile drawer open? (desktop sidebar always visible via CSS)
  useEffect(() => { document.title = 'Vendora — ' + (TITLES[pathname] || 'Overview'); }, [pathname]); // side-effect: browser tab title follows route (|| fallback)
  useEffect(() => { setMenuOpen(false); }, [pathname]); // auto-close drawer on every navigation (pick a link → drawer vanishes)
  useEffect(() => { // lock body scroll while drawer open (background mustn't scroll under the overlay)…
    document.body.style.overflow = menuOpen ? 'hidden' : ''; // '' restores default ('hidden' disables scroll)
    return () => { document.body.style.overflow = ''; }; // cleanup: always restore on unmount (stuck scroll = broken app!)
  }, [menuOpen]); // re-run when drawer toggles
  async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} navigate('/login'); } // try destroy server session (ignore failure) THEN go to login (empty catch = navigate regardless)
  const safeName = biz?.name || 'Your business'; // ?. + || : biz may load late — never render "undefined"
  const initial = (safeName.trim()[0] || 'V').toUpperCase(); // avatar letter: first char uppercased ([0] = first character)
  const mobile = ALL.filter(([k]) => ['overview', 'chats', 'catalog', 'playground', 'billing'].includes(k)); // bottom-bar subset: destructure [k] (first array item) + .includes whitelist
  return (
    <> {/* fragment: multiple roots without wrapper div */}
      <div className="shell"> {/* flex row: sidebar + main column (CSS) */}
        {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />} {/* && conditional: backdrop ONLY when open; click = close */}
        <aside className={'sidebar' + (menuOpen ? ' open' : '')}> {/* .open slides the drawer in (CSS transform, mobile only) */}
          <div className="logo"><img src="/logo.png" alt="Vendora" /><span>VENDORA</span>
            <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button> {/* ✕ visible on mobile only (CSS) */}
          </div>
          {GROUPS.map((g) => ( // map sections → JSX (key = stable identity for React's reconciler — NEVER use array index when order can change; here labels are stable)
            <div key={g.label}>
              <div className="nav-label">{g.label}</div> {/* SELL / GROW / SETUP eyebrows */}
              <nav>{g.items.map(([k, label, href]) => (<NavLink key={k} to={href} onClick={() => setMenuOpen(false)}><Icon k={k} /><span>{label}</span></NavLink>))}</nav> {/* NavLink adds .active on current route (CSS highlights); destructure [k,label,href] per row */}
            </div>
          ))}
          <div className="foot">AI replies 24/7 so you never miss a sale.<br />© 2026 Vendora</div> {/* <br/> = line break element; margin-top:auto in CSS pins it bottom */}
        </aside>
        <div className="main-col"> {/* right column: topbar + scrolling page */}
          <header className="topbar"> {/* sticky header (CSS position:sticky) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}> {/* inline style object (camelCase CSS!) for one-off layout */}
              <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"> {/* hamburger: 3 spans = 3 lines (CSS); desktop-hidden */}
                <span /><span /><span /> {/* self-closing spans (no children) */}
              </button>
              <div><div className="crumb">Vendora / {TITLES[pathname] || 'Overview'}</div><h1>{safeName}</h1></div> {/* breadcrumb + shop name */}
            </div>
            <div className="top-right">
              <span className="live-dot"><i />AI online</span> {/* pulsing status pill (<i> = the dot, CSS) */}
              <ThemeToggle theme={theme} onToggle={onToggleTheme} /> {/* sun/moon switch */}
              <div className="avatar" title={safeName}>{initial}</div> {/* title = hover tooltip */}
              <button className="btn ghost sm" onClick={logout}>Sign out</button> {/* ghost = outline style; sm = small */}
            </div>
          </header>
          <main className="page">{children}</main> {/* children = THE PAGE (Dashboard/Catalog/…) rendered inside the frame */}
        </div>
      </div>
      <nav className="mobile-bar"> {/* bottom tab bar: mobile only (CSS), 5 key sections */}
        {mobile.map(([k, label, href]) => (<NavLink key={k} to={href}><Icon k={k} /><span>{label}</span></NavLink>))}
      </nav>
      <div className="foot-links"><NavLink to="/help">Help</NavLink><NavLink to="/faq">FAQ</NavLink><NavLink to="/privacy">Privacy</NavLink><NavLink to="/terms">Terms</NavLink></div> {/* legal links (public FAQ/privacy/terms need no login) */}
      <Tour /> {/* coachmarks overlay (renders null until triggered) */}
    </>
  );
}
