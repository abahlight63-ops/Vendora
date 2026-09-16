// ── frontend/src/components/AdSlot.jsx ─────────────────────────────
// WHAT: the ONE visible in-app ad slot (free tier only — Pro renders null).
// WHY it exists: network tags (Monetag/Adsterra) render floating formats with
// no in-app footprint, so owners thought "no ads". This slot guarantees every
// free login SEES the free-plan tradeoff: sponsor card (if SPONSOR_* set) +
// a slim "Free plan · supported by ads" bar linking to Billing.
// DATA: reads lib/ads.js cache (seeded by App.jsx — no extra fetch).
// Renders null for Pro/logged-out/empty-config (never an empty box).
import { useEffect, useState } from 'react'; // useState = ads snapshot + dismissed; useEffect = load once
import { Link } from 'react-router-dom'; // Billing link (client-side nav)
import { getAds } from '../lib/ads.js'; // tier-resolved config (null for Pro)
import { api } from '../lib/api.js'; // click logging (per-click sponsor billing)
import Ic from './icons.jsx'; // drawn icons (no emoji)

export default function AdSlot() {
  const [ads, setAds] = useState(null); // null = loading OR pro/empty (both render nothing)
  const [loaded, setLoaded] = useState(false); // false until getAds() resolves (avoids flash)
  const [off, setOff] = useState(false); // user dismissed the slim bar (per page-load only)
  const [blocked, setBlocked] = useState(false); // ad-blocker suspected (no network tag in DOM after 4s)

  useEffect(() => { // mount-only: snapshot the tier-resolved ads config…
    let live = true; // guard against setState after unmount
    getAds().then((a) => { if (live) { setAds(a); setLoaded(true); } });
    const t = setTimeout(() => { // ad-block probe: network tag should exist by now on free-live…
      if (!live) return;
      try {
        const hasTag = !!document.querySelector('script[data-adnet]');
        getAds().then((a) => { // re-read (cache hit — no extra fetch)…
          if (live && a && Array.isArray(a.networks) && a.networks.length && !hasTag) setBlocked(true);
        });
      } catch {}
    }, 4000); // 4s: slow phone networks still get room (matches injectTag's 15s guard philosophy)
    return () => { live = false; clearTimeout(t); }; // cleanup timer + guard
  }, []);

  if (!loaded || !ads || off) return null; // loading / Pro / dismissed → nothing (Pro sees zero pixels)
  const nets = Array.isArray(ads.networks) ? ads.networks : [];
  const sp = ads.sponsor || null; // direct-deal sponsor (SPONSOR_TITLE + SPONSOR_LINK in .env)
  if (!nets.length && !sp) return null; // free but nothing configured → nothing (backend already sent null in this case)

  async function visitSponsor() { // billable click: log FIRST, then open (await = counted before they leave)…
    try { await api('/api/me/ads/click', { method: 'POST', body: JSON.stringify({ slot: 'inline', target_url: sp.link }) }); } catch {} // logging never blocks (try/catch)
    window.open(sp.link, '_blank', 'noopener'); // new tab (noopener = sponsor can't touch our window)
  }

  return (
    <div className="adslot" role="complementary" aria-label="Sponsored">
      {sp ? ( // direct sponsor card (text + optional video thumb note)…
        <div className="adslot-card">
          <span className="sponsor-tag">Sponsored</span>
          <div className="adslot-body">
            <b>{sp.title}</b>
            {sp.text ? <span className="hint">{sp.text}</span> : null}
          </div>
          <button className="btn sm" onClick={visitSponsor}>Visit sponsor</button>
        </div>
      ) : null}
      <div className="adslot-bar"> {/* slim bar: always visible on free-live (the "I see ads" proof)… */}
        <Ic n="mega" s={15} />
        <span>Free plan is supported by ads {nets.length ? `(${nets.map((n) => n.provider).join(' + ')})` : ''} — <Link to="/billing">Go Pro to remove them</Link>.</span>
        <button className="adslot-x" onClick={() => setOff(true)} aria-label="Dismiss">✕</button>
      </div>
      {blocked ? <p className="hint" style={{ marginTop: 6 }}>Heads up: an ad-blocker seems to be stopping ad tags — pause it on this site so free-plan ads can load.</p> : null}
    </div>
  );
}
