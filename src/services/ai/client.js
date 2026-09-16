// ── src/services/ai/client.js ────────────────────────────────────
// WHAT: the low-level AI transport layer — keys, timeouts, rate governor,
// and one caller per provider (Gemini / Claude / Groq / OpenAI / OpenRouter
// / Cerebras / SambaNova / Pollinations).
// The BRAIN lives in ../replyEngine.js (prompts + grounding); THIS file only
// moves text to providers and back. No prompts here, no business logic.
// WHY SPLIT: replyEngine was doing transport + prompting + parsing in one
// 470-line file. Now: client.js = "how to call", replyEngine.js = "what to say".
// MODULES: none — global fetch only (Node 18+). No SDKs, no langchain.
//
// MULTI-KEY DESIGN (2 models per key — stops the "busy" problem):
// Each Groq key gets its OWN RPM bucket, and each catalog model is pinned to
// a preferred key slot (see aiModels.js keySlot). Key 1 → 2 fast models,
// Key 2 → 2 smart models, Key 3 → 2 reasoning models. If the preferred key
// is rate-limited, the caller automatically tries the OTHER keys before
// giving up — so one hammered key never blocks the rest.

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

// ── Per-KEY rate governors: ONE bucket per API key (not one shared bucket).
// Before: all 7 Groq models shared a single 30/min bucket → "busy" all the
// time. After: Key 1 has its own 30/min, Key 2 its own 30/min, Key 3 its own
// 30/min = 90/min total. Same trick for Cerebras / SambaNova (2 keys each).
const _buckets = new Map(); // keyIndex string → hits array
function _bucket(name, idx) {
  const k = `${name}:${idx}`;
  if (!_buckets.has(k)) _buckets.set(k, []);
  return _buckets.get(k);
}
async function _takeSlot(name, idx, rpm) {
  const hits = _bucket(name, idx);
  const windowMs = 60 * 1000;
  for (let i = 0; i < 20; i++) {
    const now = Date.now();
    while (hits.length && hits[0] <= now - windowMs) hits.shift();
    if (hits.length < rpm) {
      hits.push(now);
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// Legacy single-key governor (kept for backwards-compat + tests that import
// groqSlot directly). Delegates to key slot 0.
async function groqSlot() {
  return _takeSlot('groq', 0, GROQ_RPM);
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

// ── Key pools: GROQ_API_KEY + GROQ_API_KEY_2 + GROQ_API_KEY_3 (+ optional
// GROQ_API_KEYS="k1,k2,k3" comma list). Same pattern for Cerebras/SambaNova.
// Each entry = 2 models (see aiModels.js keySlot), each key = own RPM bucket.
function _pool(...names) {
  const out = [];
  for (const n of names) {
    const v = process.env[n];
    if (validKey(v)) {
      for (const k of String(v).split(',')) {
        const t = k.trim();
        if (t.length > 15 && !t.includes('...') && !t.includes('xxxxx') && !out.includes(t)) out.push(t);
      }
    }
  }
  return out;
}
function groqKeys() {
  return _pool('GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEYS');
}
function cerebrasKeys() {
  return _pool('CEREBRAS_API_KEY', 'CEREBRAS_API_KEY_2', 'CEREBRAS_API_KEYS');
}
function sambanovaKeys() {
  return _pool('SAMBANOVA_API_KEY', 'SAMBANOVA_API_KEY_2', 'SAMBANOVA_API_KEYS');
}
let _groqCursor = 0;
let _cerebrasCursor = 0;
let _sambaCursor = 0;

function configuredProviders() {
  return {
    gemini: validKey(process.env.GEMINI_API_KEY),
    claude: validKey(process.env.ANTHROPIC_API_KEY),
    groq: groqKeys().length > 0,
    groq2: groqKeys().length > 1, // 2nd key present (2 more models stay fast)
    groq3: groqKeys().length > 2, // 3rd key present (reasoning pair stays fast)
    cerebras: cerebrasKeys().length > 0,
    sambanova: sambanovaKeys().length > 0,
    pollinations: true, // zero-key emergency fallback — always "configured"
    openrouter: validKey(process.env.OPENROUTER_API_KEY),
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

// Groq + OpenRouter + OpenAI share the OpenAI chat shape.
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

async function callGroq(system, user, modelOverride, opts, keySlot) {
  const keys = groqKeys();
  if (!keys.length) throw new Error('GROQ_API_KEY is not set');
  const model =
    modelOverride || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  // Preferred key first (2-models-per-key pinning), then round-robin the rest.
  const pref = Number.isInteger(keySlot) && keys[keySlot] ? [keySlot] : [];
  const rest = keys.map((_, i) => i).filter((i) => !pref.includes(i));
  // Rotate start position so concurrent calls spread across keys.
  const rot = _groqCursor++ % keys.length;
  const rotated = [...rest.slice(rot), ...rest.slice(0, rot)];
  const order = [...pref, ...rotated.filter((i) => !pref.includes(i))];
  let lastErr = null;
  for (const idx of order) {
    if (!(await _takeSlot('groq', idx, GROQ_RPM))) {
      lastErr = new Error(`Groq key ${idx + 1} local RPM busy — trying next key`);
      console.error(lastErr.message);
      continue;
    }
    try {
      return await callOpenAICompat(
        `Groq-${idx + 1}`,
        'https://api.groq.com/openai/v1/chat/completions',
        keys[idx],
        model,
        system,
        user,
        null,
        opts
      );
    } catch (e) {
      lastErr = e;
      console.error(`Groq key ${idx + 1} failed:`, e.message);
      // 429 / quota / overload → try next key. Auth errors (401) → also try
      // next key (it may be the bad one). Other errors → try next key too,
      // the outer fallback chain decides when to stop.
    }
  }
  throw lastErr || new Error('Groq shared quota busy — falling back');
}

async function callCerebras(system, user, modelOverride, opts) {
  const keys = cerebrasKeys();
  if (!keys.length) throw new Error('CEREBRAS_API_KEY is not set');
  const model =
    modelOverride || process.env.CEREBRAS_MODEL || 'llama-3.3-70b';
  const rot = _cerebrasCursor++ % keys.length;
  const order = [...keys.keys()].map((_, i) => (rot + i) % keys.length);
  let lastErr = null;
  for (const idx of order) {
    if (!(await _takeSlot('cerebras', idx, GROQ_RPM))) continue;
    try {
      return await callOpenAICompat(
        `Cerebras-${idx + 1}`,
        'https://api.cerebras.ai/v1/chat/completions',
        keys[idx],
        model,
        system,
        user,
        null,
        opts
      );
    } catch (e) {
      lastErr = e;
      console.error(`Cerebras key ${idx + 1} failed:`, e.message);
    }
  }
  throw lastErr || new Error('Cerebras quota busy — falling back');
}

async function callSambaNova(system, user, modelOverride, opts) {
  const keys = sambanovaKeys();
  if (!keys.length) throw new Error('SAMBANOVA_API_KEY is not set');
  const model =
    modelOverride || process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.3-70B-Instruct';
  const rot = _sambaCursor++ % keys.length;
  const order = [...keys.keys()].map((_, i) => (rot + i) % keys.length);
  let lastErr = null;
  for (const idx of order) {
    if (!(await _takeSlot('sambanova', idx, GROQ_RPM))) continue;
    try {
      return await callOpenAICompat(
        `SambaNova-${idx + 1}`,
        'https://api.sambanova.ai/v1/chat/completions',
        keys[idx],
        model,
        system,
        user,
        null,
        opts
      );
    } catch (e) {
      lastErr = e;
      console.error(`SambaNova key ${idx + 1} failed:`, e.message);
    }
  }
  throw lastErr || new Error('SambaNova quota busy — falling back');
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

async function callOpenRouter(system, user, modelOverride, opts) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!validKey(key)) throw new Error('OPENROUTER_API_KEY is not set');
  const model =
    modelOverride ||
    process.env.OPENROUTER_MODEL ||
    'meta-llama/llama-3.1-8b-instruct:free';
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  return callOpenAICompat(
    'OpenRouter',
    'https://openrouter.ai/api/v1/chat/completions',
    key,
    model,
    system,
    user,
    { 'HTTP-Referer': base, 'X-Title': 'Vendora' },
    opts
  );
}

// ── Route ONE catalog entry to its provider with its EXACT model id.
// Gemini entries pin (no chain, no affinity) so the dropdown always sticks.
// Groq entries carry keySlot (2-models-per-key) so each pair uses its own key.
async function callModel(entry, system, user, image, opts) {
  const modelId = entry.model();
  if (entry.provider === 'gemini') {
    return callGemini(system, user, image, { ...(opts || {}), model: modelId });
  }
  if (entry.provider === 'claude') {
    return callClaude(system, user, image, modelId, opts);
  }
  if (entry.provider === 'groq') {
    return callGroq(system, user, modelId, opts, entry.keySlot);
  }
  if (entry.provider === 'cerebras') {
    return callCerebras(system, user, modelId, opts);
  }
  if (entry.provider === 'sambanova') {
    return callSambaNova(system, user, modelId, opts);
  }
  if (entry.provider === 'pollinations') {
    return callPollinations(system, user, modelId, opts);
  }
  if (entry.provider === 'openrouter') {
    return callOpenRouter(system, user, modelId, opts);
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
  const order = [provider, 'groq', 'cerebras', 'sambanova', 'openrouter', 'gemini', 'claude', 'openai', 'pollinations'].filter(
    (p, i, a) => a.indexOf(p) === i
  );
  const runners = {
    gemini: () => callGemini(system, user, image),
    claude: () => callClaude(system, user, image),
    groq: () => callGroq(system, user),
    cerebras: () => callCerebras(system, user),
    sambanova: () => callSambaNova(system, user),
    openrouter: () => callOpenRouter(system, user),
    openai: () => callOpenAI(system, user),
    pollinations: () => callPollinations(system, user),
  };
  let lastErr = null;
  for (const name of order) {
    if (!has[name]) continue;
    if (image && (name === 'groq' || name === 'openrouter' || name === 'cerebras' || name === 'sambanova' || name === 'pollinations')) continue;
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
      'No AI provider configured — add GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY to .env and restart the server'
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
  groqKeys,
  cerebrasKeys,
  sambanovaKeys,
  configuredProviders,
  callGemini,
  callClaude,
  callGroq,
  callCerebras,
  callSambaNova,
  callPollinations,
  callOpenAI,
  callOpenRouter,
  callModel,
  callAI,
};
