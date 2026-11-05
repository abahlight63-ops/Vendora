// ── frontend/src/components/FriendsCard.jsx ────────────────────────
// WHAT: AI settings → "Friends and family". The owner brings in the people who
// message their shop number for personal reasons (family, friends), and Velo
// never sends them a sales reply. Three ways in: the phone's contact picker
// (Android Chrome), a contacts file (.vcf / .csv), or typing numbers.
// Saves by itself (separate from the page's Save bar). Server: /api/me/friends.
import { useEffect, useRef, useState } from 'react';
import { api, pop, toast } from '../lib/api.js';
import Ic from './icons.jsx';
import Loader from './Loader.jsx';
import { parseFile, parseTyped, canPickContacts, pickContacts } from '../lib/contactsImport.js';

const SHOW = 60; // rows shown before "and N more" (search finds the rest)
const pretty = (digits) => {
  const d = String(digits || '');
  return d.startsWith('234') && d.length === 13 ? `0${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : '+' + d;
};

export default function FriendsCard() {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const file = useRef(null);

  async function load() {
    const { ok, data } = await api('/api/me/friends');
    setList(ok && data && Array.isArray(data.friends) ? data.friends : []);
  }
  useEffect(() => { load(); }, []);

  async function send(contacts, how) {
    if (!contacts.length) return pop('err', 'No phone numbers found', how === 'file' ? 'That file has no phone numbers we can read. Try a .vcf contacts file or a .csv with a Phone column.' : 'Type one person per line, like: Mummy 0803 123 4567');
    setBusy(how);
    const { ok, data } = await api('/api/me/friends', { method: 'POST', body: JSON.stringify({ contacts: contacts.slice(0, 3000) }) });
    setBusy('');
    if (!ok) return pop('err', 'Not added', (data && data.error) || 'Check your connection and try again.');
    const bits = [`Added ${data.added} ${data.added === 1 ? 'person' : 'people'}`];
    if (data.already) bits.push(`${data.already} already on your list`);
    if (data.skipped) bits.push(`${data.skipped} skipped (not a phone number)`);
    if (data.chatsMarked) bits.push(`${data.chatsMarked} open ${data.chatsMarked === 1 ? 'chat' : 'chats'} moved to Friends`);
    toast(bits.join('. ') + '.', 'ok');
    setTyped(''); setTyping(false);
    load();
  }

  async function onPick() {
    try { await send(await pickContacts(), 'pick'); }
    catch (e) { if (e && e.name !== 'AbortError') pop('err', 'Could not open your contacts', 'Upload a contacts file instead.'); }
  }
  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return pop('err', 'That file is too big', 'Export only the contacts you want, then try again.');
    const text = await f.text().catch(() => '');
    send(parseFile(f.name, text), 'file');
  }
  async function removeOne(id) {
    setList((xs) => xs.filter((x) => x.id !== id));
    const { ok } = await api('/api/me/friends/' + id, { method: 'DELETE' });
    if (!ok) { toast('Could not remove. Try again.', 'err'); load(); }
  }
  async function clearAll() {
    if (!window.confirm('Remove everyone from your friends and family list? Velo will treat them like any new customer.')) return;
    setBusy('clear');
    const { ok } = await api('/api/me/friends/clear', { method: 'POST', body: '{}' });
    setBusy('');
    if (ok) { setList([]); toast('List cleared'); } else toast('Could not clear. Try again.', 'err');
  }

  if (!list) return <div className="card"><div className="skel" style={{ height: 120 }} /></div>;
  const needle = q.trim().toLowerCase().replace(/\s+/g, '');
  const shown = needle ? list.filter((f) => (String(f.name || '').toLowerCase().replace(/\s+/g, '') + pretty(f.phone).replace(/\s+/g, '') + f.phone).includes(needle)) : list;
  const picker = canPickContacts();
  return (
    <div className="card fr-card" data-guide="friends">
      <div className="fr-head">
        <h2>Friends and family</h2>
        {list.length > 0 && <span className="pill ok">{list.length.toLocaleString()} {list.length === 1 ? 'person' : 'people'}</span>}
      </div>
      <p className="desc">People who message your shop number for personal reasons. Velo never sends them a sales reply: their chats go to Friends in your Inbox, and you answer them yourself. Works on WhatsApp (Telegram doesn't share phone numbers).</p>

      <div className="fr-ways">
        {picker && <button type="button" className="fr-way" disabled={!!busy} onClick={onPick}><span className="fr-way-ic"><Ic n="profile" s={20} /></span><span><b>{busy === 'pick' ? 'Adding' : 'Pick from my contacts'}</b><small>Choose people straight from your phone</small></span>{busy === 'pick' && <Loader size={16} />}</button>}
        <button type="button" className="fr-way" disabled={!!busy} onClick={() => file.current && file.current.click()}><span className="fr-way-ic"><Ic n="download" s={20} /></span><span><b>{busy === 'file' ? 'Reading file' : 'Upload a contacts file'}</b><small>A .vcf or .csv file from your phone or Google Contacts</small></span>{busy === 'file' && <Loader size={16} />}</button>
        <button type="button" className={'fr-way' + (typing ? ' on' : '')} disabled={!!busy} onClick={() => setTyping((t) => !t)}><span className="fr-way-ic"><Ic n="pencil" s={20} /></span><span><b>Type numbers</b><small>One person per line</small></span></button>
        <input ref={file} type="file" accept=".vcf,.csv,.txt,text/vcard,text/x-vcard,text/csv" hidden onChange={onFile} />
      </div>

      {typing && (
        <div className="fr-type">
          <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows="4" placeholder={'Mummy 0803 123 4567\nTunde 0816 555 0101\n+44 7700 900123'} aria-label="Numbers to add" />
          <div className="fr-type-foot">
            <span className="hint">{parseTyped(typed).length ? `${parseTyped(typed).length} found` : 'Names are optional'}</span>
            <button type="button" className="btn sm" disabled={!!busy || !parseTyped(typed).length} onClick={() => send(parseTyped(typed), 'type')}>{busy === 'type' ? (<><Loader size={15} />Adding</>) : 'Add to list'}</button>
          </div>
        </div>
      )}

      <details className="fr-how">
        <summary>How do I get a contacts file?</summary>
        <p><b>iPhone:</b> open Contacts, tap a contact, then Share Contact, and save it to Files. To send several, select them in the Contacts app on a Mac or at icloud.com and choose Export vCard.</p>
        <p><b>Android:</b> open Contacts, then Fix and manage (or Settings), then Export to file. It saves a .vcf file you can upload here.</p>
        <p><b>Google Contacts:</b> at contacts.google.com, select people, then Export, then Google CSV.</p>
      </details>

      {list.length > 0 && (
        <div className="fr-list">
          {list.length > 8 && <label className="od-search fr-search"><Ic n="search" s={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your list" aria-label="Search friends and family" /></label>}
          {shown.slice(0, SHOW).map((f) => (
            <div key={f.id} className="fr-row">
              <span className="fr-av" aria-hidden="true">{(String(f.name || '').trim()[0] || '#').toUpperCase()}</span>
              <span className="fr-main"><b>{f.name || 'No name'}</b><small>{pretty(f.phone)}</small></span>
              <button type="button" className="fr-x" onClick={() => removeOne(f.id)} aria-label={'Remove ' + (f.name || pretty(f.phone))}><Ic n="x" s={16} /></button>
            </div>
          ))}
          {shown.length > SHOW && <p className="hint fr-more">And {(shown.length - SHOW).toLocaleString()} more. Search to find someone.</p>}
          {needle && !shown.length && <p className="hint fr-more">Nobody on your list matches.</p>}
          <button type="button" className="fr-clear" disabled={!!busy} onClick={clearAll}>{busy === 'clear' ? 'Removing' : 'Remove everyone'}</button>
        </div>
      )}
    </div>
  );
}
