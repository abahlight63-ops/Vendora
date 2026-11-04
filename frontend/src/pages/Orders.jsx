// ── frontend/src/pages/Orders.jsx ──────────────────────────────────
// WHAT: every sale, its receipt and whether it's paid. Four real numbers on
// top (from /api/me/orders/summary), the order list with filters and search,
// and the selected order's receipt with Send / Mark paid / Mark delivered /
// Copy. On phones the receipt replaces the list (Back returns).
// Orders come from three places: Make receipt in a chat, Chat with Velo
// ("make a receipt for Tunde…") and New order here.
import { useEffect, useState } from 'react';
import { api, pop, toast } from '../lib/api.js';
import { describeNetError } from '../lib/netDetail.js';
import LoadFailed from '../components/LoadFailed.jsx';
import ReceiptSheet from '../components/ReceiptSheet.jsx';
import Loader from '../components/Loader.jsx';
import Ic from '../components/icons.jsx';
import { CHANNEL_COINS } from '../lib/channelLogos.js';
import { receiptPng, shareOrDownload } from '../lib/receiptImage.js';
import { STATUS_LABEL, STATUS_SHORT, money, short, receiptNo, channelLabel, itemsLine, when } from '../lib/orders.js';

let coinN = 0;
function Coin({ ch, s = 30 }) {
  coinN += 1;
  const svg = CHANNEL_COINS[ch];
  if (!svg) return <span className="od-coin" style={{ width: s, height: s }} aria-hidden="true"><Ic n="store" s={Math.round(s * 0.55)} /></span>;
  return <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: '0 0 auto' }} dangerouslySetInnerHTML={{ __html: svg.replace(/(msg-g|ig-g)/g, '$1-o' + coinN) }} />;
}
const change = (a, b, unit) => {
  if (!b) return a ? 'New this week' : 'Nothing yet';
  const pct = Math.round(((a - b) / b) * 100);
  return unit === 'n' ? `${a >= b ? '↑' : '↓'} ${Math.abs(a - b)} on last week` : `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% on last week`;
};
const FILTERS = [['all', 'All'], ['pending', 'Waiting'], ['paid', 'Paid'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];

function Receipt({ order, shop, logo }) {
  const cur = order.currency;
  return (
    <div className="od-rcp">
      <div className="od-rh">
        {logo ? <img className="od-rh-logo" src={logo} alt="" /> : <span className="od-rh-ic" aria-hidden="true">{((shop || 'R').trim()[0] || 'R').toUpperCase()}</span>}
        <div><b>{shop || 'Your shop'}</b><small>Receipt {receiptNo(order)} · {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
        <span className={'od-st ' + order.status}>{STATUS_SHORT[order.status]}</span>
      </div>
      {order.customer_name && <div className="od-for">For {order.customer_name}</div>}
      {(order.items || []).map((l, i) => <div key={i} className="od-rl"><span>{l.name} × {l.qty}</span><b>{money(l.lineTotal, cur)}</b></div>)}
      {Number(order.delivery_fee) > 0 && <div className="od-rl"><span>Delivery{order.delivery_note ? ', ' + order.delivery_note : ''}</span><b>{money(order.delivery_fee, cur)}</b></div>}
      <div className="od-rt"><span>Total</span><span>{money(order.total, cur)}</span></div>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [sum, setSum] = useState(null);
  const [failed, setFailed] = useState(null);
  const [tries, setTries] = useState(0);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [shop, setShop] = useState('');
  const [logo, setLogo] = useState(null); // the shop's own logo (its profile photo)
  const [busy, setBusy] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [o, s] = await Promise.all([api('/api/me/orders', { timeout: 15000 }), api('/api/me/orders/summary', { timeout: 15000 })]);
      if (!o.ok) { setFailed({ status: o.status, detail: '' }); setOrders((x) => x || []); return; }
      setFailed(null);
      setOrders(o.data.orders || []);
      if (s.ok) setSum(s.data);
      setSelId((id) => id || (o.data.orders[0] && o.data.orders[0].id) || null);
    } catch (e) { setFailed({ status: 0, detail: describeNetError(e) }); setOrders((x) => x || []); }
  }
  useEffect(() => {
    api('/api/me').then(({ ok, data }) => {
      if (ok && data && data.business) { setShop(data.business.name || ''); setLogo(data.business.avatar_url || null); }
    });
  }, []);
  useEffect(() => { load(); }, [tries]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = (orders || []).find((o) => o.id === selId) || null;
  useEffect(() => { // the exact text the customer gets (for Copy)
    setReceipt('');
    if (!sel) return;
    let dead = false;
    api('/api/me/orders/' + sel.id).then(({ ok, data }) => {
      if (dead || !ok) return;
      setReceipt(data.receipt || '');
    });
    return () => { dead = true; };
  }, [selId, sel && sel.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(status) {
    if (!sel || busy) return;
    setBusy(status);
    const { ok, data } = await api('/api/me/orders/' + sel.id + '/status', { method: 'POST', body: JSON.stringify({ status }) });
    setBusy('');
    if (!ok) return pop('err', 'Could not update the order', (data && data.error) || 'Check your connection and try again.');
    setOrders((xs) => xs.map((o) => (o.id === sel.id ? data.order : o)));
    toast(status === 'cancelled' ? 'Order cancelled' : 'Marked ' + STATUS_LABEL[status].toLowerCase());
    api('/api/me/orders/summary').then(({ ok: k, data: d }) => { if (k) setSum(d); });
  }
  async function send() {
    if (!sel || busy) return;
    setBusy('send');
    const { ok, data } = await api('/api/me/orders/' + sel.id + '/send', { method: 'POST' });
    setBusy('');
    if (!ok) return pop('err', 'Receipt not sent', (data && data.error) || 'Check your connection and try again.');
    setOrders((xs) => xs.map((o) => (o.id === sel.id ? { ...o, receipt_sent_at: new Date().toISOString() } : o)));
    toast('Receipt sent to ' + (sel.customer_name || 'the customer'));
  }
  async function picture() {
    if (!sel || busy) return;
    setBusy('pic');
    try {
      const blob = await receiptPng(sel, { name: shop, logo });
      const how = await shareOrDownload(blob, 'receipt-' + receiptNo(sel).slice(1) + '.png');
      if (how === 'downloaded') toast('Receipt picture saved');
    } catch { pop('err', 'Could not make the picture', 'Try again, or use Copy receipt.'); }
    setBusy('');
  }
  function pdf() { // the browser's print window has "Save as PDF"; only the receipt prints
    document.body.classList.add('od-printing');
    const done = () => { document.body.classList.remove('od-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(receipt); toast('Receipt copied'); } catch { pop('err', 'Could not copy', 'Select the receipt text and copy it by hand.'); }
  }

  if (failed && orders && orders.length === 0 && failed.status !== 200) {
    return <div className="od"><LoadFailed title="Couldn't load orders" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setOrders(null); setTries((t) => t + 1); }} backTo="/dashboard" backLabel="Back to Home" /></div>;
  }

  const needle = q.trim().toLowerCase();
  const list = (orders || []).filter((o) => (filter === 'all' || o.status === filter)
    && (!needle || [o.customer_name, o.customer_number, itemsLine(o), receiptNo(o)].join(' ').toLowerCase().includes(needle)));
  const cur = (sum && sum.currency) || 'NGN';
  const waiting = sum ? sum.pending.count : 0;
  const top = sum && sum.topSold30[0];

  return (
    <div className={'od' + (phoneOpen ? ' od-phone-open' : '')}>
      <div className="in-head od-head">
        <div>
          <div className={'dg-status' + (sum && sum.orders.d7 ? ' on' : '')}><i />{sum ? `${sum.orders.d7} order${sum.orders.d7 === 1 ? '' : 's'} this week` : 'Orders'}</div>
          <h1>Orders</h1>
          <p>Every sale, its receipt and whether it's paid.</p>
        </div>
        <button type="button" className="btn lg" onClick={() => setCreating(true)}><Ic n="plus" s={18} />New order</button>
      </div>

      <div className="od-kpis">
        <div className="od-kpi"><span>Paid this week</span><b><em className="od-long">{money(sum ? sum.revenue.d7 : 0, cur)}</em><em className="od-short">{short(sum ? sum.revenue.d7 : 0, cur)}</em></b>{sum && <small>{change(sum.revenue.d7, sum.revenue.prev7)}</small>}</div>
        <div className="od-kpi"><span>Orders this week</span><b>{sum ? sum.orders.d7 : 0}</b>{sum && <small>{change(sum.orders.d7, sum.orders.prev7, 'n')}</small>}</div>
        <div className="od-kpi"><span>Waiting for payment</span><b className={waiting ? 'is-warn' : ''}>{waiting}{waiting ? ' · ' + short(sum.pending.value, cur) : ''}</b><small className="is-muted">{waiting ? 'Remind them from the chat' : 'Nobody owes you'}</small></div>
        <div className="od-kpi"><span>Best seller</span><b className="od-name">{top ? top.name : 'None yet'}</b><small className="is-muted">{top ? `${top.qty} sold this month` : 'Mark orders paid to see it'}</small></div>
      </div>

      <div className="od-grid">
        <section className="od-listcard" aria-label="Orders">
          <div className="od-tools">
            <div className="wx-pills" role="group" aria-label="Show">
              {FILTERS.map(([k, t]) => <button key={k} type="button" className={'wx-pill' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}{k === 'pending' && waiting ? ' ' + waiting : ''}</button>)}
            </div>
            <label className="od-search"><Ic n="search" s={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders" aria-label="Search orders" /></label>
          </div>
          {orders === null ? [0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 64, borderRadius: 20 }} />)
            : list.length === 0 ? (
              <div className="nt-empty">
                <span className="nt-ic c" aria-hidden="true"><Ic n="receipt" s={22} /></span>
                <b>{orders.length ? 'No orders match' : 'No orders yet'}</b>
                <span>{orders.length ? 'Try another filter or search.' : 'Make a receipt from any chat in the Inbox, ask Chat with Velo to make one, or tap New order.'}</span>
              </div>
            ) : list.map((o) => (
              <button key={o.id} type="button" className={'od-row' + (o.id === selId ? ' sel' : '')} onClick={() => { setSelId(o.id); setPhoneOpen(true); if (window.innerWidth <= 760) window.scrollTo({ top: 0 }); }}>
                <span className="od-num">{receiptNo(o)}</span>
                <span className="od-who"><Coin ch={o.channel} /><span><b>{o.customer_name || o.customer_number || 'Walk-in customer'}</b><small>{when(o.created_at)}</small></span></span>
                <span className="od-items">{itemsLine(o)}</span>
                <b className="od-tot">{money(o.total, o.currency)}</b>
                <span className={'od-st ' + o.status}>{STATUS_SHORT[o.status]}</span>
              </button>
            ))}
        </section>

        <aside className="od-side" aria-label="Receipt">
          <button type="button" className="nt-back od-back" onClick={() => setPhoneOpen(false)}><Ic n="back" s={18} />All orders</button>
          {!sel ? <div className="od-rcp nt-empty"><b>Pick an order</b><span>Its receipt shows here.</span></div> : (<>
            <Receipt order={sel} shop={shop} logo={logo} />
            {sel.conversation_id && sel.status !== 'cancelled' && (
              <button type="button" className="btn lg od-send" onClick={send} disabled={!!busy}>
                {busy === 'send' ? <Loader size={17} /> : <Coin ch={sel.channel} s={22} />}{sel.receipt_sent_at ? 'Send receipt again' : 'Send receipt on ' + channelLabel(sel.channel)}
              </button>
            )}
            <div className="od-acts">
              {sel.status === 'pending' && <button type="button" className="btn ghost" onClick={() => setStatus('paid')} disabled={!!busy}>{busy === 'paid' ? <Loader size={16} /> : <Ic n="cash" s={18} />}Mark paid</button>}
              {sel.status === 'paid' && <button type="button" className="btn ghost" onClick={() => setStatus('delivered')} disabled={!!busy}>{busy === 'delivered' ? <Loader size={16} /> : <Ic n="truck" s={18} />}Mark delivered</button>}
              {sel.status === 'cancelled' && <button type="button" className="btn ghost" onClick={() => setStatus('pending')} disabled={!!busy}><Ic n="refresh" s={18} />Restore order</button>}
              <button type="button" className="btn ghost" onClick={picture} disabled={!!busy}>{busy === 'pic' ? <Loader size={16} /> : <Ic n="camera" s={18} />}Save picture</button>
              <button type="button" className="btn ghost" onClick={pdf}><Ic n="download" s={18} />Save as PDF</button>
              <button type="button" className="btn ghost" onClick={copy} disabled={!receipt}><Ic n="copy" s={18} />Copy receipt</button>
            </div>
            {sel.status !== 'cancelled' && <button type="button" className="od-cancel" onClick={() => setStatus('cancelled')} disabled={!!busy}>Cancel this order</button>}
            <p className="od-note">{sel.receipt_sent_at ? 'Receipt sent ' + when(sel.receipt_sent_at) + '. ' : ''}{sel.conversation_id ? 'Receipts sent in the chat show in the Inbox too.' : 'Not linked to a chat, so copy the receipt to send it.'}</p>
          </>)}
        </aside>
      </div>

      {creating && <ReceiptSheet onClose={() => setCreating(false)} onSaved={(order) => { setCreating(false); setOrders((xs) => [order, ...(xs || [])]); setSelId(order.id); setPhoneOpen(true); toast('Order ' + receiptNo(order) + ' saved'); load(); }} />}
    </div>
  );
}
