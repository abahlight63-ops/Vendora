// ── src/services/paymentCheck.js ──────────────────────────────────
// WHAT: admin console → Security → Payment check. Every recent payment next
// to the price its plan costs today, so a short payment, a wrong currency or a
// plan nobody sells stands out. Refer & Earn credit used on a payment counts
// towards it. Read-only: it never changes a payment or a plan.
const db = require('../db');

// verdict for one payment row (exported for tests)
function judge(row, PLANS) {
  const plan = PLANS[row.plan];
  const cur = String(row.currency || '').toUpperCase();
  if (row.method === 'credit') return { expected: null, verdict: 'credit', note: 'Paid with Refer & Earn credit' };
  if (row.method === 'transfer' || row.method === 'manual') return { expected: null, verdict: 'manual', note: 'Confirmed by hand in Admin' };
  if (!plan) return { expected: null, verdict: 'check', note: 'Unknown plan' };
  if (cur !== 'NGN' && cur !== 'USD') return { expected: null, verdict: 'check', note: 'Unknown currency' };
  const expected = Math.round(Number(plan[cur]) * 100);
  const covered = (Number(row.amount) || 0) + (Number(row.credit) || 0);
  if (covered >= expected) return { expected, verdict: 'ok', note: Number(row.credit) ? 'Paid in full (some by credit)' : 'Paid in full' };
  return { expected, verdict: 'short', note: `Short by ${((expected - covered) / 100).toLocaleString('en-NG')} ${cur}` };
}

async function recent(limit = 100) {
  const { PLANS } = require('../controllers/billingController');
  const { rows } = await db.query(
    `SELECT p.id, p.business_id, b.name AS shop, p.plan, p.currency, p.amount, p.method, p.status, p.reference, p.created_at,
            (SELECT COALESCE(SUM(r.amount), 0)::int FROM referral_payouts r
              WHERE r.referrer_business_id = p.business_id AND r.kind = 'credit_spent'
                AND p.reference IS NOT NULL AND r.note LIKE '%' || p.reference || '%') AS credit,
            (SELECT COUNT(*)::int FROM payments p2 WHERE p2.reference = p.reference AND p.reference IS NOT NULL) AS same_ref
       FROM payments p LEFT JOIN businesses b ON b.id = p.business_id
      ORDER BY p.created_at DESC LIMIT $1`,
    [Math.min(300, Number(limit) || 100)]
  );
  const out = rows.map((r) => {
    const j = judge(r, PLANS);
    if (r.same_ref > 1 && j.verdict === 'ok') return { ...r, ...j, verdict: 'check', note: 'Same payment reference recorded twice' };
    return { ...r, ...j };
  });
  return {
    rows: out,
    counts: out.reduce((m, r) => { m[r.verdict] = (m[r.verdict] || 0) + 1; return m; }, {}),
    prices: Object.fromEntries(['pro_monthly', 'pro_yearly', 'plus_monthly', 'plus_yearly'].map((k) => [k, { label: PLANS[k].label, NGN: PLANS[k].NGN, USD: PLANS[k].USD }])),
  };
}

module.exports = { recent, judge };
