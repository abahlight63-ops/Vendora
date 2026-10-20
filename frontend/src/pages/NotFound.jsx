// ── frontend/src/pages/NotFound.jsx ──────────────────────────────
// WHAT: the app's 404. A wrong address is not a failure — nothing broke, the
// owner is simply standing where no page lives — so this is deliberately NOT
// the red Error3D treatment. It is a calm, quiet room: the mark, one large
// numeral, one plain sentence, and the four doors most people actually want.
// SIGNED IN → rendered inside Shell (the nav stays, so "lost" lasts one click).
// SIGNED OUT → a clean public page with the mark and a way back home.
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Shell from '../components/Shell.jsx';

const APP_LINKS = [
  ['Overview', 'Your shop at a glance', '/dashboard'],
  ['Inbox', 'Every customer conversation', '/chats'],
  ['Catalog', 'Products, prices and stock', '/catalog'],
  ['AI settings', 'How your assistant sounds', '/ai-settings'],
];

const PUBLIC_LINKS = [
  ['Home', 'What VeloSales Ai is', '/'],
  ['Sign in', 'Open your dashboard', '/login'],
  ['Help', 'Questions and answers', '/faq'],
  ['Privacy', 'How your data is handled', '/privacy'],
];

function Body({ signedIn }) {
  const navigate = useNavigate();
  const links = signedIn ? APP_LINKS : PUBLIC_LINKS;
  const back = () => { if (window.history.length > 1) navigate(-1); else navigate(signedIn ? '/dashboard' : '/'); };

  return (
    <div className="nf-stage">
      <div className="nf-art" aria-hidden="true">
        <span className="nf-halo" />
        <Logo size={58} />
      </div>
      <p className="nf-eyebrow">Page not found</p>
      <div className="nf-code" aria-hidden="true">404</div>
      <h1 className="nf-title">This page isn’t here.</h1>
      <p className="nf-lede">
        The link may be old, or the address has a small typo. Nothing on your side is broken
        {signedIn ? ' — and nothing in your shop has changed.' : '.'}
      </p>

      <div className="nf-actions">
        <Link className="btn" to={signedIn ? '/dashboard' : '/'}>
          {signedIn ? 'Back to overview' : 'Go to the homepage'}
        </Link>
        <button className="btn ghost" type="button" onClick={back}>Go back</button>
      </div>

      <nav className="nf-links" aria-label="Popular pages">
        {links.map(([label, hint, href]) => (
          <Link key={href} to={href}>
            <b>{label}</b>
            <span>{hint}</span>
          </Link>
        ))}
      </nav>

      <p className="nf-help">
        Still stuck? <a href="mailto:velosales63@gmail.com">Tell us the link</a> and we’ll point you the right way.
      </p>
    </div>
  );
}

export default function NotFound({ me, loading, theme, onToggleTheme, onLogout }) {
  if (loading) return <div className="page"><div className="card"><span className="hint">Finding your shop…</span></div></div>;

  if (me) {
    return (
      <Shell biz={me} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}>
        <Body signedIn />
      </Shell>
    );
  }

  return (
    <div className="nf-public">
      <header className="nf-top">
        <Link className="nf-brand" to="/"><Logo size={26} /><span>VeloSales Ai</span></Link>
        <Link className="btn ghost sm" to="/login">Sign in</Link>
      </header>
      <main className="nf-public-main"><Body signedIn={false} /></main>
    </div>
  );
}
