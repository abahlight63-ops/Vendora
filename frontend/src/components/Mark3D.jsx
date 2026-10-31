// ── frontend/src/components/Mark3D.jsx ─────────────────────────────
// WHAT: the canvas wrapper around mark3d-core.js. Owns the clock, the pointer,
// the size and everything that keeps it polite: it pauses when off-screen or in
// a background tab, and under reduced motion it draws one still frame.
import { useEffect, useRef, useState } from 'react';
import Logo from './Logo.jsx';
import { drawScene } from './mark3d-core.js';

const LABEL = 'The VeloSales Ai mark with WhatsApp and Telegram orbiting it. Instagram is coming soon.';

export default function Mark3D({ className }) {
  const box = useRef(null);
  const canvas = useRef(null);
  const [flat, setFlat] = useState(false); // no canvas support → the flat logo, never a blank space

  useEffect(() => {
    const el = canvas.current;
    const host = box.current; // kept here: React clears the ref before this effect's cleanup runs
    const ctx = el && el.getContext ? el.getContext('2d') : null;
    if (!ctx || typeof Path2D === 'undefined') { setFlat(true); return undefined; }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, raf = 0, last = 0, t = 0;
    let onScreen = true;
    let px = 0, py = 0, tx = 0, ty = 0;

    const paint = () => drawScene(ctx, w, h, { t, px, py, still: motion.matches });
    const size = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };
    const frame = (now) => {
      t += Math.min((now - last) / 1000, 0.05); // a long pause must not jump the scene
      last = now;
      px += (tx - px) * 0.08; py += (ty - py) * 0.08;
      paint();
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (motion.matches || !onScreen || document.hidden) { paint(); return; }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const aim = (e) => {
      const r = el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 + 200)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2 + 200)));
    };
    const onMove = (e) => { if (e.pointerType === 'mouse') aim(e); };
    const onLeave = () => { tx = 0; ty = 0; };

    const resize = new ResizeObserver(size);
    resize.observe(host);
    const seen = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; start(); });
    seen.observe(el);
    size();
    start();
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    el.addEventListener('pointerdown', aim);
    el.addEventListener('pointermove', aim);
    el.addEventListener('pointerup', onLeave);
    el.addEventListener('pointercancel', onLeave);
    document.addEventListener('visibilitychange', start);
    motion.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      seen.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('pointerdown', aim);
      el.removeEventListener('pointermove', aim);
      el.removeEventListener('pointerup', onLeave);
      el.removeEventListener('pointercancel', onLeave);
      document.removeEventListener('visibilitychange', start);
      motion.removeEventListener('change', start);
    };
  }, []);

  if (flat) return <div className={className}><Logo size={180} alt="VeloSales Ai" /></div>;
  return (
    <div ref={box} className={className}>
      <canvas ref={canvas} role="img" aria-label={LABEL} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'pan-y' }} />
    </div>
  );
}
