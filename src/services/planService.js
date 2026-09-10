// ── src/services/planService.js ──────────────────────────────────
// WHAT: the Free-vs-Pro rulebook in ONE place (every caller asks here, so the
// rules can never disagree). Pure functions = no DB, no side effects, trivially
// testable. No npm modules — just Date math.
// RULES:
//   FREE (forever): manual catalog (dashboard + LEARN:), bot always replies.
//   PRO: paid subscription OR inside the 14-day trial → + profile sync,
//        premium AIs, no ads.

function trialDays() {
  return Number(process.env.TRIAL_DAYS || 14); // env override, default 14 (Number() because env vars are strings)
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
  return isPro(business) ? 'pro' : 'free'; // ternary: the two strings the whole app switches on
}

// Auto-currency: +234 numbers bill in NGN, everything else in USD.
// ...numbers = rest parameter (collects ALL arguments into an array).
function resolveCurrency(...numbers) {
  const all = numbers.filter(Boolean).join(' '); // filter(Boolean) drops null/undefined/''; join into one searchable string
  if (/\+234/.test(all)) return 'NGN'; // regex .test = "does it contain +234?" (Nigerian numbers win even if mixed)
  if (/\+\d/.test(all)) return 'USD'; // any OTHER +country code → world pricing
  return 'NGN'; // no country code at all → default home market
}

module.exports = { isPro, tier, trialActive, subscriptionActive, trialDays, resolveCurrency }; // webhook, replyEngine, controllers all import from here
