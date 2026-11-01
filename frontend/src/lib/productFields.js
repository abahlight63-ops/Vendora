// ── frontend/src/lib/productFields.js ──────────────────────────────
// WHAT: the extra product questions for each kind of business, so a phone seller
// is asked about storage and condition, and a baker about flavours and notice.
//
// HOW IT SAVES: answers go into the product's Details and the sale into its Price,
// because the AI already reads both for every customer. So they work today with no
// database change. Keep the format stable: parseDetails reads it back for editing.
// The phone's copy is mobile/lib/product_fields.dart. Change both together.
const CONDITION = ['Brand new', 'UK used', 'Nigerian used', 'Refurbished'];
const YES_NO = ['Yes', 'No'];
const f = (label, hint, options) => ({ label, hint, options });

const SETS = {
  'Electronics, Gadgets & Phone Accessories': [f('Brand', 'Samsung'), f('Storage', '128GB'), f('RAM', '8GB'), f('Condition', '', CONDITION), f('Colours', 'Black, Blue'), f('Battery health', '92%'), f('Warranty', '6 months')],
  'Clothing, Fashion & Accessories': [f('Sizes', 'S, M, L, XL'), f('Colours', 'Black, Wine'), f('Material', 'Ankara')],
  'Sneakers & Footwear Reseller': [f('Brand', 'Nike'), f('Sizes', '40, 41, 42, 43'), f('Colours', 'White, Black'), f('Condition', '', ['Brand new', 'UK used', 'Pre-loved'])],
  'Thrift, Vintage & Pre-loved Items': [f('Sizes', 'M, L'), f('Colours', 'Blue'), f('Material', 'Denim'), f('Condition', '', ['Like new', 'Good', 'Fair'])],
  'Beauty, Cosmetics & Personal Care': [f('Brand', 'Dudu Osun'), f('Size', '100ml'), f('Skin or hair type', 'Oily skin'), f('Shades', 'Light, Medium, Deep'), f('Expiry', 'March 2028')],
  'Hair Salons, Barbers & Makeup Artists': [f('How long it takes', '2 hours'), f('Length or style', '20 inch, knotless'), f('Home service', '', YES_NO)],
  'Baking, Catering & Homemade Food': [f('Size or portion', '8 inch, 2 layers'), f('Flavours', 'Vanilla, Red velvet'), f('Serves', '20 people'), f('Order notice', '48 hours')],
  'Grocery, Fruits & Fresh Produce': [f('Sold per', 'Basket'), f('Weight or size', '5kg'), f('Minimum order', '2 baskets')],
  'Home Decor, Furniture & Kitchenware': [f('Size', '180cm x 90cm'), f('Material', 'Solid wood'), f('Colours', 'Walnut, Black'), f('Comes assembled', '', YES_NO)],
  'Handmade Crafts & Artisanal Goods': [f('Materials', 'Beads, leather'), f('Size', 'Medium'), f('Colours', 'Gold, Brown'), f('Made to order', '', YES_NO), f('Time to make', '5 days')],
  'Dropshipping & General Retail Store': [f('Brand', 'Generic'), f('Sizes', 'S, M, L'), f('Colours', 'Black, Red')],
  'Wholesale Supply & B2B Distribution': [f('Pack size', '24 pieces'), f('Minimum order', '5 cartons'), f('Bulk price', '₦40,000 per carton')],
  'Freelance Services': [f('What is included', '3 logo drafts'), f('How long it takes', '5 days'), f('Revisions', '2')],
  'Tutoring, Coaching & Digital Info-Products': [f('Format', '', ['In person', 'Online', 'Download']), f('Level', 'Beginner'), f('How long', '6 weeks')],
  'Event Planning, Cakes & Decor': [f('What is included', 'Decor and setup'), f('Guests', 'Up to 100'), f('Order notice', '2 weeks')],
  'Photography & Videography Services': [f('What is included', '50 edited photos'), f('How long', '3 hours'), f('Delivery of files', '7 days')],
  'Fitness Coaching & Health Supplements': [f('Format', '', ['In person', 'Online', 'Product']), f('How long', '4 weeks'), f('Size', '60 capsules')],
  'Real Estate Agent or Property Broker': [f('Rent or sale', '', ['For rent', 'For sale', 'Short let']), f('Property type', '3 bedroom flat'), f('Area', 'Lekki Phase 1'), f('Bedrooms', '3'), f('Bathrooms', '3'), f('Agency fee', '10%')],
  'Logistics, Delivery & Errand Services': [f('Coverage area', 'Lagos Island'), f('Delivery time', 'Same day'), f('Weight limit', '20kg')],
};
const DEFAULT_SET = [f('Size', 'Medium'), f('Colours', 'Black, Blue')];

export function fieldsFor(niche) { return SETS[niche] || DEFAULT_SET; }

/** "Storage: 128GB | RAM: 8GB" on the first line, then the owner's own details. */
export function buildDetails(answers, fields, details) {
  const line = fields.map((x) => ({ l: x.label, v: String(answers[x.label] || '').trim() })).filter((x) => x.v).map((x) => x.l + ': ' + x.v).join(' | ');
  return [line, String(details || '').trim()].filter(Boolean).join('\n');
}

/** Reads a saved description back into answers plus free text, so Edit can prefill. */
export function parseDetails(description, fields) {
  const answers = {};
  const lines = String(description || '').split('\n');
  const labels = fields.map((x) => x.label);
  const first = lines[0] || '';
  const parts = first.split(' | ').map((p) => { const at = p.indexOf(': '); return at > 0 ? [p.slice(0, at), p.slice(at + 2)] : null; });
  if (parts.length && parts.every((p) => p && labels.includes(p[0]))) {
    parts.forEach(([k, v]) => { answers[k] = v; });
    return { answers, details: lines.slice(1).join('\n') };
  }
  return { answers, details: String(description || '') };
}

/** A sale is saved as "₦45,000 (was ₦60,000)", which the AI reads as written. */
export function buildPrice(price, oldPrice) {
  const p = String(price || '').trim(), o = String(oldPrice || '').trim();
  return p && o ? p + ' (was ' + o + ')' : p;
}
export function parsePrice(saved) {
  const m = String(saved || '').match(/^(.*) \(was (.*)\)$/);
  return m ? { price: m[1], oldPrice: m[2] } : { price: String(saved || ''), oldPrice: '' };
}
