// ── frontend/src/pages/Billing.jsx ─────────────────────────────────
// WHAT: subscriptions HQ — status banner, Free-vs-Pro explainer, tier cards
// (Pro + Pro Plus, monthly/yearly in the shop's currency), pay-once contact
// card, bank-transfer block.
// FLOWS: pay() → backend → Paystack URL → redirect. sentTransfer() → pending.
// sales() → mailto (pay-once handled personally). All money via money()
// helper (NGN ₦ / USD $). Backend is source of truth for prices (never
// hardcoded amounts for charging — display fallbacks only!).
import { useEffect, useState } from 'react'; // useState = bill/busy/period/transfer; useEffect = load on mount
import { api, fmtDate, pop, toast } from '../lib/api.js'; // api() calls; fmtDate = expiry dates; pop() = big animated outcomes
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

const TRANSFER_KEYS = ['pro_monthly', 'pro_yearly', 'plus_monthly', 'plus_yearly']; // bank-transfer covers all 4 (pay-once goes via sales email, not transfer!)

export default function Billing() {
  const [bill, setBill] = useState(null); // null = loading (statusLine shows 'Loading…')
  const [busy, setBusy] = useState(''); // '' = idle; plan key or 'transfer' = which button spins
  const [period, setPeriod] = useState('yearly'); // 'monthly' | 'yearly' — the billing-period toggle (yearly default: shows the savings!)
  const [transferDone, setTransferDone] = useState(false); // transfer reported → confirmation state
  const [tPlan, setTPlan] = useState('pro_monthly'); // which plan the transfer is FOR
  const [tForm, setTForm] = useState({ sender_name: '', sender_bank: '', reference: '', amount_paid: '' });
  const setT = (k) => (e) => setTForm({ ...tForm, [k]: e.target.value });

  async function load() { // reusable reload (mount + after transfer report)…
    const { data } = await api('/api/me/billing'); // status, tier, currency, plans{pro,plus}, transfer, paystack_live
    setBill(data);
    if (data?.status === 'pending') setTransferDone(true); // ?. guards failed fetch; pending from earlier visit → keep confirmation showing
  }
  useEffect(() => { load(); }, []); // [] = mount-only

  async function pay(plan) { // CARD FLOW: backend creates Paystack session → we redirect the whole page there
    setBusy(plan); // lock buttons (busy string = this plan's button shows 'Starting…')
    const { ok, data } = await api('/api/billing/initialize', { method: 'POST', body: JSON.stringify({ plan }) }); // send ONLY the plan key (amount enforced server-side!)
    setBusy(''); // unlock (ALWAYS — success navigates away anyway, failure must unlock!)
    if (ok && data.authorization_url) { // session created → Paystack URL received…
      pop('ok', 'Opening secure checkout…', 'Complete your payment with Paystack to activate instantly.'); // success popup FIRST (user sees confirmation)…
      setTimeout(() => { location.href = data.authorization_url; }, 1200); // …then leave for Paystack after 1.2s (location.href = full-page navigation, exits the SPA!)
    } else { // backend refused (no keys, unknown plan, no email…)…
      pop('err', 'Payment failed to start', data.error || 'Could not start payment. Try bank transfer below.'); // …error popup WITH fallback direction (never dead-end the user!)
    }
  }

  async function sentTransfer() { // VERIFIED TRANSFER: details required, exact amount enforced server-side
    if (busy) return;
    if (!tForm.sender_name.trim() || !tForm.sender_bank.trim() || !tForm.reference.trim() || !tForm.amount_paid) {
      pop('err', 'Details missing', 'Enter the account name, bank, reference and exact amount you sent.');
      return;
    }
    setBusy('transfer');
    const { ok, data } = await api('/api/billing/transfer', {
      method: 'POST',
      body: JSON.stringify({ plan: tPlan, sender_name: tForm.sender_name.trim(), sender_bank: tForm.sender_bank.trim(), reference: tForm.reference.trim(), amount_paid: Number(String(tForm.amount_paid).replace(/[^0-9.]/g, '')) }),
    });
    setBusy('');
    if (ok) {
      setTransferDone(true);
      pop('ok', 'Transfer reported for verification', data.message || 'We match every claim against the bank statement before activating — usually within a few hours.');
      load();
    } else {
      pop('err', 'Could not record transfer', data.error || 'Please check the details and try again.');
    }
  }

  function copyText(s) {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(s);
      else { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      toast('Copied: ' + s);
    } catch { toast('Copy failed — long-press to copy', 'err'); }
  }

  const status = bill?.status || '…'; // ?. + || : loading → '…' placeholder (never crash on null bill)
  const pill = status === 'active' ? 'ok' : status === 'trialing' ? 'flag' : status === 'pending' ? 'info' : 'off'; // chained ternary: status → pill color
  const cur = bill?.currency === 'USD' ? 'USD' : 'NGN'; // whitelist to two currencies (default NGN while loading)
  const plans = bill?.plans || FALLBACK_PLANS; // backend prices or display defaults
  const pro = plans.pro || FALLBACK_PLANS.pro; // nested tier (backend shape); || fallback guards old cached responses
  const plus = plans.plus || FALLBACK_PLANS.plus;
  const salesEmail = bill?.sales_email || plans.sales_email || FALLBACK_PLANS.sales_email; // top-level first, then nested, then fallback
  const amt = (p) => money(p?.amount ?? 0, cur); // helper: canonical amount → formatted (?. + ?? = bulletproof against EITHER shape!)
  const planAmt = (key) => { // transfer-form resolver: 'pro_monthly' → plans.pro.monthly (legacy 'monthly' → Pro monthly!)
    if (key === 'plus_monthly') return plus.monthly;
    if (key === 'plus_yearly') return plus.yearly;
    if (key === 'pro_yearly' || key === 'yearly') return pro.yearly;
    return pro.monthly; // pro_monthly | monthly | anything-else → Pro monthly (safe default)
  };
  const planLabel = (key) => ({ pro_monthly: 'Pro Monthly', pro_yearly: 'Pro Yearly', plus_monthly: 'Pro Plus Monthly', plus_yearly: 'Pro Plus Yearly' }[key] || key); // human labels for the transfer dropdown
  const t = bill?.transfer || {}; // bank details ({} default → transferReady false while loading)
  const transferReady = t.bank && t.account_number; // && returns last truthy/falsy (both set = show block; else hide ENTIRELY — no dev-talk!)

  const statusLine = !bill ? 'Loading…' // 4-way status message (reads like a human wrote each one):
    : status === 'active' ? `Pro active until ${fmtDate(bill.expires)}. Profile sync, photos + priority support on.` // backticks interpolate the date
    : status === 'trialing' ? `Pro trial ends ${fmtDate(bill.trial_ends)}. Pick Pro or Pro Plus to keep it — manual catalog stays free forever.`
    : status === 'pending' ? 'Transfer received — activation in progress. We confirm within a few hours.'
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
        <button className={'btn' + (isHot ? '' : ' ghost')} disabled={!!busy} onClick={() => pay(planKey)}>{busy === planKey ? 'Starting…' : status === 'active' ? `Extend ${tierKey === 'plus' ? 'Pro Plus' : 'Pro'} ${period}` : `Choose ${tierKey === 'plus' ? 'Pro Plus' : 'Pro'} ${period}`}</button>
      </div>
    );
  };

  return (
    <>
      <div className="page-head"><div><h1>Billing</h1><p>Two tiers, two periods. Cancel anytime — your catalog stays yours.</p></div></div>

      <div className="card"> {/* subscription status banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}> {/* inline flex (title left, pills right, wraps on phones) */}
          <div><h2>Your subscription</h2><p className="desc" style={{ margin: 0 }}>{statusLine}</p></div>
          <span style={{ display: 'inline-flex', gap: 6 }}> {/* pill cluster: currency + tier + status */}
            <span className="pill info">{cur === 'USD' ? 'USD $' : 'NGN ₦'}</span> {/* currency badge (ternary text) */}
            {bill?.tier && <span className={'pill ' + (bill.tier === 'pro' ? 'ok' : 'info')}>{bill.tier === 'pro' ? 'PRO' : 'FREE'}</span>} {/* && conditional: tier pill only when loaded */}
            <span className={'pill ' + pill}>{status}</span> {/* status pill (color var above) */}
          </span>
        </div>
      </div>

      <div className="card"> {/* Free-vs-Pro explainer (kills "what do I get?" doubts) */}
        <h2>Free vs Pro vs Pro Plus</h2>
        <div className="grid2" style={{ marginTop: 10, fontSize: 14 }}>
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Free forever:</b> bot replies from products you add or teach with LEARN:</span></div>
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Pro:</b> auto-syncs + verifies products, sends product photos in replies</span></div>
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Pro Plus:</b> everything in Pro + voice-note transcription + 2 heavy work models</span></div>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>Your 14 days are a full Pro trial — after that, manual catalog keeps working free.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}> {/* billing-period toggle */}
        <b style={{ marginRight: 4 }}>Billing period:</b>
        <button className={'btn sm' + (period === 'monthly' ? '' : ' ghost')} disabled={!!busy} onClick={() => setPeriod('monthly')}>Monthly</button>
        <button className={'btn sm' + (period === 'yearly' ? '' : ' ghost')} disabled={!!busy} onClick={() => setPeriod('yearly')}>Yearly</button>
        <span className="hint">Yearly saves {pro.yearly?.save_pct ?? 22}% on Pro, {plus.yearly?.save_pct ?? 33}% on Pro Plus.</span>
      </div>

      <div className="plan-grid"> {/* 2 tier cards (CSS grid → stack on mobile) */}
        {tierCard('pro', pro, false, null)}
        {tierCard('plus', plus, true, 'MOST POWER')}
      </div>

      <div className="card" style={{ marginTop: 14 }}> {/* pay-once: NO self-serve checkout — personal sales call */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div><h2>Pay once, own it</h2><p className="desc" style={{ margin: 0 }}>One payment, lifetime access. Handled personally — write us and we set you up.</p></div>
          <span className="plan-badge" style={{ background: 'linear-gradient(135deg,#b54708,#7a2e0e)' }}>CONTACT SALES</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <a className="btn ghost" href={`mailto:${salesEmail}?subject=${encodeURIComponent('Vendora pay-once plan')}`}>Contact sales — {salesEmail}</a>
        </div>
      </div>

      {transferReady && cur === 'NGN' && (
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Pay by bank transfer</h2>
        <p className="desc">Send the <b>exact</b> plan amount to the account below, then fill the verification form. We match every claim against the bank statement before activating — usually within a few hours. False or mismatched claims are rejected.</p>
        <div className="learn-box light" style={{ fontFamily: 'var(--font)' }}>
          <div><b>Bank:</b> {t.bank}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span><b>Account number:</b> {t.account_number}</span><button type="button" className="btn ghost sm" onClick={() => copyText(t.account_number)}>Copy</button></div>
          <div><b>Account name:</b> {t.account_name}</div>
          <div style={{ marginTop: 8 }}><b>Amount to send ({planLabel(tPlan)}):</b> {amt(planAmt(tPlan))} — send exactly this, no more, no less.</div>
        </div>
        {transferDone ? (
          <p className="hint ok-line"><Ic n="checkCircle" s={15} /> Transfer reported — verification in progress. Keep your receipt until we activate you.</p>
        ) : (
          <div className="tform">
            <div className="grid2">
              <div>
                <label>Plan you paid for</label>
                <select value={tPlan} onChange={(e) => setTPlan(e.target.value)}>
                  {TRANSFER_KEYS.map((k) => (<option key={k} value={k}>{planLabel(k)} — {amt(planAmt(k))}</option>))}
                </select>
              </div>
              <div>
                <label>Exact amount you sent (₦)</label>
                <input value={tForm.amount_paid} onChange={setT('amount_paid')} inputMode="numeric" placeholder={String(planAmt(tPlan)?.amount ?? '')} />
              </div>
            </div>
            <div className="grid2">
              <div>
                <label>Account name you paid FROM</label>
                <input value={tForm.sender_name} onChange={setT('sender_name')} placeholder="e.g. Adaeze Okafor" autoComplete="name" />
              </div>
              <div>
                <label>Bank you paid FROM</label>
                <input value={tForm.sender_bank} onChange={setT('sender_bank')} placeholder="e.g. GTBank" />
              </div>
            </div>
            <label>Transfer reference / teller number</label>
            <input value={tForm.reference} onChange={setT('reference')} placeholder="On your receipt — min 6 characters" spellCheck="false" />
            <p className="hint" style={{ marginTop: 8 }}>🔒 Verification: we check sender name + bank + reference + exact amount in our statement. One pending claim at a time — duplicates with the same reference are blocked automatically.</p>
            <button className="btn" disabled={!!busy} onClick={sentTransfer} style={{ marginTop: 10, width: '100%' }}>{busy === 'transfer' ? 'Verifying…' : `I sent ${amt(planAmt(tPlan))} — verify my transfer`}</button>
          </div>
        )}
      </div>
      )}
      {cur === 'USD' && (
        <p className="hint" style={{ marginTop: 12 }}>Paying in dollars — card checkout above (Paystack, international cards welcome). Bank transfer is Naira-only for now. Pay-once in USD? Write {salesEmail}.</p>
      )}
    </>
  );
}
