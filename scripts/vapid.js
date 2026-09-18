// ── scripts/vapid.js ─────────────────────────────────────────────
// WHAT: generate a VAPID key pair for Web Push (phone-bar alerts).
// Run: npm run push:vapid → paste both lines into .env / Render env.
// One pair per APP (not per owner!) — it identifies YOUR server to Google/
// Mozilla/Apple push services. Guard the PRIVATE half like a password!
// No npm modules — reuses src/services/pushService.js.
const { generateVapidKeys } = require('../src/services/pushService');

const kp = generateVapidKeys();
console.log('Paste these into .env (Render → Environment on deploy!):');
console.log(`VAPID_PUBLIC_KEY=${kp.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${kp.privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@yourshop.com');
