// ── frontend/src/pages/Settings.jsx ──────────────────────────────
// WHAT: the AI's voice + guardrails — personality (tone), greeting message,
// human-handoff fallback, SmartDeal negotiation (max %, min order). Two saves
// in sequence: business fields first (so the PUT validator passes), THEN the
// settings endpoint. No npm modules — api + pop.
import { useState } from 'react'; // single form object state
import { api, pop } from '../lib/api.js'; // api() ×2 calls; pop() animated outcomes

export default function Settings({ biz }) { // biz = business (name/numbers/hours/tone/faq + greeting_msg/handoff_msg + guardrails!)
  const [f, setF] = useState({
    tone: biz?.tone || 'friendly and helpful',
    greeting: biz?.greeting_msg || '',
    handoff: biz?.handoff_msg || 'Thanks for your message! A member of our team will get back to you shortly.',
    discount: biz?.max_discount_pct ?? 0,
    minOrder: biz?.min_order_naira ?? 0,
  }); // ?? (not ||): 0 is VALID and must survive (|| would turn 0 into default — classic bug avoided!)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); // same curried-setter factory as Profile (one handler for all fields!)
  async function save() {
    const { ok, data } = await api('/api/me/business', { method: 'PUT', body: JSON.stringify({ name: biz.name, owner_number: biz.owner_number, hours: biz.hours, tone: f.tone.trim() || 'friendly and helpful', faq: biz.faq }) }); // STEP 1: re-save business fields WITH the new tone (PUT replaces all — must resend everything or validator complains "name required"!)
    if (!ok) { pop('err', 'Save failed', (data.errors || ['Please try again.']).join('; ')); return; } // step 1 failed → stop (return) — don't save half a settings page!
    const r2 = await api('/api/me/settings', { method: 'PUT', body: JSON.stringify({ max_discount_pct: Number(f.discount) || 0, min_order_naira: Number(f.minOrder) || 0, greeting_msg: f.greeting.trim(), handoff_msg: f.handoff.trim() }) }); // STEP 2: guardrails + voice (Number() because number inputs still give STRINGS! || 0 handles "")
    if (r2.ok) pop('ok', 'AI settings saved!', 'Your voice and guardrails are live.'); // both steps green → success
    else if (r2.status === 404) pop('ok', 'Profile saved!', 'Your business details are updated.'); // defensive: ancient backend without /settings still counts profile as saved (never lie with an error when work succeeded!)
    else pop('err', 'Could not save settings', 'Please try again.'); // genuine step-2 failure
  }
  return (
    <>
      <div className="page-head"><div><h1>AI settings</h1><p>Your AI's voice and guardrails. Polite by default — these make it yours.</p></div></div>
      <div className="card">
        <h2>Personality</h2>
        <p className="desc">How the AI talks to customers. Warm and respectful is built in — describe YOUR shop's style here.</p>
        <label>Shop personality (tone)</label>
        <textarea value={f.tone} onChange={set('tone')} rows="2" maxLength={300} placeholder="e.g. warm and playful like a market aunty, but always respectful" />
      </div>
      <div className="card">
        <h2>Greeting</h2>
        <p className="desc">What the AI says when a customer just says "hey" or "hello". Leave empty for the built-in polite greeting.</p>
        <label>Custom greeting (optional)</label>
        <textarea value={f.greeting} onChange={set('greeting')} rows="2" maxLength={300} placeholder="e.g. Hello and welcome to Amaka Beauty! How are you doing today? What can we help you with?" />
      </div>
      <div className="card">
        <h2>Negotiation (SmartDeal)</h2>
        <p className="desc">The AI only offers a discount when a customer hesitates on price — never otherwise.</p>
        <div className="grid2">
          <div><label>Max discount % (0 = never discount)</label><input type="number" min="0" max="50" value={f.discount} onChange={set('discount')} /></div> {/* type="number" = numeric keyboard + spinners; min/max = browser-level clamping hints (server re-clamps anyway!) */}
          <div><label>Only on orders above {biz?.currency === 'USD' ? '$' : '₦'}</label><input type="number" min="0" value={f.minOrder} onChange={set('minOrder')} /></div> {/* currency-aware symbol (ternary on biz prop!) */}
        </div>
      </div>
      <div className="card">
        <h2>Human handoff</h2>
        <p className="desc">Sent when the AI isn't sure — instead of guessing and losing trust. Always polite, in your words.</p>
        <label>Fallback message</label>
        <textarea value={f.handoff} onChange={set('handoff')} rows="3" maxLength={500} />
        <div style={{ marginTop: 14 }}><button className="btn" onClick={save}>Save settings</button></div>
      </div>
    </>
  );
}
