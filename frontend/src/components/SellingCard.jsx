// ── frontend/src/components/SellingCard.jsx ────────────────────────
// WHAT: Settings → Velo's voice → "Selling": away mode and follow-ups.
// Saves by itself (separate from the page's Save bar). Server: /api/me/selling.
import { useEffect, useState } from 'react';
import { api, pop, toast } from '../lib/api.js';
import Select from './Select.jsx';

const HOURS = [1, 2, 3, 4, 6, 8, 12, 20].map((h) => ({ value: String(h), label: h === 1 ? 'After 1 hour' : `After ${h} hours` }));
const dayInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export default function SellingCard() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/api/me/selling').then(({ ok, data }) => ok && setS(data)); }, []);
  async function save(patch, msg) {
    const next = { ...s, ...patch };
    setS(next);
    const { ok, data } = await api('/api/me/selling', { method: 'PUT', body: JSON.stringify(patch) });
    if (!ok) return pop('err', 'Not saved', (data && data.error) || 'Try again.');
    setS(data); if (msg) toast(msg);
  }
  if (!s) return <div className="card"><div className="skel" style={{ height: 120 }} /></div>;
  const away = s.awayUntil && new Date(s.awayUntil) > new Date();
  return (
    <div className="card sell-card" data-guide="selling">
      <h2>Selling</h2>
      <div className="sell-row">
        <div className="sell-main"><b>Follow up with customers who went quiet</b><span>If someone asks about a product, gets an answer and goes quiet, Velo sends one short, friendly nudge in their language. Never after they buy, never to friends or anyone who said STOP. Free: it only goes out within WhatsApp's 24-hour window.</span></div>
        <button type="button" role="switch" aria-checked={s.followupEnabled} className={'sell-switch' + (s.followupEnabled ? ' on' : '')} onClick={() => save({ followupEnabled: !s.followupEnabled }, s.followupEnabled ? 'Follow-ups off' : 'Follow-ups on')}><i /></button>
      </div>
      {s.followupEnabled && <div className="sell-sub"><span>Send it</span><div style={{ minWidth: 200 }}><Select value={String(s.followupHours)} onChange={(v) => save({ followupHours: Number(v) }, 'Saved')} options={HOURS} label="When to follow up" /></div><span>after their last message</span></div>}

      <div className="sell-row">
        <div className="sell-main"><b>Away mode</b><span>Going to the market or travelling? Velo keeps answering, but tells customers that orders and deliveries resume when you are back.</span></div>
        <button type="button" role="switch" aria-checked={!!away} className={'sell-switch' + (away ? ' on' : '')} onClick={() => save({ awayUntil: away ? null : new Date(Date.now() + 2 * 864e5).toISOString() }, away ? 'Welcome back! Away mode is off' : 'Away mode on')}><i /></button>
      </div>
      {away && <div className="sell-sub wrap">
        <label htmlFor="sell-until">Back on</label>
        <input id="sell-until" type="date" value={dayInput(s.awayUntil)} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={(e) => e.target.value && save({ awayUntil: new Date(e.target.value + 'T08:00:00+01:00').toISOString() })} />
        <input className="sell-note" value={s.awayNote} maxLength={300} placeholder="Why, if you want to say (optional)" onChange={(e) => setS({ ...s, awayNote: e.target.value })} onBlur={() => save({ awayNote: s.awayNote }, 'Saved')} aria-label="Away note" />
      </div>}
      <p className="sell-tip">Blocking a number is in the Inbox: open the chat and tap Block.</p>
    </div>
  );
}
