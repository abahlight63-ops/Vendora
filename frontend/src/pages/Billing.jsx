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
  const [busy, setBusy] = useState(''); // '' = idle; 'monthly'|'yearly'|'lifetime'|'transfer-x' = which button spins (string state = WHICH loader, not just boolean!)
  const [transferDone, setTransferDone] = useState(false); // transfer reported → swap buttons for confirmation text

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

  async function sentTransfer(plan) { // TRANSFER FLOW: "I sent the money" → pending (human verifies later)
    setBusy('transfer-' + plan); // string concat makes unique busy keys per plan button
    const { ok, data } = await api('/api/billing/transfer', { method: 'POST', body: JSON.stringify({ plan }) });
    setBusy(''); // unlock either way
    if (ok) {
      setTransferDone(true); // swap button row → confirmation line (persists via status='pending' on reload too)
      pop('ok', 'Transfer recorded!', 'We will confirm and activate your plan within a few hours. Your catalog stays safe.');
      load(); // reload: status flips to pending (banner + pill update)
    } else {
      pop('err', 'Could not record transfer', data.error || 'Please try again.');
    }
  }

  const status = bill?.status || '…'; // ?. + || : loading → '…' placeholder (never crash on null bill)
  const pill = status === 'active' ? 'ok' : status === 'trialing' ? 'flag' : status === 'pending' ? 'info' : 'off'; // chained ternary: status → pill color (green/gold/blue/red)
  const cur = bill?.currency === 'USD' ? 'USD' : 'NGN'; // whitelist to two currencies (default NGN while loading)
  const plans = bill?.plans || FALLBACK_PLANS; // backend prices or display defaults
  const amt = (p) => money(p?.amount ?? p?.naira, cur); // helper: prefer canonical amount, fall back to legacy naira key (?. + ?? = bulletproof against EITHER shape!)
  const saveAmt = plans.yearly.save ?? plans.yearly.save_naira; // same dual-shape guard for savings
  const t = bill?.transfer || {}; // bank details ({} default → transferReady false while loading)
  const transferReady = t.bank && t.account_number; // && returns last truthy/falsy (both set = show block; else hide ENTIRELY — no dev-talk!)
  const cardsLive = bill?.paystack_live; // real Paystack key on server? (drives the "coming soon" hint)

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

      {transferReady && cur === 'NGN' && ( // transfer block: ONLY when bank details set AND Naira (USD = card-only; && chain hides otherwise — zero dev-talk!)
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Pay by bank transfer</h2>
        <p className="desc">Send the exact plan amount, then tap "I have sent the money". We confirm and activate within a few hours.</p>
        <div className="learn-box light" style={{ fontFamily: 'var(--font)' }}> {/* reuses learn-box styling (mono dark box, .light variant) for account details */}
          <div><b>Bank:</b> {t.bank}</div>
          <div><b>Account number:</b> {t.account_number}</div>
          <div><b>Account name:</b> {t.account_name}</div>
        </div>
        {transferDone ? ( // reported? → confirmation line (no double-reporting!)…
          <p className="hint ok-line"><Ic n="checkCircle" s={15} /> Transfer recorded — activation in progress.</p>
        ) : ( // …else one button per plan (label shows exact amount = user sends the RIGHT sum!) —
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {['monthly', 'yearly', 'lifetime'].map((p) => ( // map plan KEYS (strings!) → buttons…
              <button key={p} className="btn ghost sm" disabled={!!busy} onClick={() => sentTransfer(p)}> {/* …passing the key (not amount!) — server prices it */}
                {busy === 'transfer-' + p ? 'Recording…' : `I sent ${amt(plans[p])} (${p})`} {/* plans[p] = dynamic lookup by key (bracket notation!) */}
              </button>
            ))}
          </div>
        )}
      </div>
      )}
      {cur === 'USD' && ( // USD note (transfer is Naira-only — say so plainly, no dev-talk)
        <p className="hint" style={{ marginTop: 12 }}>Paying in dollars — card checkout above. Bank transfer is Naira-only for now.</p>
      )}
      {!cardsLive && transferReady && cur === 'NGN' && <p className="hint" style={{ marginTop: 4 }}>Prefer card? Card payments are coming soon — transfer works right now.</p>} {/* triple-&& : only when cards off AND transfer on AND NGN (customer voice, never "owner hasn't set keys"!) */}
    </>
  );
}
