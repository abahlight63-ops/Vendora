// Friends and family import: reading phone contact files, spreadsheets and
// typed lists, and the server cleaning every number the same way.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const lib = () => import(pathToFileURL(path.join(__dirname, '../frontend/src/lib/contactsImport.js')).href);

test('vcf: names and every phone number, folded lines joined', async () => {
  const { parseVcf } = await lib();
  const vcf = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Mummy\r\nTEL;TYPE=CELL:+234 803 123 4567\r\nTEL;TYPE=HOME:0816 555 0101\r\nEND:VCARD\r\nBEGIN:VCARD\r\nN:Obi;Tunde;;;\r\nitem1.TEL:080\r\n 99887766\r\nEND:VCARD\r\n';
  assert.deepEqual(parseVcf(vcf), [
    { name: 'Mummy', phone: '+234 803 123 4567' },
    { name: 'Mummy', phone: '0816 555 0101' },
    { name: 'Tunde Obi', phone: '08099887766' },
  ]);
});

test('csv with a header (Google Contacts style)', async () => {
  const { parseCsv } = await lib();
  const csv = 'Name,Given Name,Phone 1 - Type,Phone 1 - Value\nAunty Bisi,Bisi,Mobile,0803 000 1111 ::: 0803 000 2222\nNo phone,x,Mobile,\n';
  assert.deepEqual(parseCsv(csv), [
    { name: 'Aunty Bisi Bisi', phone: '0803 000 1111' },
    { name: 'Aunty Bisi Bisi', phone: '0803 000 2222' },
  ]);
});

test('typed lines: name optional, number anywhere', async () => {
  const { parseTyped } = await lib();
  assert.deepEqual(parseTyped('Mummy 0803 123 4567\n+44 7700 900123\nhello'), [
    { name: 'Mummy', phone: '0803 123 4567' },
    { name: '', phone: '+44 7700 900123' },
  ]);
});

test('server cleans numbers to digits with country code, and rejects junk', () => {
  const { normalizePhone } = require('../src/utils/phone');
  const d = (x) => (normalizePhone(x) || '').replace(/\D/g, '') || null;
  assert.equal(d('0803 123 4567'), '2348031234567');
  assert.equal(d('+234 803 123 4567'), '2348031234567');
  assert.equal(d('12'), null);
});
