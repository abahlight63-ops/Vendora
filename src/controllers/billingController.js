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
const SALES_EMAIL = process.env.SALES_EMAIL || 'velosales63@gmail.com';

// Plans: amounts are server-side — the client only sends the plan key.
// Two tiers × two periods. Dual currency: NGN for +234 businesses, USD for
// the world (USD yearly picked to mirror the NGN discount %: Pro 22%, Plus 33%).
const PLANS = {
  pro_monthly: { NGN: Number(process.env.PRICE_MONTHLY_NAIRA || 7499), USD: Number(process.env.PRICE_MONTHLY_USD || 5), days: 30, label: 'Pro Monthly', tier: 'pro' }, // Number() because env vars are strings; || defaults
  pro_yearly: { NGN: Number(process.env.PRICE_YEARLY_NAIRA || 69999), USD: Number(process.env.PRICE_YEARLY_USD || 47), days: 365, label: 'Pro Yearly', tier: 'pro' }, // 7499×12−69999 = ₦19,989 saved ≈ 22%
  plus_monthly: { NGN: Number(process.env.PRICE_PLUS_MONTHLY_NAIRA || 14999), USD: Number(process.env.PRICE_PLUS_MONTHLY_USD || 10), days: 30, label: 'Pro Plus Monthly', tier: 'plus' },
  plus_yearly: { NGN: Number(process.env.PRICE_PLUS_YEARLY_NAIRA || 119999), USD: Number(process.env.PRICE_PLUS_YEARLY_USD || 80), days: 365, label: 'Pro Plus Yearly', tier: 'plus' }, // 14999×12−119999 = ₦59,989 saved ≈ 33%
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
// Where the web app lives (the API and the app can sit on different hosts).
function appUrl(req, fallback) {
  return String(process.env.APP_URL || process.env.FRONTEND_URL || fallback || '').replace(/\/$/, '');
}

// Refer & Earn credit at checkout. Returns { creditMinor, payMinor }: the
// credit to use and what is left to charge. A tiny leftover the payment
// provider cannot charge (under ₦100 / $1) is covered by using less credit.
async function creditSplit(businessId, priceMajor, currency) {
  const priceMinor = Math.round(Number(priceMajor) * 100);
  let balance = 0;
  try { balance = (await require('../services/referralService').creditBalance(businessId)).balance; } catch (e) { console.error('credit lookup error:', e.message); }
  let creditMinor = Math.min(balance, priceMinor);
  const minCharge = currency === 'USD' ? 100 : 10000; // $1.00 or ₦100.00 in minor units
  const rest = priceMinor - creditMinor;
  if (rest > 0 && rest < minCharge) creditMinor = Math.max(0, priceMinor - minCharge);
  return { creditMinor, payMinor: priceMinor - creditMinor };
}

// Credit covers the whole plan: activate now, no checkout page at all.
async function activateWithCredit(req, res, planKey, plan, currency, creditMinor) {
  const reference = `credit-${req.session.businessId}-${planKey}-${Date.now()}`;
  await activateSubscription(req.session.businessId, planKey, plan.days, reference, 'credit', 0, currency, creditMinor);
  return res.json({ activated: true, paidWithCredit: creditMinor / 100, currency });
}

// Save the card Paystack returns, for display only: brand, last 4 and expiry.
async function saveCard(businessId, auth) {
  if (!businessId || !auth || auth.channel !== 'card' || !auth.last4) return;
  const brand = String(auth.card_type || auth.brand || 'card').trim().slice(0, 20);
  const exp = auth.exp_month && auth.exp_year ? `${String(auth.exp_month).padStart(2, '0')}/${String(auth.exp_year).slice(-2)}` : null;
  try {
    await db.query('UPDATE businesses SET card_last4 = $1, card_brand = $2, card_expiry = $3 WHERE id = $4', [String(auth.last4).slice(-4), brand, exp, Number(businessId)]);
  } catch (e) { console.error('save card error:', e.message); }
}

// The ₦50 card check is refunded straight away. A second refund attempt for the
// same reference fails harmlessly at Paystack, so webhook + return can both call it.
async function refundCardCheck(reference) {
  if (!reference || !process.env.PAYSTACK_SECRET_KEY) return;
  try {
    await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: reference }),
    });
  } catch (e) { console.error('card check refund error:', e.message); }
}

// POST /api/billing/card: add or change the saved card with a ₦50 check that is refunded.
async function addCard(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || secret.includes('xxxxx')) return res.status(503).json({ error: "Card payment isn't available right now — please try again later." });
  let email = null;
  try {
    const { rows } = await db.query('SELECT email FROM users WHERE business_id = $1 ORDER BY id ASC LIMIT 1', [req.session.businessId]);
    email = rows[0]?.email || null;
  } catch (e) { console.error('add card email lookup error:', e.message); }
  if (!email) return res.status(400).json({ error: 'No email on this account — sign out and sign in again.' });
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: 5000, // ₦50 in kobo, refunded as soon as the card is confirmed
        currency: 'NGN',
        channels: ['card'],
        metadata: { business_id: req.session.businessId, kind: 'card_check' },
        callback_url: `${appUrl(req, baseUrl)}/billing`,
      }),
    });
    const data = await r.json();
    if (!data.status) return res.status(502).json({ error: data.message || 'Paystack error' });
    return res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference });
  } catch (err) {
    console.error('add card error:', err);
    return res.status(502).json({ error: 'Could not reach the payment provider — try again.' });
  }
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
  const { creditMinor, payMinor } = await creditSplit(req.session.businessId, amount, currency); // Refer & Earn credit comes off first
  if (payMinor === 0 && creditMinor > 0) {
    try { return await activateWithCredit(req, res, planKey, plan, currency, creditMinor); }
    catch (e) { console.error('credit activation error:', e.message); return res.status(500).json({ error: 'Could not use your credit right now — try again.' }); }
  }
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`; // Paystack returns the payer here (env in prod, request host locally)
  const PAY_CHANNELS = ['card', 'bank_transfer', 'ussd', 'bank']; // the owner's pick on the checkout sheet
  const channel = PAY_CHANNELS.includes(String(req.body?.channel || '')) ? String(req.body.channel) : null; // unknown or missing = Paystack shows every method

  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', { // ask Paystack for a checkout session
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`, // server secret as Bearer token
        'Content-Type': 'application/json', // Paystack speaks JSON (form-encoded here as URLSearchParams elsewhere)
      },
      body: JSON.stringify({
        email, // shorthand: { email: email } — Paystack receipts go here
        amount: payMinor, // SMALLEST unit: kobo for NGN, cents for USD, after any Refer & Earn credit
        currency, // 'NGN' or 'USD' (USD must be enabled once in Paystack dashboard!)
        metadata: { business_id: req.session.businessId, kind: planKey, days: plan.days, currency, credit_used: creditMinor }, // echoed back in the webhook — WHO paid FOR WHAT, and the credit to take
        callback_url: `${appUrl(req, baseUrl)}/billing`, // back to Plan and usage, which verifies the reference
        ...(channel ? { channels: [channel] } : {}), // open checkout on the method the owner picked
      }),
    });
    const data = await r.json(); // parse Paystack's reply
    if (!data.status) return res.status(502).json({ error: data.message || 'Paystack error' }); // 502 = Paystack (upstream) said no
    res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference, creditUsed: creditMinor / 100, toPay: payMinor / 100, currency }); // frontend: location.href = authorization_url
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
  const { creditMinor, payMinor } = await creditSplit(req.session.businessId, plan.USD, 'USD'); // Refer & Earn credit comes off first
  if (payMinor === 0 && creditMinor > 0) {
    try { return await activateWithCredit(req, res, planKey, plan, 'USD', creditMinor); }
    catch (e) { console.error('credit activation error:', e.message); return res.status(500).json({ error: 'Could not use your credit right now — try again.' }); }
  }
  const amount = payMinor / 100; // major units ($5, $47, $10, $80 — Flutterwave takes majors, NOT cents!), after credit
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
        meta: { business_id: req.session.businessId, kind: planKey, days: plan.days, currency: 'USD', credit_used: creditMinor }, // webhook reads these back (WHO paid FOR WHAT, and the credit to take)
        customizations: { title: 'VeloSales Ai Pro', description: plan.label },
      }),
    });
    const data = await r.json();
    if (data.status !== 'success') return res.status(502).json({ error: data.message || 'Flutterwave error' }); // 502 = upstream said no
    res.json({ authorization_url: data.data.link, reference: txRef, creditUsed: creditMinor / 100, toPay: amount, currency: 'USD' }); // SAME shape as Paystack init (frontend reuses one redirect flow!)
  } catch (err) {
    console.error('flutterwave initialize error:', err.message);
    res.status(502).json({ error: 'Could not reach Flutterwave' });
  }
}

// Paid enough for this plan? Plan price in the paid currency, minus the
// Refer & Earn credit agreed at checkout (never more than the price). A
// short or wrong-currency payment never activates a plan; it is logged as
// payment_mismatch (admin console → Security) and alerted.
function paystackAmountOk(kind, currency, paidMinor, creditMinor) {
  const plan = PLANS[kind];
  if (!plan) return false;
  const cur = String(currency || '').toUpperCase();
  if (cur !== 'NGN' && cur !== 'USD') return false;
  const price = Math.round(Number(plan[cur]) * 100);
  const minCharge = cur === 'USD' ? 100 : 10000; // a card payment always covers at least this (credit that covers everything never goes to the card)
  const credit = Math.min(Math.max(0, Number(creditMinor) || 0), Math.max(0, price - minCharge));
  return Number(paidMinor) >= price - credit;
}

// Shared activation (BOTH webhooks land here after THEIR OWN verification).
// Extends expiry from the later of (existing expiry, now) — early renewals
// never lose days. Resets trial flags (a buyer is no longer "trialing"!).
async function activateSubscription(businessId, kind, days, reference, method, amountMinor, currency, creditMinor) {
  if (reference) { // IDEMPOTENCY: webhooks retry + return-verify can double-fire (same reference = same money — never extend twice, never double-email!)
    try {
      const { rows: dup } = await db.query("SELECT 1 FROM payments WHERE reference = $1 AND status = 'active' LIMIT 1", [String(reference)]);
      if (dup.length) { console.log(`activateSubscription: duplicate ${method} ${reference} ignored`); return { duplicate: true }; }
    } catch (e) { console.error('activation dedupe error:', e.message); } // lookup failed → proceed anyway (activation beats caution here!)
  }
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
  let creditTaken = 0;
  if (Number(creditMinor) > 0) { // Refer & Earn credit used on this payment (after the dedupe above: taken once per reference)
    try { creditTaken = await require('../services/referralService').spendCredit(businessId, creditMinor, reference); }
    catch (e) { console.error('credit spend error:', e.message); }
  }
  console.log(`Subscription activated for business ${businessId} via ${method} (+${days} days)` + (creditTaken ? `, credit used ${creditTaken}` : ''));
  const sym = currency === 'USD' ? '$' : '₦';
  const creditLine = creditTaken ? ` ${sym}${(creditTaken / 100).toLocaleString('en-NG')} of Refer & Earn credit was used.` : '';
  require('../services/notifyService').notify(Number(businessId), { // bell (fire-and-forget)
    title: method === 'credit' ? 'Paid with your credit — plan is active!' : 'Payment confirmed — plan is active!',
    body: method === 'credit' ? `Your Refer & Earn credit paid for ${days} days.${creditLine}` : `Your payment went through. Enjoy ${days} days.${creditLine}`,
    link: '/billing',
  });
  if (method !== 'credit') { // receipt email (best-effort: activation already done — mail failing must never break it!)
    const mail = require('../services/emailTemplates');
    mail.ownerContact(businessId).then((c) => {
      if (!c) return null;
      const label = (PLANS[kind] && PLANS[kind].label) || 'Pro';
      return mail.sendPaymentSuccess(c.email, c.name, { plan: label, amountMajor: (Number(amountMinor) || 0) / 100, currency, reference, days });
    }).catch((e) => console.error('payment receipt email error:', e.message));
  }
  if (method !== 'credit') require('../services/referralService').onPaidActivation(Number(businessId)) // referrer earns plan credit on this shop's first real payment
    .catch((e) => console.error('referral milestone error:', e.message)); // rewards never break payments!
}

async function handlePaystackWebhook(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).end(); // .end() = empty body (webhooks don't need JSON)

  const signature = req.get('x-paystack-signature') || ''; // Paystack's HMAC-SHA512 of the RAW body
  const expected = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex'); // recompute: needs req.rawBody (saved by server.js json verify hook — parsed JSON would differ!)
  const a = Buffer.from(signature); // Buffers for…
  const b = Buffer.from(expected); // …timingSafeEqual (constant-time compare)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    require('../services/securityLog').log('webhook_rejected', req, 'Paystack: bad signature');
    return res.status(403).end(); // forged → silent reject (don't hint why)
  }

  const event = req.body; // verified genuine — now trust the JSON
  if (event.event === 'charge.failed') { // card declined/abandoned → gentle recovery email (no charge was made!)
    const { business_id, kind } = event.data.metadata || {};
    if (business_id) {
      require('../services/notifyService').notify(Number(business_id), { // bell too, so it is seen without opening email
        title: "Your payment didn't go through",
        body: `No money was taken. ${event.data.gateway_response ? 'Your bank said: ' + String(event.data.gateway_response).slice(0, 120) + '. ' : ''}Tap to try again, or pick another way to pay.`,
        link: '/billing',
        dedupeHours: 6,
      }).catch(() => {});
      const mail = require('../services/emailTemplates');
      mail.ownerContact(business_id).then((c) => {
        if (!c) return null;
        const label = (PLANS[kind] && PLANS[kind].label) || 'Pro';
        const reason = event.data.gateway_response || event.data.message || '';
        return mail.sendPaymentFailed(c.email, c.name, { plan: label, amountMajor: (Number(event.data.amount) || 0) / 100, currency: (event.data.currency || 'NGN').toUpperCase(), reason });
      }).catch((e) => console.error('payment-failed email error:', e.message));
    }
  } else if (event.event === 'charge.success') { // only successful charges (failed/pending ignored)
    const { business_id, kind, days: metaDays, credit_used: creditUsed } = event.data.metadata || {}; // destructure OUR metadata back out (|| {} guards missing)
    if (business_id) await saveCard(business_id, event.data.authorization);
    if (kind === 'card_check') { await refundCardCheck(event.data.reference); return res.status(200).end(); } // a card check is not a plan purchase
    const days = Number(metaDays) || (PLANS[kind] ? PLANS[kind].days : Number(process.env.SUBSCRIPTION_DAYS || 30)); // metadata days → plan table → env default (triple fallback, never NaN-activate)
    if (business_id) { // ONE shared activation (tier stamp + ledger + bell inside!)
      const amt = event.data.amount || 0; // Paystack sends amount in MINOR units already (kobo/cents — store as-is!)
      const cur = (event.data.currency || 'NGN').toUpperCase(); // 'NGN' | 'USD' (upstream value, uppercased defensively)
      if (!paystackAmountOk(kind, cur, amt, creditUsed)) {
        console.error(`Paystack amount mismatch: got ${amt} ${cur} for ${kind} (business ${business_id})`);
        require('../services/securityLog').log('payment_mismatch', req, `Paystack ${event.data.reference}: paid ${amt / 100} ${cur} for ${kind}`, business_id);
        return res.status(200).end(); // acknowledged, NOT activated
      }
      await activateSubscription(business_id, kind, days, event.data.reference || event.data.customer?.customer_code || null, 'paystack', amt, cur, Number(creditUsed) || 0); // reference first: unique per payment, so the dedupe and the credit spend run once
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
  if (!require('../middleware/security').safeEqual(req.get('verif-hash') || '', secretHash)) { // constant-time compare
    require('../services/securityLog').log('webhook_rejected', req, 'Flutterwave: bad hash');
    return res.status(403).end(); // forged → silent reject (don't hint why!)
  }

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
    const creditUsed = Math.max(0, Number(meta.credit_used) || 0); // minor units of Refer & Earn credit agreed at checkout
    const expected = Math.max(0, ((PLANS[kind] && PLANS[kind].USD) || 0) - creditUsed / 100); // USD majors ($5, $47…) after credit — Flutterwave verify returns majors too!
    if (Number(d.amount) < expected || String(d.currency).toUpperCase() !== 'USD') { // underpaid or wrong currency → NO activation (log + ack!)
      console.error(`Flutterwave amount mismatch: got ${d.amount} ${d.currency}, want ${expected} USD for ${kind}`);
      require('../services/securityLog').log('payment_mismatch', req, `Flutterwave ${d.tx_ref}: paid ${d.amount} ${d.currency} for ${kind}`, meta.business_id);
      if (meta.business_id) { // verified buyer known → tell them (best-effort, never blocks the ack!)
        const mail = require('../services/emailTemplates');
        mail.ownerContact(meta.business_id).then((c) => {
          if (!c) return null;
          return mail.sendPaymentFailed(c.email, c.name, { plan: (PLANS[kind] && PLANS[kind].label) || 'Pro', reason: 'The amount received did not match the plan price.' });
        }).catch((e) => console.error('payment-failed email error:', e.message));
      }
      return res.status(200).end();
    }
    if (meta.business_id) { // WHO paid FOR WHAT (from OUR init meta — echoed back!)
      await activateSubscription(meta.business_id, kind, days, d.tx_ref || String(txId), 'flutterwave', Math.round(Number(d.amount) * 100), 'USD', creditUsed); // ×100 → cents (ledger stays minor-units!)
    }
  } catch (e) {
    console.error('flutterwave webhook error:', e.message); // network/JSON failure → log (Flutterwave retries un-acked… we acked 200 below ONLY on handled paths; here fall through to 200 to avoid poison retries? NO — 500 retries genuinely-lost money events!)
    return res.status(500).end();
  }
  res.status(200).end();
}

// Verify-on-return: the payer is BACK from checkout (?reference= /
// ?transaction_id=). Webhooks usually beat them here (idempotency above makes
// double-activation impossible), but a slow/misconfigured webhook must NEVER
// leave "I paid, nothing happened". GET /api/billing/verify (requireAuth!):
//   ?provider=paystack&reference=X  |  ?provider=flutterwave&tx_id=Y
// Ownership enforced: metadata.business_id MUST equal the session shop.
async function verifyReturn(req, res) {
  const provider = String(req.query.provider || 'paystack').toLowerCase();
  try {
    if (provider === 'flutterwave') {
      const txId = String(req.query.tx_id || req.query.transaction_id || '');
      if (!txId) return res.status(400).json({ error: 'Missing transaction id.' });
      if (!process.env.FLW_SECRET_KEY) return res.status(503).json({ error: 'Verification unavailable right now.' });
      const vr = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(txId)}/verify`, {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      });
      const v = await vr.json().catch(() => ({}));
      const d = v.data || {};
      if (v.status !== 'success' || !d || d.status !== 'successful') return res.status(402).json({ error: 'Payment not confirmed yet — if money left your account, wait a minute and retry.' });
      const meta = d.meta || {};
      if (String(meta.business_id) !== String(req.session.businessId)) return res.status(403).json({ error: 'That payment belongs to a different shop.' });
      const kind = String(meta.kind || 'pro_monthly').toLowerCase();
      const days = Number(meta.days) || (PLANS[kind] ? PLANS[kind].days : 30);
      const creditUsed = Math.max(0, Number(meta.credit_used) || 0);
      const expected = Math.max(0, ((PLANS[kind] && PLANS[kind].USD) || 0) - creditUsed / 100);
      if (Number(d.amount) < expected || String(d.currency).toUpperCase() !== 'USD') return res.status(402).json({ error: 'The amount paid does not match the plan price. Contact support from Help.' });
      await activateSubscription(meta.business_id, kind, days, d.tx_ref || String(txId), 'flutterwave', Math.round(Number(d.amount) * 100), 'USD', creditUsed);
      return res.json({ ok: true });
    }
    const reference = String(req.query.reference || req.query.trxref || '');
    if (!reference) return res.status(400).json({ error: 'Missing payment reference.' });
    if (!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Verification unavailable right now.' });
    const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const v = await vr.json().catch(() => ({}));
    const d = v.data || {};
    if (!v.status || d.status !== 'success') return res.status(402).json({ error: 'Payment not confirmed yet — if money left your account, wait a minute and retry.' });
    const meta = d.metadata || {};
    if (String(meta.business_id) !== String(req.session.businessId)) return res.status(403).json({ error: 'That payment belongs to a different shop.' });
    const kind = String(meta.kind || 'pro_monthly').toLowerCase();
    await saveCard(meta.business_id, d.authorization);
    if (kind === 'card_check') { await refundCardCheck(d.reference || reference); return res.json({ ok: true, card: true }); }
    const days = Number(meta.days) || (PLANS[kind] ? PLANS[kind].days : Number(process.env.SUBSCRIPTION_DAYS || 30));
    if (!paystackAmountOk(kind, d.currency || 'NGN', Number(d.amount) || 0, meta.credit_used)) {
      require('../services/securityLog').log('payment_mismatch', req, `Paystack ${d.reference || reference}: paid ${(Number(d.amount) || 0) / 100} ${d.currency} for ${kind}`, meta.business_id);
      return res.status(402).json({ error: 'The amount paid does not match the plan price. Contact support from Help.' });
    }
    await activateSubscription(meta.business_id, kind, days, d.reference || reference, 'paystack', Number(d.amount) || 0, String(d.currency || 'NGN').toUpperCase(), Number(meta.credit_used) || 0);
    return res.json({ ok: true });
  } catch (e) {
    console.error('verify return error:', e.message);
    return res.status(502).json({ error: 'Could not reach the payment provider — try again.' });
  }
}

module.exports = { _paystackAmountOk: paystackAmountOk, _creditSplit: creditSplit, addCard, initialize, flutterwaveInit, reportTransfer, handlePaystackWebhook, handleFlutterwaveWebhook, verifyReturn, PLANS, planFor, SALES_EMAIL }; // routes + ownerController.getBilling import from here
