// ── src/services/nicheMeta.js ────────────────────────────────────
// WHAT: the server-side mirror of frontend/src/lib/niches.js shelves + hints.
// WHY MIRRORED: the phone app fetches these via GET /api/me/catalog-meta so
// web + mobile show the SAME niche shelves (electronics → Phones…,
// fashion → Gowns…) without duplicating the map in Dart.
// RULE: when you add a niche/category here, add it in niches.js too (and
// vice versa) — labels must match EXACTLY (chips + AI seeds key off them!).
// No npm modules — pure data + three functions.

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

const DEFAULT_CATEGORIES = ['New Arrivals', 'Best Sellers', 'General', 'Other'];

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

const NICHE_LEARN_EXAMPLES = {
  'Clothing, Fashion & Accessories': 'LEARN: Blue gown ₦45,000',
  'Electronics, Gadgets & Phone Accessories': 'LEARN: iPhone 13 128GB ₦550,000',
  'Sneakers & Footwear Reseller': 'LEARN: Nike Air Force 1 size 43 ₦38,000',
  'Baking, Catering & Homemade Food': 'LEARN: Chocolate cake 10-inch ₦25,000',
  'Hair Salons, Barbers & Makeup Artists': 'LEARN: Bone straight wig 22-inch ₦95,000',
  'Grocery, Fruits & Fresh Produce': 'LEARN: Bag of rice 50kg ₦85,000',
};

function categoriesFor(niche) {
  return NICHE_CATEGORIES[niche] || DEFAULT_CATEGORIES;
}

function detailHintFor(niche) {
  return NICHE_DETAIL_HINTS[niche] || 'Sizes, colours, what makes it special…';
}

function learnExampleFor(niche) {
  return NICHE_LEARN_EXAMPLES[niche] || 'LEARN: Blue gown ₦45,000';
}

module.exports = { categoriesFor, detailHintFor, learnExampleFor, DEFAULT_CATEGORIES };
