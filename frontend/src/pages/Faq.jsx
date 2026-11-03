// ── frontend/src/pages/Faq.jsx ───────────────────────────────────
// WHAT: the public FAQ (/faq, no login). Same frame as Privacy and Terms (the
// .lg-* layout): violet header with a live search, topics on the side (a
// dropdown on phones), and open/close answers. Content is data: add a row to
// TOPICS and it appears. Keep answers true to the plans in Billing.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import { setPageMeta, APP_URL } from '../lib/seo.js';

export const FAQ_TOPICS = [
  ['start', 'Getting started', [
    ['Is there really a free plan?', 'Yes. Free gives you 50 replies a day on WhatsApp and Telegram, forever. Every new shop also gets 7 days of Pro free, and no card is needed.'],
    ['How do I connect my WhatsApp?', 'Open Channels and tap Connect on WhatsApp. A Meta window opens: sign in with Facebook, pick your business number and you are done. Then send yourself a test message.'],
    ['How do I add my products?', 'Add them one by one in Catalog, import a list, or send a message from your own number like "LEARN: Blue gown ₦45,000". Velo saves the name and price for you.'],
    ['How long does setup take?', 'Most shops are live in under 30 minutes: add a few products, connect a channel, then try Velo in Test Drive.'],
  ]],
  ['plans', 'Plans and billing', [
    ['How much does it cost?', 'Free is ₦0. Plus is ₦7,499 a month for 500 replies a day. Pro is ₦14,999 a month for 1,500 replies a day, voice notes and the smartest AI. Business starts from ₦39,999 a month for shops with many branches.'],
    ['How do I pay?', 'By card, bank transfer or USSD on a secure Paystack or Flutterwave checkout. We never see or store your full card number.'],
    ['What happens when I reach my daily limit?', 'Customers get a polite "we will reply shortly" message and the chat is flagged for you. Your limit resets at midnight, or you can upgrade any time.'],
    ['Can I cancel or get a refund?', 'Stop paying at any time and you keep your plan until the end of what you paid for, then move to Free. Your first payment can be refunded within 7 days if the service did not work for you. Double charges are always refunded.'],
  ]],
  ['velo', 'How Velo answers', [
    ['Will Velo make up prices?', 'No. Velo only quotes prices and products from your catalog. If something is missing, it hands the chat to you instead of guessing.'],
    ['What happens when Velo is not sure?', 'It tells the customer you will reply shortly, flags the chat as "Needs you" in your Inbox and alerts you, so you can step in.'],
    ['Does it speak Pidgin?', 'Yes. Velo answers the way each customer writes: Pidgin in, Pidgin out; formal English in, formal English out.'],
    ['Can I take over a chat myself?', 'Yes. Open the chat in your Inbox and reply. Velo steps back for that chat until you hand it back.'],
    ['Can AI make mistakes?', 'Sometimes, which is why Velo hands over when it is unsure and why an accurate catalog matters. Check flagged chats every day.'],
  ]],
  ['channels', 'Channels', [
    ['Which apps does Velo work on?', 'WhatsApp, Telegram, Facebook Messenger and Instagram. One inbox shows them all.'],
    ['Do I need WhatsApp Business?', 'You need a number connected through Meta. The Connect window walks you through it, step by step.'],
    ['Can customers send photos or voice notes?', 'Photos: Velo matches them to your catalog on Plus and above. Voice notes: on Pro and above, on the channels that support them.'],
  ]],
  ['data', 'Your data', [
    ['Is my data private?', 'Yes. Your catalog and chats are used only to answer your customers. We never sell data, show ads, or train public AI models on your content. See the Privacy Policy for details.'],
    ['How do I delete my account?', 'Write to velosales63@gmail.com from your account email. We delete your data within 30 days, except what the law makes us keep.'],
    ['How do I reach support?', 'Use the Help Center inside the app, or email velosales63@gmail.com. Include your shop name and a screenshot and we will sort it faster.'],
  ]],
];

export default function Faq() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState('start-0');
  const [topic, setTopic] = useState('start');
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setPageMeta({ title: 'VeloSales Ai — Frequently asked questions', description: 'Answers about VeloSales Ai: the free plan, prices, connecting WhatsApp, Telegram, Messenger and Instagram, Pidgin replies, refunds and your data.', canonical: APP_URL + '/faq' });
  }, []);
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => FAQ_TOPICS.map(([id, name, rows]) => [id, name, rows.map((r, i) => [r, i]).filter(([[a, b]]) => !q || (a + ' ' + b).toLowerCase().includes(q))]).filter(([, , rows]) => rows.length), [q]);
  const jump = (id) => { setTopic(id); setMenu(false); const el = document.getElementById('fq-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div className="lg">
      <header className="lg-top">
        <Link className="lg-brand" to="/"><Logo size={24} alt="" />VeloSales Ai</Link>
        <nav aria-label="Help pages">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link className="on" to="/faq">FAQ</Link>
        </nav>
      </header>
      <section className="lg-hero">
        <span className="lg-tag"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" /></svg>Help</span>
        <h1>Questions, answered</h1>
        <label className="fq-search">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#4F3FC7" strokeWidth="2.2" strokeLinecap="round" d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: free plan, LEARN, Pidgin, refund" aria-label="Search questions" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
        </label>
      </section>
      <div className="lg-grid">
        <aside className="lg-toc">
          <button type="button" className="lg-toc-btn" aria-expanded={menu} onClick={() => setMenu(!menu)}>Topics<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg></button>
          <nav className={'lg-toc-list' + (menu ? ' open' : '')} aria-label="Topics">
            <div className="lg-toc-head">Topics</div>
            {FAQ_TOPICS.map(([id, name], i) => <a key={id} href={'#fq-' + id} className={topic === id ? 'on' : ''} onClick={(e) => { e.preventDefault(); jump(id); }}><span>{i + 1}</span>{name}</a>)}
          </nav>
        </aside>
        <div className="lg-body fq-body">
          {shown.length === 0 && (
            <div className="lg-short"><b>No answers match “{query}”</b><p>Try fewer words, or email <a href="mailto:velosales63@gmail.com">velosales63@gmail.com</a>.</p></div>
          )}
          {shown.map(([id, name, rows]) => (
            <section key={id} id={'fq-' + id} className="fq-sec">
              <h2 className="fq-kick">{name}</h2>
              {rows.map(([[question, answer], i]) => {
                const k = id + '-' + i;
                const isOpen = open === k || !!q;
                return (
                  <div key={k} className={'fq-item' + (isOpen ? ' open' : '')}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(open === k ? '' : k)}>
                      <span>{question}</span>
                      <i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d={isOpen ? 'M6 6l12 12M18 6L6 18' : 'M6 9l6 6 6-6'} /></svg></i>
                    </button>
                    {isOpen && <p>{answer}</p>}
                  </div>
                );
              })}
            </section>
          ))}
          <div className="fq-cta">
            <div><b>Still have a question?</b><p>Start free and ask us from the Help Center, or email velosales63@gmail.com.</p></div>
            <Link className="btn lg" to="/login">Start free</Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
