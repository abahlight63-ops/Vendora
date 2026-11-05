// ── frontend/src/pages/AdminConsole.jsx ────────────────────────────
// WHAT: the new admin console panels (approved design, Nov 2026): Overview,
// Shops (list + one shop with actions), AI and costs, Waitlist, Activity log.
// Each panel loads its own data from /api/admin/console/* (admin session only).
import { useEffect, useState } from 'react';
import { api, pop, toast } from '../lib/api.js';
import Ic from '../components/icons.jsx';
import Loader from '../components/Loader.jsx';
import { CHANNEL_COINS } from '../lib/channelLogos.js';
import { when } from '../lib/orders.js';

const naira = (v) => '₦' + Number(v || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const short = (v) => { const x = Number(v || 0); return x >= 1e6 ? '₦' + (Math.round(x / 1e4) / 100) + 'm' : x >= 1e4 ? '₦' + Math.round(x / 1e3) + 'k' : naira(x); };
const pct = (a, b) => (!b ? null : Math.round(((a - b) / b) * 100));
let coinN = 0;
function Coin({ ch, s = 26 }) { coinN += 1; return <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: '0 0 auto' }} dangerouslySetInnerHTML={{ __html: CHANNEL_COINS[ch].replace(/(msg-g|ig-g)/g, '$1-a' + coinN) }} />; }

function useLoad(url, deps = []) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const run = () => { setErr(''); api(url, { timeout: 20000 }).then(({ ok, data, status }) => { if (ok) setD(data); else setErr(status === 401 ? 'Your admin session ended. Sign in again.' : (data && data.error) || 'Could not load.'); }).catch(() => setErr('Could not load. Check your connection.')); };
  useEffect(run, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return [d, err, run, setD];
}
const Skel = ({ h = 120 }) => <div className="skel" style={{ height: h, borderRadius: 24 }} />;
const Fail = ({ msg, retry }) => <div className="ad-card ad-fail"><b>{msg}</b><button type="button" className="btn ghost" onClick={retry}>Try again</button></div>;
const Kpi = ({ label, value, sub, tone }) => <div className="ad-kpi"><span>{label}</span><b>{value}</b>{sub ? <small className={tone || ''}>{sub}</small> : null}</div>;

// ── Overview ──
export function AdminOverview({ go }) {
  const [days, setDays] = useState(7);
  const [d, err, retry] = useLoad('/api/admin/console/overview?days=' + days, [days]);
  if (err) return <Fail msg={err} retry={retry} />;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const t = d && d.todo;
  const todos = d ? [
    t.transfers ? ['cash', 'gold', `${t.transfers} bank transfer${t.transfers > 1 ? 's' : ''} to confirm`, 'Customers waiting for their plan', 'Review', 'money'] : null,
    t.airtime ? ['gift', 'violet', `${t.airtime} referral reward${t.airtime > 1 ? 's' : ''} to pay`, '₦500 airtime each', 'Pay', 'growth'] : null,
    t.complaints ? ['help', 'coral', `${t.complaints} support message${t.complaints > 1 ? 's' : ''}`, 'Open first', 'Open', 'support'] : null,
    t.needs_owner ? ['bell', 'coral', `${t.needs_owner} chats need their owner`, `Across ${t.needs_owner_shops} shop${t.needs_owner_shops === 1 ? '' : 's'}`, 'Shops', 'shops'] : null,
  ].filter(Boolean) : [];
  const max = d ? Math.max(1, ...d.signups.map((x) => x.n)) : 1;
  const mChange = d ? pct(d.money.month, d.money.lastMonth) : null;
  const f = d && d.funnel;
  const planMax = d ? Math.max(1, d.plans.free, d.plans.plus, d.plans.pro, d.plans.trial) : 1;
  return (
    <div className="ad-page">
      <div className="ad-head">
        <div><div className="dg-status on"><i />Numbers update each time you open this</div><h1>{greet}</h1><p>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <div className="wx-pills" role="group" aria-label="Period">{[[1, 'Today'], [7, '7 days'], [30, '30 days']].map(([k, l]) => <button key={k} type="button" className={'wx-pill' + (days === k ? ' on' : '')} aria-pressed={days === k} onClick={() => setDays(k)}>{l}</button>)}</div>
      </div>
      {!d ? <><Skel /><Skel h={300} /></> : (<>
        <div className="ad-kpis">
          <Kpi label="Shops" value={d.shops.total.toLocaleString()} sub={`↑ ${d.shops.new} new in ${days === 1 ? 'a day' : days + ' days'}`} tone="good" />
          <Kpi label="Active shops" value={d.shops.active.toLocaleString()} sub={d.shops.total ? `${Math.round((d.shops.active / d.shops.total) * 100)}% got messages` : ''} />
          <Kpi label="Paying" value={d.paying.total} sub={`Plus ${d.paying.plus} · Pro ${d.paying.pro}`} tone="good" />
          <Kpi label="Money this month" value={naira(d.money.month)} sub={mChange == null ? 'First month' : `${mChange >= 0 ? '↑' : '↓'} ${Math.abs(mChange)}% on last month`} tone={mChange == null || mChange >= 0 ? 'good' : 'warn'} />
          <Kpi label="Paid this month" value={f.paid} sub={`of ${f.signed_up} who signed up`} />
          <Kpi label="Replies by Velo today" value={d.replies.bot.toLocaleString()} sub={d.replies.bot + d.replies.owner ? `${Math.round((d.replies.bot / (d.replies.bot + d.replies.owner)) * 100)}% without the owner` : 'None yet today'} />
          <Kpi label="Needs the owner" value={t.needs_owner} sub={`across ${t.needs_owner_shops} shops`} tone={t.needs_owner ? 'warn' : ''} />
          <Kpi label="AI cost today (estimate)" value={'$' + d.aiCost.usd.toFixed(2)} sub={`about ${naira(d.aiCost.naira)} · $${d.aiCost.perReplyUsd} a reply`} />
          <Kpi label="Voice notes today" value={d.voiceToday} sub="transcribed and answered" />
          <Kpi label="Orders recorded" value={d.orders.n} sub={`${short(d.orders.value)} paid in shops`} />
        </div>
        <div className="ad-two">
          <section className="ad-card">
            <b className="ad-title">Sign-ups, last 14 days</b>
            <div className="ad-bars" aria-label="Sign-ups per day">{d.signups.map((x, i) => <i key={x.day} title={`${x.day}: ${x.n}`} className={i === d.signups.length - 1 ? 'on' : ''} style={{ height: Math.max(4, (x.n / max) * 100) + '%' }} />)}</div>
            <p className="ad-note">This month: {f.signed_up} signed up → {f.products} added products → {f.connected} connected a channel → {f.paid} paid</p>
          </section>
          <section className="ad-card">
            <b className="ad-title">Needs your attention</b>
            {todos.length === 0 ? <p className="ad-note">Nothing waiting. Nice.</p> : todos.map(([ic, tone, title, sub, btn, to]) => (
              <div key={title} className="ad-todo"><span className={'ad-ic ' + tone}><Ic n={ic} s={18} /></span><div><b>{title}</b><small>{sub}</small></div><button type="button" className="ad-mini" onClick={() => go(to)}>{btn}</button></div>
            ))}
          </section>
        </div>
        <div className="ad-three">
          <section className="ad-card"><b className="ad-title">Plans</b>
            {[['Free', d.plans.free, 'f'], ['Plus', d.plans.plus, 'pl'], ['Pro', d.plans.pro, 'pr'], ['On trial', d.plans.trial, 'tr']].map(([l, v, k]) => <div key={l} className="ad-plan"><span>{l}</span><div><i className={k} style={{ width: Math.max(3, (v / planMax) * 100) + '%' }} /></div><b>{v}</b></div>)}
          </section>
          <section className="ad-card"><b className="ad-title">Channels connected</b>
            <div className="ad-line"><Coin ch="whatsapp" /><span>WhatsApp</span><b>{d.channels.whatsapp}</b></div>
            <div className="ad-line"><Coin ch="telegram" /><span>Telegram</span><b>{d.channels.telegram}</b></div>
            <div className="ad-line is-muted"><Coin ch="instagram" /><span>Messenger and Instagram</span><span>Coming soon</span></div>
          </section>
          <section className="ad-card"><b className="ad-title">Quick links</b>
            {[['AI and costs', 'ai'], ['Channels health', 'channels'], ['Send a notice', 'notices'], ['Activity log', 'activity']].map(([l, k]) => <button key={k} type="button" className="ad-link" onClick={() => go(k)}>{l}<Ic n="next" s={16} /></button>)}
          </section>
        </div>
      </>)}
    </div>
  );
}

// ── Shops ──
const PLAN = { free: 'Free', pro: 'Plus', plus: 'Pro', trial: 'Trial', business: 'Business' };
const STATUS = { ok: ['Working', 'good'], no_channel: ['No channel yet', 'muted'], near: ['Near daily limit', 'warn'], quiet: ['Quiet 7+ days', 'muted'] };
export function AdminShops() {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [list, err, retry] = useLoad(`/api/admin/console/shops?filter=${filter}&q=${encodeURIComponent(query)}`, [filter, query]);
  const [sel, setSel] = useState(null);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (list && list.shops.length && !sel) setSel(list.shops[0].id); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <Fail msg={err} retry={retry} />;
  const c = list && list.counts;
  const F = [['all', 'All', c && c.all], ['paying', 'Paying', c && c.paying], ['trial', 'On trial', c && c.trial], ['no_channel', 'No channel', c && c.no_channel], ['near', 'Near limit', c && c.near], ['quiet', 'Quiet 7 days', c && c.quiet]];
  return (
    <div className="ad-page">
      <div className="ad-head"><div><h1>Shops</h1><p>Every shop, its plan, its channels and how Velo is doing for it.</p></div></div>
      <div className="ad-shops">
        <section className="ad-card">
          <div className="ad-tools">
            <div className="wx-pills bc-wrap">{F.map(([k, l, n]) => <button key={k} type="button" className={'wx-pill' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}{n != null ? ' ' + n : ''}</button>)}</div>
            <label className="od-search"><Ic n="search" s={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or id" aria-label="Search shops" /></label>
          </div>
          {!list ? <Skel h={300} /> : list.shops.length === 0 ? <p className="ad-note">No shops match.</p> : (
            <div className="ad-table">
              <div className="ad-tr ad-th"><span>Shop</span><span>Plan</span><span>Last message in</span><span>Velo replies today</span><span>Status</span></div>
              {list.shops.map((s) => (
                <button key={s.id} type="button" className={'ad-tr' + (sel === s.id ? ' sel' : '')} onClick={() => { setSel(s.id); if (window.innerWidth <= 1100) setTimeout(() => document.querySelector('.ad-shop')?.scrollIntoView({ behavior: 'smooth' }), 50); }}>
                  <span className="ad-name">{s.wa ? <Coin ch="whatsapp" s={24} /> : s.tg ? <Coin ch="telegram" s={24} /> : <span className="ad-nochan" />}<b>{s.name}</b></span>
                  <span className="ad-plan-t">{PLAN[s.plan] || s.plan}</span>
                  <span>{s.lastIn ? when(s.lastIn) : 'Never'}</span>
                  <span>{s.botToday}{s.limit ? ' / ' + s.limit.toLocaleString() : ''}</span>
                  <span><i className={'ad-tag ' + STATUS[s.status][1]}>{STATUS[s.status][0]}</i></span>
                </button>
              ))}
            </div>
          )}
        </section>
        {sel ? <ShopPanel key={sel} id={sel} onChanged={retry} onDeleted={() => { setSel(null); retry(); }} /> : <section className="ad-card ad-shop"><p className="ad-note">Pick a shop to see it here.</p></section>}
      </div>
    </div>
  );
}

function ShopPanel({ id, onChanged, onDeleted }) {
  const [s, err, retry] = useLoad('/api/admin/console/shops/' + id, [id]);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState(null); // 'plan' | 'days' | 'notice' | 'delete'
  const [v, setV] = useState({});
  async function run(action, extra = {}) {
    setBusy(action);
    const { ok, data } = await api(`/api/admin/console/shops/${id}/action`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
    setBusy('');
    if (!ok) return pop('err', 'Not done', (data && data.error) || 'Try again.');
    toast(data.message || 'Done');
    setForm(null); setV({});
    if (action === 'delete') return onDeleted();
    retry(); onChanged();
  }
  if (err) return <section className="ad-card ad-shop"><Fail msg={err} retry={retry} /></section>;
  if (!s) return <section className="ad-card ad-shop"><Skel h={360} /></section>;
  return (
    <section className="ad-card ad-shop" aria-label={s.name}>
      <div className="ad-shop-head"><span className="ad-av">{(s.name || 'S').trim()[0].toUpperCase()}</span><div><b>{s.name}</b><small>{s.user ? s.user.email : 'No login'}{s.ownerNumber ? ' · ' + s.ownerNumber : ''} · joined {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div></div>
      <div className="ad-facts">
        <div><span>Plan</span><b>{PLAN[s.plan] || s.plan}{s.subscription.expires && s.subscription.status === 'active' ? ' · until ' + new Date(s.subscription.expires).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</b></div>
        <div><span>Velo answered</span><b>{s.veloShare == null ? 'No replies yet' : s.veloShare + '% this week'}</b></div>
        <div><span>Customers</span><b>{s.customers.toLocaleString()}</b></div>
        <div><span>Orders</span><b>{s.orders.n} · {short(s.orders.value)}</b></div>
      </div>
      <div className="ad-line"><Coin ch="whatsapp" s={22} /><span>WhatsApp</span><span>{s.channels.whatsapp ? 'Connected' + (s.channels.whatsappVia === 'app' ? ' (one-tap)' : ' (manual)') : 'Not connected'}</span></div>
      <div className="ad-line"><Coin ch="telegram" s={22} /><span>Telegram</span><span>{s.channels.telegram ? 'Connected' : 'Not connected'}</span></div>
      <div className="ad-line"><span className="ad-dot" style={{ background: s.botOn ? '#059669' : '#9CA3AF' }} /><span>Velo</span><span>{s.botOn ? 'Answering' : 'Paused by admin or owner'}</span></div>

      <div className="ad-acts">
        <button type="button" className="ad-act" onClick={() => setForm(form === 'plan' ? null : 'plan')}>Change plan</button>
        <button type="button" className="ad-act" onClick={() => setForm(form === 'days' ? null : 'days')}>Add free days</button>
        <button type="button" className="ad-act" onClick={() => setForm(form === 'notice' ? null : 'notice')}>Send a notice</button>
        <button type="button" className="ad-act" disabled={!!busy} onClick={() => run(s.botOn ? 'pause' : 'resume')}>{busy === 'pause' || busy === 'resume' ? <Loader size={14} /> : null}{s.botOn ? 'Pause Velo' : 'Resume Velo'}</button>
        <button type="button" className="ad-act" disabled={!!busy || !s.user || s.user.verified} onClick={() => run('verify')}>{s.user && s.user.verified ? 'Email verified' : 'Verify email'}</button>
        <button type="button" className="ad-act danger" onClick={() => setForm(form === 'delete' ? null : 'delete')}>Delete shop</button>
      </div>
      {form === 'plan' && <div className="ad-form"><div className="rc-seg">{[['free', 'Free'], ['pro', 'Plus'], ['plus', 'Pro']].map(([k, l]) => <button key={k} type="button" className={v.plan === k ? 'on' : ''} onClick={() => setV({ ...v, plan: k })}>{l}</button>)}</div>{v.plan && v.plan !== 'free' && <input className="rc-fld" inputMode="numeric" placeholder="Months (1 to 12)" value={v.months || ''} onChange={(e) => setV({ ...v, months: e.target.value.replace(/\D/g, '') })} />}<button type="button" className="btn" disabled={!v.plan || !!busy} onClick={() => run('plan', { plan: v.plan, months: v.months || 1 })}>Save plan</button></div>}
      {form === 'days' && <div className="ad-form"><input className="rc-fld" inputMode="numeric" placeholder="Free Pro days (1 to 90)" value={v.days || ''} onChange={(e) => setV({ ...v, days: e.target.value.replace(/\D/g, '') })} /><button type="button" className="btn" disabled={!v.days || !!busy} onClick={() => run('days', { days: v.days })}>Add days</button></div>}
      {form === 'notice' && <div className="ad-form"><input className="rc-fld" placeholder="Title" value={v.title || ''} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} /><textarea className="rc-fld ad-ta" placeholder="Message (optional)" value={v.body || ''} onChange={(e) => setV({ ...v, body: e.target.value })} maxLength={1000} /><button type="button" className="btn" disabled={!v.title || !!busy} onClick={() => run('notice', { title: v.title, body: v.body })}>Send to their bell</button></div>}
      {form === 'delete' && <div className="ad-form is-danger"><p>This deletes the shop, its chats, products and orders for good. Type <b>{s.name}</b> to confirm.</p><input className="rc-fld" value={v.confirmName || ''} onChange={(e) => setV({ ...v, confirmName: e.target.value })} aria-label="Type the shop name" /><button type="button" className="btn danger" disabled={v.confirmName !== s.name || !!busy} onClick={() => run('delete', { confirmName: v.confirmName })}>Delete forever</button></div>}

      <div className="ad-sub"><b>Payments</b>{s.payments.length ? s.payments.map((p, i) => <small key={i}>{when(p.created_at)} · {PLAN[p.plan] || p.plan || 'Plan'} · {p.currency === 'USD' ? '$' : '₦'}{(p.amount / 100).toLocaleString()} · {p.method || ''} · {p.status}</small>) : <small>None yet</small>}</div>
      <div className="ad-sub"><b>Admin actions on this shop</b>{s.activity.length ? s.activity.map((a, i) => <small key={i}>{when(a.created_at)} · {a.action.replace(/^POST \/api\/admin\/console\/shops\/\d+\/action/, 'Action')} {(() => { try { const x = JSON.parse(a.detail || '{}'); return x.action || ''; } catch { return ''; } })()}</small>) : <small>None yet</small>}</div>
    </section>
  );
}

// ── AI and costs ──
export function AdminAiUsage() {
  const [days, setDays] = useState(7);
  const [d, err, retry] = useLoad('/api/admin/console/ai?days=' + days, [days]);
  if (err) return <Fail msg={err} retry={retry} />;
  const max = d ? Math.max(1, ...d.byDay.map((x) => x.replies)) : 1;
  const total = d ? d.byDay.reduce((s, x) => s + x.replies, 0) : 0;
  return (
    <section className="ad-card">
      <div className="ad-tools"><b className="ad-title">Customer replies and estimated AI cost</b><div className="wx-pills">{[[7, '7 days'], [30, '30 days']].map(([k, l]) => <button key={k} type="button" className={'wx-pill' + (days === k ? ' on' : '')} onClick={() => setDays(k)}>{l}</button>)}</div></div>
      {!d ? <Skel /> : (<>
        <div className="ad-kpis ad-kpis-3"><Kpi label="Replies" value={total.toLocaleString()} /><Kpi label="Estimated cost" value={'$' + (total * d.perReplyUsd).toFixed(2)} sub={`about ${naira(total * d.perReplyUsd * d.nairaPerUsd)}`} /><Kpi label="Per reply" value={'$' + d.perReplyUsd} sub="from the November model test" /></div>
        <div className="ad-bars">{d.byDay.map((x) => <i key={x.day} title={`${x.day}: ${x.replies} replies, about $${x.usd}`} style={{ height: Math.max(4, (x.replies / max) * 100) + '%' }} />)}</div>
        <p className="ad-note">The cost is an estimate (replies × average price per reply). Your real bill is on each AI company's dashboard.</p>
        {d.veloChatByModel.length > 0 && <div className="ad-sub"><b>Chat with Velo, by model</b>{d.veloChatByModel.map((m) => <small key={m.model_id}>{m.model_id}: {m.n}</small>)}</div>}
      </>)}
    </section>
  );
}

// ── Growth: launch waitlist ──
export function AdminWaitlist() {
  const [d, err, retry] = useLoad('/api/admin/console/waitlist');
  if (err) return <Fail msg={err} retry={retry} />;
  const rows = (d && d.rows) || [];
  async function copy() { try { await navigator.clipboard.writeText(rows.map((r) => r.email).join('\n')); toast('Emails copied'); } catch { pop('err', 'Could not copy', 'Select and copy them by hand.'); } }
  return (
    <section className="ad-card">
      <div className="ad-tools"><b className="ad-title">Launch waitlist · {rows.length}</b>{rows.length > 0 && <button type="button" className="ad-mini" onClick={copy}>Copy all emails</button>}</div>
      {!d ? <Skel h={80} /> : rows.length === 0 ? <p className="ad-note">Nobody yet. Sign-ups from the website's waitlist form appear here.</p>
        : <div className="ad-sub">{rows.slice(0, 100).map((r) => <small key={r.email}>{r.email} · {when(r.created_at)}</small>)}</div>}
    </section>
  );
}

// ── Reviews from shop owners ──
export function AdminReviews() {
  const [d, err, retry] = useLoad('/api/admin/console/reviews');
  const [low, setLow] = useState(false);
  if (err) return <Fail msg={err} retry={retry} />;
  const rows = ((d && d.rows) || []).filter((r) => !low || r.rating <= 2);
  return (
    <section className="ad-card">
      <div className="ad-tools"><b className="ad-title">Reviews from shops{d ? ` · ${d.count}${d.average ? ' · average ' + d.average + ' ★' : ''}` : ''}</b>{d && d.low > 0 && <button type="button" className={'wx-pill' + (low ? ' on' : '')} onClick={() => setLow(!low)}>Only 1 and 2 stars ({d.low})</button>}</div>
      {!d ? <Skel h={80} /> : rows.length === 0 ? <p className="ad-note">No reviews yet. Shops are asked after a win, at most once every 14 days.</p>
        : rows.map((r) => <div key={r.id} className="ad-log"><span className="ad-ic gold" aria-hidden="true">{r.rating}★</span><div><b>{r.shop || 'Deleted shop'}{r.action ? ' · after ' + r.action.toLowerCase() : ''}</b><small>{r.comment || 'No comment'}</small></div><small>{when(r.created_at)}</small></div>)}
    </section>
  );
}

// ── Activity log ──
export function AdminActivity() {
  const [d, err, retry] = useLoad('/api/admin/console/activity');
  if (err) return <Fail msg={err} retry={retry} />;
  const rows = (d && d.rows) || [];
  return (
    <div className="ad-page">
      <div className="ad-head"><div><h1>Activity log</h1><p>Every change made from this console: what, to which shop, when and from where. Passwords and keys are never saved here.</p></div></div>
      <section className="ad-card">
        {!d ? <Skel h={200} /> : rows.length === 0 ? <p className="ad-note">No admin changes yet.</p> : rows.map((a) => {
          let detail = ''; try { const x = JSON.parse(a.detail || '{}'); detail = Object.entries(x).filter(([k]) => k !== 'confirmName').map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(', '); } catch { /* ignore */ }
          return <div key={a.id} className="ad-log"><span className="ad-ic violet"><Ic n="clock" s={16} /></span><div><b>{a.action}</b><small>{a.shop ? a.shop + ' · ' : ''}{detail}</small></div><small>{when(a.created_at)}<br />{a.ip}</small></div>;
        })}
      </section>
    </div>
  );
}
