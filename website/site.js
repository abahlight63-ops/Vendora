// VeloSales Ai marketing site: the only script. It (1) opens and closes the
// phone menu, (2) fades sections in as they scroll into view, (3) plays the
// Chat with Velo demo when it appears, and (4) firms up the header once you
// scroll. Without JavaScript every section simply shows (the <html> class
// stays "no-js"), so Google and slow phones still get the full page.
(function () {
  var btn = document.querySelector('.nav-menu');
  var links = document.getElementById('nav-links');
  if (btn && links) {
    var set = function (open) {
      links.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    btn.addEventListener('click', function () { set(!links.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    document.addEventListener('click', function (e) { if (!links.contains(e.target) && !btn.contains(e.target)) set(false); });
  }

  // Light / dark: dark is the default look; the button flips it and the choice
  // is remembered (the <head> script applies it before the page paints).
  var root = document.documentElement;
  var tbtn = document.querySelector('.theme');
  var meta = document.querySelector('meta[name="theme-color"]');
  var paint = function () {
    var light = root.getAttribute('data-theme') === 'light';
    if (tbtn) tbtn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    if (meta) meta.setAttribute('content', light ? '#FFF1EC' : '#07041F');
  };
  if (tbtn) {
    tbtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { if (localStorage.getItem('vs-cookie') !== 'essential') localStorage.setItem('vs-theme', next); } catch (e) { /* private mode: still switches for this visit */ }
      paint();
    });
  }
  paint();

  var nav = document.querySelector('.nav');
  var onScroll = function () { if (nav) nav.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var items = document.querySelectorAll('.rv, .vchat');
  if (!('IntersectionObserver' in window)) {
    for (var i = 0; i < items.length; i++) items[i].classList.add('in');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  for (var j = 0; j < items.length; j++) io.observe(items[j]);
})();

// Cookie choice (NDPA): shown until the visitor chooses. Same key as the app.
(function () {
  var KEY = 'vs-cookie';
  try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
  var box = document.createElement('div');
  box.className = 'ck';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Cookie choice');
  box.innerHTML = '<div class="ck-ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 3 3 0 0 0 4 3 3 3 0 0 0 5 6z"/><path d="M8.5 13.5h.01M12 16.5h.01M15 11h.01M10 9h.01"/></svg></div>'
    + '<div class="ck-main"><b>Cookies on VeloSales Ai</b><span>We use one cookie to keep you signed in. With your OK we also remember choices like dark mode. No advertising or tracking cookies. <a href="https://app.velosalesai.com.ng/cookies">Cookie Policy</a></span></div>'
    + '<div class="ck-btns"><button type="button" class="ck-ghost" data-v="essential">Essential only</button><button type="button" class="ck-go" data-v="all">Accept all</button></div>';
  box.addEventListener('click', function (e) {
    var v = e.target && e.target.getAttribute('data-v');
    if (!v) return;
    try { localStorage.setItem(KEY, v); if (v === 'essential') localStorage.removeItem('vs-theme'); } catch (err) {}
    box.remove();
  });
  document.body.appendChild(box);
})();
