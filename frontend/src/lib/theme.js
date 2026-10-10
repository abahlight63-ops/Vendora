// ── frontend/src/lib/theme.js ──────────────────────────────────────
// WHAT: dark/light mode state. Premium dark is the default; calm
// white+blue light is one tap away (easy on sensitive eyes).
// The theme lives on <html data-theme="dark">, CSS variables react to it,
// and localStorage remembers the choice across visits.
// React pattern: a CUSTOM HOOK (useX function using useState/useEffect).
// No npm modules — React only.
import { useEffect, useState } from 'react'; // useState = component memory; useEffect = run code on change/mount

export function getTheme() { // read saved choice (or default). Exported for tests/first-paint use.
  try {
    const saved = localStorage.getItem('velosales-theme'); // browser storage (survives reloads); fresh key (old vendora-theme ignored!)
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved; // whitelist: only accept our values (ignore junk)
  } catch {} // private-mode browsers throw on localStorage — fail silently to default
  return 'system'; // default to the system setting per DESIGN.md
}

function resolveTheme(choice) {
  if (choice === 'light' || choice === 'dark') return choice;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {}
  return 'light';
}

export function useTheme() { // the hook components actually use: const [theme, toggle] = useTheme()
  const [choice, setChoice] = useState(() => getTheme()); // lazy init (reads storage ONCE, not every render)
  const [theme, setTheme] = useState(() => resolveTheme(getTheme()));
  useEffect(() => { // effect runs AFTER render whenever `choice` changes
    const resolved = resolveTheme(choice);
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved; // <html data-theme="…"> → matching CSS rules activate (whole app re-skins, zero re-render!)
    try { localStorage.setItem('velosales-theme', choice); } catch {} // persist choice (same private-mode guard)
  }, [choice]); // [choice] = re-run only when choice changes (not every render)
  useEffect(() => {
    if (choice !== 'system') return;
    let mq = null;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return; }
    const onChange = () => {
      const resolved = resolveTheme('system');
      setTheme(resolved);
      document.documentElement.dataset.theme = resolved;
    };
    try { mq.addEventListener('change', onChange); } catch { try { mq.addListener(onChange); } catch {} }
    return () => { try { mq.removeEventListener('change', onChange); } catch { try { mq.removeListener(onChange); } catch {} } };
  }, [choice]);
  const setMode = (m) => setChoice(m === 'dark' || m === 'light' || m === 'system' ? m : 'system');
  return [theme, () => setChoice((t) => (resolveTheme(t) === 'dark' ? 'light' : 'dark')), setMode, choice]; // pair: value + flip function (+ explicit setter for Settings System/Light/Dark)
}
