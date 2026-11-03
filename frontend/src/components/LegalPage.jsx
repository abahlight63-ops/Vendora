// ── frontend/src/components/LegalPage.jsx ──────────────────────────
// WHAT: the shared layout for Privacy and Terms: a violet header with the date,
// print and contact buttons, a "short version" box, a contents list (a side rail
// on desktop, a dropdown on phones) that follows the reader, and the sections.
// The documents themselves live in pages/Privacy.jsx and pages/Terms.jsx.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import SiteFooter from './SiteFooter.jsx';

export const CONTACT = 'velosales63@gmail.com';
export const EFFECTIVE = '3 November 2026';

export default function LegalPage({ which, title, sub, icon, short, sections }) {
  const [on, setOn] = useState(sections[0]?.id);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const els = sections.map((x) => document.getElementById(x.id)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !els.length) return undefined;
    const io = new IntersectionObserver((list) => {
      const vis = list.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setOn(vis.target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);
  const jump = (id) => { setOpen(false); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div className="lg">
      <header className="lg-top">
        <Link className="lg-brand" to="/"><Logo size={24} alt="" />VeloSales Ai</Link>
        <nav aria-label="Legal pages">
          <Link className={which === 'privacy' ? 'on' : ''} to="/privacy">Privacy</Link>
          <Link className={which === 'terms' ? 'on' : ''} to="/terms">Terms</Link>
          <Link to="/faq">FAQ</Link>
        </nav>
      </header>
      <section className="lg-hero">
        <span className="lg-tag">{icon}Legal</span>
        <h1>{title}</h1>
        <p>Effective {EFFECTIVE} · {sub}</p>
        <div className="lg-acts">
          <button type="button" onClick={() => window.print()}>Print or save as PDF</button>
          <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(title + ' question')}`}>Ask a question</a>
        </div>
      </section>
      <div className="lg-grid">
        <aside className="lg-toc">
          <button type="button" className="lg-toc-btn" aria-expanded={open} onClick={() => setOpen(!open)}>On this page<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg></button>
          <nav className={'lg-toc-list' + (open ? ' open' : '')} aria-label="On this page">
            <div className="lg-toc-head">On this page</div>
            {sections.map((x, i) => <a key={x.id} href={'#' + x.id} className={on === x.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); jump(x.id); }}><span>{i + 1}</span>{x.title}</a>)}
          </nav>
        </aside>
        <article className="lg-body">
          <section className="lg-short"><b>The short version</b><ul>{short.map((t) => <li key={t}>{t}</li>)}</ul></section>
          {sections.map((x, i) => (
            <section key={x.id} id={x.id} className="lg-sec">
              <h2>{i + 1}. {x.title}</h2>
              {x.body}
            </section>
          ))}
          <p className="lg-fine">This document was written to be clear and fair. It is not legal advice; if you have a specific legal question, please speak to a lawyer.</p>
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}
