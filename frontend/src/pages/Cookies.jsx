// ── frontend/src/pages/Cookies.jsx ─────────────────────────────────
// WHAT: the public Cookie Policy (/cookies). Keep it true: we use no tracking or
// advertising cookies. If that ever changes, add a consent banner first.
import { useEffect } from 'react';
import LegalPage, { CONTACT } from '../components/LegalPage.jsx';
import { openCookieChoice } from '../components/CookieBanner.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';

const S = (id, title, body) => ({ id, title, body });
const SECTIONS = [
  S('what', 'What we use', <>
    <ul>
      <li><b>Sign-in cookie</b> (<code>connect.sid</code>): keeps you signed in to your shop for up to 7 days. Without it the app cannot work.</li>
      <li><b>Browser storage</b> for your own choices, such as light or dark mode and whether you have seen a tour. It stays on your device.</li>
      <li><b>Security services:</b> Meta's sign-in window (for connecting WhatsApp) and Google's sign-in button may set their own cookies, but only when you choose to use them.</li>
    </ul>
  </>),
  S('not', 'What we do not use', <>
    <p>No advertising cookies, no tracking pixels and no analytics that follow you around the web. We do not sell or share browsing data.</p>
  </>),
  S('consent', 'Your choices', <>
    <p>The first time you visit, a cookie message asks you to choose:</p>
    <ul>
      <li><b>Accept all:</b> the sign-in cookie, plus remembering your choices on this device, such as dark mode.</li>
      <li><b>Essential only:</b> just the sign-in cookie. Your choices are not remembered between visits.</li>
    </ul>
    <p>We never use advertising or tracking cookies, whatever you choose. You can change your mind at any time:</p>
    <p><button type="button" className="btn ghost" onClick={openCookieChoice}>Change my cookie choice</button></p>
  </>),
  S('control', 'Your control', <>
    <p>You can clear cookies and site data in your browser settings at any time. If you clear the sign-in cookie you will be signed out. Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
  </>),
];

export default function Cookies() {
  useEffect(() => { setPageMeta({ title: 'VeloSales Ai — Cookie Policy', description: 'The only cookies VeloSales Ai uses: the sign-in cookie and your own settings. No tracking or advertising cookies.', canonical: APP_URL + '/cookies' }); }, []);
  return (
    <LegalPage which="cookies" title="Cookie Policy" sub="Only what the app needs"
      icon={<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-9-9 3 3 0 0 0 4 3 3 3 0 0 0 5 6zM8 13h.01M12 16h.01M15 11h.01" /></svg>}
      short={['One sign-in cookie keeps you logged in.', 'You choose whether we remember your settings.', 'No tracking or advertising cookies.', 'Change your choice any time on this page.']}
      sections={SECTIONS} />
  );
}
