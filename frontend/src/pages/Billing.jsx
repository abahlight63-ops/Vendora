// ── frontend/src/pages/Billing.jsx ─────────────────────────────────
// WHAT: subscriptions HQ — status banner (+ trial countdown), Free card +
// Pro/Pro Plus tier cards (monthly/yearly in the shop's currency), a Compare
// plans table (what each tier actually gets), Enterprise contact card.
// CARD ONLY: the checkout route is picked by LOCATION on the backend — brand
// names never appear in this UI (shoppers pay on a secure checkout page;
// logos live there, not here). Enterprise opens a form in a NEW TAB (never a
// mailto — owners fill + we reply; the address stays private).
// FLOWS: pay() → provider session → redirect. All money via money() helper
// (NGN ₦ / USD $). Backend is source of truth for prices (display fallbacks!).
import { useEffect, useState } from 'react'; // useState = bill/busy/period; useEffect = load on mount
import { api, fmtDate, pop } from '../lib/api.js'; // api() calls; fmtDate = expiry dates; pop() = big animated outcomes
import { money } from '../lib/money.js'; // money(n, 'NGN'|'USD') formatter
import Ic from '../components/icons.jsx'; // check icons

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
  '2 heavy work models (Kimi K2 + GPT-4o mini)',
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
  ['Bot replies per day', '50', '500', '1,000'],
  ['Profile sync + verified products', false, true, true],
  ['Product photos inside replies', false, true, true],
  ['Suggestive selling (up to 5 options)', false, true, true],
  ['ComeBack abandoned-buyer follow-ups', false, true, true],
  ['Insights: handled %, peak hours', false, true, true],
  ['Voice-note transcription', false, false, true],
  ['Heavy work models (Kimi K2 + GPT-4o mini)', false, false, true],
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
    yearly: { amount: 120000, save: 59988, save_pct: 33 }, // ₦120,000/yr (saves ₦59,988 ≈ 33%)
  },
  sales_email: 'vendorabot26@gmail.com',
  monthly: { naira: 7499, amount: 7499 }, // legacy aliases (old clients read these)
  yearly: { naira: 69999, amount: 69999, save_naira: 19989, save: 19989, save_pct: 22 },
};

export default function Billing() {
  const [bill, setBill] = useState(null); // null = loading (statusLine shows 'Loading…')
  const [busy, setBusy] = useState(''); // '' = idle; plan key = which button spins
  const [period, setPeriod] = useState('yearly'); // 'monthly' | 'yearly' — the billing-period toggle (yearly default: shows the savings!)

  async function load() { // reusable reload (mount only — card payments leave the page!)
    const { data } = await api('/api/me/billing'); // status, tier, currency, plans{pro,plus}, provider flags
    setBill(data);
  }
  useEffect(() => { load(); }, []); // [] = mount-only

  async function pay(plan) { // CARD FLOW: secure checkout session → redirect the whole page there
    const isUSD = (bill?.currency === 'USD'); // Dollar shops → international checkout, Naira shops → local checkout (location does the routing, silently!)
    const endpoint = isUSD ? '/api/billing/flutterwave/initialize' : '/api/billing/initialize'; // backend route differs; the SHOPPER never sees brand names
    setBusy(plan); // lock buttons (busy string = this plan's button shows 'Starting…')
    const { ok, data } = await api(endpoint, { method: 'POST', body: JSON.stringify({ plan }) }); // send ONLY the plan key (amount enforced server-side!)
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

  const freeCard = () => { // FREE tier card (₦0/$0 — no checkout exists; cancelling = just stop paying!)
    const label = status === 'active' ? 'Paid plan active — free is your fallback'
      : status === 'trialing' ? 'Free waits for you after the trial'
      : 'Current plan'; // expired/never-paid → free IS the plan (bot keeps replying!)
    return (
      <div className="plan">
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
    return (
      <div className={'plan' + (isHot ? ' hot' : '')}> {/* .hot = highlighted border + badge (CSS) */}
        {badge && <span className="plan-badge">{badge}</span>}
        <h2>{tierKey === 'plus' ? 'Pro Plus' : 'Pro'}</h2>
        <p className="desc">{tierKey === 'plus' ? 'Voice notes, heavy work models, full speed.' : 'The full AI salesperson for your shop.'}</p>
        <div className="plan-price">{amt(price)}<small>/{period === 'monthly' ? 'month' : 'year'}</small></div>
        {period === 'yearly' && price?.save_pct != null && ( // save pill ONLY on yearly (monthly has nothing to save vs itself!)
          <span className="plan-save">Save {money(price.save, cur)} — {price.save_pct}% off monthly</span> // server-computed save + pct (NGN 22%/33%, USD mirrors!)
        )}
        <ul className="plan-feats">{feats.map((f) => (<li key={f}><Ic n="checkCircle" s={15} /><span>{f}</span></li>))}</ul>
        <button className={'btn' + (isHot ? '' : ' ghost')} disabled={!!busy} onClick={() => pay(planKey)}>{busy === planKey ? 'Starting…' : status === 'active' ? `Extend ${tierKey === 'plus' ? 'Pro Plus' : 'Pro'} ${period}` : `${amt(price)}/${period === 'monthly' ? 'month' : 'year'} — ${tierKey === 'plus' ? 'Pro Plus' : 'Pro'}`}</button>
      </div>
    );
  };

  return (
    <>
      <div className="page-head"><div><h1>Billing</h1><p>Free forever, Pro, Pro Plus — or Enterprise. Cancel anytime, your catalog stays yours.</p></div></div>

      <div className="card"> {/* subscription status banner (+ live trial countdown!) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}> {/* inline flex (title left, pills right, wraps on phones) */}
          <div><h2>Your subscription</h2><p className="desc" style={{ margin: 0 }}>{statusLine}</p></div>
          <span style={{ display: 'inline-flex', gap: 6 }}> {/* pill cluster: currency + tier + status */}
            <span className="pill info">{cur === 'USD' ? 'USD $' : 'NGN ₦'}</span> {/* currency badge (ternary text) */}
            {bill?.tier && <span className={'pill ' + (bill.tier === 'pro' ? 'ok' : 'info')}>{bill.tier === 'pro' ? 'PRO' : 'FREE'}</span>} {/* && conditional: tier pill only when loaded */}
            <span className={'pill ' + pill}>{status}</span> {/* status pill (color var above) */}
          </span>
        </div>
        {status === 'trialing' && trialLeft != null && trialLeft > 0 && ( // countdown strip (only while trialing — disappears after!)
          <div className="trial-strip" style={{ marginTop: 12, marginBottom: 0 }}><Ic n="clock" s={16} /><span><b>{trialLeft} day{trialLeft === 1 ? '' : 's'} of Pro trial left.</b> Keep Pro sync, photos + premium AIs — or stay free forever with manual catalog.</span></div>
        )}
      </div>

      <div className="card"> {/* Free-vs-Pro explainer (kills "what do I get?" doubts) */}
        <h2>Free vs Pro vs Pro Plus</h2>
        <div className="grid2" style={{ marginTop: 10, fontSize: 14 }}>
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Free forever:</b> bot replies from products you add or teach with LEARN:</span></div>
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Pro:</b> auto-syncs + verifies products, sends product photos in replies</span></div>
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Pro Plus:</b> everything in Pro + voice-note transcription + 2 heavy work models</span></div>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>Your 7 days are a full Pro trial — after that, manual catalog keeps working free.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}> {/* billing-period toggle */}
        <b style={{ marginRight: 4 }}>Billing period:</b>
        <button className={'btn sm' + (period === 'monthly' ? '' : ' ghost')} disabled={!!busy} onClick={() => setPeriod('monthly')}>Monthly</button>
        <button className={'btn sm' + (period === 'yearly' ? '' : ' ghost')} disabled={!!busy} onClick={() => setPeriod('yearly')}>Yearly</button>
        <span className="hint">Yearly saves {pro.yearly?.save_pct ?? 22}% on Pro, {plus.yearly?.save_pct ?? 33}% on Pro Plus.</span>
      </div>

      <div className="plan-grid"> {/* 3 tier cards (CSS grid → stack on mobile) */}
        {freeCard()}
        {tierCard('pro', pro, false, null)}
        {tierCard('plus', plus, true, 'MOST POWER')}
      </div>

      <div className="card" style={{ marginTop: 14 }}> {/* Compare plans: what each tier actually gets (kills "what am I paying for?" doubts) */}
        <h2>Compare plans</h2>
        <p className="desc">Every tier keeps the bot replying — paid tiers add automation, volume and premium brains.</p>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>What you get</th><th>Free</th><th>Pro</th><th>Pro Plus</th></tr></thead>
            <tbody>
              {COMPARE_ROWS.map(([label, free, proV, plusV]) => (
                <tr key={label}><td><b>{label}</b></td><td>{compareCell(free)}</td><td>{compareCell(proV)}</td><td>{compareCell(plusV)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}> {/* Enterprise: NO self-serve checkout — a sales conversation via form (new tab!) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div><h2>Enterprise</h2><p className="desc" style={{ margin: 0 }}>For chains, franchises and high-volume shops. Everything in Pro Plus, plus:</p></div>
          <span className="plan-badge" style={{ background: 'linear-gradient(135deg,#b54708,#7a2e0e)' }}>CONTACT SALES</span>
        </div>
        <ul className="plan-feats" style={{ marginTop: 12 }}>{[
          'Multiple branches, one dashboard — each shop keeps its own catalog and inbox',
          'Dedicated onboarding call — we connect your numbers and train your team',
          'Priority support with a real human, same-day response',
          'Custom integrations and reports built for how you work',
          'Annual invoicing with receipts included',
        ].map((f) => (<li key={f}><Ic n="checkCircle" s={15} /><span>{f}</span></li>))}</ul>
        <div style={{ marginTop: 12 }}>
          <a className="btn" href="/contact-sales" target="_blank" rel="noreferrer">Contact sales</a> {/* new tab form (no email shown — enquiry lands as a ticket we reply to!) */}
        </div>
      </div>

      <p className="hint" style={{ marginTop: 12 }}>Secure card checkout — {cur === 'USD' ? 'international cards welcome' : 'all Nigerian cards + bank channels'}. Activation is instant.</p>
    </>
  );
}
