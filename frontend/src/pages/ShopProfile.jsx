// ── frontend/src/pages/ShopProfile.jsx ─────────────────────────────
// WHAT: Settings → Your shop (approved design). Everything Velo needs to know
// about the shop beyond the catalog, with a "Velo knows X% of your shop" meter,
// "Fill it in for me" (drafted from WhatsApp, the catalog and past replies; the
// owner ticks what is right), autosave, and the facts the owner taught Velo.
// Server: /api/me/shop-profile (services/shopProfile.js). Number, currency,
// timezone and friends-and-family still save through /api/me/business.
import { useEffect, useRef, useState } from 'react';
import { api, pop, toast } from '../lib/api.js';
import Select from '../components/Select.jsx';
import Loader from '../components/Loader.jsx';
import Ic from '../components/icons.jsx';
import { NICHES } from '../lib/niches.js';

const SECTION_OF = { about: 'sp-about', location: 'sp-location', delivery: 'sp-delivery', payment: 'sp-payment', returns: 'sp-returns', niche: 'sp-niche' };
function Ring({ pct }) {
  const r = 38, c = 2 * Math.PI * r;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true" className="sp-ring">
      <defs><linearGradient id="sp-rg" x1="0" x2="1"><stop offset="0" stopColor="#9277ff" /><stop offset="1" stopColor="#6d4aff" /></linearGradient></defs>
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--purple-soft)" strokeWidth="10" />
      <circle cx="46" cy="46" r={r} fill="none" stroke="url(#sp-rg)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 46 46)" style={{ transition: 'stroke-dasharray .6s ease' }} />
      <text x="46" y="52" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">{pct}%</text>
    </svg>
  );
}
function Card({ id, icon, tone, title, sub, done, children }) {
  return (
    <section className="sp-card" id={id}>
      <div className="sp-card-head"><span className={'sp-ic ' + tone} aria-hidden="true">{icon}</span><div><b>{title}</b><small>{sub}</small></div>{done != null && <span className={'sp-state' + (done ? ' ok' : '')}>{done ? 'Done' : 'Missing'}</span>}</div>
      {children}
    </section>
  );
}
const svg = (d) => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICON = { store: svg('M4 10v9h16v-9M3 6.5 4.6 4h14.8L21 6.5a2.5 2.5 0 0 1-4.5 1.5A2.5 2.5 0 0 1 12 9.5 2.5 2.5 0 0 1 7.5 8 2.5 2.5 0 0 1 3 6.5z'), pin: svg('M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'), truck: svg('M1 6h13v10H1zM14 10h5l3 3v3h-8zM5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'), cash: svg('M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'), shield: svg('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'), spark: svg('M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'), help: svg('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 0 1 5 .2c0 1.7-2.5 2-2.5 3.6M12 17h.01'), user: svg('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0') };

export default function ShopProfile({ biz }) {
  const [d, setD] = useState(null); // server view: { name, niche, hours, faq, profile, questions, meter, languages, payMethods }
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(''); // '' | 'saving' | 'saved'
  const [filling, setFilling] = useState(false);
  const [fillOut, setFillOut] = useState(null); // { suggestions, picked:Set }
  const [acct, setAcct] = useState({ owner: biz?.owner_number || '', currency: biz?.currency || 'NGN', timezone: biz?.timezone || 'Africa/Lagos', personal: (() => { try { const v = typeof biz?.personal_contacts === 'string' ? JSON.parse(biz.personal_contacts) : biz?.personal_contacts; return (v || []).join('\n'); } catch { return ''; } })() });
  const timer = useRef(null);
  const pending = useRef(null);

  useEffect(() => {
    api('/api/me/shop-profile', { timeout: 15000 }).then(({ ok, data }) => { if (ok) setD(data); else setFailed((data && data.error) || 'Could not load your shop.'); }).catch(() => setFailed('Could not load your shop. Check your connection.'));
  }, []);

  function queueSave(next) { // autosave, 0.8s after the last change
    setD(next); pending.current = next; setSaving('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const x = pending.current;
      const { ok, data } = await api('/api/me/shop-profile', { method: 'PUT', body: JSON.stringify({ name: x.name, niche: x.niche, hours: x.hours, faq: x.faq, profile: x.profile }) });
      if (ok) { setD((cur) => ({ ...cur, meter: data.meter, questions: data.questions })); setSaving('saved'); }
      else { setSaving(''); pop('err', 'Not saved', (data && data.error) || 'Check your connection and try again.'); }
    }, 800);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  const setTop = (k, v) => queueSave({ ...d, [k]: v });
  const setP = (k, v) => queueSave({ ...d, profile: { ...d.profile, [k]: v } });
  const p = (d && d.profile) || {};
  const pay = p.payment || { methods: [] };
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function fill() {
    setFilling(true);
    const { ok, data } = await api('/api/me/shop-profile/fill', { method: 'POST', timeout: 60000 });
    setFilling(false);
    if (!ok) return pop('err', 'Could not fill it in', (data && data.error) || 'Try again in a moment.');
    if (!data.suggestions.length) return pop('err', 'Nothing to fill in yet', data.hadSources.whatsappProfile || data.hadSources.products ? 'Velo could not find these details in your WhatsApp profile, catalog or chats. Type them in below.' : 'Connect WhatsApp or add products first, then try again. Or type the details in below.');
    setFillOut({ suggestions: data.suggestions, picked: new Set(data.suggestions.map((s, i) => (s.sure ? i : null)).filter((i) => i !== null)) });
  }
  function keepFill() {
    let next = { ...d, profile: { ...d.profile } };
    fillOut.suggestions.forEach((s, i) => {
      if (!fillOut.picked.has(i)) return;
      if (s.field === 'hours') next.hours = String(s.value);
      else if (s.field === 'payment_methods') next.profile.payment = { ...(next.profile.payment || {}), methods: s.value };
      else if (s.field === 'delivery') next.profile.delivery = [...(next.profile.delivery || []).filter((x) => x.area !== s.value.area), s.value];
      else next.profile[s.field] = s.value;
    });
    setFillOut(null); queueSave(next); toast('Saved. Check the details below.');
  }
  async function saveAcct(next) { // number, currency, timezone, friends and family (the older endpoint)
    setAcct(next);
    const personal = next.personal.split('\n').map((x) => x.trim()).filter(Boolean);
    const { ok, data } = await api('/api/me/business', { method: 'PUT', body: JSON.stringify({ name: d.name, owner_number: next.owner.trim(), currency: next.currency, timezone: next.timezone, personal_contacts: personal }) });
    if (ok) toast('Saved'); else pop('err', 'Not saved', (data && (data.errors || [data.error]).join('; ')) || 'Try again.');
  }

  if (failed) return <div className="sp"><div className="sp-card"><b>{failed}</b><button type="button" className="btn ghost" onClick={() => window.location.reload()}>Try again</button></div></div>;
  if (!d) return <div className="sp"><div className="skel" style={{ height: 120, borderRadius: 28 }} /><div className="skel" style={{ height: 320, borderRadius: 28 }} /></div>;
  const m = d.meter;
  const done = (k) => m.done.includes(k);
  const nicheOpts = d.niche && !NICHES.includes(d.niche) ? [d.niche, ...NICHES] : NICHES;
  return (
    <div className="sp">
      <div className="sp-meter">
        <Ring pct={m.pct} />
        <div className="sp-meter-main">
          <b>{m.pct >= 100 ? 'Velo knows your shop well' : `Velo knows ${m.pct}% of your shop`}</b>
          <span>{m.missing.length ? `The more it knows, the fewer chats need you. ${m.missing.length === 1 ? 'One thing is' : m.missing.length + ' things are'} missing:` : 'Everything is filled in. Keep it fresh when things change.'}</span>
          {m.missing.length > 0 && <div className="sp-miss">{m.missing.map((x) => <button key={x.key} type="button" onClick={() => document.getElementById(SECTION_OF[x.key])?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>+ {x.label}</button>)}</div>}
        </div>
        <button type="button" className="btn lg sp-fill" onClick={fill} disabled={filling}>{filling ? <Loader size={16} /> : <Ic n="spark" s={18} />}{filling ? 'Reading your shop…' : 'Fill it in for me'}</button>
      </div>
      <div className="sp-save" aria-live="polite">{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved. Velo uses this on the next message.' : 'Changes save by themselves.'}</div>

      <div className="sp-grid">
        <div className="sp-col">
          <Card id="sp-about" icon={ICON.store} tone="v" title="About your shop" sub="What you sell and who you sell to" done={done('about')}>
            <label className="rc-lbl" htmlFor="sp-name">Shop name</label>
            <input id="sp-name" className="rc-fld" value={d.name} maxLength={80} onChange={(e) => setTop('name', e.target.value)} />
            <span className="rc-lbl">Type of business</span>
            <Select value={d.niche} onChange={(v) => setTop('niche', v)} options={nicheOpts} placeholder="Pick what you sell" label="Type of business" />
            <label className="rc-lbl" htmlFor="sp-about-t">About the shop <em>Velo reads this to understand you</em></label>
            <textarea id="sp-about-t" className="rc-fld sp-ta" maxLength={1000} value={p.about || ''} onChange={(e) => setP('about', e.target.value)} placeholder="What you sell, what makes you different, who your customers are. Two or three sentences is perfect." />
            <span className="rc-lbl">Languages customers use</span>
            <div className="wx-pills bc-wrap">{d.languages.map((l) => <button key={l} type="button" className={'wx-pill' + ((p.languages || []).includes(l) ? ' on' : '')} aria-pressed={(p.languages || []).includes(l)} onClick={() => setP('languages', toggle(p.languages || [], l))}>{l}</button>)}</div>
          </Card>

          <Card id="sp-location" icon={ICON.pin} tone="o" title="Location and opening hours" sub="Where to find you and when" done={done('location')}>
            <label className="rc-lbl" htmlFor="sp-addr">Address or area</label>
            <input id="sp-addr" className="rc-fld" maxLength={200} value={p.address || ''} onChange={(e) => setP('address', e.target.value)} placeholder="12 Allen Avenue, Ikeja, Lagos" />
            <div className="sp-two">
              <div><label className="rc-lbl" htmlFor="sp-pick">Pickup</label><input id="sp-pick" className="rc-fld" maxLength={160} value={p.pickup || ''} onChange={(e) => setP('pickup', e.target.value)} placeholder="Yes, from the shop" /></div>
              <div><label className="rc-lbl" htmlFor="sp-hours">Opening hours</label><input id="sp-hours" className="rc-fld" maxLength={120} value={d.hours || ''} onChange={(e) => setTop('hours', e.target.value)} placeholder="Mon to Sat, 9am to 7pm" /></div>
            </div>
          </Card>

          <Card id="sp-delivery" icon={ICON.truck} tone="c" title="Delivery" sub="Areas, fees and how long it takes" done={done('delivery')}>
            {(p.delivery || []).map((row, i) => (
              <div key={i} className="sp-del">
                <input className="rc-fld" aria-label="Area" value={row.area} maxLength={80} placeholder="Area, e.g. Lekki, Ajah" onChange={(e) => setP('delivery', p.delivery.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} />
                <input className="rc-fld" aria-label="Fee" value={row.fee} maxLength={30} placeholder="₦3,500" onChange={(e) => setP('delivery', p.delivery.map((x, j) => (j === i ? { ...x, fee: e.target.value } : x)))} />
                <input className="rc-fld" aria-label="How long" value={row.time} maxLength={40} placeholder="1 day" onChange={(e) => setP('delivery', p.delivery.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                <button type="button" className="sp-x" aria-label="Remove area" onClick={() => setP('delivery', p.delivery.filter((_, j) => j !== i))}><Ic n="x" s={16} /></button>
              </div>
            ))}
            {(p.delivery || []).length < 15 && <button type="button" className="rc-add" onClick={() => setP('delivery', [...(p.delivery || []), { area: '', fee: '', time: '' }])}><Ic n="plus" s={18} />Add an area</button>}
          </Card>

          <Card id="sp-payment" icon={ICON.cash} tone="g" title="Payment" sub="How customers pay you" done={done('payment')}>
            <div className="wx-pills bc-wrap">{d.payMethods.map((x) => <button key={x} type="button" className={'wx-pill' + ((pay.methods || []).includes(x) ? ' on' : '')} aria-pressed={(pay.methods || []).includes(x)} onClick={() => setP('payment', { ...pay, methods: toggle(pay.methods || [], x) })}>{x}</button>)}</div>
            {(pay.methods || []).includes('Bank transfer') && <div className="sp-three">
              <input className="rc-fld" aria-label="Bank" placeholder="Bank" maxLength={60} value={pay.bank || ''} onChange={(e) => setP('payment', { ...pay, bank: e.target.value })} />
              <input className="rc-fld" aria-label="Account number" placeholder="Account number" inputMode="numeric" maxLength={20} value={pay.account || ''} onChange={(e) => setP('payment', { ...pay, account: e.target.value.replace(/\D/g, '') })} />
              <input className="rc-fld" aria-label="Account name" placeholder="Account name" maxLength={80} value={pay.accountName || ''} onChange={(e) => setP('payment', { ...pay, accountName: e.target.value })} />
            </div>}
            {(pay.methods || []).includes('Paystack link') && <input className="rc-fld" aria-label="Payment link" placeholder="Your Paystack payment link" maxLength={200} value={pay.link || ''} onChange={(e) => setP('payment', { ...pay, link: e.target.value })} />}
            <p className="sp-note">Velo shares bank details only when a customer is ready to pay or asks how to pay. It never says a payment arrived: you confirm that.</p>
          </Card>

          <Card id="sp-returns" icon={ICON.shield} tone="v" title="Returns and guarantees" sub="What happens if something is wrong" done={done('returns')}>
            <textarea className="rc-fld sp-ta" maxLength={600} value={p.returns || ''} onChange={(e) => setP('returns', e.target.value)} placeholder="For example: exchange within 3 days if unused. No refunds on custom orders." aria-label="Returns and guarantees" />
          </Card>

          <Card id="sp-niche" icon={ICON.spark} tone="c" title="For your type of business" sub="Questions customers often ask shops like yours" done={done('niche')}>
            {d.questions.map((q) => (
              <div key={q.key}><label className="rc-lbl" htmlFor={'sp-q-' + q.key}>{q.label}</label><input id={'sp-q-' + q.key} className="rc-fld" maxLength={200} value={(p.niche || {})[q.key] || ''} placeholder={q.placeholder} onChange={(e) => setP('niche', { ...(p.niche || {}), [q.key]: e.target.value })} /></div>
            ))}
          </Card>

          <Card id="sp-faq" icon={ICON.help} tone="o" title="Common questions" sub="Anything else customers ask, with your answer">
            {(d.faq || []).map((f, i) => (
              <div key={i} className="sp-faq">
                <input className="rc-fld" aria-label="Question" placeholder="Question" maxLength={200} value={f.question} onChange={(e) => setTop('faq', d.faq.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
                <textarea className="rc-fld sp-ta sm" aria-label="Answer" placeholder="Your answer" maxLength={600} value={f.answer} onChange={(e) => setTop('faq', d.faq.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
                <button type="button" className="sp-x" aria-label="Remove question" onClick={() => setTop('faq', d.faq.filter((_, j) => j !== i))}><Ic n="x" s={16} /></button>
              </div>
            ))}
            <button type="button" className="rc-add" onClick={() => setTop('faq', [...(d.faq || []), { question: '', answer: '' }])}><Ic n="plus" s={18} />Add a question</button>
          </Card>

          {(p.facts || []).length > 0 && <Card id="sp-facts" icon={ICON.spark} tone="g" title="Things you taught Velo" sub="Corrections you made in Chat with Velo. These win over everything else.">
            {p.facts.map((f, i) => <div key={i} className="sp-fact"><span>{f.text}</span><button type="button" className="sp-x" aria-label="Forget this" onClick={() => setP('facts', p.facts.filter((_, j) => j !== i))}><Ic n="x" s={16} /></button></div>)}
          </Card>}

          <Card id="sp-account" icon={ICON.user} tone="v" title="Your number and region" sub="Not shown to customers">
            <label className="rc-lbl" htmlFor="sp-owner">Your personal WhatsApp <em>alerts and owner commands</em></label>
            <input id="sp-owner" className="rc-fld" inputMode="tel" value={acct.owner} onChange={(e) => setAcct({ ...acct, owner: e.target.value })} onBlur={() => saveAcct(acct)} placeholder="0803 123 4567" />
            <div className="sp-two">
              <div><span className="rc-lbl">Currency</span><Select value={acct.currency} onChange={(v) => saveAcct({ ...acct, currency: v })} options={[{ value: 'NGN', label: 'Naira (₦)' }, { value: 'USD', label: 'US dollar ($)' }]} label="Currency" /></div>
              <div><label className="rc-lbl" htmlFor="sp-tz">Timezone</label><input id="sp-tz" className="rc-fld" value={acct.timezone} onChange={(e) => setAcct({ ...acct, timezone: e.target.value })} onBlur={() => saveAcct(acct)} /></div>
            </div>
            <label className="rc-lbl" htmlFor="sp-pc">Friends and family <em>Velo never replies to these numbers</em></label>
            <textarea id="sp-pc" className="rc-fld sp-ta sm" value={acct.personal} onChange={(e) => setAcct({ ...acct, personal: e.target.value })} onBlur={() => saveAcct(acct)} placeholder="One number per line" />
          </Card>
        </div>

        <aside className="sp-side" aria-label="How Velo uses this">
          <section className="sp-card">
            <b className="sp-side-t">How Velo uses this</b>
            <small className="sp-who g">A customer on WhatsApp</small>
            <div className="sp-b in">Abeg una dey deliver to {(p.delivery && p.delivery[0] && p.delivery[0].area) || 'Lekki'}? How much?</div>
            <div className="sp-b out">{p.delivery && p.delivery[0] && p.delivery[0].fee ? `Yes o! Delivery to ${p.delivery[0].area} na ${p.delivery[0].fee}${p.delivery[0].time ? ', e go reach you in ' + p.delivery[0].time : ''}.` : 'Add your delivery fees and Velo answers this exactly, instead of asking you.'}</div>
            <small className="sp-who v">You, in Chat with Velo</small>
            <div className="sp-b own">Did Tunde pay for his order?</div>
            <div className="sp-b in">Velo checks your Orders and tells you exactly, with the receipt number and time.</div>
            <p className="sp-note">Velo only says what is written here, in your catalog or in your orders. If something is missing, it asks you instead of guessing.</p>
          </section>
        </aside>
      </div>

      {fillOut && (
        <div className="pop-overlay rc-back" role="presentation" onClick={() => setFillOut(null)}>
          <div className="rc-sheet" role="dialog" aria-modal="true" aria-labelledby="sp-fill-t" onClick={(e) => e.stopPropagation()}>
            <span className="rc-grab" aria-hidden="true" />
            <div className="rc-head"><span className="rc-ic" aria-hidden="true"><Ic n="spark" s={22} /></span><div><b id="sp-fill-t">Velo filled in {fillOut.suggestions.length} answer{fillOut.suggestions.length === 1 ? '' : 's'}</b><span>Check them, then keep the ones that are right</span></div><button type="button" className="rc-x" onClick={() => setFillOut(null)} aria-label="Close"><Ic n="x" s={18} /></button></div>
            <div className="sp-fills">
              {fillOut.suggestions.map((s, i) => {
                const on = fillOut.picked.has(i);
                return (
                  <button key={i} type="button" className={'sp-fillrow' + (on ? ' on' : '')} aria-pressed={on} onClick={() => { const n = new Set(fillOut.picked); if (on) n.delete(i); else n.add(i); setFillOut({ ...fillOut, picked: n }); }}>
                    <span className="sp-check">{on ? <Ic n="check" s={14} /> : null}</span>
                    <span className="sp-fillmain"><b>{s.label}</b><span>{s.text}</span><small className={s.sure ? 'ok' : 'warn'}>{s.sure ? s.from : s.from + ' · check it'}</small></span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn lg rc-go" disabled={!fillOut.picked.size} onClick={keepFill}>Keep {fillOut.picked.size} answer{fillOut.picked.size === 1 ? '' : 's'}</button>
            <button type="button" className="rc-quiet" onClick={() => setFillOut(null)}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
