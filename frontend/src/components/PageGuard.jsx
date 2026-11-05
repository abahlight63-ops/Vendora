// ── frontend/src/components/PageGuard.jsx ──────────────────────────
// WHAT: two safety nets against blank pages.
// 1. lazyPage(): page files get new names on every release. A browser still on
//    the old version asks for a file that no longer exists and the page stayed
//    blank until a manual refresh. Now it retries, and if the file is truly
//    gone it reloads the app once to fetch the new version.
// 2. <PageBoundary>: if a page crashes while drawing, show a friendly card with
//    Try again instead of an empty screen. It resets when you change page.
import { Component, lazy } from 'react';

const FLAG = 'vs-chunk-reload';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export function lazyPage(load) {
  return lazy(async () => {
    for (let i = 0; i < 2; i++) {
      try { const m = await load(); try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ } return m; } catch (e) { await wait(600); }
    }
    let reloaded = false;
    try { reloaded = sessionStorage.getItem(FLAG) === '1'; sessionStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
    if (!reloaded) { window.location.reload(); return new Promise(() => {}); } // a new version is out: load it once
    return load(); // already reloaded once: let the boundary show the friendly card
  });
}
if (typeof window !== 'undefined') { // Vite's own signal that a preloaded file is missing after a release
  window.addEventListener('vite:preloadError', (e) => {
    try { if (sessionStorage.getItem(FLAG) === '1') return; sessionStorage.setItem(FLAG, '1'); } catch { return; }
    e.preventDefault(); window.location.reload();
  });
}

export class PageBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error('page crashed:', err && err.message); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page"><div className="lf lf-error" role="alert">
        <div className="lf-art" aria-hidden="true"><span className="lf-ring" /><span className="lf-tile"><svg className="lf-ic" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg></span></div>
        <span className="lf-tag">Something went wrong</span>
        <h2>This page did not open</h2>
        <p>Nothing is lost. Tap Try again; if it keeps happening, tell us from Help and we will fix it.</p>
        <div className="lf-btns"><button type="button" className="btn lf-go" onClick={() => window.location.reload()}>Try again</button><a className="btn ghost" href="/help">Get help</a></div>
      </div></div>
    );
  }
}
