// ── frontend/src/pages/ContactSales.jsx ────────────────────────────
// WHAT: Enterprise contact form (opened in a NEW TAB from the Billing →
// Enterprise card). No email addresses shown — the owner fills the form and
// it lands as a support ticket (subject "Enterprise enquiry") that the admin
// answers in-app. Same complaint pipeline as Help — zero new backend.
import { useState } from 'react'; // controlled form drafts + busy lock
import { api, pop, toast } from '../lib/api.js'; // api() files the ticket; pop()/toast() outcomes

export default function ContactSales() {
  const [shop, setShop] = useState(''); // shop name draft
  const [branches, setBranches] = useState(''); // number of branches draft
  const [phone, setPhone] = useState(''); // callback number draft
  const [email, setEmail] = useState(''); // reply email draft
  const [notes, setNotes] = useState(''); // anything else draft
  const [busy, setBusy] = useState(false); // submit lock (double-submit protection!)

  async function send() { // file the enquiry as a ticket…
    if (!shop.trim()) return toast('Tell us your shop name first', 'err');
    if (!phone.trim() && !email.trim()) return toast('Add a phone number or email so we can reach you', 'err');
    setBusy(true); // lock…
    const body = // one structured ticket body (labels keep it scannable for sales!)
      `Shop name: ${shop.trim()}\nBranches: ${branches.trim() || '—'}\nPhone: ${phone.trim() || '—'}\nEmail: ${email.trim() || '—'}\n\nWhat they need:\n${notes.trim() || '—'}`;
    const { ok, data } = await api('/api/me/complaints', { method: 'POST', body: JSON.stringify({ subject: `Enterprise enquiry — ${shop.trim()}`.slice(0, 120), body: body.slice(0, 2000) }) });
    setBusy(false); // …unlock either way (always!)
    if (ok) {
      pop('ok', 'Enquiry sent!', 'Our sales team will reach out within one business day.');
      setShop(''); setBranches(''); setPhone(''); setEmail(''); setNotes('');
    } else pop('err', 'Could not send', data.error || 'Please try again.');
  }

  return (
    <>
      <div className="page-head"><div><h1>Contact sales</h1><p>Enterprise is a conversation, not a checkout — tell us about your business.</p></div></div>
      <div className="card">
        <h2>Enterprise enquiry</h2>
        <p className="desc">For chains, franchises and high-volume shops. Fill this in — we reply within one business day.</p>
        <label>Shop or company name</label>
        <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="e.g. Amaka Beauty Group" maxLength={120} />
        <label>Number of branches</label>
        <input value={branches} onChange={(e) => setBranches(e.target.value)} placeholder="e.g. 4" inputMode="numeric" maxLength={10} />
        <label>Phone (WhatsApp)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" inputMode="tel" maxLength={30} />
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" inputMode="email" maxLength={120} />
        <label>Anything we should know?</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="4" placeholder="Branches, volumes, timelines…" maxLength={1500} />
        <div style={{ marginTop: 12 }}><button className="btn" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send enquiry'}</button></div>
      </div>
    </>
  );
}
