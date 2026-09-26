// ── frontend/src/lib/install.js ────────────────────────────────────
// WHAT: "install as app" plumbing in ONE place (Chrome install prompt +
// platform detection + worker registration). Pages/components import from
// here — nobody touches window.beforeinstallprompt directly.
// FLOW: main.jsx calls initInstall() once → worker registers, prompt event
// captured when Chrome deems the app installable → InstallApp card offers a
// one-tap Install button; iOS (no prompt API) gets manual steps instead.
// No npm modules — DOM events + navigator only.
let deferred = null; // the captured prompt event (null = Chrome hasn't offered yet / already installed!)
const listeners = new Set(); // subscribers re-render when installability changes (tiny pub-sub, no context needed!)

function emit() { listeners.forEach((fn) => { try { fn(); } catch {} }); } // notify cards (one throwing subscriber never breaks the rest!)
export function onInstallChange(fn) { // subscribe (returns unsubscribe — useEffect cleanup!)
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initInstall() { // call ONCE from main.jsx (idempotent — safe under StrictMode double-invoke!)
  if (typeof window === 'undefined' || window.__pwaInit) return;
  window.__pwaInit = true; // guard flag (StrictMode mounts twice in dev — one listener set only!)
  window.addEventListener('beforeinstallprompt', (e) => { // Chrome: "this app is installable NOW" (needs HTTPS + manifest + worker + engagement!)
    e.preventDefault(); // hold it (we show OUR button on OUR timing, not Chrome's mini-bar!)
    deferred = e; // stash for the Install button (prompt() fires the system dialog!)
    emit(); // cards flip from "how-to" steps to the one-tap button, live!
  });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); }); // installed → button becomes "Installed ✓"
  if ('serviceWorker' in navigator) { // the install KEY (no worker + fetch handler = no prompt, ever!)
    const reg = () => navigator.serviceWorker.register('/sw-app.js').catch(() => {}); // catch: private mode / http — app works on without it!
    if (document.readyState === 'complete') reg();
    else window.addEventListener('load', reg, { once: true }); // after load (never competes with first paint!)
  }
}

export function canInstall() { return !!deferred; } // one-tap button available?

export async function promptInstall() { // returns 'accepted' | 'dismissed' | 'unavailable'
  if (!deferred) return 'unavailable'; // iOS / already-installed / Chrome not ready (callers show manual steps!)
  deferred.prompt(); // the SYSTEM dialog (name + icon + Install — this is what users film!)
  const { outcome } = await deferred.userChoice; // wait for their tap (accepted/dismissed!)
  deferred = null; // one-shot (Chrome demands a fresh event per prompt!)
  emit();
  return outcome;
}

export function isStandalone() { // already launched AS the app (no install button needed — show "Installed ✓")?
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; // matchMedia = Android/desktop Chrome; navigator.standalone = iOS Safari!
}

export function isIos() { // iPhone/iPad (no prompt API — manual Share → Add to Home Screen steps!)
  const ua = window.navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1); // second clause = iPadOS pretending to be a Mac!
}
