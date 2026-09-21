// ── frontend/src/lib/theme.js ────────────────────────────────────
// WHAT: dark/light mode state. The theme lives on <html data-theme="dark">,
// CSS variables in styles.css react to it ([data-theme="dark"] overrides),
// and localStorage remembers the choice across visits.
// React pattern: a CUSTOM HOOK (useX function using useState/useEffect) so any
// component gets [theme, toggle] with two lines. No npm modules — React only.
import { useEffect, useState } from 'react'; // useState = component memory; useEffect = run code on change/mount

export function getTheme() { // single premium dark theme (light mode removed — one look everywhere!)
  return 'dark';
}

export function useTheme() { // the hook components actually use: const [theme, toggle] = useTheme()
  const [theme] = useState('dark'); // fixed (no state to flip — toggle below is a no-op kept for API shape!)
  useEffect(() => { // effect runs AFTER render (mount-only here — theme never changes)
    document.documentElement.dataset.theme = 'dark'; // <html data-theme="dark"> → dark glass always
    try { localStorage.setItem('vendora-theme', 'dark'); } catch {} // persist (same private-mode guard)
  }, []); // [] = once (theme is constant now, not state!)
  return [theme, () => {}]; // toggle = no-op (ThemeToggle unmounted — kept so callers don't crash!)
}
