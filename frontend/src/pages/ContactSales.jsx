// ── frontend/src/pages/ContactSales.jsx ────────────────────────────
// WHAT: "Talk to our team" for the Business plan (opened from Plan and usage).
// The form lands as a support ticket (subject "Business enquiry") that the
// admin answers in-app: the same pipeline as Help, no new backend.
import { useState } from 'react';
import { api, pop } from '../lib/api.js';
import Loader from '../components/Loader.jsx';
import Select from '../components/Select.jsx';
import Ic from '../components/icons.jsx';

const BRANCHES = ['1', '2 to 3', '4 to 10', 'More than 10'].map((v) => ({ value: v, label: v === '1' ? '1 branch' : v + ' branches' }));
const PERKS = ['5,000 replies a day', 'Many branches, one inbox', 'Priority help', 'We set it up with you'];

export default function ContactSales() {
  const [shop, setShop] = useState('');
  const [branches, setBranches] = useState('2 to 3');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!shop.trim()) return pop('err', 'Add your shop name', 'Tell us the shop or company name first.');
    if (!phone.trim() && !email.trim()) return pop('err', 'Add a way to reach you', 'Give us a WhatsApp number or an email.');
    setBusy(true);
    const body = `Shop name: ${shop.trim()}\nBranches: ${branches}\nPhone: ${phone.trim() || '-'}\nEmail: ${email.trim() || '-'}\n\nWhat they need:\n${notes.trim() || '-'}`;
    const { ok, data } = await api('/api/me/complaints', { method: 'POST', body: JSON.stringify({ subject: `Business enquiry: ${shop.trim()}`.slice(0, 120), body: body.slice(0, 2000) }) });
    setBusy(false);
    if (ok) {
      pop('ok', 'Sent to our team', 'We will reach out within one working day.');
      setShop(''); setPhone(''); setEmail(''); setNotes('');
    } else pop('err', 'Could not send', (data && data.error) || 'Check your connection and try again.');
  }

  return (
    <div className="cs">
      <div className="in-head">
        <div>
          <div className="dg-status on"><i />Business plan</div>
          <h1>Talk to our team</h1>
          <p>For shops with many branches or lots of chats. We reply within one working day.</p>
        </div>
      </div>
      <div className="cs-grid">
        <div className="cs-form">
          <div className="cs-two">
            <label>Shop or company name<input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="e.g. Amaka Beauty Group" maxLength={120} /></label>
            <div className="cs-field"><span>Number of branches</span><Select value={branches} onChange={setBranches} options={BRANCHES} label="Number of branches" /></div>
            <label>WhatsApp number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" inputMode="tel" maxLength={30} /></label>
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" inputMode="email" maxLength={120} /></label>
          </div>
          <label>Anything we should know?<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="4" placeholder="Chats a day, your channels, when you want to start" maxLength={1500} /></label>
          <button type="button" className="btn lg cs-go" disabled={busy} onClick={send}>{busy ? (<><Loader size={16} />Sending</>) : 'Send to our team'}</button>
        </div>
        <div className="cs-side">
          <div className="cs-plan">
            <b>Business</b>
            <div className="cs-price">From ₦39,999<small> / month</small></div>
            {PERKS.map((p) => <div key={p} className="cs-perk"><i aria-hidden="true"><Ic n="check" s={13} /></i>{p}</div>)}
          </div>
          <a className="cs-mail" href="mailto:velosales63@gmail.com?subject=Business%20plan"><Ic n="mail" s={22} /><span><b>Prefer email?</b>velosales63@gmail.com</span></a>
        </div>
      </div>
    </div>
  );
}
