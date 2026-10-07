// ── frontend/src/main.jsx ────────────────────────────────────────
// WHAT: React's ignition key. Finds #root in index.html, wraps App in
// StrictMode (dev double-checks) + BrowserRouter (URL routing), renders.
// Runs ONCE per page load. No npm modules beyond react/react-dom/router.
// MODULES (installed via npm — see package.json lesson at the end):
//   react — the UI library (components, hooks). `import React` needed for JSX.
//   react-dom/client — React → real DOM bridge. createRoot().render() mounts.
//   react-router-dom — BrowserRouter: syncs what's on screen with the URL.
import React from 'react'; // React namespace (StrictMode below comes from it)
import { createRoot } from 'react-dom/client'; // createRoot = React 18+ mounting API (replaces old ReactDOM.render)
import { BrowserRouter } from 'react-router-dom'; // Router using real URLs (/dashboard) via History API (needs server SPA fallback!)
import App from './App.jsx'; // our route table + providers (default import)
import './styles.css'; // importing CSS in JS = Vite bundles + injects it (one global stylesheet)
import { initInstall } from './lib/install.js'; // install-as-app plumbing (worker + Chrome prompt capture — once per load!)

initInstall(); // register /sw-app.js + catch beforeinstallprompt (idempotent — StrictMode-safe!)

// Find <div id="root"> in frontend/index.html and take it over:
createRoot(document.getElementById('root')).render( // document.getElementById = raw DOM lookup; .render() paints React inside
  <React.StrictMode> {/* dev-only double-render that surfaces impure-component bugs (no-op in production build) */}
    <BrowserRouter> {/* provides routing context: useLocation/NavLink/Routes work anywhere below */}
      <App /> {/* the actual app (self-closing = no children) */}
    </BrowserRouter>
  </React.StrictMode>
);
