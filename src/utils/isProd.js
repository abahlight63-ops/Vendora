// ── src/utils/isProd.js ───────────────────────────────────────────
// True on the live server. Render sets RENDER=true on its own, so production
// protections switch on there even if NODE_ENV was never set.
module.exports = function isProd() {
  return process.env.NODE_ENV === 'production' || !!process.env.RENDER;
};
