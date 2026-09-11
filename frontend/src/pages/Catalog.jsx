// ── frontend/src/pages/Catalog.jsx ─────────────────────────────────
// WHAT: the product catalog manager — table of products (toggle stock,
// delete), Pro profile-sync box, manual add form. THE most important page:
// this data is literally what the AI is allowed to say.
// STATE: products (null = loading → skeletons), f (add-form draft), tier
// (free/pro → sync box vs upgrade card), syncText/syncInfo/syncing.
// Feedback: pop() for big outcomes, toast() for small ones, sponsor hook.
import { useEffect, useState } from 'react'; // useState ×6 slices of UI state; useEffect = triple-fetch on mount
import { Link } from 'react-router-dom'; // Link for the Upgrade-to-Pro button (client-side nav)
import { api, pop, toast } from '../lib/api.js'; // api() calls; pop() big animated results; toast() small notes
import { maybeShowSponsor } from '../lib/ads.js'; // sponsor interstitial after adds (free tier, max once/day)
import Ic from '../components/icons.jsx'; // trash icon

export default function Catalog() { // no props needed (fetches everything itself)
  const [products, setProducts] = useState(null); // null = loading (skeleton rows); [] = loaded-but-empty (empty state!)
  const [f, setF] = useState({ name: '', price: '', desc: '' }); // CONTROLLED FORM: inputs mirror this object (value={f.name} + onChange writes back)
  const [tier, setTier] = useState('free'); // 'free' default → upgrade card flashes first if billing is slow (safe default: never show Pro tools to free users!)
  const [syncText, setSyncText] = useState(''); // pasted profile text (controlled textarea)
  const [syncInfo, setSyncInfo] = useState(null); // {synced, synced_at} from GET /api/me/profile-sync ("Last synced" label)
  const [syncing, setSyncing] = useState(false); // disables button + "Syncing…" label (prevents double-submit!)
  async function load() { const { data } = await api('/api/me/products'); setProducts(data || []); } // reusable reload (called after every mutation — simplest correct refresh strategy)
  useEffect(() => { // mount: three independent fetches (no await between = parallel-ish; .then chains don't block each other)
    load(); // products list
    api('/api/me/billing').then(({ data }) => { if (data?.tier) setTier(data.tier); }); // ?. guards failed responses (tier stays 'free' default)
    api('/api/me/profile-sync').then(({ data }) => { if (data) setSyncInfo(data); }); // if (data) guards null (logged-out edge)
  }, []); // [] = mount-only
  async function sync() { // Pro profile-sync: paste text → AI scaffolds catalog
    if (!syncText.trim()) return toast('Paste your business profile text first', 'err'); // guard: blank submit → error toast (return stops here)
    setSyncing(true); // lock UI during the AI call (slow!.extractProducts takes seconds)
    const { ok, data } = await api('/api/me/profile-sync', { method: 'POST', body: JSON.stringify({ profile_text: syncText.trim() }) }); // .trim() once, send clean
    setSyncing(false); // unlock (BOTH paths — success AND failure — or button stays dead!)
    if (ok) { // 200: scaffolded…
      pop('ok', 'Profile synced!', `${(data.products || []).length} verified products added to your catalog.`); // big success popup with COUNT
      setSyncText(''); setSyncInfo({ synced: true, synced_at: data.synced_at }); load(); // clear box, update label, reload table (three state updates = one re-render — React batches!)
    } else if (data?.error?.includes('Pro feature')) { // ?. chain guards missing error; .includes matches backend's 402 message specifically…
      pop('err', 'Pro feature', 'Profile sync needs Pro — manual teaching stays free. Upgrade on the Billing page.'); // …friendly paywall (not a raw error dump)
    } else { // other failures (422 no-products-found, 500…)…
      pop('err', 'Sync failed', data.error || 'Please try again.'); // …show backend's message (|| fallback)
    }
  }
  async function add() { // manual add (free forever)
    if (!f.name.trim()) return toast('Product name is required', 'err'); // only hard rule (price optional — "call for price" shops exist!)
    const { ok, data } = await api('/api/me/products', { method: 'POST', body: JSON.stringify({ name: f.name.trim(), price: f.price.trim() || null, description: f.desc.trim() || null, available: true }) }); // trim + empty→null (DB stores NULL, not "")
    if (ok) { pop('ok', 'Product added!', 'The AI can sell it from now on.'); setF({ name: '', price: '', desc: '' }); load(); maybeShowSponsor(); } // success popup + clear form + reload + sponsor hook (fire-and-forget: no await — sponsor must never block!)
    else pop('err', 'Could not add product', data.error || 'Please try again.'); // failure popup (data.error from backend validation)
  }
  async function toggle(p) { // stock toggle: re-POSTs same product with flipped available (upsert by NAME = same row updated!)
    const { ok } = await api('/api/me/products', { method: 'POST', body: JSON.stringify({ name: p.name, price: p.price, description: p.description, available: !p.available }) }); // ! flips true↔false
    if (ok) toast(p.available ? 'Marked out of stock.' : 'Back in stock — AI can sell it.'); // message mirrors the ACTION taken (p.available = state BEFORE flip!)
    else toast('Could not update stock', 'err');
    load(); // reload either way (cheap + always truthful)
  }
  async function del(id) { // delete with native confirm()…
    if (!confirm('Remove this product?')) return; // confirm() = browser dialog, returns boolean (Cancel → stop)
    const { ok } = await api('/api/me/products/' + id, { method: 'DELETE' }); // RESTful URL with id (string concat builds /me/products/42)
    if (ok) toast('Product removed.'); // small toast (deletes are minor — no big popup)
    else toast('Could not remove product', 'err');
    load();
  }
  return (
    <>
      <div className="page-head"><div className="row" style={{ width: '100%' }}> {/* .row = flex space-between (title left, pill right) */}
        <div><h1>Catalog</h1><p>The single source of truth. If it's not here, the AI will not promise it.</p></div>
        <span className="pill ok">AI reads this live</span> {/* status pill (decorative trust badge) */}
      </div></div>
      <div className="card">
        <h2>Products</h2>
        <p className="desc">Tip: from your WhatsApp send <b>LEARN: Blue gown ₦45,000</b> — same result, no dashboard needed.</p> {/* <b> inside <p> = inline bold (teaches the WhatsApp shortcut!) */}
        <div className="table-wrap"><table> {/* .table-wrap = horizontal scroll on small screens (responsive tables 101) */}
          <thead><tr><th>Product</th><th>Price</th><th>Status</th><th></th></tr></thead> {/* <thead>/<th> = semantic header row (empty last <th> = actions column) */}
          <tbody> {/* three states: loading → empty → rows (classic async trilogy!) */}
            {products === null ? <tr><td colSpan="4"><div className="skel-grid">{[0, 1, 2].map((i) => (<div key={i} className="skel-row"><div className="skel-lines"><div className="skel" style={{ width: '35%' }} /><div className="skel" style={{ width: '60%' }} /></div><div className="skel" style={{ width: 70 }} /><div className="skel" style={{ width: 90 }} /></div>))}</div></td></tr> {/* colSpan="4" = skeleton spans all columns; widths mimic name/desc/price/status cells */}
              : products.length === 0 ? <tr><td colSpan="4"><div className="empty"><b>No products yet</b>Add your first one below — it takes 10 seconds.</div></td></tr> {/* empty state SELLS the next action (not just "nothing here") */}
              : products.map((p) => (<tr key={p.id}> {/* key={p.id} = stable DB id (rows never shuffle wrongly!) */}
                <td><b>{p.name}</b><br /><span className="hint">{p.description || ''}</span></td> {/* <br/> stacks description under name */}
                <td>{p.price || '—'}</td> {/* || '—' : null prices show dash, never "null" */}
                <td><button className={'pill ' + (p.available ? 'ok' : 'flag')} style={{ cursor: 'pointer', border: '1px solid' }} onClick={() => toggle(p)} title="Click to toggle stock">{p.available ? 'in stock' : 'out of stock'}</button></td> {/* pill AS button: color shows state, click flips it (title = hover tooltip teaching the trick) */}
                <td style={{ textAlign: 'right' }}><button className="del" onClick={() => del(p.id)} title="Remove"><Ic n="trash" s={15} /></button></td> {/* .del = red hover trash (arrow fn passes id — onClick={() => del(p.id)} delays the call until click!) */}
              </tr>))}
          </tbody>
        </table></div>
      </div>
      <div className="card"> {/* Pro sync section: gated UI (tier state switches whole block) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}> {/* inline flex: title left, pill right, wraps on mobile */}
          <div><h2>Sync from WhatsApp Business profile</h2><p className="desc" style={{ margin: 0 }}>Paste your business profile text — the AI scaffolds your whole catalog and verifies products against it.</p></div>
          <span className={'pill ' + (tier === 'pro' ? 'ok' : 'flag')}>{tier === 'pro' ? 'PRO ON' : 'PRO'}</span> {/* badge mirrors access (green unlocked / gold locked) */}
        </div>
        {tier === 'pro' ? ( // ternary: Pro tools vs upgrade pitch (default 'free' tier NEVER flashes Pro tools!)
          <>
            <label style={{ marginTop: 12 }}>Business profile text</label> {/* <label> = accessible caption for the textarea */}
            <textarea value={syncText} onChange={(e) => setSyncText(e.target.value)} rows="4" placeholder="Amaka Beauty — Bone straight wig ₦95,000, silk press ₦15,000, open Mon–Sat 9am–7pm…" /> {/* controlled textarea: value + onChange mirror state (rows="4" = height) */}
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" disabled={syncing} onClick={sync}>{syncing ? 'Syncing…' : 'Sync profile'}</button> {/* disabled during AI call (double-click protection!) + label flips */}
              {syncInfo?.synced && <span className="hint">Last synced: {syncInfo.synced_at ? new Date(syncInfo.synced_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'yes'}</span>} {/* ?. guards null syncInfo; inline date formatting (no date lib!) */}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Tip: from your WhatsApp you can also send <b>SYNC:</b> followed by the same text.</p>
          </>
        ) : ( // free users: pitch, not tools (with a direct Upgrade button = conversion!)
          <div style={{ marginTop: 12 }}>
            <p className="hint">Profile sync is a Pro feature. Manual teaching with LEARN: stays free forever.</p>
            <div style={{ marginTop: 10 }}><Link className="btn sm" to="/billing">Upgrade to Pro</Link></div> {/* Link styled as button (to=… navigates, className styles) */}
          </div>
        )}
      </div>
      <div className="card"> {/* manual add form (free forever) */}
        <h2>Add a product</h2>
        <p className="desc">Free forever — or send <b>LEARN: Blue gown ₦45,000</b> from your WhatsApp.</p>
        <div className="grid2"> {/* two-column grid (stacks on mobile via CSS) */}
          <div><label>Product name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Blue gown" /></div> {/* {...f, name: …} = spread-copy + overwrite ONE field (immutable update = React re-renders!) */}
          <div><label>Price</label><input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="₦45,000" /></div>
        </div>
        <label>Details (optional)</label>
        <input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Sizes M–XL, cotton…" />
        <div style={{ marginTop: 14 }}><button className="btn" onClick={add}>Add product</button></div>
      </div>
    </>
  );
}
