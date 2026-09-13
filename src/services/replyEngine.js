// ── src/services/replyEngine.js ──────────────────────────────────
// WHAT: the AI BRAIN — prompts + grounding + structured parsing.
// Transport (keys, timeouts, provider HTTP) lives in ./ai/client.js.
// Two jobs:
//   1. generateReply() — WhatsApp customer replies, STRICTLY grounded in the
//      shop's catalog (never invents prices; NEED_HUMAN flag when unsure).
//   2. askGeneral() — Vendora AI page: free-form assistant, no grounding.
// MODULES: ./productService (catalog), ./ai/client (transport).

const productService = require('./productService');
const client = require('./ai/client');

// Re-exported for /health + tests (single import point for callers).
const PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const configuredProviders = client.configuredProviders;

/**
 * Call a SPECIFIC catalog model first; if it fails, fall back to other
 * FREE models only — never silently spend money on a paid model.
 * Returns { text, via, fallback, requested } — via is ALWAYS the model that
 * actually answered, so the UI caption can never lie about the switch.
 */
async function callChoice(entry, model, system, user, image, opts) {
  const aiModels = require('./aiModels');
  const has = client.configuredProviders();
  // 1. The chosen model — exact catalog entry, exact model id (Gemini pinned,
  //    no chain, no affinity — the dropdown pick always takes effect).
  if (has[entry.provider]) {
    if (!(image && (entry.provider === 'groq' || entry.provider === 'openrouter'))) {
      const started = Date.now();
      try {
        const text = await client.callModel(entry, system, user, image, opts);
        console.log(
          `AI answered via ${entry.id} (${entry.provider}/${entry.model()}) in ${Date.now() - started}ms`
        );
        return { text, via: entry.label, modelId: entry.id, fallback: false };
      } catch (err) {
        console.error(`AI ${entry.id} failed:`, err.message);
      }
    }
  } else {
    console.error(`AI ${entry.id} skipped: no key for ${entry.provider}`);
  }
  // 2. Free fallback chain — each fallback uses its OWN model id.
  for (const fb of aiModels.CATALOG.filter(
    (m) => m.tier === 'free' && m.id !== entry.id
  )) {
    if (!has[fb.provider]) continue;
    if (image && (fb.provider === 'groq' || fb.provider === 'openrouter')) continue;
    const started = Date.now();
    try {
      const text = await client.callModel(fb, system, user, image, opts);
      console.log(`AI answered via fallback ${fb.id} in ${Date.now() - started}ms`);
      return { text, via: fb.label, modelId: fb.id, fallback: true, requested: entry.label };
    } catch (err) {
      console.error(`AI fallback ${fb.id} failed:`, err.message);
    }
  }
  throw new Error('All configured AIs failed — check keys and restart the server');
}

/**
 * General-purpose chat (Vendora AI page) — NOT grounded in any catalog.
 * Smart + thorough: full explanations with examples, not one-liners.
 * choiceId comes from the dropdown and is validated against the tier.
 */
async function askGeneral(message, history, choiceId, tier, bizName) {
  const aiModels = require('./aiModels');
  const shop = (bizName || '').split(' ')[0] || 'friend';
  const system = `You are Vendora AI, a smart, warm general-purpose assistant inside the Vendora app.

PERSONALITY: knowledgeable friend + sharp business coach. Friendly, respectful, encouraging. Greet warmly, always offer a concrete next step.

GREETINGS ("hey", "hi", "hello", "sup", "good morning", "how far", "abeg"): NEVER curt. Reply politely, use their shop name when known ("Hey ${shop}! 👋 Great to see you — what are we working on today?"). Match vibe: English → warm English; Pidgin → natural Pidgin ("Hey! I dey here for you — wetin I fit help you do today?"); Yoruba/Hausa/Igbo greetings → greet back, then follow their language lead.

SMALL TALK ("how are you?", "who are you?", "what can you do?"): answer warmly, say you are Vendora AI inside Vendora, list 4-5 real capabilities (write sales captions, business name ideas, pricing strategy, difficult-customer replies, product descriptions, marketing plans), end with one question to keep helping.

DEPTH (this is the important part): give COMPLETE, useful answers — explain the why, show steps, give concrete examples with numbers/names where it helps. A pricing question deserves a mini-framework with an example calculation, not two sentences. A caption request deserves 3 ready-to-post options, not advice about captions. Structure longer answers with short headings or numbered steps so they stay scannable. Aim for genuinely helpful over brief: up to ~500 words when the question deserves it; short only when the question is small.

FORMATTING: short paragraphs, simple lists for steps/options. No markdown tables (they break on WhatsApp-style bubbles).

VENDORA FACTS: Vendora is a WhatsApp AI sales assistant for small businesses (answers customers in English + Pidgin, 24/7, learns the catalog, hands off to a human when unsure).`;
  const transcript = (history || [])
    .slice(-12)
    .map((m) => `${m.from === 'you' ? 'User' : 'Vendora AI'}: ${m.text}`)
    .join('\n');
  const user = transcript ? `${transcript}\nUser: ${message}` : message;
  // Smart settings: warmer sampling for personality, roomy token budget so
  // answers are complete instead of cut off mid-thought.
  const chatOpts = { temperature: 0.8, maxTokens: 1200 };
  try {
    const resolved = aiModels.resolveChoice(choiceId, tier || 'free');
    if (resolved.error) return { reply: null, reason: resolved.error };
    const { text, via, modelId, fallback, requested } = await callChoice(
      resolved.entry,
      resolved.model,
      system,
      user,
      null,
      chatOpts
    );
    if (!text) return { reply: null, reason: 'Empty AI response' };
    return { reply: text, via, modelId, fallback, requested };
  } catch (err) {
    console.error('askGeneral error:', err.message);
    return { reply: null, reason: 'AI service unavailable' };
  }
}

/**
 * Generate a reply to a customer message using the business's catalog.
 * Returns { reply, needsHuman, reason? }.
 * Strictly grounded in the catalog + business info; NEED_HUMAN otherwise.
 * Pro businesses additionally ground in their synced WhatsApp Business profile.
 */
async function generateReply(customerMessage, business, image, history) {
  const planService = require('./planService');
  const pro = planService.isPro(business);
  const products = await productService.getProducts(business.id);
  const catalog = productService.formatCatalog(products);
  const tz = business.timezone || 'Africa/Lagos';
  let now;
  try {
    now = new Date().toLocaleString('en-GB', { timeZone: tz });
  } catch {
    now = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' });
  }
  const maxDisc = business.max_discount_pct || 0;
  const minOrder = business.min_order_naira || 0;
  const transcript = (history || [])
    .map((m) => `${m.direction === 'in' ? 'Customer' : 'You'}: ${m.body}`)
    .join('\n');

  const systemPrompt = `You are the automated WhatsApp sales assistant for ${business.name}.
You answer customer questions using ONLY the business information and product catalog below.
It is ${now} (business local time, ${tz}).

Business info:
- Name: ${business.name}
- Opening hours: ${business.hours || 'not provided'}
- Tone: ${business.tone || 'friendly and helpful'}

FAQ:
${(business.faq || []).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n') || '(none)'}

PRODUCT CATALOG (the single source of truth for products, prices, availability):
${catalog}
${pro && business.profile_snapshot ? `\nVERIFIED BUSINESS PROFILE (synced from the owner's WhatsApp Business profile — treat items here as confirmed available):\n${business.profile_snapshot}\n` : ''}
${transcript ? `\nRECENT CONVERSATION WITH THIS CUSTOMER (oldest first — use it for context, pronouns, and follow-up questions):\n${transcript}\n` : ''}

Rules:
1. LANGUAGE: Match the customer's language and style exactly. If they write in Pidgin
   ("abeg how much be dis one"), reply in natural Pidgin. If they mix Pidgin and English,
   mix naturally the same way. If formal English, reply formally. Never correct their language.
2. RECOMMEND: Recommend products from the catalog when a customer asks what you sell or wants
   something similar. Show the product name, price, and how to order it.
3. NEVER invent prices, products, availability, or delivery promises. Only use the catalog and FAQ.
4. BUSINESS HOURS: Compare the current time above against the opening hours. If the business
   is currently CLOSED, tell the customer warmly that they're closed, state when you next open
   (from the hours above), and still help with anything the catalog can answer (prices, product
   info). If the hours above don't state today's hours clearly, use your best judgment from them.
5. If the answer is not covered above (custom orders, complaints, negotiation,
   payment details, something not in the catalog), respond with exactly:
   NEED_HUMAN: <brief reason>
6. Keep replies short and WhatsApp-friendly (1-5 sentences, plain text, no markdown).
7. If a product the customer wants is out of stock, say so honestly and offer alternatives from the catalog.
8. PERSONAL CHIT-CHAT: if the message is purely social with zero buying signal (greetings alone, jokes, "lol", "where are you", memes, personal banter), do NOT pitch products — respond with exactly: NEED_HUMAN: personal chat, no sales intent. A friend saying hi must never get a sales pitch.
${maxDisc > 0 ? `9. SMARTDEAL NEGOTIATION: The owner allows you to offer up to ${maxDisc}% off${minOrder ? ` on orders worth at least ₦${minOrder.toLocaleString()}` : ''} ONLY when the customer hesitates, complains about price, or says it's too expensive AND they clearly want to buy. Offer it once, as a special one-time price — never volunteer discounts to happy customers, never exceed ${maxDisc}%. Phrase it like the owner is doing them a favour.` : '9. Do NOT offer any discounts — the owner has not enabled negotiation.'}
${image ? '10. The customer also sent a PHOTO. Look at it, describe briefly what you see, and match it to the closest product(s) in the catalog (replacement, matching item, or exact match). If nothing in the catalog matches, use NEED_HUMAN.' : ''}`;

  const userPrompt = `Customer message: "${customerMessage}"${image ? '\n(A photo is attached — analyze it.)' : ''}\n\nRespond per your rules.`;

  try {
    const text = await client.callAI(systemPrompt, userPrompt, image);
    if (text.startsWith('NEED_HUMAN')) {
      return { reply: null, needsHuman: true, reason: text.slice(11).trim() || 'Unsure how to answer' };
    }
    if (!text) {
      return { reply: null, needsHuman: true, reason: 'Empty AI response' };
    }
    return { reply: text, needsHuman: false };
  } catch (err) {
    console.error('replyEngine error:', err);
    return { reply: null, needsHuman: true, reason: 'AI service unavailable' };
  }
}

/**
 * INVENTORY intent parser: turns "sold 3 bags of rice" into a STRICT JSON
 * action. Returns update_inventory | clarify | none. Never guesses.
 */
const INVENTORY_HINT = /(sold|sell|restock|restocked|add|added|remove|removed|stock|inventory|update|received|supply|deliver|count|set|balance|remaining|left|out of|finished|used|damaged|spoiled|\+|-)/i;

async function parseInventoryAction(message, products) {
  if (!INVENTORY_HINT.test(message || '')) return { action: 'none' };
  const names = (products || []).map((p) => p.name).join(', ') || '(empty catalog)';
  const system = `You parse stock-update requests from a shop owner. Catalog products: ${names}.
Return ONLY one JSON object, no markdown, no explanation:
{"action": "update_inventory" | "clarify" | "none", "item": string or null, "quantity": number or null, "operation": "add" | "remove" | "set" or null, "question": string or null}
Verb map: sold/sell/used/removed/spoiled/damaged/finished/out of → "remove". restocked/added/received/bought/supplied/delivered/+N → "add". set/count/correction/is now/balance → "set".
Rules: item MUST match a catalog product (fuzzy ok: "rice" matches "Rice 20kg"). Quantity MUST be a positive number in the message. If EITHER is missing/unclear, or several products match → "clarify" with a short question naming the options. No inventory intent at all → "none".`;
  try {
    const text = await client.callAI(system, message, null);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { action: 'none' };
    const parsed = JSON.parse(match[0]);
    if (parsed.action === 'update_inventory') {
      if (typeof parsed.item !== 'string' || !parsed.item.trim())
        return { action: 'clarify', question: 'Which product should I update?' };
      const qty = Math.floor(Number(parsed.quantity));
      if (!Number.isFinite(qty) || qty <= 0)
        return { action: 'clarify', question: `How many units of ${parsed.item.trim()}?` };
      if (!['add', 'remove', 'set'].includes(parsed.operation))
        return { action: 'clarify', question: `Should I add to, remove from, or set the stock of ${parsed.item.trim()}?` };
      return { action: 'update_inventory', item: parsed.item.trim(), quantity: qty, operation: parsed.operation };
    }
    if (parsed.action === 'clarify')
      return { action: 'clarify', question: (typeof parsed.question === 'string' && parsed.question.trim()) || 'Which product and how many units?' };
    return { action: 'none' };
  } catch (err) {
    console.error('parseInventoryAction error:', err.message);
    return { action: 'none' };
  }
}

async function extractProducts(adText, business) {
  const system = `You extract structured product data from WhatsApp business ad posts.
Return ONLY a JSON array, no markdown, no explanation. Each item:
{"name": string, "price": string or null, "description": string or null}
Prices keep the currency as written (e.g. "₦5,000"). Product names short (max 8 words).
If the text contains no products, return [].`;

  try {
    const text = await client.callAI(system, adText);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { products: [], ok: false };
    const parsed = JSON.parse(match[0]);
    const clean = parsed.filter(
      (p) => p && typeof p.name === 'string' && p.name.trim()
    );
    return { products: clean, ok: true };
  } catch (err) {
    console.error('extractProducts error:', err);
    return { products: [], ok: false };
  }
}

module.exports = {
  generateReply,
  extractProducts,
  askGeneral,
  callChoice,
  parseInventoryAction,
  INVENTORY_HINT,
  PROVIDER,
  configuredProviders,
  __groqSlot: client.groqSlot,
};
