// VeloSales Ai marketing site: the only script. It opens and closes the phone
// menu. Everything else (links, FAQ answers, the notify form) works without
// JavaScript, so Google and slow phones get the full page.
(function () {
  var btn = document.querySelector('.nav-menu');
  var links = document.getElementById('nav-links');
  if (!btn || !links) return;
  function set(open) {
    links.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  btn.addEventListener('click', function () { set(!links.classList.contains('open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  document.addEventListener('click', function (e) { if (!links.contains(e.target) && !btn.contains(e.target)) set(false); });
})();
