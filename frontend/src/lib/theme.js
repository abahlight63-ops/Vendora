// ── frontend/src/lib/theme.js ────────────────────────────────────
// WHAT: dark/light mode state. The theme lives on <html data-theme="dark">,
// CSS variables in styles.css react to it ([data-theme="dark"] overrides),
// and localStorage remembers the choice across visits.
// React pattern: a CUSTOM HOOK (useX function using useState/useEffect) so any
// component gets [theme, toggle] with two lines. No npm modules — React only.
import { useEffect, useState } from 'react'; // useState = component memory; useEffect = run code on change/mount

export function getTheme() { // read saved choice (or default). Exported for tests/first-paint use.
  try {
    const saved = localStorage.getItem('vendora-theme'); // localStorage = browser key-value storage (survives reloads)
    if (saved === 'dark' || saved === 'light') return saved; // whitelist: only accept our two values (ignore junk)
  } catch {} // try/catch with EMPTY block: private-mode browsers throw on localStorage — fail silently to default
  return 'light'; // default theme for first-time visitors
}

export function useTheme() { // the hook components actually use: const [theme, toggle] = useTheme()
  const [theme, setTheme] = useState(() => getTheme()); // useState(initial): lazy init via function (reads storage ONCE, not every render)
  useEffect(() => { // effect runs AFTER render whenever `theme` changes (dependency array [theme])
    document.documentElement.dataset.theme = theme; // <html data-theme="dark"> → CSS [data-theme="dark"] rules activate (the whole app re-skins with zero re-render!)
    try { localStorage.setItem('vendora-theme', theme); } catch {} // persist choice (same private-mode guard)
  }, [theme]); // [theme] = re-run effect only when theme changes (not on every render)
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]; // return pair: current value + flip function (t = previous value)
}
