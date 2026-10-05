// ── frontend/src/lib/theme.js ──────────────────────────────────────
// WHAT: the appearance preference: 'system' (default) | 'light' | 'dark'.
// 'system' follows the OS live; picking a side pins it and localStorage
// remembers it. The RESOLVED theme ('light'/'dark') lands on
// <html data-theme="…"> and the CSS variables in styles.css react to it.
// React pattern: a CUSTOM HOOK (useX function using useState/useEffect).
// No npm modules — React only.
import { useEffect, useState } from 'react'; // useState = component memory; useEffect = run code on change/mount

const KEY = 'velosales-theme'; // one storage key holds the preference (not the resolved theme)
const SIDES = ['system', 'light', 'dark']; // whitelist: anything else in storage is junk and gets ignored

function readPref() { // readPref() -> 'system' | 'light' | 'dark' (never throws, even in private mode)
  try {
    const saved = localStorage.getItem(KEY); // browser storage (survives reloads); fresh key (old vendora-theme ignored!)
    if (SIDES.includes(saved)) return saved; // whitelist: only accept our own values
  } catch {} // private-mode browsers throw on localStorage — fail silently to the default
  return 'system'; // first visit follows the OS, exactly like every native app
}

function osPrefersDark() { // the OS setting, read safely (matchMedia missing in ancient browsers/tests)
  try { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch {}
  return false; // no signal = assume light (the calmer default for long reading sessions)
}

export function resolveTheme(pref) { // pref -> the theme that actually paints
  return pref === 'system' ? (osPrefersDark() ? 'dark' : 'light') : pref;
}

export function getTheme() { // resolved theme right now. Exported for tests / first-paint use.
  return resolveTheme(readPref());
}

export function useTheme() { // the hook components use: const [theme, toggleTheme, pref, setPref] = useTheme()
  const [pref, setPref] = useState(readPref); // lazy init (reads storage ONCE, not every render)
  const [systemDark, setSystemDark] = useState(osPrefersDark); // live copy of the OS setting

  useEffect(() => { // 'system' must keep up with the OS (someone flips their laptop at sunset)
    let mq = null;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch {}
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange); // modern browsers
    else if (mq.addListener) mq.addListener(onChange); // Safari < 14
    return () => { // unmount -> stop listening (no leaked listener)
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []); // mount-only

  const theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref; // what components read

  useEffect(() => { // runs AFTER render whenever the preference changes
    const el = document.documentElement;
    el.dataset.theme = theme; // <html data-theme="…"> → matching CSS rules activate (whole app re-skins, zero re-render!)
    el.dataset.themePref = pref; // the raw choice stays readable for QA + the Settings control
    try { localStorage.setItem(KEY, pref); } catch {} // persist choice (same private-mode guard)
  }, [pref, theme]); // re-run only when the choice (or its resolution) changes

  const toggleTheme = () => setPref(theme === 'dark' ? 'light' : 'dark'); // the sun/moon quick toggle pins the opposite side
  return [theme, toggleTheme, pref, setPref]; // pair kept for existing callers; pref/setPref added for Settings
}