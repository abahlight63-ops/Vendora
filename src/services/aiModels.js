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
  { id: 'gemini-flash', label: 'Gemini Flash Lite', provider: 'gemini', tier: 'free', badge: 'Fast', desc: 'Google · fastest + cheapest, brief answers', // speed pick (id used when frontend sends nothing)
    model: () => (process.env.GEMINI_LITE_MODEL || 'gemini-2.5-flash-lite').trim() }, // pinned lite; set GEMINI_LITE_MODEL=gemini-3.5-flash-lite once Google ships that name — no deploy needed
  { id: 'gemini-flash-full', label: 'Gemini Flash (full)', provider: 'gemini', tier: 'free', badge: 'Smart', desc: 'Google · fuller answers (default), still free',
    model: () => (process.env.GEMINI_FULL_MODEL || 'gemini-2.5-flash').trim() },
  { id: 'llama-8b', label: 'Llama 3.1 8B', provider: 'groq', tier: 'free', badge: 'Fast', desc: 'Meta via Groq · speed king', // Groq model 1 of 2 (one GROQ_API_KEY, two models max)
    model: () => process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant' },
  { id: 'llama-70b', label: 'Llama 3.3 70B', provider: 'groq', tier: 'free', badge: 'Smart', desc: 'Meta via Groq · best free quality', // Groq model 2 of 2
    model: () => process.env.GROQ_LLAMA_MODEL || 'llama-3.3-70b-versatile' },
  { id: 'openrouter-free', label: 'OpenRouter Free', provider: 'openrouter', tier: 'free', badge: 'Smart', desc: 'Gateway · 400+ free models', // OpenRouter model 1 of 2 (:free suffix = $0 ones)
    model: () => process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free' },
  { id: 'openrouter-free-2', label: 'OpenRouter 70B', provider: 'openrouter', tier: 'free', badge: 'Smart', desc: 'Gateway · bigger free model', // OpenRouter model 2 of 2
    model: () => process.env.OPENROUTER_MODEL_2 || 'meta-llama/llama-3.3-70b-instruct:free' },
  { id: 'kimi-k2', label: 'Kimi K2', provider: 'groq', tier: 'paid', minTier: 'plus', badge: 'Premium', desc: 'Moonshot · agentic tasks · Pro Plus', // Plus-only, rarely used — rides the same GROQ_API_KEY without hammering free quota
    model: () => process.env.GROQ_KIMI_MODEL || 'moonshotai/kimi-k2-instruct' },
  { id: 'claude-haiku', label: 'Claude Haiku', provider: 'claude', tier: 'paid', badge: 'Premium', desc: 'Anthropic · cheapest & careful', // Anthropic cheap model 1 of 2 (~$0.25/1M tokens)
    model: () => process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022' },
  { id: 'claude-haiku-2', label: 'Claude Haiku 3', provider: 'claude', tier: 'paid', badge: 'Premium', desc: 'Anthropic · cheap classic Haiku', // Anthropic cheap model 2 of 2
    model: () => process.env.CLAUDE_MODEL_2 || 'claude-3-haiku-20240307' },
  { id: 'gpt-mini', label: 'GPT-4o mini', provider: 'openai', tier: 'paid', minTier: 'plus', badge: 'Premium', desc: 'OpenAI · cheapest GPT · Pro Plus', // OpenAI cheap model 1 of 2 — Plus-only heavy work model
    model: () => process.env.OPENAI_MODEL || 'gpt-4o-mini' },
  { id: 'gpt-mini-2', label: 'GPT-4.1 mini', provider: 'openai', tier: 'paid', minTier: 'plus', badge: 'Premium', desc: 'OpenAI · newer cheap GPT · Pro Plus', // OpenAI cheap model 2 of 2
    model: () => process.env.OPENAI_MODEL_2 || 'gpt-4.1-mini' },
];

function get(id) {
  return CATALOG.find((m) => m.id === id) || null; // .find returns first match or undefined → normalize to null
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
  const entry = get(id || 'gemini-flash'); // || default: empty choice = Gemini Flash
  if (!entry) return { error: 'Unknown AI. Pick one from the list.' }; // tampered id → friendly error (402 in controller)
  const need = entry.minTier || (entry.tier === 'paid' ? 'pro' : 'free'); // floor for this model (paid without minTier = pro, legacy-safe)
  if (levelOf(tier) < levelOf(need)) {
    return need === 'plus'
      ? { error: 'That AI is Pro Plus-only. Upgrade to Pro Plus to unlock it — free AIs stay free.', upsell: entry.id } // heavy work models (Kimi, GPT-mini)
      : { error: 'That AI is Pro-only. Upgrade to unlock it — free AIs stay free.', upsell: entry.id }; // upsell id tells frontend WHICH premium modal to show (Kimi gets the crown treatment!)
  }
  return { entry, model: entry.model() }; // success: entry (provider+label) + resolved model id string
}

module.exports = { CATALOG, get, listForTier, resolveChoice }; // replyEngine + ownerController import these
