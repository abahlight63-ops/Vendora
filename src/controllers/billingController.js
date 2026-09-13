// ── src/controllers/billingController.js ───────────────────────────
// WHAT: money in. PLANS (dual-currency price table) + initialize (Paystack
// checkout) + reportTransfer ("I sent the money") + handlePaystackWebhook
// (verify signature → activate subscription). Amounts live SERVER-side: the
// browser only sends "monthly"/"yearly"/"lifetime" (never amounts — clients lie).
// MODULES: crypto (Node built-in HMAC), ../db (pool). Paystack via fetch.
const crypto = require('crypto'); // Node built-in: HMAC-SHA512 webhook verification
const db = require('../db'); // shared pool

// Plans: amounts are server-side — the client only sends the plan key.
// Dual currency: NGN for +234 businesses, USD (exact FX parity) for the world.
const PLANS = {
  monthly: { NGN: Number(process.env.PRICE_MONTHLY_NAIRA || 7500), USD: Number(process.env.PRICE_MONTHLY_USD || 5), days: 30, label: 'Monthly' }, // Number() because env vars are strings; || defaults
  yearly: { NGN: Number(process.env.PRICE_YEARLY_NAIRA || 50000), USD: Number(process.env.PRICE_YEARLY_USD || 33), days: 365, label: 'Yearly' },
  lifetime: { NGN: Number(process.env.PRICE_LIFETIME_NAIRA || 100000), USD: Number(process.env.PRICE_LIFETIME_USD || 65), days: 36500, label: 'Lifetime' }, // 36500 ≈ 100 years = "forever" in timestamp math
};

// Shape PLANS for ONE currency (what getBilling sends the frontend).
function planFor(currency) {
  const cur = currency === 'USD' ? 'USD' : 'NGN'; // whitelist: anything non-USD becomes NGN (injection-safe)
  const out = {};
  for (const [k, p] of Object.entries(PLANS)) { // Object.entries = [[key, value],…] — destructure each pair
    out[k] = { amount: p[cur], currency: cur, days: p.days, label: p.label }; // amount = price in THIS currency
  }
  out.yearly.save = out.monthly.amount * 12 - out.yearly.amount; // e.g. 7500×12−50000 = ₦40,000 saved
  out.yearly.save_pct = Math.round((out.yearly.save / (out.monthly.amount * 12)) * 100); // 40000/90000 = 44%
  return out;
}
async function initialize(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY; // server-only secret (never reaches the browser)
  if (!secret || secret.includes('xxxxx')) return res.status(503).json({ error: "Card payment isn't available right now — please pay by bank transfer below." }); // 503 = payments not switched on (customer-friendly, zero dev-talk)

  const planKey = String(req.body?.plan || 'monthly').toLowerCase(); // ?. guards missing body; default monthly
  const plan = PLANS[planKey]; // lookup: unknown keys → undefined…
  if (!plan) return res.status(400).json({ error: 'Unknown plan. Choose monthly, yearly or lifetime.' }); // …→ 400

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
        'Content-Type': 'application/json', // Paystack speaks JSON (unlike Twilio forms)
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

// Manual bank-transfer path — VERIFIED, not "tap and trust".
// Security model (why each check exists):
//  - sender_name + sender_bank + reference REQUIRED: admin matches the claim
//    against the real bank statement. No details = no activation.
//  - amount_paid must EXACTLY equal the plan price: underpayers can't sneak in,
//    overpayers get flagged (typo or wrong plan) instead of auto-credit.
//  - ONE pending claim per business: prevents queue-spam / double-spend races.
//  - reference min-length + uniqueness per business: the same teller number
//    can't activate twice.
//  - Everything is logged in `payments` (sender_*, amount, reference) so the
//    admin queue shows WHO paid WHAT with WHICH ref — approve/reject in 1 click.
// API-KEY NOTE (the user asked "tell me if a key is needed"):
//  - Card checkout needs PAYSTACK_SECRET_KEY (Paystack Dashboard → Settings →
//    API Keys → copy the SECRET key: sk_test_... to test, sk_live_... for real
//    money). No key = /initialize returns 503 and Billing shows transfer only.
//  - Transfer block needs BANK_NAME + BANK_ACCOUNT_NUMBER + BANK_ACCOUNT_NAME.
//    No bank env = transfer block hides entirely (never show half-details).
async function reportTransfer(req, res) {
  const planKey = String(req.body?.plan || 'monthly').toLowerCase();
  if (!PLANS[planKey]) return res.status(400).json({ error: 'Unknown plan.' }); // validate the key (same whitelist idea)
  const senderName = String(req.body?.sender_name || '').trim().slice(0, 80);
  const senderBank = String(req.body?.sender_bank || '').trim().slice(0, 80);
  const senderRef = String(req.body?.reference || req.body?.sender_ref || '').trim().slice(0, 60);
  const amountPaid = Number(req.body?.amount_paid ?? req.body?.amount);
  const errors = [];
  if (senderName.length < 3) errors.push('Enter the exact account name you paid from (3+ characters).');
  if (senderBank.length < 2) errors.push('Enter the bank you paid from.');
  if (!senderRef || senderRef.replace(/[^A-Za-z0-9]/g, '').length < 6) errors.push('Enter the transfer reference / teller number (at least 6 letters or digits).');
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const { rows: bRows } = await db.query('SELECT currency, subscription_status FROM businesses WHERE id = $1', [req.session.businessId]); // price the ledger in the SHOP's currency (same rule as initialize!)
    if (!bRows.length) return res.status(404).json({ error: 'Business not found.' });
    if (bRows[0].subscription_status === 'pending') {
      return res.status(400).json({ error: 'You already have a transfer waiting for review. Please wait for activation before sending another.' });
    }
    const currency = bRows[0]?.currency === 'USD' ? 'USD' : 'NGN';
    if (currency !== 'NGN') return res.status(400).json({ error: 'Bank transfer is Naira-only for now — please pay by card above.' });
    const expected = PLANS[planKey][currency]; // major units (₦7500, not kobo)
    if (!Number.isFinite(amountPaid) || Math.round(amountPaid) !== expected) {
      return res.status(400).json({ error: `Amount must be exactly ₦${expected.toLocaleString()} for ${planKey}. You entered ${req.body?.amount_paid ?? 'nothing'}. Send the exact amount, then report it.` });
    }
    // Same reference twice for this business = reject (replay protection).
    const { rows: dup } = await db.query(
      "SELECT id FROM payments WHERE business_id = $1 AND method = 'transfer' AND sender_ref = $2 AND status IN ('pending','active') LIMIT 1",
      [req.session.businessId, senderRef]
    );
    if (dup.length) return res.status(400).json({ error: 'That reference was already used. Check your bank receipt for the correct reference number.' });
    const tag = `transfer:${planKey}:${Date.now()}`; // unique audit tag (also stored as customer_code)
    await db.query(
      `UPDATE businesses SET subscription_status = 'pending',
        paystack_customer_code = $1 WHERE id = $2`,
      [tag, req.session.businessId]
    );
    await db.query( // ledger row: pending until a human (admin approvals!) confirms the credit…
      'INSERT INTO payments (business_id, plan, currency, amount, method, status, reference, sender_name, sender_bank, sender_ref) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [req.session.businessId, planKey, currency, PLANS[planKey][currency] * 100, 'transfer', 'pending', tag, senderName, senderBank, senderRef] // amount in MINOR units (kobo/cents — integers, never floats!)
    );
    require('../services/notifyService').notify(req.session.businessId, { // bell: claim logged (never throws — notify is fire-and-forget safe)
      title: 'Transfer received — verifying…',
      body: `Your ${planKey} claim (₦${expected.toLocaleString()}, ref ${senderRef}) is queued. We match it against the bank statement, usually within hours.`,
      link: '/billing',
    });
    res.json({ ok: true, message: 'Transfer reported. We verify every claim against the bank statement before activating — usually within a few hours.' });
  } catch (e) {
    console.error('transfer report error:', e.message);
    res.status(500).json({ error: 'Could not record transfer' });
  }
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
    if (business_id) {
      await db.query( // activate: status=active, extend expiry (from existing expiry or now, whichever later — early renewals don't lose days!)
        `UPDATE businesses
         SET subscription_status = 'active',
             subscription_expires = GREATEST(COALESCE(subscription_expires, now()), now()) + make_interval(days => $1),
             paystack_customer_code = $2
         WHERE id = $3`, // GREATEST(a,b) = later date; COALESCE(NULL, now()) = now; make_interval builds "N days"
        [days, event.data.customer?.customer_code || null, Number(business_id)] // ?. guards missing customer object
      );
      try { // ledger row: card payments are active IMMEDIATELY (verified webhook = proof of money!)…
        const amt = event.data.amount || 0; // Paystack sends amount in MINOR units already (kobo/cents — store as-is!)
        const cur = (event.data.currency || 'NGN').toUpperCase(); // 'NGN' | 'USD' (upstream value, uppercased defensively)
        await db.query(
          'INSERT INTO payments (business_id, plan, currency, amount, method, status, reference) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [Number(business_id), PLANS[kind] ? kind : 'monthly', cur, Number(amt) || 0, 'paystack', 'active', event.data.reference || null]
        );
      } catch (e) { console.error('payment ledger error:', e.message); } // ledger must NEVER break activation (inner try/catch isolates it!)
      console.log(`Subscription activated for business ${business_id} (+${days} days)`);
      require('../services/notifyService').notify(Number(business_id), { // bell: card payment confirmed (fire-and-forget)
        title: '✅ Payment confirmed — Pro is active!',
        body: `Your card payment went through. Enjoy ${days} days of Pro.`,
        link: '/billing',
      });
    }
  }
  res.status(200).end(); // always 200 on verified events (Paystack retries anything else)
}

module.exports = { initialize, reportTransfer, handlePaystackWebhook, PLANS, planFor }; // routes + ownerController.getBilling import from here
