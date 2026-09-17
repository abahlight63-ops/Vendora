// ── src/services/ai/client.js ────────────────────────────────────
// WHAT: the low-level AI transport layer — keys, timeouts, rate governor,
// and one caller per provider (Gemini / Claude / Groq / OpenAI / TokenRouter
// / SambaNova / Pollinations).
// RULE: one API key per provider, 2 models max per key (see aiModels.js).
// The BRAIN lives in ../replyEngine.js (prompts + grounding); THIS file only
// moves text to providers and back. No prompts here, no business logic.
// WHY SPLIT: replyEngine was doing transport + prompting + parsing in one
// 470-line file. Now: client.js = "how to call", replyEngine.js = "what to say".
// MODULES: none — global fetch only (Node 18+). No SDKs, no langchain.

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 25000);
const GROQ_RPM = Number(process.env.GROQ_RPM || 30);

// Gemini chain: LITE FIRST (fastest + cheapest, user request). Override the
// whole chain with GEMINI_MODELS="a,b,c", or just the lite default with
// GEMINI_LITE_MODEL="gemini-3.5-flash-lite" once Google ships that name —
// unknown names 404 and fall through to the next working model, no deploy.
const GEMINI_LITE = process.env.GEMINI_LITE_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_CHAIN = (
  process.env.GEMINI_MODELS || `${GEMINI_LITE},gemini-2.5-flash,gemini-flash-latest`
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';

// Model affinity: remembers the last working CHAIN model so repeat calls skip
// the 404-probing chain. Only used in chain mode — pinned calls (dropdown
// picks) never read or write it, so switching models always takes effect.
let fastModel = null;

// ── Groq governor (30 req/min on its single key — 2 models share it) ──
const groqHits = [];
async function groqSlot() {
  const windowMs = 60 * 1000;
  for (let i = 0; i < 20; i++) {
    const now = Date.now();
    while (groqHits.length && groqHits[0] <= now - windowMs) groqHits.shift();
    if (groqHits.length < GROQ_RPM) {
      groqHits.push(now);
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function validKey(v) {
  return (
    typeof v === 'string' &&
    v.trim().length > 15 &&
    !v.includes('...') &&
    !v.includes('xxxxx')
  );
}

function configuredProviders() {
  return {
    gemini: validKey(process.env.GEMINI_API_KEY),
    claude: validKey(process.env.ANTHROPIC_API_KEY),
    groq: validKey(process.env.GROQ_API_KEY),
    tokenrouter: validKey(process.env.TOKENROUTER_API_KEY),
    sambanova: validKey(process.env.SAMBANOVA_API_KEY),
    pollinations: true, // keyless emergency fallback — always "configured"
    openai: validKey(process.env.OPENAI_API_KEY),
  };
}

function optsOf(opts, fallbackTemp, fallbackMax) {
  return {
    temp:
      opts && typeof opts.temperature === 'number'
        ? opts.temperature
        : fallbackTemp,
    maxT: (opts && opts.maxTokens) || fallbackMax,
  };
}

// ── Gemini. opts.model PINS one model (dropdown path); without it the chain
// + affinity run (generic bot path). Pinned calls never touch fastModel. ──
async function callGemini(system, user, image, opts) {
  const key = process.env.GEMINI_API_KEY;
  if (!validKey(key)) throw new Error('GEMINI_API_KEY is not set');
  const pinned = opts && opts.model ? String(opts.model) : null;
  const parts = [{ text: user }];
  if (image) {
    parts.push({
      inlineData: { mimeType: image.mime, data: image.base64 },
    });
  }
  const { temp, maxT } = optsOf(opts, 0.3, 350);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: temp, maxOutputTokens: maxT },
  });
  const ordered = pinned
    ? [pinned]
    : fastModel
      ? [fastModel, ...GEMINI_CHAIN.filter((m) => m !== fastModel)]
      : GEMINI_CHAIN;
  let lastErr;
  for (const model of ordered) {
    const started = Date.now();
    let res;
    try {
      res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }
      );
    } catch (e) {
      lastErr = `Gemini ${model} network/timeout: ${e.message}`;
      console.error(lastErr);
      if (pinned) break;
      continue;
    }
    if (res.ok) {
      if (!pinned) fastModel = model;
      const data = await res.json();
      return (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text)
        .join('')
        .trim();
    }
    lastErr = `Gemini ${model} error ${res.status} (${Date.now() - started}ms): ${(await res.text()).slice(0, 200)}`;
    console.error(lastErr);
    if (pinned) break; // pinned = exact model requested, no sibling probing
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error(lastErr || 'All Gemini models failed');
}

async function callClaude(system, user, image, modelOverride, opts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!validKey(key)) throw new Error('ANTHROPIC_API_KEY is not set');
  const content = [{ type: 'text', text: user }];
  if (image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mime, data: image.base64 },
    });
  }
  const { temp, maxT } = optsOf(opts, 0.3, 350);
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelOverride || CLAUDE_MODEL,
      max_tokens: maxT,
      temperature: temp,
      system,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Claude API error ${res.status}: ${(await res.text()).slice(0, 200)}`
    );
  }
  const data = await res.json();
  return (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

// Groq + TokenRouter + SambaNova + OpenAI share the OpenAI chat shape.
async function callOpenAICompat(
  name,
  url,
  key,
  model,
  system,
  user,
  extraHeaders,
  opts
) {
  const started = Date.now();
  const { temp, maxT } = optsOf(opts, 0.3, 350);
  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'content-type': 'application/json',
        ...(extraHeaders || {}),
      },
      body: JSON.stringify({
        model,
        temperature: temp,
        max_tokens: maxT,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (e) {
    throw new Error(`${name} network/timeout: ${e.message}`);
  }
  if (!res.ok) {
    throw new Error(
      `${name} error ${res.status} (${Date.now() - started}ms): ${(await res.text()).slice(0, 200)}`
    );
  }
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error(`${name} returned an empty reply`);
  return text;
}

async function callGroq(system, user, modelOverride, opts) {
  const key = process.env.GROQ_API_KEY;
  if (!validKey(key)) throw new Error('GROQ_API_KEY is not set');
  if (!(await groqSlot())) throw new Error('Groq shared quota busy — falling back');
  const model =
    modelOverride || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return callOpenAICompat(
    'Groq',
    'https://api.groq.com/openai/v1/chat/completions',
    key,
    model,
    system,
    user,
    null,
    opts
  );
}

async function callOpenAI(system, user, modelOverride, opts) {
  const key = process.env.OPENAI_API_KEY;
  if (!validKey(key)) throw new Error('OPENAI_API_KEY is not set');
  const model = modelOverride || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return callOpenAICompat(
    'OpenAI',
    'https://api.openai.com/v1/chat/completions',
    key,
    model,
    system,
    user,
    null,
    opts
  );
}

// TokenRouter: OpenAI-compatible gateway (free key). Base URL is env-
// overridable in case your TokenRouter lives on a different host.
async function callTokenRouter(system, user, modelOverride, opts) {
  const key = process.env.TOKENROUTER_API_KEY;
  if (!validKey(key)) throw new Error('TOKENROUTER_API_KEY is not set');
  const base = (process.env.TOKENROUTER_BASE_URL || 'https://tokenrouter.me/v1').replace(/\/+$/, '');
  const model = modelOverride || process.env.TOKENROUTER_MODEL || 'deepseek-v4-flash'; // real IDs: deepseek-v4-flash, deepseek-v4-pro, kimi-k2p6, kimi-k2p5, qwen3p7-plus, qwen3p6-plus, glm-5p1, gpt-oss-120b, minimax-m3, minimax-m2p7 (GET {base}/v1/models lists yours)
  return callOpenAICompat(
    'TokenRouter',
    `${base}/chat/completions`,
    key,
    model,
    system,
    user,
    null,
    opts
  );
}

async function callSambaNova(system, user, modelOverride, opts) {
  const key = process.env.SAMBANOVA_API_KEY;
  if (!validKey(key)) throw new Error('SAMBANOVA_API_KEY is not set');
  const model =
    modelOverride || process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.3-70B-Instruct';
  return callOpenAICompat(
    'SambaNova',
    'https://api.sambanova.ai/v1/chat/completions',
    key,
    model,
    system,
    user,
    null,
    opts
  );
}

// Pollinations.ai: ZERO key, emergency last-resort. Slower + weaker, but it
// never 429s on your quota because there is no quota. Always tried LAST.
async function callPollinations(system, user, modelOverride, opts) {
  const model = modelOverride || process.env.POLLINATIONS_MODEL || 'openai';
  const { temp, maxT } = optsOf(opts, 0.3, 350);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(AI_TIMEOUT_MS, 45000));
  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: temp,
        max_tokens: maxT,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Pollinations error ${res.status}: ${(await res.text()).slice(0, 200)}`
      );
    }
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('Pollinations returned an empty reply');
    return text;
  } catch (e) {
    throw new Error(`Pollinations network/timeout: ${e.message}`);
  } finally {
    clearTimeout(t);
  }
}

// ── Route ONE catalog entry to its provider with its EXACT model id.
// Gemini entries pin (no chain, no affinity) so the dropdown always sticks. ──
async function callModel(entry, system, user, image, opts) {
  const modelId = entry.model();
  if (entry.provider === 'gemini') {
    return callGemini(system, user, image, { ...(opts || {}), model: modelId });
  }
  if (entry.provider === 'claude') {
    return callClaude(system, user, image, modelId, opts);
  }
  if (entry.provider === 'groq') {
    return callGroq(system, user, modelId, opts);
  }
  if (entry.provider === 'tokenrouter') {
    return callTokenRouter(system, user, modelId, opts);
  }
  if (entry.provider === 'sambanova') {
    return callSambaNova(system, user, modelId, opts);
  }
  if (entry.provider === 'pollinations') {
    return callPollinations(system, user, modelId, opts);
  }
  if (entry.provider === 'openai') {
    return callOpenAI(system, user, modelId, opts);
  }
  throw new Error(`Unknown provider ${entry.provider}`);
}

// ── Generic chain for the WhatsApp bot (no dropdown): AI_PROVIDER first,
// then every other configured provider. Pollinations always last (slow but
// keyless — the net that catches everything). ──
async function callAI(system, user, image) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const has = configuredProviders();
  const order = [provider, 'groq', 'tokenrouter', 'sambanova', 'gemini', 'claude', 'openai', 'pollinations'].filter(
    (p, i, a) => a.indexOf(p) === i
  );
  const runners = {
    gemini: () => callGemini(system, user, image),
    claude: () => callClaude(system, user, image),
    groq: () => callGroq(system, user),
    tokenrouter: () => callTokenRouter(system, user),
    sambanova: () => callSambaNova(system, user),
    openai: () => callOpenAI(system, user),
    pollinations: () => callPollinations(system, user),
  };
  let lastErr = null;
  for (const name of order) {
    if (!has[name]) continue;
    if (image && (name === 'groq' || name === 'tokenrouter' || name === 'sambanova' || name === 'pollinations')) continue;
    const started = Date.now();
    try {
      const text = await runners[name]();
      console.log(`AI answered via ${name} in ${Date.now() - started}ms`);
      return text;
    } catch (err) {
      lastErr = err;
      console.error(`AI ${name} failed:`, err.message);
    }
  }
  throw (
    lastErr ||
    new Error(
      'No AI provider configured — add GEMINI_API_KEY, GROQ_API_KEY or TOKENROUTER_API_KEY to .env and restart the server'
    )
  );
}

module.exports = {
  AI_TIMEOUT_MS,
  GEMINI_CHAIN,
  GEMINI_LITE,
  CLAUDE_MODEL,
  groqSlot,
  validKey,
  configuredProviders,
  callGemini,
  callClaude,
  callGroq,
  callOpenAI,
  callTokenRouter,
  callSambaNova,
  callPollinations,
  callModel,
  callAI,
};
