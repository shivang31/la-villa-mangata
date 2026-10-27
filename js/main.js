(function () {
  'use strict';

  var WA = 'https://wa.me/919111333368';
  var RATE = 15000;
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var inr = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
  window.__mainReady = true;

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

  /* Cost splitter */
  var guests = $('#guests');
  var nightsOut = $('#nights-out');
  var down = $('#nights-down');
  var up = $('#nights-up');
  var nights = 1;
  function renderSplit() {
    var g = Number(guests.value);
    var total = RATE * nights;
    $('#guests-out').textContent = g;
    nightsOut.textContent = nights;
    $('#per-person').textContent = inr(total / g);
    $('#per-person-sub').textContent = 'per person, ' + nights + (nights === 1 ? ' night' : ' nights');
    $('#total').textContent = inr(total);
    down.disabled = nights <= 1;
    up.disabled = nights >= 7;
  }
  guests.addEventListener('input', renderSplit);
  down.addEventListener('click', function () { if (nights > 1) { nights--; renderSplit(); } });
  up.addEventListener('click', function () { if (nights < 7) { nights++; renderSplit(); } });
  renderSplit();

  /* Spaces carousel: native scroll-snap, the centred card is marked active */
  var track = $('#carousel');
  var cards = $$('.card', track);
  var nowEl = $('#slide-now');
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var active = -1;
  // Phones centre the focused card; wide screens line it up with the page's left edge.
  var wide = window.matchMedia('(min-width: 960px)');
  var padLeft = function () { return parseFloat(getComputedStyle(track).paddingLeft) || 0; };
  $('#slide-total').textContent = pad(cards.length);
  function setActive() {
    var anchor = wide.matches ? track.scrollLeft + padLeft() : track.scrollLeft + track.clientWidth / 2;
    var best = 0;
    var bestDist = Infinity;
    cards.forEach(function (card, i) {
      var ref = wide.matches ? card.offsetLeft : card.offsetLeft + card.offsetWidth / 2;
      var d = Math.abs(ref - anchor);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best === active) return;
    if (active > -1) cards[active].classList.remove('is-active');
    cards[best].classList.add('is-active');
    active = best;
    nowEl.textContent = pad(best + 1);
    $('#slide-prev').disabled = best === 0;
    $('#slide-next').disabled = best === cards.length - 1;
  }
  var ticking = false;
  track.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; setActive(); });
  }, { passive: true });
  function goTo(i) {
    var card = cards[Math.max(0, Math.min(cards.length - 1, i))];
    var left = wide.matches ? card.offsetLeft - padLeft() : card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
    track.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  $('#slide-prev').addEventListener('click', function () { goTo(active - 1); });
  $('#slide-next').addEventListener('click', function () { goTo(active + 1); });
  window.addEventListener('resize', setActive);
  setActive();

  /* Dock: highlight the section in view */
  var dockItems = $$('.dock__item');
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
    ['top', 'price', 'explore', 'amenities', 'events', 'reviews', 'where', 'book'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* Booking request opens WhatsApp with the details filled in */
  var form = $('#book-form');
  var err = $('#form-error');
  var checkin = $('#checkin');
  var checkout = $('#checkout');
  var iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  var today = new Date();
  checkin.min = iso(today);
  checkout.min = iso(new Date(today.getTime() + 864e5));
  checkin.addEventListener('change', function () {
    if (!checkin.value) return;
    var next = new Date(checkin.value + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    checkout.min = iso(next);
    if (!checkout.value || checkout.value <= checkin.value) checkout.value = iso(next);
  });
  var pretty = function (v) {
    return new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    if (!f.checkin.value || !f.checkout.value) { err.textContent = 'Choose your check-in and check-out dates.'; return; }
    if (f.checkout.value <= f.checkin.value) { err.textContent = 'Check-out must be after check-in.'; return; }
    if (!f.people.value || Number(f.people.value) < 1) { err.textContent = 'Enter how many guests are coming.'; return; }
    if (!f.name.value.trim()) { err.textContent = 'Enter your name so we know who to reply to.'; f.name.focus(); return; }
    err.textContent = '';
    var msg = 'Hi, I would like to book La Villa Mangata.\n' +
      'Check-in: ' + pretty(f.checkin.value) + '\n' +
      'Check-out: ' + pretty(f.checkout.value) + '\n' +
      'Guests: ' + f.people.value + '\n' +
      'Occasion: ' + f.occasion.value + '\n' +
      'Name: ' + f.name.value.trim();
    window.open(WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  /* Motion: one intro sequence, then scroll-driven parallax and reveals */
  function startMotion() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    if (reduceMotion || !gsap || !ST) { root.classList.remove('motion'); return; }
    gsap.registerPlugin(ST);

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.hero__media > img', { scale: 1.14 }, { scale: 1, duration: 2.4, ease: 'power2.out' }, 0)
      .fromTo('[data-intro]', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.05, stagger: 0.09 }, 0.15);
    window.__motionReady = true;
    root.classList.remove('motion');

    gsap.to('.hero__media', {
      yPercent: 16, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.fromTo('.band__media', { yPercent: -10 }, {
      yPercent: 10, ease: 'none',
      scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true }
    });

    gsap.set('[data-reveal]', { y: 36, opacity: 0 });
    ST.batch('[data-reveal]', {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'power3.out', overwrite: true });
      }
    });

    $$('[data-clip]').forEach(function (el) {
      gsap.fromTo(el,
        { clipPath: 'inset(10% 8% 10% 8% round 28px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 42%', scrub: true } });
      gsap.fromTo(el.querySelector('img'), { scale: 1.18 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    window.addEventListener('load', function () { ST.refresh(); });
  }
  // Deferred scripts run in order, so GSAP is ready here if its CDN loaded.
  startMotion();
})();
