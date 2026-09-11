// ── src/services/actions/registry.js ─────────────────────────────────
// WHAT: the action registry — EVERY agentic capability registers here with its
// tier + handler. The webhook dispatcher looks actions up by NAME, so adding
// supplier reorder drafts or auto-invoicing later = ONE new file + ONE line,
// zero changes to dispatcher, webhook, or gating. (Open/Closed principle!)
// SHAPE: { [actionName]: { tier: 'paid'|'free', describe: 'one-liner', run } }
// No npm modules — pure JS object + planService for gating.
const planService = require('../planService'); // isPro() — the paywall check

const ACTIONS = {
  // update_inventory(item, quantity, operation): the FIRST action (live now!).
  // Lazy require (inside getter) avoids circulars: handlers require services.
  update_inventory: {
    tier: 'paid', // Pro-only (free tier keeps Q&A — enforced in dispatch AND webhook!)
    describe: 'Adjust stock: add | remove | set a product quantity (audited).',
    get run() { return require('./updateInventory').updateInventory; }, // getter = loaded on first USE, not at boot (fast startup + no cycle risk!)
  },
  // FUTURE slots (uncomment + implement to ship — dispatcher needs NO changes!):
  // supplier_reorder: { tier: 'paid', describe: 'Draft supplier reorder WhatsApps for low stock.', get run() { return require('./supplierReorder').supplierReorder; } },
  // create_invoice:   { tier: 'paid', describe: 'Reconcile a chat into a sales log/invoice.', get run() { return require('./createInvoice').createInvoice; } },
};

function getAction(name) {
  return ACTIONS[name] || null; // unknown action → null (dispatcher treats as "not an action" — safe default!)
}

function listActions() {
  return Object.entries(ACTIONS).map(([name, a]) => ({ name, tier: a.tier, describe: a.describe })); // for future /admin or docs endpoints (no handler leak — describe only!)
}

// Gate: may THIS business run THIS action? (Free + paid action → false + pitch.)
function canRun(business, name) {
  const action = getAction(name); // unknown → no…
  if (!action) return { ok: false, reason: 'unknown' };
  if (action.tier === 'paid' && !planService.isPro(business)) return { ok: false, reason: 'pro' }; // paid action + free business → upgrade pitch (trial counts as Pro — planService decides!)
  return { ok: true, action }; // allowed → hand back the entry (dispatcher calls .run next!)
}

module.exports = { ACTIONS, getAction, listActions, canRun }; // dispatcher (webhookController) imports these three
