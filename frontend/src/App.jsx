// ── frontend/src/App.jsx ─────────────────────────────────────────
// WHAT: the route table + global providers. Decides EVERY URL: public pages
// (landing/privacy/terms/faq/login) vs Guarded app pages (Shell + content).
// Also owns: theme state (useTheme), splash gate, login state (useMe).
// ROUTER LESSON: <Routes> picks the FIRST matching <Route path>. element =
// what renders. <Navigate> = redirect. Guard = our login-wall wrapper.
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'; // Suspense+lazy = code-split pages (phones download ONLY the opened page!); useCallback memoizes hideSplash; useEffect = /api/me fetch
import { Routes, Route, Navigate } from 'react-router-dom'; // Routes = switch; Route = path→element; Navigate = redirect element
import Shell from './components/Shell.jsx'; // app frame (sidebar+topbar) wrapping guarded pages — ALWAYS needed (eager!)
import Splash from './components/Splash.jsx'; // brand intro (shown first — eager, it's tiny!)
import { BrandGate } from './components/Loader.jsx'; // selling-point loading face (page fallback + login wall!)
import { api } from './lib/api.js'; // backend fetch helper (session cookie included)
import { loadNetworkAds, setAdsCache, resetAdsCache } from './lib/ads.js'; // free-tier ad tags (single loader — Pro gets nothing)
import { useTheme } from './lib/theme.js'; // [theme, toggleTheme] (dark/light, persisted)
// Pages load LAZY (one chunk each — first paint downloads shell + current page only, not all 20!):
const Login = lazy(() => import('./pages/Login.jsx')); // sign in / sign up / OTP / forgot (public)
const Reset = lazy(() => import('./pages/Reset.jsx')); // forgot-password landing (?token= — public, token IS the credential!)
const Landing = lazy(() => import('./pages/Landing.jsx')); // marketing homepage (public, at /)
const Onboarding = lazy(() => import('./pages/Onboarding.jsx')); // welcome tour (post-signup)
const Welcome = lazy(() => import('./pages/Welcome.jsx')); // niche + heard-from setup (tour → here → dashboard)
const Dashboard = lazy(() => import('./pages/Dashboard.jsx')); // overview: stats + attention + checklist
const Profile = lazy(() => import('./pages/Profile.jsx')); // business name/number/hours/tone/FAQs/currency/timezone
const Catalog = lazy(() => import('./pages/Catalog.jsx')); // products + Pro profile-sync
const Connect = lazy(() => import('./pages/Connect.jsx')); // channel switchboard (WhatsApp Embedded Signup + Telegram + brain pick)
const Chats = lazy(() => import('./pages/Chats.jsx')); // inbox + threads
const Billing = lazy(() => import('./pages/Billing.jsx')); // plans + status + trial countdown
const ContactSales = lazy(() => import('./pages/ContactSales.jsx')); // enterprise enquiry form (new-tab from Billing!)
const Playground = lazy(() => import('./pages/Playground.jsx')); // test-bot (no WhatsApp needed)
const Insights = lazy(() => import('./pages/Insights.jsx')); // AI-handled % + flag reasons
const Settings = lazy(() => import('./pages/Settings.jsx')); // SmartDeal discounts + handoff text
const Help = lazy(() => import('./pages/Help.jsx'));
const ReferEarn = lazy(() => import('./pages/ReferEarn.jsx')); // full Refer & Earn page (code + rewards + history + leaders!)
const Notifications = lazy(() => import('./pages/Notifications.jsx')); // full inbox page (bell previews, this shows all!)
const Admin = lazy(() => import('./pages/Admin.jsx')); // admin console (rarely opened — must NOT weigh first paint!)
const VeloSalesAI = lazy(() => import('./pages/VeloSalesAI.jsx')); // general AI chat + model dropdown
const Privacy = lazy(() => import('./pages/Privacy.jsx')); // public legal (no login needed)
const Terms = lazy(() => import('./pages/Terms.jsx')); // public legal
const Faq = lazy(() => import('./pages/Faq.jsx')); // public FAQ marketing page
function PageFallback() { // chunk loading placeholder (scatter logo — the brand moment, same family as Splash!)
  return <div className="page"><div className="card"><BrandGate /></div></div>;
}

function useMe() { // CUSTOM HOOK: "who's logged in?" — returns {me, loading, setMe}. Hooks let us reuse stateful logic.
  const [me, setMe] = useState(null); // me = business object or null (guest). null initial = "unknown yet" (loading covers the gap)
  const [loading, setLoading] = useState(true); // true until /api/me answers (prevents flashing login page to logged-in users)
  useEffect(() => { // runs ONCE on mount ([] deps = componentDidMount equivalent)
    api('/api/me').then(({ ok, data }) => { // destructure the {ok, data} shape api() returns
      setMe(ok ? data.business : null); // ok → store business (includes tier!); else guest (bad session/expired)
      // Per-VIEW ads live ONLY in lib/ads.js (single source of truth).
      // Backend sends tags to free tier only; Pro gets null → zero ads.
      // Seed the ads cache from THIS response so lib/ads.js never double-fetches.
      if (ok) { setAdsCache(data.ads); loadNetworkAds(); } else { resetAdsCache(); } // fire-and-forget (async fn, no await — ads must never block rendering)
      setLoading(false); // done either way (finally-style: success AND failure clear loading)
    }).catch(() => setLoading(false)); // network DOWN → guest mode, still clear loading (app must render something!)
  }, []); // [] = run once (no deps = never re-run)
  return { me, loading, setMe }; // hook consumers: const { me, loading, setMe } = useMe()
}

function Guard({ me, loading, theme, onToggleTheme, onLogout, children }) { // login wall: wraps every private page (destructure 6 props)
  if (loading) return <div className="page"><div className="card"><BrandGate /></div></div>; // still checking session → scatter logo (no flashing!)
  if (!me) return <Navigate to="/login" replace />; // guest → redirect to /login (replace = don't keep bad URL in history)
  return <Shell biz={me} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}>{children}</Shell>; // logged in → frame + page (children = the page element; onLogout clears login state on sign-out)
}

export default function App() { // ROOT component (main.jsx renders this)
  const { me, loading, setMe } = useMe(); // login state (Login page calls setMe after auth → instant UI update, no reload!)
  const [theme, toggleTheme] = useTheme(); // dark/light (persisted, applied to <html>)
  const [splash, setSplash] = useState(true); // brand intro visible?
  const hideSplash = useCallback(() => setSplash(false), []); // useCallback = stable function identity (Splash's effect dep won't loop)
  const handleLogout = useCallback(() => { setMe(null); resetAdsCache(); }, []); // logout clears login state AND ads cache (next login refetches fresh tier/tags)
  if (splash) return <Splash done={hideSplash} />; // EARLY RETURN: splash covers everything until done() fires
  return ( // after splash: the route table (order matters — first match wins!)
    <Suspense fallback={<PageFallback />}> {/* lazy pages suspend here while their chunk downloads (fallback matches Guard's look!) */}<Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/privacy" element={<Privacy />} /> {/* public legal trio (no Guard — Google + guests must read them!) */}
      <Route path="/terms" element={<Terms />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/login" element={loading ? <div className="page"><div className="card"><BrandGate /></div></div> : me ? <Navigate to="/dashboard" replace /> : <Login setMe={setMe} theme={theme} onToggleTheme={toggleTheme} />} /> {/* logged-in visiting /login → dashboard (no login-loop); loading → brand gate so we don't flash the form */}
      <Route path="/reset" element={<Reset />} /> {/* forgot-password landing (public — must NOT be Guarded: no session exists yet!) */}
      <Route path="/onboarding" element={<Onboarding me={me} />} /> {/* welcome tour (reachable logged-in OR fresh — by design) */}
      <Route path="/welcome" element={loading ? <div className="page"><div className="card"><BrandGate /></div></div> : me ? <Welcome /> : <Navigate to="/login" replace />} /> {/* niche + heard-from (new signups land here after the tour; guests → login) */}
      <Route path="/dashboard" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Dashboard biz={me} /></Guard>} /> {/* Guard pattern: <Guard …><Page/></Guard> = page becomes `children` */}
      <Route path="/chats" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Chats /></Guard>} />
      <Route path="/catalog" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Catalog /></Guard>} />
      <Route path="/connect" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Connect /></Guard>} />
      <Route path="/playground" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Playground /></Guard>} />
      <Route path="/insights" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Insights /></Guard>} />
      <Route path="/billing" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Billing /></Guard>} />
      <Route path="/contact-sales" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><ContactSales /></Guard>} /> {/* enterprise form (Billing opens it in a new tab!) */}
      <Route path="/profile" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Profile biz={me} /></Guard>} />
      <Route path="/settings" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Settings biz={me} /></Guard>} />
      <Route path="/help" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Help /></Guard>} />
      <Route path="/notifications" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Notifications /></Guard>} /> {/* full inbox (bell previews, tap → here!) */}
      <Route path="/notifications/:id" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><Notifications /></Guard>} /> {/* one notice fully (photo/video + long body!) */}
      <Route path="/refer-earn" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><ReferEarn /></Guard>} /> {/* full Refer & Earn page (Dashboard card teasers it!) */}
      <Route path="/velosales-ai" element={<Guard me={me} loading={loading} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}><VeloSalesAI biz={me} /></Guard>} />
      <Route path="/" element={loading ? <div className="page"><div className="card"><BrandGate /></div></div> : me ? <Navigate to="/dashboard" replace /> : <Landing theme={theme} onToggleTheme={toggleTheme} />} /> {/* / = smart root: loading→brand gate, logged-in→dashboard, guest→marketing landing (ternary chain) */}
      <Route path="*" element={<div className="page"><div className="card"><h2>Page not found</h2><p className="hint">That link doesn't exist.</p><p style={{ marginTop: 12 }}><a href="/dashboard">Back to overview</a></p></div></div>} /> {/* path="*" = catch-all 404 (MUST be last — Routes picks first match!) */}
    </Routes></Suspense>
  );
}
