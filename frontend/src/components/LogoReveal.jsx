// ── frontend/src/components/LogoReveal.jsx ──────────────────────────
// WHAT: the centred logo animation. Plays the supplied clip
// (public/logo-reveal.mp4) EXACTLY as delivered — no re-encode, no trim,
// no filters — centred in a square stage, with the brand name under it.
// FALLBACKS (both matter more than the animation):
//   1. prefers-reduced-motion  -> the still mark, no motion at all.
//   2. decode/playback failure -> the still mark (poster shows meanwhile).
// The clip is decorative (the wordmark beside it is the accessible name),
// so the <video> is aria-hidden with muted + playsInline for autoplay.
import { useEffect, useRef, useState } from 'react';

export default function LogoReveal({
  size = 168, // square stage in px (the clip is 4:3, so it letterboxes inside)
  src = '/logo-reveal.mp4',
  poster = '/logo-mark.png',
  alt = 'VeloSales AI',
  onReady, // fired once the clip is actually painting (App uses it to time the fade)
}) {
  const [still, setStill] = useState(false); // true = show the static mark instead of the clip
  const video = useRef(null);

  useEffect(() => { // honour the OS "reduce motion" switch, and live-update it
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => { // some browsers refuse autoplay even when muted — never let that break the boot
    const v = video.current;
    if (!v || still) return undefined;
    const ok = () => onReady && onReady();
    const play = v.play();
    if (play && typeof play.catch === 'function') play.catch(() => setStill(true));
    if (v.readyState >= 3) ok();
    else v.addEventListener('canplay', ok, { once: true });
    return () => v.removeEventListener('canplay', ok);
  }, [still, onReady]);

  return (
    <span className="logo-reveal" style={{ '--reveal': size + 'px' }} role="img" aria-label={alt}>
      {still ? (
        <img className="logo-reveal-still" src={poster} alt="" aria-hidden="true" />
      ) : (
        <video
          ref={video}
          className="logo-reveal-video"
          src={src}
          poster={poster}
          autoPlay
          muted /* iOS will not autoplay a video with sound */
          loop /* a boot screen can outlive one play; never freeze on a last frame */
          playsInline /* iPhone: play in place instead of going fullscreen */
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setStill(true)}
        />
      )}
    </span>
  );
}