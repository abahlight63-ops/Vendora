// ── frontend/src/pages/Terms.jsx ──────────────────────────────────
// WHAT: PUBLIC terms (/terms — no login). 13 sections: service definition →
// eligibility → free/Pro/refunds → acceptable use → AI honesty clause →
// dependencies → liability cap → Lagos arbitration. Same landing shell as
// Privacy/Faq (nav + .card.legal + footer). File header only (see Privacy note:
// per-line comments inside legal copy hurt readability + legal precision).
import { useEffect } from 'react'; // tab title on mount
import { Link } from 'react-router-dom'; // brand/login/privacy links + footer

export default function Terms() {
  useEffect(() => { document.title = 'Vendora — Terms & Conditions'; }, []); // tab title
  return (
    <div className="landing">
      <header className="landing-nav"><div className="landing-inner">
        <Link className="landing-brand" to="/"><img src="/logo.png" alt="Vendora" />VENDORA</Link>
        <span><Link className="btn ghost sm" to="/login">Sign in</Link></span>
      </div></header>
      <section className="landing-inner" style={{ padding: '48px 24px 64px' }}>
        <div className="card legal reveal vis">
          <p className="hint">Last updated: September 2026 · Written like a human, enforceable like a contract</p>
          <h1>Terms &amp; Conditions</h1>
          <p>Welcome to Vendora. By creating an account or using the service you agree to these terms. We kept them readable on purpose — but they are still a binding agreement between you ("business owner") and Vendora ("we").</p>

          <h3>1. What Vendora is (and isn't)</h3>
          <p>Vendora is an AI assistant that auto-replies to your WhatsApp customers using YOUR catalog. It is a tool, not an employee: it drafts replies from the information you provide, flags anything unsure to you instead of guessing, and never invents prices. You remain fully responsible for what your shop sells, charges and promises — the AI only quotes what you taught it.</p>

          <h3>2. Who can use it</h3>
          <ul>
            <li>You must be 18+ and able to enter contracts under Nigerian law.</li>
            <li>One account per business WhatsApp number. Keep your password private — anything done under your login counts as done by you.</li>
            <li>Your catalog must be yours to publish: real products, real prices, real availability.</li>
          </ul>

          <h3>3. Free plan, Pro trial &amp; paid plans</h3>
          <ul>
            <li><b>Free forever:</b> manual catalog (dashboard adds + LEARN: messages) with AI replies. No card, no expiry.</li>
            <li><b>14-day Pro trial:</b> every new account gets full Pro (profile sync + verification) free for 14 days, no card required.</li>
            <li><b>Paid plans:</b> Monthly ₦7,500 / $5 · Yearly ₦50,000 / $33 (save ~44% off monthly) · Lifetime ₦100,000 / $65 one-time. Currency is set automatically from your WhatsApp number (+234 → Naira, else US Dollar) and can be changed in Business profile. Pay by card via Paystack or direct bank transfer (transfer is Naira-only).</li>
            <li><b>After trial / expiry / cancellation:</b> you drop to the free plan. Your catalog, chats and history stay. The bot keeps replying from your manual catalog — we never hold your data hostage.</li>
          </ul>

          <h3>4. Payments, renewals &amp; refunds</h3>
          <ul>
            <li>Card payments activate instantly via Paystack webhook. Transfer payments activate within a few hours of our confirming the credit — tap "I have sent the money" so we know to look.</li>
            <li>Subscriptions renew for the same plan length; lifetime never renews. Cancel anytime from the Billing page — you keep Pro until the paid period ends.</li>
            <li><b>Refunds:</b> first-ever payment refundable within 7 days if the service genuinely didn't work for you (write us from Help with details). Renewals and lifetime are non-refundable after 7 days, except where the law says otherwise. Failed duplicate charges are always refunded in full.</li>
            <li>Prices show in your currency (NGN or USD) and may change for NEW purchases; your active paid period always keeps the price you paid.</li>
          </ul>

          <h3>5. Acceptable use — the "don't be that shop" list</h3>
          <ul>
            <li>No spam, bulk unsolicited messaging, fraud, counterfeit goods, or anything illegal under Nigerian law.</li>
            <li>No teaching the AI false prices to bait customers, and no using Vendora to impersonate another business.</li>
            <li>LEARN: / SYNC: only work from your registered owner number — if someone else gets your phone, tell us immediately.</li>
            <li>Don't probe, scrape or attack the service. Automated abuse gets accounts paused without refund.</li>
          </ul>

          <h3>6. AI honesty clause (read this one)</h3>
          <p>AI models occasionally err — wrong tone, misunderstood slang, confident-sounding mistakes. That's exactly why Vendora hands off instead of guessing when unsure, and why owner alerts exist. You agree to review flagged chats promptly; we are not liable for sales lost because a flagged chat sat unanswered, nor for replies generated from catalog data you entered incorrectly. Garbage in, garbage out — keep your catalog fresh.</p>

          <h3>7. Dependencies beyond our control</h3>
          <p>Vendora rides on WhatsApp/Meta, Twilio, AI providers (Gemini/Groq/OpenRouter/Anthropic), Paystack, and our hosts. If any of them has an outage, changes prices, or changes rules, parts of Vendora may degrade — and that isn't our breach. We'll always fail safe (flag to human, never invent answers) and post status in the dashboard when we can.</p>

          <h3>8. Your content &amp; our license</h3>
          <p>You own your catalog, profile and chats outright. You grant us only the narrow license needed to store them and feed them to the AI to serve your customers. We claim no ownership, run no ads against your content, and never sell it. Delete your account and the license ends (subject to legal retention in the Privacy Policy).</p>

          <h3>9. Suspension &amp; termination</h3>
          <ul>
            <li>We may pause accounts for abuse, fraud, non-payment investigation, or legal orders — usually with a warning first, instantly for serious abuse.</li>
            <li>You may leave anytime: cancel paid plans (keep Pro till period end), then delete your account from Settings or via Help. Export your catalog first — deletion is permanent after 14 days.</li>
          </ul>

          <h3>10. Liability — the cap</h3>
          <p>To the maximum extent permitted by law, Vendora is provided "as is" without warranties of any kind. Our total liability for anything arising from the service is capped at the amount you paid us in the 3 months before the claim (or ₦10,000 / $7 if you never paid). We are never liable for indirect losses: lost profits, lost customers, or Meta/WhatsApp restricting your number for policy breaches on your side.</p>

          <h3>11. Indemnity</h3>
          <p>You agree to cover us if your use of Vendora (your catalog content, your messages, your breach of these terms or of WhatsApp's policies) gets us into legal trouble with a third party. We'll notify you promptly and let you lead the defense.</p>

          <h3>12. Governing law &amp; disputes</h3>
          <p>These terms are governed by the laws of the Federal Republic of Nigeria. Disputes first go to good-faith negotiation for 30 days (write us from Help), then to mediation/arbitration in Lagos under the Arbitration and Mediation Act 2023 before any court action. If any clause is found unenforceable, the rest stands.</p>

          <h3>13. Changes</h3>
          <p>We'll post updates here with a new date and flag material changes in the dashboard or by email at least 7 days before they bite. Keep using Vendora after that and you've accepted them; the version in force when you paid governs that payment.</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
            <Link className="btn sm" to="/login">Start free trial</Link>
            <Link className="btn ghost sm" to="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </section>
      <footer className="foot-links landing-inner">
        <Link to="/faq">FAQ</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}
