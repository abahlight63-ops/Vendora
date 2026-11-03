// ── frontend/src/pages/AiSettings.jsx ────────────────────────────
// WHAT: the assistant's control room. Three jobs, in the order an owner cares
// about them:
//   1. WHICH AI answers your customers (Fast / Normal / Smart — the only names
//      an owner ever sees; the engines behind them are an implementation
//      detail that changes with price and availability).
//   2. HOW it talks (personality, greeting, human handoff) — each with a live
//      preview of what the customer actually receives.
//   3. WHAT it's allowed to do about money (SmartDeal %, minimum order).
// DATA: GET /api/me/ai-models (tiers + locks) + GET /api/me/channels (the brain
// this shop is on today). Saves are two-step because the business PUT replaces
// the whole row: business fields first (so validation passes), THEN settings.
import { useEffect, useState } from 'react'; // useState = the form + the picked tier; useEffect = load tiers once
import { api, pop } from '../lib/api.js'; // api() calls; pop() animated outcomes
import Select from '../components/Select.jsx';
import GlassUpsell from '../components/GlassUpsell.jsx'; // the upgrade card for locked choices // the ONE dropdown control (same as catalog, billing, niche)
import Ic from '../components/icons.jsx'; // check/tick glyphs
import { BUCKETS, bucketOf, idFor, modelFor } from '../components/BrainPicker.jsx'; // the ONLY module that knows engines exist

// What each tier is actually for, in the owner's words. Three tiers, three
// promises — no provider names, no model version numbers.
const FOR = {
  fast: ['Prices, stock and opening hours', '“Where are you?” and “How much?”', 'When a customer is in a hurry'],
  normal: ['Most days, most conversations', 'Prices, sizes, delivery and follow-ups', 'The best balance of speed and depth'],
  smart: ['Tricky bargaining and long questions', 'Writing captions and offers for you', 'When quality matters more than speed'],
};

// The shop's voice. Values are what the server stores (plain text, lower case);
// labels are what an owner reads. One dropdown, five real choices — the old
// free-text box plus chips made people wonder whether their own words counted.
const TONES = [
  { value: 'warm and friendly', label: 'Warm and friendly', hint: 'Greets people, never rushes them' },
  { value: 'friendly and helpful', label: 'Friendly and helpful', hint: 'The balanced default — clear and kind' },
  { value: 'short and businesslike', label: 'Short and businesslike', hint: 'Price, stock, next step. No small talk' },
  { value: 'playful market aunty', label: 'Playful market aunty', hint: 'Local warmth and light teasing, always respectful' },
  { value: 'calm and respectful', label: 'Calm and respectful', hint: 'Gentle and patient — good for premium goods' },
];

function canonicalTone(raw) {
  const t = String(raw || '').trim();
  const hit = TONES.find((x) => x.value.toLowerCase() === t.toLowerCase());
  return hit ? hit.value : (t || 'friendly and helpful');
}

// Ready-made lines for the dropdowns. {shop} becomes the shop name. "Write my own"
// keeps a box for anything else, and an older custom line stays selectable.
const GREETINGS = [
  ['', 'Built-in welcome', 'Hello and welcome to {shop}! How can we help you today?'],
  ['Welcome to {shop}! What can we get for you today? 💜', 'Welcome and ask what they need', ''],
  ['Hello! Thanks for messaging {shop}. Ask me about any product, price or delivery.', 'Welcome and list what Velo can help with', ''],
  ['Hello o! Welcome to {shop}. Wetin you dey find today?', 'Friendly Pidgin', ''],
];
const HANDOFFS = [
  ['Thanks for your message! A member of our team will get back to you shortly.', 'Say the team will reply soon', ''],
  ['Thanks for your message! {owner} will reply you shortly.', 'Promise a quick reply from you', ''],
  ['Thanks for asking! Let me check with the team and get back to you soon.', 'Say the team will check', ''],
  ['No wahala, {owner} go reply you sharp sharp. 🙏', 'Pidgin, friendly', ''],
];
const DISCOUNTS = [0, 5, 10, 15, 20, 25];
const MIN_ORDERS = [0, 10000, 20000, 50000, 100000];
const fill = (t, shop, owner) => String(t).replace(/\{shop\}/g, shop).replace(/\{owner\}/g, owner);

export default function AiSettings({ biz, embedded = false }) {
  const [f, setF] = useState({
    tone: canonicalTone(biz?.tone),
    greeting: biz?.greeting_msg || '',
    handoff: biz?.handoff_msg || 'Thanks for your message! A member of our team will get back to you shortly.',
    discount: biz?.max_discount_pct ?? 0,
    minOrder: biz?.min_order_naira ?? 0,
  }); // ?? (not ||): 0 is VALID and must survive (|| would turn 0 into default — classic bug avoided!)
  const [models, setModels] = useState([]); // tier picker source (locked flags depend on plan)
  const [brainId, setBrainId] = useState(null); // the engine id the server stores today (never shown to anyone)
  const [tier, setTier] = useState('normal'); // which tier answers customers — the name we DO show
  const [busy, setBusy] = useState(false); // saving flag (disables the bar — no double submits)
  const [upsell, setUpsell] = useState(null); // which locked feature's upgrade card is open
  const [ownGreet, setOwnGreet] = useState(false);
  const [ownHand, setOwnHand] = useState(false);
  const [dirty, setDirty] = useState(false); // any unsaved edit (drives the save bar + beforeunload)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setDirty(true); }; // curried setter factory + dirty flag (one line for every field)

  useEffect(() => { // once: the tier list + which engine this shop answers on today
    let dead = false;
    api('/api/me/ai-models').then(({ ok, data }) => { if (!dead && ok && Array.isArray(data.models)) setModels(data.models); }).catch(() => {});
    api('/api/me/channels').then(({ ok, data }) => { if (!dead && ok && data.whatsapp?.model) setBrainId(data.whatsapp.model); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  useEffect(() => { // translate the stored engine id back into the tier name — only once both are known
    if (!brainId) return undefined;
    const m = models.find((x) => x.id === brainId);
    if (m) setTier(bucketOf(m.badge));
    return undefined;
  }, [brainId, models]);

  useEffect(() => { // a half-written greeting shouldn't vanish on a tab close (cheap honesty)
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function pickTier(b) { // choosing a tier writes the CONCRETE id behind it
    if (b.locked) { setUpsell({ icon: 'bulb', title: `Unlock ${b.label} answers`, sub: 'Our smartest Velo: deeper answers, best at haggling and long questions.' }); return; }
    const prev = tier;
    const id = idFor(b.key, models);
    setTier(b.key); // optimistic: the radio moves instantly (feels like a switch, not a request)
    const { ok, data } = await api('/api/me/whatsapp-model', { method: 'PUT', body: JSON.stringify({ model: id }) });
    if (ok) { setBrainId(id); pop('ok', `${b.label} is answering now`, b.key === 'fast' ? 'Fastest replies — shortest answers.' : b.key === 'smart' ? 'Deepest answers — a little slower.' : 'Balanced — the everyday pick.'); return; }
    setTier(prev); // failed → put it back (never lie about what is live)
    pop('err', 'Could not switch', data?.error || 'Please try again.');
  }

  async function save() { // two-step save (business fields first, then the AI settings row)
    setBusy(true);
    const step1 = await api('/api/me/business', { method: 'PUT', body: JSON.stringify({ name: biz.name, owner_number: biz.owner_number, hours: biz.hours, tone: f.tone.trim() || 'friendly and helpful', faq: biz.faq }) }); // PUT replaces all — must resend everything or the validator complains "name required"!
    if (!step1.ok) { setBusy(false); pop('err', 'Save failed', (step1.data.errors || ['Please try again.']).join('; ')); return; } // stop — don't save half a page
    const step2 = await api('/api/me/settings', { method: 'PUT', body: JSON.stringify({ max_discount_pct: Number(f.discount) || 0, min_order_naira: Number(f.minOrder) || 0, greeting_msg: f.greeting.trim(), handoff_msg: f.handoff.trim() }) }); // Number() because number inputs still hand back STRINGS; || 0 swallows ""
    setBusy(false);
    if (step2.ok) { setDirty(false); pop('ok', 'AI settings saved!', 'Your voice and guardrails are live.'); }
    else if (step2.status === 404) { setDirty(false); pop('ok', 'Profile saved!', 'Your business details are updated.'); } // ancient backend without /settings — never lie with an error when work succeeded
    else pop('err', 'Could not save settings', 'Please try again.');
  }

  const cur = BUCKETS.find((b) => b.key === tier) || BUCKETS[1];
  const symbol = biz?.currency === 'USD' ? '$' : '₦';
  // Keep an older custom sentence selectable (never silently overwrite it).
  const toneOptions = TONES.some((t) => t.value === f.tone)
    ? TONES
    : [{ value: f.tone, label: f.tone, hint: 'Your saved style — pick one above to simplify' }, ...TONES];
  const pct = Number(f.discount) || 0;
  const sample = 21500; // a believable dress price, only used to SHOW the maths
  return (
    <>
      {!embedded && <div className="page-head"><div className="row">
        <div><h1>AI settings</h1><p>Who answers, how they sound, and what they may promise. Yours to shape.</p></div>
        <span className="pill ok"><Ic n="check" s={12} />{cur.label} live</span>
      </div></div>}

      {/* ── 1. the brain ─────────────────────────────────────────────── */}
      <div className="card" data-guide="brain">
        <h2>Which Velo answers your customers</h2>
        <p className="desc">Locked choices come with Pro. Tap one to see what you get.</p>
        <div className="ai-tiers">
          {BUCKETS.map((b) => {
            const m = modelFor(b.key, models);
            const locked = models.length > 0 && (!m || m.locked);
            const on = tier === b.key;
            return (
              <button key={b.key} type="button" aria-pressed={on} className={'ai-tier' + (on ? ' on' : '') + (locked ? ' locked' : '')} onClick={() => pickTier({ ...b, locked })}>
                {locked && <span className="lock-tag ai-tier-lock"><Ic n="lock" s={11} />Pro</span>}
                <span className="ai-tier-ic"><Ic n={b.key === 'fast' ? 'bolt' : b.key === 'smart' ? 'bulb' : 'chart'} s={20} /></span>
                <span className="ai-tier-name">{b.label}</span>
                <span className="ai-tier-blurb">{b.key === 'fast' ? 'Quickest answers' : b.key === 'smart' ? 'Deepest answers, best at haggling' : 'The everyday pick'}</span>
                {locked ? <span className="ai-tier-unlock">Unlock with Pro →</span> : on ? <span className="ai-tier-use"><Ic n="check" s={13} />In use</span> : <span className="pill ok">Included</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. the voice ─────────────────────────────────────────────── */}
      <div className="card" data-guide="personality">
        <h2>Personality</h2>
        <p className="desc">How the AI talks to customers. Warm and respectful is built in — choose the style closest to your shop.</p>
        <label>Shop personality</label>
        <Select
          value={f.tone}
          onChange={(v) => { setF({ ...f, tone: v }); setDirty(true); }}
          options={toneOptions}
          label="Shop personality"
          placeholder="Choose a personality"
        />
        <p className="hint" style={{ marginTop: 8 }}>
          {toneOptions.find((t) => t.value === f.tone)?.hint || 'Pick how your shop should sound.'}
        </p>
      </div>

      {/* ── 3. greeting, with the customer's-eye preview ─────────────── */}
      <div className="card" data-guide="greeting">
        <h2>Greeting</h2>
        <p className="desc">What the AI says when a customer just says "hey" or "hello". Leave it empty for the built-in polite greeting.</p>
        <label>First message to new customers</label>
        {(() => {
          const shop = biz?.name || 'our shop';
          const opts = GREETINGS.map(([v, label, hint]) => ({ value: fill(v, shop, ''), label, hint: v ? fill(v, shop, '') : fill(hint, shop, '') }));
          const known = opts.some((o) => o.value === f.greeting.trim());
          const val = ownGreet || !known ? '__own' : f.greeting.trim();
          return (<>
            <Select value={val} onChange={(v) => { if (v === '__own') { setOwnGreet(true); } else { setOwnGreet(false); setF({ ...f, greeting: v }); } setDirty(true); }} options={[...opts, { value: '__own', label: 'Write my own', hint: 'Type exactly what Velo should say' }]} label="First message to new customers" />
            {val === '__own' && <textarea value={f.greeting} onChange={set('greeting')} rows="2" maxLength={300} placeholder="Type your greeting" style={{ marginTop: 10 }} />}
          </>);
        })()}
        <div className="ai-prev">
          <span className="ai-prev-lab">Your customer sees this</span>
          <div className="ai-bubble">
            <span className="ai-av"><Ic n="spark" s={15} /></span>
            <span className="ai-msg">{f.greeting.trim() || `Hello and welcome to ${biz?.name || 'our shop'}! How can we help you today?`}</span>
          </div>
        </div>
      </div>

      {/* ── 4. money guardrails ─────────────────────────────────────── */}
      <div className="card" data-guide="discount">
        <h2>Discounts</h2>
        <p className="desc">The AI only offers a discount when a customer hesitates on price — never otherwise.</p>
        <div className="grid2">
          <div><label>Biggest discount</label><Select value={String(Number(f.discount) || 0)} onChange={(v) => { setF({ ...f, discount: Number(v) }); setDirty(true); }} options={[...new Set([...DISCOUNTS, Number(f.discount) || 0])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: n ? n + '% off' : 'No discounts', hint: n ? 'The most Velo may offer' : 'Velo always holds your price' }))} label="Biggest discount" /></div> {/* min/max are browser hints only — the server re-clamps */}
          <div><label>Only on orders above</label><Select value={String(Number(f.minOrder) || 0)} onChange={(v) => { setF({ ...f, minOrder: Number(v) }); setDirty(true); }} options={[...new Set([...MIN_ORDERS, Number(f.minOrder) || 0])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: n ? symbol + n.toLocaleString() : 'Any order', hint: n ? 'Smaller orders pay full price' : 'Discounts on every order size' }))} label="Only on orders above" /></div>
        </div>
        <div className="ai-prev">
          <span className="ai-prev-lab">What that does, in practice</span>
          <p className="ai-math">
            {pct > 0
              ? <>A hesitating customer on a {symbol}{sample.toLocaleString()} dress can be offered up to <b>{symbol}{Math.max(0, Math.round(sample * (1 - pct / 100))).toLocaleString()}</b> ({pct}% off){Number(f.minOrder) > 0 ? <> — but only on orders above {symbol}{Number(f.minOrder).toLocaleString()}</> : null}. Below that, it holds your price.</>
              : 'Discounts are off. Velo will answer every price question with your price and never negotiate.'}
          </p>
        </div>
      </div>

      {/* ── 5. handoff ──────────────────────────────────────────────── */}
      <div className="card" data-guide="handoff">
        <h2>When Velo is not sure</h2>
        <p className="desc">Sent when the AI isn't sure — instead of guessing and losing trust. Always polite, in your words.</p>
        <label>What Velo says</label>
        {(() => {
          const owner = (biz?.name || 'The team').split(' ')[0];
          const opts = HANDOFFS.map(([v, label]) => ({ value: fill(v, '', owner), label, hint: fill(v, '', owner) }));
          const known = opts.some((o) => o.value === f.handoff.trim());
          const val = ownHand || !known ? '__own' : f.handoff.trim();
          return (<>
            <Select value={val} onChange={(v) => { if (v === '__own') { setOwnHand(true); } else { setOwnHand(false); setF({ ...f, handoff: v }); } setDirty(true); }} options={[...opts, { value: '__own', label: 'Write my own', hint: 'Type exactly what Velo should say' }]} label="When Velo is not sure" />
            {val === '__own' && <textarea value={f.handoff} onChange={set('handoff')} rows="3" maxLength={500} style={{ marginTop: 10 }} />}
          </>);
        })()}
        <div className="ai-prev">
          <span className="ai-prev-lab">Your customer sees this</span>
          <div className="ai-bubble">
            <span className="ai-av"><Ic n="spark" s={15} /></span>
            <span className="ai-msg">{f.handoff.trim() || 'Thanks for your message! A member of our team will get back to you shortly.'}</span>
          </div>
        </div>
      </div>

      <div className="card" data-guide="extras">
        <h2>Extras</h2>
        <p className="desc">Locked extras come with a bigger plan. Tap one to see what you get.</p>
        {[
          ['camera', 'Product photos in replies', 'Velo sends the photo with the price', 'Plus', biz?.tier === 'pro' || biz?.tier === 'plus'],
          ['refresh', 'Import your WhatsApp catalog', 'Bring every product in with one tap', 'Plus', biz?.tier === 'pro' || biz?.tier === 'plus'],
          ['phone', 'Voice notes', 'Velo listens and replies to voice notes', 'Pro', biz?.plan_tier === 'plus' && biz?.tier === 'pro'],
        ].map(([ic, t, d, plan, on]) => (
          <button key={t} type="button" className="ai-extra" onClick={() => !on && setUpsell({ icon: ic, title: t, sub: d + '.', plan })}>
            <span className="ai-extra-ic"><Ic n={ic} s={20} /></span>
            <span className="ai-extra-main"><b>{t}</b><span>{d}</span></span>
            {on ? <span className="pill ok"><Ic n="check" s={11} />Included</span> : <span className="lock-tag"><Ic n="lock" s={11} />{plan}</span>}
          </button>
        ))}
      </div>
      <GlassUpsell show={!!upsell} onClose={() => setUpsell(null)} icon={upsell?.icon} title={upsell?.title} sub={upsell?.sub} plan={upsell?.plan || 'Pro'} />

      {/* the save bar follows you down the page: the page is long, and an
          unsaved tone that scrolls out of sight is an invisible bug. */}
      <div className="ai-save">
        <span className={'ai-save-note' + (dirty ? ' dirty' : '')}>{dirty ? 'Unsaved changes' : 'Everything saved'}</span>
        <button className="btn lg" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving' : 'Save changes'}</button>
      </div>
    </>
  );
}
