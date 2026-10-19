// ── frontend/src/components/InstallApp.jsx ─────────────────────────
// WHAT: the "install as app" card (Help page's star + screen-record star).
// SMART: shows the one-tap Install button when Chrome offers it, manual
// steps per platform otherwise (iOS Safari vs Android/desktop Chrome), and an
// "Installed ✓" state inside the launched app. Users film THIS card + the
// system dialog — deterministic recording, no hunting through menus!
//
// THE ART: a small home screen with our icon dropping into place, once, on
// load. It exists to answer the question the old phone glyph created —
// "is this a phone call or an app?" — without a sentence of explanation.
// DATA: lib/install.js (deferred prompt, platform flags). No backend calls.
import { useEffect, useState } from 'react'; // useState = outcome line; useEffect = live-flip when Chrome offers mid-visit
import { canInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/install.js'; // the whole install API (nothing else touches the prompt!)
import Ic from './icons.jsx'; // install (arrow into a tray) + check glyphs — never a phone here
import Logo from './Logo.jsx'; // the real mark, so the preview shows OUR icon

export default function InstallApp() {
  const [, bump] = useState(0); // force re-render on installability change (functional setState — value unused!)
  const [msg, setMsg] = useState(''); // outcome line under the button (accepted/dismissed hints!)
  useEffect(() => onInstallChange(() => bump((n) => n + 1)), []); // [] = subscribe once (unsubscribe on unmount — returned fn!)

  async function install() {
    const out = await promptInstall(); // system dialog (the filmable moment!)
    if (out === 'accepted') setMsg('Installed! Find VeloSales Ai on your home screen — it opens full-screen, no browser bar.');
    else if (out === 'dismissed') setMsg('Dismissed — no wahala, tap Install any time. (Chrome menu → Install app works too.)');
    else setMsg('System prompt not ready — follow the steps below instead.');
  }

  const standalone = isStandalone(); // inside the installed app?
  const ios = isIos(); // Apple (manual steps only — Safari has no prompt API!)
  const ready = canInstall(); // Chrome holding the prompt for us?
  return (
    <div className="card install-card">
      <div className="install-art" aria-hidden="true"> {/* decorative only — the copy carries every instruction */}
        <div className="install-screen">
          <span className="install-notch" />
          <span className="install-tiles">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <i key={i} />)}
            <span className="install-app">
              {standalone ? <Ic n="check" s={16} /> : <Logo size={19} />}
            </span>
            {[0, 1, 2].map((i) => <i key={'b' + i} />)}
          </span>
          <span className="install-dock"><i /><i /><i /><i /></span>
        </div>
        <span className="install-pulse" />
      </div>

      <div className="install-copy">
        <h2><Ic n="install" s={18} /> Install as app</h2>
        <p className="desc">VeloSales Ai installs like a store app — icon on your home screen, full-screen, works from one tap. Free, no download store needed.</p>
        {standalone ? (
          <p className="hint install-ok"><Ic n="checkCircle" s={15} /><span><b>You are IN the installed app now</b> — full-screen, home-screen icon, this is it. Nothing more to do.</span></p>
        ) : ready ? (
          <>
            <button className="btn" onClick={install}><Ic n="install" s={15} />Install app</button>
            {msg ? <p className="hint" style={{ marginTop: 8 }}>{msg}</p> : <p className="hint" style={{ marginTop: 8 }}>One tap → system confirm → home-screen icon. Film this button for your tutorial.</p>}
          </>
        ) : ios ? (
          <ol className="install-steps">
            <li><b>1</b><span>Open this page in <b>Safari</b> (not Chrome — Apple rules!).</span></li>
            <li><b>2</b><span>Tap <b>Share</b> (square + arrow, bottom bar).</span></li>
            <li><b>3</b><span>Tap <b>Add to Home Screen</b> → <b>Add</b> (top-right).</span></li>
            <li><b>4</b><span>Open it from the new icon — full-screen VeloSales Ai.</span></li>
          </ol>
        ) : (
          <>
            <ol className="install-steps">
              <li><b>1</b><span>Open this page in <b>Chrome</b> on your phone.</span></li>
              <li><b>2</b><span>Tap <b>⋮ Menu</b> (top-right) → <b>Add to Home screen</b> (or <b>Install app</b> when offered).</span></li>
              <li><b>3</b><span>Confirm the name → <b>Install/Add</b>.</span></li>
              <li><b>4</b><span>Open it from the new icon — full-screen VeloSales Ai.</span></li>
            </ol>
            <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>No menu item yet? Use the app a day or two (Chrome offers install after a few visits) — or desktop Chrome: install icon in the address bar.</p>
            {msg ? <p className="hint" style={{ marginTop: 8 }}>{msg}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
