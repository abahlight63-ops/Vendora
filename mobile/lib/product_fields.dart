// ── lib/product_fields.dart ──────────────────────────────────────
// WHAT: the extra product questions for each kind of business, so a phone seller
// is asked about storage and condition, and a baker about flavours and notice.
//
// HOW IT SAVES: answers go into the product's Details and the sale into its Price,
// because the AI already reads both for every customer. Keep the format stable:
// parseDetails reads it back for editing. The web's copy is
// frontend/src/lib/productFields.js. Change both together.
class ProductField {
  final String label;
  final String hint;
  final List<String>? options;
  const ProductField(this.label, this.hint, [this.options]);
}

const Map<String, List<ProductField>> _sets = {
  'Electronics, Gadgets & Phone Accessories': [
    ProductField('Brand', 'Samsung'),
    ProductField('Storage', '128GB'),
    ProductField('RAM', '8GB'),
    ProductField('Condition', '', ['Brand new', 'UK used', 'Nigerian used', 'Refurbished']),
    ProductField('Colours', 'Black, Blue'),
    ProductField('Battery health', '92%'),
    ProductField('Warranty', '6 months'),
  ],
  'Clothing, Fashion & Accessories': [
    ProductField('Sizes', 'S, M, L, XL'),
    ProductField('Colours', 'Black, Wine'),
    ProductField('Material', 'Ankara'),
  ],
  'Sneakers & Footwear Reseller': [
    ProductField('Brand', 'Nike'),
    ProductField('Sizes', '40, 41, 42, 43'),
    ProductField('Colours', 'White, Black'),
    ProductField('Condition', '', ['Brand new', 'UK used', 'Pre-loved']),
  ],
  'Thrift, Vintage & Pre-loved Items': [
    ProductField('Sizes', 'M, L'),
    ProductField('Colours', 'Blue'),
    ProductField('Material', 'Denim'),
    ProductField('Condition', '', ['Like new', 'Good', 'Fair']),
  ],
  'Beauty, Cosmetics & Personal Care': [
    ProductField('Brand', 'Dudu Osun'),
    ProductField('Size', '100ml'),
    ProductField('Skin or hair type', 'Oily skin'),
    ProductField('Shades', 'Light, Medium, Deep'),
    ProductField('Expiry', 'March 2028'),
  ],
  'Hair Salons, Barbers & Makeup Artists': [
    ProductField('How long it takes', '2 hours'),
    ProductField('Length or style', '20 inch, knotless'),
    ProductField('Home service', '', ['Yes', 'No']),
  ],
  'Baking, Catering & Homemade Food': [
    ProductField('Size or portion', '8 inch, 2 layers'),
    ProductField('Flavours', 'Vanilla, Red velvet'),
    ProductField('Serves', '20 people'),
    ProductField('Order notice', '48 hours'),
  ],
  'Grocery, Fruits & Fresh Produce': [
    ProductField('Sold per', 'Basket'),
    ProductField('Weight or size', '5kg'),
    ProductField('Minimum order', '2 baskets'),
  ],
  'Home Decor, Furniture & Kitchenware': [
    ProductField('Size', '180cm x 90cm'),
    ProductField('Material', 'Solid wood'),
    ProductField('Colours', 'Walnut, Black'),
    ProductField('Comes assembled', '', ['Yes', 'No']),
  ],
  'Handmade Crafts & Artisanal Goods': [
    ProductField('Materials', 'Beads, leather'),
    ProductField('Size', 'Medium'),
    ProductField('Colours', 'Gold, Brown'),
    ProductField('Made to order', '', ['Yes', 'No']),
    ProductField('Time to make', '5 days'),
  ],
  'Dropshipping & General Retail Store': [
    ProductField('Brand', 'Generic'),
    ProductField('Sizes', 'S, M, L'),
    ProductField('Colours', 'Black, Red'),
  ],
  'Wholesale Supply & B2B Distribution': [
    ProductField('Pack size', '24 pieces'),
    ProductField('Minimum order', '5 cartons'),
    ProductField('Bulk price', '₦40,000 per carton'),
  ],
  'Freelance Services': [
    ProductField('What is included', '3 logo drafts'),
    ProductField('How long it takes', '5 days'),
    ProductField('Revisions', '2'),
  ],
  'Tutoring, Coaching & Digital Info-Products': [
    ProductField('Format', '', ['In person', 'Online', 'Download']),
    ProductField('Level', 'Beginner'),
    ProductField('How long', '6 weeks'),
  ],
  'Event Planning, Cakes & Decor': [
    ProductField('What is included', 'Decor and setup'),
    ProductField('Guests', 'Up to 100'),
    ProductField('Order notice', '2 weeks'),
  ],
  'Photography & Videography Services': [
    ProductField('What is included', '50 edited photos'),
    ProductField('How long', '3 hours'),
    ProductField('Delivery of files', '7 days'),
  ],
  'Fitness Coaching & Health Supplements': [
    ProductField('Format', '', ['In person', 'Online', 'Product']),
    ProductField('How long', '4 weeks'),
    ProductField('Size', '60 capsules'),
  ],
  'Real Estate Agent or Property Broker': [
    ProductField('Rent or sale', '', ['For rent', 'For sale', 'Short let']),
    ProductField('Property type', '3 bedroom flat'),
    ProductField('Area', 'Lekki Phase 1'),
    ProductField('Bedrooms', '3'),
    ProductField('Bathrooms', '3'),
    ProductField('Agency fee', '10%'),
  ],
  'Logistics, Delivery & Errand Services': [
    ProductField('Coverage area', 'Lagos Island'),
    ProductField('Delivery time', 'Same day'),
    ProductField('Weight limit', '20kg'),
  ],
};

const List<ProductField> _defaultSet = [
  ProductField('Size', 'Medium'),
  ProductField('Colours', 'Black, Blue'),
];

List<ProductField> fieldsFor(String niche) => _sets[niche] ?? _defaultSet;

/// "Storage: 128GB | RAM: 8GB" on the first line, then the owner's own details.
String buildDetails(Map<String, String> answers, List<ProductField> fields, String details) {
  final line = fields
      .map((f) => MapEntry(f.label, (answers[f.label] ?? '').trim()))
      .where((e) => e.value.isNotEmpty)
      .map((e) => '${e.key}: ${e.value}')
      .join(' | ');
  return [line, details.trim()].where((s) => s.isNotEmpty).join('\n');
}

/// Reads a saved description back into answers plus free text, so Edit can prefill.
({Map<String, String> answers, String details}) parseDetails(String description, List<ProductField> fields) {
  final labels = fields.map((f) => f.label).toSet();
  final lines = description.split('\n');
  final answers = <String, String>{};
  for (final part in lines.first.split(' | ')) {
    final at = part.indexOf(': ');
    if (at <= 0 || !labels.contains(part.substring(0, at))) {
      return (answers: <String, String>{}, details: description);
    }
    answers[part.substring(0, at)] = part.substring(at + 2);
  }
  return (answers: answers, details: lines.skip(1).join('\n'));
}

/// A sale is saved as "₦45,000 (was ₦60,000)", which the AI reads as written.
String buildPrice(String price, String oldPrice) {
  final p = price.trim(), o = oldPrice.trim();
  return p.isNotEmpty && o.isNotEmpty ? '$p (was $o)' : p;
}

({String price, String oldPrice}) parsePrice(String saved) {
  final m = RegExp(r'^(.*) \(was (.*)\)$').firstMatch(saved);
  return m == null ? (price: saved, oldPrice: '') : (price: m.group(1)!, oldPrice: m.group(2)!);
}
