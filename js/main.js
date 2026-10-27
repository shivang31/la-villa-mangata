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

  /* Photo tiles shimmer until their image arrives (tiles added later by gallery.js included) */
  var TILE = '.mosaic__tile, .tour-item';
  var markLoaded = function (img) { var t = img.closest(TILE); if (t) t.classList.add('is-loaded'); };
  document.addEventListener('load', function (e) { if (e.target.tagName === 'IMG') markLoaded(e.target); }, true);
  document.addEventListener('error', function (e) { if (e.target.tagName === 'IMG') markLoaded(e.target); }, true);
  $$(TILE).forEach(function (t) { var img = t.querySelector('img'); if (img && img.complete) markLoaded(img); });

  /* Swipe rows on phones: the card nearest the centre is in focus, the rest shrink slightly */
  var FOCUS_KIDS = ':scope > .mosaic__tile, :scope > .sleep__card, :scope > .quote';
  $$('.mosaic, .sleep__list, .quotes').forEach(function (row) {
    var pending = false;
    function update() {
      pending = false;
      var scrollable = row.scrollWidth > row.clientWidth + 4;
      row.classList.toggle('has-focus', scrollable);
      if (!scrollable) return;
      var box = row.getBoundingClientRect();
      var centre = box.left + box.width / 2;
      var kids = $$(FOCUS_KIDS, row);
      var best = null, bestDist = Infinity;
      kids.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - centre);
        if (d < bestDist) { bestDist = d; best = c; }
      });
      kids.forEach(function (c) { c.classList.toggle('is-focus', c === best); });
    }
    var schedule = function () { if (!pending) { pending = true; requestAnimationFrame(update); } };
    row.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if ('MutationObserver' in window) new MutationObserver(schedule).observe(row, { childList: true });
    update();
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
