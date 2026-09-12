// ── src/services/aiModels.js ─────────────────────────────────────
// WHAT: the Vendora AI dropdown menu, as DATA (not code branches). Each entry:
// id (stable key the frontend sends), label (pretty name), provider (which
// replyEngine caller runs it), tier (free = $0 quotas / paid = billed to YOUR
// key → Pro-gated), badge (Fast/Smart/Reasoning/Premium grouping for the UI).
// Model ids stay env-overridable: a retired model name is a .env edit, never
// a deploy. No npm modules — pure data + two functions.

/**
 * AI model catalog for the Vendora AI dropdown.
 * - tier 'free': costs the owner nothing (free-tier provider quotas).
 * - tier 'paid': billed per reply to the OWNER's key — Pro-gated server-side.
 * - badge: UI grouping (Fast = speed kings, Smart = best quality, Reasoning =
 *   thinks step-by-step, Premium = paid crown jewels).
 * Model IDs stay env-overridable so a retired model name never needs a code change.
 */
const CATALOG = [
  { id: 'gemini-flash', label: 'Gemini Flash', provider: 'gemini', tier: 'free', badge: 'Fast', // default choice (id used when frontend sends nothing)
    model: () => (process.env.GEMINI_MODELS || 'gemini-2.5-flash').split(',')[0].trim() }, // model: is a FUNCTION (lazy — reads env at call time, so restarts pick up edits; first of the Gemini chain)
  { id: 'llama-8b', label: 'Llama 3.1 8B', provider: 'groq', tier: 'free', badge: 'Fast', // speed king + highest free limits (14,400 req/day on Groq free!)
    model: () => process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant' },
  { id: 'llama-70b', label: 'Llama 3.3 70B', provider: 'groq', tier: 'free', badge: 'Smart', // best quality free (Meta, via Groq's fast chips)
    model: () => process.env.GROQ_LLAMA_MODEL || 'llama-3.3-70b-versatile' },
  { id: 'llama-scout', label: 'Llama 4 Scout', provider: 'groq', tier: 'free', badge: 'Smart', // huge context (long chats/catalogs without forgetting!)
    model: () => process.env.GROQ_SCOUT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { id: 'gpt-oss-20b', label: 'GPT-OSS 20B', provider: 'groq', tier: 'free', badge: 'Smart', // OpenAI open-weight at 1000 tok/s (great fallback!)
    model: () => process.env.GROQ_OSS_MODEL || 'openai/gpt-oss-20b' },
  { id: 'deepseek', label: 'DeepSeek R1', provider: 'groq', tier: 'free', badge: 'Reasoning', // thinks step-by-step (slower, smarter — verify hosted before depending!)
    model: () => process.env.GROQ_DEEPSEEK_MODEL || 'deepseek-r1-distill-llama-70b' },
  { id: 'qwen-32b', label: 'Qwen3 32B', provider: 'groq', tier: 'free', badge: 'Reasoning', // Alibaba spare (multilingual strength!)
    model: () => process.env.GROQ_QWEN_MODEL || 'qwen/qwen3-32b' },
  { id: 'openrouter-free', label: 'OpenRouter Free', provider: 'openrouter', tier: 'free', badge: 'Smart', // 400+ models gateway, :free suffix = $0 ones
    model: () => process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free' },
  { id: 'kimi-k2', label: 'Kimi K2', provider: 'groq', tier: 'paid', badge: 'Premium', // THE crown jewel (Moonshot, agentic tasks — Pro-only, upsell modal on tap!)
    model: () => process.env.GROQ_KIMI_MODEL || 'moonshotai/kimi-k2-instruct' },
  { id: 'claude-haiku', label: 'Claude Haiku', provider: 'claude', tier: 'paid', badge: 'Premium', // cheapest Anthropic model (~$0.25/1M tokens)
    model: () => process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022' },
  { id: 'gpt-mini', label: 'GPT-4o mini', provider: 'openai', tier: 'paid', badge: 'Premium', // cheapest OpenAI model
    model: () => process.env.OPENAI_MODEL || 'gpt-4o-mini' },
];

function get(id) {
  return CATALOG.find((m) => m.id === id) || null; // .find returns first match or undefined → normalize to null
}

// What the dropdown shows. Paid models carry locked:true for free-tier users.
function listForTier(tier) {
  return CATALOG.map((m) => ({ // .map transforms each entry into a SAFE subset (model IDs stay server-side!)
    id: m.id, label: m.label, provider: m.provider, tier: m.tier, badge: m.badge,
    locked: m.tier === 'paid' && tier !== 'pro', // locked = paid AND user isn't pro (frontend shows 🔒 + glass upsell; backend ALSO enforces in resolveChoice)
  }));
}

// Validate a user's choice server-side. Never trust the client.
function resolveChoice(id, tier) {
  const entry = get(id || 'gemini-flash'); // || default: empty choice = Gemini Flash
  if (!entry) return { error: 'Unknown AI. Pick one from the list.' }; // tampered id → friendly error (402 in controller)
  if (entry.tier === 'paid' && tier !== 'pro') {
    return { error: 'That AI is Pro-only. Upgrade to unlock it — free AIs stay free.', upsell: entry.id }; // upsell id tells frontend WHICH premium modal to show (Kimi gets the crown treatment!)
  }
  return { entry, model: entry.model() }; // success: entry (provider+label) + resolved model id string
}

module.exports = { CATALOG, get, listForTier, resolveChoice }; // replyEngine + ownerController import these
