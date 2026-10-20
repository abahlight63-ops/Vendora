// ── frontend/src/components/SiteFooter.jsx ──────────────────────────
// WHAT: the one footer for every surface — the signed-in app, the landing
// page, FAQ, Privacy and Terms. It is not decoration; it is the map Google
// reads when it decides whether a site deserves sitelinks.
//
// WHY IT LOOKS LIKE THIS:
//   · Six to ten real <a href> links, each named like a sentence a person
//     would say ("How VeloSales Ai works, step by step"), never "Learn more".
//   · Marketing pages are absolute URLs on the public domain, because that is
//     where the crawlable HTML lives. App pages are NavLinks, because those
//     are already inside the SPA.
//   · Columns have a real <nav aria-label> and an <h2>, so the grouping is
//     legible to a screen reader and to a crawler.
//
// ONE SOURCE OF TRUTH: SITE_URL. Change the domain here, not in ten files.
import { NavLink } from 'react-router-dom';
import Logo from './Logo.jsx';

export const SITE_URL = 'https://velosalesai.com.ng';

/** `compact` trims the in-app version to three columns (account, product, company). */
export default function SiteFooter({ compact = false }) {
  return (
    <footer className={'site-foot' + (compact ? ' is-compact' : '')}>
      <div className="site-foot-in">
        <div className="site-foot-brand">
          <a className="site-foot-logo" href={SITE_URL} aria-label="VeloSales Ai home">
            <Logo size={26} />
            <span>VeloSales Ai</span>
          </a>
          <p>AI replies 24/7, straight from your catalog — in English or Pidgin.</p>
        </div>

        <nav className="site-foot-col" aria-label="Product">
          <h2>Product</h2>
          <a href={`${SITE_URL}/how-it-works/`}>How VeloSales Ai works, step by step</a>
          <a href={`${SITE_URL}/pricing/`}>Plans and pricing in naira or dollars</a>
          <a href={`${SITE_URL}/free-plan/`}>What the free plan includes</a>
          <a href={`${SITE_URL}/pro-trial/`}>Start the 7-day Pro trial</a>
        </nav>

        <nav className="site-foot-col" aria-label="Your account">
          <h2>Your account</h2>
          <NavLink to="/dashboard">Open your dashboard</NavLink>
          <NavLink to="/chats">Read your WhatsApp inbox</NavLink>
          <NavLink to="/billing">Billing and payment history</NavLink>
          <NavLink to="/ai-settings">Choose which AI model answers</NavLink>
          <NavLink to="/help">Help centre and install guide</NavLink>
        </nav>

        <nav className="site-foot-col" aria-label="Company">
          <h2>Company</h2>
          <a href={`${SITE_URL}/contact/`}>Contact VeloSales Ai support</a>
          <a href={`${SITE_URL}/login/`}>Sign in to your account</a>
          <NavLink to="/faq">Frequently asked questions</NavLink>
          <NavLink to="/privacy">Privacy policy</NavLink>
          <NavLink to="/terms">Terms of service</NavLink>
        </nav>
      </div>

      <div className="site-foot-base">
        <span>© 2026 VeloSales Ai · Abuja, Nigeria</span>
        <span className="site-foot-live"><i aria-hidden="true" />AI answering, day and night</span>
      </div>
    </footer>
  );
}
