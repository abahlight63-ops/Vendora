// ── frontend/src/lib/theme.js ──────────────────────────────────────
// WHAT: dark/light mode state. Light (calm white surfaces + purple CTAs) is
// the default per DESIGN.md; premium dark is one tap away.
// The theme lives on <html data-theme="dark">, CSS variables react to it,
// and localStorage remembers the choice across visits.
// React pattern: a CUSTOM HOOK (useX function using useState/useEffect).
// No npm modules — React only.
import { useEffect, useState } from 'react'; // useState = component memory; useEffect = run code on change/mount

export function getTheme() { // read saved choice (or default). Exported for tests/first-paint use.
  try {
    const saved = localStorage.getItem('velosales-theme'); // browser storage (survives reloads); fresh key (old vendora-theme ignored!)
    if (saved === 'dark' || saved === 'light') return saved; // whitelist: only accept our two values (ignore junk)
  } catch {} // private-mode browsers throw on localStorage — fail silently to default
  return 'light'; // light-first (DESIGN.md): calm, white surfaces, purple CTAs — dark is one tap away
}

export function useTheme() { // the hook components actually use: const [theme, toggle] = useTheme()
  const [theme, setTheme] = useState(() => getTheme()); // lazy init (reads storage ONCE, not every render)
  useEffect(() => { // effect runs AFTER render whenever `theme` changes (dependency array [theme])
    document.documentElement.dataset.theme = theme; // <html data-theme="…"> → matching CSS rules activate (whole app re-skins, zero re-render!)
    try { localStorage.setItem('velosales-theme', theme); } catch {} // persist choice (same private-mode guard)
  }, [theme]); // [theme] = re-run only when theme changes (not every render)
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]; // pair: value + flip function
}
