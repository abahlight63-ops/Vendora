// ── vite.config.js ───────────────────────────────────────────────
// WHAT: Vite's settings file (Vite = the frontend build tool: dev server with
// instant reload + production bundler). `npm run frontend:dev` reads this.
// LESSON: config-as-code — tools read a JS file exporting options instead of
// endless CLI flags. defineConfig() just adds editor autocomplete/validation.
// MODULES (devDependencies — only needed to BUILD, never in production):
//   vite — the build tool itself (dev server, HMR, Rollup bundling).
//   @vitejs/plugin-react — teaches Vite JSX + Fast Refresh (state-preserving
//     hot reload: edit a component, see it instantly WITHOUT losing state!).
import { defineConfig } from 'vite'; // defineConfig wrapper (type-safety + autocomplete in editors)
import react from '@vitejs/plugin-react'; // React plugin (JSX transform + Fast Refresh)

export default defineConfig({ // export the config object (Vite CLI imports this file)
  root: 'frontend', // project root: index.html + src/ live here (NOT repo root — keeps backend/frontend separated!)
  plugins: [react()], // activate the React plugin (call it: plugins are factory functions!)
  server: { // `npm run frontend:dev` dev-server options (localhost only — production uses Express static instead!)
    port: 5173, // dev URL: http://localhost:5173 (Vite default port)
    proxy: { // PROXY = dev convenience: frontend calls /api/… on :5173, Vite FORWARDS to Express :3000 (no CORS setup needed locally! production needs none either — same origin via Express static!)
      '/api': 'http://localhost:3000', // any /api/* request → Express backend…
      '/webhook': 'http://localhost:3000', // …same for webhooks (playground testing)…
      '/logo.png?v=3': 'http://localhost:3000', // …and the logo (served by Express public/ in prod)
    },
  },
  build: { outDir: '../dist', emptyOutDir: true }, // `npm run build` output: ../dist (repo root! Express serves it). emptyOutDir = wipe stale files first (no ghost assets from old builds!)
});
