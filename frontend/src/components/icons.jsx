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
    case 'bell': return (<svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>);
    case 'lock': return (<svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
    case 'chev': return (<svg {...p}><path d="M6 9l6 6 6-6" /></svg>);
    case 'x': return (<svg {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>);
    case 'camera': return (<svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>);
    case 'refresh': return (<svg {...p}><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" /></svg>);
    case 'mega': return (<svg {...p}><path d="M3 11l18-7v16L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>);
    case 'warn': return (<svg {...p}><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>);
    case 'cash': return (<svg {...p}><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>);
    case 'plug': return (<svg {...p}><path d="M9 7V2M15 7V2M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /></svg>);
    case 'copy': return (<svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
    case 'gift': return (<svg {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8s-1.5-5-4.5-5S5 8 12 8zM12 8s1.5-5 4.5-5S19 8 12 8z" /></svg>);
    case 'profile': return (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>);
    /* the chat's suggestion cards — one glyph per thing you can actually ask
       for (write it / price it / think of it / answer them) */
    case 'pencil': return (<svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>);
    case 'tag': return (<svg {...p}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4V4a1 1 0 0 1 1-1h8.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.3" /></svg>);
    case 'bulb': return (<svg {...p}><path d="M9.5 18h5M10.5 21h3" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 .9 1.7V17h5.4v-1.5c0-.7.4-1.3.9-1.7A6 6 0 0 0 12 3z" /></svg>);
    /* sign out — a door and an arrow leaving it (never a bare "X", which reads
       as "close this panel") */
    case 'logout': return (<svg {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 16l4-4-4-4" /><path d="M14 12H3" /></svg>);
    /* install — an arrow dropping into a tray. Deliberately NOT a phone: a
       phone glyph on an "Install app" button reads as "call us" or "mobile
       version", which is the opposite of what the button does. */
    case 'install': return (<svg {...p}><path d="M12 3v10M8.5 9.5L12 13l3.5-3.5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>);
    case 'download': return (<svg {...p}><path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" /><path d="M4 20h16" /></svg>);
    default: return (<svg {...p}><circle cx="12" cy="12" r="9" /></svg>);
  }
}
