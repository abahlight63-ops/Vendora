// ── src/services/aiModels.js ─────────────────────────────────────
// WHAT: the VeloSales Ai dropdown menu, as DATA (not code branches). Each entry:
// id (stable key the frontend sends), label (pretty name), provider (which
// replyEngine caller runs it), tier (free = $0 quotas / paid = billed to YOUR
// key → Pro-gated), badge (Fast/Smart/Reasoning/Premium grouping for the UI).
// Model ids stay env-overridable: a retired model name is a .env edit, never
// a deploy. No npm modules — pure data + two functions.

/**
 * AI model catalog for the VeloSales Ai dropdown.
 * - tier 'free': costs the owner nothing (free-tier provider quotas).
 * - tier 'paid': billed per reply to the OWNER's key — gated server-side by
 *   minTier ('pro' = any paid plan incl. trial? NO — trial counts as pro, so
 *   'pro' models open during trial; 'plus' = bought Pro Plus only).
 * - badge: UI grouping (Fast = speed kings, Smart = best quality, Reasoning =
 *   thinks step-by-step, Premium = paid crown jewels).
 * - RULE: one API key per provider, 2 models max per key (keeps every key
 *   under its rate limit so nothing shows "busy").
 * Model IDs stay env-overridable so a retired model name never needs a code change.
 */
const CATALOG = [
  // Order = the backup chain: when a model fails or is busy, the next free one answers.
  // Chosen on 4 Nov 2026 from a 30-question test (English, Pidgin, prices, hand-offs)
  // on the real reply engine. Model names stay env-overridable.
  { id: 'velo-normal', label: 'Velo Normal', provider: 'gemini', tier: 'free', badge: 'Smart', desc: 'Best everyday answers, reads photos · Gemini Flash-Lite (30/30 in tests)',
    model: () => (process.env.VELO_NORMAL_MODEL || process.env.GEMINI_LITE_MODEL || 'gemini-3.5-flash-lite').trim() },
  { id: 'velo-steady', label: 'Velo Steady', provider: 'groq', tier: 'free', badge: 'Smart', desc: 'Careful answers · GPT-OSS 120B',
    model: () => (process.env.VELO_STEADY_MODEL || 'openai/gpt-oss-120b').trim() },
  { id: 'velo-fast', label: 'Velo Fast', provider: 'groq', tier: 'free', badge: 'Fast', desc: 'Quick and cheapest · GPT-OSS 20B',
    model: () => (process.env.VELO_FAST_MODEL || 'openai/gpt-oss-20b').trim() },
  { id: 'velo-quick', label: 'Velo Quick', provider: 'groq', tier: 'free', badge: 'Fast', desc: 'Fastest replies · Qwen',
    model: () => (process.env.VELO_QUICK_MODEL || 'qwen/qwen3.8-27b').trim() },
  { id: 'velo-backup', label: 'Velo Backup', provider: 'openrouter', tier: 'free', badge: 'Smart', desc: 'Low-cost backup · Qwen Flash',
    model: () => (process.env.VELO_BACKUP_MODEL || 'qwen/qwen3.7-flash').trim() },
  // Pro plan's "Smart" choice (stored key 'plus' = shown "Pro").
  { id: 'velo-smart', label: 'Velo Smart', provider: 'gemini', tier: 'paid', minTier: 'plus', badge: 'Premium', desc: 'Deepest answers · Gemini Flash · Pro',
    model: () => (process.env.VELO_SMART_MODEL || 'gemini-3.5-flash').trim() },
];

// Old ids (saved in shops, the web app's fallbacks and the phone app) → their replacement.
const ALIASES = {
  'gemini-flash': 'velo-fast', 'gemini-flash-full': 'velo-normal', 'gpt-oss-20b': 'velo-fast', 'llama-70b': 'velo-steady', 'velo-vision': 'velo-normal',
  'tokenrouter-free': 'velo-fast', 'tokenrouter-free-2': 'velo-normal', 'sambanova-70b': 'velo-steady', 'sambanova-120b': 'velo-steady',
  'pollinations': 'velo-backup', 'kimi-k2': 'velo-smart', 'claude-haiku': 'velo-smart', 'claude-haiku-2': 'velo-smart', 'gpt-mini': 'velo-smart', 'gpt-mini-2': 'velo-smart',
};
function get(id) {
  const key = ALIASES[id] || id;
  return CATALOG.find((m) => m.id === key) || null; // .find returns first match or undefined → normalize to null
}

// Capability levels: free < pro < plus. A model opens when the caller's level
// meets its floor (free entries have no floor — open to everyone).
const LEVELS = { free: 0, pro: 1, plus: 2 };
function levelOf(tier) {
  return LEVELS[String(tier || 'free').toLowerCase()] ?? 0; // ?? 0: unknown strings (legacy callers) = free
}

// What the dropdown shows. Paid models carry locked:true below their floor.
function listForTier(tier) {
  const lv = levelOf(tier); // 'plus' unlocks everything; 'pro' unlocks the pro floor; 'free' locks all paid
  return CATALOG.map((m) => ({ // .map transforms each entry into a SAFE subset (model IDs stay server-side!)
    id: m.id, label: m.label, provider: m.provider, tier: m.tier, badge: m.badge, desc: m.desc,
    minTier: m.minTier || (m.tier === 'paid' ? 'pro' : 'free'), // exposed so the UI can say "Plus" vs "Pro" on the lock!
    locked: m.tier === 'paid' && lv < levelOf(m.minTier || 'pro'), // locked = caller below the floor (frontend shows lock + glass upsell; backend ALSO enforces in resolveChoice)
  }));
}

// Validate a user's choice server-side. Never trust the client.
function resolveChoice(id, tier) {
  const entry = get(id || 'velo-normal'); // empty choice = the everyday default
  if (!entry) return { error: 'Unknown AI. Pick one from the list.' }; // tampered id → friendly error (402 in controller)
  const need = entry.minTier || (entry.tier === 'paid' ? 'pro' : 'free'); // floor for this model (paid without minTier = pro, legacy-safe)
  if (levelOf(tier) < levelOf(need)) {
    return need === 'plus'
      ? { error: 'Velo Smart comes with the Pro plan. Upgrade to unlock it. The other choices stay free.', upsell: entry.id } // heavy work models (Kimi, GPT-mini)
      : { error: 'That AI is Pro-only. Upgrade to unlock it — free AIs stay free.', upsell: entry.id }; // upsell id tells frontend WHICH premium modal to show (Kimi gets the crown treatment!)
  }
  return { entry, model: entry.model() }; // success: entry (provider+label) + resolved model id string
}

module.exports = { CATALOG, ALIASES, get, listForTier, resolveChoice }; // replyEngine + ownerController import these
