/* Cinematic layer: loader with % counter, Lenis inertial scroll, decoding headings, count-ups,
   parallax and reveals, pinned horizontal villa tour (desktop), glowing cursor and magnetic buttons.
   Everything here is optional: without GSAP or under reduced motion the page works as plain HTML. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  window.LVM = window.LVM || {};

  if (reduceMotion || !gsap || !ST) {
    root.classList.remove('motion');
    return;
  }
  window.__motionReady = true;
  gsap.registerPlugin(ST);

  /* Inertial scroll (mouse/trackpad only; touch keeps native scrolling) */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.LVM.lenis = lenis;
  }
  // In-page links glide instead of jumping
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-open-sheet') || a.hasAttribute('data-open-gallery') || e.defaultPrevented) return;
    var id = a.getAttribute('href');
    var target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });

  /* Decoding text: random glyphs settle into the real words */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\';
  function scramble(el, duration) {
    var text = el.getAttribute('data-text') || el.textContent;
    el.setAttribute('data-text', text);
    if (!el.getAttribute('aria-label') && !el.closest('[aria-label]')) el.setAttribute('aria-label', text);
    var total = (duration || 0.9) * 1000;
    var t0 = performance.now();
    (function frame(t) {
      var p = Math.min(1, (t - t0) / total);
      var settled = Math.floor(p * text.length);
      var out = '';
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        out += (i < settled || ch === ' ') ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame); else el.textContent = text;
    })(t0);
  }

  /* Count-ups for numbers marked data-count */
  function countUp(el) {
    var end = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.4, ease: 'power2.out', onUpdate: function () { el.textContent = o.v.toFixed(dec); } });
  }

  /* Loader: counts real progress (fonts, hero photo, water engine), at least 0.9s, at most 2.4s */
  var pctEl = document.getElementById('preload-pct');
  var barEl = document.getElementById('preload-bar');
  var loader = document.querySelector('.preloader');
  var progress = { v: 0 };
  var targets = { fonts: false, photo: false, water: false };
  var start = performance.now();
  var done = false;
  function targetPct() {
    var n = 0;
    Object.keys(targets).forEach(function (k) { if (targets[k]) n++; });
    var timeShare = Math.min(1, (performance.now() - start) / 2400);
    return Math.max(n / 3, timeShare) * 100;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { targets.fonts = true; }); else targets.fonts = true;
  var heroImg = document.querySelector('.hero__media > img');
  if (heroImg.complete) targets.photo = true; else heroImg.addEventListener('load', function () { targets.photo = true; }, { once: true });
  document.addEventListener('lvm:water-ready', function () { targets.water = true; }, { once: true });
  if (!window.WebGLRenderingContext) targets.water = true;

  function tickLoader() {
    if (done) return;
    var goal = targetPct();
    progress.v += (goal - progress.v) * 0.12;
    if (goal >= 100 && progress.v > 99.4) progress.v = 100;
    var v = Math.floor(progress.v);
    pctEl.textContent = (v < 10 ? '00' : v < 100 ? '0' : '') + v;
    barEl.style.transform = 'scaleX(' + progress.v / 100 + ')';
    if (progress.v >= 100 && performance.now() - start > 900) { done = true; finishLoader(); return; }
    requestAnimationFrame(tickLoader);
  }
  requestAnimationFrame(tickLoader);

  function finishLoader() {
    gsap.timeline()
      .to('.preloader__inner', { y: -20, opacity: 0, duration: 0.45, ease: 'power2.in' })
      .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'power4.inOut' }, '-=0.1')
      .add(function () { root.classList.remove('motion'); loader.remove(); })
      .add(intro, '-=0.45');
  }

  /* Hero intro */
  function intro() {
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.hero__media', { scale: 1.12 }, { scale: 1, duration: 2.2, ease: 'power2.out' }, 0)
      .fromTo('[data-intro]', { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 0.1)
      .add(function () { $$('.hero__title [data-scramble]').forEach(function (el, i) { setTimeout(function () { scramble(el, 0.8); }, i * 120); }); }, 0.15);
  }

  /* Scroll-driven layers */
  gsap.to('.hero__content', {
    yPercent: -12, opacity: 0.2, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
  gsap.set('[data-reveal]', { y: 40, opacity: 0 });
  ST.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: function (batch) { gsap.to(batch, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'power3.out', overwrite: true }); }
  });

  $$('[data-scramble]').forEach(function (el) {
    if (el.closest('.hero')) return;
    ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () { scramble(el, 0.9); } });
  });
  $$('[data-count]').forEach(function (el) {
    ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { countUp(el); } });
  });

  $$('[data-clip]').forEach(function (el) {
    gsap.fromTo(el, { clipPath: 'inset(10% 8% 10% 8% round 28px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 42%', scrub: true }
    });
    gsap.fromTo(el.querySelector('img'), { scale: 1.18 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* Glowing cursor + magnetic buttons (mouse only) */
  if (finePointer) {
    var cursor = document.querySelector('.cursor');
    var ring = cursor.querySelector('.cursor__ring');
    var dot = cursor.querySelector('.cursor__dot');
    var pos = { x: -100, y: -100 }, ringPos = { x: -100, y: -100 };
    root.classList.add('has-cursor');
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      pos.x = e.clientX; pos.y = e.clientY;
      dot.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';
    }, { passive: true });
    gsap.ticker.add(function () {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      ring.style.transform = 'translate3d(' + ringPos.x + 'px,' + ringPos.y + 'px,0)';
    });
    document.addEventListener('pointerover', function (e) {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, input, select, label, [data-open-sheet]'));
      cursor.classList.toggle('is-water', !!e.target.closest('.hero') && !e.target.closest('a, button'));
    });
    document.addEventListener('pointerleave', function () { cursor.classList.add('is-hidden'); });
    document.addEventListener('pointerenter', function () { cursor.classList.remove('is-hidden'); });

    $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.38);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  window.addEventListener('load', function () { ST.refresh(); });
})();
