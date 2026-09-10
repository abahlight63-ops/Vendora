// ── scripts/seed.js ──────────────────────────────────────────────
// WHAT: inserts ONE demo business (Amaka Beauty Studio) + 5 products.
// Run with: npm run db:seed   (only for local development / demos!)
// WHY: lets you test the bot instantly without signing up and typing a catalog.
// NOTE: uses ON CONFLICT (upsert) so running it twice just refreshes, never duplicates.
require('dotenv').config(); // load .env first (db needs DATABASE_URL)
const db = require('../src/db'); // shared Postgres pool
const productService = require('../src/services/productService'); // upsertProducts() helper

// Seed one test business for development.
const TEST_BUSINESS = {
  name: 'Amaka Beauty Studio', // demo shop name
  whatsapp_number: 'whatsapp:+14155238886', // Twilio sandbox number for dev
  owner_number: 'whatsapp:+2348000000000', // your number: can send LEARN: messages
  hours: 'Mon-Sat, 9am-7pm WAT. Closed Sundays.', // shown to customers by the AI
  tone: 'warm, friendly, and concise', // AI personality instruction
  max_discount_pct: 10, // SmartDeal: AI may offer up to 10% off…
  min_order_naira: 15000, // …only on orders above ₦15,000

  faq: [ // Frequently Asked Questions the AI quotes verbatim
    { question: 'Where are you located?', answer: '12 Allen Avenue, Ikeja, Lagos.' },
    { question: 'Do you deliver products?', answer: 'Yes, we deliver within Lagos for a flat ₦2,000 fee.' },
  ],
  products: [ // demo catalog (name + price as the customer sees them)
    { name: 'Bone straight human hair wig 20"', price: '₦95,000', description: 'Grade 12A, glueless, customizable length' },
    { name: 'Silk press service', price: '₦15,000', description: 'Natural hair, lasts 2 weeks' },
    { name: 'Knotless braids (medium)', price: '₦25,000', description: 'Hair included, 4-5 hours' },
    { name: 'Manicure & pedicure combo', price: '₦12,000', available: true },
    { name: 'Brazilian wig 16" (last stock)', price: '₦60,000', description: 'Only 2 left', available: true },
  ],
};

(async () => { // async wrapper so we can await DB calls
  const { rows } = await db.query( // INSERT the business…
    `INSERT INTO businesses (name, whatsapp_number, owner_number, hours, faq, tone, max_discount_pct, min_order_naira)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (whatsapp_number) DO UPDATE
       SET name = EXCLUDED.name, owner_number = EXCLUDED.owner_number,
           hours = EXCLUDED.hours, faq = EXCLUDED.faq, tone = EXCLUDED.tone,
           max_discount_pct = EXCLUDED.max_discount_pct, min_order_naira = EXCLUDED.min_order_naira
     RETURNING id, name`, // ON CONFLICT = "if number exists, update instead of error"; EXCLUDED = the new values
    [TEST_BUSINESS.name, TEST_BUSINESS.whatsapp_number, TEST_BUSINESS.owner_number, TEST_BUSINESS.hours, JSON.stringify(TEST_BUSINESS.faq), TEST_BUSINESS.tone, TEST_BUSINESS.max_discount_pct, TEST_BUSINESS.min_order_naira]
  ); // JSON.stringify because faq column is JSONB (pass a JSON string, Postgres parses it)
  const biz = rows[0]; // first (only) returned row = the business we just inserted/updated
  const saved = await productService.upsertProducts(biz.id, TEST_BUSINESS.products); // insert/update each product
  console.log('Seeded test business:', biz); // show what was created
  console.log(`Seeded ${saved.length} products into the catalog.`); // confirm product count
  await db.pool.end(); // close pool so the script exits cleanly
})().catch((e) => { // catch any failure (DB down, bad SQL…)
  console.error(e); // print it
  process.exit(1); // exit code 1 = failure
});
