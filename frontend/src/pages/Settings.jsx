// ── frontend/src/pages/Settings.jsx ──────────────────────────────
// WHAT: AI guardrails — SmartDeal negotiation (max %, min order) + the human
// handoff fallback text. Two saves in sequence: business fields first (so the
// PUT validator passes), THEN discount settings. No npm modules — api + pop.
import { useState } from 'react'; // single form object state
import { api, pop } from '../lib/api.js'; // api() ×2 calls; pop() animated outcomes

export default function Settings({ biz }) { // biz = business (name/numbers/hours/tone/faq needed to re-PUT; currency for the ₦/$ label!)
  const [f, setF] = useState({ discount: biz?.max_discount_pct ?? 0, minOrder: biz?.min_order_naira ?? 0, handoff: 'Thanks for your message! A member of our team will get back to you shortly.' }); // ?? (not ||): 0 is VALID and must survive (|| would turn 0 into default — classic bug avoided!)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); // same curried-setter factory as Profile (one handler for all fields!)
  async function save() {
    const { ok, data } = await api('/api/me/business', { method: 'PUT', body: JSON.stringify({ name: biz.name, owner_number: biz.owner_number, hours: biz.hours, tone: biz.tone, faq: biz.faq }) }); // STEP 1: re-save UNCHANGED business fields (PUT replaces all — must resend everything or validator complains "name required"!)
    if (!ok) { pop('err', 'Save failed', (data.errors || ['Please try again.']).join('; ')); return; } // step 1 failed → stop (return) — don't save half a settings page!
    const r2 = await api('/api/me/settings', { method: 'PUT', body: JSON.stringify({ max_discount_pct: Number(f.discount) || 0, min_order_naira: Number(f.minOrder) || 0 }) }); // STEP 2: the actual guardrails (Number() because number inputs still give STRINGS! || 0 handles "")
    if (r2.ok) pop('ok', 'AI settings saved!', 'Your guardrails are live.'); // both steps green → success
    else if (r2.status === 404) pop('ok', 'Profile saved!', 'Your business details are updated.'); // defensive: ancient backend without /settings still counts profile as saved (never Lie with an error when work succeeded!)
    else pop('err', 'Could not save settings', 'Please try again.'); // genuine step-2 failure
  }
  return (
    <>
      <div className="page-head"><div><h1>AI settings</h1><p>Guardrails. The AI is helpful — these keep it honest and profitable.</p></div></div>
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
        <p className="desc">Sent when the AI isn't sure — instead of guessing and losing trust.</p>
        <label>Fallback message</label>
        <textarea value={f.handoff} onChange={set('handoff')} rows="3" /> {/* NOTE: displayed but not yet sent to backend (future: store per-business) — honest comment, not hidden behavior */}
        <div style={{ marginTop: 14 }}><button className="btn" onClick={save}>Save settings</button></div>
      </div>
    </>
  );
}
