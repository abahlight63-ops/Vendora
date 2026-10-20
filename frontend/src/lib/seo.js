// ── frontend/src/lib/seo.js ─────────────────────────────────────────
// WHAT: one call that gives a public page its search identity — tab title,
// meta description and canonical URL.
//
// WHY A HELPER, NOT INLINE CODE: this is a single-page app. The server ships
// ONE <head>, so every route inherits the same canonical unless the route
// corrects it. Left alone, /faq, /privacy and /terms would all declare
// themselves duplicates of "/" and disappear from search. One function keeps
// that correction in one place.
//
// SCOPE: public pages only (landing, login, reset, FAQ, privacy, terms).
// Signed-in pages are set to noindex by Shell.jsx — they are an empty shell
// before login, so indexing them helps nobody.
export const APP_URL = 'https://app.velosalesai.com.ng';

export function setPageMeta({ title, description, canonical, robots }) {
  if (title) document.title = title;

  if (description) {
    const d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', description);
  }

  if (canonical) {
    const c = document.querySelector('link[rel="canonical"]');
    if (c) c.setAttribute('href', canonical);
  }

  if (robots !== false) {
    const r = document.querySelector('meta[name="robots"]');
    if (r) r.setAttribute('content', robots || 'index,follow'); // default: public pages are indexable
  }
}
