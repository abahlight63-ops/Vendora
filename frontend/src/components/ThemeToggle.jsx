// ── frontend/src/components/ThemeToggle.jsx ──────────────────────
// WHAT: the sun/moon sliding pill button (topbar + landing nav).
// Dumb component: receives `theme` + `onToggle` props, renders accordingly.
// (Smart logic lives in lib/theme.js's useTheme hook — this is just the face.)
// No npm modules — React + CSS classes from styles.css.
export default function ThemeToggle({ theme, onToggle }) { // export default = `import ThemeToggle from …` (no braces). Destructure props directly in params.
  const dark = theme === 'dark'; // boolean reused 4× below (readability > repeated === checks)
  return (
    <button // a real <button> (keyboard-focusable + screen-reader friendly, unlike a div)
      className={'theme-toggle' + (dark ? ' on' : '')} // ' on' slides the knob + darkens the track (CSS does the animation)
      onClick={onToggle} // React synthetic event (works on all browsers, auto-cleanup)
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'} // hover tooltip…
      aria-label="Toggle dark mode" // …+ screen-reader label (accessibility: icon-only buttons MUST label themselves)
      type="button" // type="button" prevents accidental form submits if ever nested in a <form>
    >
      <span className="tt-track">
        <span className="tt-icon sun">☀</span>
        <span className="tt-icon moon">☾</span>
        <span className="tt-knob" />
      </span>
    </button>
  );
}
// Usage: <ThemeToggle theme={theme} onToggle={toggleTheme} /> (self-closing = no children)
