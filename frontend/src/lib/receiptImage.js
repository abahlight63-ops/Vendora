// ── frontend/src/lib/receiptImage.js ──────────────────────────────
// Draws a receipt as a PNG picture, branded with the SHOP's own logo (or its
// first letter). Never the VeloSales name: customers see only the shop.
import { money, receiptNo, STATUS_LABEL } from './orders.js';

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Cloudinary allows it; without it the canvas could not be saved
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function receiptPng(order, shop) {
  const W = 720, P = 48, cur = order.currency;
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = [...items.map((l) => [`${l.name} × ${l.qty}`, money(l.lineTotal, cur)])];
  if (Number(order.delivery_fee) > 0) rows.push([`Delivery${order.delivery_note ? ', ' + order.delivery_note : ''}`, money(order.delivery_fee, cur)]);
  const H = 300 + rows.length * 52 + 100;
  const c = document.createElement('canvas');
  const scale = 2;
  c.width = W * scale; c.height = H * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  const font = (w, s) => `${w} ${s}px Manrope, "Segoe UI", system-ui, sans-serif`;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d03c16'; g.fillRect(0, 0, W, 10);

  const name = (shop && shop.name) || 'Receipt';
  const logo = await loadImage(shop && shop.logo);
  const L = 72, ly = 44;
  g.save();
  g.beginPath(); g.roundRect ? g.roundRect(P, ly, L, L, 20) : g.rect(P, ly, L, L); g.clip();
  if (logo) {
    const s = Math.max(L / logo.width, L / logo.height);
    g.drawImage(logo, P + (L - logo.width * s) / 2, ly + (L - logo.height * s) / 2, logo.width * s, logo.height * s);
  } else {
    const grad = g.createLinearGradient(P, ly, P + L, ly + L); grad.addColorStop(0, '#ff7650'); grad.addColorStop(1, '#d03c16');
    g.fillStyle = grad; g.fillRect(P, ly, L, L);
    g.fillStyle = '#fff'; g.font = font(800, 34); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((name.trim()[0] || 'R').toUpperCase(), P + L / 2, ly + L / 2 + 1);
  }
  g.restore();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#1e1757'; g.font = font(800, 28); g.fillText(name.slice(0, 34), P + L + 20, ly + 32);
  g.fillStyle = '#6b6690'; g.font = font(600, 18);
  const date = new Date(order.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  g.fillText(`Receipt ${receiptNo(order)} · ${date}`, P + L + 20, ly + 62);

  let y = 170;
  if (order.customer_name) { g.fillStyle = '#6b6690'; g.font = font(600, 18); g.fillText('For ' + order.customer_name, P, y); }
  y += 20;
  g.strokeStyle = 'rgba(30,23,87,0.18)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(P, y); g.lineTo(W - P, y); g.stroke(); g.setLineDash([]);
  y += 50;
  for (const [label, amt] of rows) {
    g.fillStyle = '#1e1757'; g.font = font(600, 21); g.textAlign = 'left';
    let t = label; while (g.measureText(t).width > W - P * 2 - 180 && t.length > 4) t = t.slice(0, -2);
    g.fillText(t === label ? t : t + '…', P, y);
    g.font = font(800, 21); g.textAlign = 'right'; g.fillText(amt, W - P, y);
    y += 52;
  }
  g.strokeStyle = 'rgba(30,23,87,0.14)'; g.beginPath(); g.moveTo(P, y - 22); g.lineTo(W - P, y - 22); g.stroke();
  y += 22;
  g.fillStyle = '#1e1757'; g.font = font(800, 30); g.textAlign = 'left'; g.fillText('Total', P, y);
  g.textAlign = 'right'; g.fillText(money(order.total, cur), W - P, y);
  y += 56;
  const st = STATUS_LABEL[order.status] || '';
  const colors = { paid: ['#d1fae5', '#047857'], delivered: ['#ebe7ff', '#3b2e9e'], pending: ['#fff1db', '#9a5b00'], cancelled: ['#eeeeee', '#555555'] }[order.status] || ['#eee', '#555'];
  g.font = font(800, 18); const sw = g.measureText(st).width + 36;
  g.fillStyle = colors[0]; g.beginPath(); g.roundRect ? g.roundRect(P, y - 26, sw, 38, 19) : g.rect(P, y - 26, sw, 38); g.fill();
  g.fillStyle = colors[1]; g.textAlign = 'left'; g.fillText(st, P + 18, y - 1);
  if (order.status === 'paid' || order.status === 'delivered') { g.fillStyle = '#6b6690'; g.font = font(600, 18); g.textAlign = 'right'; g.fillText('Thank you!', W - P, y - 1); }
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

// Share on phones (WhatsApp, Telegram…), download everywhere else.
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
