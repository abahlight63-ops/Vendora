// ── frontend/src/lib/contactsImport.js ─────────────────────────────
// Turn what an owner brings in (a phone's contacts file, a spreadsheet, or
// numbers typed by hand) into [{ name, phone }]. The server checks and cleans
// every number again, so this only has to find them.
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/;

// .vcf (iPhone "Share contact", Android "Export"): one entry per phone number.
export function parseVcf(text) {
  const out = [];
  const unfolded = String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, ''); // folded lines continue with a space
  for (const card of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
    let name = '';
    const phones = [];
    for (const line of card.split('\n')) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).toUpperCase();
      const val = line.slice(i + 1).trim();
      if (key === 'FN' || key.startsWith('FN;')) name = val;
      else if (!name && (key === 'N' || key.startsWith('N;'))) name = val.split(';').filter(Boolean).reverse().join(' ');
      else if (key === 'TEL' || key.startsWith('TEL;') || /\.TEL($|;)/.test(key)) phones.push(val.replace(/^tel:/i, ''));
    }
    for (const p of phones) if (PHONE_RE.test(p)) out.push({ name: name.replace(/\\,/g, ',').trim(), phone: p });
  }
  return out;
}

function splitRow(line, sep) {
  const cells = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { cells.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

// .csv from Google Contacts or a spreadsheet. Uses the header when there is
// one (Name / Phone / Mobile…), otherwise finds the number in each row.
export function parseCsv(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const head = splitRow(lines[0], sep).map((h) => h.toLowerCase());
  const phoneCols = head.map((h, i) => (/phone|mobile|tel|whatsapp|number/.test(h) && !/type|label/.test(h) ? i : -1)).filter((i) => i >= 0);
  const nameCols = head.map((h, i) => (/^(name|full name|display name|first name|given name|last name|family name)$/.test(h) ? i : -1)).filter((i) => i >= 0);
  const out = [];
  if (phoneCols.length) {
    for (const line of lines.slice(1)) {
      const c = splitRow(line, sep);
      const name = nameCols.map((i) => c[i]).filter(Boolean).join(' ');
      for (const i of phoneCols) for (const p of String(c[i] || '').split(/:::|\//)) if (PHONE_RE.test(p)) out.push({ name, phone: p.trim() });
    }
    return out;
  }
  return parseTyped(lines.join('\n'));
}

// Typed or pasted: one person per line, "Mummy 0803 123 4567" or just the number.
export function parseTyped(text) {
  const out = [];
  for (const line of String(text || '').split(/\n|;/)) {
    const m = PHONE_RE.exec(line);
    if (!m) continue;
    const name = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).replace(/[,:\-–|]+/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ name, phone: m[0] });
  }
  return out;
}

export function parseFile(name, text) {
  return /\.vcf$/i.test(name) || /BEGIN:VCARD/i.test(text) ? parseVcf(text) : parseCsv(text);
}

// Android Chrome can open the phone's own contact picker (iPhone Safari cannot yet).
export const canPickContacts = () => typeof navigator !== 'undefined' && 'contacts' in navigator && typeof window !== 'undefined' && 'ContactsManager' in window;

export async function pickContacts() {
  const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
  const out = [];
  for (const c of picked || []) for (const p of c.tel || []) out.push({ name: (c.name && c.name[0]) || '', phone: p });
  return out;
}
