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
  useEffect(() => { document.title = 'Vendora — Privacy Policy'; }, []); // tab title (mount-only)
  return (
    <div className="landing">
      <header className="landing-nav"><div className="landing-inner">
        <Link className="landing-brand" to="/"><img src="/logo.png" alt="Vendora" />VENDORA</Link>
        <span><Link className="btn ghost sm" to="/login">Sign in</Link></span>
      </div></header>
      <section className="landing-inner" style={{ padding: '48px 24px 64px' }}>
        <div className="card legal reveal vis">
          <p className="hint">Last updated: September 2026 · Plain-English version — no law degree required</p>
          <h1>Privacy Policy</h1>
          <p>Vendora ("we", "us") sells one thing: an AI sales assistant that answers your WhatsApp customers while you sleep. This policy explains what data we touch, why we touch it, and what we will never do with it. If you run a shop on Vendora, you are the "business owner". The people messaging your shop are "customers".</p>

          <h3>1. The short version</h3>
          <ul>
            <li>We store your catalog, chats and account so the product works. Nothing more.</li>
            <li>We never sell data, never show ads, never train public AI models on your content.</li>
            <li>You can export or delete your data anytime — just ask from the Help page.</li>
          </ul>

          <h3>2. What we collect (and why each item exists)</h3>
          <ul>
            <li><b>Business profile:</b> name, WhatsApp numbers, hours, FAQs, tone, discount guardrails. Purpose: the AI needs to sound like you. Without it there is no product.</li>
            <li><b>Product catalog:</b> names, prices, descriptions, availability — everything you add on the dashboard or teach with LEARN: / SYNC:. Purpose: the single source of truth the AI quotes.</li>
            <li><b>Conversations:</b> customer numbers, names (if WhatsApp provides them), message text, photos customers send, AI replies, human-handoff flags. Purpose: your inbox, chat history, owner alerts and the daily digest.</li>
            <li><b>Account &amp; billing:</b> email, login sessions, subscription status and expiry. Card numbers never touch our servers — Paystack handles all of that. Bank-transfer references (plan + timestamp) so we can activate you.</li>
            <li><b>Technical crumbs:</b> basic server logs (IP, timestamps, error traces) to keep the service alive and catch abuse.</li>
          </ul>

          <h3>3. What we deliberately do NOT collect</h3>
          <p>No BVN, no NIN, no card numbers, no passwords in readable form (passwords are salted scrypt hashes), no location tracking, no advertising profiles. If we don't need it to answer your customers, we don't store it.</p>

          <h3>4. How the AI uses your data</h3>
          <p>When a customer messages you, we send the message plus your catalog/profile to our AI providers (Google Gemini by default, with Groq and OpenRouter as automatic backups) to draft the reply. Providers process this text to generate the answer and are contractually forbidden from training on it or keeping it beyond their standard short retention. Customer photos are analyzed the same way — matched against your catalog, then forgotten.</p>

          <h3>5. Who else touches your data (our processors)</h3>
          <ul>
            <li><b>Twilio</b> — delivers WhatsApp messages both ways.</li>
            <li><b>Google Gemini / Groq / OpenRouter / Anthropic</b> — generate AI replies.</li>
            <li><b>Paystack</b> — processes card payments (they see the payer email and amount, never your catalog).</li>
            <li><b>Resend</b> — sends verification and account emails.</li>
            <li><b>Supabase / Railway / Render</b> — host the database and the app.</li>
          </ul>
          <p>That's the full list. No ad networks, no data brokers, no "analytics partners". If we ever add one, this page changes first.</p>

          <h3>6. Your customers' privacy (your responsibility + ours)</h3>
          <p>As a business owner, your customers' chat data sits in your inbox. Use it to serve them — not to spam them. Ours: we keep it behind your login, never show one business another business's chats, and never contact your customers ourselves except to deliver the AI reply you configured.</p>

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
            <li>Sessions stored server-side; admin routes need your login or a separate admin key.</li>
            <li>HTTPS everywhere in production; database connections encrypted.</li>
            <li>Paystack webhooks verified by HMAC signature — nobody can fake a payment.</li>
          </ul>
          <p>No system is unhackable, and anyone who promises that is lying. If we ever suffer a breach that affects you, we will tell you directly and quickly — not bury it.</p>

          <h3>10. Cookies &amp; sessions</h3>
          <p>One session cookie keeps you logged in for 7 days. No tracking cookies, no third-party pixels, no fingerprinting. Clear your cookies and you simply log in again.</p>

          <h3>11. Children</h3>
          <p>Vendora is for business owners 18+. If you're under 18, come back with an adult partner.</p>

          <h3>12. Changes to this policy</h3>
          <p>We'll update the date at the top and, for meaningful changes, email you or show a notice in the dashboard before they take effect. Continued use after that means you accept the new version.</p>

          <h3>13. Talk to a human</h3>
          <p>Privacy questions, export or deletion requests: open the Help page in your dashboard and send your business name + registered email. That's the fastest channel — it lands with your account attached.</p>

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
