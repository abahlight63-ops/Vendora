// ── frontend/src/pages/Landing.jsx ─────────────────────────────────
// WHAT: the web app's front door at / — the same screen as the phone's
// lib/screens/welcome_screen.dart: the 3D mark, one promise, one sentence, one
// action. Pricing and the long story live on the marketing site (SITE_URL), so
// there is one homepage to keep true. Guests only: App routes signed-in owners
// to /dashboard. SiteFooter stays because it carries the legal links.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Mark3D from '../components/Mark3D.jsx';
import SiteFooter, { SITE_URL } from '../components/SiteFooter.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';

export default function Landing() {
  useEffect(() => {
    setPageMeta({
      title: 'VeloSales Ai — Your WhatsApp shop, open 24/7',
      description: 'VeloSales Ai is an AI sales assistant for WhatsApp. It answers price, stock, delivery and hours questions 24/7 in English or Pidgin, straight from your catalog. Free plan, 7-day Pro trial.',
      canonical: APP_URL + '/',
    });
  }, []);

  return (
    <div className="landing">
      <div className="wel">
        <i className="wel-glow wel-glow-a" />
        <i className="wel-glow wel-glow-b" />
        <i className="wel-glow wel-glow-c" />
        <header className="wel-bar">
          <span className="wel-brand"><Logo size={30} alt="" />VeloSales Ai</span>
        </header>
        <main className="wel-main">
          <Mark3D className="wel-scene" />
          <div className="wel-copy">
            <h1>Your WhatsApp shop, <em>open 24/7.</em></h1>
            <p>VeloSales Ai answers your customers in seconds, in English or Pidgin, straight from your catalog.</p>
            <div className="wel-actions">
              <Link className="wel-cta" to="/login?mode=signup">
                <span className="wel-cta-pill">Get started</span>
                <svg className="wel-cta-neck" viewBox="0 0 26.4 39.6" aria-hidden="true">
                  <path d="M0 0Q13.2 13 26.4 0L26.4 39.6Q13.2 26.6 0 39.6Z" />
                </svg>
                <span className="wel-cta-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </Link>
              <Link className="wel-signin" to="/login">Sign in</Link>
            </div>
            <a className="wel-more" href={SITE_URL}>See pricing and how it works</a>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
