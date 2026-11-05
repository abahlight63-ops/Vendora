// ── frontend/src/pages/Refunds.jsx ─────────────────────────────────
// WHAT: the public Refund Policy (/refunds). Must match Terms → "Cancelling and refunds".
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { CONTACT } from '../components/LegalPage.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';

const S = (id, title, body) => ({ id, title, body });
const SECTIONS = [
  S('free', 'Free plan and trial', <>
    <p>The Free plan costs nothing. The 7-day Pro trial is free and needs no card. When it ends you move to Free automatically, and nothing is charged.</p>
  </>),
  S('cancel', 'Cancelling a paid plan', <>
    <p>Paid plans do not renew by themselves: each payment covers one month or one year, and you choose whether to pay again on <Link to="/billing">Plan and usage</Link>. To stop, simply do not pay for the next period. You keep the paid plan until the end of what you paid for, then move to Free. Your shop, products and chats are not deleted.</p>
  </>),
  S('when', 'When we refund', <>
    <ul>
      <li><b>First payment:</b> if the Service genuinely did not work for you, ask within 7 days of your first payment and we refund it in full.</li>
      <li><b>Double or wrong charges:</b> always refunded in full, whenever you notice them.</li>
      <li><b>A long outage on our side:</b> if VeloSales Ai is unavailable for more than 3 days in a row in a paid period, we add the lost days to your plan, or refund them if you prefer.</li>
    </ul>
  </>),
  S('not', 'When we do not refund', <>
    <ul>
      <li>Later payments after the first one, once the period you paid for has started.</li>
      <li>Accounts closed for breaking the <Link to="/terms">Terms</Link>, such as scams or spam.</li>
      <li>Problems caused by services we do not control, such as WhatsApp or Meta blocking a number for breaking their rules.</li>
    </ul>
  </>),
  S('how', 'How to ask', <>
    <p>Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from your account email with the payment date and amount. We answer within 3 working days. Approved refunds go back to the card or account you paid with through Paystack or Flutterwave, usually within 5 to 10 working days, depending on your bank.</p>
  </>),
  S('prices', 'Prices and charges', <>
    <p>Prices are shown in naira (or US dollars outside Nigeria) on <Link to="/billing">Plan and usage</Link> before you pay, and that is the full amount charged. We do not add hidden fees. If we change prices, we tell you at least 30 days before it affects you.</p>
  </>),
];

export default function Refunds() {
  useEffect(() => { setPageMeta({ title: 'VeloSales Ai — Refund Policy', description: 'When and how VeloSales Ai refunds payments, and how to cancel a paid plan.', canonical: APP_URL + '/refunds' }); }, []);
  return (
    <LegalPage which="refunds" title="Refund Policy" sub="Cancelling, refunds and prices"
      icon={<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>}
      short={['The free trial needs no card and never charges you.', 'Paid plans never renew by themselves; you keep what you paid for until it ends.', 'First payment refunded within 7 days if it did not work for you.', 'Double charges are always refunded.']}
      sections={SECTIONS} />
  );
}
