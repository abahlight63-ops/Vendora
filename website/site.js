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
      try { localStorage.setItem('vs-theme', next); } catch (e) { /* private mode: still switches for this visit */ }
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
