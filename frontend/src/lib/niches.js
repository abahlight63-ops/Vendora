// ── frontend/src/lib/niches.js ─────────────────────────────────────
// WHAT: the welcome-picker data, shared by Welcome.jsx (picker) +
// VeloSalesAI.jsx (niche suggestion chips). Labels are the canonical niche
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

// Per-niche VeloSales Ai starter chips (freelancer sees gigs, baker sees
// orders — never generic "blue gown" examples for the wrong hustle!).
// Unknown/custom niches fall back to DEFAULT_CHIPS (VeloSalesAI handles it).
const NICHE_CHIPS = {
  'Clothing, Fashion & Accessories': [
    'Write a sales caption for my new drop',
    'How do I price my outfits?',
    'Draft a reply about sizes and returns',
    'Give me 5 content ideas for this week',
  ],
  'Beauty, Cosmetics & Personal Care': [
    'Write a caption for my new skincare set',
    'How do I price my glow packages?',
    'Draft a reply about skin types',
    'Give me 5 content ideas for this week',
  ],
  'Handmade Crafts & Artisanal Goods': [
    'Write a caption for my new handmade piece',
    'How do I price handmade work fairly?',
    'Draft a reply about custom orders',
    'Give me 5 content ideas for this week',
  ],
  'Baking, Catering & Homemade Food': [
    'Help me price per tray',
    'Write an order-deadline caption',
    'Draft a reply about custom orders',
    'Give me 5 content ideas for this week',
  ],
  'Grocery, Fruits & Fresh Produce': [
    'Write a caption for today\u2019s fresh stock',
    'How do I price my baskets?',
    'Draft a reply about delivery days',
    'Give me 5 content ideas for this week',
  ],
  'Electronics, Gadgets & Phone Accessories': [
    'Write a caption for my new gadget drop',
    'How do I price phones vs accessories?',
    'Draft a reply about warranty',
    'Give me 5 content ideas for this week',
  ],
  'Home Decor, Furniture & Kitchenware': [
    'Write a caption for my new home pieces',
    'How do I price furniture sets?',
    'Draft a reply about delivery and fitting',
    'Give me 5 content ideas for this week',
  ],
  'Dropshipping & General Retail Store': [
    'Write a caption for my winning product',
    'How do I price for ads + profit?',
    'Draft a reply about delivery time',
    'Give me 5 content ideas for this week',
  ],
  'Sneakers & Footwear Reseller': [
    'Write a caption for my new sneaker drop',
    'How do I price my pairs?',
    'Draft a reply about sizes and authenticity',
    'Give me 5 content ideas for this week',
  ],
  'Thrift, Vintage & Pre-loved Items': [
    'Write a caption for my new thrift bale',
    'How do I price thrift finds?',
    'Draft a reply about grading and defects',
    'Give me 5 content ideas for this week',
  ],
  'Freelance Services': [
    'Help me price my next gig',
    'Draft a proposal for a client',
    'What should my portfolio include?',
    'Draft a reply to a late-paying client',
  ],
  'Tutoring, Coaching & Digital Info-Products': [
    'Help me price my sessions',
    'Outline my next course module',
    'Draft a message to enroll a student',
    'Give me 5 content ideas for this week',
  ],
  'Event Planning, Cakes & Decor': [
    'Write a caption for my latest setup',
    'How do I price event packages?',
    'Draft a reply asking for event details',
    'Give me 5 content ideas for this week',
  ],
  'Photography & Videography Services': [
    'Write a caption for my latest shoot',
    'How do I price my sessions?',
    'Draft a reply asking for shoot details',
    'Give me 5 content ideas for this week',
  ],
  'Hair Salons, Barbers & Makeup Artists': [
    'Write a caption for my latest style',
    'How do I price my services?',
    'Draft a rebooking message for clients',
    'Give me 5 content ideas for this week',
  ],
  'Fitness Coaching & Health Supplements': [
    'Write a caption for my fitness program',
    'How do I price coaching plans?',
    'Draft a reply about supplement use',
    'Give me 5 content ideas for this week',
  ],
  'Real Estate Agent or Property Broker': [
    'Write a caption for my new listing',
    'How do I qualify a serious buyer?',
    'Draft a follow-up for a viewing',
    'Give me 5 content ideas for this week',
  ],
  'Logistics, Delivery & Errand Services': [
    'Write a caption for my delivery service',
    'How do I price intracity vs interstate?',
    'Draft a reply about pickup times',
    'Give me 5 content ideas for this week',
  ],
  'Wholesale Supply & B2B Distribution': [
    'Write a message for my distributors',
    'How do I price per carton vs per bag?',
    'Draft a reply about minimum orders',
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

// Per-niche catalog shelves: the Category dropdown in Add-product shows THESE
// for the shop's lane (electronics sellers see Phones + Accessories, fashion
// sellers see Gowns + Shoes — never one generic list for every hustle!).
// Unknown/custom niches fall back to DEFAULT_CATEGORIES.
const NICHE_CATEGORIES = {
  'Clothing, Fashion & Accessories': ['Gowns & Dresses', 'Tops & Shirts', 'Trousers & Jeans', 'Shoes', 'Bags', 'Accessories', 'Kids', 'Other'],
  'Beauty, Cosmetics & Personal Care': ['Skincare', 'Makeup', 'Hair Products', 'Fragrance', 'Nails', 'Tools', 'Other'],
  'Handmade Crafts & Artisanal Goods': ['Beadwork', 'Crochet & Knit', 'Art & Paintings', 'Home Crafts', 'Gifts', 'Other'],
  'Baking, Catering & Homemade Food': ['Cakes', 'Pastries', 'Trays & Platters', 'Drinks', 'Snacks', 'Other'],
  'Grocery, Fruits & Fresh Produce': ['Grains & Rice', 'Fruits', 'Vegetables', 'Provisions', 'Frozen', 'Drinks', 'Other'],
  'Electronics, Gadgets & Phone Accessories': ['Phones', 'Phone Accessories', 'Laptops & Computers', 'Audio & Speakers', 'TVs & Home Electronics', 'Chargers & Power', 'Gadgets', 'Other'],
  'Home Decor, Furniture & Kitchenware': ['Furniture', 'Kitchenware', 'Bedding', 'Decor', 'Lighting', 'Other'],
  'Dropshipping & General Retail Store': ['Fashion Finds', 'Gadgets', 'Home Gadgets', 'Beauty Finds', 'Other'],
  'Sneakers & Footwear Reseller': ['Sneakers', 'Slides & Sandals', 'Boots', 'Kids Footwear', 'Socks & Care', 'Other'],
  'Thrift, Vintage & Pre-loved Items': ['Thrift Tops', 'Thrift Gowns', 'Thrift Jeans', 'Thrift Shoes', 'Thrift Bags', 'Other'],
  'Freelance Services': ['Starter Package', 'Standard Package', 'Premium Package', 'Add-ons', 'Other'],
  'Tutoring, Coaching & Digital Info-Products': ['Courses', 'Sessions', 'Materials', 'Other'],
  'Event Planning, Cakes & Decor': ['Cakes', 'Decor', 'Planning Packages', 'Rentals', 'Other'],
  'Photography & Videography Services': ['Sessions', 'Prints', 'Packages', 'Other'],
  'Hair Salons, Barbers & Makeup Artists': ['Wigs', 'Services', 'Products', 'Braids', 'Makeup', 'Other'],
  'Fitness Coaching & Health Supplements': ['Supplements', 'Plans', 'Gear', 'Sessions', 'Other'],
  'Real Estate Agent or Property Broker': ['Land', 'Houses', 'Rentals', 'Shortlets', 'Other'],
  'Logistics, Delivery & Errand Services': ['Intracity', 'Interstate', 'Errands', 'Haulage', 'Other'],
  'Wholesale Supply & B2B Distribution': ['Bags', 'Cartons', 'Bales', 'Crates', 'Other'],
};

export const DEFAULT_CATEGORIES = ['New Arrivals', 'Best Sellers', 'General', 'Other'];

export function categoriesFor(niche) {
  return NICHE_CATEGORIES[niche] || DEFAULT_CATEGORIES; // exact-label match, else generic shelves (custom niches never break!)
}

// Per-niche Details placeholder: the add-form hint speaks the lane's language
// (electronics → brand/storage/warranty, fashion → sizes/fabric).
const NICHE_DETAIL_HINTS = {
  'Clothing, Fashion & Accessories': 'Sizes M–XL, cotton…',
  'Beauty, Cosmetics & Personal Care': 'Skin types, shades, volume…',
  'Handmade Crafts & Artisanal Goods': 'Materials, made-to-order time…',
  'Baking, Catering & Homemade Food': 'Flavours, minimum order, notice needed…',
  'Grocery, Fruits & Fresh Produce': 'Unit (bag, basket, kg), market days…',
  'Electronics, Gadgets & Phone Accessories': 'Brand, storage, RAM, warranty…',
  'Home Decor, Furniture & Kitchenware': 'Dimensions, material, colours…',
  'Dropshipping & General Retail Store': 'What it does, delivery time…',
  'Sneakers & Footwear Reseller': 'Sizes 40–45, authentic…',
  'Thrift, Vintage & Pre-loved Items': 'Grade, defects if any, size…',
  'Freelance Services': 'What is included, delivery time…',
  'Tutoring, Coaching & Digital Info-Products': 'Duration, level, format…',
  'Event Planning, Cakes & Decor': 'Guest count, theme, date needed…',
  'Photography & Videography Services': 'Hours, edited copies, location…',
  'Hair Salons, Barbers & Makeup Artists': 'Lengths, service time…',
  'Fitness Coaching & Health Supplements': 'Dosage, plan length…',
  'Real Estate Agent or Property Broker': 'Location, plot size, documents…',
  'Logistics, Delivery & Errand Services': 'Routes, timing, weight limits…',
  'Wholesale Supply & B2B Distribution': 'Minimum order, per-unit breakdown…',
};

export const DEFAULT_DETAIL_HINT = 'Sizes, colours, what makes it special…';

export function detailHintFor(niche) {
  return NICHE_DETAIL_HINTS[niche] || DEFAULT_DETAIL_HINT;
}

// Per-niche LEARN: example for the catalog tip line (same lane language!).
const NICHE_LEARN_EXAMPLES = {
  'Clothing, Fashion & Accessories': 'LEARN: Blue gown ₦45,000',
  'Electronics, Gadgets & Phone Accessories': 'LEARN: iPhone 13 128GB ₦550,000',
  'Sneakers & Footwear Reseller': 'LEARN: Nike Air Force 1 size 43 ₦38,000',
  'Baking, Catering & Homemade Food': 'LEARN: Chocolate cake 10-inch ₦25,000',
  'Hair Salons, Barbers & Makeup Artists': 'LEARN: Bone straight wig 22-inch ₦95,000',
  'Grocery, Fruits & Fresh Produce': 'LEARN: Bag of rice 50kg ₦85,000',
};

export const DEFAULT_LEARN_EXAMPLE = 'LEARN: Blue gown ₦45,000';

export function learnExampleFor(niche) {
  return NICHE_LEARN_EXAMPLES[niche] || DEFAULT_LEARN_EXAMPLE;
}
