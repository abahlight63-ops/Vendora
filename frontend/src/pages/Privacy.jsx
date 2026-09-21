// ── frontend/src/pages/Privacy.jsx ─────────────────────────────────
// WHAT: PUBLIC privacy policy (/privacy — no login). 13 plain-English sections:
// short version → data inventory → AI processing → processors → retention →
// NDPR rights → security → cookies → contact. Pattern: SAME landing shell as
// Terms/Faq (nav + .card.legal + footer) — only the middle content differs.
// NOTE: legal pages get a FILE header (not per-line comments) — per-line notes
// inside legal copy would break readability AND risk altering legal meaning!
import { useEffect } from 'react'; // useEffect = tab title on mount
import { Link } from 'react-router-dom'; // brand/login/faq/terms links + footer

export default function Privacy() {
  useEffect(() => { document.title = 'VeloSales Ai — Privacy Policy'; }, []); // tab title (mount-only)
  return (
    <div className="landing">
      <header className="landing-nav"><div className="landing-inner">
        <Link className="landing-brand" to="/"><img src="/logo.png?v=3" alt="VeloSales Ai" />VELOSALES AI</Link>
        <span><Link className="btn ghost sm" to="/login">Sign in</Link></span>
      </div></header>
      <section className="landing-inner" style={{ padding: '48px 24px 64px' }}>
        <div className="card legal reveal vis">
          <p className="hint">Last updated: September 2026</p>
          <h1>Privacy Policy</h1>
          <p>VeloSales Ai ("we", "us", "our") operates an AI-powered WhatsApp customer support platform (the "Service"). This Privacy Policy describes the categories of personal data we collect, the purposes for which such data is processed, the parties with whom it is shared, and the rights available to you under applicable data protection law, including the Nigeria Data Protection Regulation (NDPR). In this Policy, "business owner" means a registered VeloSales Ai account holder, and "customers" means individuals who communicate with a business owner through the Service.</p>

          <h3>1. Summary</h3>
          <ul>
            <li>We process your catalog, conversation, and account data solely to provide, maintain, and improve the Service.</li>
            <li>We do not sell personal data, display third-party advertising against your content, or use your content to train publicly available AI models.</li>
            <li>You may request access to, correction of, export of, or deletion of your personal data at any time via the Help page in your dashboard.</li>
          </ul>

          <h3>2. What we collect (and why each item exists)</h3>
          <ul>
            <li><b>Business profile:</b> name, WhatsApp numbers, hours, FAQs, tone, discount guardrails, business niche (what you sell) and where you heard about us. Purpose: the AI needs to sound like you. Without it there is no product.</li>
            <li><b>Product catalog:</b> names, prices, descriptions, availability, product photos — everything you add on the dashboard or teach with LEARN: / SYNC:. Purpose: the single source of truth the AI quotes.</li>
            <li><b>Conversations:</b> customer numbers, names (if WhatsApp provides them), message text, voice notes (transcribed for Pro Plus shops), photos customers send, AI replies, human-handoff flags. Purpose: your inbox, chat history, owner alerts and the daily digest.</li>
            <li><b>Account &amp; billing:</b> email, login sessions, subscription status, expiry and purchased tier. Card numbers never touch our servers — Paystack (Naira) and Flutterwave (US Dollar) handle all of that.</li>
            <li><b>Technical crumbs:</b> basic server logs (IP, timestamps, error traces) to keep the service alive and catch abuse.</li>
          </ul>

          <h3>3. Data we do not collect</h3>
          <p>We do not collect Bank Verification Numbers (BVN), National Identification Numbers (NIN), payment card numbers, or precise location data. Passwords are stored exclusively as salted cryptographic hashes and cannot be retrieved in readable form. We do not create advertising profiles. As a matter of policy, we do not collect or retain any personal data that is not reasonably necessary for the provision of the Service.</p>

          <h3>4. How the AI uses your data</h3>
          <p>When a customer messages you, we send the message plus your catalog/profile to our AI providers (Google Gemini by default, with Groq and TokenRouter as automatic backups) to draft the reply. Providers process this text to generate the answer and are contractually forbidden from training on it or keeping it beyond their standard short retention. Customer photos are analyzed the same way — matched against your catalog, then forgotten.</p>

          <h3>5. Who else touches your data (our processors)</h3>
          <ul>
            <li><b>Meta (WhatsApp Cloud API)</b> — delivers WhatsApp messages both ways.</li>
            <li><b>Google Gemini / Groq / TokenRouter / SambaNova / Anthropic</b> — generate AI replies.</li>
            <li><b>Paystack</b> — processes Naira card payments (they see the payer email and amount, never your catalog).</li>
            <li><b>Flutterwave</b> — processes US Dollar card payments for international shops (same business: email and amount only).</li>
            <li><b>Resend</b> — sends verification and account emails.</li>
            <li><b>Supabase / Railway / Render</b> — host the database and the app.</li>
          </ul>
          <p>That's the full list. No ad networks, no data brokers, no "analytics partners". If we ever add one, this page changes first.</p>

          <h3>6. Your customers' personal data</h3>
          <p>As a business owner, you act as an independent controller of your customers' data visible in your inbox, and you agree to use such data solely for legitimate customer service purposes and in compliance with applicable data protection law, including refraining from unsolicited marketing communications. For our part, we restrict access to your data behind your authenticated login, never disclose one business's conversations to another, and never contact your customers directly except to deliver AI-generated replies you have configured.</p>

          <h3>7. How long we keep things</h3>
          <ul>
            <li>Catalog, profile and chats: while your account is active, so your history works.</li>
            <li>After you delete your account: everything identifiable is removed within 14 days, except payment receipts the law requires us to keep (up to 5 years under Nigerian tax rules).</li>
            <li>Server logs: rolled over within 90 days.</li>
          </ul>

          <h3>8. Your rights (NDPR-aligned)</h3>
          <p>Under Nigeria's Data Protection Regulation you may: see everything we hold on you, correct it, export it, restrict it, or delete it. Write us from your dashboard Help page with your business name and registered email — we respond within 7 days. Deleting your account deletes your catalog, chats and profile snapshot.</p>

          <h3>9. Security — what we actually do</h3>
          <ul>
            <li>Passwords hashed with salted scrypt — we couldn't read them if we wanted to.</li>
            <li>Sessions stored server-side; production refuses to boot without its own session secret.</li>
            <li>Login, signup and checkout doors rate-limited against brute force and spam.</li>
            <li>Meta, Telegram, Paystack and Flutterwave webhooks all verified — nobody can fake a message or a payment.</li>
            <li>Security headers on every response; error messages never leak internals.</li>
            <li>HTTPS everywhere in production; database connections encrypted.</li>
          </ul>
          <p>No method of electronic transmission or storage is entirely secure. In the event of a personal data breach that is likely to affect your rights, we will notify you and the relevant supervisory authority without undue delay, in accordance with applicable law.</p>

          <h3>10. Cookies &amp; sessions</h3>
          <p>One session cookie keeps you logged in for 7 days. No tracking cookies, no third-party pixels, no fingerprinting. Clear your cookies and you simply log in again.</p>

          <h3>11. Minors</h3>
          <p>The Service is intended solely for business owners aged 18 and above. We do not knowingly process personal data of minors. If you are under 18, you may not create an account.</p>

          <h3>12. Changes to this policy</h3>
          <p>We'll update the date at the top and, for meaningful changes, email you or show a notice in the dashboard before they take effect. Continued use after that means you accept the new version.</p>

          <h3>13. Contact information</h3>
          <p>For privacy inquiries, data subject requests (access, correction, export, or deletion), or complaints regarding our processing of personal data, please contact us via the Help page in your dashboard, providing your business name and registered email address. We respond to all requests within 7 days.</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
            <Link className="btn sm" to="/faq">Read FAQ</Link>
            <Link className="btn ghost sm" to="/terms">Terms &amp; Conditions</Link>
          </div>
        </div>
      </section>
      <footer className="foot-links landing-inner">
        <Link to="/faq">FAQ</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}
