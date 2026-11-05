// ── frontend/src/pages/Catalog.jsx ─────────────────────────────────
// WHAT: the product catalog manager on glass. Products that need fixing come first,
// each row has a stock switch and an Edit button, and Add/Edit open one sheet whose
// questions follow the shop's kind of business (lib/productFields.js). THE most
// important page: this data is literally what the AI is allowed to say.
// STATE: products (null = loading → skeletons), f (sheet draft), sheet (open?),
// editing (the row being edited), tier (free/pro), syncText/syncInfo/syncing.
// Feedback: pop() for big outcomes, toast() for small ones.
import { useEffect, useRef, useState } from 'react'; // useState ×6 slices of UI state; useEffect = triple-fetch on mount
import { Link } from 'react-router-dom'; // Link for the inline billing links (client-side nav)
import { api, pop, toast } from '../lib/api.js'; // api() calls; pop() big animated results; toast() small notes

import { categoriesFor, detailHintFor, learnExampleFor } from '../lib/niches.js'; // niche shelves + hints (electronics sees Phones, fashion sees Gowns!)
import { describeNetError } from '../lib/netDetail.js'; // one voice for load failures
import LoadFailed from '../components/LoadFailed.jsx'; // branded failed card + Retry (never eternal skeletons!)
import Ic from '../components/icons.jsx'; // trash + close glyphs
import Select from '../components/Select.jsx'; // the app's one dropdown (native <select> menus looked dated)
import Loader from '../components/Loader.jsx'; // mini orbit in sync/upload buttons
import LockButton from '../components/LockButton.jsx'; // padlock → upgrade card (the ONLY paywall affordance!)
import { buildDetails, buildPrice, fieldsFor, parseDetails, parsePrice } from '../lib/productFields.js'; // the questions for this kind of business

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
  const EMPTY = { name: '', price: '', oldPrice: '', desc: '', photo: '', qty: '', cat: '', delivery: '', location: '', howtobuy: '', answers: {} };
  const [f, setF] = useState(EMPTY); // CONTROLLED FORM: inputs mirror this object (value={f.name} + onChange writes back)
  const [sheet, setSheet] = useState(false); // the Add/Edit sheet is open
  const [editing, setEditing] = useState(null); // the product being edited (null = adding a new one)
  const [more, setMore] = useState(false); // delivery and how-to-buy details are showing
  const [saving, setSaving] = useState(false); // save in flight
  const [view, setView] = useState('all'); // 'all' | 'fix' | 'out' | a category name
  const [importing, setImporting] = useState(false); // the import panel is open
  const [niche, setNiche] = useState(''); // shop lane (drives category shelves + hint language!)
  const shelves = categoriesFor(niche); // dropdown options for THIS hustle (electronics → Phones…, fashion → Gowns…)
  const [tier, setTier] = useState('free'); // 'free' default → upgrade card flashes first if billing is slow (safe default: never show Pro tools to free users!)
  const [syncText, setSyncText] = useState(''); // pasted profile text (controlled textarea)
  const [syncInfo, setSyncInfo] = useState(null); // {synced, synced_at} from GET /api/me/profile-sync ("Last synced" label)
  const [syncing, setSyncing] = useState(false); // disables button + "Syncing…" label (prevents double-submit!)
  const [uploading, setUploading] = useState(false); // photo upload in flight (button shows "Uploading…")
  const fileRef = useRef(null); // hidden <input type="file"> — the Upload-media button clicks it open
  const [failed, setFailed] = useState(null); // null | { status, detail } — products load failure (Retry card!)
  const [tries, setTries] = useState(0); // retry counter (forces reload — no page refresh!)
  const [cq, setCq] = useState(''); // catalog text search (name, category, description — client-side, instant)
  async function load() { // reusable reload (mount + retry + every mutation — simplest correct refresh strategy)
    try {
      setFailed(null);
      const { data } = await api('/api/me/products', { timeout: 15000 });
      setProducts(data || []);
    } catch (e) { setFailed({ status: 0, detail: describeNetError(e) }); } // down/timeout → failed card (never eternal skeletons!)
  }
  useEffect(() => { // mount + retry (tries in deps!) + auto-retry when back online
    let dead = false; // unmount guard (slow networks + fast navigation!)
    load(); // products list
    api('/api/me/billing').then(({ data }) => { if (!dead && data?.tier) setTier(data.tier); }).catch(() => {}); // ?. guards failed responses (tier stays 'free' default)
    api('/api/me/profile-sync').then(({ data }) => { if (!dead && data) setSyncInfo(data); }).catch(() => {}); // garnish fetches never break the page!
    api('/api/me').then(({ data }) => { if (!dead && data?.business?.business_niche) setNiche(data.business.business_niche); }).catch(() => {}); // shop lane → niche shelves + hints
    const onOnline = () => { if (!dead && failed) setTries((t) => t + 1); }; // internet's back? reload without a tap!
    window.addEventListener('online', onOnline);
    return () => { dead = true; window.removeEventListener('online', onOnline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]); // [tries] = Retry bumps → refetch
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
  const fields = fieldsFor(niche); // this shop's own questions
  function openAdd() { setEditing(null); setF(EMPTY); setMore(false); setSheet(true); }
  function openEdit(p) { // prefill from the saved product (name stays fixed: products are saved by name)
    const { price, oldPrice } = parsePrice(p.price);
    const { answers, details } = parseDetails(p.description, fields);
    setEditing(p);
    setF({ name: p.name || '', price, oldPrice, desc: details, photo: p.image_url || '', qty: p.quantity == null ? '' : String(p.quantity), cat: p.category || '', delivery: p.delivery_info || '', location: p.location || '', howtobuy: p.how_to_buy || '', answers });
    setMore(!!(p.delivery_info || p.location || p.how_to_buy));
    setSheet(true);
  }
  useEffect(() => { // Escape closes the sheet
    if (!sheet) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSheet(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);
  async function add() { // add or edit (free forever). Products are saved by name, so an edit overwrites its own row.
    if (!f.name.trim()) return toast('Product name is required', 'err'); // only hard rule (price optional — "call for price" shops exist!)
    const description = buildDetails(f.answers, fields, f.desc);
    const body = { name: f.name.trim(), price: buildPrice(f.price, f.oldPrice) || null, description: description || null, available: editing ? editing.available : true };
    if (f.qty.trim() !== '') body.quantity = f.qty.trim(); // stock count ONLY when typed (omitted = keep existing on same-name updates — re-pricing never zeroes stock!)
    // Adding: blank keys stay out, so re-adding a name never wipes its photo or lines.
    // Editing: the sheet shows the whole product, so a blank box means clear it.
    if (f.cat || editing) body.category = f.cat;
    if (f.delivery.trim() !== '' || editing) body.delivery_info = f.delivery.trim();
    if (f.location.trim() !== '' || editing) body.location = f.location.trim();
    if (f.howtobuy.trim() !== '' || editing) body.how_to_buy = f.howtobuy.trim();
    if (f.photo.trim()) body.image_url = f.photo.trim();
    else if (editing && editing.image_url) body.image_url = '';
    setSaving(true);
    const { ok, data } = await api('/api/me/products', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (ok) { toast(editing ? 'Saved. Velo uses this straight away.' : 'Product added. Velo can sell it now.'); setSheet(false); setF(EMPTY); setEditing(null); load(); }
    else pop('err', 'Could not save this product', (data && data.error) || 'Please try again.'); // failure popup (data.error from backend validation — includes bad-photo-URL + bad-stock messages!)
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
  async function del(id) { // delete with native confirm()…
    if (!confirm('Remove this product?')) return; // confirm() = browser dialog, returns boolean (Cancel → stop)
    const { ok } = await api('/api/me/products/' + id, { method: 'DELETE' }); // RESTful URL with id (string concat builds /me/products/42)
    if (ok) toast('Product removed.'); // small toast (deletes are minor — no big popup)
    else toast('Could not remove product', 'err');
    load();
  }
  if (failed && products === null) return ( // products failed BEFORE first paint (nothing to show — failed card, never skeletons!)
    <>
      <div className="page-head"><div><h1>Catalog</h1><p>The single source of truth. If it's not here, the AI will not promise it.</p></div></div>
      <LoadFailed title="Couldn't load catalog" status={failed.status} detail={failed.detail} tries={tries} onRetry={() => { setProducts(null); setTries((t) => t + 1); }} backTo="/dashboard" backLabel="Back to Home" />
    </>
  );
  const all = products || [];
  const fixCount = all.filter((p) => !p.price).length;
  const outCount = all.filter((p) => !p.available).length;
  const ready = all.length - fixCount;
  const cats = Array.from(new Set(all.map((p) => p.category).filter(Boolean))).slice(0, 6);
  const needle = cq.trim().toLowerCase();
  const rows = all
    .filter((p) => view === 'all' || (view === 'fix' && !p.price) || (view === 'out' && !p.available) || p.category === view)
    .filter((p) => !needle || ((p.name || '') + ' ' + (p.category || '') + ' ' + (p.description || '')).toLowerCase().includes(needle))
    .sort((x, y) => (x.price ? 1 : 0) - (y.price ? 1 : 0)); // what Velo cannot quote comes first
  const ring = 2 * Math.PI * 22;
  const pct = all.length ? ready / all.length : 0;
  const pretty = (price) => { const { price: now, oldPrice } = parsePrice(price); return { now, oldPrice }; };
  const Field = ({ id, label, children }) => <div className="ps-field"><label htmlFor={id}>{label}</label>{children}</div>;
  return (
    <div className="pc">
      <div className="pc-head">
        <div>
          <div className="dg-status on"><i />Velo reads this live</div>
          <h1>Catalog</h1>
        </div>
        <button className="btn lg btn-go" onClick={openAdd}>Add product<span className="btn-go-ic"><Ic n="plus" s={18} /></span></button>
      </div>

      <div className="pc-grid">
        <section className="pc-list glass" aria-label="Products">
          <div className="pc-tools">
            <div className="wx-search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search products" aria-label="Search products" />
              {cq && <button className="wx-clear" onClick={() => setCq('')} aria-label="Clear search">×</button>}
            </div>
            <div className="wx-pills" role="group" aria-label="Filter products">
              <button className={'wx-pill' + (view === 'all' ? ' on' : '')} aria-pressed={view === 'all'} onClick={() => setView('all')}>All {products === null ? '' : all.length}</button>
              {fixCount > 0 && <button className={'wx-pill' + (view === 'fix' ? ' on is-hot' : ' is-hot-soft')} aria-pressed={view === 'fix'} onClick={() => setView(view === 'fix' ? 'all' : 'fix')}>Needs a fix {fixCount}</button>}
              {outCount > 0 && <button className={'wx-pill' + (view === 'out' ? ' on' : '')} aria-pressed={view === 'out'} onClick={() => setView(view === 'out' ? 'all' : 'out')}>Out of stock {outCount}</button>}
              {cats.map((c) => <button key={c} className={'wx-pill' + (view === c ? ' on' : '')} aria-pressed={view === c} onClick={() => setView(view === c ? 'all' : c)}>{c}</button>)}
            </div>
          </div>
          <div className="pc-rows">
            {products === null ? [0, 1, 2, 3, 4].map((i) => (<div key={i} className="pc-row" aria-hidden="true"><div className="skel pc-thumb" /><div className="skel-lines"><div className="skel" style={{ width: '55%' }} /><div className="skel" style={{ width: '35%', height: 10 }} /></div><div className="skel" style={{ width: 70 }} /></div>))
              : rows.length === 0 ? (
                <div className="empty"><span className="empty-ic"><Ic n="plus" s={24} /></span><b>{needle || view !== 'all' ? 'No products match' : 'No products yet'}</b>{needle || view !== 'all' ? 'Clear your search or try All.' : 'Add your first product, and Velo can start selling it.'}{!needle && view === 'all' && <div style={{ marginTop: 14 }}><button className="btn" onClick={openAdd}>Add product</button></div>}</div>
              ) : rows.map((p) => {
                const { now, oldPrice } = pretty(p.price);
                return (
                  <div key={p.id} className={'pc-row' + (!p.price ? ' is-fix' : '')}>
                    <span className="pc-thumb">{p.image_url ? <img src={p.image_url} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} /> : <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v14H4zM4 15l5-5 4 4 2-2 5 5" /></svg>}</span>
                    <span className="pc-main"><b>{p.name}</b><span className={!p.price ? 'is-warn' : ''}>{!p.price ? 'Needs a price, so Velo cannot quote it' : (p.category || 'No category')}</span></span>
                    <span className="pc-price">{now ? <b>{now}</b> : <b className="is-warn">No price</b>}{oldPrice ? <s>{oldPrice}</s> : null}</span>
                    <span className="pc-left">{p.quantity ?? 0} left</span>
                    <button className={'pc-switch' + (p.available ? ' on' : '')} role="switch" aria-checked={!!p.available} aria-label={p.name + ' in stock'} onClick={() => toggle(p)}><i /><span>{p.available ? 'In stock' : 'Out of stock'}</span></button>
                    <button className="pc-edit" onClick={() => openEdit(p)} aria-label={'Edit ' + p.name}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" /></svg></button>
                  </div>
                );
              })}
          </div>
        </section>

        <aside className="pc-side">
          <section className="pc-card glass">
            <div className="pc-health">
              <div><div className="dg-lbl">Catalog health</div><div className="pc-health-num"><span className="dg-num">{products === null ? '–' : ready}</span><span className="dg-of"> of {all.length} ready</span></div></div>
              <svg viewBox="0 0 56 56" width="64" height="64" role="img" aria-label={Math.round(pct * 100) + ' percent of products ready'}><defs><linearGradient id="pc-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F3FC7" /><stop offset="1" stopColor="#D03C16" /></linearGradient></defs><circle cx="28" cy="28" r="22" fill="none" stroke="var(--ring-track)" strokeWidth="8" /><circle cx="28" cy="28" r="22" fill="none" stroke="url(#pc-ring)" strokeWidth="8" strokeLinecap="round" strokeDasharray={pct * ring + ' ' + ring} transform="rotate(-90 28 28)" /></svg>
            </div>
            <p>{fixCount ? 'Velo only quotes what is here. Fix the highlighted ' + (fixCount === 1 ? 'product' : 'products') + ' so it can sell ' + (fixCount === 1 ? 'it' : 'them') + '.' : 'Velo only quotes what is here, and everything is ready to sell.'}</p>
          </section>
          <section className="pc-card glass">
            <h2>Teach from WhatsApp</h2>
            <p>Send this from your own number and the product appears here.</p>
            <div className="pc-learn">{learnExampleFor(niche)}</div>
          </section>
          <section className="pc-card pc-import">
            <h2>Import your whole shop</h2>
            <p>Paste your WhatsApp Business profile and Velo builds the catalog. Photos in replies come with it.</p>
            {tier === 'pro' ? (
              importing ? (
                <>
                  <label htmlFor="pc-sync">Business profile text</label>
                  <textarea id="pc-sync" value={syncText} onChange={(e) => setSyncText(e.target.value)} rows="4" placeholder="Amaka Beauty: Bone straight wig ₦95,000, silk press ₦15,000" />
                  <button className="pc-import-go" disabled={syncing} onClick={sync}>{syncing ? (<><Loader size={15} />Importing</>) : 'Import products'}</button>
                  {syncInfo?.synced && <span className="pc-import-note">Last import: {syncInfo.synced_at ? new Date(syncInfo.synced_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'done'}</span>}
                </>
              ) : <button className="pc-import-go" onClick={() => setImporting(true)}>Import products</button>
            ) : <div className="pc-import-lock"><LockButton title="Unlock profile sync" lines={SYNC_LINES} /><Link to="/billing">See plans</Link></div>}
          </section>
        </aside>
      </div>

      {sheet && (
        <div className="ps-back" role="presentation" onClick={() => setSheet(false)}>
          <div className="ps" role="dialog" aria-modal="true" aria-labelledby="ps-title" onClick={(e) => e.stopPropagation()}>
            <div className="ps-head">
              <h2 id="ps-title">{editing ? 'Edit product' : 'Add a product'}</h2>
              <button className="ps-close" onClick={() => setSheet(false)} aria-label="Close"><Ic n="x" s={18} /></button>
            </div>
            <div className="ps-body">
              <div className="ps-photo">
                <button type="button" className="ps-photo-btn" disabled={uploading} onClick={() => fileRef.current && fileRef.current.click()}>
                  <span className="pc-thumb ps-thumb">{f.photo.trim() ? <img src={f.photo.trim()} alt="" onError={(e) => { e.target.style.display = 'none'; }} /> : <Ic n="camera" s={24} />}</span>
                  <span><b>{uploading ? 'Uploading' : f.photo.trim() ? 'Change photo' : 'Add a photo'}</b><span>{tier === 'pro' ? 'Sent with Velo\'s replies on WhatsApp and Telegram' : 'Saved now. Upgraded shops send it in replies'}</span></span>
                  {uploading ? <Loader size={18} /> : null}
                </button>
                {tier !== 'pro' && <LockButton title="Unlock product photos" lines={PHOTO_LINES} />}
                {f.photo.trim() && <button type="button" className="ps-link" onClick={() => setF({ ...f, photo: '' })}>Remove photo</button>}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadMedia(e.target.files && e.target.files[0]); e.target.value = ''; }} />
              </div>
              {Field({ id: 'ps-name', label: 'Product name', children: <input id="ps-name" value={f.name} disabled={!!editing} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Blue gown" autoFocus={!editing} /> })}
              {editing && <p className="ps-note">The name is fixed for now. To rename, remove this product and add it again.</p>}
              <div className="ps-two">
                {Field({ id: 'ps-price', label: 'Price', children: <input id="ps-price" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="₦45,000" /> })}
                {Field({ id: 'ps-old', label: 'Old price, if on sale', children: <input id="ps-old" value={f.oldPrice} onChange={(e) => setF({ ...f, oldPrice: e.target.value })} placeholder="₦60,000" /> })}
              </div>
              <div className="ps-two">
                {Field({ id: 'ps-qty', label: 'Number in stock', children: <input id="ps-qty" type="number" min="0" step="1" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="20" /> })}
                {Field({ id: 'ps-cat', label: 'Category', children: <Select value={f.cat} onChange={(v) => setF({ ...f, cat: v })} options={[{ value: '', label: 'No category' }, ...shelves.map((x) => ({ value: x, label: x }))]} label="Category" emptyText="No shelves for this niche yet" /> })}
              </div>
              <div className="ps-group">
                {fields.map((x, i) => (
                  <div key={x.label}>
                    {Field({ id: 'ps-a' + i, label: x.label, children: x.options
                      ? <Select value={f.answers[x.label] || ''} onChange={(v) => setF({ ...f, answers: { ...f.answers, [x.label]: v } })} options={[{ value: '', label: 'Choose' }, ...x.options.map((o) => ({ value: o, label: o }))]} label={x.label} />
                      : <input id={'ps-a' + i} value={f.answers[x.label] || ''} onChange={(e) => setF({ ...f, answers: { ...f.answers, [x.label]: e.target.value } })} placeholder={x.hint} /> })}
                  </div>
                ))}
              </div>
              {Field({ id: 'ps-desc', label: 'Anything else customers should know', children: <input id="ps-desc" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder={detailHintFor(niche)} /> })}
              <button type="button" className="ps-more" aria-expanded={more} onClick={() => setMore(!more)}>Delivery, pickup and how to buy<Ic n="next" s={16} /></button>
              {more && (
                <div className="ps-group">
                  {Field({ id: 'ps-del', label: 'Delivery time', children: <input id="ps-del" value={f.delivery} maxLength={300} onChange={(e) => setF({ ...f, delivery: e.target.value })} placeholder="Lagos 24 to 48 hours, nationwide 3 to 5 days" /> })}
                  {Field({ id: 'ps-loc', label: 'Pickup location', children: <input id="ps-loc" value={f.location} maxLength={300} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Maitama, Abuja" /> })}
                  {Field({ id: 'ps-how', label: 'How to buy', children: <input id="ps-how" value={f.howtobuy} maxLength={300} onChange={(e) => setF({ ...f, howtobuy: e.target.value })} placeholder="Chat to order, pay on delivery" /> })}
                  <p className="ps-note">Velo answers "how do I get it?" from these lines and never invents them.</p>
                </div>
              )}
            </div>
            <div className="ps-foot">
              <button className="btn lg ps-save" disabled={saving} onClick={add}>{saving ? (<><Loader size={17} />Saving</>) : editing ? 'Save changes' : 'Add product'}</button>
              {editing && <button type="button" className="ps-remove" onClick={() => { const id = editing.id; setSheet(false); del(id); }}>Remove product</button>}
              {!editing && <p className="ps-note is-center">Velo can sell it as soon as you save.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
