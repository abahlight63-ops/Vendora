// ── frontend/src/lib/helpGuides.js ─────────────────────────────────
// WHAT: the Help Center's picture guides. Each step names a real screenshot
// (public/help/<shot>-d.jpg on wide screens, <shot>-p.jpg on phones) and the
// exact box of the button it points at, as fractions of the picture, measured
// when the screenshots were taken (helpShots.json). To refresh after a page
// changes, rerun the screenshot script; it reads `page`, `click` and `target`
// below, so the arrows always land on the real button.
import SHOTS from './helpShots.json';

export const GUIDES = [
  {
    id: 'connect', icon: 'plug', color: '#4F3FC7', title: 'Connect your channels', sub: 'WhatsApp, Telegram, Messenger, Instagram',
    steps: [
      { shot: 'connect-1', page: '/dashboard', target: { d: 'nav a[href="/connect"]', p: '.mobile-bar a[href="/connect"]' }, title: 'Open Channels', text: 'Tap Channels in the menu. On a phone it is in the bar at the bottom of the screen.', label: 'Tap Channels' },
      { shot: 'connect-2', page: '/connect', target: '.ch-fb-go', title: 'Tap Continue with Facebook', text: 'In the Meta apps card, tap the big blue button. One Facebook login connects WhatsApp, Messenger and Instagram.', tip: 'Use the Facebook account that runs your business Page.', label: 'Tap here' },
      { shot: 'connect-3', page: '/connect', click: '.ch-fb-go', target: '.ch-guide', title: 'Follow every Meta screen', text: 'A Meta window opens. Choose your business, pick your WhatsApp number and tap Continue on each screen until it closes by itself.', tip: "Window didn't open? Allow pop-ups for this site, then tap again.", label: 'Read these first' },
      { shot: 'connect-4', page: '/connect', target: '.ch-choose', title: 'Or connect Telegram', text: 'Pick Your own bot (free, about a minute with @BotFather) or Our shared bot on Pro.', label: 'Pick one' },
      { shot: 'connect-5', page: '/connect', click: '.ch-option', target: '.ch-guide', title: 'Make your Telegram bot', text: 'Follow the six steps: open @BotFather, send /newbot, name it, copy the token, paste it and tap Connect bot.', label: 'Six short steps' },
    ],
  },
  {
    id: 'products', icon: 'box', color: '#D03C16', title: 'Add your products', sub: 'Catalog, prices and photos',
    steps: [
      { shot: 'products-1', page: '/dashboard', target: { d: 'nav a[href="/catalog"]', p: '.mobile-bar a[href="/catalog"]' }, title: 'Open Catalog', text: 'Everything Velo is allowed to sell lives here. If it is not in your catalog, Velo will not quote it.', label: 'Tap Catalog' },
      { shot: 'products-2', page: '/catalog', target: '.btn-go', title: 'Tap Add product', text: 'The coral button at the top opens the product form.', label: 'Tap here' },
      { shot: 'products-3', page: '/catalog', click: '.btn-go', target: '.ps-photo-btn', title: 'Add a photo and a name', text: 'A clear photo helps Velo send it to customers. Then type the product name the way customers say it.', label: 'Start here' },
      { shot: 'products-4', page: '/catalog', click: '.btn-go', target: '.ps-group', title: 'Answer the questions for your business', text: 'The questions change with your kind of business, for example storage and condition for phones, sizes and colours for clothes.', label: 'Fill these in' },
      { shot: 'products-5', page: '/catalog', click: '.btn-go', target: '.ps-save', title: 'Tap Add product', text: 'Velo can sell it straight away. Products with no price are highlighted so you can fix them.', label: 'Save it' },
    ],
  },
  {
    id: 'voice', icon: 'spark', color: '#B44BA0', title: 'Make Velo sound like you', sub: 'Voice, greeting and discounts',
    steps: [
      { shot: 'voice-1', page: '/settings?tab=voice', target: '[data-tab="voice"]', title: "Open Settings, then Velo's voice", text: 'Settings is under More in the menu. The middle tab controls how Velo talks.', label: "Velo's voice" },
      { shot: 'voice-2', page: '/settings?tab=voice', target: '[data-guide="brain"]', title: 'Choose which Velo answers', text: 'Fast is quickest, Normal suits most shops, Smart is best for haggling and long questions.', label: 'Pick one' },
      { shot: 'voice-3', page: '/settings?tab=voice', target: '[data-guide="greeting"]', title: 'Write your greeting', text: 'This is the first thing a new customer sees. The preview shows it exactly as they will.', label: 'Type here' },
      { shot: 'voice-4', page: '/settings?tab=voice', target: '[data-guide="discount"]', title: 'Set discounts, if you want them', text: 'Velo only offers a discount when a customer hesitates, and never more than your limit.', label: 'Your limit' },
    ],
  },
  {
    id: 'chats', icon: 'chat', color: '#059669', title: 'Answer chats yourself', sub: 'Inbox, flags and taking over',
    steps: [
      { shot: 'chats-1', page: '/dashboard', target: { d: 'nav a[href="/chats"]', p: '.mobile-bar a[href="/chats"]' }, title: 'Open Inbox', text: 'Every chat from every channel lands here, newest first.', label: 'Tap Inbox' },
      { shot: 'chats-2', page: '/chats', target: '.wx-pills', title: 'Check Needs you first', text: 'Chats Velo was unsure about are flagged in coral and shown first.', label: 'Start here' },
      { shot: 'chats-3', page: '/chats', target: '.wx-row', title: 'Open a chat', text: 'Tap any chat to read it. You see what the customer said and what Velo answered.', label: 'Tap a chat' },
    ],
  },
  {
    id: 'plans', icon: 'card', color: '#1E1757', title: 'Plans and payments', sub: 'Upgrade by card, bank or USSD',
    steps: [
      { shot: 'plans-1', page: '/billing', target: '.pu-usage', title: "See today's replies", text: 'Plan and usage shows how many replies Velo has used today, and when it resets.', label: 'Your usage' },
      { shot: 'plans-2', page: '/billing', target: '.pu-plan.best .pu-plan-btn', title: 'Choose a plan', text: 'Compare Free, Plus, Pro and Business, then tap Choose on the one you want.', label: 'Tap Choose' },
      { shot: 'plans-3', page: '/billing', click: '.pu-plan.best .pu-plan-btn', target: '.pu-methods', title: 'Pick how to pay', text: 'Card, bank transfer or USSD. Paystack opens on that method and your plan turns on the moment it is paid.', label: 'Pick one' },
      { shot: 'plans-4', page: '/billing', target: '.pu-card-acts', title: 'Save a card for later', text: 'Paystack checks it with ₦50 and refunds it straight away. Only the last 4 digits are kept.', label: 'Add a card' },
    ],
  },
  {
    id: 'test', icon: 'play', color: '#FF7650', title: 'Test before going live', sub: 'Test Drive like a customer',
    steps: [
      { shot: 'test-1', page: '/playground', target: '.td-tries', title: 'Tap a real situation', text: 'Open Test Drive and tap a question, or type like a customer in the phone.', label: 'Tap one' },
      { shot: 'test-2', page: '/playground', click: '.td-tries button', target: '.td-why', title: 'Read how Velo answered', text: 'See which product it used, whether it matched their Pidgin, and whether it would pass the chat to you.', label: 'Why it answered' },
      { shot: 'test-3', page: '/playground', target: '.td-live-go', title: 'Go live', text: 'Happy with the answers? Connect your channels and Velo starts answering real customers.', label: 'Tap here' },
    ],
  },
];

/** The measured box for a step's screenshot: { x, y, w, h } as fractions, or null. */
export function boxFor(shot, phone) {
  const s = SHOTS[shot];
  return s ? (phone ? s.p : s.d) || null : null;
}
