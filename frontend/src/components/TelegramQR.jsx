// ── frontend/src/components/TelegramQR.jsx ─────────────────────────
// WHAT: the shop's Telegram QR card (shared-bot road). Shows the QR for the
// customer link t.me/<bot>?start=<CODE>, a Copy link button, and Download
// poster: a print-ready PNG (shop name, "Scan to chat with us on Telegram",
// the QR, the link written out) for counters, flyers and status posts.
// The qrcode library is loaded only when this card is on screen.
import { useEffect, useRef, useState } from 'react';
import { toast } from '../lib/api.js';

async function qrLib() {
  const m = await import('qrcode');
  return m.default || m;
}

// Wrap a long line into rows that fit maxW (shop names can be long).
function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const rows = [];
  let row = '';
  for (const w of words) {
    const next = row ? row + ' ' + w : w;
    if (ctx.measureText(next).width > maxW && row) { rows.push(row); row = w; } else row = next;
  }
  if (row) rows.push(row);
  return rows.slice(0, 3);
}

async function posterBlob(link, shopName) {
  const QR = await qrLib();
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#229ED9'; ctx.fillRect(0, 0, W, 18); // Telegram blue band
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0B132B';
  ctx.font = '700 64px system-ui, -apple-system, "Segoe UI", sans-serif';
  const rows = wrap(ctx, shopName || 'Chat with us', W - 160);
  let y = 150;
  for (const r of rows) { ctx.fillText(r, W / 2, y); y += 76; }
  ctx.fillStyle = '#3A506B';
  ctx.font = '500 40px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('Scan to chat with us on Telegram', W / 2, y + 10);
  const qrSize = 760;
  const qrCanvas = document.createElement('canvas');
  await QR.toCanvas(qrCanvas, link, { width: qrSize, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B132B', light: '#ffffff' } });
  const qy = y + 60;
  ctx.drawImage(qrCanvas, (W - qrSize) / 2, qy, qrSize, qrSize);
  ctx.fillStyle = '#0B132B';
  ctx.font = '600 34px ui-monospace, "SF Mono", Consolas, monospace';
  ctx.fillText(link.replace(/^https?:\/\//, ''), W / 2, qy + qrSize + 70);
  ctx.fillStyle = '#3A506B';
  ctx.font = '400 28px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('Open your camera, point it here, tap the link.', W / 2, qy + qrSize + 120);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export default function TelegramQR({ link, shopName, code }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    qrLib()
      .then((QR) => live && ref.current && QR.toCanvas(ref.current, link, { width: 220, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B132B', light: '#ffffff' } }))
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [link]);

  async function copy() {
    try { await navigator.clipboard.writeText(link); toast('Link copied', 'ok'); }
    catch (e) { toast('Could not copy. Press and hold the link to copy it.', 'err'); }
  }

  async function download() {
    setSaving(true);
    try {
      const blob = await posterBlob(link, shopName);
      if (!blob) throw new Error('no image');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(shopName || 'shop').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'shop'}-telegram-qr.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      toast('Could not make the poster. Try again.', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tg-qr">
      <div className="tg-qr-code">
        {failed ? <p className="hint">QR code could not load. Refresh the page to try again.</p> : <canvas ref={ref} width="220" height="220" aria-label="QR code for your Telegram customer link" role="img" />}
      </div>
      <div className="tg-qr-side">
        <b>Customers scan this, or tap your link</b>
        <span className="tg-qr-link">{link.replace(/^https?:\/\//, '')}</span>
        {code && <span className="hint">Your shop code: <b>{code}</b></span>}
        <p className="hint">Print it for your counter, add it to flyers, or post it on your status. Customers scan once, then just chat.</p>
        <div className="tg-qr-actions">
          <button type="button" className="btn sm" disabled={saving} onClick={download}>{saving ? 'Making poster' : 'Download poster'}</button>
          <button type="button" className="btn ghost sm" onClick={copy}>Copy link</button>
        </div>
      </div>
    </div>
  );
}
