/* Core behaviour that works without any animation library:
   WhatsApp links, image shimmer, dock highlighting, offline support. */
(function () {
  'use strict';

  var WA = 'https://wa.me/919111333368';
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var haptic = function (ms) { if (navigator.vibrate) { try { navigator.vibrate(ms || 6); } catch (e) {} } };
  window.__mainReady = true;
  window.LVM = window.LVM || {};
  window.LVM.haptic = haptic;

  /* WhatsApp links carry a prefilled message */
  $$('.js-wa').forEach(function (a) {
    var msg = a.getAttribute('data-msg');
    if (msg) a.href = WA + '?text=' + encodeURIComponent(msg);
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* Media frames: drop the shimmer once the image or map has loaded */
  $$('.media').forEach(function (frame) {
    var el = frame.querySelector('img, iframe, video');
    var done = function () { frame.classList.add('is-loaded'); };
    if (!el) return done();
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) return done();
    el.addEventListener('load', done, { once: true });
    el.addEventListener('loadeddata', done, { once: true });
    el.addEventListener('error', done, { once: true });
  });

  /* Dock: highlight the section in view; light haptic on tap */
  var dockItems = $$('.dock__item');
  dockItems.forEach(function (item) { item.addEventListener('click', function () { haptic(8); }); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        dockItems.forEach(function (item) {
          var on = item.getAttribute('data-section') === id;
          item.classList.toggle('is-active', on);
          if (on) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['top', 'photos', 'overview', 'live', 'about', 'sleep', 'amenities', 'events', 'reviews', 'where', 'rules', 'platforms', 'faq'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* Offline support / installable app */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
