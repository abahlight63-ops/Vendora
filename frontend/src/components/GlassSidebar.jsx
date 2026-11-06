// ── frontend/src/components/GlassSidebar.jsx ───────────────────────
// WHAT: the liquid-glass sidebar (owner's reference: "Glassy SideBar").
// Desktop: a floating glass panel that collapses to a slim icon rail (the
// choice is remembered) with glass tooltips. Phones: the same panel slides in
// as the menu drawer, always expanded.
// The "liquid" part: one glossy glass capsule that glides, with a little
// spring, to the item under the pointer, then back to the current page.
// Keeps the class names other code relies on: the guided tour and the help
// guides find links with `.sidebar nav a[href="…"]`.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';

const KEY = 'velo-sb-collapsed';
const readCollapsed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

export default function GlassSidebar({ biz, pathname, menuOpen, setMenuOpen, unread, theme, onToggleTheme, onSignOut, MAIN, MORE, Icon }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [q, setQ] = useState('');
  const [tip, setTip] = useState(null); // { label, top } while hovering the rail
  const [pill, setPill] = useState(null); // { top, left, width, height } of the glass capsule
  const scrollRef = useRef(null);
  const searchRef = useRef(null);
  const hoverRef = useRef(null);

  const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches;
  const rail = collapsed && !menuOpen; // phones always show the full panel
  useEffect(() => { try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { /* private mode */ } }, [collapsed]);
  useEffect(() => { document.documentElement.classList.toggle('sb-rail', rail); }, [rail]);

  useEffect(() => { // Ctrl/⌘ + K opens the page search from anywhere
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        if (isPhone()) setMenuOpen(true); else setCollapsed(false);
        setTimeout(() => searchRef.current && searchRef.current.focus(), 320);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const match = ([, label]) => !needle || label.toLowerCase().includes(needle);
  const main = MAIN.filter(match);
  const more = MORE.filter(match);

  // Move the capsule onto an element (the hovered link, or the current page's link).
  const placeOn = (el) => {
    const box = scrollRef.current;
    if (!box || !el) { setPill(null); return; }
    const b = box.getBoundingClientRect(); const r = el.getBoundingClientRect();
    setPill({ top: r.top - b.top + box.scrollTop, left: r.left - b.left, width: r.width, height: r.height });
  };
  const placeOnActive = () => placeOn(scrollRef.current && scrollRef.current.querySelector('a.active'));
  useLayoutEffect(() => { placeOnActive(); }, [pathname, rail, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // the panel animates its width; settle the capsule when it finishes, and on resize
    const t = setTimeout(placeOnActive, 380);
    const onR = () => placeOnActive();
    window.addEventListener('resize', onR);
    return () => { clearTimeout(t); window.removeEventListener('resize', onR); };
  }, [rail, menuOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = (e, label) => {
    hoverRef.current = e.currentTarget; placeOn(e.currentTarget);
    if (rail && !isPhone()) { const r = e.currentTarget.getBoundingClientRect(); setTip({ label, top: r.top + r.height / 2 }); }
  };
  const leaveAll = () => { hoverRef.current = null; setTip(null); placeOnActive(); };

  const link = ([k, label, href]) => {
    const badge = k === 'bell' && unread > 0 ? (unread > 99 ? '99+' : unread) : null;
    return (
      <NavLink key={k} to={href} onClick={() => setMenuOpen(false)} onMouseEnter={(e) => enter(e, label)} onFocus={(e) => enter(e, label)} aria-label={rail ? label : undefined}>
        <span className="gsb-ic"><Icon k={k} />{badge && rail ? <i className="gsb-dot" aria-hidden="true" /> : null}</span>
        <span className="gsb-label">{label}</span>
        {badge && !rail ? <em className="gsb-count" aria-label={badge + ' unread'}>{badge}</em> : null}
      </NavLink>
    );
  };

  const safeName = (biz && biz.name) || 'Your shop';
  const initial = (safeName.trim()[0] || 'V').toUpperCase();
  const plan = biz && biz.tier === 'plus' ? 'Pro plan' : biz && biz.tier === 'pro' ? (biz.subscription_status === 'trialing' ? 'Pro trial' : 'Plus plan') : 'Free plan';
  const dark = theme === 'dark';

  return (
    <aside className={'sidebar gsb' + (menuOpen ? ' open' : '') + (rail ? ' is-rail' : '')} aria-label="Menu" onMouseLeave={leaveAll}>
      <div className="logo gsb-head">
        <span className="gsb-mark"><Logo alt="VeloSales Ai" /></span>
        <span className="gsb-brand"><b>VeloSales Ai</b><small>{safeName}</small></span>
        <button type="button" className="gsb-toggle" onClick={() => { setCollapsed((c) => !c); setTip(null); }} aria-label={rail ? 'Open the menu' : 'Make the menu smaller'} aria-expanded={!rail}><Icon k="chevR" /></button>
        <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon k="x" /></button>
      </div>

      {rail ? (
        <button type="button" className="gsb-search-btn" onClick={() => { setCollapsed(false); setTimeout(() => searchRef.current && searchRef.current.focus(), 320); }} onMouseEnter={(e) => enter(e, 'Search pages')} aria-label="Search pages"><Icon k="search" /></button>
      ) : (
        <label className="gsb-search">
          <Icon k="search" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" aria-label="Search pages"
            onKeyDown={(e) => { if (e.key === 'Enter') { const first = [...main, ...more][0]; if (first) { setQ(''); setMenuOpen(false); navigate(first[2]); } } if (e.key === 'Escape') setQ(''); }} />
          {q ? <button type="button" className="gsb-clear" onClick={() => setQ('')} aria-label="Clear search"><Icon k="x" /></button> : <kbd>Ctrl K</kbd>}
        </label>
      )}

      <div className="gsb-scroll" ref={scrollRef} onScroll={() => (hoverRef.current ? placeOn(hoverRef.current) : placeOnActive())}>
        <span className="gsb-pill" aria-hidden="true" style={pill ? { transform: `translate(${pill.left}px, ${pill.top}px)`, width: pill.width, height: pill.height, opacity: 1 } : { opacity: 0 }} />
        {main.length > 0 && <div className="gsb-sec">Main</div>}
        {rail && main.length > 0 && <i className="gsb-sep" aria-hidden="true" />}
        <nav aria-label="Main">{main.map(link)}</nav>
        {more.length > 0 && <div className="gsb-sec">More</div>}
        {rail && more.length > 0 && <i className="gsb-sep" aria-hidden="true" />}
        <nav aria-label="More">{more.map(link)}</nav>
        {needle && !main.length && !more.length && <p className="gsb-none">No page matches "{q}"</p>}
      </div>

      <div className="gsb-foot">
        <button type="button" className="gsb-row gsb-theme" onClick={onToggleTheme} onMouseEnter={(e) => enter(e, dark ? 'Light mode' : 'Night mode')} aria-pressed={dark}>
          <span className="gsb-ic"><Icon k={dark ? 'sun' : 'moon'} /></span>
          <span className="gsb-label">Night mode</span>
          <span className={'gsb-switch' + (dark ? ' on' : '')} aria-hidden="true"><i /></span>
        </button>
        <div className="gsb-user">
          <button type="button" className="gsb-me" onClick={() => { setMenuOpen(false); navigate('/settings?tab=account'); }} onMouseEnter={(e) => enter(e, safeName)} aria-label={'Account settings for ' + safeName}>
            <span className="gsb-av">{biz && biz.avatar_url ? <img src={biz.avatar_url} alt="" /> : biz && biz.avatar_emoji ? biz.avatar_emoji : initial}<i aria-hidden="true" /></span>
            <span className="gsb-label gsb-who"><b>{safeName}</b><small>{plan}</small></span>
          </button>
          <button type="button" className="gsb-out" onClick={() => { setMenuOpen(false); onSignOut(); }} onMouseEnter={(e) => enter(e, 'Sign out')} aria-label="Sign out"><Icon k="logout" /></button>
        </div>
      </div>

      {tip && <span className="gsb-tip" style={{ top: tip.top }} role="tooltip">{tip.label}</span>}
    </aside>
  );
}
