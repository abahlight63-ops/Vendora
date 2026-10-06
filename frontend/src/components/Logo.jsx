// ── frontend/src/components/Logo.jsx ─────────────────────────────────
// WHAT: the brand mark — /logo-mark.png (public/), the supplied gold-on-black
// logo. One file for every logo in the app (sidebar, topbar, landing footer)
// so the mark can be swapped in exactly one place.
// (Single premium theme: no variants, no theme swaps.)
export default function Logo({ className, alt = 'VeloSales AI', width, height }) {
  return <img src="/logo-mark.png" className={className} alt={alt} width={width} height={height} decoding="async" />;
}