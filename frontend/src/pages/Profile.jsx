// ── frontend/src/pages/Profile.jsx ─────────────────────────────────
// WHAT: business identity editor — name, locked WhatsApp number, personal
// number, hours, tone, currency, timezone, FAQs. Save → PUT /api/me/business.
// The AI introduces the shop EXACTLY from this data (garbage in = garbage out).
import { useState } from 'react'; // useState only (no fetching — biz prop arrives loaded from App!)
import { api, pop } from '../lib/api.js'; // api() save; pop() big success/fail animation
import { normalizePhone, prettyPhone } from '../lib/phone.js'; // live phone help: normalize (validate) + pretty (display)
import Ic from '../components/icons.jsx'; // check icon for the "Saved as …" line

export default function Profile({ biz }) { // biz prop = business from App's useMe (includes currency/timezone from getMe!)
  const [f, setF] = useState({ name: biz?.name || '', owner: biz?.owner_number || '', hours: biz?.hours || '', tone: biz?.tone || 'friendly and helpful', currency: biz?.currency || 'NGN', timezone: biz?.timezone || 'Africa/Lagos', faq: (biz?.faq || []).map((x) => x.question + ' | ' + x.answer).join('\n') }); // ONE form object (biz?. guards slow load; || defaults; faq ARRAY → one-per-line "question | answer" TEXT for easy editing!)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }); // CURRIED setter factory: set('name') returns an onChange handler writing f.name (computed key [k]!). One line replaces 7 handlers!
  async function save() {
    const faq = f.faq.split('\n').map((l) => { const [q, ...a] = l.split('|'); return q && a.length ? { question: q.trim(), answer: a.join('|').trim() } : null; }).filter(Boolean); // parse BACK: lines → split on FIRST '|' (destructure [q, ...a] keeps extra pipes in the answer via a.join!) → trim → drop blank/invalid lines (filter(Boolean) removes nulls)
    const { ok, data } = await api('/api/me/business', { method: 'PUT', body: JSON.stringify({ name: f.name.trim(), owner_number: f.owner.trim(), hours: f.hours.trim(), tone: f.tone.trim(), currency: f.currency, timezone: f.timezone.trim() || 'Africa/Lagos', faq }) }); // PUT full update (trim strings, pass currency/timezone through)
    if (ok) pop('ok', 'Profile saved!', 'The AI talks with this from now on.'); // big success (profile = high-stakes!)
    else pop('err', 'Save failed', (data.errors || [data.error || 'Please try again.']).join('; ')); // backend sends errors ARRAY (validation) or single error — handle BOTH shapes!
  }
  return (
    <>
      <div className="page-head"><div><h1>Business profile</h1><p>Exactly how the AI introduces you. Short, true, and fresh beats long and stale.</p></div></div>
      <div className="card">
        <div className="grid2"> {/* two-column grid (stacks mobile) */}
          <div><label>Business name</label><input value={f.name} onChange={set('name')} /></div> {/* controlled input: value mirrors state, onChange writes back (React owns the text!) */}
          <div><label>WhatsApp number (locked)</label><input value={biz?.whatsapp_number || ''} disabled /></div> {/* disabled = identity can't change (currency auto-resolves from it at signup!) */}
          <div><label>Your personal WhatsApp</label><input value={f.owner} onChange={set('owner')} onBlur={() => { const n = normalizePhone(f.owner); if (n) setF({ ...f, owner: prettyPhone(n) }); }} placeholder="0803 123 4567" inputMode="tel" /><span className="hint">Only this number can teach with LEARN: — type it any way you like.</span>
            {f.owner.trim() !== '' && (normalizePhone(f.owner) ? <span className="hint ok-line"><Ic n="check" s={13} /> Saved as {normalizePhone(f.owner)}</span> : <span className="hint err-line">That number doesn't look right.</span>)}</div> {/* onBlur = when field loses focus: normalize + pretty-print (live formatting lesson!). Inline validation BELOW the input: green "Saved as …" vs red warning (non-empty only — empty field shows neither!) */}
          <div><label>Opening hours</label><input value={f.hours} onChange={set('hours')} placeholder="Mon–Sat, 9am–7pm" /></div>
          <div><label>Billing currency</label><select value={f.currency} onChange={set('currency')}><option value="NGN">Naira (₦)</option><option value="USD">US Dollar ($)</option></select><span className="hint">Auto-set from your number — change anytime.</span></div> {/* <select> dropdown: value mirrors state, <option value> = stored codes */}
          <div><label>Timezone</label><input value={f.timezone} onChange={set('timezone')} placeholder="Africa/Lagos" spellCheck="false" /><span className="hint">Used for open/closed replies. e.g. America/New_York, Europe/London.</span></div> {/* spellCheck off for technical strings */}
        </div>
        <label>How should the AI sound?</label> {/* tone = personality prompt (free text → system prompt!) */}
        <input value={f.tone} onChange={set('tone')} placeholder="warm, short, a little Pidgin when they use Pidgin" />
        <label>FAQs — one per line: question | answer</label> {/* the pipe format (parsed in save() above) */}
        <textarea value={f.faq} onChange={set('faq')} rows="5" placeholder={"Where are you? | 12 Allen Avenue, Ikeja\nDo you deliver? | Yes, nationwide in 2–4 days"} /> {/* <textarea> multiline; rows="5" height; {"…\n…"} = placeholder with real newline */}
        <div style={{ marginTop: 14 }}><button className="btn" onClick={save}>Save profile</button></div>
      </div>
    </>
  );
}
