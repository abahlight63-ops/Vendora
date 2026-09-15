// ── src/services/planService.js ──────────────────────────────────
// WHAT: the Free-vs-Pro rulebook in ONE place (every caller asks here, so the
// rules can never disagree). Pure functions = no DB, no side effects, trivially
// testable. No npm modules — just Date math.
// RULES:
//   FREE (forever): manual catalog (dashboard + LEARN:), bot always replies.
//   PRO: paid subscription OR inside the 14-day trial → + profile sync,
//        premium AIs, no ads.

function trialDays() {
  return Number(process.env.TRIAL_DAYS || 7); // env override, default 7 (Number() because env vars are strings)
}

// Whole days left on the trial (7 on signup day … 0 = last day, ≤0 = over).
function trialDaysLeft(business) {
  const started = new Date(business.trial_started_at || business.created_at || Date.now());
  const msLeft = trialDays() * 86400000 - (Date.now() - started.getTime()); // 86400000 = ms per day
  return Math.ceil(msLeft / 86400000); // ceil: signed up an hour ago still shows the full 7 (generous, never confusing!)
}

function trialActive(business) {
  const started = new Date(business.trial_started_at || business.created_at || Date.now()); // trial clock: explicit column → signup time → now (never crash on missing data)
  return Date.now() - started.getTime() < trialDays() * 24 * 60 * 60 * 1000; // elapsed ms < trial window in ms (days×24×60×60×1000)
}

function subscriptionActive(business) {
  if (business.subscription_status !== 'active') return false; // only 'active' counts (trialing/pending/expired don't)
  if (!business.subscription_expires) return true; // active with no expiry (e.g. lifetime) = forever
  return new Date(business.subscription_expires) > new Date(); // expiry in the future?
}

function isPro(business) {
  if (!business) return false; // null-safety: unknown business is never Pro
  if (subscriptionActive(business)) return true; // paid up → Pro, trial irrelevant
  // The 14-day trial IS the Pro trial.
  if (business.subscription_status === 'trialing' && trialActive(business)) return true; // BOTH conditions (status + clock)
  return false; // expired trial, pending transfer, or anything else → free
}

function tier(business) {
  return isPro(business) ? 'pro' : 'free'; // ternary: the two strings the whole app switches on (Plus counts as pro here — ads stay off for all paid!)
}

// STRICT tier: did this shop BUY Pro Plus (not trial, not Pro)?
// Trial users are Pro, never Plus — Plus perks need a real Plus purchase.
function isProPlus(business) {
  if (!business) return false; // null-safety like isPro
  if (!subscriptionActive(business)) return false; // expired/cancelled → free (trial falls through below, also not Plus)
  return String(business.plan_tier || 'pro').toLowerCase() === 'plus'; // only an explicit 'plus' purchase counts
}

// Effective tier for capability gates: plus > pro > free.
// Drives AI-model locks + voice transcription (Plus-only perks).
function effectiveTier(business) {
  if (isProPlus(business)) return 'plus';
  return tier(business); // 'pro' (paid or trial) | 'free'
}

// Auto-currency: +234 numbers bill in NGN, everything else in USD.
// ...numbers = rest parameter (collects ALL arguments into an array).
function resolveCurrency(...numbers) {
  const all = numbers.filter(Boolean).join(' '); // filter(Boolean) drops null/undefined/''; join into one searchable string
  if (/\+234/.test(all)) return 'NGN'; // regex .test = "does it contain +234?" (Nigerian numbers win even if mixed)
  if (/\+\d/.test(all)) return 'USD'; // any OTHER +country code → world pricing
  return 'NGN'; // no country code at all → default home market
}

module.exports = { isPro, isProPlus, tier, effectiveTier, trialActive, subscriptionActive, trialDays, trialDaysLeft, resolveCurrency }; // webhook, replyEngine, controllers all import from here
