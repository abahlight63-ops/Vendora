// ── frontend/src/lib/niches.js ─────────────────────────────────────
// WHAT: the welcome-picker data, shared by Welcome.jsx (picker) +
// VendoraAI.jsx (niche suggestion chips). Labels are the canonical niche
// strings — the backend stores them verbatim (free text ≤80 chars, so custom
// "Other" entries never need a deploy here!).

export const NICHES = [
  'Clothing, Fashion & Accessories',
  'Beauty, Cosmetics & Personal Care',
  'Handmade Crafts & Artisanal Goods',
  'Baking, Catering & Homemade Food',
  'Grocery, Fruits & Fresh Produce',
  'Electronics, Gadgets & Phone Accessories',
  'Home Decor, Furniture & Kitchenware',
  'Dropshipping & General Retail Store',
  'Sneakers & Footwear Reseller',
  'Thrift, Vintage & Pre-loved Items',
  'Freelance Services',
  'Tutoring, Coaching & Digital Info-Products',
  'Event Planning, Cakes & Decor',
  'Photography & Videography Services',
  'Hair Salons, Barbers & Makeup Artists',
  'Fitness Coaching & Health Supplements',
  'Real Estate Agent or Property Broker',
  'Logistics, Delivery & Errand Services',
  'Wholesale Supply & B2B Distribution',
  'Other / Custom Business',
];

export const HEARD_FROM = [
  'WhatsApp broadcast / status',
  'Instagram',
  'TikTok',
  'Facebook',
  'Friend or family',
  'Google search',
  'YouTube',
  'In-person / market',
  'Other',
];

// Per-niche Vendora AI starter chips (freelancer sees gigs, baker sees
// orders — never generic "blue gown" examples for the wrong hustle!).
// Unknown/custom niches fall back to DEFAULT_CHIPS (VendoraAI handles it).
const NICHE_CHIPS = {
  'Clothing, Fashion & Accessories': [
    'Write a sales caption for my new drop',
    'How do I price my outfits?',
    'Draft a reply about sizes and returns',
    'Give me 5 content ideas for this week',
  ],
  'Freelance Services': [
    'Help me price my next gig',
    'Draft a proposal for a client',
    'What should my portfolio include?',
    'Draft a reply to a late-paying client',
  ],
  'Baking, Catering & Homemade Food': [
    'Help me price per tray',
    'Write an order-deadline caption',
    'Draft a reply about custom orders',
    'Give me 5 content ideas for this week',
  ],
};

export const DEFAULT_CHIPS = [
  'Write a sales caption for my new product',
  'Give me 5 business name ideas',
  'How do I price my products?',
  'Draft a reply to a difficult customer',
];

export function chipsFor(niche) {
  return NICHE_CHIPS[niche] || DEFAULT_CHIPS; // exact-label match, else generic (custom "Other" niches never break!)
}
