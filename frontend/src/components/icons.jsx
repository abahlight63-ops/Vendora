// ── frontend/src/components/icons.jsx ────────────────────────────
// WHAT: the app's ONLY icon set — one component, ~20 stroke-style SVGs.
// Usage: <Ic n="chat" s={18} /> (n = name, s = pixel size, default 16).
// stroke="currentColor" = icons inherit surrounding TEXT color (theme-safe).
// No emoji, no icon library installed (zero deps, instant load).
// SVG LESSON: viewBox = 24×24 coordinate grid; paths draw inside it;
// strokeLinecap round = soft line ends; aria-hidden = screen readers skip decor.
// Single SVG icon set — stroke style, inherits text color. No emojis.
export default function Ic({ n, s = 16 }) { // export default + destructured props with default size
  const p = { viewBox: '0 0 24 24', width: s, height: s, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }; // shared props spread into every case below ({...p} would also work)
  switch (n) {
    case 'bolt': return (<svg {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>);
    case 'spark': return (<svg {...p}><path d="M12 3v4M9 13h.01M15 13h.01M9.5 16.5h5" /><rect x="5" y="7" width="14" height="12" rx="3" /></svg>);
    case 'hand': return (<svg {...p}><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9M10 20a2.2 2.2 0 0 0 4 0" /></svg>);
    case 'check': return (<svg {...p}><path d="M20 6L9 17l-5-5" /></svg>);
    case 'checkCircle': return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></svg>);
    case 'mail': return (<svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>);
    case 'plus': return (<svg {...p}><path d="M12 5v14M5 12h14" /></svg>);
    case 'trash': return (<svg {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6" /></svg>);
    case 'back': return (<svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>);
    case 'next': return (<svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
    case 'box': return (<svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></svg>);
    case 'chat': return (<svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l2-5.3a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 9 8.5z" /></svg>);
    case 'chart': return (<svg {...p}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>);
    case 'card': return (<svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>);
    case 'gear': return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>);
    case 'help': return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01" /></svg>);
    case 'phone': return (<svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9z" /></svg>);
    case 'clock': return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
    case 'send': return (<svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>);
    case 'store': return (<svg {...p}><path d="M4 10v10h16V10M2 7l2-4h16l2 4M2 7h20M2 7v3a2.5 2.5 0 0 0 5 0V7M17 7v3a2.5 2.5 0 0 0 5 0V7" /></svg>);
    case 'shield': return (<svg {...p}><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" /><path d="M9 11.5l2 2 4-4.5" /></svg>);
    case 'play': return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></svg>);
    case 'eye': return (<svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>);
    case 'eyeOff': return (<svg {...p}><path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.06-4.94M9.9 4.24A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M2 2l20 20" /></svg>);
    default: return (<svg {...p}><circle cx="12" cy="12" r="9" /></svg>);
  }
}
