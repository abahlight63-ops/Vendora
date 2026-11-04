// ── frontend/src/components/ReceiptSheet.jsx ───────────────────────
// WHAT: the "Make receipt" sheet. Opened from a chat in the Inbox (the order is
// linked to that chat, so it can be sent there) or from Orders → New order.
// Pick products from the catalog, set quantities, add delivery, mark paid or
// waiting, then Save (and send). Totals here are a preview: the server prices
// every line from the catalog when it saves.
import { useEffect, useMemo, useState } from 'react';
import { api, pop } from '../lib/api.js';
import Select from './Select.jsx';
import Loader from './Loader.jsx';
import Ic from './icons.jsx';
import { money, priceOf, channelLabel } from '../lib/orders.js';

const OTHER = '__other';
let key = 0;
const blank = () => ({ k: ++key, productId: '', name: '', price: '', qty: 1 });

export default function ReceiptSheet({ conversation, onClose, onSaved }) {
  const [products, setProducts] = useState(null);
  const [lines, setLines] = useState([blank()]);
  const [customer, setCustomer] = useState('');
  const [place, setPlace] = useState('');
  const [fee, setFee] = useState('');
  const [status, setStatus] = useState('pending');
  const [busy, setBusy] = useState('');
  const who = conversation ? (conversation.customer_name || conversation.customer_number || 'this customer') : '';
  const first = who.split(' ')[0];

  useEffect(() => {
    api('/api/me/products', { timeout: 15000 }).then(({ ok, data }) => setProducts(ok && Array.isArray(data) ? data : []));
  }, []);
  useEffect(() => { // Esc closes
    const f = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [busy, onClose]);

  const byId = useMemo(() => new Map((products || []).map((p) => [String(p.id), p])), [products]);
  const options = useMemo(() => [
    ...(products || []).map((p) => ({ value: String(p.id), label: p.name, hint: p.price || 'No price yet' })),
    { value: OTHER, label: 'Other item (type it)' },
  ], [products]);
  const unit = (l) => (l.productId && l.productId !== OTHER ? priceOf(byId.get(l.productId) && byId.get(l.productId).price) : priceOf(l.price));
  const subtotal = lines.reduce((s, l) => s + (l.productId ? unit(l) * l.qty : 0), 0);
  const total = subtotal + priceOf(fee);
  const set = (k, patch) => setLines((xs) => xs.map((l) => (l.k === k ? { ...l, ...patch } : l)));

  async function save(andSend) {
    const items = lines.filter((l) => l.productId).map((l) => (l.productId === OTHER
      ? { name: l.name.trim(), price: l.price, qty: l.qty }
      : { productId: Number(l.productId), qty: l.qty }));
    if (!items.length) return pop('err', 'Add an item', 'Pick at least one product for this receipt.');
    if (items.some((i) => i.name === '')) return pop('err', 'Name the item', 'Type a name for the "Other item" line.');
    setBusy(andSend ? 'send' : 'save');
    const body = { items, status, deliveryFee: fee || 0, deliveryNote: place.trim() || null };
    if (conversation) body.conversationId = conversation.id; else body.customerName = customer.trim() || null;
    const { ok, data } = await api('/api/me/orders', { method: 'POST', body: JSON.stringify(body) });
    if (!ok) { setBusy(''); return pop('err', 'Could not save the receipt', (data && data.error) || 'Check your connection and try again.'); }
    let sent = false;
    if (andSend) {
      const r = await api('/api/me/orders/' + data.order.id + '/send', { method: 'POST' });
      sent = r.ok;
      if (!r.ok) pop('err', 'Saved, but not sent', (r.data && r.data.error) || 'Open Orders to try sending again.');
    }
    setBusy('');
    onSaved(data.order, { sent, receipt: data.receipt });
  }

  return (
    <div className="pop-overlay rc-back" role="presentation" onClick={() => { if (!busy) onClose(); }}>
      <div className="rc-sheet" role="dialog" aria-modal="true" aria-labelledby="rc-title" onClick={(e) => e.stopPropagation()}>
        <span className="rc-grab" aria-hidden="true" />
        <div className="rc-head">
          <span className="rc-ic" aria-hidden="true"><Ic n="receipt" s={22} /></span>
          <div><b id="rc-title">{conversation ? 'Make receipt' : 'New order'}</b><span>{conversation ? 'For ' + who : 'A sale made anywhere: shop, phone or chat'}</span></div>
          <button type="button" className="rc-x" onClick={onClose} disabled={!!busy} aria-label="Close"><Ic n="x" s={18} /></button>
        </div>

        {!conversation && (<><label className="rc-lbl" htmlFor="rc-cust">Customer</label><input id="rc-cust" className="rc-fld" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Name (optional)" maxLength={120} /></>)}

        <span className="rc-lbl">Items</span>
        {products === null ? <div className="skel" style={{ height: 64, borderRadius: 18 }} /> : (
          <div className="rc-items">
            {products.length === 0 && <p className="rc-note">Your catalog is empty, so type each item with "Other item", or add products in Catalog first.</p>}
            {lines.map((l) => (
              <div key={l.k} className="rc-line">
                <div className="rc-pick"><Select value={l.productId} onChange={(v) => set(l.k, { productId: v })} options={options} placeholder="Pick a product" label="Product" /></div>
                <div className="rc-step" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => set(l.k, { qty: Math.max(1, l.qty - 1) })} aria-label="One less"><Ic n="minus" s={14} /></button>
                  <b>{l.qty}</b>
                  <button type="button" onClick={() => set(l.k, { qty: Math.min(999, l.qty + 1) })} aria-label="One more"><Ic n="plus" s={14} /></button>
                </div>
                <b className="rc-amt">{l.productId ? money(unit(l) * l.qty) : '—'}</b>
                {lines.length > 1 && <button type="button" className="rc-del" onClick={() => setLines((xs) => xs.filter((x) => x.k !== l.k))} aria-label="Remove item"><Ic n="x" s={14} /></button>}
                {l.productId === OTHER && (
                  <div className="rc-other">
                    <input className="rc-fld" value={l.name} onChange={(e) => set(l.k, { name: e.target.value })} placeholder="Item name" maxLength={120} aria-label="Item name" />
                    <input className="rc-fld" value={l.price} onChange={(e) => set(l.k, { price: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="Price each" inputMode="decimal" aria-label="Price each" />
                  </div>
                )}
              </div>
            ))}
            {lines.length < 40 && <button type="button" className="rc-add" onClick={() => setLines((xs) => [...xs, blank()])}><Ic n="plus" s={18} />Add item</button>}
          </div>
        )}

        <span className="rc-lbl">Delivery</span>
        <div className="rc-two">
          <input className="rc-fld" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Where (optional)" maxLength={120} aria-label="Delivery place" />
          <input className="rc-fld" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Fee, e.g. 3,000" inputMode="decimal" aria-label="Delivery fee" />
        </div>

        <span className="rc-lbl">Payment</span>
        <div className="rc-seg" role="group" aria-label="Payment">
          <button type="button" className={status === 'pending' ? 'on' : ''} aria-pressed={status === 'pending'} onClick={() => setStatus('pending')}>Waiting for payment</button>
          <button type="button" className={status === 'paid' ? 'on' : ''} aria-pressed={status === 'paid'} onClick={() => setStatus('paid')}>Paid</button>
        </div>

        <div className="rc-total"><span>Total</span><b>{money(total)}</b></div>
        {conversation ? (<>
          <button type="button" className="btn lg rc-go" onClick={() => save(true)} disabled={!!busy}>{busy === 'send' ? <Loader size={17} /> : <Ic n="send" s={18} />}Save and send to {first}</button>
          <button type="button" className="rc-quiet" onClick={() => save(false)} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save only'}</button>
          <p className="rc-note is-center">Sends on {channelLabel(conversation.channel || 'whatsapp')}. Prices come from your catalog.</p>
        </>) : (
          <button type="button" className="btn lg rc-go" onClick={() => save(false)} disabled={!!busy}>{busy ? <Loader size={17} /> : <Ic n="check" s={18} />}Save order</button>
        )}
      </div>
    </div>
  );
}
