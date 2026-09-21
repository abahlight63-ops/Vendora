// ── frontend/src/components/Logo.jsx ───────────────────────────────
// WHAT: the theme-aware brand mark — blue neon on dark mode, green neon
// on light mode. Drop-in for every <img src="/logo.png…"> lockup.
// No npm modules — useTheme hook only.
import { useTheme } from '../lib/theme.js';

export default function Logo({ className, alt = 'VeloSales Ai', width, height }) {
  const [theme] = useTheme(); // 'light' | 'dark' (persisted, applied to <html>)
  const src = theme === 'light' ? '/logo-green.png?v=1' : '/logo-blue.png?v=1';
  return <img src={src} className={className} alt={alt} width={width} height={height} />;
}
