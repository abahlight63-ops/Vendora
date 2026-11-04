// ── frontend/src/pages/Privacy.jsx ─────────────────────────────────
// WHAT: the public Privacy Policy (/privacy, no login), written for the Nigeria
// Data Protection Act 2023. Layout lives in components/LegalPage.jsx.
// Keep it true: if a provider or a retention period changes, change it here.
import { useEffect } from 'react';
import LegalPage, { CONTACT } from '../components/LegalPage.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';

const S = (id, title, body) => ({ id, title, body });
const SECTIONS = [
  S('who', 'Who we are', <>
    <p>VeloSales Ai ("VeloSales", "we", "us") is a business based in Nigeria that provides an AI sales assistant for shops on WhatsApp, Telegram, Facebook Messenger and Instagram (the "Service").</p>
    <p>For your account and shop information, we decide how and why it is used, so we are the <b>data controller</b>. For the messages your customers send your shop, <b>you</b> are the controller and we process them only on your instructions, as your <b>data processor</b>.</p>
  </>),
  S('collect', 'What we collect', <>
    <ul>
      <li><b>Account details:</b> your name, email address, password (stored only as a secure one-way hash), shop name and phone numbers.</li>
      <li><b>Shop content:</b> products, prices, photos, opening hours, questions and answers, and the settings you choose for Velo.</li>
      <li><b>Conversations:</b> messages between your customers and your shop on the channels you connect, including customer names, numbers or usernames those apps share with us.</li>
      <li><b>Billing:</b> your plan, payment amounts and dates, and the card type, last 4 digits and expiry date. We never receive or store a full card number.</li>
      <li><b>Usage and device data:</b> pages used, errors, browser and device type and IP address, to keep the Service working and secure.</li>
      <li><b>Support:</b> anything you send us when you ask for help.</li>
    </ul>
  </>),
  S('use', 'How we use it', <>
    <ul>
      <li>To run the Service: answer your customers, show your inbox and insights, and keep your settings.</li>
      <li>To bill you for paid plans and send receipts.</li>
      <li>To keep accounts safe, prevent abuse and fix problems.</li>
      <li>To send important account emails, such as sign-in codes, payment receipts and changes to these terms.</li>
      <li>To improve VeloSales Ai using usage patterns. We do not use your customers' messages to train public AI models.</li>
    </ul>
    <p>Our legal bases are: performing our contract with you, our legitimate interest in running a safe and reliable service, meeting legal obligations, and your consent where we ask for it (for example, phone alerts).</p>
  </>),
  S('customers', "Your customers' messages", <>
    <p>Your customers' messages belong to you. We read and store them only to reply for you, show them in your inbox and give you insights. We never sell them, never use them for advertising, and never contact your customers for our own purposes.</p>
    <p>You are responsible for having a lawful reason to message your customers and for telling them that an assistant may answer for your shop.</p>
  </>),
  S('ai', "How Velo's AI uses data", <>
    <p>To write a reply, Velo sends the customer's message, recent messages in that chat and the relevant parts of your catalog and settings to an AI provider. The provider returns a reply and is not allowed to use that data to train its own models under the terms we use.</p>
    <p>Velo only quotes products and prices from your catalog. When it is not sure, it passes the chat to you instead of guessing.</p>
  </>),
  S('share', 'Who we share it with', <>
    <p>We share data only with service providers that help us run VeloSales Ai, under contracts that require them to protect it:</p>
    <ul>
      <li><b>AI providers</b> (Google Gemini, Groq and OpenRouter) to write replies.</li>
      <li><b>Meta</b> (WhatsApp, Messenger, Instagram) and <b>Telegram</b> to receive and send messages on the channels you connect.</li>
      <li><b>Paystack</b> and <b>Flutterwave</b> to process payments.</li>
      <li><b>Email providers</b> to send account emails.</li>
      <li><b>Hosting and database providers</b> to run the app and store data.</li>
    </ul>
    <p>We may also share data if the law requires it, to protect people's safety, or as part of a sale or merger of our business, in which case this policy continues to apply.</p>
  </>),
  S('where', 'Where your data is stored', <>
    <p>Some of our providers store data outside Nigeria. When data leaves Nigeria, we rely on safeguards allowed by the Nigeria Data Protection Act, such as contractual protections and providers with recognised security standards.</p>
  </>),
  S('keep', 'How long we keep it', <>
    <ul>
      <li>Account and shop data: for as long as your account is open.</li>
      <li>Conversations: for as long as your account is open, unless you delete them sooner.</li>
      <li>Billing records: up to 6 years, because tax law requires it.</li>
      <li>After you close your account, we delete or anonymise your data within 30 days, except what we must keep by law.</li>
    </ul>
  </>),
  S('rights', 'Your rights', <>
    <p>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>
    <ul>
      <li>tell you what data we hold about you and give you a copy;</li>
      <li>correct data that is wrong;</li>
      <li>delete your data, or stop or limit how we use it;</li>
      <li>give you your data in a portable format;</li>
      <li>withdraw consent you gave us, at any time.</li>
    </ul>
    <p>Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We reply within 30 days. If you are not happy with our answer, you can complain to the Nigeria Data Protection Commission.</p>
  </>),
  S('security', 'Security', <>
    <p>We encrypt data in transit, store passwords only as secure hashes, check that messages and payments really come from Meta, Telegram, Paystack and Flutterwave, and limit who on our side can see your data. No system is perfectly secure; if a breach affects you, we will tell you and the regulator as the law requires.</p>
  </>),
  S('cookies', 'Cookies', <>
    <p>We use only the cookies and browser storage needed to keep you signed in and remember choices such as dark mode. We do not use advertising cookies.</p>
  </>),
  S('children', 'Children', <>
    <p>VeloSales Ai is for businesses and is not meant for anyone under 18. We do not knowingly collect data from children.</p>
  </>),
  S('changes', 'Changes to this policy', <>
    <p>If we change this policy in a way that matters, we will tell you by email or in the app before the change takes effect. The date at the top shows the latest version.</p>
  </>),
  S('contact', 'Contact us', <>
    <p>Questions or requests about your privacy: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
  </>),
];

export default function Privacy() {
  useEffect(() => {
    setPageMeta({ title: 'VeloSales Ai — Privacy Policy', description: 'How VeloSales Ai collects, uses and protects your shop data and your customers’ messages, under the Nigeria Data Protection Act 2023.', canonical: APP_URL + '/privacy' });
  }, []);
  return (
    <LegalPage
      which="privacy"
      title="Privacy Policy"
      sub="Written for the Nigeria Data Protection Act 2023"
      icon={<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>}
      short={[
        'We only collect what Velo needs to answer your customers and run your account.',
        "We never sell your data or your customers' data, and we show no ads.",
        "Your customers' messages are yours. We process them only to reply for you.",
        'You can see, export or delete your data at any time.',
      ]}
      sections={SECTIONS}
    />
  );
}
