// ── src/services/replyEngine.js ──────────────────────────────────
// WHAT: the AI brain. Two jobs + one engine:
//   1. generateReply() — WhatsApp customer replies, STRICTLY grounded in the
//      shop's catalog (never invents prices; NEED_HUMAN flag when unsure).
//   2. askGeneral() — Vendora AI page: free-form assistant, no grounding.
//   Engine: callAI() tries AI_PROVIDER first, then every other configured
//   provider (Gemini → Groq → OpenRouter → Claude → OpenAI). callChoice() does
//   the same for a SPECIFIC dropdown model, falling back to FREE models only.
// MODULES: none installed for AI! All providers are called with global `fetch`
// (Node 18+ built-in HTTP). No langchain, no SDKs — just POST JSON, read JSON.
// That keeps `npm install` tiny and every provider swappable.
const productService = require('./productService'); // getProducts() + formatCatalog()

// Which provider goes FIRST (the rest are automatic fallbacks). Lowercased for safety.
const PROVIDER = (process.env.AI_PROVIDER || 'claude').toLowerCase();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022'; // cheap Claude default
// gemini-2.5-flash is the live free-tier model (verified 2026-09-10).
// gemini-3-flash does not exist, gemini-2.0-flash was retired June 2026.
const GEMINI_MODELS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-flash-lite-latest')
  .split(',').map((m) => m.trim()).filter(Boolean); // "a, b, c" → ['a','b','c'] (env override without code change)

/**
 * Provider-agnostic AI call. Returns plain text.
 * Speed: remembers the first working Gemini model (model affinity) so later
 * calls skip the slow fallback chain; every attempt has a hard timeout.
 */
let fastModel = null; // module-level memory: the Gemini model that worked last time
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 25000); // env override, default 25s

// fetch() with a hard deadline: AbortController cancels the request on timeout.
async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController(); // controller whose signal can abort the fetch…
  const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS); // …fires after the timeout (abort → fetch throws)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal }); // spread keeps caller's opts, adds our signal
  } finally {
    clearTimeout(t); // finally ALWAYS runs: cancel the timer so it can't fire late
  }
}

// A key counts only if it looks real — example placeholders are skipped.
function validKey(v) {
  return typeof v === 'string' && v.trim().length > 15 && !v.includes('...') && !v.includes('xxxxx'); // rejects 'sk-ant-...', 'sk_test_xxxxx', empties
}

// Which providers have REAL keys right now (used by fallback + /health display).
function configuredProviders() {
  return {
    gemini: validKey(process.env.GEMINI_API_KEY),
    claude: validKey(process.env.ANTHROPIC_API_KEY),
    groq: validKey(process.env.GROQ_API_KEY),
    openrouter: validKey(process.env.OPENROUTER_API_KEY),
    openai: validKey(process.env.OPENAI_API_KEY),
  };
}

// ── Individual provider callers (each: build request → POST → parse text) ──
async function callGemini(system, user, image) {
  {
    const key = process.env.GEMINI_API_KEY;
    if (!validKey(key)) throw new Error('GEMINI_API_KEY is not set'); // throw = caught by callAI/callChoice fallback
    const parts = [{ text: user }]; // Gemini "parts" array: text always…
    if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } }); // …plus base64 photo for vision
    const body = JSON.stringify({ // Gemini REST shape: systemInstruction + contents + generationConfig
      systemInstruction: { parts: [{ text: system }] }, // the "who you are" prompt
      contents: [{ role: 'user', parts }], // the conversation (single turn here)
      generationConfig: { temperature: 0.3, maxOutputTokens: 350 }, // 0.3 = factual, not creative; 350 caps cost/speed
    });
    // Model affinity: the model that worked last time goes first.
    const ordered = fastModel ? [fastModel, ...GEMINI_MODELS.filter((m) => m !== fastModel)] : GEMINI_MODELS; // winner first, rest after (no duplicates)
    // Try models in order — falls back automatically if a model name isn't available
    let lastErr; // remembers the latest failure for the final throw
    for (const model of ordered) { // for...of with await = tries run SEQUENTIALLY (needed: stop on first success)
      const started = Date.now(); // for the speed log line
      let res; // declared outside try so the code below can use it
      try {
        res = await fetchWithTimeout( // POST to this model's :generateContent endpoint (?key= auth)
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          { method: 'POST', headers: { 'content-type': 'application/json' }, body }
        );
      } catch (e) {
        lastErr = `Gemini ${model} network/timeout: ${e.message}`;
        console.error(lastErr); // timeouts logged with the model name (debugging gold)
        continue; // timeout → try next model (don't break — others may work)
      }
      if (res.ok) { // HTTP 200 = success
        fastModel = model; // remember the winner (affinity for next call)
        const data = await res.json(); // parse Gemini's JSON…
        return (data.candidates?.[0]?.content?.parts || []) // ?. = optional chaining (missing keys → undefined, not crash)
          .map((p) => p.text) // each part → its text…
          .join('') // …glued together…
          .trim(); // …whitespace trimmed. return EXITS the function (no more models tried)
      }
      lastErr = `Gemini ${model} error ${res.status} (${Date.now() - started}ms): ${(await res.text()).slice(0, 200)}`; // status + ms + first 200 chars of Google's error
      console.error(lastErr);
      // 404/400 = model not available on this key → try the next one; other errors → stop
      if (res.status !== 404 && res.status !== 400) break; // 429/500 = key/quota problem: retrying siblings won't help
    }
    throw new Error(lastErr || 'All Gemini models failed'); // all tried → throw so the PROVIDER fallback continues
  }
}

async function callClaude(system, user, image, modelOverride) {
  // default: claude
  const key = process.env.ANTHROPIC_API_KEY;
  if (!validKey(key)) throw new Error('ANTHROPIC_API_KEY is not set');
  const content = [{ type: 'text', text: user }]; // Claude blocks: text always…
  if (image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.base64 } }); // …plus base64 photo block for vision
  }
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', { // Anthropic messages endpoint
    method: 'POST',
    headers: {
      'x-api-key': key, // Claude uses x-api-key header (not Bearer)
      'anthropic-version': '2023-06-01', // API version pin (required header)
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelOverride || CLAUDE_MODEL, // dropdown choice wins, else env default
      max_tokens: 350, // cap reply length (cost + WhatsApp-friendly)
      system, // shorthand: { system: system } — the system prompt
      messages: [{ role: 'user', content }], // one user turn with the blocks above
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content || []) // Claude returns content BLOCKS (text, tool_use…)
    .filter((c) => c.type === 'text') // keep only text blocks…
    .map((c) => c.text) // …extract text…
    .join('\n') // …join with newlines…
    .trim();
}

// Groq + OpenRouter speak the same OpenAI-style chat format.
async function callOpenAICompat(name, url, key, model, system, user, extraHeaders) {
  // ONE shared function for Groq, OpenAI and OpenRouter (they all speak OpenAI's API).
  const started = Date.now(); // for the speed log
  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json', ...(extraHeaders || {}) }, // Bearer auth + any provider extras (OpenRouter needs Referer/Title)
      body: JSON.stringify({
        model, // shorthand — the model id string
        temperature: 0.3, // factual, consistent replies
        max_tokens: 350, // cap length
        messages: [
          { role: 'system', content: system }, // OpenAI style: system is a MESSAGE, not a field
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (e) {
    throw new Error(`${name} network/timeout: ${e.message}`); // wrap with provider name for clear logs
  }
  if (!res.ok) throw new Error(`${name} error ${res.status} (${Date.now() - started}ms): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || '').trim(); // OpenAI shape: choices[0].message.content
  if (!text) throw new Error(`${name} returned an empty reply`);
  return text;
}

async function callGroq(system, user, modelOverride) {
  const key = process.env.GROQ_API_KEY;
  if (!validKey(key)) throw new Error('GROQ_API_KEY is not set');
  const model = modelOverride || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'; // dropdown > env > default
  return callOpenAICompat('Groq', 'https://api.groq.com/openai/v1/chat/completions', key, model, system, user); // Groq hosts an OpenAI-compatible endpoint (that's why no SDK needed)
}

async function callOpenAI(system, user, modelOverride) {
  const key = process.env.OPENAI_API_KEY;
  if (!validKey(key)) throw new Error('OPENAI_API_KEY is not set');
  const model = modelOverride || process.env.OPENAI_MODEL || 'gpt-4o-mini'; // cheapest OpenAI default
  return callOpenAICompat('OpenAI', 'https://api.openai.com/v1/chat/completions', key, model, system, user);
}

async function callOpenRouter(system, user, modelOverride) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!validKey(key)) throw new Error('OPENROUTER_API_KEY is not set');
  const model = modelOverride || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free'; // :free = $0 models
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  return callOpenAICompat('OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', key, model, system, user, {
    'HTTP-Referer': base, // OpenRouter REQUIRES a referer (shows your app on their leaderboard)
    'X-Title': 'Vendora', // your app name on their dashboard
  });
}

/**
 * Provider-agnostic AI call with automatic fallback.
 * Tries AI_PROVIDER first, then every other configured provider
 * (Groq → OpenRouter → Gemini → Claude). Photo messages only go to
 * providers that support images (Gemini, Claude).
 * Returns plain text.
 */
async function callAI(system, user, image) {
  const has = configuredProviders(); // {gemini:true, groq:false…} — skip unconfigured
  const order = [PROVIDER, 'groq', 'openrouter', 'gemini', 'claude', 'openai'].filter((p, i, a) => a.indexOf(p) === i); // primary first, then rest; filter dedupes (indexOf finds FIRST occurrence, keep only those)
  const runners = { // name → thunk (a () => … wrapper so NOTHING runs until we call it)
    gemini: () => callGemini(system, user, image),
    claude: () => callClaude(system, user, image),
    groq: () => callGroq(system, user),
    openrouter: () => callOpenRouter(system, user),
    openai: () => callOpenAI(system, user),
  };
  let lastErr = null; // last failure (thrown if EVERYTHING fails)
  for (const name of order) { // sequential tries — stop at first success
    if (!has[name]) continue; // no key → skip silently
    if (image && (name === 'groq' || name === 'openrouter')) continue; // no vision there → skip (don't waste the call)
    const started = Date.now();
    try {
      const text = await runners[name](); // RUN this provider's call
      console.log(`AI answered via ${name} in ${Date.now() - started}ms`); // observability: /health + logs show what's working
      return text; // success → return immediately (later providers never run = no extra cost)
    } catch (err) {
      lastErr = err; // remember…
      console.error(`AI ${name} failed:`, err.message); // …log with the provider name…
    } // …and LOOP to the next provider (this is the fallback!)
  }
  throw lastErr || new Error('No AI provider configured — add GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY to .env and restart the server');
}

/**
 * Call a SPECIFIC catalog model first; if it fails, fall back to other
 * FREE models only — never silently spend money on a paid model.
 * Returns { text, via } so the UI can show which AI answered.
 */
async function callChoice(entry, model, system, user, image) {
  const aiModels = require('./aiModels'); // required HERE (not top) to avoid a require cycle: aiModels doesn't need us, but lazy is safe
  const has = configuredProviders();
  const single = { // same thunks, but each accepts the EXACT model id from the dropdown
    gemini: () => callGemini(system, user, image),
    claude: () => callClaude(system, user, image, model),
    groq: () => callGroq(system, user, model),
    openrouter: () => callOpenRouter(system, user, model),
    openai: () => callOpenAI(system, user, model),
  };
  // 1. The chosen model.
  if (entry.provider === 'gemini') {
    // Gemini manages its own multi-model fallback internally.
    try {
      const started = Date.now();
      const text = await callGemini(system, user, image);
      console.log(`AI answered via gemini in ${Date.now() - started}ms`);
      return { text, via: entry.label }; // via = pretty name for the UI ("answered by Llama 3.3")
    } catch (err) { console.error('AI gemini failed:', err.message); } // fall THROUGH to free chain below
  } else if (has[entry.provider] && single[entry.provider]) { // chosen provider configured?
    const started = Date.now();
    try {
      const text = await single[entry.provider]();
      console.log(`AI answered via ${entry.provider} in ${Date.now() - started}ms`);
      return { text, via: entry.label };
    } catch (err) { console.error(`AI ${entry.provider} failed:`, err.message); }
  }
  // 2. Free fallback chain (chosen one already tried / unconfigured).
  for (const fb of aiModels.CATALOG.filter((m) => m.tier === 'free' && m.id !== entry.id)) { // only tier==='free', skip the one just tried
    if (!has[fb.provider]) continue; // no key → skip
    if (image && (fb.provider === 'groq' || fb.provider === 'openrouter')) continue; // no vision → skip
    const started = Date.now();
    try {
      let text; // let because two branches assign it
      if (fb.provider === 'gemini') text = await callGemini(system, user, image);
      else text = await single[fb.provider]();
      console.log(`AI answered via fallback ${fb.provider} in ${Date.now() - started}ms`);
      return { text, via: fb.label };
    } catch (err) { console.error(`AI fallback ${fb.provider} failed:`, err.message); }
  }
  throw new Error('All configured AIs failed — check keys and restart the server');
}

/**
 * General-purpose chat (Vendora AI page) — NOT grounded in any catalog.
 * Answers like a normal AI assistant: research, writing, ideas, explanations.
 * choiceId comes from the dropdown and is validated against the tier.
 */
async function askGeneral(message, history, choiceId, tier) {
  const aiModels = require('./aiModels'); // catalog + resolveChoice validator
  const system = `You are Vendora AI, a friendly general-purpose assistant inside the Vendora app.
Answer clearly and helpfully: research questions, writing, ideas, explanations, advice.
Keep answers scannable — short paragraphs, simple lists when useful. No markdown tables.
If asked about Vendora itself: it is a WhatsApp AI sales assistant for small businesses.`;
  const transcript = (history || []) // history = [{from:'you'|'ai', text}] from the client
    .slice(-12) // last 12 only (cost control — long histories get expensive)
    .map((m) => `${m.from === 'you' ? 'User' : 'Vendora AI'}: ${m.text}`) // label each turn for the model
    .join('\n'); // one transcript block
  const user = transcript ? `${transcript}\nUser: ${message}` : message; // context + new question
  try {
    const resolved = aiModels.resolveChoice(choiceId, tier || 'free'); // validate: exists? paid-but-free-tier? Returns {entry, model} or {error}
    if (resolved.error) return { reply: null, reason: resolved.error }; // locked/unknown → friendly refusal (402 in controller)
    const { text, via } = await callChoice(resolved.entry, resolved.model, system, user, null); // null image = text chat
    if (!text) return { reply: null, reason: 'Empty AI response' };
    return { reply: text, via }; // via shown under the bubble ("answered by DeepSeek R1")
  } catch (err) {
    console.error('askGeneral error:', err.message); // all providers failed
    return { reply: null, reason: 'AI service unavailable' }; // NEVER throw — controller turns this into the "resting" message
  }
}

/**
 * Generate a reply to a customer message using the business's catalog.
 * Returns { reply, needsHuman, reason? }.
 * Strictly grounded in the catalog + business info; NEED_HUMAN otherwise.
 * Pro businesses additionally ground in their synced WhatsApp Business profile.
 */
async function generateReply(customerMessage, business, image, history) {
  const planService = require('./planService'); // lazy require (same pattern — avoids cycles)
  const pro = planService.isPro(business); // Pro unlocks profile-snapshot grounding below
  const products = await productService.getProducts(business.id); // the shop's catalog rows
  const catalog = productService.formatCatalog(products); // rows → pretty text block for the prompt
  const tz = business.timezone || 'Africa/Lagos'; // per-business timezone (global scale!)
  let now; // let because try/catch assigns in two places
  try { now = new Date().toLocaleString('en-GB', { timeZone: tz }); } // current time IN the shop's zone (open/closed logic needs this)
  catch { now = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }); } // bad timezone string → safe default instead of crashing
  const maxDisc = business.max_discount_pct || 0; // SmartDeal: 0 = never discount
  const minOrder = business.min_order_naira || 0; // SmartDeal: minimum order for discounts
  const transcript = (history || []) // recent chat turns so "how much is it?" knows what "it" is
    .map((m) => `${m.direction === 'in' ? 'Customer' : 'You'}: ${m.body}`) // 'in' = customer wrote it
    .join('\n');

  // THE SYSTEM PROMPT — the constitution the AI must obey. ${} injects live data.
  const systemPrompt = `You are the automated WhatsApp sales assistant for ${business.name}.
You answer customer questions using ONLY the business information and product catalog below.
It is ${now} (business local time, ${tz}).

Business info:
- Name: ${business.name}
- Opening hours: ${business.hours || 'not provided'} // || fallback when owner left it blank
- Tone: ${business.tone || 'friendly and helpful'}

FAQ:
${(business.faq || []).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n') || '(none)'} // each FAQ → Q:/A: lines, or "(none)"

PRODUCT CATALOG (the single source of truth for products, prices, availability):
${catalog}
${pro && business.profile_snapshot ? `\nVERIFIED BUSINESS PROFILE (synced from the owner's WhatsApp Business profile — treat items here as confirmed available):\n${business.profile_snapshot}\n` : ''} // nested template: Pro + synced snapshot → extra trusted section, else empty string
${transcript ? `\nRECENT CONVERSATION WITH THIS CUSTOMER (oldest first — use it for context, pronouns, and follow-up questions):\n${transcript}\n` : ''} // history only if it exists

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
${maxDisc > 0 ? `8. SMARTDEAL NEGOTIATION: The owner allows you to offer up to ${maxDisc}% off${minOrder ? ` on orders worth at least ₦${minOrder.toLocaleString()}` : ''} ONLY when the customer hesitates, complains about price, or says it's too expensive AND they clearly want to buy. Offer it once, as a special one-time price — never volunteer discounts to happy customers, never exceed ${maxDisc}%. Phrase it like the owner is doing them a favour.` : '8. Do NOT offer any discounts — the owner has not enabled negotiation.'} // ternary picks the discount rule; toLocaleString() = 15000 → "15,000"
${image ? '9. The customer also sent a PHOTO. Look at it, describe briefly what you see, and match it to the closest product(s) in the catalog (replacement, matching item, or exact match). If nothing in the catalog matches, use NEED_HUMAN.' : ''}`; // vision rule only when a photo exists

  const userPrompt = `Customer message: "${customerMessage}"${image ? '\n(A photo is attached — analyze it.)' : ''}\n\nRespond per your rules.`; // the actual user turn

  try {
    const text = await callAI(systemPrompt, userPrompt, image); // automatic provider fallback inside
    if (text.startsWith('NEED_HUMAN')) { // the model's escape hatch: "I don't know, get a human"
      return { reply: null, needsHuman: true, reason: text.slice(11).trim() || 'Unsure how to answer' }; // slice(11) strips "NEED_HUMAN:" (11 chars)
    }
    if (!text) { // empty string = treat as unsure (never send silence to a customer)
      return { reply: null, needsHuman: true, reason: 'Empty AI response' };
    }
    return { reply: text, needsHuman: false }; // confident → send it
  } catch (err) {
    console.error('replyEngine error:', err); // every provider failed (network/keys down)
    return { reply: null, needsHuman: true, reason: 'AI service unavailable' }; // graceful: flag human, don't crash the webhook
  }
}

/**
 * LEARN mode: extract products from the owner's ad text.
 * Returns { products: [{name, price, description}] , ok: boolean }.
 * TRICK: we ask the AI for STRICT JSON, then JSON.parse it — structured output
 * without any special API mode. The regex finds the [...] even if the AI chats.
 */
async function extractProducts(adText, business) {
  const system = `You extract structured product data from WhatsApp business ad posts.
Return ONLY a JSON array, no markdown, no explanation. Each item:
{"name": string, "price": string or null, "description": string or null}
Prices keep the currency as written (e.g. "₦5,000"). Product names short (max 8 words).
If the text contains no products, return [].`;

  try {
    const text = await callAI(system, adText); // image omitted → undefined (text-only extraction)
    const match = text.match(/\[[\s\S]*\]/); // regex: first [ … last ] across lines ([\s\S] = "any char incl. newline")
    if (!match) return { products: [], ok: false }; // no array found → fail
    const parsed = JSON.parse(match[0]); // turn the JSON text into real objects (throws on garbage → caught below)
    const clean = parsed.filter( // drop junk entries: must be an object with a non-empty name string
      (p) => p && typeof p.name === 'string' && p.name.trim()
    );
    return { products: clean, ok: true };
  } catch (err) {
    console.error('extractProducts error:', err); // AI down OR bad JSON — either way…
    return { products: [], ok: false }; // …caller shows "couldn't find products", nothing crashes
  }
}

module.exports = { generateReply, extractProducts, askGeneral, PROVIDER, configuredProviders }; // the public API of the brain
