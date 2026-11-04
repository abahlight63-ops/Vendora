// ── frontend/src/lib/orders.js ─────────────────────────────────────
// Small helpers shared by the Orders page and the Make receipt sheet.
// Display only: the server prices every order from the catalog.
export const STATUS_LABEL = { pending: 'Waiting for payment', paid: 'Paid', delivered: 'Delivered', cancelled: 'Cancelled' };
export const STATUS_SHORT = { pending: 'Waiting', paid: 'Paid', delivered: 'Delivered', cancelled: 'Cancelled' };
export const priceOf = (p) => { const m = String(p == null ? '' : p).replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
export const money = (n, cur = 'NGN') => (cur === 'USD' ? '$' : '₦') + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
export const short = (n, cur = 'NGN') => { // ₦1.14m, ₦195k: for small cards on phones
  const v = Number(n || 0); const sym = cur === 'USD' ? '$' : '₦';
  if (v >= 1e6) return sym + (Math.round(v / 1e4) / 100) + 'm';
  if (v >= 1e4) return sym + Math.round(v / 1e3) + 'k';
  return money(v, cur);
};
export const receiptNo = (o) => '#' + String((o && o.receipt_no) || 0).padStart(4, '0');
export const channelLabel = (ch) => ({ telegram: 'Telegram', whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram' }[ch] || 'chat');
export const itemsLine = (o) => (Array.isArray(o && o.items) ? o.items : []).map((l) => l.name + (l.qty > 1 ? ' × ' + l.qty : '')).join(', ');
export function when(d) {
  if (!d) return '';
  const x = new Date(d); const now = new Date();
  if (x.toDateString() === now.toDateString()) return x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (x.toDateString() === y.toDateString()) return 'Yesterday';
  return (now - x) / 864e5 < 7 ? x.toLocaleDateString([], { weekday: 'short' }) : x.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
