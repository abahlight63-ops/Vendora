// ── src/services/art.js ──────────────────────────────────────────
// WHAT: on-demand image generation via image.pollinations.ai — the ONLY
// place the Pollinations key (or anonymous mode) talks to the image API.
// Used by /api/me/art (produce a welcome/splash image on demand).
// Security: the key lives server-side; the client never sees it. When the
// key is missing/invalid we fall back to anonymous mode (watermarked) so
// the feature still works. Art is generated fresh per request — callers
// that want stable art should cache the result (the controller stores the
// returned seed + prompt so future calls reuse a cached image).
// Mirrors the error conventions of client.js (throw Error with short msg).
'use strict';

async function fetchImage(url, timeoutMs, signal) {
  let t;
  const controller = signal ?? new AbortController();
  if (signal == null) {
    t = setTimeout(() => controller.abort(), timeoutMs);
  }
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'VeloSalesAIBackend/1.0' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Image generation HTTP ${res.status}: ${body.slice(0, 200)}`
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error('Image generation returned empty body');
    return { buf, type: res.headers.get('content-type') || 'image/jpeg' };
  } finally {
    if (t) clearTimeout(t);
  }
}

function buildUrl(opts) {
  const prompt = String(opts.prompt || '').trim().slice(0, 1000);
  if (!prompt) throw new Error('prompt required');
  const seed = Number.isInteger(opts.seed) ? opts.seed : Math.floor(Math.random() * 1e6);
  const key = (process.env.POLLINATIONS_API_KEY || '').trim();
  const params = new URLSearchParams({
    width: String(opts.width || 1024),
    height: String(opts.height || 1024),
    seed: String(seed),
  });
  const model = (opts.model || process.env.POLLINATIONS_MODEL_IMG || '').trim();
  if (model) params.set('model', model);
  if (key) params.set('token', key);     // keyed = no watermark
  else params.set('nologo', 'false');    // anonymous = logo overlay
  return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`, seed };
}

async function generate(opts) {
  const { url, seed } = buildUrl(opts);
  const { buf, type } = await fetchImage(url, 90000); // <- images are slow
  return { seed, buf, type };
}

module.exports = { generate };