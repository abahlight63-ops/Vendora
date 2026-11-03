// ── frontend/src/pages/Billing.jsx ─────────────────────────────────
// WHAT: subscriptions HQ. Top: the CURRENT PLAN card (what you're on, what it
// renews for, when) beside a USAGE summary (reply allowance, cycle, renewal).
// Then Free/Pro/Pro Plus tiers (monthly/yearly in the shop's currency), the
// billing-history table (Paid/Failed pills) and the payment-method card.
// Then the Compare-plans table and the Enterprise card.
// CARD ONLY: the checkout route is picked by LOCATION on the backend — brand
// names never appear in this UI (shoppers pay on a secure checkout page; logos
// live there, not here). Enterprise opens a form in a NEW TAB (never a
// mailto — owners fill + we reply; the address stays private).
// FLOWS: pay() → provider session → redirect. All money via money() helper
// (NGN ₦ / USD $). Backend is source of truth for prices (display fallbacks!).
// HISTORY: rendered only from rows the server actually sends. No invented
// receipts — an empty table says so, honestly.
import { useEffect, useState } from 'react'; // useState = bill/busy/period; useEffect = load on mount
import LoadFailed from '../components/LoadFailed.jsx'; // branded failed card + Retry
import { describeNetError } from '../lib/netDetail.js'; // one voice for load failures
import { api, fmtDate, pop } from '../lib/api.js'; // api() calls; fmtDate = expiry dates; pop() = big animated outcomes
import { money } from '../lib/money.js'; // money(n, 'NGN'|'USD') formatter
import Ic from '../components/icons.jsx'; // check icons
import Loader from '../components/Loader.jsx'; // mini orbit in the pay button

const PRO_FEATS = [ // Pro tier: the full salesperson (same for monthly + yearly — ONE tier, two prices!)
  'Unlimited AI replies, Pidgin + English',
  'Suggestive selling — up to 5 options per answer',
  'Product photos inside WhatsApp + Telegram replies',
  'Instant owner alerts for hot orders',
  'Full inbox + chat history',
  'ComeBack follow-ups for abandoned buyers',
  'Catalog LEARN mode from WhatsApp',
  'Profile sync + verified products',
  'Insights: handled %, peak hours',
];

const PLUS_EXTRAS = [ // Pro Plus: everything in Pro, PLUS these (voice + heavy models + queue jump)
  'Voice-note transcription (Whisper AI)',
  '2 heavy-work modes (Smart + Normal)',
  'Priority support — jump the queue',
];

const FREE_FEATS = [ // Free forever: the honest starter (bot NEVER pauses — manual catalog keeps replying!)
  'AI replies from products you add or teach',
  'Catalog LEARN mode from WhatsApp',
  'Full inbox + chat history',
  'Instant owner alerts for hot orders',
  '50 bot replies per day',
];

// Compare-plans rows: [label, free, pro, plus] — true = check, false = dash,
// string = exact cell text. Keep in sync with PRO_FEATS/PLUS_EXTRAS above!
const COMPARE_ROWS = [
  ['Price', '₦0 forever', 'Paid monthly/yearly', 'Paid monthly/yearly'],
  ['AI replies from your manual catalog', true, true, true],
  ['Teach with LEARN: messages', true, true, true],
  ['Full inbox + chat history', true, true, true],
  ['Hot-order owner alerts', true, true, true],
  ['Bot replies per day', '50', '500', 'Unlimited'],
  ['Profile sync + verified products', false, true, true],
  ['Product photos inside replies', false, true, true],
  ['Suggestive selling (up to 5 options)', false, true, true],
  ['ComeBack abandoned-buyer follow-ups', false, true, true],
  ['Insights: handled %, peak hours', false, true, true],
  ['Voice-note transcription', false, false, true],
  ['Heavy work modes (Smart + Normal)', false, false, true],
  ['Priority support', false, false, true],
];

const FALLBACK_PLANS = { // display defaults while /api/me/billing loads (MUST match server defaults! backend remains the real truth)
  currency: 'NGN',
  pro: {
    monthly: { amount: 7499 }, // ₦7,499/mo
    yearly: { amount: 69999, save: 19989, save_pct: 22 }, // ₦69,999/yr (saves ₦19,989 ≈ 22%)
  },
  plus: {
    monthly: { amount: 14999 }, // ₦14,999/mo
    yearly: { amount: 119999, save: 59989, save_pct: 33 }, // ₦119,999/yr (saves ₦59,989 ≈ 33%)
  },
  sales_email: 'velosales63@gmail.com',
  monthly: { naira: 7499, amount: 7499 }, // legacy aliases (old clients read these)
  yearly: { naira: 69999, amount: 69999, save_naira: 19989, save: 19989, save_pct: 22 },
};

export default function Billing() {
  const [bill, setBill] = useState(null); // null = loading (statusLine shows 'Loading…')
  const [busy, setBusy] = useState(''); // '' = idle; plan key = which button spins
  const [usage, setUsage] = useState(null); // { used, limit, unlimited } from the channels status (today's replies)
  const [period, setPeriod] = useState('monthly'); // 'monthly' | 'yearly' — the billing-period toggle (yearly default: shows the savings!)

  const [failed, setFailed] = useState(null); // null | { detail }: the plan could not load (Retry card, never an eternal skeleton)
  async function load() { // reusable reload (mount, retry, and after a card payment)
    try {
      setFailed(null);
      const { ok, status: st, data } = await api('/api/me/billing', { timeout: 15000 }); // status, tier, currency, plans{pro,plus}, provider flags
      if (ok && data) setBill(data);
      else setFailed({ status: st, detail: 'Please try again in a moment.' });
    } catch (e) { setFailed({ status: 0, detail: describeNetError(e) }); }
  }
  useEffect(() => { load(); }, []); // [] = mount-only
  useEffect(() => { // today's replies live on the channels status; the plan page reads them from there
    api('/api/me/channels', { timeout: 15000 }).then(({ ok, data }) => {
      const w = ok && data && data.whatsapp;
      if (w) setUsage({ used: Number(w.dailyUsed) || 0, limit: w.dailyLimit ? Number(w.dailyLimit) : null, unlimited: !!w.dailyUnlimited });
    }).catch(() => {});
  }, []);
  useEffect(() => { // Paystack RETURN: ?reference=… → server-verified (a plan activates; a card check saves the card)
    const q = new URLSearchParams(window.location.search);
    const ref = q.get('reference') || q.get('trxref');
    if (!ref || q.get('transaction_id')) return;
    window.history.replaceState({}, '', window.location.pathname);
    api('/api/billing/verify?provider=paystack&reference=' + encodeURIComponent(ref)).then(({ ok, data }) => {
      if (ok && data && data.card) { load(); pop('ok', 'Card saved', 'Your card is on file. The ₦50 check is being refunded to you.'); }
      else if (ok) { load(); pop('ok', 'Payment confirmed', 'Your plan is active. Your receipt is in your email.'); }
      else pop('err', 'Payment not confirmed yet', (data && data.error) || 'If money left your account, wait a minute and refresh.');
    }).catch(() => pop('err', 'Could not check the payment', 'Refresh this page in a minute.'));
  }, []);
  useEffect(() => { // Flutterwave RETURN: ?transaction_id=… in the URL → server-verified activation (idempotent — webhook usually already did it!)
    const q = new URLSearchParams(window.location.search);
    const tx = q.get('transaction_id') || q.get('tx_ref');
    if (!tx) return;
    window.history.replaceState({}, '', window.location.pathname); // strip FIRST (refresh-safe!)
    api('/api/billing/verify?provider=flutterwave&tx_id=' + encodeURIComponent(q.get('transaction_id') || tx)).then(({ ok, data }) => {
      if (ok) { load(); pop('ok', 'Payment confirmed — Pro is active!', 'Receipt emailed to you. Enjoy the full plan.'); }
      else pop('err', 'Payment not confirmed yet', (data && data.error) || 'If money left your account, wait a minute and retry.');
    }).catch(() => pop('err', 'Could not verify payment', 'If it still shows Free below, retry in a minute.'));
  }, []);

  const [checkout, setCheckout] = useState(null); // { plan, name, price } while the pay sheet is open
  const [method, setMethod] = useState('card');
  function openCheckout(plan, name, price) { setMethod('card'); setCheckout({ plan, name, price }); }
  useEffect(() => { // coming from sign-up with a plan picked: open its checkout once the prices load
    const pick = new URLSearchParams(window.location.search).get('pick');
    if (!pick || !bill) return;
    window.history.replaceState({}, '', window.location.pathname);
    const tierKey = pick.split('_')[0];
    const tierObj = bill.plans && bill.plans[tierKey];
    if (tierObj) openCheckout(pick, tierKey === 'plus' ? 'Pro' : 'Plus', money((tierObj.monthly || {}).amount || 0, bill.currency === 'USD' ? 'USD' : 'NGN'));
  }, [bill]);
  async function addCard() {
    setBusy('card');
    const { ok, data } = await api('/api/billing/card', { method: 'POST', body: '{}' });
    setBusy('');
    if (ok && data.authorization_url) { location.href = data.authorization_url; }
    else pop('err', 'Could not open the card page', (data && data.error) || 'Please try again.');
  }
  async function pay(plan, channel) { // CARD FLOW: secure checkout session → redirect the whole page there
    const isUSD = (bill?.currency === 'USD'); // Dollar shops → international checkout, Naira shops → local checkout (location does the routing, silently!)
    const endpoint = isUSD ? '/api/billing/flutterwave/initialize' : '/api/billing/initialize'; // backend route differs; the SHOPPER never sees brand names
    setBusy(plan); // lock buttons (busy string = this plan's button shows 'Starting…')
    const { ok, data } = await api(endpoint, { method: 'POST', body: JSON.stringify({ plan, channel }) }); // send ONLY the plan key (amount enforced server-side!)
    setBusy(''); // unlock (ALWAYS — success navigates away anyway, failure must unlock!)
    if (ok && data.authorization_url) { // session created → checkout URL received…
      pop('ok', 'Opening secure checkout…', 'Complete your payment on the secure page to activate instantly.'); // success popup FIRST (user sees confirmation)…
      setTimeout(() => { location.href = data.authorization_url; }, 1200); // …then leave after 1.2s (location.href = full-page navigation, exits the SPA!)
    } else { // backend refused (no keys, unknown plan, no email…)…
      pop('err', 'Payment failed to start', data.error || 'Could not start payment. Contact support from Help.'); // …error popup WITH direction (never dead-end the user!)
    }
  }

  const status = bill?.status || '…'; // ?. + || : loading → '…' placeholder (never crash on null bill)
  const pill = status === 'active' ? 'ok' : status === 'trialing' ? 'flag' : status === 'pending' ? 'info' : 'off'; // chained ternary: status → pill color
  const cur = bill?.currency === 'USD' ? 'USD' : 'NGN'; // whitelist to two currencies (default NGN while loading)
  const plans = bill?.plans || FALLBACK_PLANS; // backend prices or display defaults
  const pro = plans.pro || FALLBACK_PLANS.pro; // nested tier (backend shape); || fallback guards old cached responses
  const plus = plans.plus || FALLBACK_PLANS.plus;
  const amt = (p) => money(p?.amount ?? 0, cur); // helper: canonical amount → formatted (?. + ?? = bulletproof against EITHER shape!)
  const trialLeft = bill?.trial_days_left; // whole days left (number when trialing, null otherwise!)

  const planName = bill?.tier === 'plus' ? 'Pro Plus' : bill?.tier === 'pro' ? 'Pro' : 'Free'; // the tier this shop is on
  const renewal = status === 'active' ? fmtDate(bill?.expires) : status === 'trialing' ? fmtDate(bill?.trial_ends) : '—'; // what the date actually means depends on where you are
  const allowance = bill?.tier === 'plus' ? 'Unlimited' : bill?.tier === 'pro' ? '500 per day' : '50 per day'; // the real per-tier reply cap (matches the server)
  const history = Array.isArray(bill?.history) ? bill.history : Array.isArray(bill?.invoices) ? bill.invoices : []; // only rows the server truly sent

  const freeCard = () => { // FREE tier card (₦0/$0 — no checkout exists; cancelling = just stop paying!)
    const label = status === 'active' ? 'Paid plan active — free is your fallback'
      : status === 'trialing' ? 'Free waits for you after the trial'
      : 'Current plan'; // expired/never-paid → free IS the plan (bot keeps replying!)
    return (
      <div className={'plan' + (bill && !bill.tier ? ' on-plan' : '')}>
        <span className="plan-badge" style={{ background: 'linear-gradient(135deg,#128c4a,#0b6b38)' }}>FREE FOREVER</span>
        <h2>Free</h2>
        <p className="desc">The honest starter — your bot never stops replying.</p>
        <div className="plan-price">{money(0, cur)}<small>/forever</small></div>
        <ul className="plan-feats">{FREE_FEATS.map((f) => (<li key={f}><Ic n="checkCircle" s={15} /><span>{f}</span></li>))}</ul>
        <button className="btn ghost" disabled>{label}</button> {/* disabled = no action to take (free needs no checkout, no cancel button!) */}
      </div>
    );
  };

  const compareCell = (v) => { // true → check icon; false → dash; string → exact text
    if (v === true) return <Ic n="checkCircle" s={16} />;
    if (v === false) return <span style={{ color: 'var(--faint)' }}>—</span>;
    return <span>{v}</span>;
  };

  const statusLine = !bill ? 'Loading…' // 4-way status message (reads like a human wrote each one):
    : status === 'active' ? `Pro active until ${fmtDate(bill.expires)}. Profile sync, photos + priority support on.` // backticks interpolate the date
    : status === 'trialing' ? (trialLeft != null && trialLeft > 0
      ? `Pro trial: ${trialLeft} day${trialLeft === 1 ? '' : 's'} left (ends ${fmtDate(bill.trial_ends)}). Pick Pro or Pro Plus to keep it — manual catalog stays free forever.`
      : `Pro trial ends ${fmtDate(bill.trial_ends)}. Pick Pro or Pro Plus to keep it — manual catalog stays free forever.`)
    : status === 'pending' ? 'Payment received — activation in progress. Check back in a moment.'
    : 'Free plan — your bot keeps replying from your manual catalog. Upgrade to Pro for profile sync + photos.'; // expired/anything-else → free reassurance (bot NEVER pauses!)

  const tierCard = (tierKey, tier, isHot, badge) => { // ONE renderer for both tiers (tierKey 'pro'|'plus', tier {monthly, yearly})
    const price = tier[period]; // selected period's price object
    const planKey = `${tierKey}_${period}`; // backend plan key: pro_monthly, pro_yearly, plus_monthly, plus_yearly
    const feats = tierKey === 'plus' ? [...PRO_FEATS.slice(0, 4), ...PLUS_EXTRAS, ...PRO_FEATS.slice(4)] : PRO_FEATS; // Plus shows Pro core + extras inline (no "see above" hunting!)
    const onPlan = !!(bill && bill.tier === tierKey && status === 'active'); // already paying for THIS tier?
    return (
      <div className={'plan' + (isHot ? ' hot' : '') + (onPlan ? ' on-plan' : '')}> {/* .hot = highlighted border + badge (CSS); .on-plan = where you already are */}
        {onPlan ? <span className="plan-badge on">YOUR PLAN</span> : badge && <span className="plan-badge">{badge}</span>}
        <h2>{tierKey === 'plus' ? 'Pro Plus' : 'Pro'}</h2>
        <p className="desc">{tierKey === 'plus' ? 'Voice notes, heavy work models, full speed.' : 'The full AI salesperson for your shop.'}</p>
        <div className="plan-price">{amt(price)}<small>/{period === 'monthly' ? 'month' : 'year'}</small></div>
        {period === 'yearly' && price?.save_pct != null && ( // save pill ONLY on yearly (monthly has nothing to save vs itself!)
          <span className="plan-save">Save {money(price.save, cur)} — {price.save_pct}% off monthly</span> // server-computed save + pct (NGN 22%/33%, USD mirrors!)
        )}
        <ul className="plan-feats">{feats.map((f) => (<li key={f}><Ic n="checkCircle" s={15} /><span>{f}</span></li>))}</ul>
        <button className={'btn' + (isHot ? '' : ' ghost')} disabled={!!busy} onClick={() => openCheckout(planKey, c.name, price)}>{busy === planKey ? (<><Loader size={15} />Starting…</>) : status === 'active' ? `Extend ${tierKey === 'plus' ? 'Pro Plus' : 'Pro'} ${period}` : `${amt(price)}/${period === 'monthly' ? 'month' : 'year'} — ${tierKey === 'plus' ? 'Pro Plus' : 'Pro'}`}</button>
      </div>
    );
  };

  if (!bill) return (
    <>
      <div className="page-head"><div><h1>Plan and usage</h1><p>Your plan, today's replies and your payments.</p></div></div>
      {failed
        ? <LoadFailed title="Couldn't load your plan" status={failed.status} detail={failed.detail} tries={0} onRetry={load} backTo="/dashboard" backLabel="Back to Home" />
        : <div className="skel-grid" aria-busy="true"><div className="skel-grid cols2">{[0, 1].map((i) => (<div key={i} className="skel-card"><div className="skel" style={{ width: '40%' }} /><div className="skel" style={{ width: '70%', height: 26 }} /><div className="skel" style={{ width: '90%' }} /></div>))}</div><div className="skel-card"><div className="skel" style={{ width: '30%' }} /><div className="skel" style={{ height: 120 }} /></div></div>}
    </>
  );
  // ── the new look: usage first, then the four plans ──
  // NAMES: the server still sells two paid tiers. Plus buys its "pro" key and Pro
  // buys its "plus" key. Each card only promises what that key really gives today.
  const paid = bill?.tier === 'pro' || bill?.tier === 'plus'; // the server says 'free' as a word, so check the paid keys
  const shownName = bill?.tier === 'plus' ? 'Pro' : bill?.tier === 'pro' ? 'Plus' : 'Free';
  const used = usage?.used ?? null;
  const limit = usage?.unlimited ? null : (usage?.limit ?? (bill?.tier === 'plus' ? null : bill?.tier === 'pro' ? 500 : 50));
  const pct = used != null && limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const left = used != null && limit ? Math.max(0, limit - used) : null;
  const pace = (() => { // "at today's pace": only when there is enough of today to judge
    if (used == null || !limit || used < 5 || used >= limit) return null;
    const now = new Date(); const hrs = now.getHours() + now.getMinutes() / 60;
    if (hrs < 2) return null;
    const at = hrs + (limit - used) / (used / hrs);
    if (at >= 24) return 'At today\'s pace you won\'t run out today.';
    const h = Math.floor(at), m = Math.round((at - h) * 60);
    const t = new Date(); t.setHours(h, m >= 60 ? 59 : m, 0, 0);
    return `At today's pace you'll reach ${limit} replies at about ${t.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
  })();
  const per = period === 'monthly' ? 'month' : 'year';
  const PLAN_CARDS = [
    { key: null, name: 'Free', price: money(0, cur), per: 'month', feats: [[true, '50 replies a day'], [true, 'WhatsApp and Telegram'], [false, 'Voice notes'], [false, 'Product photos in replies'], [false, 'Import your WhatsApp catalog'], [true, 'Standard AI']] },
    { key: 'pro', name: 'Plus', tier: pro, feats: [[true, '500 replies a day'], [true, 'WhatsApp and Telegram'], [false, 'Voice notes'], [true, 'Product photos in replies'], [true, 'Import your WhatsApp catalog'], [true, 'Smarter AI']] },
    { key: 'plus', name: 'Pro', tier: plus, best: true, feats: [[true, '1,500 replies a day'], [true, 'WhatsApp and Telegram'], [true, 'Voice notes'], [true, 'Product photos in replies'], [true, 'Import your WhatsApp catalog'], [true, 'Our smartest AI and priority support']] },
    { key: 'business', name: 'Business', price: cur === 'USD' ? 'Custom' : '₦39,999', per: 'month', feats: [[true, '5,000 replies a day'], [true, 'Several branches, one dashboard'], [true, 'Voice notes'], [true, 'Product photos in replies'], [true, 'Setup call with our team'], [true, 'Priority support']] },
  ];
  const onTier = (k) => (k === null ? !paid || (status !== 'active' && status !== 'trialing') : bill?.tier === k && status === 'active');
  return (
    <div className="pu">
      <div className="pu-head">
        <div>
          <div className="dg-status on"><i />{status === 'trialing' && trialLeft ? `Pro trial: ${trialLeft} day${trialLeft === 1 ? '' : 's'} left` : `You're on ${shownName}`}</div>
          <h1>Plan and usage</h1>
        </div>
        <div className="wx-pills pu-period" role="group" aria-label="Billing period">
          <button type="button" className={'wx-pill' + (period === 'monthly' ? ' on' : '')} aria-pressed={period === 'monthly'} disabled={!!busy} onClick={() => setPeriod('monthly')}>Monthly</button>
          <button type="button" className={'wx-pill' + (period === 'yearly' ? ' on' : '')} aria-pressed={period === 'yearly'} disabled={!!busy} onClick={() => setPeriod('yearly')}>Yearly{plus.yearly?.save_pct ? ` · save up to ${plus.yearly.save_pct}%` : ''}</button>
        </div>
      </div>

      <section className="pu-hero glass">
        <div className="pu-usage">
          <div className="pu-usage-top"><span className="ch-chip ready">{shownName} plan</span><span className="pu-reset"><Ic n="clock" s={15} />Resets at midnight</span></div>
          {limit ? (
            <>
              <div className="pu-big"><b>{used ?? '–'}</b><span>of {limit} replies used today</span></div>
              <div className="pu-meter" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used || 0} aria-label="Replies used today"><i style={{ width: pct + '%' }} /></div>
              <p className="pu-note">{left != null ? `${left} left today. ` : ''}{pace || 'When they run out, customers get "We\'ll be back with you shortly" and you answer yourself.'}</p>
            </>
          ) : (
            <>
              <div className="pu-big"><b>{used ?? '–'}</b><span>replies today</span></div>
              <p className="pu-note">Your plan has no daily cap. Velo keeps answering all day.</p>
            </>
          )}
          {status === 'active' && <p className="pu-note">Renews on <b>{fmtDate(bill.expires)}</b>.</p>}
        </div>
        {bill?.tier !== 'plus' && (
          <div className="pu-push">
            <b>{bill?.tier === 'pro' ? 'Want voice notes too?' : 'Never run out at night'}</b>
            <p>{bill?.tier === 'pro' ? 'Pro adds voice notes, our smartest AI and priority support.' : 'Plus gives you 500 replies a day, product photos in replies and catalog import.'}</p>
            <button type="button" className="pu-push-go" disabled={!!busy} onClick={() => openCheckout(`${bill?.tier === 'pro' ? 'plus' : 'pro'}_${period}`, bill?.tier === 'pro' ? 'Pro' : 'Plus', amt((bill?.tier === 'pro' ? plus : pro)[period]))}>
              {busy ? (<><Loader size={17} />Starting</>) : <>{bill?.tier === 'pro' ? 'Upgrade to Pro' : 'Upgrade to Plus'} · {amt((bill?.tier === 'pro' ? plus : pro)[period])}</>}
              <span className="pu-knob" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" /></svg></span>
            </button>
          </div>
        )}
      </section>

      <div className="pu-tiles">
        {[
          ['Voice notes', bill?.tier === 'plus' ? 'Included' : 'Not on your plan', bill?.tier === 'plus' ? 'Customers can send voice notes' : 'Comes with Pro', 'phone'],
          ['Product photos in replies', paid ? 'Included' : 'Not on Free', paid ? 'Velo sends your product photos' : 'Comes with Plus and Pro', 'camera'],
          status === 'trialing' && trialLeft != null
            ? ['Pro trial', `${trialLeft} day${trialLeft === 1 ? '' : 's'} left`, `Ends ${fmtDate(bill.trial_ends)}`, 'clock']
            : ['Your catalog and chats', 'Always yours', 'On every plan, even Free', 'checkCircle'],
        ].map(([n, v, s, ic]) => (
          <section key={n} className="pu-tile glass"><span className="pu-tile-ic"><Ic n={ic} s={19} /></span><b>{n}</b><strong>{v}</strong><small>{s}</small></section>
        ))}
      </div>

      <div className="pu-plans-head" id="plans"><h2>Choose your plan</h2><span>Prices in {cur === 'USD' ? 'US dollars' : 'naira'}. Cancel any time.</span></div>
      <div className="pu-plans">
        {PLAN_CARDS.map((c) => {
          const price = c.tier ? amt(c.tier[period]) : c.price;
          const save = c.tier && period === 'yearly' && c.tier.yearly?.save ? `Save ${money(c.tier.yearly.save, cur)} a year` : null;
          const mine = onTier(c.key);
          const planKey = c.key && c.key !== 'business' ? `${c.key}_${period}` : null;
          return (
            <section key={c.name} className={'pu-plan' + (c.best ? ' best' : '') + (mine ? ' mine' : '')}>
              <div className="pu-plan-top"><b>{c.name}</b>{mine ? <span className="ch-chip ready">Your plan</span> : c.best ? <span className="pu-best">Best value</span> : null}</div>
              <div className="pu-price">{price}<small> / {c.tier ? per : c.per}</small></div>
              {save && <span className="pu-save">{save}</span>}
              <ul>{c.feats.map(([ok, t]) => <li key={t} className={ok ? '' : 'no'}><i aria-hidden="true">{ok ? <Ic n="check" s={12} /> : '–'}</i>{t}</li>)}</ul>
              {c.key === null ? <button type="button" className="pu-plan-btn ghosty" disabled>{mine ? 'Your plan' : 'Always free'}</button>
                : c.key === 'business' ? <a className="pu-plan-btn" href="/contact-sales" target="_blank" rel="noreferrer">Talk to us</a>
                  : <button type="button" className="pu-plan-btn" disabled={!!busy} onClick={() => openCheckout(planKey, c.name, price)}>{busy === planKey ? (<><Loader size={15} />Starting</>) : mine ? `Extend ${c.name}` : `Choose ${c.name}`}</button>}
            </section>
          );
        })}
      </div>

      <div className="pu-bottom">
        <section className="glass pu-box">
          <div className="pu-box-head"><h2>Payments</h2><span>{history.length} record{history.length === 1 ? '' : 's'}</span></div>
          {history.length === 0 ? (
            <div className="pu-empty"><b>No payments yet</b><span>When you upgrade, every payment and its receipt appears here. Pay by card, bank transfer or USSD.</span></div>
          ) : (
            <div className="pu-rows">
              {history.map((h, i) => {
                const st = String(h.status || h.state || 'paid').toLowerCase();
                const ok = st === 'paid' || st === 'successful' || st === 'success';
                return (
                  <div key={h.id || h.reference || i} className="pu-row">
                    <span className="pu-tile-ic"><Ic n="checkCircle" s={18} /></span>
                    <span className="pu-row-main"><b>{h.description || h.plan || 'Subscription'}</b><small>{fmtDate(h.date || h.created_at || h.paid_at)}</small></span>
                    <b>{money(Number(h.amount) || 0, h.currency || cur)}</b>
                    <span className={'ch-chip ' + (ok ? 'live' : st === 'pending' ? 'ready' : 'hot')}>{ok ? 'Paid' : st === 'pending' ? 'Pending' : 'Failed'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="glass pu-box">
          <div className="pu-box-head"><h2>Payment method</h2></div>
          <div className="pay-card">
            <div className="pay-card-head"><span className="pay-chip" /><span className="pay-brand">{bill?.card_brand ? String(bill.card_brand).toUpperCase() : 'CARD'}</span></div>
            <div className="pay-num">{bill?.card_last4 ? `•••• •••• •••• ${bill.card_last4}` : 'No card on file yet'}</div>
            <div className="pay-foot"><span>{bizNameSafe(bill)}</span><span>{bill?.card_expiry || ''}</span></div>
          </div>
          <div className="pu-card-acts">
            <button type="button" className="btn" disabled={!!busy || cur === 'USD'} onClick={addCard}>{busy === 'card' ? (<><Loader size={15} />Opening</>) : bill?.card_last4 ? 'Change card' : 'Add a card'}</button>
          </div>
          <p className="pu-note">{cur === 'USD' ? 'Your card is saved when you pay for a plan.' : 'Paystack checks the card with ₦50 and refunds it straight away. We keep only the last 4 digits, never the full card.'}</p>
        </section>
      </div>

      {checkout && (
        <div className="ps-back" role="presentation" onClick={() => !busy && setCheckout(null)}>
          <div className="ps pu-sheet" role="dialog" aria-modal="true" aria-labelledby="pu-sheet-title" onClick={(e) => e.stopPropagation()}>
            <div className="ps-head"><h2 id="pu-sheet-title">Upgrade to {checkout.name}</h2><button className="ps-close" disabled={!!busy} onClick={() => setCheckout(null)} aria-label="Close"><Ic n="x" s={18} /></button></div>
            <div className="ps-body">
              <div className="pu-sum"><span>{checkout.name} · {period === 'monthly' ? 'Monthly' : 'Yearly'}</span><b>{checkout.price}</b></div>
              <p className="pu-label">How would you like to pay?</p>
              <div className="pu-methods" role="radiogroup" aria-label="Payment method">
                {(cur === 'USD' ? [['card', 'Card', 'Visa, Mastercard and more']] : [
                  ['card', bill?.card_last4 ? 'Card' : 'Card', bill?.card_last4 ? `Your ${String(bill.card_brand || 'card').toLowerCase()} ending ${bill.card_last4}, or a new card` : 'Visa, Mastercard or Verve'],
                  ['bank_transfer', 'Bank transfer', 'Paystack gives you an account number to send to'],
                  ['ussd', 'USSD', 'Dial a code from your bank on any phone'],
                ]).map(([k, n, d]) => (
                  <button key={k} type="button" role="radio" aria-checked={method === k} className={'pu-method' + (method === k ? ' on' : '')} onClick={() => setMethod(k)}>
                    <i aria-hidden="true" /><span><b>{n}</b><small>{d}</small></span>
                  </button>
                ))}
              </div>
              <p className="ch-safe"><Ic n="shield" s={18} />Secured by Paystack. Your plan turns on the moment the payment lands.</p>
            </div>
            <div className="ps-foot">
              <button className="btn lg ps-save" disabled={!!busy} onClick={() => pay(checkout.plan, cur === 'USD' ? undefined : method)}>{busy ? (<><Loader size={17} />Opening Paystack</>) : `Pay ${checkout.price}`}</button>
              <p className="ps-note is-center">Cancel any time. You keep your plan until the end of what you paid for.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// The card-face name line: the shop's own name if we have it, so the payment
// card looks like the owner's, not like a payment provider's.
function bizNameSafe(bill) {
  return (bill && (bill.business_name || bill.name)) || 'Your shop';
}
