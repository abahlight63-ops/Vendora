// ── frontend/src/pages/Catalog.jsx ─────────────────────────────────
// WHAT: the product catalog manager — table of products (toggle stock,
// delete), Pro profile-sync box, manual add form. THE most important page:
// this data is literally what the AI is allowed to say.
// STATE: products (null = loading → skeletons), f (add-form draft), tier
// (free/pro → sync box vs upgrade card), syncText/syncInfo/syncing.
// Feedback: pop() for big outcomes, toast() for small ones, sponsor hook.
import { useEffect, useRef, useState } from 'react'; // useState ×6 slices of UI state; useEffect = triple-fetch on mount
import { Link } from 'react-router-dom'; // Link for the inline billing links (client-side nav)
import { api, pop, toast } from '../lib/api.js'; // api() calls; pop() big animated results; toast() small notes
import { maybeShowVideoAd } from '../lib/ads.js'; // page-entry 30s video gate (free tier, once/day!)
import { categoriesFor, detailHintFor, learnExampleFor } from '../lib/niches.js'; // niche shelves + hints (electronics sees Phones, fashion sees Gowns!)
import { maybeShowSponsor } from '../lib/ads.js'; // sponsor interstitial after adds (free tier, max once/day)
import Ic from '../components/icons.jsx'; // trash + close glyphs
import Loader from '../components/Loader.jsx'; // mini orbit in sync/upload buttons
import LockButton from '../components/LockButton.jsx'; // padlock → upgrade card (the ONLY paywall affordance!)

const SYNC_LINES = [ // upgrade-card bullets for profile sync (LockButton feeds these to the modal!)
  'Paste your WhatsApp Business profile — AI scaffolds your whole catalog',
  'Every "is it available?" verified against your synced profile',
  'Product photos inside WhatsApp + Telegram replies',
  'Zero ads, priority support',
];
const PHOTO_LINES = [ // upgrade-card bullets for product photos
  'Your product pictures sent inside the chat bubble with each reply',
  'Works on WhatsApp + Telegram, matched to what the customer asked',
  'Profile sync + verification included',
  'Zero ads, priority support',
];

export default function Catalog() { // no props needed (fetches everything itself)
  const [products, setProducts] = useState(null); // null = loading (skeleton rows); [] = loaded-but-empty (empty state!)
  const [f, setF] = useState({ name: '', price: '', desc: '', photo: '', qty: '', cat: '' }); // CONTROLLED FORM: inputs mirror this object (value={f.name} + onChange writes back)
  const [niche, setNiche] = useState(''); // shop lane (drives category shelves + hint language!)
  const shelves = categoriesFor(niche); // dropdown options for THIS hustle (electronics → Phones…, fashion → Gowns…)
  const [tier, setTier] = useState('free'); // 'free' default → upgrade card flashes first if billing is slow (safe default: never show Pro tools to free users!)
  const [syncText, setSyncText] = useState(''); // pasted profile text (controlled textarea)
  const [syncInfo, setSyncInfo] = useState(null); // {synced, synced_at} from GET /api/me/profile-sync ("Last synced" label)
  const [syncing, setSyncing] = useState(false); // disables button + "Syncing…" label (prevents double-submit!)
  const [uploading, setUploading] = useState(false); // photo upload in flight (button shows "Uploading…")
  const fileRef = useRef(null); // hidden <input type="file"> — the Upload-media button clicks it open
  async function load() { const { data } = await api('/api/me/products'); setProducts(data || []); } // reusable reload (called after every mutation — simplest correct refresh strategy)
  useEffect(() => { // mount: independent fetches (no await between = parallel-ish; .then chains don't block each other)
    load(); // products list
    api('/api/me/billing').then(({ data }) => { if (data?.tier) setTier(data.tier); }); // ?. guards failed responses (tier stays 'free' default)
    api('/api/me/profile-sync').then(({ data }) => { if (data) setSyncInfo(data); }); // if (data) guards null (logged-out edge)
    api('/api/me').then(({ data }) => { if (data?.business?.business_niche) setNiche(data.business.business_niche); }); // shop lane → niche shelves + hints
    maybeShowVideoAd({ slot: 'page-catalog' }); // video gate (fire-and-forget: catalog loads UNDER the overlay!)
  }, []); // [] = mount-only
  async function sync() { // Pro profile-sync: paste text → AI scaffolds catalog
    if (!syncText.trim()) return toast('Paste your business profile text first', 'err'); // guard: blank submit → error toast (return stops here)
    setSyncing(true); // lock UI during the AI call (slow!.extractProducts takes seconds)
    const { ok, data } = await api('/api/me/profile-sync', { method: 'POST', body: JSON.stringify({ profile_text: syncText.trim() }) }); // .trim() once, send clean
    setSyncing(false); // unlock (BOTH paths — success AND failure — or button stays dead!)
    if (ok) { // 200: scaffolded…
      const added = data.added || [], updated = data.updated || [], unmentioned = data.unmentioned || []; // diff lists (report-only: stale items listed, never auto-touched!)
      let detail = `${added.length} new, ${updated.length} updated.`; // headline counts (always true!)
      if (unmentioned.length) detail += ` NOT in this profile (still in catalog): ${unmentioned.slice(0, 8).join(', ')}${unmentioned.length > 8 ? ` +${unmentioned.length - 8} more` : ''} — mark out of stock or delete them below.`; // stale warning (cap 8 names — popups stay readable!)
      if (data.truncated) detail += ' Note: profile text was longer than kept — first part synced only.'; // truncation honesty (no silent drops!)
      pop('ok', 'Profile synced!', detail); // big success popup with the FULL report
      setSyncText(''); setSyncInfo({ synced: true, synced_at: data.synced_at }); load(); // clear box, update label, reload table (three state updates = one re-render — React batches!)
    } else if (data?.error?.includes('Pro feature')) { // ?. chain guards missing error; .includes matches backend's 402 message specifically…
      pop('err', 'Locked feature', 'Profile sync is premium — tap the lock above to see upgrade options. Manual teaching stays free.'); // …friendly paywall (not a raw error dump)
    } else { // other failures (422 no-products-found, 500…)…
      pop('err', 'Sync failed', data.error || 'Please try again.'); // …show backend's message (|| fallback)
    }
  }
  async function add() { // manual add (free forever)
    if (!f.name.trim()) return toast('Product name is required', 'err'); // only hard rule (price optional — "call for price" shops exist!)
    const body = { name: f.name.trim(), price: f.price.trim() || null, description: f.desc.trim() || null, available: true }; // trim + empty→null (DB stores NULL, not "")
    if (f.qty.trim() !== '') body.quantity = f.qty.trim(); // stock count ONLY when typed (omitted = keep existing on same-name updates — re-pricing never zeroes stock!)
    if (f.cat) body.category = f.cat; // shelf ONLY when picked (omitted = preserved!)
    if (f.photo.trim()) body.image_url = f.photo.trim(); // photo key ONLY when pasted (omitted = preserve existing on same-name updates — re-adding a price never wipes the photo!)
    const { ok, data } = await api('/api/me/products', { method: 'POST', body: JSON.stringify(body) });
    if (ok) { pop('ok', 'Product added!', 'The AI can sell it from now on.'); setF({ name: '', price: '', desc: '', photo: '', qty: '', cat: '' }); load(); maybeShowSponsor(); } // success popup + clear form + reload + sponsor hook (fire-and-forget: no await — sponsor must never block!)
    else pop('err', 'Could not add product', data.error || 'Please try again.'); // failure popup (data.error from backend validation — includes bad-photo-URL + bad-stock messages!)
  }
  async function uploadMedia(file) { // Upload media: pick from YOUR files → hosted → URL fills the photo field
    if (!file) return; // dialog cancelled → nothing to do
    if (!String(file.type || '').startsWith('image/')) return toast('Please choose an image file', 'err'); // String() guards undefined type
    if (file.size > 2.5 * 1024 * 1024) return toast('Image too large — max 2.5MB', 'err'); // server cap mirrored here (fail fast, no wasted upload!)
    setUploading(true); // lock the button (double-tap protection!)
    try {
      const dataUrl = await new Promise((res, rej) => { // FileReader is callback-based → wrap in a Promise to await it
        const r = new FileReader(); // built-in browser API (reads local files — nothing leaves the phone yet!)
        r.onload = () => res(r.result); // result = "data:image/jpeg;base64,…"
        r.onerror = () => rej(new Error('read failed'));
        r.readAsDataURL(file); // start reading (onload fires when done)
      });
      const { ok, data } = await api('/api/me/product-photo', { method: 'POST', body: JSON.stringify({ filename: file.name, dataUrl }) }); // server hosts it, hands back a URL
      if (ok && data.url) { setF({ ...f, photo: data.url }); toast('Photo uploaded.'); } // URL lands in the draft (preview appears below!)
      else toast((data && data.error) || 'Upload failed', 'err');
    } catch { toast('Upload failed — check your connection', 'err'); } // network/read failure (empty catch block with statement = fine!)
    setUploading(false); // unlock either way (or the button stays dead!)
  }
  async function toggle(p) { // stock toggle: re-POSTs same product with flipped available (upsert by NAME = same row updated!)
    const { ok } = await api('/api/me/products', { method: 'POST', body: JSON.stringify({ name: p.name, price: p.price, description: p.description, available: !p.available }) }); // ! flips true↔false (image_url OMITTED on purpose — absent key = preserve the photo!)
    if (ok) toast(p.available ? 'Marked out of stock.' : 'Back in stock — AI can sell it.'); // message mirrors the ACTION taken (p.available = state BEFORE flip!)
    else toast('Could not update stock', 'err');
    load(); // reload either way (cheap + always truthful)
  }
  async function clearPhoto(p) { // remove just the photo (keeps name/price/stock — explicit null = clear!)
    if (!confirm('Remove the photo for "' + p.name + '"?')) return; // confirm() = browser dialog (Cancel → stop)
    const { ok, data } = await api('/api/me/products', { method: 'POST', body: JSON.stringify({ name: p.name, price: p.price, description: p.description, available: p.available, image_url: null }) });
    if (ok) toast('Photo removed.'); // small toast (minor change — no big popup)
    else toast(data.error || 'Could not remove photo', 'err');
    load();
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
          <thead><tr><th></th><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead> {/* <thead>/<th> = semantic header row (empty first <th> = photo thumb; empty last <th> = actions column; Stock = live quantity!) */}
          <tbody> {/* three states: loading → empty → rows (classic async trilogy!) */}
            {products === null ? <tr><td colSpan="6"><div className="skel-grid">{[0, 1, 2].map((i) => (<div key={i} className="skel-row"><div className="skel-lines"><div className="skel" style={{ width: '35%' }} /><div className="skel" style={{ width: '60%' }} /></div><div className="skel" style={{ width: 70 }} /><div className="skel" style={{ width: 90 }} /></div>))}</div></td></tr>
              : products.length === 0 ? <tr><td colSpan="6"><div className="empty"><b>No products yet</b>Add your first one below — it takes 10 seconds.</div></td></tr>
              : products.map((p) => (<tr key={p.id}> {/* key={p.id} = stable DB id (rows never shuffle wrongly!) */}
                <td>{p.image_url ? <img src={p.image_url} alt="" width="40" height="40" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, display: 'block' }} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} /> : <span className="hint">—</span>}</td> {/* thumb (onError hides dead links — dashboard never shows broken-image icons!) */}
                <td><b>{p.name}</b>{p.category ? <span className="pill" style={{ marginLeft: 6, fontSize: 11 }}>{p.category}</span> : null}<br /><span className="hint">{p.description || ''}</span></td> {/* category pill beside the name (<br/> stacks description under name) */}
                <td>{p.price || '—'}</td> {/* || '—' : null prices show dash, never "null" */}
                <td><b>{p.quantity ?? 0}</b></td> {/* live stock count (?? 0: legacy rows show 0, never blank — WhatsApp updates land here instantly!) */}
                <td><button className={'pill ' + (p.available ? 'ok' : 'flag')} style={{ cursor: 'pointer', border: '1px solid' }} onClick={() => toggle(p)} title="Click to toggle stock">{p.available ? 'in stock' : 'out of stock'}</button></td> {/* pill AS button: color shows state, click flips it (title = hover tooltip teaching the trick) */}
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{p.image_url && <button className="del" onClick={() => clearPhoto(p)} title="Remove photo" aria-label={'Remove photo for ' + p.name} style={{ marginRight: 6 }}><Ic n="x" s={14} /></button>}<button className="del" onClick={() => del(p.id)} title="Remove"><Ic n="trash" s={15} /></button></td> {/* photo-clear = drawn X (never an emoji!); trash = delete row */}
              </tr>))}
          </tbody>
        </table></div>
      </div>
      <div className="card"> {/* sync section: gated UI (tier state switches whole block) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}> {/* inline flex: title left, lock right, wraps on mobile */}
          <div><h2>Sync from WhatsApp Business profile</h2><p className="desc" style={{ margin: 0 }}>Paste your business profile text — the AI scaffolds your whole catalog and verifies products against it.</p></div>
          {tier === 'pro' ? <span className="pill ok">On</span> : <LockButton title="Unlock profile sync" lines={SYNC_LINES} />} {/* locked = padlock only (no PRO text!); tap → upgrade card */}
        </div>
        {tier === 'pro' ? ( // ternary: Pro tools vs upgrade pitch (default 'free' tier NEVER flashes Pro tools!)
          <>
            <label style={{ marginTop: 12 }}>Business profile text</label> {/* <label> = accessible caption for the textarea */}
            <textarea value={syncText} onChange={(e) => setSyncText(e.target.value)} rows="4" placeholder="Amaka Beauty — Bone straight wig ₦95,000, silk press ₦15,000, open Mon–Sat 9am–7pm…" /> {/* controlled textarea: value + onChange mirror state (rows="4" = height) */}
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" disabled={syncing} onClick={sync}>{syncing ? (<><Loader size={15} />Syncing…</>) : 'Sync profile'}</button> {/* disabled during AI call (double-click protection!) + orbit flips */}
              {syncInfo?.synced && <span className="hint">Last synced: {syncInfo.synced_at ? new Date(syncInfo.synced_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'yes'}</span>} {/* ?. guards null syncInfo; inline date formatting (no date lib!) */}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Tip: from your WhatsApp you can also send <b>SYNC:</b> followed by the same text.</p>
          </>
        ) : ( // free users: pitch, not tools (tap the lock = upgrade card!)
          <div style={{ marginTop: 12 }}>
            <p className="hint">Profile sync is a premium feature. Manual teaching with LEARN: stays free forever — tap the lock above to see upgrade options.</p>
          </div>
        )}
      </div>
        <div className="card"> {/* manual add form (free forever) */}
        <h2>Add a product</h2>
        <p className="desc">Free forever — or send <b>{learnExampleFor(niche)}</b> from your WhatsApp.</p>
        <div className="grid2"> {/* two-column grid (stacks on mobile via CSS) */}
          <div><label>Product name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Blue gown" /></div> {/* {...f, name: …} = spread-copy + overwrite ONE field (immutable update = React re-renders!) */}
          <div><label>Price</label><input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="₦45,000" /></div>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}> {/* stock + shelf side by side (stacks on mobile via CSS) */}
          <div><label>Number in stock</label><input type="number" min="0" step="1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="e.g. 20" inputMode="numeric" /></div> {/* whole units only (backend floors + rejects negatives!) */}
          <div><label>Category</label><select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}><option value="">No category</option>{shelves.map((s) => (<option key={s} value={s}>{s}</option>))}</select></div> {/* niche shelves: THIS hustle's sections only! */}
        </div>
        <label style={{ marginTop: 10 }}>Details (optional)</label>
        <input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder={detailHintFor(niche)} />
        <div style={{ marginTop: 12, border: '1px dashed #25D366', borderRadius: 12, padding: 12, background: 'rgba(37,211,102,0.05)' }}> {/* photo box: dashed green = "attachment" affordance */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ margin: 0 }}>Product photo {tier !== 'pro' && <LockButton title="Unlock product photos" lines={PHOTO_LINES} />}</label> {/* locked = padlock beside the label (no PRO text!); tap → upgrade card */}
            {f.photo.trim() && <button className="del" style={{ fontSize: 12 }} onClick={() => setF({ ...f, photo: '' })}>Clear</button>} {/* draft clear (no confirm — not saved yet!) */}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" disabled={uploading} onClick={() => fileRef.current && fileRef.current.click()}><Ic n="camera" s={15} />{uploading ? (<><Loader size={15} />Uploading…</>) : 'Upload media'}</button> {/* opens the phone's file picker (accept = images only!) */}
            <span className="hint">…or paste an image link below</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadMedia(e.target.files && e.target.files[0]); e.target.value = ''; }} /> {/* hidden picker; value reset so the SAME file can be re-picked! */}
          <input value={f.photo} onChange={(e) => setF({ ...f, photo: e.target.value })} placeholder="Paste a public image link: https://…" inputMode="url" spellCheck="false" style={{ marginTop: 8 }} />
          {f.photo.trim() ? ( // live preview: whenever the draft holds a URL (pasted OR uploaded!)
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <img src={f.photo.trim()} alt="" width="64" height="64" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, display: 'block' }} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
              <span className="hint">{tier === 'pro' ? 'Looks good — the bot will send this photo with its reply on WhatsApp + Telegram.' : 'Saved for you — upgraded shops send photos in replies. Tap the lock above to switch it on.'}</span>
            </div>
          ) : (
            <p className="hint" style={{ margin: '8px 0 0' }}>{tier === 'pro' ? 'Choose Upload media to pick from your files, or paste any public https image link — customers see it inside the chat bubble with the reply.' : 'Free shops save the photo, upgraded shops send it. Upload now, upgrade later — nothing is lost.'} {tier !== 'pro' && <Link to="/billing">See plans</Link>}</p>
          )}
        </div>
        <div style={{ marginTop: 14 }}><button className="btn" onClick={add}>Add product</button></div>
      </div>
    </>
  );
}
