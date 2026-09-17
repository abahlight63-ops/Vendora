// ── frontend/src/components/CaptchaBox.jsx ─────────────────────────
// WHAT: the reCAPTCHA v2 checkbox mount point. Renders NOTHING when the bot
// check is off (backend skips too — dev convenience!). One instance per form
// branch (Login remounts branches on mode switch, so each gets a fresh box).
// PROPS: boxRef = React ref object; the widget id lands in boxRef.current
// (Login reads it at submit via captchaToken(), resets via captchaReset()).
import { useEffect, useRef } from 'react'; // useEffect = mount render; useRef = widget div
import { loadRecaptcha } from '../lib/captcha.js'; // lazy script loader (GIS pattern!)

export default function CaptchaBox({ boxRef }) {
  const el = useRef(null); // the div grecaptcha renders INTO
  useEffect(() => {
    let dead = false; // unmount flag (mode switch mid-load → abandon, never touch dead DOM!)
    let tries = 0; // retry counter (config fetch may land AFTER first paint — key arrives late!)
    (async function mount() {
      const key = window.__RECAPTCHA_KEY__ || null;
      if (!key) { // no key (check off) → render nothing, EVER (empty div = zero height!)
        if (boxRef) boxRef.current = null;
        return;
      }
      if (!el.current) return; // unmounted already
      try {
        await loadRecaptcha(); // script ready (or throw → catch shows nothing, submit explains!)
        if (dead || !el.current || !window.grecaptcha) return;
        el.current.innerHTML = ''; // clear retries' leftovers (strict-mode double-mount safety!)
        if (boxRef) boxRef.current = window.grecaptcha.render(el.current, { sitekey: key }); // widget id → ref (submit reads it!)
      } catch {
        if (!dead && tries < 4) { tries++; setTimeout(() => { if (!dead) mount(); }, 800); } // adblock hiccup? retry ×4 (then give up — submit message covers it!)
      }
    })();
    return () => { dead = true; }; // cleanup (mode switch unmounts → abandon!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // [] = mount-only (Login remounts branches per mode — fresh box each time!)
  return <div ref={el} className="captcha-box" />; // empty when off (CSS gives it zero height!)
}
