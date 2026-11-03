// ── frontend/src/lib/avatars.js ────────────────────────────────────
// WHAT: emoji avatars for the shop, picked to match the kind of business, so a
// phone seller sees phones and gadgets first and a baker sees cakes. Saved on the
// business as avatar_emoji; a real photo, when set, still wins everywhere.
const SETS = {
  'Clothing, Fashion & Accessories': ['👗', '👚', '👠', '👜', '🧥', '🕶️', '💃🏾', '🛍️'],
  'Beauty, Cosmetics & Personal Care': ['💄', '💅🏾', '🧴', '🌸', '✨', '💆🏾‍♀️', '🪞', '🌺'],
  'Handmade Crafts & Artisanal Goods': ['🧶', '🎨', '🪡', '🏺', '🧵', '🪢', '✂️', '🎁'],
  'Baking, Catering & Homemade Food': ['🎂', '🧁', '🍰', '🍲', '🥘', '🍪', '👩🏾‍🍳', '🍩'],
  'Grocery, Fruits & Fresh Produce': ['🥭', '🍅', '🥬', '🍌', '🧺', '🌶️', '🍍', '🥑'],
  'Electronics, Gadgets & Phone Accessories': ['📱', '💻', '🎧', '🔌', '⌚', '📷', '🎮', '🔋'],
  'Home Decor, Furniture & Kitchenware': ['🛋️', '🪴', '🏠', '🍳', '🕯️', '🖼️', '🪑', '🛏️'],
  'Dropshipping & General Retail Store': ['🛒', '📦', '🛍️', '🏬', '🚚', '🏷️', '⭐', '💳'],
  'Sneakers & Footwear Reseller': ['👟', '🥾', '👞', '🩴', '👠', '🏀', '⚡', '🔥'],
  'Thrift, Vintage & Pre-loved Items': ['🧥', '👖', '🕰️', '📻', '👒', '♻️', '🎞️', '💎'],
  'Freelance Services': ['💼', '🧑🏾‍💻', '✍🏾', '🎯', '💡', '📐', '🖥️', '🚀'],
  'Tutoring, Coaching & Digital Info-Products': ['📚', '🎓', '🧠', '✏️', '🗂️', '🧑🏾‍🏫', '💡', '📝'],
  'Event Planning, Cakes & Decor': ['🎉', '🎈', '🎂', '💐', '🥂', '🎊', '💍', '🪩'],
  'Photography & Videography Services': ['📸', '🎥', '🎬', '🌅', '🖼️', '💡', '🎞️', '📷'],
  'Hair Salons, Barbers & Makeup Artists': ['💇🏾‍♀️', '💈', '💅🏾', '💄', '✂️', '👑', '💆🏾‍♀️', '🪮'],
  'Fitness Coaching & Health Supplements': ['🏋🏾‍♀️', '💪🏾', '🥗', '🏃🏾‍♂️', '🧘🏾‍♀️', '🍎', '⚡', '🥤'],
  'Real Estate Agent or Property Broker': ['🏠', '🏡', '🏢', '🔑', '🏘️', '📐', '🏙️', '🤝🏾'],
  'Logistics, Delivery & Errand Services': ['🚚', '🛵', '📦', '🗺️', '⏱️', '🚀', '📍', '🏍️'],
  'Wholesale Supply & B2B Distribution': ['📦', '🏭', '🚛', '🤝🏾', '📊', '🏷️', '🧾', '🗃️'],
};
const GENERAL = ['🛍️', '⭐', '💼', '🚀', '💎', '🔥', '🌍', '😊'];

/** Avatars for this kind of business first, then general ones, no repeats. */
export function avatarsFor(niche) {
  const mine = SETS[niche] || [];
  return [...mine, ...GENERAL.filter((e) => !mine.includes(e))];
}
