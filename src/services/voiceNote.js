// ── src/services/voiceNote.js ─────────────────────────────────────
// One rule for voice notes on every channel: paid plans (and the Pro trial)
// get them transcribed and answered; Free gets a polite hand-off note, so the
// owner sees there was a voice note and can listen in the app.
// Input: the shop, downloaded audio { mime, base64 } (or null) and any caption.
// Output: the text the brain reads ("Voice note: \"...\"").
const planService = require('./planService');
const whatsappService = require('./whatsappService'); // transcribeAudio (Whisper on Groq)

async function toText(business, audio, caption = '') {
  const add = (note) => (caption ? caption + '\n' : '') + note;
  if (!audio) return add('[a voice note was sent that could not be opened]');
  if (planService.effectiveTier(business) === 'free') return add('[a voice note was sent: voice notes come with paid plans]');
  const said = await whatsappService.transcribeAudio({ mime: audio.mime, base64: audio.base64 });
  return said ? `Voice note: "${said}"${caption ? '\n' + caption : ''}` : add('[a voice note was sent that could not be transcribed]');
}

module.exports = { toText };
