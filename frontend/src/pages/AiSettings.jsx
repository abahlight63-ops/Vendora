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
import Select from '../components/Select.jsx'; // the ONE dropdown control (same as catalog, billing, niche)
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

export default function AiSettings({ biz }) {
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
    if (b.locked) { pop('err', `${b.label} needs a bigger plan`, 'That tier runs the heaviest engines — open Billing to compare plans.'); return; }
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
      <div className="page-head"><div className="row">
        <div><h1>AI settings</h1><p>Who answers, how they sound, and what they may promise. Yours to shape.</p></div>
        <span className="pill ok"><Ic n="check" s={12} />{cur.label} live</span>
      </div></div>

      {/* ── 1. the brain ─────────────────────────────────────────────── */}
      <div className="card">
        <h2>Which AI answers your customers</h2>
        <p className="desc">Three settings, not thirty models. Pick how hard Velo should think on WhatsApp — you can change it any time.</p>
        <div className="ai-tiers">
          {BUCKETS.map((b) => {
            const m = modelFor(b.key, models);
            const locked = models.length > 0 && (!m || m.locked);
            const on = tier === b.key;
            return (
              <button key={b.key} type="button" aria-pressed={on} className={'ai-tier' + (on ? ' on' : '') + (locked ? ' locked' : '')} onClick={() => pickTier({ ...b, locked })}>
                <span className="ai-tier-top">
                  <span className="ai-tier-name">{b.label}</span>
                  {locked ? <span className="pill flag"><Ic n="lock" s={11} />Pro Plus</span> : <span className="pill ok">Included</span>}
                  <span className="ai-tier-radio">{on ? <Ic n="check" s={12} /> : null}</span>
                </span>
                <span className="ai-tier-blurb">{b.blurb}</span>
                <span className="ai-tier-for">
                  {FOR[b.key].map((line) => <span key={line}><Ic n="check" s={12} />{line}</span>)}
                </span>
                {b.key === 'normal' && <span className="ai-tier-tag">Most owners keep this</span>}
              </button>
            );
          })}
        </div>
        <p className="hint">Locked tiers run the heaviest engines, which cost us more per answer — they come with the top plan.</p>
      </div>

      {/* ── 2. the voice ─────────────────────────────────────────────── */}
      <div className="card">
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
      <div className="card">
        <h2>Greeting</h2>
        <p className="desc">What the AI says when a customer just says "hey" or "hello". Leave it empty for the built-in polite greeting.</p>
        <label>Custom greeting (optional)</label>
        <textarea value={f.greeting} onChange={set('greeting')} rows="2" maxLength={300} placeholder="e.g. Hello and welcome to Amaka Beauty! How are you doing today? What can we help you with?" />
        <div className="ai-prev">
          <span className="ai-prev-lab">Your customer sees this</span>
          <div className="ai-bubble">
            <span className="ai-av"><Ic n="spark" s={15} /></span>
            <span className="ai-msg">{f.greeting.trim() || `Hello and welcome to ${biz?.name || 'our shop'}! How can we help you today?`}</span>
          </div>
        </div>
      </div>

      {/* ── 4. money guardrails ─────────────────────────────────────── */}
      <div className="card">
        <h2>Negotiation (SmartDeal)</h2>
        <p className="desc">The AI only offers a discount when a customer hesitates on price — never otherwise.</p>
        <div className="grid2">
          <div><label>Max discount % (0 = never discount)</label><input type="number" min="0" max="50" value={f.discount} onChange={set('discount')} /></div> {/* min/max are browser hints only — the server re-clamps */}
          <div><label>Only on orders above {symbol}</label><input type="number" min="0" value={f.minOrder} onChange={set('minOrder')} /></div>
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
      <div className="card">
        <h2>Human handoff</h2>
        <p className="desc">Sent when the AI isn't sure — instead of guessing and losing trust. Always polite, in your words.</p>
        <label>Fallback message</label>
        <textarea value={f.handoff} onChange={set('handoff')} rows="3" maxLength={500} />
        <div className="ai-prev">
          <span className="ai-prev-lab">Your customer sees this</span>
          <div className="ai-bubble">
            <span className="ai-av"><Ic n="spark" s={15} /></span>
            <span className="ai-msg">{f.handoff.trim() || 'Thanks for your message! A member of our team will get back to you shortly.'}</span>
          </div>
        </div>
      </div>

      {/* the save bar follows you down the page: the page is long, and an
          unsaved tone that scrolls out of sight is an invisible bug. */}
      <div className="ai-save">
        <span className={'ai-save-note' + (dirty ? ' dirty' : '')}>{dirty ? 'Unsaved changes' : 'Everything saved'}</span>
        <button className="btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>
    </>
  );
}
