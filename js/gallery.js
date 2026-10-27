/* Photos: Airbnb-style mosaic (swipe carousel of every photo on phones), full-screen photo tour grouped by space,
   and a lightbox with swipe / keyboard / pinch-zoom. Photo list comes from data/gallery.json.
   Deep links: #photo-tour opens the tour, #photo-N opens photo N. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var haptic = function (ms) { if (window.LVM && window.LVM.haptic) window.LVM.haptic(ms); };
  var lenis = function () { return window.LVM && window.LVM.lenis; };
  var webp = (function () {
    try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; }
  })();
  var DIR = 'img/gallery/';
  var full = function (p) { return DIR + p.name + (webp ? '.webp' : '.jpg'); };
  var slug = function (s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var picture = function (p, sizes, lazy) {
    return '<picture><source type="image/webp" srcset="' + DIR + p.name + '-sm.webp 640w, ' + DIR + p.name + '.webp 1600w" sizes="' + sizes + '">' +
      '<img src="' + DIR + p.name + '-sm.jpg" srcset="' + DIR + p.name + '-sm.jpg 640w, ' + DIR + p.name + '.jpg 1600w" sizes="' + sizes + '"' +
      ' width="' + p.sw + '" height="' + p.sh + '"' + (lazy ? ' loading="lazy"' : '') + ' decoding="async" alt="' + p.alt.replace(/"/g, '&quot;') + '"></picture>';
  };

  var photos = [];
  var byId = {};
  var gallery = $('gallery'), galleryPanel = gallery && gallery.querySelector('.gallery__panel');
  var lightbox = $('lightbox'), lightboxPanel = lightbox && lightbox.querySelector('.lightbox__panel');
  if (!gallery || !lightbox) return;

  /* ---------- History: #photo-tour / #photo-N ---------- */
  var pushed = false, ignorePop = false;
  function setHash(h, push) {
    var url = location.pathname + location.search + (h ? '#' + h : '');
    if (push && !pushed) { history.pushState({ lvmGallery: true }, '', url); pushed = true; }
    else history.replaceState(history.state, '', url);
  }
  function clearHash() {
    if (pushed) { pushed = false; ignorePop = true; history.back(); }
    else history.replaceState(null, '', location.pathname + location.search);
  }
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    pushed = false;
    if (!lightbox.hidden) closeLightbox(true);
    if (!gallery.hidden) closeTour(true);
    routeFromHash();
  });

  /* ---------- Scroll lock ---------- */
  function lock() {
    root.classList.add('gallery-open');
    var l = lenis(); if (l) l.stop();
  }
  function unlock() {
    if (!gallery.hidden || !lightbox.hidden) return;
    root.classList.remove('gallery-open');
    var l = lenis(); if (l) l.start();
  }

  /* ---------- Mosaic ---------- */
  var mosaic = $('mosaic');
  var countEl = $('mosaic-count');
  function buildMosaicExtras() {
    if (!mosaic) return;
    var shown = $$('.mosaic__tile', mosaic).map(function (t) { return +t.getAttribute('data-photo'); });
    var html = '';
    photos.forEach(function (p) {
      if (shown.indexOf(p.id) > -1) return;
      html += '<button class="mosaic__tile mosaic__tile--extra tap" type="button" data-photo="' + p.id + '" aria-label="Open photo: ' +
        p.alt.replace(/"/g, '&quot;') + '">' + picture(p, '100vw', true) + '</button>';
    });
    mosaic.insertAdjacentHTML('beforeend', html);
    updateCount();
  }
  function updateCount() {
    if (!mosaic || !countEl) return;
    var tiles = $$('.mosaic__tile', mosaic);
    var i = Math.round(mosaic.scrollLeft / Math.max(1, mosaic.clientWidth));
    countEl.textContent = Math.min(tiles.length, i + 1) + ' / ' + (photos.length || tiles.length);
  }
  if (mosaic) {
    var ticking = false;
    mosaic.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; updateCount(); });
    }, { passive: true });
  }

  /* ---------- Photo tour ---------- */
  var tourOpener = null, tourBuilt = false, catObserver = null;
  function buildTour() {
    if (tourBuilt) return;
    tourBuilt = true;
    var cats = [];
    photos.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    $('gallery-count').textContent = photos.length + ' photos';
    $('gallery-cats').innerHTML = cats.map(function (c) {
      var n = photos.filter(function (p) { return p.cat === c; }).length;
      return '<button class="gallery__chip tap" type="button" data-cat="' + slug(c) + '">' + c + ' <span class="mono">' + n + '</span></button>';
    }).join('');
    $('gallery-body').innerHTML = cats.map(function (c) {
      var list = photos.filter(function (p) { return p.cat === c; });
      return '<section class="tour-cat" id="tour-' + slug(c) + '" aria-label="' + c + '"><h3>' + c + ' <span class="mono">' + list.length + '</span></h3><div class="tour-grid">' +
        list.map(function (p) {
          // Masonry columns keep every photo uncropped; aspect-ratio reserves the space before it loads.
          return '<button class="tour-item" type="button" data-photo="' + p.id + '" style="aspect-ratio:' + p.w + ' / ' + p.h + '" aria-label="Open photo: ' +
            p.alt.replace(/"/g, '&quot;') + '">' + picture(p, '(max-width: 759px) 50vw, 33vw', true) + '</button>';
        }).join('') + '</div></section>';
    }).join('');

    $('gallery-cats').addEventListener('click', function (e) {
      var chip = e.target.closest('.gallery__chip');
      if (!chip) return;
      haptic(6);
      scrollTourTo(chip.getAttribute('data-cat'), true);
    });
    if ('IntersectionObserver' in window) {
      catObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.id.replace('tour-', '');
          $$('.gallery__chip', $('gallery-cats')).forEach(function (ch) {
            var on = ch.getAttribute('data-cat') === id;
            ch.classList.toggle('is-active', on);
            if (on && ch.scrollIntoView) ch.scrollIntoView({ block: 'nearest', inline: 'center' });
          });
        });
      }, { root: galleryPanel, rootMargin: '-35% 0px -60% 0px' });
      $$('.tour-cat', $('gallery-body')).forEach(function (s) { catObserver.observe(s); });
    }
  }
  function scrollTourTo(catSlug, smooth) {
    var sec = $('tour-' + catSlug);
    if (!sec) return;
    var offset = $('gallery-cats').getBoundingClientRect().bottom - galleryPanel.getBoundingClientRect().top + 8;
    var top = sec.getBoundingClientRect().top - galleryPanel.getBoundingClientRect().top + galleryPanel.scrollTop - offset;
    galleryPanel.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
  }
  function openTour(cat, opts) {
    opts = opts || {};
    if (!photos.length) return;
    buildTour();
    if (gallery.hidden) {
      tourOpener = document.activeElement;
      gallery.hidden = false;
      lock();
      galleryPanel.scrollTop = 0;
      requestAnimationFrame(function () { gallery.classList.add('is-open'); galleryPanel.focus({ preventScroll: true }); });
      if (!opts.fromHash) setHash('photo-tour', true);
    }
    if (cat) requestAnimationFrame(function () { scrollTourTo(slug(cat), false); });
    haptic(8);
  }
  function closeTour(fromHistory) {
    if (gallery.hidden) return;
    gallery.classList.remove('is-open');
    var finish = function () { gallery.hidden = true; unlock(); };
    if (reduceMotion) finish(); else setTimeout(finish, 300);
    if (!fromHistory && lightbox.hidden) clearHash();
    if (tourOpener && tourOpener.focus) tourOpener.focus({ preventScroll: true });
  }
  gallery.querySelectorAll('[data-close-gallery]').forEach(function (b) { b.addEventListener('click', function () { closeTour(); }); });

  /* ---------- Lightbox ---------- */
  var stage = $('lightbox-stage');
  var current = -1, lbOpener = null;
  var preloaded = {};
  function preload(i) {
    var p = photos[i];
    if (!p || preloaded[p.id]) return;
    preloaded[p.id] = true;
    var im = new Image(); im.decoding = 'async'; im.src = full(p);
  }
  function show(i, dir) {
    if (i < 0 || i >= photos.length) return;
    current = i;
    var p = photos[i];
    var img = document.createElement('img');
    img.className = 'lightbox__img' + (dir && !reduceMotion ? ' is-entering-' + dir : '');
    img.src = full(p);
    img.alt = p.alt;
    img.width = p.w; img.height = p.h;
    img.draggable = false;
    stage.innerHTML = '';
    stage.appendChild(img);
    if (dir && !reduceMotion) requestAnimationFrame(function () { requestAnimationFrame(function () { img.classList.remove('is-entering-' + dir); }); });
    $('lightbox-count').textContent = (i + 1) + ' / ' + photos.length;
    $('lightbox-cat').textContent = p.cat;
    $('lightbox-caption').textContent = p.alt;
    $('lightbox-prev').disabled = i === 0;
    $('lightbox-next').disabled = i === photos.length - 1;
    preload(i + 1); preload(i - 1);
  }
  function indexOfId(id) {
    for (var i = 0; i < photos.length; i++) if (photos[i].id === id) return i;
    return 0;
  }
  function openLightbox(id, opts) {
    opts = opts || {};
    if (!photos.length) return;
    var i = indexOfId(id);
    if (lightbox.hidden) {
      lbOpener = document.activeElement;
      lightbox.hidden = false;
      lock();
      requestAnimationFrame(function () { lightbox.classList.add('is-open'); lightboxPanel.focus({ preventScroll: true }); });
    }
    show(i);
    if (!opts.fromHash) setHash('photo-' + photos[i].id, gallery.hidden);
    haptic(8);
  }
  function step(d) {
    var n = current + d;
    if (n < 0 || n >= photos.length) return;
    show(n, d > 0 ? 'next' : 'prev');
    setHash('photo-' + photos[n].id, false);
    haptic(6);
  }
  function closeLightbox(fromHistory) {
    if (lightbox.hidden) return;
    lightbox.classList.remove('is-open');
    var finish = function () { lightbox.hidden = true; stage.innerHTML = ''; unlock(); };
    if (reduceMotion) finish(); else setTimeout(finish, 220);
    if (!fromHistory) {
      if (!gallery.hidden) setHash('photo-tour', false);
      else clearHash();
    }
    if (lbOpener && lbOpener.focus) lbOpener.focus({ preventScroll: true });
  }
  lightbox.querySelectorAll('[data-close-lightbox]').forEach(function (b) { b.addEventListener('click', function () { closeLightbox(); }); });
  $('lightbox-prev').addEventListener('click', function () { step(-1); });
  $('lightbox-next').addEventListener('click', function () { step(1); });

  // Swipe left/right to move, swipe down to close; two fingers are left to the browser's pinch-zoom.
  var pointers = {}, drag = null;
  function zoomed() { return window.visualViewport && window.visualViewport.scale > 1.05; }
  stage.addEventListener('pointerdown', function (e) {
    pointers[e.pointerId] = true;
    if (Object.keys(pointers).length > 1 || zoomed()) { drag = null; return; }
    drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, axis: null, img: stage.querySelector('.lightbox__img') };
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag || !drag.img) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (!drag.axis && (Math.abs(drag.dx) > 8 || Math.abs(drag.dy) > 8)) {
      drag.axis = Math.abs(drag.dx) > Math.abs(drag.dy) ? 'x' : 'y';
      drag.img.classList.add('is-dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (drag.axis === 'x') drag.img.style.transform = 'translateX(' + drag.dx + 'px)';
    else if (drag.axis === 'y' && drag.dy > 0) {
      drag.img.style.transform = 'translateY(' + drag.dy + 'px) scale(' + Math.max(0.85, 1 - drag.dy / 1200) + ')';
      drag.img.style.opacity = String(Math.max(0.35, 1 - drag.dy / 500));
    }
  });
  function endDrag(e) {
    delete pointers[e.pointerId];
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.img) return;
    d.img.classList.remove('is-dragging');
    d.img.style.transform = ''; d.img.style.opacity = '';
    if (d.axis === 'x' && Math.abs(d.dx) > 60) step(d.dx < 0 ? 1 : -1);
    else if (d.axis === 'y' && d.dy > 110) closeLightbox();
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    if (!lightbox.hidden) {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    } else if (!gallery.hidden && e.key === 'Escape') { e.preventDefault(); closeTour(); }
  });

  /* ---------- Triggers ---------- */
  document.addEventListener('click', function (e) {
    var tile = e.target.closest('[data-photo]');
    if (tile && (tile.closest('#mosaic') || tile.closest('#gallery-body'))) {
      e.preventDefault();
      openLightbox(+tile.getAttribute('data-photo'));
      return;
    }
    var opener = e.target.closest('[data-open-gallery]');
    if (opener) {
      e.preventDefault();
      openTour(opener.getAttribute('data-open-gallery') || null);
    }
  });

  /* ---------- Deep links ---------- */
  function routeFromHash() {
    var h = location.hash;
    var m = h.match(/^#photo-(\d+)$/);
    if (h === '#photo-tour') openTour(null, { fromHash: true });
    else if (m && byId[+m[1]]) openLightbox(+m[1], { fromHash: true });
  }
  window.addEventListener('hashchange', function () {
    if (gallery.hidden && lightbox.hidden) routeFromHash();
  });

  /* ---------- Data ---------- */
  fetch('data/gallery.json').then(function (r) { return r.json(); }).then(function (list) {
    photos = list;
    photos.forEach(function (p) { byId[p.id] = p; });
    buildMosaicExtras();
    routeFromHash();
  }).catch(function () {
    if (countEl) countEl.hidden = true;
  });
})();
