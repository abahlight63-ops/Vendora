// ── src/services/replyEngine.js ──────────────────────────────────
// WHAT: the AI BRAIN — prompts + grounding + structured parsing.
// Transport (keys, timeouts, provider HTTP) lives in ./ai/client.js.
// Two jobs:
//   1. generateReply() — WhatsApp customer replies, STRICTLY grounded in the
//      shop's catalog (never invents prices; NEED_HUMAN flag when unsure).
//   2. askGeneral() — VeloSales Ai page: free-form assistant, no grounding.
// MODULES: ./productService (catalog), ./ai/client (transport).

const productService = require('./productService');
const client = require('./ai/client');

/**
 * Strip markdown to plain chat text. Models are told "plain text only" but
 * still emit ###, **, backticks — which render as LITERAL junk characters
 * in WhatsApp bubbles and our chat UI (no markdown renderer anywhere).
 * Enforcement beats prompting: every brain output passes through here, so
 * customers and owners NEVER see # * _ ` ~ | artifacts. Structure (numbered
 * steps, line breaks, • bullets) is preserved — only the decoration dies.
 */
function cleanReply(text) {
  if (!text || typeof text !== 'string') return text;
  let t = text;
  t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, '').trim()); // fenced code blocks → inner text
  t = t.replace(/`([^`]*)`/g, '$1'); // `inline code` → text
  t = t.replace(/^#{1,6}[ \t]*/gm, ''); // ### Header → Header ([ \t] only: \s would eat the newline and glue lines together)
  t = t.replace(/\*\*([^*\n]*)\*\*/g, '$1'); // **bold** → bold
  t = t.replace(/__([^_\n]*)__/g, '$1'); // __bold__ → bold
  t = t.replace(/(^|[\s(])\*([^*\n\s][^*\n]*)\*/g, '$1$2'); // *italic* → italic (not list bullets)
  t = t.replace(/(^|[\s(])_([^_\n\s][^_\n]*)_/g, '$1$2'); // _italic_ → italic
  t = t.replace(/~~([^~\n]*)~~/g, '$1'); // ~~struck~~ → struck
  t = t.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1'); // [text](url) → text
  t = t.replace(/^[ \t]*>[ \t]?/gm, ''); // "> quote" → plain
  t = t.replace(/^[ \t]*[-*+][ \t]+/gm, '• '); // "- item" → "• item"
  t = t.replace(/^\s*\|.*\|\s*$/gm, (row) => row.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()); // | tables | → spaced words
  t = t.replace(/^[ \t]*(\*{3,}|-{3,}|_{3,}|#{2,})[ \t]*$/gm, ''); // "***" / "---" / "###" junk lines → gone
  t = t.replace(/^[ \t]*\*+[ \t]*$/gm, ''); // lone "*" run on its own line (crumb left when "*****" is split by the bold rule) → gone
  t = t.replace(/\*{2,}/g, ''); // leftover ** runs (e.g. "*****") → gone
  t = t.replace(/^[ \t]*#[ \t]+/gm, ''); // leftover "# " line starts → gone
  t = t.replace(/[ \t]+$/gm, ''); // trailing spaces per line
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, ''); // emoji → gone (prompts say "no emojis" but models still sneak them in — enforcement beats prompting; U+2022 • bullets are NOT in these ranges, so our option lists survive!)
  t = t.replace(/[ \t]{2,}/g, ' '); // collapse gaps the emoji strip leaves behind
  t = t.replace(/\n{3,}/g, '\n\n'); // max one blank line between blocks
  return t.trim();
}

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
  // Text-only providers (no vision): skip when a photo is attached — Gemini/Claude handle images.
  const NO_VISION = (p) => p === 'groq' || p === 'tokenrouter' || p === 'sambanova' || p === 'pollinations';
  if (has[entry.provider]) {
    if (!(image && NO_VISION(entry.provider))) {
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
    if (image && NO_VISION(fb.provider)) continue;
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

// Niche seeds: 2-3 example topics per niche so VeloSales Ai answers with
// the owner's hustle in mind (freelancer → clients/gigs, baker → orders…).
// Keys match the welcome picker labels; unknown niches fall back to DEFAULT.
const NICHE_SEEDS = {
  'DEFAULT': 'pricing, sales captions, and handling difficult customers',
  'Clothing, Fashion & Accessories': 'pricing outfits, sales captions for new drops, and handling size/return questions',
  'Beauty, Cosmetics & Personal Care': 'pricing services, booking captions, and rebooking clients',
  'Baking, Catering & Homemade Food': 'pricing per plate/tray, order-deadline captions, and handling custom orders',
  'Freelance Services': 'pricing gigs, writing proposals, building a portfolio, and handling late-paying clients',
  'Tutoring, Coaching & Digital Info-Products': 'pricing sessions, course outlines, and enrolling students',
  'Hair Salons, Barbers & Makeup Artists': 'pricing services, booking captions, and rebooking clients',
  'Real Estate Agent or Property Broker': 'listing captions, qualifying buyers, and follow-up scripts',
  'Sneakers & Footwear Reseller': 'pricing pairs, drop captions, and spotting fakes questions',
  'Electronics, Gadgets & Phone Accessories': 'pricing gadgets, warranty answers, and spec comparisons',
  'Handmade Crafts & Artisanal Goods': 'pricing handmade pieces, custom-order captions, and made-to-order timelines',
  'Grocery, Fruits & Fresh Produce': 'pricing per bag/basket, freshness answers, and delivery-day questions',
  'Home Decor, Furniture & Kitchenware': 'pricing furniture sets, styling captions, and delivery/fitting questions',
  'Dropshipping & General Retail Store': 'pricing for ads plus profit, winning-product captions, and delivery-time questions',
  'Thrift, Vintage & Pre-loved Items': 'pricing thrift finds, bale-drop captions, and grading/defect questions',
  'Event Planning, Cakes & Decor': 'pricing event packages, setup captions, and date/guest-count questions',
  'Photography & Videography Services': 'pricing sessions, shoot captions, and booking questions',
  'Fitness Coaching & Health Supplements': 'pricing coaching plans, supplement answers, and sign-up questions',
  'Logistics, Delivery & Errand Services': 'pricing routes, pickup-time answers, and tracking questions',
  'Wholesale Supply & B2B Distribution': 'pricing per carton and per bag, minimum-order answers, and distributor questions',
};

/**
 * General-purpose chat (VeloSales Ai page) — NOT grounded in any catalog.
 * Smart + thorough: full explanations with examples, not one-liners.
 * choiceId comes from the dropdown and is validated against the tier.
 * niche tailors examples + follow-ups to the owner's hustle (empty = generic).
 */
async function askGeneral(message, history, choiceId, tier, bizName, niche, shopCtx) {
  const aiModels = require('./aiModels');
  const shop = (bizName || '').split(' ')[0] || 'friend';
  const cleanNiche = typeof niche === 'string' ? niche.trim().slice(0, 80) : '';
  const seeds = NICHE_SEEDS[cleanNiche] || NICHE_SEEDS.DEFAULT; // exact-label match, else generic (never crash on custom niches!)
  const nicheLine = cleanNiche
    ? `\nOWNER NICHE: "${cleanNiche}" — tailor EVERY example, caption, and suggestion to this hustle (think ${seeds}). When they ask open questions ("give me ideas", "help me sell"), default to this niche without asking what they sell.`
    : '';
  // TODAY, spelled out: models default to training-cutoff knowledge and sound
  // STALE ("as of my knowledge…"). A concrete date keeps answers current-year.
  let todayLine = '';
  try {
    todayLine = `\nTODAY IS: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (Africa/Lagos). Answer with current-year context — seasons, prices and trends as of THIS date. Never mention training cutoffs or knowledge limits; if something genuinely needs live data (today's exact FX rate, breaking news), say what you know plus how to verify in one line.`;
  } catch { todayLine = '\nTODAY IS: sometime in 2026 (Africa/Lagos) — answer with current-year context.'; } // locale data missing? degrade, never crash!
  // SHOP GROUNDING: the model knows the WORLD, not THIS shop — unless we send
  // it. Catalog/hours/FAQs below outrank general knowledge for shop questions
  // ("how much is my wig?" → quote THEIR price, never invent or guess!).
  let shopLine = '';
  if (shopCtx && typeof shopCtx === 'object') {
    const bits = [];
    if (shopCtx.hours) bits.push(`Hours: ${shopCtx.hours}`);
    if (shopCtx.tone) bits.push(`Shop voice: ${shopCtx.tone}`);
    if (Array.isArray(shopCtx.faq) && shopCtx.faq.length) {
      bits.push('Owner FAQs:\n' + shopCtx.faq.map((f) => `Q: ${f.question || f.q || ''}\nA: ${f.answer || f.a || ''}`).join('\n'));
    }
    if (shopCtx.catalog) bits.push(`SHOP CATALOG (single source of truth — quote these exact names/prices, never invent siblings):\n${shopCtx.catalog}`);
    if (bits.length) shopLine = `\nSHOP FACTS (answer shop questions ONLY from these — "${shop}" means THIS shop):\n${bits.join('\n')}`;
  }
  const system = `You are VeloSales Ai, a smart, warm general-purpose assistant inside the VeloSales Ai app.${nicheLine}${todayLine}${shopLine}

PERSONALITY: knowledgeable friend + sharp business coach. Friendly, respectful, encouraging. Greet warmly, always offer a concrete next step.

GREETINGS ("hey", "hi", "hello", "sup", "good morning", "how far", "abeg"): NEVER curt. Reply politely, use their shop name when known ("Hey ${shop}! Great to see you — how are you doing today? What can we help you with?"). Match vibe: English → warm English; Pidgin → natural Pidgin ("Hey! I dey here for you — how you dey? Wetin I fit help you do today?"); Yoruba/Hausa/Igbo greetings → greet back, then follow their language lead.

RESPECT (non-negotiable — this protects the business legally and commercially): unfailingly polite, patient and professional, like the best-trained shop assistant. NEVER rude, sarcastic, mocking, dismissive or insulting, no matter the customer's tone. NO profanity, ever — even if the customer swears: stay calm, stay kind, apologize for any frustration, and offer a human teammate ("I'm sorry about that — let me get a human teammate to sort this out for you."). Courtesy is the whole brand.

EMOJI: none in replies — plain words only (chat bubbles render raw characters, and plain text reads professional).

SMALL TALK ("how are you?", "who are you?", "what can you do?"): answer warmly, say you are VeloSales Ai inside VeloSales Ai, list 4-5 real capabilities (write sales captions, business name ideas, pricing strategy, difficult-customer replies, product descriptions, marketing plans), end with one question to keep helping.

DEPTH (the important part — NEVER give one-liners to real questions): a how/what/why/strategy/writing question ALWAYS gets a complete answer. Explain the why, give ordered steps, and include at least one concrete example with real numbers/names suited to a small Nigerian business where it fits. A pricing question gets a mini-framework PLUS an example calculation. A caption/description/customer-reply request gets 3 ready-to-copy options, NOT advice about writing. Structure with short headings or numbered steps so long answers stay scannable. Length guide: greetings/small-talk = 2-4 sentences; substantive questions = 150-450 words of real content, never padded with fluff. Every substantive answer ends with ONE concrete next step or follow-up question.

FORMATTING: PLAIN TEXT ONLY — never type #, *, underscores, backticks, ~, | or [text](url). The chat shows RAW characters, so ### and ** appear as ugly junk to the reader. Structure with plain numbered steps (1. 2. 3.), simple dash lines for bullets, short paragraphs, one idea per line. Each step/option on its OWN line (line breaks are preserved in the bubble). No markdown tables (they break in chat bubbles).

VELOSALES AI FACTS: VeloSales Ai is a WhatsApp AI sales assistant for small businesses (answers customers in English + Pidgin, 24/7, learns the catalog, hands off to a human when unsure).`;
  // Drop a trailing duplicate of the current message (the frontend used to send
  // history INCLUDING the just-typed message — dedupe here so no provider pays
  // for, or gets confused by, the question twice).
  let hist = Array.isArray(history) ? history.slice(-12) : [];
  if (
    hist.length &&
    hist[hist.length - 1].from === 'you' &&
    typeof hist[hist.length - 1].text === 'string' &&
    hist[hist.length - 1].text.trim() === message.trim()
  ) {
    hist = hist.slice(0, -1);
  }
  const transcript = hist
    .map((m) => `${m.from === 'you' ? 'User' : 'VeloSales Ai'}: ${m.text}`)
    .join('\n');
  const user = transcript ? `${transcript}\nUser: ${message}` : message;
  // Warmer sampling for personality + roomy token budget so answers finish
  // complete instead of cut off mid-thought (2000 tokens ≈ 1300+ words).
  const chatOpts = { temperature: 0.8, maxTokens: 2000 };
  try {
    const resolved = aiModels.resolveChoice(choiceId, tier || 'free');
    if (resolved.error) return { reply: null, reason: resolved.error };
    let answered = await callChoice(
      resolved.entry,
      resolved.model,
      system,
      user,
      null,
      chatOpts
    );
    // Stub-answer guard: a substantive question answered in ~2 sentences is a
    // miss (lite-model terseness), not a reply. ONE expansion retry with the
    // same model — quota still counts once (the controller increments per ask).
    if (
      answered.text &&
      answered.text.trim().length < 140 &&
      message.trim().length > 40 &&
      !/^(hi+|hey+|hello+|sup|good\s?(morning|afternoon|evening|day)|how far|yo|hiya|he+y+|how are you|who are you|what can you do)\b/i.test(message.trim())
    ) {
      console.log(`AI ${resolved.entry.id} answer too short (${answered.text.trim().length} chars) — expanding once`);
      try {
        const expanded = await callChoice(
          resolved.entry,
          resolved.model,
          system,
          `${user}\n\n(Follow-up: that answer was too brief. Answer again PROPERLY — full explanation, ordered steps, and a concrete example.)`,
          null,
          chatOpts
        );
        if (expanded.text && expanded.text.trim().length > answered.text.trim().length) {
          answered = expanded;
        }
      } catch (err) {
        console.error('askGeneral expand retry failed:', err.message);
      }
    }
    const { text, via, modelId, fallback, requested } = answered;
    if (!text) return { reply: null, reason: 'Empty AI response' };
    const clean = cleanReply(text); // enforce plain text (see cleanReply: prompts alone don't stop ###/**)
    if (!clean) return { reply: null, reason: 'Empty AI response' };
    return { reply: clean, via, modelId, fallback, requested };
  } catch (err) {
    console.error('askGeneral error:', err.message);
    // Pass the REAL cause through (e.g. "GEMINI_API_KEY is not set",
    // "All configured AIs failed") — our transport errors never contain key
    // values, only key NAMES, so this is safe to show the owner.
    return { reply: null, reason: err.message || 'AI service unavailable' };
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
  const isEmptyCatalog = !products || products.length === 0; // empty shelf → special polite rules below (never blunt!)
  const customGreeting = typeof business.greeting_msg === 'string' ? business.greeting_msg.trim().slice(0, 300) : '';
  const transcript = (history || [])
    .map((m) => `${m.direction === 'in' ? 'Customer' : 'You'}: ${m.body}`)
    .join('\n');

  const systemPrompt = `You are the friendly human shop assistant for ${business.name} on WhatsApp. You sound like a warm, sharp salesperson who loves helping — never a robot, never stiff. You answer using ONLY the business info and catalog below.
It is ${now} (business local time, ${tz}).

RESPECT FIRST (non-negotiable — this protects the business): unfailingly polite, patient and professional at ALL times. NEVER rude, sarcastic, mocking, dismissive or insulting, whatever the customer's tone. NO profanity, ever — even if the customer swears or insults you: stay calm, stay kind, and hand off warmly ("I'm sorry about that — a teammate will sort this out for you shortly."). Courtesy is the whole brand.

${customGreeting ? `SHOP GREETING (the owner's own words — use this to greet, then offer help): "${customGreeting}"\n` : ''}GREETINGS ("hey", "hi", "hello", "good morning", "how far", "abeg", "how are you"): ALWAYS answer directly with a warm greeting — NEVER NEED_HUMAN for a greeting. Greet by shop name, ask how they are doing, and ask what you can help with today (e.g. "Hello! Welcome to ${business.name} — how are you doing today? What can we help you with?"). Match their language: Pidgin in → warm natural Pidgin out ("Hello! Welcome to ${business.name} — how you dey today? Wetin we fit do for you?").

Business info:
- Name: ${business.name}
- Opening hours: ${business.hours || 'not provided'}
- Tone: ${business.tone || 'friendly and helpful'}
${business.business_niche ? `- What they sell: ${business.business_niche} (recommend within this lane first!)` : ''}

FAQ:
${(business.faq || []).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n') || '(none)'}

PRODUCT CATALOG (the single source of truth for products, prices, availability):
${catalog}
${isEmptyCatalog ? `\nCATALOG STATUS: EMPTY — the owner has not added any products yet. When a customer asks about ANY product (e.g. "are shirts available?"): be extra warm, apologize kindly, NEVER say "No shirts in catalog" or "not listed" or any blunt stock phrase. Instead say something like "Sorry about that! We don't have shirts listed right now, but tell me what style or size you need and I'll sort it out for you." Then respond with exactly NEED_HUMAN on the next line so the owner is alerted. Example: "Sorry about that! We don't have shirts listed right now, but tell me what style you need and I'll sort it out for you. A teammate will confirm for you shortly."\n` : ''}
${pro && business.profile_snapshot ? `\nVERIFIED BUSINESS PROFILE (synced from the owner's WhatsApp Business profile — treat items here as confirmed available):\n${business.profile_snapshot}\n` : ''}
${transcript ? `\nRECENT CONVERSATION WITH THIS CUSTOMER (oldest first — use it for context, pronouns, and follow-up questions):\n${transcript}\n` : ''}

HOW TO SELL LIKE A HUMAN (follow every time):
1. ANSWER FIRST, THEN SUGGEST. Always answer the exact question first (price, availability, hours). Then add ONE short suggestive line plus a mini-list of alternatives, like a good shop assistant would.
2. ALWAYS SHOW OPTIONS. After the direct answer, list up to 5 relevant in-stock alternatives from the catalog (same category or similar use first). Format: one product per line as "• Name — Price". Never list more than 5. If the catalog has fewer, show what exists. Out-of-stock items go LAST and are marked "(out of stock)".
3. MAKE IT INVITING. Example flow when asked "do you have blue gown?": confirm the gown (price + availability), then say something like "We also have other fine clothes you may like:" followed by 3-5 options (nice tops, shorts, other gowns), then close with ONE clear next step: "Want me to reserve one for you? Just tell me the name."
4. "WHAT DO YOU SELL?" / vague asks ("what do you have?", "show me clothes"): pick the 5 most relevant in-stock items, list them the same way, and ask what they like.
5. OUT OF STOCK / NOT FOUND: say so honestly in one warm line ("Sorry about that! That one just finished — but tell me what you need and I'll sort it out for you!"), then immediately offer 3-5 alternatives from the catalog when any exist. NEVER use blunt phrases like "No shirts in catalog", "not listed", "not available" alone — always apologize kindly, invite them to describe what they need, and keep helping. When nothing matches at all, end with a handoff promise ("A teammate will confirm for you shortly.") and respond NEED_HUMAN so the owner is paged.
6. LANGUAGE: Match the customer's language exactly. Pidgin in → natural Pidgin out. Mixed → mix naturally. Formal → formal. Never correct them.
7. NEVER invent prices, products, availability, or delivery promises. Only the catalog and FAQ. Banned blunt phrases (never output these): "No X in catalog", "not in catalog", "not listed", "no products listed". If the answer is not covered (empty catalog, unknown product, custom orders, complaints, negotiation, payment details, anything not in the catalog), respond with exactly:
   NEED_HUMAN: <brief reason>
   The handoff wrapper will deliver a polite customer message + page the owner, so NEED_HUMAN is always the kind choice over guessing.
8. BUSINESS HOURS: Compare now against opening hours. If CLOSED, say so warmly, state when you next open, and still help with catalog questions (prices, options).
9. PURE CHIT-CHAT (greetings alone, jokes, "lol", "thanks", memes — zero buying signal): answer warmly and briefly in one or two kind sentences, then invite them to ask about products ("Glad to hear that! Anything I can help you find in the shop today?"). NEVER pitch products uninvited, NEVER lecture, NEVER NEED_HUMAN for friendliness — only hand off if they are upset or ask for a human.
10. LENGTH + FORMAT: WhatsApp-friendly, warm, human. Direct answers stay short; when listing options allow up to ~150 words. PLAIN TEXT ONLY — never type #, *, underscores, backticks, ~, | or [text](url), and no emojis — plain words only. Steps (if any) as plain "1. 2. 3." lines, options as "•" lines, each on its OWN line.
${maxDisc > 0 ? `11. SMARTDEAL NEGOTIATION: The owner allows up to ${maxDisc}% off${minOrder ? ` on orders worth at least ₦${minOrder.toLocaleString()}` : ''} ONLY when the customer hesitates, complains about price, or says it's too expensive AND clearly wants to buy. Offer once, as a one-time favour — never volunteer it to happy customers, never exceed ${maxDisc}%.` : '11. Do NOT offer discounts — the owner has not enabled negotiation.'}
${image ? '12. The customer also sent a PHOTO. Look at it, describe briefly what you see, match it to the closest catalog product(s), then suggest 2-4 similar in-stock alternatives the same way. If nothing matches, use NEED_HUMAN.' : ''}`;

  const userPrompt = `Customer message: "${customerMessage}"${image ? '\n(A photo is attached — analyze it.)' : ''}\n\nRespond per your rules.`;

  // Per-shop brain pick (Connect page → whatsapp_model): the SAME catalog the
  // VeloSalesAI dropdown offers, tier-gated the same way. Downgraded/locked picks
  // fall back to the free default (customers NEVER see a paywall — the SHOP does!).
  const aiModels = require('./aiModels');
  const shopTier = planService.effectiveTier(business);
  let entry = aiModels.get(business.whatsapp_model || 'gemini-flash-full') || aiModels.get('gemini-flash-full');
  const check = aiModels.resolveChoice(entry.id, shopTier);
  if (check.error) entry = aiModels.get('gemini-flash-full'); // locked (plan dropped?) → free default, silently
  const waOpts = { temperature: 0.7, maxTokens: 1200 }; // warmer + roomier than the old chain (0.3/350 starved answers — the accuracy fix!)
  const isSubstantive = (t) => t && t.trim().length > 40
    && !/^(hi+|hey+|hello+|sup|good\s?(morning|afternoon|evening|day)|how far|yo|hiya|he+y+|how are you|who are you|what can you do|thanks|thank you|ok|okay|lol)\b/i.test(t.trim());

  try {
    let answered = await callChoice(entry, null, systemPrompt, userPrompt, image, waOpts);
    if (answered.text && answered.text.trim().length < 140 && isSubstantive(customerMessage)) { // stub answer (a real question in ~2 sentences = a miss!)…
      console.log(`WhatsApp answer too short (${answered.text.trim().length} chars) — expanding once`);
      try { // …ONE expansion retry, same model (accuracy without extra cost surface!)
        const expanded = await callChoice(entry, null, systemPrompt,
          `${userPrompt}\n\n(Follow-up: that answer was too brief. Answer again PROPERLY — full explanation, ordered steps, and a concrete example from the catalog.)`,
          image, waOpts);
        if (expanded.text && expanded.text.trim().length > answered.text.trim().length) answered = expanded;
      } catch (err) { console.error('generateReply expand retry failed:', err.message); }
    }
    const text = cleanReply(answered.text); // plain text enforced; ALSO normalizes "**NEED_HUMAN:**" variants into a detectable flag
    if (text.startsWith('NEED_HUMAN')) {
      return { reply: null, needsHuman: true, reason: text.slice(11).trim() || 'Unsure how to answer' };
    }
    if (!text) {
      return { reply: null, needsHuman: true, reason: 'Empty AI response' };
    }
    // Politeness safety net: if the model slipped a blunt stock phrase through,
    // convert to a human handoff (owner paged, customer gets the kind wrapper).
    if (/no .* in catalog|not in catalog|not listed|no products listed/i.test(text)) {
      return { reply: null, needsHuman: true, reason: `Blunt catalog phrase intercepted: "${text.slice(0, 120)}"` };
    }
    return { reply: text, needsHuman: false, modelId: answered.modelId, paidModel: entry.tier === 'paid' };
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
{"name": string, "price": string or null, "description": string or null, "quantity": number or null, "category": string or null}
Prices keep the currency as written (e.g. "₦5,000"). Product names short (max 8 words).
quantity: whole units ONLY when the text states a count ("20 pieces", "x12", "50 in stock") — else null, NEVER 0 (0 means confirmed empty!).
category: short shelf section ONLY when obvious ("phones", "wigs", "cakes") — else null.
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
  cleanReply,
  parseInventoryAction,
  INVENTORY_HINT,
  PROVIDER,
  configuredProviders,
  __groqSlot: client.groqSlot,
};
