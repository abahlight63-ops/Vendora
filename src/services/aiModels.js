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
// HOW THE MODELS ARE ORGANISED: one API key per company, two models per key.
// Each model name is one line in .env (GEMINI_MODEL_1, GROQ_MODEL_2…), so a
// retired model is a .env edit, never a code change. A company with no key is
// skipped automatically. Order below = the backup order for free models.
const PREMIUM_ON = () => String(process.env.PREMIUM_AI || 'off').toLowerCase() === 'on';
const CATALOG_ALL = [
  // ── Free for every shop: Gemini (key 1) ──
  { id: 'velo-normal', label: 'Velo Normal', provider: 'gemini', tier: 'free', badge: 'Smart', desc: 'Best everyday answers, reads photos',
    model: () => (process.env.GEMINI_MODEL_1 || 'gemini-3.5-flash-lite').trim() },
  // ── Free: Groq (key 2) ──
  { id: 'velo-steady', label: 'Velo Steady', provider: 'groq', tier: 'free', badge: 'Smart', desc: 'Careful answers',
    model: () => (process.env.GROQ_MODEL_1 || 'openai/gpt-oss-120b').trim() },
  { id: 'velo-fast', label: 'Velo Fast', provider: 'groq', tier: 'free', badge: 'Fast', desc: 'Quickest answers',
    model: () => (process.env.GROQ_MODEL_2 || 'openai/gpt-oss-20b').trim() },
  { id: 'velo-smart', label: 'Velo Sharp', provider: 'gemini', tier: 'free', badge: 'Smart', desc: 'Deeper answers, a little slower, reads photos',
    model: () => (process.env.GEMINI_MODEL_2 || 'gemini-3.5-flash').trim() },
  // ── Free: SambaNova (key 3). Confirm the names with its /models list once the key is added ──
  { id: 'velo-samba', label: 'Velo Extra', provider: 'sambanova', tier: 'free', badge: 'Smart', desc: 'Extra free backup',
    model: () => (process.env.SAMBANOVA_MODEL_1 || 'gpt-oss-120b').trim() },
  { id: 'velo-samba-2', label: 'Velo Extra 2', provider: 'sambanova', tier: 'free', badge: 'Fast', desc: 'Extra free backup',
    model: () => (process.env.SAMBANOVA_MODEL_2 || 'DeepSeek-V3.1').trim() },
  // ── Plus plan and up (stored key pro): OpenRouter (key 4), cheap paid models ──
  { id: 'velo-pro', label: 'Velo Pro', provider: 'openrouter', tier: 'paid', minTier: 'pro', badge: 'Premium', desc: 'Strong answers · Plus plan and up',
    model: () => (process.env.OPENROUTER_MODEL_1 || 'deepseek/deepseek-v4.1-flash').trim() },
  { id: 'velo-pro-2', label: 'Velo Pro Quick', provider: 'openrouter', tier: 'paid', minTier: 'pro', badge: 'Premium', desc: 'Fast strong answers · Plus plan and up',
    model: () => (process.env.OPENROUTER_MODEL_2 || 'qwen/qwen3.7-flash').trim() },
  // ── Pro and Business (stored key plus and up), later: ChatGPT, Claude, Kimi. Hidden until PREMIUM_AI=on ──
  { id: 'velo-premium-claude', label: 'Velo Premium (Claude)', provider: 'claude', tier: 'paid', minTier: 'plus', badge: 'Premium', premium: true, desc: 'Top quality · Pro plan',
    model: () => (process.env.CLAUDE_MODEL || 'claude-haiku-5-5').trim() },
  { id: 'velo-premium-gpt', label: 'Velo Premium (ChatGPT)', provider: 'openai', tier: 'paid', minTier: 'plus', badge: 'Premium', premium: true, desc: 'Top quality · Pro plan',
    model: () => (process.env.OPENAI_MODEL || 'gpt-5-mini').trim() },
  { id: 'velo-premium-kimi', label: 'Velo Premium (Kimi)', provider: 'openrouter', tier: 'paid', minTier: 'plus', badge: 'Premium', premium: true, desc: 'Top quality · Pro plan',
    model: () => (process.env.KIMI_MODEL || 'moonshotai/kimi-k2').trim() },
];
// The premium pair is invisible (and cannot be picked) until PREMIUM_AI=on.
const CATALOG = new Proxy(CATALOG_ALL, { get: (t, k) => { const live = t.filter((m) => !m.premium || PREMIUM_ON()); const v = live[k]; return typeof v === 'function' ? v.bind(live) : v; } });

// Old ids (saved in shops, the web app's fallbacks and the phone app) → their replacement.
const ALIASES = {
  'gemini-flash': 'velo-fast', 'gemini-flash-full': 'velo-normal', 'gpt-oss-20b': 'velo-fast', 'llama-70b': 'velo-steady', 'velo-vision': 'velo-normal',
  'tokenrouter-free': 'velo-fast', 'tokenrouter-free-2': 'velo-normal', 'sambanova-70b': 'velo-samba', 'sambanova-120b': 'velo-samba',
  'pollinations': 'velo-normal', 'velo-quick': 'velo-fast', 'velo-backup': 'velo-normal',
  'kimi-k2': 'velo-pro', 'claude-haiku': 'velo-pro', 'claude-haiku-2': 'velo-pro', 'gpt-mini': 'velo-pro', 'gpt-mini-2': 'velo-pro',
};
function get(id) {
  const key = ALIASES[id] || id;
  return CATALOG.find((m) => m.id === key) || null; // .find returns first match or undefined → normalize to null
}

// Capability levels: free < pro < plus. A model opens when the caller's level
// meets its floor (free entries have no floor — open to everyone).
const LEVELS = { free: 0, pro: 1, plus: 2, business: 3 }; // stored keys: pro = shown Plus, plus = shown Pro
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
      ? { error: 'That one comes with the Pro plan. Upgrade to unlock it. The other choices stay free.', upsell: entry.id } // heavy work models (Kimi, GPT-mini)
      : { error: 'That AI is Pro-only. Upgrade to unlock it — free AIs stay free.', upsell: entry.id }; // upsell id tells frontend WHICH premium modal to show (Kimi gets the crown treatment!)
  }
  return { entry, model: entry.model() }; // success: entry (provider+label) + resolved model id string
}

module.exports = { CATALOG, ALIASES, get, listForTier, resolveChoice }; // replyEngine + ownerController import these
