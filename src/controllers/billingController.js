// ── src/controllers/billingController.js ───────────────────────────
// WHAT: money in. PLANS (dual-currency price table) + initialize (Paystack
// card checkout, NGN) + flutterwaveInit (Flutterwave checkout, USD/intl) +
// webhooks (verify signature → activate subscription). Amounts live
// SERVER-side: the browser only sends plan keys (never amounts — clients lie).
// Bank transfer is RETIRED (reportTransfer answers 410 — ledger history kept!).
// MODULES: crypto (Node built-in HMAC), ../db (pool). Providers via fetch.
const crypto = require('crypto'); // Node built-in: HMAC-SHA512 webhook verification
const db = require('../db'); // shared pool

// Pay-once plans are handled personally — no self-serve lifetime checkout.
const SALES_EMAIL = process.env.SALES_EMAIL || 'vendorabot26@gmail.com';

// Plans: amounts are server-side — the client only sends the plan key.
// Two tiers × two periods. Dual currency: NGN for +234 businesses, USD for
// the world (USD yearly picked to mirror the NGN discount %: Pro 22%, Plus 33%).
const PLANS = {
  pro_monthly: { NGN: Number(process.env.PRICE_MONTHLY_NAIRA || 7499), USD: Number(process.env.PRICE_MONTHLY_USD || 5), days: 30, label: 'Pro Monthly', tier: 'pro' }, // Number() because env vars are strings; || defaults
  pro_yearly: { NGN: Number(process.env.PRICE_YEARLY_NAIRA || 69999), USD: Number(process.env.PRICE_YEARLY_USD || 47), days: 365, label: 'Pro Yearly', tier: 'pro' }, // 7499×12−69999 = ₦19,989 saved ≈ 22%
  plus_monthly: { NGN: Number(process.env.PRICE_PLUS_MONTHLY_NAIRA || 14999), USD: Number(process.env.PRICE_PLUS_MONTHLY_USD || 10), days: 30, label: 'Pro Plus Monthly', tier: 'plus' },
  plus_yearly: { NGN: Number(process.env.PRICE_PLUS_YEARLY_NAIRA || 120000), USD: Number(process.env.PRICE_PLUS_YEARLY_USD || 80), days: 365, label: 'Pro Plus Yearly', tier: 'plus' }, // 14999×12−120000 = ₦59,988 saved ≈ 33%
};
// Legacy keys (old apps/clients send monthly/yearly) → Pro tier.
PLANS.monthly = PLANS.pro_monthly;
PLANS.yearly = PLANS.pro_yearly;

// Shape PLANS for ONE currency (what getBilling sends the frontend).
function planFor(currency) {
  const cur = currency === 'USD' ? 'USD' : 'NGN'; // whitelist: anything non-USD becomes NGN (injection-safe)
  const shape = (p) => ({ amount: p[cur], currency: cur, days: p.days, label: p.label, tier: p.tier }); // amount = price in THIS currency
  const pro = { monthly: shape(PLANS.pro_monthly), yearly: shape(PLANS.pro_yearly) };
  const plus = { monthly: shape(PLANS.plus_monthly), yearly: shape(PLANS.plus_yearly) };
  for (const t of [pro, plus]) { // per-tier yearly savings (monthly×12 − yearly)…
    t.yearly.save = t.monthly.amount * 12 - t.yearly.amount; // e.g. Pro NGN: 7499×12−69999 = ₦19,989
    t.yearly.save_pct = Math.round((t.yearly.save / (t.monthly.amount * 12)) * 100); // …as a % (Pro ≈ 22%, Plus ≈ 33%)
  }
  return {
    currency: cur,
    pro, // { monthly, yearly{+save, save_pct} }
    plus, // { monthly, yearly{+save, save_pct} }
    sales_email: SALES_EMAIL, // pay-once / enterprise → contact sales
    monthly: pro.monthly, yearly: pro.yearly, // legacy aliases (old mobile builds read these — never break them!)
  };
}
async function initialize(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY; // server-only secret (never reaches the browser)
  if (!secret || secret.includes('xxxxx')) return res.status(503).json({ error: "Card payment isn't available right now — please try again later." }); // 503 = payments not switched on (customer-friendly, zero dev-talk)

  const planKey = String(req.body?.plan || 'pro_monthly').toLowerCase(); // ?. guards missing body; default Pro monthly
  if (planKey === 'lifetime') return res.status(400).json({ error: `Pay-once plans are now handled personally — contact sales at ${SALES_EMAIL} and we will set you up.` }); // lifetime retired from self-serve (grandfathered buyers keep it!)
  const plan = PLANS[planKey]; // lookup: unknown keys → undefined…
  if (!plan) return res.status(400).json({ error: 'Unknown plan. Choose Pro or Pro Plus, monthly or yearly.' }); // …→ 400

  // Look the payer email up (legacy code read req.ownerEmail — NO middleware ever set it, so live payments failed; fixed here).
  let email = null;
  try {
    if (req.session?.userId) { // ?. = session might theoretically be missing
      const { rows } = await db.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [req.session.userId]); // prefer the logged-in user…
      email = rows[0]?.email || null; // ?. + || null: missing row → null, not crash
    }
    if (!email && req.session?.businessId) { // …fallback: first user of this business…
      const { rows } = await db.query('SELECT email FROM users WHERE business_id = $1 ORDER BY id ASC LIMIT 1', [req.session.businessId]); // ASC = oldest account (the original owner)
      email = rows[0]?.email || null;
    }
  } catch (e) { console.error('billing email lookup error:', e.message); } // DB hiccup → email stays null → 400 below (not 500: clearer message)
  if (!email) return res.status(400).json({ error: 'No email on this account — sign out and sign in again.' });

  const { rows: bRows } = await db.query('SELECT currency FROM businesses WHERE id = $1', [req.session.businessId]); // price must match the SHOP's currency
  const currency = bRows[0]?.currency === 'USD' ? 'USD' : 'NGN'; // whitelist again (DB could hold anything)
  const amount = plan[currency]; // e.g. plan.USD for a Ghanaian shop
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`; // Paystack returns the payer here (env in prod, request host locally)

  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', { // ask Paystack for a checkout session
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`, // server secret as Bearer token
        'Content-Type': 'application/json', // Paystack speaks JSON (form-encoded here as URLSearchParams elsewhere)
      },
      body: JSON.stringify({
        email, // shorthand: { email: email } — Paystack receipts go here
        amount: amount * 100, // SMALLEST unit: kobo for NGN, cents for USD (₦7500→750000; $5→500)
        currency, // 'NGN' or 'USD' (USD must be enabled once in Paystack dashboard!)
        metadata: { business_id: req.session.businessId, kind: planKey, days: plan.days, currency }, // echoed back in the webhook — how we know WHO paid FOR WHAT
        callback_url: `${baseUrl}/dashboard`, // landing page after payment
      }),
    });
    const data = await r.json(); // parse Paystack's reply
    if (!data.status) return res.status(502).json({ error: data.message || 'Paystack error' }); // 502 = Paystack (upstream) said no
    res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference }); // frontend: location.href = authorization_url
  } catch (err) {
    console.error('billing initialize error:', err); // network/DNS failure…
    res.status(502).json({ error: 'Could not reach Paystack' });
  }
}

// Bank transfer is RETIRED — card only (Paystack NGN, Flutterwave USD).
// This stub stays so old apps get a clear message (410 Gone), not a 404.
// Pending claims already in the queue are still honored via Admin → Transfers.
async function reportTransfer(req, res) {
  return res.status(410).json({ error: 'Bank transfer is retired — please pay by card on this page. It activates instantly.' }); // 410 = gone for good (clients should stop calling!)
}

// Flutterwave checkout (USD / international shops). Same shape as Paystack's
// initialize: server picks the amount, returns a payment link. NGN shops are
// redirected to Paystack instead (Flutterwave USD-only here keeps fees clean).
// KEYS (docs/api-keys-starter.md): FLW_SECRET_KEY (Dashboard → Settings → API
// keys → SECRET key: FLWSECK_TEST… to test, FLWSECK… live for real money).
// No key = 503 with a customer-friendly message (never dev-talk!).
async function flutterwaveInit(req, res) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret || secret.includes('xxxxx')) return res.status(503).json({ error: "Card payment isn't available right now — please try again later or contact support from Help." });

  const planKey = String(req.body?.plan || 'pro_monthly').toLowerCase();
  if (planKey === 'lifetime') return res.status(400).json({ error: `Pay-once plans are now handled personally — contact sales at ${SALES_EMAIL} and we will set you up.` });
  const plan = PLANS[planKey];
  if (!plan) return res.status(400).json({ error: 'Unknown plan. Choose Pro or Pro Plus, monthly or yearly.' });

  let email = null; // payer email (same lookup as Paystack — receipts go here!)
  try {
    if (req.session?.userId) {
      const { rows } = await db.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [req.session.userId]);
      email = rows[0]?.email || null;
    }
    if (!email && req.session?.businessId) {
      const { rows } = await db.query('SELECT email FROM users WHERE business_id = $1 ORDER BY id ASC LIMIT 1', [req.session.businessId]);
      email = rows[0]?.email || null;
    }
  } catch (e) { console.error('flutterwave email lookup error:', e.message); }
  if (!email) return res.status(400).json({ error: 'No email on this account — sign out and sign in again.' });

  const { rows: bRows } = await db.query('SELECT currency FROM businesses WHERE id = $1', [req.session.businessId]);
  const currency = bRows[0]?.currency === 'USD' ? 'USD' : 'NGN';
  if (currency !== 'USD') return res.status(400).json({ error: 'This checkout is for US Dollar shops — Naira shops pay with Paystack just above.' }); // wrong door → point at the right one
  const amount = plan.USD; // major units ($5, $47, $10, $80 — Flutterwave takes majors, NOT cents!)
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const txRef = `vendora-${req.session.businessId}-${planKey}-${Date.now()}`; // unique ref (echoed in webhook + ledger!)

  try {
    const r = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: txRef, // our unique ref (idempotency + ledger matching!)
        amount, // MAJOR units (Flutterwave differs from Paystack's kobo here — don't "fix" this!)
        currency: 'USD',
        redirect_url: `${baseUrl}/billing`, // landing page after payment
        customer: { email }, // shorthand receipt address
        meta: { business_id: req.session.businessId, kind: planKey, days: plan.days, currency: 'USD' }, // webhook reads these back (WHO paid FOR WHAT!)
        customizations: { title: 'Vendora Pro', description: plan.label },
      }),
    });
    const data = await r.json();
    if (data.status !== 'success') return res.status(502).json({ error: data.message || 'Flutterwave error' }); // 502 = upstream said no
    res.json({ authorization_url: data.data.link, reference: txRef }); // SAME shape as Paystack init (frontend reuses one redirect flow!)
  } catch (err) {
    console.error('flutterwave initialize error:', err.message);
    res.status(502).json({ error: 'Could not reach Flutterwave' });
  }
}

// Shared activation (BOTH webhooks land here after THEIR OWN verification).
// Extends expiry from the later of (existing expiry, now) — early renewals
// never lose days. Resets trial flags (a buyer is no longer "trialing"!).
async function activateSubscription(businessId, kind, days, reference, method, amountMinor, currency) {
  const boughtTier = (PLANS[kind] && PLANS[kind].tier) || 'pro'; // pro_* → pro, plus_* → plus (Plus-only gates read this!)
  await db.query(
    `UPDATE businesses
     SET subscription_status = 'active',
         subscription_expires = GREATEST(COALESCE(subscription_expires, now()), now()) + make_interval(days => $1),
         paystack_customer_code = $2,
         plan_tier = $4,
         trial_warned = true, trial_expiry_notified = true
     WHERE id = $3`, // trial flags → true (buyers skip trial warnings entirely — they BOUGHT, no countdown needed!)
    [days, reference, Number(businessId), boughtTier]
  );
  try { // ledger row (isolated try/catch: money RECORDS must never break ACTIVATION!)
    await db.query(
      'INSERT INTO payments (business_id, plan, currency, amount, method, status, reference) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [Number(businessId), PLANS[kind] ? kind : 'pro_monthly', currency, Number(amountMinor) || 0, method, 'active', reference]
    );
  } catch (e) { console.error('payment ledger error:', e.message); }
  console.log(`Subscription activated for business ${businessId} via ${method} (+${days} days)`);
  require('../services/notifyService').notify(Number(businessId), { // bell (fire-and-forget)
    title: 'Payment confirmed — Pro is active!',
    body: `Your card payment went through. Enjoy ${days} days of Pro.`,
    link: '/billing',
  });
}

async function handlePaystackWebhook(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).end(); // .end() = empty body (webhooks don't need JSON)

  const signature = req.get('x-paystack-signature') || ''; // Paystack's HMAC-SHA512 of the RAW body
  const expected = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex'); // recompute: needs req.rawBody (saved by server.js json verify hook — parsed JSON would differ!)
  const a = Buffer.from(signature); // Buffers for…
  const b = Buffer.from(expected); // …timingSafeEqual (constant-time compare)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).end(); // forged → silent reject (don't hint why)
  }

  const event = req.body; // verified genuine — now trust the JSON
  if (event.event === 'charge.success') { // only successful charges (failed/pending ignored)
    const { business_id, kind, days: metaDays } = event.data.metadata || {}; // destructure OUR metadata back out (|| {} guards missing)
    const days = Number(metaDays) || (PLANS[kind] ? PLANS[kind].days : Number(process.env.SUBSCRIPTION_DAYS || 30)); // metadata days → plan table → env default (triple fallback, never NaN-activate)
    if (business_id) { // ONE shared activation (tier stamp + ledger + bell inside!)
      const amt = event.data.amount || 0; // Paystack sends amount in MINOR units already (kobo/cents — store as-is!)
      const cur = (event.data.currency || 'NGN').toUpperCase(); // 'NGN' | 'USD' (upstream value, uppercased defensively)
      await activateSubscription(business_id, kind, days, event.data.customer?.customer_code || event.data.reference || null, 'paystack', amt, cur); // ?. guards missing customer object
    }
  }
  res.status(200).end(); // always 200 on verified events (Paystack retries anything else)
}

// Flutterwave webhook: POST /webhook/flutterwave (mounted in server.js —
// needs raw-body + its OWN check like Paystack's, NOT a session!).
// SECURITY: Flutterwave sends `verif-hash`; we accept ONLY when it equals
// our FLW_SECRET_HASH (Dashboard → Settings → Webhooks → copy it here).
// Then we VERIFY the transaction server-side (never trust the webhook body
// for money facts — re-query Flutterwave ourselves!).
async function handleFlutterwaveWebhook(req, res) {
  const secretHash = process.env.FLW_SECRET_HASH;
  if (!secretHash) return res.status(503).end(); // not configured → refuse (loud in logs, silent on wire!)
  if ((req.get('verif-hash') || '') !== secretHash) return res.status(403).end(); // forged → silent reject (don't hint why!)

  const event = req.body || {};
  if (event.event !== 'charge.completed' || !event.data || event.data.status !== 'successful') return res.status(200).end(); // only successful charges (anything else: ack + ignore!)
  const txId = event.data.id; // Flutterwave's transaction id (we re-query THIS!)
  if (!txId) return res.status(200).end();

  try {
    const verify = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, { // server-side truth (webhook bodies can lie — this call can't!)
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });
    const v = await verify.json();
    if (v.status !== 'success' || !v.data || v.data.status !== 'successful') return res.status(200).end(); // verify failed → ack, don't activate (money not proven!)
    const d = v.data; // verified facts ONLY from here down (never event.data!)
    const meta = d.meta || {};
    const kind = String(meta.kind || 'pro_monthly').toLowerCase();
    const days = Number(meta.days) || (PLANS[kind] ? PLANS[kind].days : 30); // metadata days → plan table → 30 (triple fallback!)
    const expected = (PLANS[kind] && PLANS[kind].USD) || 0; // USD majors ($5, $47…) — Flutterwave verify returns majors too!
    if (Number(d.amount) < expected || String(d.currency).toUpperCase() !== 'USD') { // underpaid or wrong currency → NO activation (log + ack!)
      console.error(`Flutterwave amount mismatch: got ${d.amount} ${d.currency}, want ${expected} USD for ${kind}`);
      return res.status(200).end();
    }
    if (meta.business_id) { // WHO paid FOR WHAT (from OUR init meta — echoed back!)
      await activateSubscription(meta.business_id, kind, days, d.tx_ref || String(txId), 'flutterwave', Math.round(Number(d.amount) * 100), 'USD'); // ×100 → cents (ledger stays minor-units!)
    }
  } catch (e) {
    console.error('flutterwave webhook error:', e.message); // network/JSON failure → log (Flutterwave retries un-acked… we acked 200 below ONLY on handled paths; here fall through to 200 to avoid poison retries? NO — 500 retries genuinely-lost money events!)
    return res.status(500).end();
  }
  res.status(200).end();
}

module.exports = { initialize, flutterwaveInit, reportTransfer, handlePaystackWebhook, handleFlutterwaveWebhook, PLANS, planFor, SALES_EMAIL }; // routes + ownerController.getBilling import from here
