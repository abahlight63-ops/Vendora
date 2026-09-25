/* =========================================================
   SMART YUNUSA PORTFOLIO INTERACTION SCHEMA
   ========================================================= */

// CHANGE YOUR CONTACT NUMBERS AND EMAILS HERE
const WHATSAPP_NUMBER = "2349044971123";
const PHONE_NUMBER = "09044971123";
const PERSONAL_EMAIL = "smartyunusa8@gmail.com";
const CONSULTATION_FEE = 25000; // N25,000 base consultation

// Dynamic service offerings for Smart Yunusa
const menuItems = [
  {
    id: 1,
    category: "starters",
    name: "Videography – Event Coverage (Local)",
    price: 300000,
    usdPrice: 350,
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
    description: "Professional event coverage including church productions, interviews, and promotional videos.",
    detail: "Full-service videography for events, ministry productions, interviews, and promotional content with cinematic quality."
  },
  {
    id: 2,
    category: "starters",
    name: "Videography – Documentary Style (Global)",
    price: 600000,
    usdPrice: 700,
    image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=900&q=80",
    description: "Documentary-style video production with storytelling, interviews, and cinematic visuals.",
    detail: "Compelling documentary-style storytelling with professional shooting, sound design, and color grading."
  },
  {
    id: 3,
    category: "main",
    name: "Video Editing – Short-Form Content (Local)",
    price: 150000,
    usdPrice: 180,
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=900&q=80",
    description: "Editing for Instagram Reels, TikTok, YouTube Shorts, and Facebook videos with motion graphics.",
    detail: "Fast-turnaround short-form content editing with engaging motion graphics, sound design, and color correction."
  },
  {
    id: 4,
    category: "main",
    name: "Video Editing – Long-Form Content (Global)",
    price: 500000,
    usdPrice: 580,
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80",
    description: "Full video editing for YouTube videos, sermon highlights, and documentary projects.",
    detail: "Comprehensive long-form editing including caption editing, sound design, color grading, and motion graphics."
  },
  {
    id: 5,
    category: "vegetarian",
    name: "Social Media Management – Monthly (Local)",
    price: 250000,
    usdPrice: 300,
    image: "https://images.unsplash.com/photo-1590650153855-d9e808231d41?auto=format&fit=crop&w=900&q=80",
    description: "Complete social media management including content strategy, calendar, and platform management.",
    detail: "Full-service social media management covering content strategy, content calendar, platform management, audience growth, and analytics."
  },
  {
    id: 6,
    category: "vegetarian",
    name: "Social Media Management – Monthly (Global)",
    price: 750000,
    usdPrice: 900,
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=900&q=80",
    description: "Premium social media strategy and management for international brands and organizations.",
    detail: "Strategic social media management including community engagement, branding, analytics, and cross-platform optimization."
  },
  {
    id: 7,
    category: "desserts",
    name: "Content Creation – Campaign Planning",
    price: 200000,
    usdPrice: 240,
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
    description: "Script writing, creative direction, thumbnail design, and campaign planning services.",
    detail: "End-to-end content creation including script writing, creative direction, thumbnail design, and campaign planning."
  },
  {
    id: 8,
    category: "drinks",
    name: "Creative Consulting – Strategy Session",
    price: 100000,
    usdPrice: 120,
    image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=900&q=80",
    description: "Creative strategy consulting for brands, ministries, and content creators.",
    detail: "Expert consulting on creative strategy, brand development, visual communication, and digital storytelling."
  }
];

const orderItems = menuItems.slice(0, 6);

const reviews = [
  {
    name: "Eden Prayer Network (EPN)",
    photo: "https://images.unsplash.com/photo-1500676951792-661bfae462c6?auto=format&fit=crop&w=300&q=80",
    text: "Smart has been an incredible asset to our ministry. His videography and social media management have transformed our online presence and engagement."
  },
  {
    name: "Grace Emmanuel Church",
    photo: "",
    text: "The video content Smart produced for our conference was outstanding. Professional, impactful, and delivered on time. Highly recommend his services."
  },
  {
    name: "Bola Adeyemi – Content Creator",
    photo: "",
    text: "Smart's video editing skills are top-notch. He understands storytelling and knows how to make content that resonates with audiences. A true professional."
  }
];

const signatureDishes = [
  {
    name: "EPN Conference Highlights",
    price: 450000,
    usdPrice: 520,
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1000&q=80"
  },
  {
    name: "Sermon Series – Visual Storytelling",
    price: 350000,
    usdPrice: 400,
    image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=1000&q=80"
  },
  {
    name: "Social Media Campaign – Brand Growth",
    price: 500000,
    usdPrice: 580,
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1000&q=80"
  }
];

let cart = [];
let reviewIndex = 0;

// Dual-currency formatting utility
const formatPrice = (nairaVal, usdVal) => {
  return `₦${Number(nairaVal).toLocaleString("en-NG")} / $${usdVal}`;
};

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", () => {
  hidePreloader();
  setupNavbar();
  renderMenu("all");
  renderOrdering();
  renderSignatures();
  renderReviews();
  setupRevealAnimations();
  setupCounters();
  setupMenuFilters();
  setupCart();
  setupForms();
  setupGallery();
  setupAccordion();
  setupParallax();
  setupWhatsAppLinks();
});

function hidePreloader() {
  const preloader = qs("#preloader");
  const closeLoader = () => preloader?.classList.add("hide");
  setTimeout(closeLoader, 1400);
  window.addEventListener("load", () => {
    setTimeout(closeLoader, 650);
  });
}

function setupNavbar() {
  const navbar = qs("#navbar");
  const hamburger = qs("#hamburger");
  const navLinks = qs("#navLinks");

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
  });

  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });

  qsa(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => navLinks.classList.remove("open"));
  });

  qsa("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = qs(button.dataset.scrollTarget);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function renderMenu(filter) {
  const grid = qs("#menuGrid");
  const visibleItems = filter === "all" ? menuItems : menuItems.filter((item) => item.category === filter);

  grid.innerHTML = visibleItems.map((item) => `
    <article class="menu-card reveal visible" data-category="${item.category}">
      <img src="${item.image}" alt="${item.name}" />
      <div class="menu-card__body">
        <span class="eyebrow">${item.category}</span>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="price-row">
          <strong class="price">${formatPrice(item.price, item.usdPrice)}</strong>
          <button class="btn btn--ghost btn--small" data-menu-detail="${item.id}">View Details</button>
        </div>
      </div>
    </article>
  `).join("");

  qsa("[data-menu-detail]").forEach((button) => {
    button.addEventListener("click", () => openMenuModal(Number(button.dataset.menuDetail)));
  });
}

function setupMenuFilters() {
  qsa(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      qsa(".filter-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderMenu(button.dataset.filter);
    });
  });
}

function openMenuModal(id) {
  const item = menuItems.find((entry) => entry.id === id);
  openModal(`
    <img class="modal-image" src="${item.image}" alt="${item.name}" />
    <div class="modal-inner">
      <span class="eyebrow">${item.category}</span>
      <h2>${item.name}</h2>
      <p>${item.detail}</p>
      <div class="price-row">
        <strong class="price">${formatPrice(item.price, item.usdPrice)}</strong>
        <button class="btn btn--gold" onclick="addToCart(${item.id}); closeModal();">Add to Inquiry</button>
      </div>
    </div>
  `);
}

function renderSignatures() {
  qs("#signatureTrack").innerHTML = signatureDishes.map((dish, index) => `
    <article class="signature-card" style="background-image: url('${dish.image}'); animation-delay: -${index * 1.5}s">
      <span class="eyebrow">Featured Work</span>
      <h3>${dish.name}</h3>
      <strong class="price">${formatPrice(dish.price, dish.usdPrice)}</strong>
    </article>
  `).join("");
}

function renderOrdering() {
  qs("#orderGrid").innerHTML = orderItems.map((item) => `
    <article class="order-card">
      <img src="${item.image}" alt="${item.name}" />
      <div class="order-card__body">
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="quantity-row">
          <strong class="price">${formatPrice(item.price, item.usdPrice)}</strong>
          <div class="qty-control" data-qty-control="${item.id}">
            <button type="button" data-qty-minus="${item.id}">-</button>
            <span>1</span>
            <button type="button" data-qty-plus="${item.id}">+</button>
          </div>
        </div>
        <button class="btn btn--gold btn--full" data-add-cart="${item.id}">Add to Inquiry</button>
      </div>
    </article>
  `).join("");

  qsa("[data-qty-minus]").forEach((button) => {
    button.addEventListener("click", () => updateCardQuantity(button.dataset.qtyMinus, -1));
  });

  qsa("[data-qty-plus]").forEach((button) => {
    button.addEventListener("click", () => updateCardQuantity(button.dataset.qtyPlus, 1));
  });

  qsa("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.addCart);
      const qty = Number(qs(`[data-qty-control="${id}"] span`).textContent);
      addToCart(id, qty);
      openCart();
    });
  });
}

function updateCardQuantity(id, change) {
  const label = qs(`[data-qty-control="${id}"] span`);
  label.textContent = Math.max(1, Number(label.textContent) + change);
}

function setupCart() {
  qs("#openCart").addEventListener("click", openCart);
  qs("#closeCart").addEventListener("click", closeCart);
  qs("#pageOverlay").addEventListener("click", () => {
    closeCart();
    closeModal();
  });
  qs("#checkoutButton").addEventListener("click", openCheckout);
  qs("#whatsappOrderButton").addEventListener("click", sendCartToWhatsApp);
  updateCart();
}

function addToCart(id, quantity = 1) {
  const item = menuItems.find((entry) => entry.id === Number(id));
  const existing = cart.find((entry) => entry.id === item.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...item, quantity });
  }

  updateCart();
}

function updateCartQuantity(id, change) {
  const item = cart.find((entry) => entry.id === Number(id));
  if (!item) return;

  item.quantity += change;
  if (item.quantity <= 0) {
    cart = cart.filter((entry) => entry.id !== Number(id));
  }
  updateCart();
}

function removeCartItem(id) {
  cart = cart.filter((entry) => entry.id !== Number(id));
  updateCart();
}

function updateCart() {
  const cartItems = qs("#cartItems");
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalNaira = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotalUSD = cart.reduce((sum, item) => sum + item.usdPrice * item.quantity, 0);

  const totalNaira = subtotalNaira > 0 ? subtotalNaira + CONSULTATION_FEE : 0;
  const totalUSD = subtotalUSD > 0 ? subtotalUSD + 30 : 0;

  qs("#cartCount").textContent = count;
  qs("#cartSubtotal").textContent = formatPrice(subtotalNaira, subtotalUSD);
  qs("#cartDelivery").textContent = subtotalNaira > 0 ? formatPrice(CONSULTATION_FEE, 30) : formatPrice(0, 0);
  qs("#cartTotal").textContent = formatPrice(totalNaira, totalUSD);

  cartItems.innerHTML = cart.length ? cart.map((item) => `
    <article class="cart-item font-mono text-xs">
      <img src="${item.image}" alt="${item.name}" />
      <div>
        <h4>${item.name}</h4>
        <p>${formatPrice(item.price, item.usdPrice)} x ${item.quantity}</p>
        <div class="qty-control">
          <button type="button" onclick="updateCartQuantity(${item.id}, -1)">-</button>
          <span>${item.quantity}</span>
          <button type="button" onclick="updateCartQuantity(${item.id}, 1)">+</button>
        </div>
      </div>
      <button class="icon-btn" onclick="removeCartItem(${item.id})" aria-label="Remove ${item.name}">
        <i class="fa-solid fa-trash"></i>
      </button>
    </article>
  `).join("") : `<p class="muted font-sans text-xs">No services added to your inquiry yet.</p>`;
}

function openCart() {
  qs("#cartDrawer").classList.add("open");
  qs("#pageOverlay").classList.add("show");
}

function closeCart() {
  qs("#cartDrawer").classList.remove("open");
  qs("#pageOverlay").classList.remove("show");
}

function openCheckout() {
  if (!cart.length) {
    openModal(`<div class="modal-inner"><h2>Inquiry empty</h2><p>Please select services before submitting.</p><button class="btn btn--gold" onclick="closeModal()">Close</button></div>`);
    return;
  }

  const subtotalNaira = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotalUSD = cart.reduce((sum, item) => sum + item.usdPrice * item.quantity, 0);

  openModal(`
    <div class="modal-inner font-mono text-xs md:text-sm">
      <span class="eyebrow">Service Inquiry</span>
      <h2>Confirm Your Request</h2>
      <div class="checkout-grid">
        <form id="checkoutForm">
          <label>Full Name<input required placeholder="Your full name" /></label>
          <label>Phone Number<input required placeholder="${PHONE_NUMBER}" /></label>
          <label>Project Details<textarea required rows="4" placeholder="Share your vision, project timeline, and specific requirements..."></textarea></label>
          <label>Rate Preference<select required><option>Naira Base (₦250k - ₦1M)</option><option>USD Base ($300 - $2,500)</option></select></label>
          <button class="btn btn--gold btn--full" type="submit">Send Inquiry</button>
        </form>
        <div class="glass-card modal-inner">
          <h3>Estimated Cost</h3>
          ${cart.map((item) => `<p>${item.quantity} x ${item.name} <br><strong>${formatPrice(item.price * item.quantity, item.usdPrice * item.quantity)}</strong></p>`).join("")}
          <hr />
          <p>Consultation Fee: <strong>${formatPrice(CONSULTATION_FEE, 30)}</strong></p>
          <h3>Total Estimate: <br>${formatPrice(subtotalNaira + CONSULTATION_FEE, subtotalUSD + 30)}</h3>
          <p class="muted">I will respond from ${PERSONAL_EMAIL} within 24 hours.</p>
        </div>
      </div>
    </div>
  `);

  qs("#checkoutForm").addEventListener("submit", (event) => {
    event.preventDefault();
    cart = [];
    updateCart();
    closeCart();
    openModal(`<div class="modal-inner"><span class="eyebrow">Inquiry Sent</span><h2>Thank You!</h2><p>Your inquiry has been submitted. I will get back to you from ${PERSONAL_EMAIL} shortly.</p><button class="btn btn--gold" onclick="closeModal()">Close</button></div>`);
  });
}

function sendCartToWhatsApp() {
  if (!cart.length) {
    openModal(`<div class="modal-inner"><h2>Inquiry empty</h2><p>Add services before sending to WhatsApp.</p><button class="btn btn--gold" onclick="closeModal()">Close</button></div>`);
    return;
  }

  const subtotalNaira = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotalUSD = cart.reduce((sum, item) => sum + item.usdPrice * item.quantity, 0);

  const lines = cart.map((item) => `${item.quantity} x ${item.name} - ${formatPrice(item.price * item.quantity, item.usdPrice * item.quantity)}`).join("%0A");
  const message = `Hello Smart Yunusa,%0AI'm interested in your creative services and would like to discuss the following:%0A${lines}%0AConsultation: ${formatPrice(CONSULTATION_FEE, 30)}%0ATotal estimate: ${formatPrice(subtotalNaira + CONSULTATION_FEE, subtotalUSD + 30)}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank", "noopener");
}

function renderReviews() {
  const slider = qs("#reviewSlider");
  const dots = qs("#reviewDots");

  slider.innerHTML = reviews.map((review, index) => `
    <article class="review-card ${index === 0 ? "active" : ""}">
      <img src="${review.photo || 'https://images.unsplash.com/photo-1500676951792-661bfae462c6?auto=format&fit=crop&w=300&q=80'}" alt="${review.name}" />
      <div class="stars">★★★★★</div>
      <blockquote>“${review.text}”</blockquote>
      <p class="price">${review.name}</p>
    </article>
  `).join("");

  dots.innerHTML = reviews.map((_, index) => `<button class="${index === 0 ? "active" : ""}" aria-label="Show testimonial ${index + 1}"></button>`).join("");

  qsa("#reviewDots button").forEach((button, index) => {
    button.addEventListener("click", () => showReview(index));
  });

  setInterval(() => showReview((reviewIndex + 1) % reviews.length), 4500);
}

function showReview(index) {
  reviewIndex = index;
  qsa(".review-card").forEach((card, cardIndex) => card.classList.toggle("active", cardIndex === index));
  qsa("#reviewDots button").forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === index));
}

function setupForms() {
  qs("#reservationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = qsa("input, select, textarea", form);
    let valid = true;

    fields.forEach((field) => {
      field.classList.remove("field-error");
      if (field.hasAttribute("required") && !field.value.trim()) {
        field.classList.add("field-error");
        valid = false;
      }
    });

    if (!valid) {
      openModal(`<div class="modal-inner"><h2>Incomplete form</h2><p>Please fill in all highlighted fields.</p><button class="btn btn--gold" onclick="closeModal()">Close</button></div>`);
      return;
    }

    const data = new FormData(form);
    const message = `Booking Request for Smart Yunusa:%0AName: ${data.get("name")}%0APhone: ${data.get("phone")}%0AEmail: ${data.get("email")}%0AService: ${data.get("guests")}%0ADate: ${data.get("date")}%0ATime: ${data.get("time")}%0APlatform: ${data.get("seating")}%0ARegion: ${data.get("mode")}%0ADetails: ${data.get("message") || "None"}`;

    openModal(`
      <div class="modal-inner">
        <span class="eyebrow">Booking Requested</span>
        <h2>Session Inquiry Sent</h2>
        <p>Your booking request has been received. You can also send this directly to my WhatsApp for faster response.</p>
        <a class="btn btn--gold" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP_NUMBER}?text=${message}">Send via WhatsApp</a>
      </div>
    `);
    form.reset();
  });

  qs("#newsletterForm").addEventListener("submit", (event) => {
    event.preventDefault();
    openModal(`<div class="modal-inner"><span class="eyebrow">Subscribed</span><h2>Welcome!</h2><p>You'll receive video tips, social media strategies, and creative inspiration regularly.</p><button class="btn btn--gold" onclick="closeModal()">Close</button></div>`);
    event.currentTarget.reset();
  });
}

function setupGallery() {
  qsa("#galleryGrid img").forEach((image) => {
    image.addEventListener("click", () => {
      openModal(`<img class="modal-image" src="${image.src}" alt="${image.alt}" />`);
    });
  });
}

function setupAccordion() {
  qsa("#faqAccordion article button").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest("article");
      item.classList.toggle("open");
    });
  });
}

function setupRevealAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.16 });

  qsa(".reveal").forEach((element) => observer.observe(element));
}

function setupCounters() {
  const counters = qsa("[data-counter]");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const target = Number(entry.target.dataset.counter);
      let current = 0;
      const step = target / 80;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        entry.target.textContent = target % 1 === 0 ? `${Math.round(current)}+` : current.toFixed(1);
      }, 18);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.8 });

  counters.forEach((counter) => observer.observe(counter));
}

function setupParallax() {
  const dishes = qsa(".floating-dish");

  window.addEventListener("mousemove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 18;
    const y = (event.clientY / window.innerHeight - 0.5) * 18;
    dishes.forEach((dish, index) => {
      dish.style.marginLeft = `${x * (index + 1) * 0.24}px`;
      dish.style.marginTop = `${y * (index + 1) * 0.24}px`;
    });
  });

  window.addEventListener("scroll", () => {
    const heroMedia = qs(".hero__media");
    if (heroMedia) heroMedia.style.transform = `scale(1.04) translateY(${window.scrollY * 0.12}px)`;
  });
}

function setupWhatsAppLinks() {
  qs("#whatsappButton").href = `https://wa.me/${WHATSAPP_NUMBER}`;
}

function openModal(html) {
  qs("#modalContent").innerHTML = html;
  qs("#siteModal").classList.add("open");
  qs("#siteModal").setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}

function closeModal() {
  qs("#siteModal").classList.remove("open");
  qs("#siteModal").setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

qs("#siteModal")?.addEventListener("click", (event) => {
  if (event.target.id === "siteModal") closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    closeCart();
  }
});

window.addToCart = addToCart;
window.closeModal = closeModal;
window.updateCartQuantity = updateCartQuantity;
window.removeCartItem = removeCartItem;