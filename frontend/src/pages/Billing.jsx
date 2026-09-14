// ── frontend/src/pages/Billing.jsx ─────────────────────────────────
// WHAT: subscriptions HQ — status banner, Free-vs-Pro explainer, 3 plan cards
// (Monthly/Yearly/Lifetime in the shop's currency), bank-transfer block.
// FLOWS: pay() → backend → Paystack URL → redirect. sentTransfer() → pending.
// All money via money() helper (NGN ₦ / USD $). Backend is source of truth for
// prices (never hardcoded amounts for charging — display fallbacks only!).
import { useEffect, useState } from 'react'; // useState = bill/busy/transferDone; useEffect = load on mount
import { api, fmtDate, pop, toast } from '../lib/api.js'; // api() calls; fmtDate = expiry dates; pop() = big animated outcomes (toast imported for future minor notes)
import { money } from '../lib/money.js'; // money(n, 'NGN'|'USD') formatter
import Ic from '../components/icons.jsx'; // check icons

const CORE_FEATS = [ // shared feature list (same for all plans — ONE plan, three prices!)
  'Unlimited AI replies, Pidgin + English',
  'Instant owner alerts for hot orders',
  'Full inbox + chat history',
  'ComeBack follow-ups for abandoned buyers',
  'Catalog LEARN mode from WhatsApp',
  'Insights: handled %, peak hours',
];

const FALLBACK_PLANS = { // display defaults while /api/me/billing loads (MUST match server defaults! backend remains the real truth)
  currency: 'NGN',
  monthly: { naira: 7500, amount: 7500 }, // naira keys = legacy compat; amount = canonical (backend sends both)
  yearly: { naira: 50000, amount: 50000, save_naira: 40000, save: 40000, save_pct: 44 },
  lifetime: { naira: 100000, amount: 100000 },
};

export default function Billing() {
  const [bill, setBill] = useState(null); // null = loading (statusLine shows 'Loading…')
  const [busy, setBusy] = useState(''); // '' = idle; plan key or 'transfer' = which button spins
  const [transferDone, setTransferDone] = useState(false); // transfer reported → confirmation state
  const [tPlan, setTPlan] = useState('monthly'); // which plan the transfer is FOR
  const [tForm, setTForm] = useState({ sender_name: '', sender_bank: '', reference: '', amount_paid: '' });
  const setT = (k) => (e) => setTForm({ ...tForm, [k]: e.target.value });

  async function load() { // reusable reload (mount + after transfer report)…
    const { data } = await api('/api/me/billing'); // status, tier, currency, plans, transfer, paystack_live
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
  const pill = status === 'active' ? 'ok' : status === 'trialing' ? 'flag' : status === 'pending' ? 'info' : 'off'; // chained ternary: status → pill color (green/gold/blue/red)
  const cur = bill?.currency === 'USD' ? 'USD' : 'NGN'; // whitelist to two currencies (default NGN while loading)
  const plans = bill?.plans || FALLBACK_PLANS; // backend prices or display defaults
  const amt = (p) => money(p?.amount ?? p?.naira, cur); // helper: prefer canonical amount, fall back to legacy naira key (?. + ?? = bulletproof against EITHER shape!)
  const saveAmt = plans.yearly.save ?? plans.yearly.save_naira; // same dual-shape guard for savings
  const t = bill?.transfer || {}; // bank details ({} default → transferReady false while loading)
  const transferReady = t.bank && t.account_number; // && returns last truthy/falsy (both set = show block; else hide ENTIRELY — no dev-talk!)

  const statusLine = !bill ? 'Loading…' // 4-way status message (reads like a human wrote each one):
    : status === 'active' ? `Pro active until ${fmtDate(bill.expires)}. Profile sync + priority support on.` // backticks interpolate the date
    : status === 'trialing' ? `Pro trial ends ${fmtDate(bill.trial_ends)}. Pick a plan to keep Pro — manual catalog stays free forever.`
    : status === 'pending' ? 'Transfer received — activation in progress. We confirm within a few hours.'
    : 'Free plan — your bot keeps replying from your manual catalog. Upgrade to Pro for profile sync.'; // expired/anything-else → free reassurance (bot NEVER pauses!)

  return (
    <>
      <div className="page-head"><div><h1>Billing</h1><p>One plan, every feature. Cancel anytime — your catalog stays yours.</p></div></div>

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
        <h2>Free vs Pro</h2>
        <div className="grid2" style={{ marginTop: 10, fontSize: 14 }}>
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Free forever:</b> bot replies from products you add or teach with LEARN:</span></div> {/* .tick = icon+text row (CSS flex) */}
          <div className="tick"><Ic n="checkCircle" s={16} /><span><b>Pro:</b> auto-syncs + verifies products against your WhatsApp Business profile</span></div>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>Your 14 days are a full Pro trial — after that, manual catalog keeps working free.</p>
      </div>

      <div className="plan-grid"> {/* 3 pricing cards (CSS grid → stack on mobile) */}
        <div className="plan"> {/* Monthly: ghost button (secondary visual weight) */}
          <h2>Monthly</h2>
          <p className="desc">Flexibility — pay as you grow.</p>
          <div className="plan-price">{amt(plans.monthly)}<small>/month</small></div> {/* <small> = per-period suffix (CSS styles it muted) */}
          <ul className="plan-feats">{CORE_FEATS.map((f) => (<li key={f}><Ic n="checkCircle" s={15} /><span>{f}</span></li>))}</ul> {/* map shared feats → checkmark rows (key={f} = unique strings, stable!) */}
          <button className="btn ghost" disabled={!!busy} onClick={() => pay('monthly')}>{busy === 'monthly' ? 'Starting…' : status === 'active' ? 'Extend monthly' : 'Choose monthly'}</button> {/* disabled={!!busy} = ANY in-flight payment locks ALL buttons (double-pay protection!); label flips by busy-plan AND status */}
        </div>

        <div className="plan hot"> {/* Yearly: .hot = highlighted border + MOST POPULAR badge (CSS) */}
          <span className="plan-badge">MOST POPULAR</span>
          <h2>Yearly</h2>
          <p className="desc">One payment, twelve months of selling.</p>
          <div className="plan-price">{amt(plans.yearly)}<small>/year</small></div>
          <span className="plan-save">Save {money(saveAmt, cur)} — {plans.yearly.save_pct}% off monthly</span> {/* savings pill (server-computed save + pct!) */}
          <ul className="plan-feats">{CORE_FEATS.map((f) => (<li key={f}><Ic n="checkCircle" s={15} /><span>{f}</span></li>))}<li><Ic n="checkCircle" s={15} /><span><b>Priority support</b> — jump the queue</span></li></ul> {/* extra Pro-only perk row appended */}
          <button className="btn" disabled={!!busy} onClick={() => pay('yearly')}>{busy === 'yearly' ? 'Starting…' : status === 'active' ? 'Switch to yearly' : 'Choose yearly'}</button> {/* solid btn = primary action (draws the eye) */}
        </div>

        <div className="plan"> {/* Lifetime: dynamic payback math (no hardcoded "14 months"!) */}
          <span className="plan-badge" style={{ background: 'linear-gradient(135deg,#b54708,#7a2e0e)' }}>BEST VALUE</span> {/* inline gradient overrides badge color */}
          <h2>Lifetime</h2>
          <p className="desc">Pay once, sell forever.</p>
          <div className="plan-price">{amt(plans.lifetime)}<small> one-time</small></div>
          <span className="plan-save">Pays for itself in ~{Math.max(1, Math.round(plans.lifetime.amount / plans.monthly.amount))} months vs monthly</span> {/* lifetime ÷ monthly = breakeven (Math.round; max(1) guards weird prices) */}
          <ul className="plan-feats">{CORE_FEATS.map((f) => (<li key={f}><Ic n="checkCircle" s={15} /><span>{f}</span></li>))}<li><Ic n="checkCircle" s={15} /><span><b>Priority support + locked price</b> forever</span></li></ul>
          <button className="btn ghost" disabled={!!busy} onClick={() => pay('lifetime')}>{busy === 'lifetime' ? 'Starting…' : `Pay once — ${amt(plans.lifetime)}`}</button> {/* backticks interpolate the formatted price into the label */}
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
          <div style={{ marginTop: 8 }}><b>Amount to send ({tPlan}):</b> {amt(plans[tPlan])} — send exactly this, no more, no less.</div>
        </div>
        {transferDone ? (
          <p className="hint ok-line"><Ic n="checkCircle" s={15} /> Transfer reported — verification in progress. Keep your receipt until we activate you.</p>
        ) : (
          <div className="tform">
            <div className="grid2">
              <div>
                <label>Plan you paid for</label>
                <select value={tPlan} onChange={(e) => setTPlan(e.target.value)}>
                  <option value="monthly">Monthly — {amt(plans.monthly)}</option>
                  <option value="yearly">Yearly — {amt(plans.yearly)}</option>
                  <option value="lifetime">Lifetime — {amt(plans.lifetime)}</option>
                </select>
              </div>
              <div>
                <label>Exact amount you sent (₦)</label>
                <input value={tForm.amount_paid} onChange={setT('amount_paid')} inputMode="numeric" placeholder={String(plans[tPlan]?.amount ?? '')} />
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
            <button className="btn" disabled={!!busy} onClick={sentTransfer} style={{ marginTop: 10, width: '100%' }}>{busy === 'transfer' ? 'Verifying…' : `I sent ${amt(plans[tPlan])} — verify my transfer`}</button>
          </div>
        )}
      </div>
      )}
      {cur === 'USD' && (
        <p className="hint" style={{ marginTop: 12 }}>Paying in dollars — card checkout above. Bank transfer is Naira-only for now.</p>
      )}
    </>
  );
}
