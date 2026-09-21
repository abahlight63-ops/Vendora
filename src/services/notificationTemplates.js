// ── src/services/notificationTemplates.js ──────────────────────────
// WHAT: 12 long-form built-in broadcast templates (the admin gallery).
// {name} = the shop's business name, replaced per inbox at send time.
// WHY IN CODE (not DB): built-ins ship with every deploy and can't be
// accidentally deleted — your own customs live in notification_templates.
// RULE: keep bodies plain-text with blank lines between ideas (the bell shows
// a preview, the notification page shows everything).
// No npm modules — pure data.

const BUILT_INS = [
 {
 id: 'builtin-welcome',
 title: "Welcome to VeloSales AI — start selling in 10 minutes",
 link: '/catalog',
 body: `Hello {name}, welcome aboard!

Your shop is live. Here is the fastest way to your first AI-handled sale:

1. Add 3–5 products on the Catalog page (name + price is enough to start).
2. Tell the bot your opening hours on the Profile page so closed-hour replies sound human.
3. Share your WhatsApp number with customers — the AI answers from YOUR catalog and flags you when unsure.

No catalog yet? Just send LEARN: followed by your products from your WhatsApp and they appear here automatically.

We are glad you are here. Reply from the Help page any time you get stuck — a human reads every message.`,
 },
 {
 id: 'builtin-feature',
 title: "New feature just landed — come see what changed",
 link: '/dashboard',
 body: `Hello {name}, we just shipped something new for your shop.

Open your dashboard to see it live. Every release goes through the same promise: your bot keeps replying from your manual catalog, free forever — new tools only ADD, never take away.

What to do now:
1. Open the dashboard and look for what is new.
2. Try it once with a real example from your own shop.
3. Tell us what you think from the Help page — your feedback decides what we build next.

Thank you for selling with VeloSales AI.`,
 },
 {
 id: 'builtin-fix',
 title: "We fixed something — everything is smooth again",
 link: '/dashboard',
 body: `Hello {name}, quick honesty note.

Something was not working right, and we just fixed it. You do not need to do anything — your catalog, chats and settings are exactly as you left them.

If anything still looks off on your side, send us a message from the Help page with what you see and we will sort it out personally.

Sorry for the trouble, and thank you for your patience.`,
 },
 {
 id: 'builtin-trial-ending',
 title: "Your Pro trial ends in 2 days — keep the good stuff",
 link: '/billing',
 body: `Hello {name}, your 7-day Pro trial is almost over.

Right now you enjoy profile sync, photo replies, premium AIs and zero ads. When the trial ends you drop to the free plan automatically — your bot keeps replying from your manual catalog, free forever, nothing deleted.

To keep everything Pro:
1. Open the Billing page.
2. Pick Pro or Pro Plus (monthly or yearly — yearly saves real money).
3. Pay by card in under two minutes.

No pressure either way — free keeps selling. But if Pro earned you even one extra sale this week, it already paid for itself.`,
 },
 {
 id: 'builtin-trial-ended',
 title: "Trial over — free plan is on, nothing lost",
 link: '/billing',
 body: `Hello {name}, your Pro trial has ended and your shop is now on the free plan.

What stays exactly the same:
- Your bot keeps replying to customers from your catalog.
- Your products, chats, FAQs and settings — all untouched.
- LEARN: teaching from WhatsApp stays free forever.

What paused: profile sync, photo replies, premium AIs and the ad-free experience.

Whenever you are ready, the Billing page switches Pro back on in two minutes. Until then — keep selling, free forever.`,
 },
 {
 id: 'builtin-payment-failed',
 title: "Your payment did not complete — retry in 2 minutes",
 link: '/billing',
 body: `Hello {name}, we noticed your card payment did not go through.

Nothing was charged. Your shop is safe on its current plan and the bot keeps working.

Most failed payments are fixed by one of these:
1. Check your card has enough balance and online payments are enabled.
2. Wait a minute and tap Billing to try again.
3. Try a different card if your bank blocks the first attempt.

If money left your account but no plan activated, message us from the Help page with the amount and time — duplicate or stuck charges are always refunded in full.`,
 },
 {
 id: 'builtin-new-ai',
 title: "A new AI brain joined your dropdown",
 link: '/velosales-ai',
 body: `Hello {name}, there is a new brain in your VeloSales AI picker.

Open VeloSales AI, tap the model name at the top, and try the new one. Every brain answers the same way — warm, polite, grounded in your business — they just differ in speed and depth:

- Fast brains: instant answers, perfect for quick questions.
- Smart brains: deeper answers with examples and steps.
- Premium brains (Pro): the heavy work — plans, proposals, long writing.

Your current pick is saved, so explore freely. The caption under each reply always tells you who actually answered.`,
 },
 {
 id: 'builtin-whatsapp-tips',
 title: "Get more from WhatsApp: 4 owner commands that save hours",
 link: '/connect',
 body: `Hello {name}, your WhatsApp connection can do more than reply. From YOUR personal number, send:

1. LEARN: product + price — teaches the bot a new product instantly.
2. SYNC: + your profile text — rebuilds the catalog (Pro).
3. PAUSE / RESUME — silence the bot in a chat while YOU talk.
4. UNDO — reverses the last stock change if you mistyped.

Make sure your shop shows LIVE on the Connect page first — TEST mode only pretends. One connected number, taught catalog, and the bot sells while you sleep.`,
 },
 {
 id: 'builtin-catalog-tips',
 title: "Your catalog is your salesperson — 5 ways to sharpen it",
 link: '/catalog',
 body: `Hello {name}, the AI can only promise what is in your catalog. Five upgrades that directly win sales:

1. Add stock counts — "only 3 left" sells faster than "available".
2. Put every product in a Category — the bot suggests within the lane first.
3. Write Details like a customer thinks: sizes, colours, warranty, delivery time.
4. Add a photo per product (Pro) — customers buy what they can see.
5. Delete or mark out-of-stock what is gone — the bot never oversells what it cannot see.

Ten minutes on the Catalog page today pays you back every single day after.`,
 },
 {
 id: 'builtin-season-push',
 title: "Sales season is here — set your shop to catch it",
 link: '/settings',
 body: `Hello {name}, big sales days are coming and prepared shops win them.

Your 15-minute checklist:
1. Catalog: confirm prices, stock counts and photos are current.
2. Settings: set a small SmartDeal discount so the bot can rescue price hesitations automatically.
3. Profile: update hours for the season (customers ask "are you open?" constantly).
4. VeloSales AI: ask it to write you 3 sales captions, then post them.

Shops that prepare sell calmly. Shops that do not, apologize busily. You have got this — and we are one Help message away if you need us.`,
 },
 {
 id: 'builtin-referral',
 title: "Know another seller? Both of you win",
 link: '/dashboard',
 body: `Hello {name}, quick favour that pays you back.

If you know a seller still replying to every "how much?" by hand at midnight, tell them about VeloSales AI. Every shop they open starts with a free plan and a 7-day Pro trial — no card, no risk.

Why sellers thank the person who referred them:
- Customers get instant answers, even at 2am.
- No more invented prices — the bot quotes their catalog only.
- They keep selling free forever if they never pay.

Just forward them our link and tell them to mention your shop name in the Help form. Thank you for growing this with us.`,
 },
 {
 id: 'builtin-stock-tips',
 title: "Never oversell again: stock counts + voice updates",
 link: '/catalog',
 body: `Hello {name}, let's talk about the silent profit-killer: selling what you do not have.

1. Put a Number in stock on every product (Catalog page, takes seconds).
2. When goods move, just tell the bot from your WhatsApp: "sold 3 bags of rice" — stock updates itself, audited, undoable with UNDO.
3. Got a voice note habit? Pro Plus transcribes "sold two cartons" from voice and updates stock the same way.
4. Watch the Stock column weekly — anything near zero gets restocked before a customer asks.

Shops with true stock counts get fewer "sorry, it's finished" moments — and those moments are where customers are lost.`,
 },
];

module.exports = { BUILT_INS };
