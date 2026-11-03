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
