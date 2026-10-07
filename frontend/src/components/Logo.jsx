// ── frontend/src/components/Logo.jsx ───────────────────────────────
// WHAT: the brand mark — signature green neon, everywhere, both themes.
// (Single premium dark theme: no variants, no swaps, no surprises.)
export default function Logo({ className, alt = 'VeloSales Ai', width, height }) {
  return <img src="/logo-green.png?v=2" className={className} alt={alt} width={width} height={height} />;
}
