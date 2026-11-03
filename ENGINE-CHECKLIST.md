# Engine checklist

The backend work, in the order to do it. Tick a box when it is done and live.
From the audit and review of 3 November 2026.

## 0. Your side (start now, runs in the background)
- [ ] Register a CAC Business Name (needed for Meta Business Verification)
- [ ] Render → Environment: confirm these exist: `EMAIL_SMTP_HOST`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`, `META_APP_ID`, `META_APP_SECRET`, `META_CONFIGURATION_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- [ ] Decide: WhatsApp follow-ups after 24 hours (paid templates, billed to the shop's Meta account) or free follow-ups inside 24 hours only
- [ ] Later: move Render from the free plan (sleeps when quiet) to the cheapest paid plan before launch

## 1. Safety fixes (start here, about a day)
- [ ] Check that incoming WhatsApp messages really come from Meta (signature check), so nobody can fake messages
- [ ] Update the three server libraries with known security problems (`npm audit fix`)
- [ ] Mark Messenger and Instagram "Coming soon" on the Channels page and the website until they really work
- [ ] Limit-reached message: customers see "Thanks for your message! We'll be back with you shortly." Only the owner sees the limit and upgrade prompt
- [ ] Don't count the owner's own replies toward the daily limit
- [ ] Reset the daily limit at midnight Lagos time (today it is 1 AM)
- [ ] Match plan limits to what we show: Free 50, Plus 500, Pro 1,500 (today Pro is uncapped), and add Business 5,000
- [ ] Remove the ads leftovers: verification tags, ad tables, admin ad page, ad settings, empty `ads` folder
- [ ] Remove the 4 unused old server files: `src/auth.js`, `src/authRoutes.js`, `src/billingRoutes.js`, `src/adminRoutes.js`

## 2. AI models (cheaper, five in a backup chain)
- [ ] Test candidates on 30 real Pidgin and English customer questions; keep the 5 best value
- [ ] Use free allowances first (Gemini Flash-Lite, Groq GPT-OSS and Qwen), then very cheap paid models, DeepSeek Flash as the backup
- [ ] Drop SambaNova, TokenRouter, Pollinations and the old Llama options
- [ ] Send Velo only the products a question is about, not the whole catalog (about a third of the cost)
- [ ] Update the Privacy Policy wording if free allowances that may train on chats are used

## 3. Orders and receipts (the base for sales, follow-ups and insights)
- [ ] New Orders record: items, quantity, price from the catalog, delivery, total, customer, status (pending, paid, delivered)
- [ ] Create orders three ways: "Make receipt" in a chat, "make a receipt for Tunde" in Chat with Velo, and Velo drafting one when a customer orders
- [ ] Receipt with logo, items, delivery, total and number; send it in the chat or share as a picture or PDF
- [ ] Remove the "Coming soon" tag on receipts (website and app)

## 4. Voice notes and photos on WhatsApp
- [ ] Download WhatsApp voice notes, turn them into text, and answer
- [ ] Read customer photos on WhatsApp and match them to the catalog
- [ ] Show the voice note's words under it in the Inbox
- [ ] Fix the gap where non-text WhatsApp messages never reach the Inbox at all

## 5. Real insights
- [ ] Work out insights on the server: chats per day and per app, Velo vs. needed you, reply speed, most-asked products, unanswered questions, orders and revenue, busiest hours
- [x] Give Chat with Velo real numbers so it can answer "how did my shop do this week?" (chats, customers, apps, busy times, most-asked products, logged stock; exact sales once orders exist)
- [ ] Remove the "Coming soon" tag on the weekly breakdown

## 6. Follow-ups for customers who didn't buy
- [ ] Setting: "Follow up after ___ hours" (default 4), and an optional second follow-up after ___ days
- [ ] Stop follow-ups when an order is made or the customer says stop
- [ ] Respect the 24-hour rule on WhatsApp, Messenger and Instagram; no limit on Telegram

## 7. Telegram shared bot
- [ ] Open it to every plan, not just Pro and testers
- [ ] Greet with the shop's name, logo and hours; sign replies with the shop name
- [ ] Customers linked to several shops choose "Which shop is this for?" instead of being moved
- [ ] QR code for each shop's link; a Help Center picture guide for "use my own bot"

## 8. Selling features (make Velo solve customer needs)
- [ ] Full sales flow: send the product photo, ask size or colour, suggest alternatives when out of stock, quote delivery and the total, collect name, address and phone, confirm, send the receipt
- [ ] Payment details in Settings (bank account or Paystack link); alert the owner when a customer sends a payment screenshot
- [ ] Delivery areas and fees in Settings
- [ ] Opening hours and an away message
- [ ] Block a number or report spam
- [ ] Turn on the scheduled jobs that already exist: daily summary, failed-payment reminders, win-back messages

## 9. Messenger and Instagram (after Meta approval)
- [ ] Accept Messenger and Instagram messages on the server
- [ ] Ask Meta for the message permissions in the connect window
- [ ] Meta Business Verification and App Review: screen recordings, data-deletion page, checklist
- [ ] Remove the "Coming soon" tags

## 10. Quality and launch
- [ ] Basic automated tests for replies, limits, payments and orders
- [ ] Error alerts, so problems are seen before customers report them
- [ ] Data export for shops
- [ ] Rewrite the out-of-date `design-check.mjs`
