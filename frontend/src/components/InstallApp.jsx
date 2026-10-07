// ── frontend/src/components/InstallApp.jsx ─────────────────────────
// WHAT: the "install as app" card (Help page's star + screen-record star).
// SMART: shows the one-tap Install button when Chrome offers it, manual
// steps per platform otherwise (iOS Safari vs Android/desktop Chrome), and an
// "Installed ✓" state inside the launched app. Users film THIS card + the
// system dialog — deterministic recording, no hunting through menus!
// DATA: lib/install.js (deferred prompt, platform flags). No backend calls.
import { useEffect, useState } from 'react'; // useState = outcome line; useEffect = live-flip when Chrome offers mid-visit
import { canInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/install.js'; // the whole install API (nothing else touches the prompt!)
import Ic from './icons.jsx'; // phone glyph

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
    <div className="card">
      <h2><Ic n="phone" s={18} /> Install as app</h2>
      <p className="desc">VeloSales Ai installs like a store app — icon on your home screen, full-screen, works from one tap. Free, no download store needed.</p>
      {standalone ? (
        <p className="hint" style={{ margin: 0 }}><b>You are IN the installed app now</b> — full-screen, home-screen icon, this is it. Nothing more to do.</p>
      ) : ready ? (
        <>
          <button className="btn" onClick={install}><Ic n="phone" s={15} />Install app</button>
          {msg ? <p className="hint" style={{ marginTop: 8 }}>{msg}</p> : <p className="hint" style={{ marginTop: 8 }}>One tap → system confirm → home-screen icon. Film this button for your tutorial.</p>}
        </>
      ) : ios ? (
        <ol className="desc" style={{ margin: '8px 0 0 18px', display: 'grid', gap: 4 }}>
          <li>Open this page in <b>Safari</b> (not Chrome — Apple rules!).</li>
          <li>Tap <b>Share</b> (square + arrow, bottom bar).</li>
          <li>Tap <b>Add to Home Screen</b> → <b>Add</b> (top-right).</li>
          <li>Open it from the new icon — full-screen VeloSales Ai.</li>
        </ol>
      ) : (
        <>
          <ol className="desc" style={{ margin: '8px 0 8px 18px', display: 'grid', gap: 4 }}>
            <li>Open this page in <b>Chrome</b> on your phone.</li>
            <li>Tap <b>⋮ Menu</b> (top-right) → <b>Add to Home screen</b> (or <b>Install app</b> when offered).</li>
            <li>Confirm the name → <b>Install/Add</b>.</li>
            <li>Open it from the new icon — full-screen VeloSales Ai.</li>
          </ol>
          <p className="hint" style={{ margin: 0 }}>No menu item yet? Use the app a day or two (Chrome offers install after a few visits) — or desktop Chrome: install icon in the address bar.</p>
          {msg ? <p className="hint" style={{ marginTop: 8 }}>{msg}</p> : null}
        </>
      )}
    </div>
  );
}
