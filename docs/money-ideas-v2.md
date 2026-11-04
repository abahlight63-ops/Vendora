# Earning from free shops (plan for v2, after launch)

Written 4 November 2026. Broadcasts are already in the first version; everything
else here waits until after launch. Example prices are starting points to test,
not final.

## Rules that keep trust

- Never sell or share customer chats, names or numbers. It breaks Nigeria's data
  protection law (NDPA 2023) and would end the business.
- No ads or "sponsored" lines inside messages to customers (WhatsApp would ban
  the shop's number).
- Receipts and messages carry the shop's own name and logo, never VeloSales.
- Every price is shown before paying, with no surprise charges.
- One-off payments go through the Paystack billing that already exists.
- If ad networks are ever used: only inside the owner's app, only on Free, one
  quiet slot (Home or Insights), Google AdSense or a hand-picked partner, never
  pop-ups or redirects (Monetag/Adsterra-style), cookie consent and a Privacy
  Policy update first. Not before about 5,000 free users: Nigerian ad rates are
  often under $1 per 1,000 views.

## Build first after launch

1. **Top-up packs and the day pass** (one build covers both)
   - ₦500 for 100 extra replies today, offered the moment the free limit is hit.
   - ₦300 for 24 hours of Plus, for busy days: sales, Detty December, new stock.
     Plus costs about ₦250 a day, so the pass nudges owners toward monthly.
2. **"Pay now" link on receipts with a split fee**
   - The customer pays by Paystack or Flutterwave from the receipt.
   - Their split-payment feature sends VeloSales a small cut (for example 0.5%)
     without VeloSales ever holding the shop's money.
   - Earns every time shops make money; receipts are already built.
3. **"Book setup help" button**
   - A form that sends the request to the owner. Almost no build.

## Pay only when you need it

| Idea | Example price | Why it works |
|---|---|---|
| Top-up packs | ₦500 for 100 replies today | Sold at the moment the limit is hit |
| Day pass | ₦300 for 24 hours of Plus | Busy selling days |
| Voice note pack | ₦500 for 50 voice notes | Free shops that get many voice notes |
| Extra channel | ₦1,000 a month to add a second channel | Free stays on one channel |
| Extra broadcasts | Per broadcast above the plan's allowance | Builds on the broadcasts already live |

## Selling tools

| Idea | How it earns |
|---|---|
| Broadcasts (**live in v1**) | Plan allowances now; paid extra broadcasts in v2. WhatsApp template messages are billed by Meta to the shop's own account; a VeloSales margin could be added later if VeloSales pays Meta instead |
| Follow-ups | Free shops get a few a month, then pay per follow-up (builds on engine step 6) |
| "Pay now" on receipts | Small split fee on each payment |
| Delivery booking | Commission per rider booked through a delivery partner |

## Services (no build needed)

| Idea | Example price |
|---|---|
| Done-for-you setup: load the catalog, connect WhatsApp | ₦5,000 to ₦10,000 once |
| WhatsApp business verification help | One-off fee |
| Agency plan | Social media managers run several shops from one account |
| Resellers | Agents in markets earn a share for each shop they sign up and support |

## Extras

| Idea | How it earns |
|---|---|
| Monthly sales report (PDF) | Free shops pay per report; paid plans get it included |
| Catalog from photos | A few free, then pay per batch |
| Captions and flyer text in Chat with Velo | A few a day free, then credits |
| Shop directory | Free listing, paid "featured" spot |
| Partner cards on Home | Delivery, payments or POS companies pay per sign-up |
| Refer & Earn paid in replies | Rewards cost almost nothing and bring in shops |

## Broadcasts: what v1 already does

- Owner writes one message, picks who gets it (everyone, last 30 days, bought,
  asked but did not buy) and the channel. `{name}` becomes the customer's first name.
- Every broadcast ends with "Reply STOP to stop these messages."; STOP is honoured
  at once, even when Velo is paused on that chat.
- Telegram: free, any past customer.
- WhatsApp: free text only to customers who wrote in the last 24 hours. Older
  customers need an approved WhatsApp template (one `{{1}}` in the body for the
  message), billed by Meta to the shop's account; without one they are skipped.
- Plan allowances: Free 1 a week (up to 100 people), Plus 1 a day (1,000),
  Pro and Business 3 a day (5,000).
- Each message also appears in that customer's chat in the Inbox.
