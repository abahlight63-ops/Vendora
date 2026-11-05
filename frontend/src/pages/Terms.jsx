// ── frontend/src/pages/Terms.jsx ─────────────────────────────────
// WHAT: the public Terms of Service (/terms, no login). Layout lives in
// components/LegalPage.jsx. Keep prices and plan rules in step with Billing.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { CONTACT } from '../components/LegalPage.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';

const S = (id, title, body) => ({ id, title, body });
const SECTIONS = [
  S('agree', 'Agreeing to these terms', <>
    <p>These terms are an agreement between you and VeloSales Ai ("VeloSales", "we", "us"), a business based in Nigeria. By creating an account or using VeloSales Ai, you agree to them for yourself and for the business you represent. If you do not agree, please do not use the Service.</p>
  </>),
  S('service', 'What VeloSales Ai does', <>
    <p>VeloSales Ai gives your shop an AI assistant, "Velo", that answers customers on the channels you connect, using the products, prices and rules you give it. It can pass a chat to you when it is not sure. Features differ by plan and may change as we improve the Service.</p>
  </>),
  S('account', 'Your account', <>
    <ul>
      <li>You must be at least 18 and able to enter a contract.</li>
      <li>Give us true details and keep your password and sign-in codes private. You are responsible for what happens in your account.</li>
      <li>Tell us straight away at <a href={`mailto:${CONTACT}`}>{CONTACT}</a> if you think someone else has access.</li>
    </ul>
  </>),
  S('content', 'Your shop content and responsibility', <>
    <p>You are responsible for your products, prices, photos and rules, and for keeping them accurate. Velo repeats what you give it. You must have the right to sell what you list and to use any photos you upload.</p>
    <p>You keep ownership of your content. You give us permission to store and use it only to provide the Service to you.</p>
  </>),
  S('use', 'Acceptable use', <>
    <p>You must not use VeloSales Ai to:</p>
    <ul>
      <li>sell anything illegal, counterfeit, stolen or dangerous, or anything the channels' own rules forbid;</li>
      <li>deceive, scam, harass or spam people, or send messages people did not ask for;</li>
      <li>break WhatsApp, Meta, Telegram or payment-provider rules;</li>
      <li>try to break, overload or copy the Service, or get around its limits.</li>
    </ul>
    <p>We may pause or close accounts that break these rules.</p>
  </>),
  S('ai', "Velo's answers", <>
    <p>Velo is designed to answer only from your catalog and to hand over when it is not sure, but AI can still make mistakes. Check your inbox regularly, especially chats Velo flags for you. You are responsible for any sale, price or promise made to your customers through your shop.</p>
  </>),
  S('plans', 'Plans, trials and payment', <>
    <ul>
      <li>The Free plan is free and includes a daily number of replies. When you reach it, customers are told you will reply soon.</li>
      <li>New shops may get a free Pro trial. When it ends, you move to Free unless you choose a paid plan. No card is needed for the trial.</li>
      <li>Paid plans are paid in advance, for one month or one year at a time, through Paystack or Flutterwave, at the price shown on <Link to="/billing">Plan and usage</Link> when you pay. They do not renew or charge you automatically.</li>
      <li>If we change prices, we will tell you at least 30 days before the change affects you.</li>
    </ul>
  </>),
  S('refunds', 'Cancelling and refunds', <>
    <p>Paid plans never renew by themselves, so you can stop at any time by not paying again. You keep your paid plan until the end of the period you paid for, then move to Free, and your data is not deleted.</p>
    <p>If the Service genuinely failed you, you can ask for a refund of your first payment within 7 days. Accidental double charges are always refunded in full. Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. The full rules are in the <Link to="/refunds">Refund Policy</Link>.</p>
  </>),
  S('others', 'Services we depend on', <>
    <p>VeloSales Ai relies on services we do not control, such as WhatsApp, Meta, Telegram, AI providers and payment providers. If one of them changes its rules, fails or blocks an account, parts of the Service may stop working. We will do our best to keep you informed and to restore the Service.</p>
  </>),
  S('end', 'Pausing or closing accounts', <>
    <p>You can close your account at any time. We may pause or close an account that breaks these terms, puts others at risk or has not paid, and where possible we will tell you why first.</p>
  </>),
  S('liability', 'Limits of our responsibility', <>
    <p>We provide the Service with reasonable care and skill, but "as available". As far as the law allows, we are not responsible for indirect losses, such as lost profits or sales, and our total responsibility to you is limited to what you paid us in the 12 months before the problem. Nothing in these terms removes rights you have under Nigerian consumer law.</p>
  </>),
  S('law', 'Law and disputes', <>
    <p>These terms are governed by the laws of the Federal Republic of Nigeria. If we disagree, we will first try to settle it by talking. If that fails within 30 days, either of us may take it to the courts of Nigeria.</p>
  </>),
  S('changes', 'Changes to these terms', <>
    <p>If we change these terms in a way that matters, we will tell you by email or in the app before the change takes effect. Using the Service after that means you accept the new terms.</p>
  </>),
  S('contact', 'Contact us', <>
    <p>Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
  </>),
];

export default function Terms() {
  useEffect(() => {
    setPageMeta({ title: 'VeloSales Ai — Terms of Service', description: 'The rules for using VeloSales Ai: plans, payments, refunds, acceptable use and how Velo answers your customers.', canonical: APP_URL + '/terms' });
  }, []);
  return (
    <LegalPage
      which="terms"
      title="Terms of Service"
      sub="The rules for using VeloSales Ai"
      icon={<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" /></svg>}
      short={[
        'Use VeloSales Ai for honest selling only.',
        'You are responsible for your products and prices. Velo only repeats what you add.',
        'Free stays free. Paid plans never renew by themselves, and you keep them until the end of what you paid for.',
        'Your shop content stays yours.',
      ]}
      sections={SECTIONS}
    />
  );
}
